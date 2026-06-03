/**
 * ============================================================================
 * 模組定位：Planist 語法即時診斷編譯檢查器 (src/providers/linterProvider.ts)
 * 
 * 此檔案負責在 VS Code 編輯器內註冊一個實時 Linter 機制。透過與全域記憶體索引
 * `FlowIndexer` 以及文件變更事件關聯，當用戶鍵入內容時，動態進行語法及架構檢查：
 * - 檢查實體或方法參考是否存在（防呆標錯）。
 * - 確保實體宣告、方法宣告及內部關係結構符合 UML 與 DSL 正規語法。
 * - 當偵測到錯誤時，自動在編輯器對應位置標記紅色或黃色的 wavy 診斷波浪線。
 * - 當設定 `planist.general.enableLinter` 被關閉時，自動即時清空並停止 Linter 機制。
 * 
 * 重要類別與函數：
 * - FlowLinter: 實體診斷錯誤收集器，實現 vscode.Disposable。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的語法檢查規則（如限制某些實體間不能建立特定的 inherits 繼承關係），
 *    可於 `runDiagnostics()` 內部的行的掃描邏輯中增加對應的驗證條件，並使用 `diagnostics.push()` 保存。
 * 2. 診斷的嚴重程度（Error/Warning/Information），可調整 `vscode.DiagnosticSeverity` 控制。
 * ============================================================================
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FlowIndexer } from '../indexing/flowIndexer';
import { parseFlowDocuments, findEntityDeclarationLine } from '../dsl/flowDsl';
import { PatternManager } from '../config/patternManager';

export class FlowLinter implements vscode.Disposable {
	private diagnosticCollection: vscode.DiagnosticCollection;
	private disposables: vscode.Disposable[] = [];

	constructor(private indexer: FlowIndexer) {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('flowlang');
		this.disposables.push(this.diagnosticCollection);

		// 當記憶體索引更新時，重刷所有可見編輯器的診斷標記
		this.disposables.push(
			this.indexer.onDidChange(() => {
				this.runDiagnosticsForAllOpenEditors();
			})
		);

		// 綁定編輯器文件的生命週期事件
		this.disposables.push(
			vscode.workspace.onDidOpenTextDocument((doc) => {
				this.runDiagnostics(doc);
			}),
			vscode.workspace.onDidChangeTextDocument((event) => {
				this.runDiagnostics(event.document);
			}),
			vscode.workspace.onDidCloseTextDocument((doc) => {
				this.diagnosticCollection.delete(doc.uri);
			})
		);

		// 監聽一般設定 flag 以便即時開關 Linter 功能
		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('planist.general.enableLinter')) {
					const isEnabled = vscode.workspace.getConfiguration('planist').get<boolean>('general.enableLinter', true);
					if (!isEnabled) {
						this.diagnosticCollection.clear();
					} else {
						this.runDiagnosticsForAllOpenEditors();
					}
				}
			})
		);

		// 初始化對已開啟編輯器執行初次掃描
		this.runDiagnosticsForAllOpenEditors();
	}

	private runDiagnosticsForAllOpenEditors(): void {
		LogManager.log('FlowLinter: runDiagnosticsForAllOpenEditors triggered.');
		for (const editor of vscode.window.visibleTextEditors) {
			if (this.isPlanFile(editor.document.uri)) {
				this.runDiagnostics(editor.document);
			}
		}
	}

	private isPlanFile(uri: vscode.Uri): boolean {
		if (uri.scheme !== 'file') {
			return false;
		}
		const ext = path.extname(uri.fsPath).toLowerCase();
		return ext === '.pln' || ext === '.plan' || ext === '.flow';
	}

	/**
	 * 對指定文件逐行進行 DSL 語意規則檢驗並向 VS Code 診斷管理器提交
	 */
	private runDiagnostics(document: vscode.TextDocument): void {
		if (!/^\s*#schema flow/.test(document.getText())) {
			this.diagnosticCollection.set(document.uri, []);
			return;
		}
		// [除錯日誌]
		LogManager.log('FlowLinter.runDiagnostics: start for URI:', document ? document.uri.fsPath : 'undefined');

		// [參數驗證]
		LogManager.assert(!!document, 'FlowLinter.runDiagnostics: document parameter cannot be null/undefined');

		const isEnabled = vscode.workspace.getConfiguration('planist').get<boolean>('general.enableLinter', true);
		if (!isEnabled) {
			LogManager.log('FlowLinter.runDiagnostics: linter is disabled by user settings.');
			this.diagnosticCollection.delete(document.uri);
			return;
		}

		if (!this.isPlanFile(document.uri)) {
			return;
		}

		const diagnostics: vscode.Diagnostic[] = [];
		const text = document.getText();
		const lines = text.split(/\r?\n/);

		// 檢驗用的正則
		const referencePattern = /->\s*([A-Za-z_][\w-]*)(?:\.([A-Za-z_][\w-]*))?/g;
		const headerRegex = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\s+([A-Za-z_][\w-]*)\b/i;
		const referenceRegex = /^\s*(?:#?reference|#?refer)\b/i;
		const styleRegex = /^\s*(?:style\.)?(color|borderColor|radius)\s*:/i;
		const visualOverrideRegex = /^\s*\[Visual-Override\]/i;
		const methodHeaderRegex = /^\s*(?:(public|protected|private|\+|-|#)\s+)?([A-Za-z_][\w-]*)\s*\(/i;
		const dividerRegex = /^\s*---\s*(?:([Cc]enter|[Ll]eft|[Rr]ight)\s*:\s*(.+?))?\s*$/;

		let inClassBlock = false;
		let classHeaderLine = -1;
		let classHeaderName = '';
		let bracesCount = 0;
		let inVisualOverride = false;
		let entityDeclarationsCount = 0;

		lines.forEach((lineText, lineIndex) => {
			const trimmed = lineText.trim();
			if (!trimmed) {
				return;
			}

			// 忽略單行或區塊首註解
			if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
				return;
			}

			// 特殊的視覺 Override 標記
			if (visualOverrideRegex.test(trimmed)) {
				inVisualOverride = true;
				return;
			}

			if (inVisualOverride) {
				return;
			}

			// 檢查實體宣告頭部
			const headerMatch = lineText.match(headerRegex);
			if (headerMatch) {
				entityDeclarationsCount++;
				if (entityDeclarationsCount > 1) {
					const startIdx = lineText.indexOf(headerMatch[1]);
					const range = new vscode.Range(lineIndex, startIdx, lineIndex, startIdx + headerMatch[1].length + 1 + headerMatch[2].length);
					diagnostics.push(new vscode.Diagnostic(
						range,
						`每個檔案只能定義一個 entity。`,
						vscode.DiagnosticSeverity.Error
					));
				}
				classHeaderLine = lineIndex;
				classHeaderName = headerMatch[2];
				inClassBlock = true;
				const kind = headerMatch[1].toLowerCase();
				
				// 檢查此宣告行或下一行是否有左大括號 '{'
				let hasBrace = lineText.includes('{');
				if (!hasBrace && lineIndex + 1 < lines.length) {
					hasBrace = lines[lineIndex + 1].includes('{');
				}
				if (!hasBrace && kind !== 'bind' && kind !== 'package' && kind !== 'module') {
					const range = new vscode.Range(lineIndex, 0, lineIndex, lineText.length);
					diagnostics.push(new vscode.Diagnostic(
						range,
						`實體類別 '${classHeaderName}' 宣告缺少左大括號 '{'。`,
						vscode.DiagnosticSeverity.Warning
					));
				}
			}

			// 追蹤大括號配對以推算括號範圍
			for (let i = 0; i < lineText.length; i++) {
				if (lineText[i] === '{') {
					bracesCount++;
				}
				if (lineText[i] === '}') {
					bracesCount--;
					if (bracesCount === 0) {
						inClassBlock = false;
					}
				}
			}

			// 語意規則：外部屬性定義警告
			if (!inClassBlock && lineIndex !== classHeaderLine && bracesCount === 0) {
				const isAllowed = referenceRegex.test(trimmed) || styleRegex.test(trimmed) || headerRegex.test(trimmed);
				if (!isAllowed) {
					if (trimmed.includes('->') || trimmed.includes(':') || methodHeaderRegex.test(trimmed) || dividerRegex.test(trimmed)) {
						const range = new vscode.Range(lineIndex, 0, lineIndex, lineText.length);
						diagnostics.push(new vscode.Diagnostic(
							range,
							`關係定義、分隔線與成員方法必須撰寫於 class/interface 的花括號區塊內部。`,
							vscode.DiagnosticSeverity.Warning
						));
					}
				}
			}

			// 語意規則：類別內部方法宣告格式校驗
			if (inClassBlock) {
				const isMethodStart = trimmed.startsWith('+') || (trimmed.startsWith('-') && !trimmed.startsWith('->')) || trimmed.startsWith('#') ||
					trimmed.startsWith('public') || trimmed.startsWith('private') || trimmed.startsWith('protected');
				
				if (isMethodStart) {
					const methodPattern = /^\s*(?:(public|protected|private|\+|-|#)\s+)?([A-Za-z_][\w-]*)\s*\(([^)]*)\)(?:\s*:\s*([A-Za-z0-9_<>\s\[\]]+))?\s*\{?\s*$/i;
					if (!methodPattern.test(lineText)) {
						const range = new vscode.Range(lineIndex, 0, lineIndex, lineText.length);
						diagnostics.push(new vscode.Diagnostic(
							range,
							`方法簽名必須符合 UML 標記格式：'+ methodName(param) { ... }'。`,
							vscode.DiagnosticSeverity.Warning
						));
					}
				}
			}

			// 關係對象尋路與方法解鎖驗證
			referencePattern.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = referencePattern.exec(lineText)) !== null) {
				const targetName = match[1];
				const targetMethodName = match[2] ?? null;
				const startCharacter = match.index + match[0].lastIndexOf(match[1]);

				const entity = this.indexer.getEntity(targetName);
				if (!entity) {
					const range = new vscode.Range(lineIndex, startCharacter, lineIndex, startCharacter + targetName.length);
					const diag = new vscode.Diagnostic(
						range,
						`找不到指定的目標實體 '${targetName}'。`,
						vscode.DiagnosticSeverity.Warning
					);
					diag.code = 'entity-not-found';
					diagnostics.push(diag);
				} else if (targetMethodName) {
					const methodExists = entity.methods.some((m) => m.name.toLowerCase() === targetMethodName.toLowerCase());
					if (!methodExists) {
						const methodStart = startCharacter + targetName.length + 1;
						const range = new vscode.Range(lineIndex, methodStart, lineIndex, methodStart + targetMethodName.length);
						const diag = new vscode.Diagnostic(
							range,
							`方法 '${targetMethodName}' 不存在於目標實體 '${targetName}' 中。`,
							vscode.DiagnosticSeverity.Warning
						);
						diag.code = 'method-not-found';
						diagnostics.push(diag);
					}
				}
			}
		});

		// 檔案結尾大括號閉合性校驗
		if (bracesCount > 0 && classHeaderLine !== -1) {
			const range = new vscode.Range(classHeaderLine, 0, classHeaderLine, classHeaderName.length + 6);
			diagnostics.push(new vscode.Diagnostic(
				range,
				`類別結構 '${classHeaderName}' 缺少了大括號 '}' 封閉區塊。`,
				vscode.DiagnosticSeverity.Warning
			));
		}

		// Architectural Pattern Check
		const parsedDocs = parseFlowDocuments(text);
		for (const doc of parsedDocs) {
			if (doc.pattern && doc.entityName) {
				const config = PatternManager.loadPatterns()[doc.pattern];
				if (config && config.suggested_elements) {
					const lineNum = findEntityDeclarationLine(text, doc.entityName) ?? 0;
					
					// check methods
					const expectedMethods = config.suggested_elements.methods || [];
					for (const expected of expectedMethods) {
						const nameMatch = expected.match(/([a-zA-Z_]\w*)\s*\(/);
						if (nameMatch) {
							const methodName = nameMatch[1];
							const hasMethod = doc.methods.some(m => m.name === methodName);
							if (!hasMethod) {
								const diag = new vscode.Diagnostic(
									new vscode.Range(lineNum, 0, lineNum, 100),
									`Pattern '${doc.pattern}' suggests implementing method: ${expected}`,
									vscode.DiagnosticSeverity.Hint
								);
								diag.code = { value: `missing-pattern-method|${expected}`, target: vscode.Uri.parse('https://planist.dev') };
								diagnostics.push(diag);
							}
						}
					}
					// check relations
					const expectedRelations = config.suggested_elements.relations || [];
					for (const expected of expectedRelations) {
						const targetMatch = expected.match(/->\s*([a-zA-Z_]\w*)/);
						if (targetMatch && !targetMatch[1].includes('$')) {
							const targetName = targetMatch[1];
							const hasRelation = doc.relationTargets.includes(targetName);
							if (!hasRelation) {
								const diag = new vscode.Diagnostic(
									new vscode.Range(lineNum, 0, lineNum, 100),
									`Pattern '${doc.pattern}' suggests relation: ${expected}`,
									vscode.DiagnosticSeverity.Hint
								);
								diag.code = { value: `missing-pattern-relation|${expected}`, target: vscode.Uri.parse('https://planist.dev') };
								diagnostics.push(diag);
							}
						}
					}
				}
			}
		}

		this.diagnosticCollection.set(document.uri, diagnostics);
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose());
	}
}
