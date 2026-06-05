import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';
import { TaskSchemaJS } from './TaskSchemaJS';

export class TaskSchemaRenderer implements ISchemaRenderer {
	public renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist Task Board');

		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">`);

		page.addStyle(`
			body { margin: 0; padding: 20px; background-color: #1e1e1e; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
			#header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #3c3c3c; padding-bottom: 10px; }
			#board-title { font-size: 20px; font-weight: bold; color: #007acc; }
			#board { display: flex; gap: 20px; flex: 1; overflow-y: hidden; overflow-x: auto; align-items: stretch; }
			.column { flex: 1; min-width: 250px; background-color: #252526; border-radius: 6px; border: 1px solid #3c3c3c; display: flex; flex-direction: column; padding: 12px; box-sizing: border-box; }
			.column-header { font-size: 13px; font-weight: bold; color: #858585; text-transform: uppercase; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
			.column-count { background: #3c3c3c; padding: 2px 6px; border-radius: 10px; font-size: 11px; color: #ccc; }
			.cards-list { flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; min-height: 100px; padding-bottom: 20px; }
			.card { background-color: #2d2d2d; border: 1px solid #3c3c3c; border-radius: 4px; padding: 12px; font-size: 13px; cursor: grab; user-select: none; box-shadow: 0 2px 5px rgba(0,0,0,0.15); transition: border-color 0.2s, box-shadow 0.2s; }
			.card:hover { border-color: #007acc; box-shadow: 0 4px 10px rgba(0,0,0,0.25); }
			.card:active { cursor: grabbing; opacity: 0.8; }
			.card-link { font-size: 11px; color: #007acc; margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; text-decoration: none; font-weight: bold; }
			.card-link:hover { text-decoration: underline; color: #0098ff; }
			.drag-over { background-color: #2d2d2d; border: 1px dashed #007acc; }
		`);

		const html = `
			<div id="header">
				<div id="board-title">Sprint Kanban Board</div>
				<div style="font-size: 12px; color: #858585;">Planist Agile Mode</div>
			</div>
			<div id="board">
				<div class="column" id="col-todo" ondragover="allowDrop(event)" ondragleave="dragLeave('todo')" ondrop="drop(event, 'todo')">
					<div class="column-header">
						<span>Todo</span>
						<span class="column-count" id="count-todo">0</span>
					</div>
					<div class="cards-list" id="list-todo"></div>
				</div>

				<div class="column" id="col-in_progress" ondragover="allowDrop(event)" ondragleave="dragLeave('in_progress')" ondrop="drop(event, 'in_progress')">
					<div class="column-header">
						<span>In Progress</span>
						<span class="column-count" id="count-in_progress">0</span>
					</div>
					<div class="cards-list" id="list-in_progress"></div>
				</div>

				<div class="column" id="col-done" ondragover="allowDrop(event)" ondragleave="dragLeave('done')" ondrop="drop(event, 'done')">
					<div class="column-header">
						<span>Done</span>
						<span class="column-count" id="count-done">0</span>
					</div>
					<div class="cards-list" id="list-done"></div>
				</div>
			</div>
		`;

		page.addChild(new RawHtmlComponent(html));
		page.addInlineScript(TaskSchemaJS, nonce);
		return page;
	}
}
