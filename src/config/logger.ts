/**
 * ============================================================================
 * 模組定位：Planist 全域除錯日誌管理器 (src/config/logger.ts)
 * 
 * 此檔案負責提供統一的日誌紀錄 (log)、錯誤回報 (error) 及條件斷言 (assert) 功能。
 * 當 VS Code 設定中的 `planist.debug.enable` 開啟時，會自動記錄詳細的程式碼執行流程
 * 到 VS Code 的 "Planist Debug" 輸出通道 (Output Channel) 中。在發生斷言失敗時會主動
 * 噴出錯誤並提示用戶，方便即時排查問題。
 * 
 * 核心類別：
 * - LogManager: 提供除錯狀態下各等級的日誌輸出與條件檢測。
 * 
 * 擴充與修改指引：
 * 1. 若要新增自定義的日誌分類，可在 LogManager 中添加如 `public static warn()` 方法。
 * 2. 為了在生產環境保持極高效率，請確保所有 logger 呼叫均以 `LogManager.isDebugMode()` 為先決條件。
 * ============================================================================
 */

import * as vscode from 'vscode';

export class LogManager {
	private static outputChannel: vscode.OutputChannel | undefined;

	/**
	 * 檢查目前是否啟用了除錯模式 (從 settings.json 取得)
	 */
	public static isDebugMode(): boolean {
		try {
			return vscode.workspace.getConfiguration('planist').get<boolean>('debug.enable', false);
		} catch {
			return false;
		}
	}

	/**
	 * 獲取或建立 VS Code 的 Output Channel
	 */
	private static getOutputChannel(): vscode.OutputChannel {
		if (!this.outputChannel) {
			this.outputChannel = vscode.window.createOutputChannel('Planist Debug');
		}
		return this.outputChannel;
	}

	/**
	 * 輸出一般執行步驟與詳細內容日誌
	 */
	public static log(message: string, ...args: any[]): void {
		if (this.isDebugMode()) {
			const formattedArgs = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
			const fullMessage = `[INFO] [${new Date().toISOString()}] ${message} ${formattedArgs}`.trim();
			console.log(`[Planist-Debug] ${message}`, ...args);
			this.getOutputChannel().appendLine(fullMessage);
		}
	}

	/**
	 * 輸出錯誤訊息，並在除錯模式開啟時主動顯示彈窗提醒
	 */
	public static error(message: string, ...args: any[]): void {
		const formattedArgs = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
		const fullMessage = `[ERROR] [${new Date().toISOString()}] ${message} ${formattedArgs}`.trim();
		console.error(`[Planist-Error] ${message}`, ...args);
		this.getOutputChannel().appendLine(fullMessage);
		
		if (this.isDebugMode()) {
			void vscode.window.showErrorMessage(`[Planist Error] ${message}`);
		}
	}

	/**
	 * 流程/參數斷言驗證。若條件不成立，立即記錄並拋出錯誤
	 */
	public static assert(condition: boolean, message: string): void {
		if (!condition) {
			this.error(`Assertion Failed: ${message}`);
			throw new Error(`[Planist-AssertionError] ${message}`);
		}
	}
}
