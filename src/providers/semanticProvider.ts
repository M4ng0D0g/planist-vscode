/**
 * ============================================================================
 * 模組定位：Planist 編輯器語義分析 Token 提供者 (src/providers/semanticProvider.ts)
 * 
 * 此檔案負責實現 VS Code 的 `DocumentSemanticTokensProvider` 介面。它向 VS Code
 * 宣告自定義的 DSL 關鍵字語意結構（如 class, interface, abstract, record 等），
 * 藉由建立 SemanticTokens 供 VS Code 編輯器高亮引擎進行底層渲染。
 * 
 * 重要類別：
 * - PlnSemanticTokensProvider: 繼承 DocumentSemanticTokensProvider 的類別高亮器。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的 Token 分類，可在 `tokenTypes` 陣列中擴展新的標籤，並在
 *    `provideDocumentSemanticTokens()` 中利用 `builder.push()` 註冊對應的位置與種類。
 * ============================================================================
 */

import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FLOW_LANGUAGE_ID } from '../dsl/flowDsl';

export class PlnSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	private readonly tokenTypes = ['class', 'abstract', 'interface', 'record', 'enum', 'text', 'bind', 'package', 'module'];
	public readonly legend = new vscode.SemanticTokensLegend(this.tokenTypes, []);

	public provideDocumentSemanticTokens(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.SemanticTokens> {
		if (!/^\s*#schema flow/.test(document.getText())) {
			return undefined;
		}
		// [除錯日誌]
		LogManager.log('PlnSemanticTokensProvider.provideDocumentSemanticTokens: start for DocURI:', document ? document.uri.fsPath : 'undefined');

		// [參數驗證]
		LogManager.assert(!!document, 'PlnSemanticTokensProvider.provideDocumentSemanticTokens: document cannot be null/undefined');

		const builder = new vscode.SemanticTokensBuilder(this.legend);
		const text = document.getText();
		const lines = text.split(/\r?\n/);

		// 配對實體宣告頭部關鍵字的正則
		const headerRegex = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\b/i;

		lines.forEach((lineText, lineIndex) => {
			const m = lineText.match(headerRegex);
			if (m) {
				const kind = m[1].toLowerCase();
				const keywordIndex = lineText.indexOf(m[1]);
				if (keywordIndex !== -1) {
					builder.push(
						lineIndex,
						keywordIndex,
						m[1].length,
						this.tokenTypes.indexOf(kind),
						0
					);
				}
			}
		});

		const resultTokens = builder.build();

		// [流程驗證]
		LogManager.assert(!!resultTokens, 'PlnSemanticTokensProvider: SemanticTokensBuilder output is null/undefined');
		LogManager.log('PlnSemanticTokensProvider: successfully built semantic tokens.');

		return resultTokens;
	}
}
