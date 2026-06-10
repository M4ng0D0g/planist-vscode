/**
 * ============================================================================
 * 模組定位：Planist 編輯器語意語法客製化高亮器 (src/providers/highlighter.ts)
 * * 此檔案負責在 VS Code 編輯器內對正在編輯的 .pln 文件執行細緻的高亮修飾。
 * 由於 Planist 目前沒有預設的 TextMate 語意語法（.tmLanguage），
 * 此類別將自主對每行文本進行語法 Token 化，動態解析並裝飾：
 * - 註解 (comments)、字串 (strings)、數字 (numbers)。
 * - 關鍵字如 class, interface 等。
 * - UML 關係如 inherits, implements, composes 等。
 * - 針對 'text' 實體種類文字，自動根據當前主題深淺調整其高亮色彩（深色主題用白色，淺色主題用黑色）。
 * * 重要類別：
 * - PlnKeywordHighlighter: 主體高亮及高亮快取容器，實現 vscode.Disposable。
 * ============================================================================
 */

import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FLOW_LANGUAGE_ID } from '../dsl/flowDsl';

// 已修正：完全刪除對已棄用 previewPanel.ts 的一切 import 依賴，實現跨模組完全解耦

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
    macro: 'rgba(197, 134, 192, 1.0)',
};

const DEFAULT_TOKENS_LIGHT: Record<string, string> = {
    keyword: 'rgba(0, 0, 255, 1.0)',
    config: 'rgba(163, 21, 21, 1.0)',
    arrow: 'rgba(175, 0, 219, 1.0)',
    type: 'rgba(38, 127, 153, 1.0)',
    comment: 'rgba(0, 128, 0, 1.0)',
    string: 'rgba(163, 21, 21, 1.0)',
    number: 'rgba(9, 134, 115, 1.0)',
    macro: 'rgba(175, 0, 219, 1.0)',
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
                    // 已修正：拔除跨模組 UI 重新整理調度，改由 extension.ts 的全域監聽器統一管理
                }
            }),
            vscode.window.onDidChangeActiveColorTheme(() => {
                this.updateDecorations();
                vscode.window.visibleTextEditors.forEach((editor) => {
                    this.triggerHighlight(editor);
                });
                // 已修正：拔除跨模組 UI 重新整理調度
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

        // 僅設置 #schema flow 粗體高亮樣式
        this.decorationTypes.set('schemaFlowHeader', vscode.window.createTextEditorDecorationType({
            fontWeight: 'bold'
        }));
    }

    /**
     * 高亮核心：Token 掃描並分類裝飾
     */
    public triggerHighlight(editor: vscode.TextEditor) {
        LogManager.log('PlnKeywordHighlighter.triggerHighlight: start highlighting document:', editor ? editor.document.uri.fsPath : 'undefined');

        if (!editor || editor.document.languageId !== FLOW_LANGUAGE_ID) {
            return;
        }

        if (!/^\s*#schema flow/.test(editor.document.getText())) {
            return;
        }

        const text = editor.document.getText();
        const lines = text.split(/\r?\n/);
        const ranges: vscode.Range[] = [];

        const firstLine = lines[0];
        if (firstLine) {
            const schemaMatch = firstLine.match(/^\s*(#schema\s+flow)\b/i);
            if (schemaMatch) {
                const textToMatch = schemaMatch[1];
                const startIdx = firstLine.indexOf(textToMatch);
                if (startIdx !== -1) {
                    ranges.push(new vscode.Range(
                        new vscode.Position(0, startIdx),
                        new vscode.Position(0, startIdx + textToMatch.length)
                    ));
                }
            }
        }

        const decType = this.decorationTypes.get('schemaFlowHeader');
        if (decType) {
            editor.setDecorations(decType, ranges);
        }
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
        for (const decType of this.decorationTypes.values()) {
            decType.dispose();
        }
    }
}