import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';

export class StateSchemaRenderer implements ISchemaRenderer {
	public renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist State Machine Simulator');

		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} https://cdnjs.cloudflare.com;">`);

		page.addStyle(`
			body { margin: 0; padding: 0; background-color: #1e1e1e; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
			#cy { flex: 1; min-height: 300px; background-color: #1a1a1a; display: block; position: relative; border-bottom: 1px solid #3c3c3c; }
			#simulator-panel { height: 180px; background-color: #252526; display: flex; flex-direction: column; padding: 15px; box-sizing: border-box; }
			.section-title { font-size: 13px; font-weight: bold; color: #858585; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #3c3c3c; padding-bottom: 5px; }
			#simulator-controls { display: flex; align-items: center; gap: 20px; flex: 1; }
			.state-display-box { background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 6px; padding: 15px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 120px; }
			.state-label { font-size: 11px; color: #858585; margin-bottom: 4px; text-transform: uppercase; }
			.state-value { font-size: 20px; font-weight: bold; color: #4fc1ff; }
			.events-title { font-size: 12px; font-weight: bold; color: #ccc; margin-bottom: 8px; }
			.events-list { display: flex; gap: 10px; flex-wrap: wrap; }
			.btn-event { background: #0e639c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; transition: background-color 0.2s; }
			.btn-event:hover { background: #1177bb; }
			.btn-reset { background: #333; color: #ccc; border: 1px solid #555; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background-color 0.2s; }
			.btn-reset:hover { background: #444; color: #fff; }
		`);

		// Load Cytoscape
		page.addExternalScript("https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js", nonce);

		const html = `
			<div id="cy"></div>
			<div id="simulator-panel">
				<div class="section-title">State Machine Simulator</div>
				<div id="simulator-controls">
					<div class="state-display-box">
						<span class="state-label">Current State</span>
						<span class="state-value" id="current-state-val">-</span>
					</div>
					<div style="flex:1;">
						<div class="events-title">Trigger Available Transitions:</div>
						<div class="events-list" id="events-list"></div>
					</div>
					<div>
						<button class="btn-reset" onclick="resetSimulator()">Reset</button>
					</div>
				</div>
			</div>
		`;

		const js = `
			const vscode = acquireVsCodeApi();
			let stateData = null;
			let cy = null;
			let currentState = null;

			// Handle Webview Messages
			window.addEventListener('message', event => {
				const message = event.data;
				if (message.command === 'updateSchemaData' && message.schema === 'state') {
					stateData = message.data;
					initializeStateGraph();
					resetSimulator();
				}
			});

			function initializeStateGraph() {
				if (!stateData) return;

				const elements = [];
				// Add states as nodes
				(stateData.states || []).forEach(s => {
					elements.push({
						data: { id: s.name, label: s.name }
					});
				});

				// Add transitions as edges
				(stateData.states || []).forEach(s => {
					(s.transitions || []).forEach(t => {
						elements.push({
							data: {
								id: s.name + '-' + t.event + '-' + t.target,
								source: s.name,
								target: t.target,
								label: t.event
							}
						});
					});
				});

				cy = cytoscape({
					container: document.getElementById('cy'),
					elements: elements,
					style: [
						{
							selector: 'node',
							style: {
								'background-color': '#2d2d2d',
								'label': 'data(label)',
								'color': '#fff',
								'text-valign': 'center',
								'text-halign': 'center',
								'font-size': '13px',
								'width': '90px',
								'height': '90px',
								'shape': 'ellipse',
								'border-width': 3,
								'border-color': '#007acc'
							}
						},
						{
							selector: 'node.active',
							style: {
								'background-color': '#0e639c',
								'border-color': '#4fc1ff',
								'border-width': 6,
								'width': '105px',
								'height': '105px',
								'font-weight': 'bold'
							}
						},
						{
							selector: 'edge',
							style: {
								'width': 3,
								'line-color': '#555',
								'target-arrow-color': '#555',
								'target-arrow-shape': 'triangle',
								'curve-style': 'bezier',
								'label': 'data(label)',
								'font-size': '11px',
								'color': '#bbb',
								'text-background-opacity': 0.8,
								'text-background-color': '#1a1a1a',
								'text-background-padding': '3px',
								'text-background-shape': 'round-rectangle',
								'arrow-scale': 1.2
							}
						},
						{
							selector: 'edge.active',
							style: {
								'line-color': '#4fc1ff',
								'target-arrow-color': '#4fc1ff',
								'width': 5
							}
						}
					],
					layout: {
						name: 'circle',
						padding: 40
					}
				});
			}

			window.resetSimulator = function() {
				if (!stateData) return;
				currentState = stateData.initialState || (stateData.states[0] && stateData.states[0].name) || '';
				transitionTo(currentState);
			};

			function transitionTo(stateName) {
				currentState = stateName;
				document.getElementById('current-state-val').textContent = currentState;

				// Update Cytoscape highlighting
				if (cy) {
					cy.nodes().removeClass('active');
					const activeNode = cy.getElementById(currentState);
					if (activeNode) activeNode.addClass('active');
				}

				// Find transitions from current state
				const stateBlock = stateData.states.find(s => s.name === currentState);
				const eventsList = document.getElementById('events-list');
				eventsList.innerHTML = '';

				if (stateBlock && stateBlock.transitions && stateBlock.transitions.length > 0) {
					stateBlock.transitions.forEach(t => {
						const btn = document.createElement('button');
						btn.className = 'btn-event';
						btn.textContent = t.event;
						btn.addEventListener('click', () => {
							// Highlight transition edge temporarily
							const edgeId = currentState + '-' + t.event + '-' + t.target;
							const edge = cy.getElementById(edgeId);
							if (edge) {
								edge.addClass('active');
								setTimeout(() => edge.removeClass('active'), 500);
							}
							
							transitionTo(t.target);
						});
						eventsList.appendChild(btn);
					});
				} else {
					eventsList.innerHTML = '<span style="font-size:12px; color:#858585;">No outbound transitions available (Terminal State).</span>';
				}
			}

			// Tell extension we are ready
			vscode.postMessage({ command: 'ready' });
		`;

		page.addChild(new RawHtmlComponent(html));
		page.addInlineScript(js, nonce);
		return page;
	}
}
