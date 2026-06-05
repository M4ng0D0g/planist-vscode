import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';

export class DatabaseSchemaRenderer implements ISchemaRenderer {
	public renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist ERD & SQL Designer');

		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} https://cdnjs.cloudflare.com;">`);

		page.addStyle(`
			body { margin: 0; padding: 0; background-color: #1e1e1e; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
			#header { display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; border-bottom: 1px solid #3c3c3c; background-color: #252526; }
			#title { font-size: 18px; font-weight: bold; color: #d7ba7d; }
			.tabs { display: flex; gap: 10px; }
			.tab-btn { background: #3c3c3c; border: 1px solid #555; color: #ccc; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; }
			.tab-btn.active { background: #007acc; color: white; border-color: #0098ff; }
			.view-container { flex: 1; display: flex; position: relative; }
			#erd-view { flex: 1; background-color: #1a1a1a; display: block; }
			#sql-view { flex: 1; display: none; background-color: #1e1e1e; padding: 20px; box-sizing: border-box; overflow: auto; }
			pre { margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #9cdcfe; line-height: 1.5; }
		`);

		// Load Cytoscape
		page.addExternalScript("https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js", nonce);

		const html = `
			<div id="header">
				<div id="title">Database Schema Designer</div>
				<div class="tabs">
					<button class="tab-btn active" id="tab-erd" onclick="switchTab('erd')">ERD Diagram</button>
					<button class="tab-btn" id="tab-sql" onclick="switchTab('sql')">Generate SQL</button>
				</div>
			</div>
			<div class="view-container">
				<div id="erd-view"></div>
				<div id="sql-view">
					<pre id="sql-output">-- Generating SQL...</pre>
				</div>
			</div>
		`;

		const js = `
			const vscode = acquireVsCodeApi();
			let dbData = null;
			let cy = null;

			// Handle Webview Messages
			window.addEventListener('message', event => {
				const message = event.data;
				if (message.command === 'updateSchemaData' && message.schema === 'database') {
					dbData = message.data;
					renderERD();
					renderSQL();
				}
			});

			function renderERD() {
				if (!dbData) return;

				const elements = [];

				// Add table nodes
				(dbData.tables || []).forEach(t => {
					// Build multiline label listing columns
					const colLines = (t.columns || []).map(c => {
						const constraints = c.constraints.length > 0 ? ' [' + c.constraints.join(', ') + ']' : '';
						return '  • ' + c.name + ': ' + c.type + constraints;
					});
					const label = t.name + '\\n=================\\n' + colLines.join('\\n');

					elements.push({
						data: { id: t.name, label: label }
					});
				});

				// Add FK relationship edges
				(dbData.tables || []).forEach(t => {
					(t.columns || []).forEach(c => {
						if (c.fkTarget) {
							const targetTable = c.fkTarget.split('.')[0];
							elements.push({
								data: {
									id: t.name + '-' + c.name + '-fk-' + targetTable,
									source: t.name,
									target: targetTable,
									label: '1:N (' + c.name + ')'
								}
							});
						}
					});
				});

				cy = cytoscape({
					container: document.getElementById('erd-view'),
					elements: elements,
					style: [
						{
							selector: 'node',
							style: {
								'background-color': '#252526',
								'label': 'data(label)',
								'color': '#d4d4d4',
								'text-wrap': 'wrap',
								'text-valign': 'center',
								'text-halign': 'center',
								'font-family': 'monospace',
								'font-size': '11px',
								'width': '180px',
								'height': '140px',
								'shape': 'round-rectangle',
								'border-width': 2,
								'border-color': '#d7ba7d',
								'corner-radius': 6
							}
						},
						{
							selector: 'edge',
							style: {
								'width': 2,
								'line-color': '#d7ba7d',
								'target-arrow-color': '#d7ba7d',
								'target-arrow-shape': 'tee',
								'source-arrow-shape': 'triangle',
								'curve-style': 'bezier',
								'label': 'data(label)',
								'font-size': '10px',
								'color': '#858585',
								'text-background-opacity': 0.8,
								'text-background-color': '#1a1a1a',
								'text-background-padding': '3px',
								'text-background-shape': 'round-rectangle',
								'arrow-scale': 1.2
							}
						}
					],
					layout: {
						name: 'grid',
						padding: 50,
						rows: 2
					}
				});
			}

			function renderSQL() {
				if (!dbData) return;
				
				let sql = '-- DDL Auto-Generated by Planist ERD Engine\\n\\n';
				(dbData.tables || []).forEach(table => {
					sql += 'CREATE TABLE ' + table.name + ' (\\n';
					
					const colDefinitions = (table.columns || []).map(col => {
						let line = '    ' + col.name + ' ' + col.type.toUpperCase();
						if (col.constraints.includes('pk')) {
							line += ' PRIMARY KEY';
						}
						if (col.constraints.includes('increment')) {
							line += ' AUTOINCREMENT';
						}
						return line;
					});

					// Add FK constraints
					(table.columns || []).forEach(col => {
						if (col.fkTarget) {
							const parts = col.fkTarget.split('.');
							colDefinitions.push('    FOREIGN KEY (' + col.name + ') REFERENCES ' + parts[0] + '(' + parts[1] + ')');
						}
					});

					sql += colDefinitions.join(',\\n') + '\\n);\\n\\n';
				});

				document.getElementById('sql-output').textContent = sql;
			}

			window.switchTab = function(tab) {
				document.getElementById('tab-erd').classList.remove('active');
				document.getElementById('tab-sql').classList.remove('active');
				document.getElementById('erd-view').style.display = 'none';
				document.getElementById('sql-view').style.display = 'none';

				document.getElementById('tab-' + tab).classList.add('active');
				document.getElementById(tab + '-view').style.display = 'block';

				if (tab === 'erd' && cy) {
					cy.resize();
					cy.fit();
				}
			};

			// Tell extension we are ready
			vscode.postMessage({ command: 'ready' });
		`;

		page.addChild(new RawHtmlComponent(html));
		page.addInlineScript(js, nonce);
		return page;
	}
}
