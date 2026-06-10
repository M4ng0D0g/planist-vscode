import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';

export class ApiSchemaRenderer implements ISchemaRenderer {
	public renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist API Endpoint Panel');

		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource} https:; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">`);

		page.addStyle(`
			body { margin: 0; padding: 20px; background-color: #1e1e1e; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
			#header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #3c3c3c; padding-bottom: 15px; margin-bottom: 20px; }
			#title { font-size: 20px; font-weight: bold; color: #4fc1ff; }
			#base-url { font-family: monospace; background: #2d2d2d; padding: 4px 8px; border-radius: 4px; border: 1px solid #3c3c3c; font-size: 13px; color: #a5d6ff; }
			#api-list { display: flex; flex-direction: column; gap: 15px; overflow-y: auto; flex: 1; }
			.route-item { border: 1px solid #3c3c3c; border-radius: 6px; overflow: hidden; background-color: #252526; }
			.route-header { display: flex; align-items: center; padding: 12px; cursor: pointer; user-select: none; transition: background-color 0.2s; }
			.route-header:hover { background-color: #2d2d2d; }
			.method-badge { font-weight: bold; font-size: 11px; padding: 4px 8px; border-radius: 3px; color: white; width: 65px; text-align: center; text-transform: uppercase; margin-right: 15px; }
			.method-GET { background-color: #0e8a16; }
			.method-POST { background-color: #1545c0; }
			.method-PUT { background-color: #c5a600; }
			.method-DELETE { background-color: #a80000; }
			.path-text { font-family: monospace; font-size: 14px; font-weight: bold; flex: 1; }
			.handler-text { font-size: 12px; color: #858585; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
			.handler-text:hover { text-decoration: underline; color: #4fc1ff; }
			.route-details { padding: 15px; background: #1e1e1e; border-top: 1px solid #3c3c3c; display: none; }
			.details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
			.grid-box { background: #252526; border: 1px solid #3c3c3c; border-radius: 4px; padding: 12px; }
			.box-title { font-size: 12px; font-weight: bold; color: #858585; margin-bottom: 8px; text-transform: uppercase; }
			.code-editor { width: 100%; height: 80px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px; color: #4fc1ff; font-family: monospace; font-size: 12px; padding: 8px; box-sizing: border-box; resize: none; }
			.btn-send { background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; }
			.btn-send:hover { background: #0098ff; }
			.response-box { margin-top: 15px; background: #151515; border: 1px solid #3c3c3c; border-radius: 4px; padding: 12px; display: none; }
			.response-status { font-weight: bold; font-size: 12px; margin-bottom: 8px; }
			.status-success { color: #4fec80; }
			.status-error { color: #f05252; }
			.response-body { font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #9cdcfe; margin: 0; }
		`);

		const html = `
			<div id="header">
				<div id="title">API Documentation</div>
				<div id="base-url">Base URL: @api_server</div>
			</div>
			<div id="api-list"></div>
		`;

		const js = `
			const vscode = acquireVsCodeApi();
			let apiData = null;

			window.addEventListener('message', event => {
				const message = event.data;
				if (message.command === 'updateSchemaData' && message.schema === 'api') {
					apiData = message.data;
					updateUI();
				}
			});

			function updateUI() {
				if (!apiData) return;
				document.getElementById('title').textContent = (apiData.apiName || 'API') + " Endpoints";
				document.getElementById('base-url').textContent = "Base URL: " + (apiData.baseUrl || 'http://localhost:3000');

				const listEl = document.getElementById('api-list');
				listEl.innerHTML = '';

				(apiData.routes || []).forEach((route, idx) => {
					const item = document.createElement('div');
					item.className = 'route-item';
					item.id = 'route-' + idx;

					const handlerHtml = route.handler ? '<span class="handler-text" onclick="event.stopPropagation(); openHandler(\\'' + route.handler + '\\')">➔ ' + route.handler + '</span>' : '';

					item.innerHTML = [
						'<div class="route-header" onclick="toggleDetails(' + idx + ')">',
						'    <span class="method-badge method-' + route.method + '">' + route.method + '</span>',
						'    <span class="path-text">' + route.path + '</span>',
						'    ' + handlerHtml,
						'</div>',
						'<div class="route-details" id="details-' + idx + '">',
						'    <div class="details-grid">',
						'        <div class="grid-box">',
						'            <div class="box-title">Request Schema / Mock Data</div>',
						'            <textarea class="code-editor" id="req-body-' + idx + '">' + (route.request || '{}') + '</textarea>',
						'        </div>',
						'        <div class="grid-box">',
						'            <div class="box-title">Expected Response</div>',
						'            <pre style="margin:0; font-family:monospace; font-size:12px; color: #a5d6ff;">' + (route.response || '{}') + '</pre>',
						'        </div>',
						'    </div>',
						'    <button class="btn-send" onclick="sendRequest(' + idx + ')">Send Request</button>',
						'    <div class="response-box" id="res-box-' + idx + '">',
						'        <div class="response-status" id="res-status-' + idx + '">Status: 200 OK</div>',
						'        <pre class="response-body" id="res-body-' + idx + '">{}</pre>',
						'    </div>',
						'</div>'
					].join('\\n');

					listEl.appendChild(item);
				});
			}

			window.toggleDetails = function(idx) {
				const el = document.getElementById('details-' + idx);
				el.style.display = el.style.display === 'block' ? 'none' : 'block';
			};

			window.openHandler = function(handlerName) {
				const entityName = handlerName.split('.')[0];
				vscode.postMessage({
					command: 'openEntityFile',
					entityName: entityName
				});
			};

			// Tester Request Dispatcher
			window.sendRequest = async function(idx) {
				const route = apiData.routes[idx];
				const resBox = document.getElementById('res-box-' + idx);
				const resStatus = document.getElementById('res-status-' + idx);
				const resBody = document.getElementById('res-body-' + idx);

				resBox.style.display = 'block';
				resStatus.className = 'response-status';
				resStatus.textContent = 'Sending request...';
				resBody.textContent = '';

				const resolvedBaseUrl = apiData.baseUrl.startsWith('@') ? 'http://localhost:3000' : apiData.baseUrl;
				const fullUrl = resolvedBaseUrl + route.path;

				const reqBodyText = document.getElementById('req-body-' + idx).value;
				let reqBody = {};
				try {
					reqBody = JSON.parse(reqBodyText);
				} catch (e) {
					// Fallback to text if parsing fails
					reqBody = reqBodyText;
				}

				const options = {
					method: route.method,
					headers: {
						'Content-Type': 'application/json'
					}
				};

				if (route.method !== 'GET' && route.method !== 'HEAD') {
					options.body = typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody);
				}

				try {
					const res = await fetch(fullUrl, options);
					const text = await res.text();
					
					resStatus.className = 'response-status status-success';
					resStatus.textContent = 'Status: ' + res.status + ' ' + res.statusText;
					
					try {
						const json = JSON.parse(text);
						resBody.textContent = JSON.stringify(json, null, 2);
					} catch {
						resBody.textContent = text;
					}
				} catch (err) {
					resStatus.className = 'response-status status-error';
					resStatus.textContent = 'Request Failed';
					resBody.textContent = err.message + '\\n(Note: If sending requests to external server, make sure CORS is enabled.)';
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
