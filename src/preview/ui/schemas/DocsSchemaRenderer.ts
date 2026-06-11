import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { DocsSchemaJS } from './DocsSchemaJS';

export const DocsSchemaCSS = `
    :root {
        --sidebar-bg: #191b20;
        --sidebar-border: rgba(255, 255, 255, 0.1);
        --workspace-bg: #24272e;
        --text-color: #f4f4f5;
        --muted-color: #a1a1aa;
        --active-color: #2563eb;
        --paper-bg: #ffffff;
        --paper-text: #202124;
        --paper-border: #e5e7eb;
        --danger-color: #dc2626;

        /* Typography & Layout defaults */
        --paper-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        --paper-font-size: 14px;
        --paper-line-height: 1.65;
        --paper-width: 794px;

        /* Theme-specific overrides for pages */
        --theme-paper-bg: var(--paper-bg);
        --theme-paper-text: var(--paper-text);
        --theme-paper-border: var(--paper-border);
    }

    body.vscode-light {
        --sidebar-bg: #f4f4f5;
        --sidebar-border: rgba(0, 0, 0, 0.12);
        --workspace-bg: #dfe3e8;
        --text-color: #18181b;
        --muted-color: #71717a;
        --paper-bg: #ffffff;
        --paper-text: #202124;
        --paper-border: #d4d4d8;
    }

    body,
    html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--workspace-bg);
        color: var(--text-color);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    }

    button,
    input,
    textarea {
        font: inherit;
    }

    #app-container {
        display: flex;
        width: 100vw;
        height: calc(100vh - 48px);
        overflow: hidden;
        transition: all 0.25s ease;
    }

    #sidebar {
        width: 268px;
        min-width: 220px;
        background: var(--sidebar-bg);
        border-right: 1px solid var(--sidebar-border);
        display: flex;
        flex-direction: column;
        height: 100%;
        user-select: none;
        transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, border 0.25s ease;
        opacity: 1;
    }

    #sidebar.collapsed {
        width: 0 !important;
        min-width: 0 !important;
        opacity: 0;
        pointer-events: none;
        border-right: none;
    }

    #doc-title-container {
        padding: 16px;
        border-bottom: 1px solid var(--sidebar-border);
    }

    #doc-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.35;
        overflow-wrap: anywhere;
    }

    .sidebar-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-bottom: 1px solid var(--sidebar-border);
    }

    .sidebar-tab {
        padding: 11px 8px;
        text-align: center;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--muted-color);
        background: transparent;
    }

    .sidebar-tab.active {
        border-bottom-color: var(--active-color);
        color: var(--active-color);
    }

    #sidebar-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
    }

    .sidebar-empty {
        color: var(--muted-color);
        font-size: 13px;
        padding: 12px;
    }

    .sidebar-item {
        width: 100%;
        min-height: 38px;
        padding: 8px 9px;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        margin-bottom: 4px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 8px;
        align-items: center;
        color: var(--text-color);
        background: transparent;
        text-align: left;
    }

    .sidebar-item:hover {
        background: rgba(127, 127, 127, 0.14);
    }

    .sidebar-item.active {
        background: rgba(37, 99, 235, 0.18);
        color: var(--active-color);
    }

    .sidebar-page-number {
        color: var(--muted-color);
        font-size: 12px;
        min-width: 20px;
    }

    .sidebar-item-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .outline-toggle {
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--muted-color);
        cursor: pointer;
        width: 26px;
        height: 24px;
    }

    .outline-toggle.active {
        color: #ca8a04;
    }

    #sidebar-actions {
        padding: 12px;
        border-top: 1px solid var(--sidebar-border);
    }

    #add-page-btn {
        width: 100%;
        min-height: 36px;
        padding: 8px 10px;
        background: var(--active-color);
        color: #fff;
        border: 0;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
    }

    #content-viewport {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        background: var(--workspace-bg);
    }

    #document-scroll-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 22px;
        padding-bottom: 30px;
    }

    .paper-page {
        width: var(--paper-width);
        max-width: 95%;
        min-height: calc(var(--paper-width) * 1.414);
        background: var(--theme-paper-bg);
        color: var(--theme-paper-text);
        border: 1px solid var(--theme-paper-border);
        box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
        padding: 72px 76px;
        box-sizing: border-box;
        border-radius: 4px;
        position: relative;
        text-align: left;
        font-family: var(--paper-font-family);
        font-size: var(--paper-font-size);
        line-height: var(--paper-line-height);
        transition: width 0.25s ease, min-height 0.25s ease, background 0.2s ease, color 0.2s ease;
    }

    .page-header-hud {
        position: absolute;
        top: 16px;
        right: 18px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .paper-page:hover .page-header-hud,
    .paper-page:focus-within .page-header-hud {
        opacity: 1;
    }

    .hud-icon-btn {
        min-width: 32px;
        min-height: 28px;
        background: #f3f4f6;
        border: 1px solid #d4d4d8;
        cursor: pointer;
        color: #3f3f46;
        padding: 4px 8px;
        border-radius: 5px;
        font-size: 12px;
    }

    .hud-icon-btn:hover {
        color: var(--active-color);
        border-color: var(--active-color);
    }

    .hud-icon-btn.delete:hover {
        color: var(--danger-color);
        border-color: var(--danger-color);
    }

    .page-number-hud {
        position: absolute;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        color: #71717a;
        user-select: none;
    }

    .markdown-body {
        font-size: 14px;
        line-height: 1.65;
        word-wrap: break-word;
    }

    .markdown-body h1 {
        font-size: 25px;
        line-height: 1.25;
        border-bottom: 1px solid var(--paper-border);
        padding-bottom: 8px;
        margin: 0 0 18px;
        color: #111827;
    }

    .markdown-body h2 {
        font-size: 20px;
        line-height: 1.3;
        margin: 26px 0 12px;
        color: #1f2937;
    }

    .markdown-body h3 {
        font-size: 16px;
        margin: 22px 0 10px;
        color: #374151;
    }

    .markdown-body p {
        margin: 0 0 14px;
    }

    .markdown-body blockquote {
        padding: 0 0 0 14px;
        color: #52525b;
        border-left: 4px solid #d4d4d8;
        margin: 0 0 16px;
    }

    .markdown-body ul,
    .markdown-body ol {
        padding-left: 26px;
        margin: 0 0 16px;
    }

    .markdown-body code {
        padding: 2px 5px;
        background: #f3f4f6;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.9em;
    }

    .editor-title-input {
        width: 100%;
        border: 1px solid var(--paper-border);
        outline: none;
        padding: 8px 10px;
        border-radius: 5px;
        box-sizing: border-box;
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 14px;
    }

    .editor-textarea {
        width: 100%;
        min-height: 760px;
        border: 1px solid var(--paper-border);
        outline: none;
        padding: 12px;
        border-radius: 5px;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 13px;
        line-height: 1.55;
        resize: vertical;
    }

    .editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
    }

    .editor-btn {
        min-height: 34px;
        padding: 7px 14px;
        border: 1px solid #d4d4d8;
        background: #fff;
        color: #27272a;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
    }

    .editor-btn.save {
        background: var(--active-color);
        color: #fff;
        border-color: var(--active-color);
    }

    @media (max-width: 760px) {
        #sidebar {
            width: 190px;
            min-width: 190px;
        }

        #content-viewport {
            padding: 14px;
        }
    }

    /* Horizontal Toolbar Styling */
    #toolbar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 48px;
        background: var(--sidebar-bg);
        border-bottom: 1px solid var(--sidebar-border);
        padding: 0 16px;
        box-sizing: border-box;
        z-index: 100;
        user-select: none;
    }

    .toolbar-left, .toolbar-middle, .toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .toolbar-btn, .size-btn, .toolbar-select {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--sidebar-border);
        color: var(--text-color);
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        outline: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
    }

    body.vscode-light .toolbar-btn, 
    body.vscode-light .size-btn, 
    body.vscode-light .toolbar-select {
        background: #ffffff;
        border-color: rgba(0, 0, 0, 0.12);
        color: #1f2937;
    }

    .toolbar-btn:hover, .size-btn:hover, .toolbar-select:hover {
        background: var(--active-color);
        color: #fff;
        border-color: var(--active-color);
    }

    /* Mode Toggle Group */
    .mode-toggle-group {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        padding: 2px;
        border: 1px solid var(--sidebar-border);
    }

    body.vscode-light .mode-toggle-group {
        background: rgba(0, 0, 0, 0.05);
    }

    .mode-toggle-group button {
        background: transparent;
        border: 0;
        color: var(--muted-color);
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.15s ease;
    }

    .mode-toggle-group button.active {
        background: var(--active-color);
        color: #fff;
    }

    /* Font Size group */
    .font-size-group {
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        border: 1px solid var(--sidebar-border);
        padding: 2px;
    }

    body.vscode-light .font-size-group {
        background: #ffffff;
        border-color: rgba(0, 0, 0, 0.12);
    }

    .font-size-group .size-btn {
        background: transparent;
        border: 0;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }

    #font-size-display {
        font-size: 11px;
        min-width: 32px;
        text-align: center;
        color: var(--text-color);
    }

    body.vscode-light #font-size-display {
        color: #1f2937;
    }

    /* Raw Editor view */
    #raw-editor-container {
        width: 100vw;
        height: calc(100vh - 48px);
        background: var(--workspace-bg);
        box-sizing: border-box;
        padding: 16px;
    }

    #raw-editor-textarea {
        width: 100%;
        height: 100%;
        background: var(--sidebar-bg);
        color: var(--text-color);
        border: 1px solid var(--sidebar-border);
        border-radius: 8px;
        padding: 16px;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        outline: none;
    }

    body.vscode-light #raw-editor-textarea {
        background: #ffffff;
        color: #1f2937;
        border-color: rgba(0, 0, 0, 0.12);
    }
`;

// @state: red
export class DocsSchemaRenderer implements ISchemaRenderer {
    // @state: red
    public renderPage(webview: vscode.Webview, nonce: string) {
        return {
            // @state: red
            render: (): string => {
                const htmlParts: string[] = [];

                htmlParts.push('<!DOCTYPE html>');
                htmlParts.push('<html lang="zh-TW">');
                htmlParts.push('<head>');
                htmlParts.push('    <meta charset="UTF-8">');
                htmlParts.push(`    <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">`);
                htmlParts.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
                htmlParts.push('    <title>Planist Docs</title>');
                htmlParts.push('    <style>');
                htmlParts.push(DocsSchemaCSS);
                htmlParts.push('    </style>');
                htmlParts.push('</head>');
                htmlParts.push('<body>');
                
                // 橫向工作列
                htmlParts.push('    <div id="toolbar-header">');
                htmlParts.push('        <div class="toolbar-left">');
                htmlParts.push('            <button id="toggle-sidebar-btn" class="toolbar-btn" type="button" title="收起側邊欄">');
                htmlParts.push('                <span class="btn-icon">📁</span> <span class="btn-text">側邊欄</span>');
                htmlParts.push('            </button>');
                htmlParts.push('            <div class="mode-toggle-group" role="tablist">');
                htmlParts.push('                <button id="mode-render-btn" class="active" type="button" role="tab" aria-selected="true">渲染模式</button>');
                htmlParts.push('                <button id="mode-source-btn" type="button" role="tab" aria-selected="false">原始檔模式</button>');
                htmlParts.push('            </div>');
                htmlParts.push('            <button id="readonly-btn" class="toolbar-btn" type="button" title="切換唯讀模式">');
                htmlParts.push('                <span class="btn-icon">🔓</span> <span class="btn-text">編輯中</span>');
                htmlParts.push('            </button>');
                htmlParts.push('        </div>');
                htmlParts.push('        <div class="toolbar-middle">');
                htmlParts.push('            <select id="font-family-select" class="toolbar-select" title="字型樣式">');
                htmlParts.push('                <option value="sans-serif">預設無襯線體</option>');
                htmlParts.push('                <option value="serif">經典襯線體</option>');
                htmlParts.push('                <option value="monospace">等寬程式碼體</option>');
                htmlParts.push('                <option value="system-ui">系統預設 UI</option>');
                htmlParts.push('            </select>');
                htmlParts.push('            <div class="font-size-group">');
                htmlParts.push('                <button id="font-dec-btn" class="size-btn" type="button" title="縮小字型">-</button>');
                htmlParts.push('                <span id="font-size-display">14px</span>');
                htmlParts.push('                <button id="font-inc-btn" class="size-btn" type="button" title="放大字型">+</button>');
                htmlParts.push('            </div>');
                htmlParts.push('            <select id="line-height-select" class="toolbar-select" title="行高設定">');
                htmlParts.push('                <option value="1.4">1.4 (緊湊)</option>');
                htmlParts.push('                <option value="1.55">1.55 (標準)</option>');
                htmlParts.push('                <option value="1.65" selected>1.65 (舒適)</option>');
                htmlParts.push('                <option value="1.8">1.8 (寬敞)</option>');
                htmlParts.push('            </select>');
                htmlParts.push('        </div>');
                htmlParts.push('        <div class="toolbar-right">');
                htmlParts.push('            <button id="full-width-btn" class="toolbar-btn" type="button" title="切換寬度">A4 比例</button>');
                htmlParts.push('            <button id="theme-override-btn" class="toolbar-btn" type="button" title="切換主題模式">主題：跟隨系統</button>');
                htmlParts.push('        </div>');
                htmlParts.push('    </div>');

                // 原始檔編輯區域 (預設隱藏)
                htmlParts.push('    <div id="raw-editor-container" style="display: none;">');
                htmlParts.push('        <textarea id="raw-editor-textarea" spellcheck="false" placeholder="在此編輯原始 Planist DSL..."></textarea>');
                htmlParts.push('    </div>');

                // 渲染與側邊欄區域
                htmlParts.push('    <div id="app-container">');
                htmlParts.push('        <div id="sidebar">');
                htmlParts.push('            <div id="doc-title-container">');
                htmlParts.push('                <h2 id="doc-title">Document</h2>');
                htmlParts.push('            </div>');
                htmlParts.push('            <div class="sidebar-tabs" role="tablist">');
                htmlParts.push('                <button class="sidebar-tab active" id="tab-dir" type="button" role="tab">Pages</button>');
                htmlParts.push('                <button class="sidebar-tab" id="tab-outline" type="button" role="tab">Outline</button>');
                htmlParts.push('            </div>');
                htmlParts.push('            <div id="sidebar-list"></div>');
                htmlParts.push('            <div id="sidebar-actions">');
                htmlParts.push('                <button id="add-page-btn" type="button">Add Page</button>');
                htmlParts.push('            </div>');
                htmlParts.push('        </div>');
                htmlParts.push('        <main id="content-viewport">');
                htmlParts.push('            <div id="document-scroll-container"></div>');
                htmlParts.push('        </main>');
                htmlParts.push('    </div>');
                
                htmlParts.push(`    <script nonce="${nonce}">`);
                htmlParts.push(DocsSchemaJS);
                htmlParts.push('    </script>');
                htmlParts.push('</body>');
                htmlParts.push('</html>');

                return htmlParts.join('\n');
            }
        };
    }
}
