/**
 * ============================================================================
 * 模組定位：Planist 編輯器語意語法客製化高亮器 (src/providers/highlighter.ts)
 * 
 * 此檔案負責在 VS Code 編輯器內對正在編輯的 .pln 文件執行細緻的高亮修飾。
 * 由於 Planist 目前沒有預設的 TextMate 語意語法（.tmLanguage），
 * 此類別將自主對每行文本進行語法 Token 化，動態解析並裝飾：
 * - 註解 (comments)、字串 (strings)、數字 (numbers)。
 * - 關鍵字如 class, interface 等。
 * - UML 關係如 inherits, implements, composes 等。
 * - 針對 'text' 實體種類文字，自動根據當前主題深淺調整其高亮色彩（深色主題用白色，淺色主題用黑色）。
 * 
 * 重要類別：
 * - PlnKeywordHighlighter: 主體高亮及高亮快取容器，實現 vscode.Disposable。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的關鍵字高亮，可擴充 `modifiers`、`keywords` 或 `types` 集合。
 * 2. 高亮的樣式細節（如粗體、斜體或背景底色），可在 `updateDecorations()` 內調整
 *    `vscode.window.createTextEditorDecorationType()`。
 * ============================================================================
 */

import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FLOW_LANGUAGE_ID } from '../dsl/flowDsl';
import { refreshCurrentPreview } from '../webview/previewPanel';

const DEFAULT_COLORS_DARK: Record<string, string> = {
	class: 'rgba(75, 192, 192, 1.0)',
	abstract: 'rgba(79, 70, 229, 1.0)',
	interface: 'rgba(153, 102, 255, 1.0)',
	record: 'rgba(217, 119, 6, 1.0)',
	enum: 'rgba(219, 39, 119, 1.0)',
	text: 'rgba(255, 255, 255, 1.0)',
	bind: 'rgba(100, 149, 237, 1.0)',
	package: 'rgba(139, 92, 246, 1.0)',
	module: 'rgba(139, 92, 246, 1.0)',
};

const DEFAULT_COLORS_LIGHT: Record<string, string> = {
	class: 'rgba(0, 128, 128, 1.0)',
	abstract: 'rgba(51, 41, 204, 1.0)',
	interface: 'rgba(112, 48, 160, 1.0)',
	record: 'rgba(180, 83, 9, 1.0)',
	enum: 'rgba(190, 24, 74, 1.0)',
	text: 'rgba(0, 0, 0, 1.0)',
	bind: 'rgba(30, 144, 255, 1.0)',
	package: 'rgba(109, 40, 217, 1.0)',
	module: 'rgba(109, 40, 217, 1.0)',
};

const DEFAULT_TOKENS_DARK: Record<string, string> = {
	keyword: 'rgba(86, 156, 214, 1.0)',
	config: 'rgba(220, 220, 170, 1.0)',
	arrow: 'rgba(197, 134, 192, 1.0)',
	type: 'rgba(78, 201, 176, 1.0)',
	comment: 'rgba(106, 153, 85, 1.0)',
	string: 'rgba(206, 145, 120, 1.0)',
	number: 'rgba(181, 206, 168, 1.0)',
};

const DEFAULT_TOKENS_LIGHT: Record<string, string> = {
	keyword: 'rgba(0, 0, 255, 1.0)',
	config: 'rgba(163, 21, 21, 1.0)',
	arrow: 'rgba(175, 0, 219, 1.0)',
	type: 'rgba(38, 127, 153, 1.0)',
	comment: 'rgba(0, 128, 0, 1.0)',
	string: 'rgba(163, 21, 21, 1.0)',
	number: 'rgba(9, 134, 115, 1.0)',
};

export class PlnKeywordHighlighter {
	private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
	private disposables: vscode.Disposable[] = [];

	constructor() {
		this.updateDecorations();

		// 註冊文檔與主題變更的監聽
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor) {
					this.triggerHighlight(editor);
				}
			}),
			vscode.workspace.onDidChangeTextDocument((event) => {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && event.document === activeEditor.document) {
					this.triggerHighlight(activeEditor);
				}
			}),
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (
					event.affectsConfiguration('planist.theme.keywords') ||
					event.affectsConfiguration('planist.theme.tokens') ||
					event.affectsConfiguration('planist.board') ||
					event.affectsConfiguration('planist.entity') ||
					event.affectsConfiguration('planist.general')
				) {
					this.updateDecorations();
					vscode.window.visibleTextEditors.forEach((editor) => {
						this.triggerHighlight(editor);
					});
					void refreshCurrentPreview();
				}
			}),
			vscode.window.onDidChangeActiveColorTheme(() => {
				this.updateDecorations();
				vscode.window.visibleTextEditors.forEach((editor) => {
					this.triggerHighlight(editor);
				});
				void refreshCurrentPreview();
			})
		);

		// 在初始化後對目前所有可見的編輯器進行首刷高亮
		setTimeout(() => {
			vscode.window.visibleTextEditors.forEach((editor) => {
				this.triggerHighlight(editor);
			});
		}, 100);
	}

	/**
	 * 從 settings.json 快取最新的色彩值並構建 DecorationTypes，支持 text 的 theme 自適應
	 */
	private updateDecorations() {
		// [除錯日誌]
		LogManager.log('PlnKeywordHighlighter.updateDecorations: start caching decorations.');

		// 清理舊有的 Decoration
		for (const decType of this.decorationTypes.values()) {
			decType.dispose();
		}
		this.decorationTypes.clear();

		const generalConfig = vscode.workspace.getConfiguration('planist.general');
		const themeMode = generalConfig.get<string>('themeMode', 'system');
		const activeTheme = vscode.window.activeColorTheme;
		let isDarkTheme = true;
		if (themeMode === 'dark') {
			isDarkTheme = true;
		} else if (themeMode === 'light') {
			isDarkTheme = false;
		} else {
			isDarkTheme = activeTheme.kind === vscode.ColorThemeKind.Dark || activeTheme.kind === vscode.ColorThemeKind.HighContrast;
		}

		// 1. 載入 keywords 顏色設定
		const keywordsConfig = vscode.workspace.getConfiguration('planist.theme.keywords');
		const kinds = ['class', 'abstract', 'interface', 'record', 'enum', 'text', 'bind', 'package', 'module'];

		for (const kind of kinds) {
			const inspect = keywordsConfig.inspect<string>(kind);
			const isCustomized = inspect?.globalValue !== undefined || inspect?.workspaceValue !== undefined || inspect?.workspaceFolderValue !== undefined;
			const color = isCustomized ? keywordsConfig.get<string>(kind) : (isDarkTheme ? DEFAULT_COLORS_DARK[kind] : DEFAULT_COLORS_LIGHT[kind]);
			
			if (color) {
				const decType = vscode.window.createTextEditorDecorationType({
					color: color,
				});
				this.decorationTypes.set(kind, decType);
			}
		}

		// 2. 載入 tokens 顏色設定
		const tokensConfig = vscode.workspace.getConfiguration('planist.theme.tokens');
		const tokenKeys = ['keyword', 'config', 'arrow', 'type', 'comment', 'string', 'number'];
		for (const key of tokenKeys) {
			const inspect = tokensConfig.inspect<string>(key);
			const isCustomized = inspect?.globalValue !== undefined || inspect?.workspaceValue !== undefined || inspect?.workspaceFolderValue !== undefined;
			const color = isCustomized ? tokensConfig.get<string>(key) : (isDarkTheme ? DEFAULT_TOKENS_DARK[key] : DEFAULT_TOKENS_LIGHT[key]);
			
			if (color) {
				const style: vscode.DecorationRenderOptions = { color: color };
				if (key === 'comment') {
					style.fontStyle = 'italic';
				}
				this.decorationTypes.set(key, vscode.window.createTextEditorDecorationType(style));
			}
		}

		// 'modifier' 與 'keyword' 共用顏色
		const keywordInspect = tokensConfig.inspect<string>('keyword');
		const keywordIsCustomized = keywordInspect?.globalValue !== undefined || keywordInspect?.workspaceValue !== undefined || keywordInspect?.workspaceFolderValue !== undefined;
		const keywordColor = keywordIsCustomized ? tokensConfig.get<string>('keyword') : (isDarkTheme ? DEFAULT_TOKENS_DARK['keyword'] : DEFAULT_TOKENS_LIGHT['keyword']);
		if (keywordColor) {
			this.decorationTypes.set('modifier', vscode.window.createTextEditorDecorationType({
				color: keywordColor,
			}));
		}
	}

	/**
	 * 高亮核心：Token 掃描並分類裝飾
	 */
	public triggerHighlight(editor: vscode.TextEditor) {
		// [除錯日誌]
		LogManager.log('PlnKeywordHighlighter.triggerHighlight: start highlighting document:', editor ? editor.document.uri.fsPath : 'undefined');

		if (!editor || editor.document.languageId !== FLOW_LANGUAGE_ID) {
			return;
		}

		if (!/^\s*#schema flow/.test(editor.document.getText())) {
			return;
		}

		const text = editor.document.getText();
		const lines = text.split(/\r?\n/);

		const ranges = new Map<string, vscode.Range[]>();
		const allKeys = [
			'class', 'abstract', 'interface', 'record', 'enum', 'text', 'bind', 'package', 'module',
			'keyword', 'config', 'arrow', 'type', 'modifier', 'comment', 'string', 'number'
		];
		for (const key of allKeys) {
			ranges.set(key, []);
		}

		// 用於比對的關鍵字列表
		const modifiers = new Set([
			'public', 'private', 'protected', 'static', 'readonly', 'abstract', 'async',
			'override', 'virtual', 'final', 'const', 'variable', 'let', 'var', 'package',
			'import', 'export', 'namespace', 'using'
		]);

		const keywords = new Set([
			'class', 'interface', 'if', 'else', 'return', 'for', 'while', 'do', 'switch', 'case', 'break',
			'continue', 'new', 'throw', 'try', 'catch', 'finally', 'default'
		]);

		const configKeys = new Set([
			'bind', 'autoImport', 'style', 'color', 'borderColor', 'borderRadius', 'opacity'
		]);

		const arrowKeys = new Set([
			'extends', 'implements', 'inherits', 'associates', 'aggregates', 'composes', 'dependsOn'
		]);

		const types = new Set([
			'string', 'number', 'boolean', 'any', 'void', 'int', 'double', 'float',
			'char', 'long', 'bool', 'Record', 'List', 'Map', 'object', 'null', 'undefined',
			'true', 'false'
		]);

		// 1. 探測檔案頂部的宣告種類以決定 inline 關係高亮底色
		let entityKind = 'class';
		const headerRegex = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\b/i;
		for (const lineText of lines) {
			const match = lineText.match(headerRegex);
			if (match) {
				entityKind = match[1].toLowerCase();
				break;
			}
		}

		const headerRegexGlobal = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\b/gim;
		const relKeywordRegex = /\b(inherits|implements|associates|aggregates|composes|dependsOn)\b/g;

		lines.forEach((lineText, lineIndex) => {
			let remainingText = lineText;

			// 高亮宣告頭部的關鍵字
			headerRegexGlobal.lastIndex = 0;
			const m = headerRegexGlobal.exec(lineText);
			if (m) {
				const kind = m[1].toLowerCase();
				const keywordIndex = lineText.indexOf(m[1]);
				if (keywordIndex !== -1) {
					const startPos = new vscode.Position(lineIndex, keywordIndex);
					const endPos = new vscode.Position(lineIndex, keywordIndex + m[1].length);
					ranges.get(kind)?.push(new vscode.Range(startPos, endPos));
				}
			}

			// 高亮 inline 關係操作符關鍵字
			const commentIdx = lineText.indexOf('//');
			relKeywordRegex.lastIndex = 0;
			let match;
			while ((match = relKeywordRegex.exec(lineText)) !== null) {
				const keyword = match[1];
				const keywordIndex = match.index;
				if (commentIdx === -1 || keywordIndex < commentIdx) {
					const startPos = new vscode.Position(lineIndex, keywordIndex);
					const endPos = new vscode.Position(lineIndex, keywordIndex + keyword.length);
					ranges.get('arrow')?.push(new vscode.Range(startPos, endPos));
				}
			}

			// Lexical Tokenizer 解析
			// A. 註解高亮
			if (commentIdx !== -1) {
				ranges.get('comment')?.push(new vscode.Range(
					new vscode.Position(lineIndex, commentIdx),
					new vscode.Position(lineIndex, lineText.length)
				));
				remainingText = lineText.substring(0, commentIdx);
			}

			// B. 字串高亮
			const stringRegex = /(["'])(?:(?=(\\?))\2.)*?\1/g;
			let strMatch;
			while ((strMatch = stringRegex.exec(remainingText)) !== null) {
				ranges.get('string')?.push(new vscode.Range(
					new vscode.Position(lineIndex, strMatch.index),
					new vscode.Position(lineIndex, strMatch.index + strMatch[0].length)
				));
			}

			// 過濾掉字串，以防被接下來的高亮干擾
			let textForWords = remainingText.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (s) => ' '.repeat(s.length));

			// C. 數字高亮
			const numberRegex = /\b\d+(?:\.\d+)?\b/g;
			let numMatch;
			while ((numMatch = numberRegex.exec(textForWords)) !== null) {
				ranges.get('number')?.push(new vscode.Range(
					new vscode.Position(lineIndex, numMatch.index),
					new vscode.Position(lineIndex, numMatch.index + numMatch[0].length)
				));
			}

			// 過濾掉數字
			textForWords = textForWords.replace(/\b\d+(?:\.\d+)?\b/g, (s) => ' '.repeat(s.length));

			// D1. #reference/refer 語意高亮
			const refDirectiveRegex = /(?:#?reference|#?refer)\b/g;
			let refMatch;
			while ((refMatch = refDirectiveRegex.exec(textForWords)) !== null) {
				const startPos = new vscode.Position(lineIndex, refMatch.index);
				const endPos = new vscode.Position(lineIndex, refMatch.index + refMatch[0].length);
				ranges.get('config')?.push(new vscode.Range(startPos, endPos));
			}
			textForWords = textForWords.replace(/(?:#?reference|#?refer)\b/g, (s) => ' '.repeat(s.length));

			// D2. 單字辨識與修飾
			const wordRegex = /\b[A-Za-z_][A-Za-z0-9_-]*\b/g;
			let wordMatch;
			while ((wordMatch = wordRegex.exec(textForWords)) !== null) {
				const word = wordMatch[0];
				const startIdx = wordMatch.index;
				const range = new vscode.Range(
					new vscode.Position(lineIndex, startIdx),
					new vscode.Position(lineIndex, startIdx + word.length)
				);

				// 忽略頭部類別宣告名稱
				if (m && startIdx === lineText.indexOf(m[1])) {
					continue;
				}

				if (modifiers.has(word)) {
					ranges.get('modifier')?.push(range);
				} else if (arrowKeys.has(word)) {
					ranges.get('arrow')?.push(range);
				} else if (configKeys.has(word)) {
					ranges.get('config')?.push(range);
				} else if (keywords.has(word)) {
					ranges.get('keyword')?.push(range);
				} else if (types.has(word)) {
					ranges.get('type')?.push(range);
				}
			}
		});

		// 應用客製高亮 Decoration
		for (const [kind, rangesList] of ranges.entries()) {
			const decType = this.decorationTypes.get(kind);
			if (decType) {
				editor.setDecorations(decType, rangesList);
			}
		}
	}

	public dispose() {
		this.disposables.forEach((d) => d.dispose());
		for (const decType of this.decorationTypes.values()) {
			decType.dispose();
		}
	}
}
