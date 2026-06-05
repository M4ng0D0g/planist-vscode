import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { FlowSchemaJS } from './FlowSchemaJS';
import { PlanistButton } from '../components/PlanistButton';
import { PlanistToolbar } from '../components/PlanistToolbar';
import { PlanistTooltip } from '../components/PlanistTooltip';

export const FlowSchemaCSS = `
    body { margin: 0; overflow: hidden; background-color: #1e1e1e; color: #d4d4d4; font-family: sans-serif; }
    #cy { width: 100vw; height: 100vh; display: block; position: absolute; top: 0; left: 0; z-index: 1; }
    #toolbar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; align-items: center; }
    .btn { background: #333; color: white; border: 1px solid #555; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .btn:hover { background: #444; }
    #backBtn { display: none; background: #007acc; border-color: #005a9e; }
    #backBtn:hover { background: #0098ff; }
    #tooltip {
        position: absolute; background: rgba(30, 30, 30, 0.95); border: 1px solid #555;
        padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #eee;
        pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 20; white-space: pre;
    }
`;

export class FlowSchemaRenderer implements ISchemaRenderer {
    // @state: red
    public renderPage(webview: vscode.Webview, nonce: string) {
        return {
            render: (): string => {
                const htmlParts: string[] = [];
                
                htmlParts.push('<!DOCTYPE html>');
                htmlParts.push('<html lang="zh-TW">');
                htmlParts.push('<head>');
                htmlParts.push('    <meta charset="UTF-8">');
                htmlParts.push(`    <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource} https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src ${webview.cspSource} https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https:; font-src ${webview.cspSource} https:;">`);
                htmlParts.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
                htmlParts.push('    <title>Planist Flow Preview</title>');
                htmlParts.push('    <style>');
                htmlParts.push(FlowSchemaCSS);
                htmlParts.push('    </style>');
                
                // 載入可拖動與網格佈局核心庫
                htmlParts.push(`    <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.29.2/cytoscape.min.js"></script>`);
                htmlParts.push(`    <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>`);
                htmlParts.push(`    <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@3.0.0/cytoscape-dagre.min.js"></script>`);
                htmlParts.push('</head>');
                htmlParts.push('<body>');
                
                // UI 元件
                const toolbar = new PlanistToolbar();
                toolbar.addChild(new PlanistButton('backBtn', '返回實體總覽', 'primary'));
                toolbar.addChild(new PlanistButton('fitBtn', '置中視圖 (Fit)', 'primary'));
                toolbar.addChild(new PlanistButton('layoutBtn', '重新排列 (Re-layout)', 'primary'));
                htmlParts.push(toolbar.render());
                
                // 畫布容器與 Tooltip
                htmlParts.push('    <div id="cy"></div>');
                
                const tooltip = new PlanistTooltip();
                htmlParts.push(tooltip.render());

                // 注入核心 JavaScript 腳本
                htmlParts.push(`    <script nonce="${nonce}">`);
                htmlParts.push(FlowSchemaJS);
                htmlParts.push('    </script>');
                
                htmlParts.push('</body>');
                htmlParts.push('</html>');

                return htmlParts.join('\n');
            }
        };
    }
}