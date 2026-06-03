import * as vscode from 'vscode';
import { WebviewPage } from '../core/WebviewPage';

export interface ISchemaRenderer {
	renderPage(webview: vscode.Webview, nonce: string): WebviewPage;
}
