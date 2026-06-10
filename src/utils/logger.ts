// @status GREEN
import * as process from 'process';

export type TrafficLightStatus = 'GREEN' | 'YELLOW' | 'RED';

export class Logger {
    private static isDebugMode: boolean | null = null;

    private static checkDebugEnabled(): boolean {
        if (Logger.isDebugMode !== null) {
            return Logger.isDebugMode;
        }

        try {
            // 嘗試載入 VS Code API，在單元測試環境中 (如 Vitest) 會拋出異常並進入 catch 分端
            const vscode = require('vscode');
            if (vscode && vscode.workspace) {
                const config = vscode.workspace.getConfiguration('planist.debug');
                Logger.isDebugMode = config.get('enable', false);
                return Logger.isDebugMode!;
            }
        } catch {
            // 在測試環境下，預設啟用偵錯日誌輸出
            Logger.isDebugMode = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
            return Logger.isDebugMode;
        }

        Logger.isDebugMode = false;
        return false;
    }

    constructor(private moduleName: string, private status: TrafficLightStatus) {}

    private getPrefix(): string {
        const emojiMap: Record<TrafficLightStatus, string> = {
            GREEN: '🟢',
            YELLOW: '🟡',
            RED: '🔴'
        };
        return `${emojiMap[this.status]} [${this.moduleName}]`;
    }

    public info(msg: string, ...args: any[]): void {
        if (Logger.checkDebugEnabled()) {
            console.log(`${this.getPrefix()} [INFO] ${msg}`, ...args);
        }
    }

    public warn(msg: string, ...args: any[]): void {
        if (Logger.checkDebugEnabled()) {
            console.warn(`${this.getPrefix()} [WARN] ${msg}`, ...args);
        }
    }

    public error(msg: string, ...args: any[]): void {
        // Error 級別日誌即使在非偵錯模式下也強制輸出，以利排查問題
        console.error(`${this.getPrefix()} [ERROR] ${msg}`, ...args);
    }
}
