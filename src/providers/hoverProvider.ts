/**
 * ============================================================================
 * 模組定位：Planist 懸浮提示 (Hover) 提供者 (src/providers/hoverProvider.ts)
 * 
 * 此檔案負責實現 VS Code 的 `HoverProvider` 介面。當用戶將滑鼠停留在 DSL 編輯器的
 * 實體參考（如 `-> MyService`）或方法存取參考上時，動態查詢索引，在編輯器內彈出一個
 * 漂亮的 Markdown 懸浮窗，顯示實體類型、對應來源檔案路徑、目標方法簽名以及程式碼內容預覽。
 * 
 * 重要類別與函數：
 * - FlowHoverProvider: 對接 VS Code Hover 懸浮視窗的引擎提供者。
 * 
 * 擴充與修改指引：
 * 1. 若要在 Hover 提示內增加額外的特徵資訊（例如顯示綁定原始碼 `bind` 路徑），
 *    可在 `provideHover()` 內的 MarkdownString 中使用 `appendMarkdown()` 新增。
 * 2. 程式碼片段語法高亮類型，可透過調整 `MarkdownString` 內 ``` 標籤的語言標示來定義。
 * ============================================================================
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FlowIndexer } from '../indexing/flowIndexer';
import { findReferenceAtPosition } from '../dsl/flowDsl';

export class FlowHoverProvider implements vscode.HoverProvider {
	constructor(private indexer: FlowIndexer) {}

	public async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Hover | undefined> {
		if (!/^\s*#schema flow/.test(document.getText())) {
			return undefined;
		}
		// [除錯日誌] 紀錄輸入參數
		LogManager.log('FlowHoverProvider.provideHover: start. DocUri:', document.uri.fsPath, 'Position:', position);

		// [參數驗證]
		LogManager.assert(!!document, 'FlowHoverProvider.provideHover: document parameter cannot be null');
		LogManager.assert(!!position, 'FlowHoverProvider.provideHover: position parameter cannot be null');

		const reference = findReferenceAtPosition(document.getText(), position.line, position.character);
		if (!reference) {
			LogManager.log('FlowHoverProvider: no reference found at current cursor position.');
			return undefined;
		}

		LogManager.log('FlowHoverProvider: resolving hover for targetName:', reference.targetName);

		const entity = this.indexer.getEntity(reference.targetName);
		if (!entity) {
			LogManager.log('FlowHoverProvider: entity not found in indexer database.');
			return undefined;
		}

		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		const kindStr = entity.kind ? `*(${entity.kind})* ` : '';
		md.appendMarkdown(`### ${kindStr}**${entity.entityName}**\n\n`);
		md.appendMarkdown(`**檔案：** [${path.basename(entity.uri.fsPath)}](${entity.uri.toString()})\n\n`);

		// 如果參考包含特定方法存取（如 -> Entity.method），解析方法簽名與警告提示
		if (reference.targetMethodName) {
			const method = entity.methods.find((m) => m.name.toLowerCase() === reference.targetMethodName?.toLowerCase());
			if (method) {
				md.appendMarkdown(`**方法簽名：**\n\`\`\`flowlang\n+ ${method.name}(${method.parameters ? method.parameters.join(', ') : ''})\n\`\`\`\n\n`);
			} else {
				md.appendMarkdown(`*⚠️ 警告：方法 **${reference.targetMethodName}** 未在實體 ${entity.entityName} 中定義*\n\n`);
			}
		}

		md.appendMarkdown(`---\n\n`);

		const previewText = this.getPreview(entity.rawText);
		md.appendMarkdown(`**程式碼內容預覽：**\n\`\`\`flowlang\n${previewText}\n\`\`\`\n\n`);

		if (entity.methods.length > 0) {
			md.appendMarkdown(`---\n\n**聲明的方法列表：**\n`);
			for (const method of entity.methods) {
				md.appendMarkdown(`- \`+ ${method.name}(${method.parameters ? method.parameters.join(', ') : ''})\`\n`);
			}
		}

		const hoverResult = new vscode.Hover(md);

		// [流程驗證] 驗證回傳的 hover 物件是否合法
		LogManager.assert(!!hoverResult.contents && hoverResult.contents.length > 0, 'FlowHoverProvider: invalid hover contents');
		LogManager.log('FlowHoverProvider: hover resolution completed successfully.');

		return hoverResult;
	}

	private getPreview(text: string): string {
		const lines = text.split(/\r?\n/);
		const filteredLines = lines
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && l !== '{' && l !== '}')
			.slice(0, 8);
		return filteredLines.join('\n');
	}
}
