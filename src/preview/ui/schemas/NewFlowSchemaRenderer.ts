import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { NewFlowSchemaJS } from './NewFlowSchemaJS';
import { NewFlowSchemaSettingsCSS } from './NewFlowSchemaSettingsCSS';
import { NewFlowSchemaSettingsJS } from './NewFlowSchemaSettingsJS';

// @state: green
export const NewFlowSchemaCSS = `
    :root {
        --bg-color: #0c0c0e;
        --grid-major-color: rgba(255, 255, 255, 0.07);
        --grid-minor-color: rgba(255, 255, 255, 0.02);
        --hud-bg: rgba(20, 20, 25, 0.75);
        --hud-border: rgba(255, 255, 255, 0.08);
        --text-color: #f3f4f6;
        --accent-color: #3b82f6;
        --accent-hover: #2563eb;
        --connection-color: rgba(255, 255, 255, 0.45);
    }

    * {
        box-sizing: border-box;
        user-select: none;
    }

    body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: var(--bg-color);
        color: var(--text-color);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    /* Infinite Viewport */
    #viewport {
        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        cursor: grab;
    }

    #viewport:active {
        cursor: grabbing;
    }

    /* Infinite grid background layer (doesn't scale, its background pattern scales in JS) */
    #grid-bg {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1;
        pointer-events: none;
        background-image: 
            linear-gradient(to right, var(--grid-major-color) 1px, transparent 1px),
            linear-gradient(to bottom, var(--grid-major-color) 1px, transparent 1px),
            linear-gradient(to right, var(--grid-minor-color) 1px, transparent 1px),
            linear-gradient(to bottom, var(--grid-minor-color) 1px, transparent 1px);
    }

    /* Workspace container - holds all nodes and scales/moves */
    #workspace {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        transform-origin: 0 0;
        pointer-events: none;
    }

    /* Enable pointer events for actual node elements in the workspace */
    .board-node {
        pointer-events: auto;
    }

    /* Glassmorphism Heads-Up Display (HUD) Controls */
    .hud-panel {
        position: absolute;
        z-index: 10;
        background: var(--hud-bg);
        border: 1px solid var(--hud-border);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 12px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
    }

    .hud-bottom-right {
        bottom: 24px;
        right: 24px;
    }

    .hud-bottom-left {
        bottom: 24px;
        left: 24px;
    }

    .hud-top-left {
        top: 24px;
        left: 24px;
    }

    /* HUD Button Styling */
    .hud-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-color);
        border-radius: 8px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        font-weight: 600;
    }

    .hud-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.25);
        transform: translateY(-1px);
    }

    .hud-btn:active {
        transform: translateY(0);
    }

    .hud-btn.primary {
        background: var(--accent-color);
        border-color: transparent;
    }

    .hud-btn.primary:hover {
        background: var(--accent-hover);
    }

    /* HUD Text Elements */
    .hud-label {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.7);
        min-width: 45px;
        text-align: center;
    }

    .brand-title {
        font-size: 14px;
        font-weight: 700;
        background: linear-gradient(135deg, #60a5fa, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: 0.5px;
    }

    /* Board Nodes styling */
    .board-node {
        position: absolute;
        z-index: 5;
        background: rgba(30, 30, 35, 0.95);
        border: 1.5px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        min-width: 240px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        cursor: grab;
        pointer-events: auto;
    }

    .board-node:hover {
        border-color: rgba(255, 255, 255, 0.25);
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
        transform: translateY(-2px);
    }

    .board-node:active {
        cursor: grabbing;
    }

    .node-header {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        border-radius: 8px 8px 0 0;
    }

    .node-kind {
        font-size: 9px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 1.2px;
        color: rgba(255, 255, 255, 0.5);
    }

    .node-title {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
    }

    .node-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 0;
    }

    .node-body {
        padding: 10px 14px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .node-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .node-item {
        white-space: pre-wrap;
        word-break: break-all;
        line-height: 1.4;
    }

    .field-item {
        color: #9cdcfe; /* Visual Studio Code blueish type color */
    }

    .method-item {
        color: #dcdcaa; /* Visual Studio Code yellow method color */
    }

    .text-body {
        white-space: pre-wrap;
        color: #d4d4d4;
        line-height: 1.5;
        font-size: 12px;
    }

    .text-node {
        background: rgba(200, 200, 205, 0.25) !important;
        border-color: rgba(255, 255, 255, 0.15) !important;
    }

    #connections-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
        overflow: visible;
    }

    /* Interactive Jump Buttons */
    .item-btn {
        background: none;
        border: none;
        color: inherit;
        font-family: inherit;
        font-size: inherit;
        padding: 2px 4px;
        margin: 0;
        text-align: left;
        width: 100%;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        transition: background-color 0.15s ease, color 0.15s ease;
    }
    .item-btn:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
    .item-btn:focus {
        outline: 1px solid var(--accent-color);
    }

    /* Floating Tooltip */
    #tooltip {
        position: fixed;
        z-index: 100;
        background: rgba(20, 20, 25, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        font-size: 11px;
        max-width: 320px;
        color: #f3f4f6;
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.5;
        display: none;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        white-space: pre-wrap;
        word-break: break-word;
    }
    .tooltip-title {
        font-weight: 600;
        margin-bottom: 4px;
        color: var(--accent-color);
    }
    .tooltip-comment {
        color: rgba(255, 255, 255, 0.85);
    }

    /* ==========================================================================
       Light Mode Overrides (VS Code light theme classes)
       ========================================================================== */
    body.vscode-light {
        --bg-color: #f3f4f6;
        --text-color: #1f2937;
        --grid-major-color: rgba(0, 0, 0, 0.05);
        --grid-minor-color: rgba(0, 0, 0, 0.02);
        --hud-bg: rgba(243, 244, 246, 0.75);
        --hud-border: rgba(0, 0, 0, 0.08);
        --connection-color: rgba(0, 0, 0, 0.35);
    }

    body.vscode-light .board-node {
        background: rgba(255, 255, 255, 0.95);
        border-color: rgba(0, 0, 0, 0.08);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }

    body.vscode-light .node-title {
        color: #1f2937;
    }

    body.vscode-light .node-kind {
        color: rgba(0, 0, 0, 0.5);
    }

    body.vscode-light .node-divider {
        background: rgba(0, 0, 0, 0.08);
    }

    body.vscode-light .text-body {
        color: #374151;
    }

    body.vscode-light .text-node {
        background: rgba(229, 231, 235, 0.8) !important;
        border-color: rgba(0, 0, 0, 0.1) !important;
    }

    body.vscode-light .hud-btn {
        background: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.08);
        color: #1f2937;
    }

    body.vscode-light .hud-btn:hover {
        background: rgba(0, 0, 0, 0.12);
        border-color: rgba(0, 0, 0, 0.15);
    }

    body.vscode-light #tooltip {
        background: rgba(255, 255, 255, 0.98);
        border-color: rgba(0, 0, 0, 0.15);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
        color: #1f2937;
    }

    body.vscode-light .tooltip-title {
        color: var(--accent-color);
    }

    body.vscode-light .tooltip-comment {
        color: #4b5563;
    }

    body.vscode-light .item-btn:hover {
        background-color: rgba(0, 0, 0, 0.06);
    }

    /* Canvas Context Menu */
    #canvas-context-menu {
        position: fixed;
        z-index: 1000;
        background: rgba(20, 20, 25, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        display: none;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 4px 0;
        min-width: 140px;
    }
    #canvas-context-menu.open {
        display: block;
    }
    .context-menu-item {
        padding: 8px 12px;
        font-size: 13px;
        color: #f3f4f6;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }
    .context-menu-item:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
    body.vscode-light #canvas-context-menu {
        background: rgba(255, 255, 255, 0.98);
        border-color: rgba(0, 0, 0, 0.15);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
    }
    body.vscode-light .context-menu-item {
        color: #1f2937;
    }
    body.vscode-light .context-menu-item:hover {
        background-color: rgba(0, 0, 0, 0.06);
    }
`;

// @state: green
export class NewFlowSchemaRenderer implements ISchemaRenderer {
    // @state: green
    public renderPage(webview: vscode.Webview, nonce: string) {
        // @state: green
        return {
            render: (): string => {
                const htmlParts: string[] = [];
                
                htmlParts.push('<!DOCTYPE html>');
                htmlParts.push('<html lang="zh-TW">');
                htmlParts.push('<head>');
                htmlParts.push('    <meta charset="UTF-8">');
                htmlParts.push(`    <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}; font-src ${webview.cspSource} https:;">`);
                htmlParts.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
                htmlParts.push('    <title>Planist Infinite Board</title>');
                htmlParts.push('    <style>');
                htmlParts.push(NewFlowSchemaCSS);
                htmlParts.push(NewFlowSchemaSettingsCSS);
                htmlParts.push('    </style>');
                htmlParts.push('</head>');
                htmlParts.push('<body>');
                
                // Top Left Back Button Panel (Hidden by default, shown in Call Chain Mode)
                htmlParts.push('    <div class="hud-panel hud-top-left" id="back-btn-panel" style="display: none;">');
                htmlParts.push('        <button class="hud-btn primary" id="backBtn" style="width: auto; padding: 0 12px;" title="返回實體總覽">返回實體總覽</button>');
                htmlParts.push('    </div>');
 
                // Infinite Viewport container
                htmlParts.push('    <div id="viewport">');
                htmlParts.push('        <div id="grid-bg"></div>');
                htmlParts.push('        <div id="workspace">');
                // Nodes and connections will be rendered dynamically here
                htmlParts.push('        </div>');
                htmlParts.push('    </div>');
                
                // Floating Tooltip container
                htmlParts.push('    <div id="tooltip"></div>');
                
                // Canvas Context Menu container
                htmlParts.push('    <div id="canvas-context-menu" class="canvas-context-menu">');
                htmlParts.push('        <div class="context-menu-item" id="ctx-create-node">建立實體節點</div>');
                htmlParts.push('    </div>');
                
                // Bottom Left Fullscreen HUD Control
                htmlParts.push('    <div class="hud-panel hud-bottom-left">');
                htmlParts.push('        <button class="hud-btn" id="fullscreen-btn" title="切換全螢幕模式">⛶</button>');
                htmlParts.push('    </div>');
                
                // Bottom Right Navigation HUD Controls
                htmlParts.push('    <div class="hud-panel hud-bottom-right">');
                htmlParts.push('        <button class="hud-btn" id="zoom-out-btn" title="Zoom Out">−</button>');
                htmlParts.push('        <span class="hud-label" id="zoom-display">100%</span>');
                htmlParts.push('        <button class="hud-btn" id="zoom-in-btn" title="Zoom In">+</button>');
                htmlParts.push('        <button class="hud-btn" id="zoom-reset-btn" title="Reset View">⟲</button>');
                htmlParts.push('    </div>');

                // Right Slide-out Settings Panel HTML
                htmlParts.push('    <div id="settings-panel" class="settings-panel">');
                htmlParts.push('        <div class="settings-header">');
                htmlParts.push('            <span class="settings-title">節點設定 (Settings)</span>');
                htmlParts.push('            <button class="close-settings-btn" id="close-settings-btn">&times;</button>');
                htmlParts.push('        </div>');
                htmlParts.push('        <div class="settings-tabs">');
                htmlParts.push('            <div class="settings-tab active" id="tab-definition">屬性</div>');
                htmlParts.push('            <div class="settings-tab" id="tab-rendering">渲染</div>');
                htmlParts.push('        </div>');
                htmlParts.push('        <div class="settings-content" id="settings-content-definition" style="display: flex;">');
                htmlParts.push('            <!-- Definition inputs generated dynamically -->');
                htmlParts.push('        </div>');
                htmlParts.push('        <div class="settings-content" id="settings-content-rendering" style="display: none;">');
                htmlParts.push('            <div class="form-group">');
                htmlParts.push('                <span class="form-label">HSL 顏色覆寫</span>');
                htmlParts.push('                <div class="hsl-slider-group">');
                htmlParts.push('                    <div class="slider-row">');
                htmlParts.push('                        <div class="slider-header"><span>色相 (Hue)</span><span id="val-h">210°</span></div>');
                htmlParts.push('                        <div class="slider-container">');
                htmlParts.push('                            <input type="range" id="slider-h" min="0" max="360" value="210">');
                htmlParts.push('                        </div>');
                htmlParts.push('                    </div>');
                htmlParts.push('                    <div class="slider-row">');
                htmlParts.push('                        <div class="slider-header"><span>飽和度 (Saturation)</span><span id="val-s">80%</span></div>');
                htmlParts.push('                        <div class="slider-container">');
                htmlParts.push('                            <input type="range" id="slider-s" min="0" max="100" value="80">');
                htmlParts.push('                        </div>');
                htmlParts.push('                    </div>');
                htmlParts.push('                    <div class="slider-row">');
                htmlParts.push('                        <div class="slider-header"><span>亮度 (Lightness)</span><span id="val-l">50%</span></div>');
                htmlParts.push('                        <div class="slider-container">');
                htmlParts.push('                            <input type="range" id="slider-l" min="0" max="100" value="50">');
                htmlParts.push('                        </div>');
                htmlParts.push('                    </div>');
                htmlParts.push('                </div>');
                htmlParts.push('            </div>');
                htmlParts.push('            <div class="form-group" style="margin-top: 10px;">');
                htmlParts.push('                <span class="form-label">最近顏色 (Recent Colors)</span>');
                htmlParts.push('                <div id="recent-colors-container" class="recent-colors-container"></div>');
                htmlParts.push('            </div>');
                htmlParts.push('            <button class="reset-color-btn" id="reset-color-btn">還原預設顏色 (Reset)</button>');
                htmlParts.push('        </div>');
                htmlParts.push('    </div>');

                // Inject our frontend Javascript script block
                htmlParts.push(`    <script nonce="${nonce}">`);
                htmlParts.push(NewFlowSchemaJS);
                htmlParts.push(NewFlowSchemaSettingsJS);
                htmlParts.push('    </script>');
                
                htmlParts.push('</body>');
                htmlParts.push('</html>');

                return htmlParts.join('\n');
            }
        };
    }
}
