import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';

export class DesignSchemaRenderer implements ISchemaRenderer {
	public renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist Design Studio');

		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">`);

		page.addStyle(`
			body { margin: 0; padding: 0; background-color: #1e1e1e; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; height: 100vh; overflow: hidden; }
			#sidebar { width: 300px; background-color: #252526; border-right: 1px solid #3c3c3c; display: flex; flex-direction: column; padding: 15px; box-sizing: border-box; }
			#canvas { flex: 1; position: relative; background-color: #1e1e1e; display: flex; align-items: center; justify-content: center; }
			.section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #858585; text-transform: uppercase; border-bottom: 1px solid #3c3c3c; padding-bottom: 5px; }
			.prop-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
			.prop-label { font-size: 12px; color: #ccc; }
			.prop-input { background: #3c3c3c; border: 1px solid #555; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; width: 120px; }
			.color-picker-wrapper { display: flex; align-items: center; gap: 8px; }
			.color-preview { width: 24px; height: 24px; border-radius: 4px; border: 1px solid #555; cursor: pointer; }
			#preview-panel {
				min-width: 150px; min-height: 100px; background-color: #2d2d2d; border: 2px solid #007acc; border-radius: 8px;
				display: flex; align-items: center; justify-content: center; position: relative; color: white; cursor: move;
				box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold;
			}
			#resize-handle {
				position: absolute; right: 0; bottom: 0; width: 15px; height: 15px;
				cursor: se-resize; background: linear-gradient(135deg, transparent 50%, #007acc 50%); border-bottom-right-radius: 6px;
			}
			.title-bar { position: absolute; top: 15px; left: 15px; font-size: 18px; font-weight: bold; color: #858585; z-index: 10; }
		`);

		const html = `
			<div id="sidebar">
				<div class="section-title">Global Theme Design</div>
				<div id="theme-info" style="font-size: 12px; color: #007acc; margin-bottom: 15px; font-weight: bold;">Loading theme...</div>
				
				<div class="section-title">Colors & Values</div>
				<div class="prop-row">
					<span class="prop-label">Primary Color</span>
					<div class="color-picker-wrapper">
						<div id="primaryColor-preview" class="color-preview" style="background-color: #007acc"></div>
						<input type="color" id="primaryColor-input" style="display:none;">
					</div>
				</div>
				<div class="prop-row">
					<span class="prop-label">Background</span>
					<div class="color-picker-wrapper">
						<div id="backgroundColor-preview" class="color-preview" style="background-color: #1e1e1e"></div>
						<input type="color" id="backgroundColor-input" style="display:none;">
					</div>
				</div>
				<div class="prop-row">
					<span class="prop-label">Sidebar Width</span>
					<input type="number" id="sidebarWidth-input" class="prop-input" value="240">
				</div>

				<div class="section-title" style="margin-top:20px;">UI Component Editor</div>
				<div class="prop-row">
					<span class="prop-label">Padding (px)</span>
					<input type="number" id="padding-input" class="prop-input" value="16">
				</div>
			</div>

			<div id="canvas">
				<div class="title-bar" id="theme-title">PLANIST DESIGN CANVAS</div>
				<div id="preview-panel">
					MainWindow
					<div id="resize-handle"></div>
				</div>
			</div>
		`;

		const js = `
			const vscode = acquireVsCodeApi();
			let themeData = null;

			// Handle Webview Messages
			window.addEventListener('message', event => {
				const message = event.data;
				if (message.command === 'updateSchemaData' && message.schema === 'design') {
					themeData = message.data;
					updateUI();
				}
			});

			function updateUI() {
				if (!themeData) return;
				document.getElementById('theme-info').textContent = themeData.themeName || 'DarkTheme';
				document.getElementById('theme-title').textContent = "DESIGN CANVAS - " + (themeData.themeName || 'Theme');
				
				// Update side controls
				const config = themeData.config || {};
				document.getElementById('primaryColor-preview').style.backgroundColor = config.primaryColor || '#007acc';
				document.getElementById('primaryColor-input').value = config.primaryColor || '#007acc';
				document.getElementById('backgroundColor-preview').style.backgroundColor = config.backgroundColor || '#1e1e1e';
				document.getElementById('backgroundColor-input').value = config.backgroundColor || '#1e1e1e';
				document.getElementById('sidebarWidth-input').value = config.sidebarWidth || 240;

				document.getElementById('canvas').style.backgroundColor = config.backgroundColor || '#1e1e1e';

				const panel = themeData.panels && themeData.panels[0];
				if (panel) {
					const padding = panel.properties.padding || 16;
					document.getElementById('padding-input').value = padding;
					
					const preview = document.getElementById('preview-panel');
					preview.style.padding = padding + 'px';
					preview.style.borderColor = config.primaryColor || '#007acc';
					preview.style.width = (panel.properties.width || 300) + 'px';
					preview.style.height = (panel.properties.height || 200) + 'px';
					preview.firstChild.textContent = panel.name;
				}
			}

			// Synchronize changes back to VS Code Editor
			function syncChanges() {
				if (!themeData) return;
				
				const primaryColor = document.getElementById('primaryColor-input').value;
				const backgroundColor = document.getElementById('backgroundColor-input').value;
				const sidebarWidth = parseInt(document.getElementById('sidebarWidth-input').value) || 240;
				const padding = parseInt(document.getElementById('padding-input').value) || 16;
				
				const preview = document.getElementById('preview-panel');
				const width = parseInt(preview.style.width) || 300;
				const height = parseInt(preview.style.height) || 200;

				// Construct updated DSL string
				const dsl = [
					"#schema design " + (themeData.themeName || 'DarkTheme'),
					"",
					"config {",
					'    primaryColor: "' + primaryColor + '"',
					'    backgroundColor: "' + backgroundColor + '"',
					"    sidebarWidth: " + sidebarWidth,
					"}",
					""
				];

				if (themeData.panels && themeData.panels.length > 0) {
					const mainPanel = themeData.panels[0];
					dsl.push("panel " + mainPanel.name + " {");
					dsl.push("    padding: " + padding);
					if (mainPanel.properties.border) {
						dsl.push('    border: "' + mainPanel.properties.border + '"');
					}
					dsl.push("    width: " + width);
					dsl.push("    height: " + height);
					dsl.push("}");
				}
				
				vscode.postMessage({
					command: 'updateDocumentText',
					text: dsl.join('\\n')
				});
			}

			// Color Picker Interactions
			document.getElementById('primaryColor-preview').addEventListener('click', () => {
				document.getElementById('primaryColor-input').click();
			});
			document.getElementById('primaryColor-input').addEventListener('input', (e) => {
				document.getElementById('primaryColor-preview').style.backgroundColor = e.target.value;
				syncChanges();
			});

			document.getElementById('backgroundColor-preview').addEventListener('click', () => {
				document.getElementById('backgroundColor-input').click();
			});
			document.getElementById('backgroundColor-input').addEventListener('input', (e) => {
				document.getElementById('backgroundColor-preview').style.backgroundColor = e.target.value;
				document.getElementById('canvas').style.backgroundColor = e.target.value;
				syncChanges();
			});

			document.getElementById('sidebarWidth-input').addEventListener('change', syncChanges);
			document.getElementById('padding-input').addEventListener('change', () => {
				const padding = document.getElementById('padding-input').value;
				document.getElementById('preview-panel').style.padding = padding + 'px';
				syncChanges();
			});

			// Resize Handler (Drag-to-Resize Panel)
			const previewPanel = document.getElementById('preview-panel');
			const resizeHandle = document.getElementById('resize-handle');
			
			resizeHandle.addEventListener('mousedown', (e) => {
				e.preventDefault();
				const startWidth = parseInt(document.defaultView.getComputedStyle(previewPanel).width, 10);
				const startHeight = parseInt(document.defaultView.getComputedStyle(previewPanel).height, 10);
				const startX = e.clientX;
				const startY = e.clientY;

				function doDrag(dragEvent) {
					previewPanel.style.width = (startWidth + dragEvent.clientX - startX) + 'px';
					previewPanel.style.height = (startHeight + dragEvent.clientY - startY) + 'px';
				}

				function stopDrag() {
					document.documentElement.removeEventListener('mousemove', doDrag, false);
					document.documentElement.removeEventListener('mouseup', stopDrag, false);
					syncChanges();
				}

				document.documentElement.addEventListener('mousemove', doDrag, false);
				document.documentElement.addEventListener('mouseup', stopDrag, false);
			});

			// Tell extension we are ready to receive data
			vscode.postMessage({ command: 'ready' });
		`;

		page.addChild(new RawHtmlComponent(html));
		page.addInlineScript(js, nonce);
		return page;
	}
}
