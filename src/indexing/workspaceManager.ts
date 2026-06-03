/**
 * ============================================================================
 * 模組定位：Planist 工作空間與檔案系統管理器 (src/indexing/workspaceManager.ts)
 * 
 * 此檔案負責管理工作空間目錄結構的初始化、主配置設定檔（config.json）的預置生成、
 * 語法範本（template）生成，以及將 Webview 回傳的視覺屬性複寫（Override）資料
 * 寫入對應的 .pln 文件末端。
 * 
 * 重要類別與函數：
 * - WorkspaceManager: 提供 updateEntityVisualOverride 以保存圖示樣式微調。
 * - createModuleStructure: 建立目錄樹結構的核心函數。
 * - buildFlowTemplate: 產生各類型實體結構之預設 DSL 代碼。
 * 
 * 擴充與修改指引：
 * 1. 若要更改初始化專案時的預設 config.json 內容（如網格預設顏色、新實體種類顏色），
 *    請尋找並修改 `ensureConfigFile()` 內 JSON 寫入的物件結構。
 * 2. 若要擴充新實體建立時的範本代碼，請直接修改 `buildFlowTemplate()` 的回傳字串。
 * ============================================================================
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { LogManager } from '../config/logger';

export const PLANIST_ROOT_FOLDER = '.planist';
export const PLANIST_SYSTEM_FOLDER = '.system';
export const PLANIST_SUBFLOWS_FOLDER = '.subflows';
export const PLAN_FILE_EXTENSION = '.pln';

export class WorkspaceManager {
	/**
	 * 當 Webview 觸發右鍵 Override 時，更新指定 .pln 檔案最底部的視覺參數
	 * 會在文件最尾端追加或修改 `[Visual-Override]` 標籤區塊
	 */
	public static async updateEntityVisualOverride(
		fileUri: vscode.Uri, 
		overrides: { color?: string; borderColor?: string; borderRadius?: number; opacity?: number }
	): Promise<void> {
		// [除錯日誌] 紀錄輸入參數
		LogManager.log('WorkspaceManager.updateEntityVisualOverride: start. FileUri:', fileUri.fsPath, 'Overrides:', overrides);

		// [參數驗證]
		LogManager.assert(fileUri instanceof vscode.Uri, 'WorkspaceManager.updateEntityVisualOverride: fileUri must be vscode.Uri');
		LogManager.assert(!!overrides && typeof overrides === 'object', 'WorkspaceManager.updateEntityVisualOverride: overrides must be a valid object');

		// 1. 讀取目前檔案的全部文本
		const document = await vscode.workspace.openTextDocument(fileUri);
		const fullText = document.getText();
		
		// 2. 利用切分點分離原文本與舊的 Override 區塊
		const overrideMarker = '[Visual-Override]';
		const markerIndex = fullText.indexOf(overrideMarker);
		
		let baseContent = markerIndex !== -1 ? fullText.substring(0, markerIndex).trim() : fullText.trim();
		
		// 3. 重新構建精準的 Override 文本資料
		let overrideText = `\n\n${overrideMarker}\n`;
		if (overrides.color) { overrideText += `color: ${overrides.color}\n`; }
		if (overrides.borderColor) { overrideText += `borderColor: ${overrides.borderColor}\n`; }
		if (overrides.borderRadius !== undefined) { overrideText += `borderRadius: ${overrides.borderRadius}\n`; }
		if (overrides.opacity !== undefined) { overrideText += `opacity: ${overrides.opacity}\n`; }

		// 4. 合併並非同步寫入檔案系統
		const combinedData = Buffer.from(baseContent + overrideText, 'utf8');
		await vscode.workspace.fs.writeFile(fileUri, combinedData);

		// [除錯日誌] 記錄更新成功
		LogManager.log('WorkspaceManager.updateEntityVisualOverride: successfully updated visual overrides for:', fileUri.fsPath);
	}
}

/**
 * 初始化專案的 .planist 資料夾並建立預設設定
 */
export async function initializePlanistWorkspace(workspaceRoot: vscode.Uri): Promise<void> {
	LogManager.log('WorkspaceManager.initializePlanistWorkspace: checking and creating .planist folder at', workspaceRoot.fsPath);

	const planistRootUri = vscode.Uri.file(path.join(workspaceRoot.fsPath, PLANIST_ROOT_FOLDER));
	const systemDirUri = vscode.Uri.file(path.join(planistRootUri.fsPath, PLANIST_SYSTEM_FOLDER));

	try {
		await vscode.workspace.fs.createDirectory(planistRootUri);
		await vscode.workspace.fs.createDirectory(systemDirUri);
		await ensureConfigFile(systemDirUri);
		LogManager.log('WorkspaceManager.initializePlanistWorkspace: successfully ensured .planist config folder.');
	} catch (error) {
		LogManager.error('WorkspaceManager.initializePlanistWorkspace: error creating config folder:', error);
	}
}

/**
 * 確保預設的 config.json 檔案存在，如不存在則自動生成
 */
async function ensureConfigFile(systemDirUri: vscode.Uri): Promise<void> {
	const configUri = vscode.Uri.file(path.join(systemDirUri.fsPath, 'config.json'));
	try {
		await vscode.workspace.fs.stat(configUri);
	} catch {
		await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify({
			version: 1,
			appearance: {
				backgroundColor: 'rgb(26, 26, 26)',
				backgroundPattern: 'none',
				dots: {
					size: 2,
					spacing: 24,
					color: 'rgba(255, 255, 255, 0.12)',
				},
				grid: {
					majorLineWidth: 1,
					minorLineWidth: 1,
					majorSpacing: 120,
					minorSpacing: 24,
					majorColor: 'rgba(255, 255, 255, 0.18)',
					minorColor: 'rgba(255, 255, 255, 0.08)',
				},
				entity: {
					cornerRadius: 14,
					borderColor: '#005a9e',
					typeColors: {
						class: '#007acc',
						abstract: '#4f46e5',
						interface: '#16a34a',
						record: '#d97706',
						enum: '#db2777',
						text: '#6b7280',
					},
					typeBorderColors: {
						class: '#005a9e',
						abstract: '#3730a3',
						interface: '#15803d',
						record: '#b45309',
						enum: '#be185d',
						text: '#4b5563',
					},
				},
			},
		}, null, 2), 'utf8'));
	}
}
