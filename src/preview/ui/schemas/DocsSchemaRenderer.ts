import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { DocsSchemaJS } from './DocsSchemaJS';

export const DocsSchemaCSS = `
    :root {
        --sidebar-bg: #1e1e24;
        --sidebar-border: rgba(255, 255, 255, 0.08);
        --page-bg: #141416;
        --app-bg: #0c0c0e;
        --text-color: #f3f4f6;
        --active-color: #3b82f6;
        --paper-bg: #ffffff;
        --paper-text: #1f2937;
        --paper-border: #e5e7eb;
    }

    body.vscode-light {
        --sidebar-bg: #f3f4f6;
        --sidebar-border: rgba(0, 0, 0, 0.08);
        --page-bg: #e5e7eb;
        --app-bg: #f9fafb;
        --text-color: #1f2937;
        --paper-bg: #ffffff;
        --paper-text: #1f2937;
        --paper-border: #e5e7eb;
    }

    body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: var(--app-bg);
        color: var(--text-color);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    #app-container {
        display: flex;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    }

    #sidebar {
        width: 260px;
        background-color: var(--sidebar-bg);
        border-right: 1px solid var(--sidebar-border);
        display: flex;
        flex-direction: column;
        height: 100%;
        user-select: none;
    }

    #doc-title-container {
        padding: 16px;
        border-bottom: 1px solid var(--sidebar-border);
    }

    #doc-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .sidebar-tabs {
        display: flex;
        border-bottom: 1px solid var(--sidebar-border);
    }

    .sidebar-tab {
        flex: 1;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
        border-bottom: 2px solid transparent;
        color: var(--text-color);
        opacity: 0.7;
    }

    .sidebar-tab.active {
        border-bottom-color: var(--active-color);
        color: var(--active-color);
        font-weight: 600;
        opacity: 1;
    }

    #sidebar-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
    }

    .sidebar-item {
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background-color 0.2s;
        color: var(--text-color);
    }

    .sidebar-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    body.vscode-light .sidebar-item:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }

    .sidebar-item.active {
        background-color: rgba(59, 130, 246, 0.15);
        color: var(--active-color);
        font-weight: 600;
    }

    #sidebar-actions {
        padding: 12px;
        border-top: 1px solid var(--sidebar-border);
    }

    #add-page-btn {
        width: 100%;
        padding: 10px;
        background-color: var(--active-color);
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    #add-page-btn:hover {
        opacity: 0.9;
    }

    #content-viewport {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background-color: var(--page-bg);
    }

    #document-scroll-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .paper-page {
        width: 794px;
        min-height: 1123px;
        background-color: var(--paper-bg);
        color: var(--paper-text);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        margin: 20px 0;
        padding: 60px 80px;
        box-sizing: border-box;
        border-radius: 4px;
        position: relative;
        text-align: left;
    }

    .page-header-hud {
        position: absolute;
        top: 15px;
        right: 20px;
        display: flex;
        gap: 8px;
        opacity: 0.1;
        transition: opacity 0.2s;
    }

    .paper-page:hover .page-header-hud {
        opacity: 1;
    }

    .hud-icon-btn {
        background: rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.08);
        cursor: pointer;
        font-size: 12px;
        color: #555;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s, color 0.2s;
    }

    .hud-icon-btn:hover {
        background-color: rgba(0, 0, 0, 0.1);
        color: var(--active-color);
    }

    .hud-icon-btn.delete:hover {
        color: #ef4444;
    }

    .page-number-hud {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        color: #999;
        user-select: none;
    }

    /* Markdown styling inside paper */
    .markdown-body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        word-wrap: break-word;
    }

    .markdown-body h1 {
        font-size: 24px;
        border-bottom: 1px solid var(--paper-border);
        padding-bottom: 8px;
        margin-top: 0;
        color: #111;
    }

    .markdown-body h2 {
        font-size: 18px;
        margin-top: 24px;
        border-bottom: 1px solid var(--paper-border);
        padding-bottom: 6px;
        color: #222;
    }

    .markdown-body h3 {
        font-size: 16px;
        margin-top: 20px;
        color: #333;
    }

    .markdown-body p {
        margin-top: 0;
        margin-bottom: 16px;
    }

    .markdown-body blockquote {
        padding: 0 1em;
        color: #6a737d;
        border-left: 0.25em solid #dfe2e5;
        margin: 0 0 16px 0;
    }

    .markdown-body ul {
        padding-left: 2em;
        margin-top: 0;
        margin-bottom: 16px;
    }

    .markdown-body code {
        padding: 0.2em 0.4em;
        margin: 0;
        font-size: 85%;
        background-color: rgba(27,31,35,0.05);
        border-radius: 3px;
        font-family: monospace;
    }

    /* Editor styling */
    .editor-title-input {
        width: 100%;
        border: 1px solid var(--paper-border);
        outline: none;
        padding: 8px 12px;
        border-radius: 4px;
        box-sizing: border-box;
    }

    .editor-textarea {
        width: 100%;
        flex: 1;
        min-height: 800px;
        border: 1px solid var(--paper-border);
        outline: none;
        padding: 12px;
        border-radius: 4px;
        box-sizing: border-box;
        font-family: monospace;
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
    }

    .editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 15px;
    }

    .editor-btn {
        padding: 8px 16px;
        border: 1px solid #ccc;
        background: #fff;
        color: #333;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        font-size: 13px;
    }

    .editor-btn.save {
        background-color: var(--active-color);
        color: #fff;
        border-color: transparent;
    }

    .editor-btn:hover {
        opacity: 0.9;
    }
`;

// @state: yellow
export class DocsSchemaRenderer implements ISchemaRenderer {
    // @state: yellow
    public renderPage(webview: vscode.Webview, nonce: string) {
        return {
            // @state: yellow
            render: (): string => {
                const htmlParts: string[] = [];

                htmlParts.push('<!DOCTYPE html>');
                htmlParts.push('<html lang="zh-TW">');
                htmlParts.push('<head>');
                htmlParts.push('    <meta charset="UTF-8">');
                htmlParts.push(`    <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">`);
                htmlParts.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
                htmlParts.push('    <title>Planist Document Editor</title>');
                htmlParts.push('    <style>');
                htmlParts.push(DocsSchemaCSS);
                htmlParts.push('    </style>');
                htmlParts.push('</head>');
                htmlParts.push('<body>');

                htmlParts.push('    <div id="app-container">');
                
                // Sidebar
                htmlParts.push('        <div id="sidebar">');
                htmlParts.push('            <div id="doc-title-container">');
                htmlParts.push('                <h2 id="doc-title">Document</h2>');
                htmlParts.push('            </div>');
                htmlParts.push('            <div class="sidebar-tabs">');
                htmlParts.push('                <div class="sidebar-tab active" id="tab-dir">頁面目錄</div>');
                htmlParts.push('                <div class="sidebar-tab" id="tab-outline">文件大綱</div>');
                htmlParts.push('            </div>');
                htmlParts.push('            <div id="sidebar-list"></div>');
                htmlParts.push('            <div id="sidebar-actions">');
                htmlParts.push('                <button id="add-page-btn">+ 新增頁面</button>');
                htmlParts.push('            </div>');
                htmlParts.push('        </div>');

                // Main area
                htmlParts.push('        <div id="content-viewport">');
                htmlParts.push('            <div id="document-scroll-container">');
                // Pages will be injected dynamically
                htmlParts.push('            </div>');
                htmlParts.push('        </div>');

                htmlParts.push('    </div>');

                // Inline Script
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
