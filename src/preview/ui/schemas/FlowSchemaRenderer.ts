import * as vscode from 'vscode';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';
import { ToolbarComponent, ButtonComponent, BadgeComponent } from '../components/Toolbar';
import { FlowSchemaJS } from './FlowSchemaJS';

export const FlowSchemaCSS = `
    body { margin: 0; overflow: hidden; background-color: #1e1e1e; color: #d4d4d4; font-family: sans-serif; }
    #cy { width: 100vw; height: 100vh; display: block; position: absolute; top: 0; left: 0; z-index: 1; }
    #toolbar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; align-items: center; }
    .btn { background: #333; color: white; border: 1px solid #555; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .btn:hover { background: #444; }
    #tooltip {
        position: absolute; background: rgba(30, 30, 30, 0.95); border: 1px solid #555;
        padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #eee;
        pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 20; white-space: pre;
    }
`;

export class FlowSchemaRenderer {
    renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
        const page = new WebviewPage('Planist Flow Preview');
        
        // 核心安全策略注入
        page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource} https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src ${webview.cspSource} https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https:; font-src ${webview.cspSource} https:;">`);
        page.addMeta('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        
        page.addStyle(FlowSchemaCSS);
        
        // 載入可拖動與網格佈局核心庫
        page.addExternalScript("https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js", nonce);
        page.addExternalScript("https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dist/dagre.min.js", nonce);
        page.addExternalScript("https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js", nonce);

        // 佈局 UI 元件
        const toolbar = new ToolbarComponent();
        toolbar.addChild(new ButtonComponent('fitBtn', '置中視圖 (Fit)'));
        toolbar.addChild(new ButtonComponent('layoutBtn', '重新排列 (Re-layout)'));
        page.addChild(toolbar);
        
        // 畫布容器
        page.addChild(new RawHtmlComponent('<div id="cy"></div>\n<div id="tooltip"></div>'));
        
        // 注入純前端控制代碼
        page.addInlineScript(FlowSchemaJS, nonce);

        return page;
    }
}