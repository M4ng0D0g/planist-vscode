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
        height: 100vh;
        overflow: hidden;
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
        width: min(794px, calc(100vw - 340px));
        min-height: min(1123px, calc((100vw - 340px) * 1.414));
        background: var(--paper-bg);
        color: var(--paper-text);
        box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
        padding: 72px 76px;
        box-sizing: border-box;
        border-radius: 4px;
        position: relative;
        text-align: left;
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

        .paper-page {
            width: calc(100vw - 232px);
            min-height: calc((100vw - 232px) * 1.414);
            padding: 54px 32px;
        }
    }
`;

// @state: green
export class DocsSchemaRenderer implements ISchemaRenderer {
    // @state: green
    public renderPage(webview: vscode.Webview, nonce: string) {
        return {
            // @state: green
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
