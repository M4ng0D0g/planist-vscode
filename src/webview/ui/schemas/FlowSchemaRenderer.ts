import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';
import { ToolbarComponent, ButtonComponent, BadgeComponent } from '../components/Toolbar';
import { FlowSchemaJS } from './FlowSchemaJS';

export const FlowSchemaCSS = `
#cy { width: 100vw; height: 100vh; display: block; }
body { margin: 0; overflow: hidden; background-color: #1a1a1a; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
#toolbar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; align-items: center; }
.btn { background: #333; color: white; border: 1px solid #555; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn:hover { background: #444; }
.badge { font-size: 12px; color: #888; }
#tooltip {
	position: absolute;
	background: rgba(30, 30, 30, 0.95);
	border: 1px solid #555;
	padding: 8px 12px;
	border-radius: 6px;
	font-size: 11px;
	color: #eee;
	pointer-events: none;
	opacity: 0;
	transition: opacity 0.2s;
	z-index: 20;
	white-space: pre;
}
`;

export class FlowSchemaRenderer implements ISchemaRenderer {
	renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist Flow Preview');
		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;">`);
		page.addMeta('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
		
		page.addStyle(FlowSchemaCSS);
		
		page.addScriptTag(`<script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>`);
		page.addScriptTag(`<script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>`);
		page.addScriptTag(`<script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>`);

		const toolbar = new ToolbarComponent();
		toolbar.addChild(new ButtonComponent('fitBtn', '置中視圖 (Fit)'));
		toolbar.addChild(new ButtonComponent('layoutBtn', '重新排列 (Re-layout)'));
		toolbar.addChild(new ButtonComponent('modeBtn', '切換模式 (Switch Mode)'));
		toolbar.addChild(new ButtonComponent('scaleToggleBtn', '進入微觀 (Micro)'));
		toolbar.addChild(new BadgeComponent('modeBadge', '一般模式'));
		
		page.addChild(toolbar);
		page.addChild(new RawHtmlComponent('<div id="cy"></div>\n<div id="tooltip"></div>'));
        
		page.addInlineScript(FlowSchemaJS);

		return page;
	}
}
