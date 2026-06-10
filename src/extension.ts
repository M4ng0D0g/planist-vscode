/**
 * ============================================================================
 * 模組定位：Planist 擴充套件啟動與生命週期主入口點 (src/extension.ts)
 * 
 * 此檔案為 VS Code 載入本擴充功能（extension）的引導引腳。它在擴充功能被啟動時，
 * 初始化各模組並向 VS Code 註冊命令（Commands）、代碼智慧功能提供者（Providers）及
 * 檔案系統事件監聽器。
 * 
 * 核心函數：
 * - activate: 主載入引腳，初始化 FlowIndexer、文字裝飾器並綁定所有 Command 和 Provider。
 * - deactivate: 主釋放引腳，釋放面板資源。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的擴充功能命令（如右上角快捷按鈕），請在此處的 `activate()` 內使用
 *    `vscode.commands.registerCommand` 進行註冊，並將回傳的 Disposable 放進 `subscriptions`。
 * 2. 此入口已被極簡化重構，具體業務邏輯均已被解耦至 `commands/`、`providers/`、`webview/` 等子樹目錄中。
 * ============================================================================
 */

import * as vscode from 'vscode';
import { LogManager } from './config/logger';
import { FLOW_LANGUAGE_ID } from './dsl/flowDsl';
import { FlowIndexer } from './indexing/flowIndexer';
import { initializePlanistWorkspace } from './indexing/workspaceManager';
import { CommandController } from './commands/commandController';
import { FlowCompletionItemProvider } from './providers/completionProvider';
import { FlowHoverProvider } from './providers/hoverProvider';
import { FlowLinter } from './providers/linterProvider';
import { FlowDefinitionProvider } from './providers/definitionProvider';
import { PlnSemanticTokensProvider } from './providers/semanticProvider';
import { PlnKeywordHighlighter } from './providers/highlighter';
import { FlowCodeActionProvider } from './providers/codeActionProvider';
import {
    getOrCreatePreviewPanel,
    togglePreviewMode,
    refreshPreview,
	refreshCurrentPreview
} from './preview/newFlowPreviewPanel';
import { PlanistEditorProvider } from './providers/PlanistEditorProvider';

/**
 * 驗證開啟的文件是否為 Planist 的合法流程圖檔案
 */
function isFlowDocument(document: vscode.TextDocument): boolean {
	if (document.languageId !== FLOW_LANGUAGE_ID || document.uri.scheme !== 'file') {
		return false;
	}
	return /^\s*#schema flow/.test(document.getText());
}

/**
 * VS Code 擴充功能啟動引腳
 */
export async function activate(context: vscode.ExtensionContext) {
	// [除錯日誌]
	LogManager.log('extension.activate: starting extension activation.');

	// [參數驗證]
	LogManager.assert(!!context, 'extension.activate: context cannot be null');

	// 1. 初始化全域記憶體語意索引器
	const indexer = new FlowIndexer();
	await indexer.initialize();

	// 2. 註冊 Custom Editor Provider
	const editorProvider = new PlanistEditorProvider(context, indexer);
	const customEditorRegistration = vscode.window.registerCustomEditorProvider(
		PlanistEditorProvider.viewType,
		editorProvider
	);

	const configureAppearance = vscode.commands.registerCommand('planist.configureAppearance', () => {
		void CommandController.handleConfigureAppearance();
	});

	const createFlowFile = vscode.commands.registerCommand('planist.createFlowFile', () => {
		void CommandController.handleCreateFlowFile();
	});

	const createDocsFile = vscode.commands.registerCommand('planist.createDocsFile', () => {
		void CommandController.handleCreateDocsFile();
	});

	const previewFlow = vscode.commands.registerCommand('planist-vscode.previewFlow', async () => {
		const panel = getOrCreatePreviewPanel(context, indexer);
		panel.reveal(vscode.ViewColumn.Beside, true);
		// 確保首次開啟立即載入資料
		await refreshPreview(panel);
	});

	const switchViewMode = vscode.commands.registerCommand('planist-vscode.switchViewMode', async () => {
		await togglePreviewMode();
	});

	const flowDefProvider = new FlowDefinitionProvider(indexer);
	const definitionProvider = vscode.languages.registerDefinitionProvider(
		{ language: FLOW_LANGUAGE_ID, scheme: 'file' },
		flowDefProvider,
	);

	const semanticProvider = new PlnSemanticTokensProvider();
	const tokenProvider = vscode.languages.registerDocumentSemanticTokensProvider(
		{ language: FLOW_LANGUAGE_ID, scheme: 'file' },
		semanticProvider,
		semanticProvider.legend
	);

	const highlighter = new PlnKeywordHighlighter();

	const triggerChars = [
		'>', '.', '-', ':', ' ', '+', '#', '"', "'", '/', '@',
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
	];

	const completionProvider = vscode.languages.registerCompletionItemProvider(
		{ language: FLOW_LANGUAGE_ID, scheme: 'file' },
		new FlowCompletionItemProvider(indexer),
		...triggerChars
	);

	const hoverProvider = vscode.languages.registerHoverProvider(
		{ language: FLOW_LANGUAGE_ID, scheme: 'file' },
		new FlowHoverProvider(indexer)
	);

	const codeActionProvider = vscode.languages.registerCodeActionsProvider(
		{ language: FLOW_LANGUAGE_ID, scheme: 'file' },
		new FlowCodeActionProvider(),
		{ providedCodeActionKinds: FlowCodeActionProvider.providedCodeActionKinds }
	);

	const linter = new FlowLinter(indexer);

	// 4. 註冊檔案開啟事件，若為 .pln 且帶有 #schema flow，自動初始化 .planist
	const openListener = vscode.workspace.onDidOpenTextDocument((document) => {
		if (isFlowDocument(document)) {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
			if (workspaceFolder) {
				void initializePlanistWorkspace(workspaceFolder.uri);
			}
		}
	});

	// 5. 註冊檔案儲存事件，儲存時自動更新高亮並重刷 Webview
	const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
		if (isFlowDocument(document)) {
			void refreshCurrentPreview();
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document === document) {
				highlighter.triggerHighlight(activeEditor);
			}
		}
	});

	// 5. 訂閱索引器變更，當檔案系統外部新增/刪除或實時輸入時，自動重刷畫布
	const indexerChangeListener = indexer.onDidChange(() => {
		void refreshCurrentPreview();
	});

	const fileChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
		void refreshCurrentPreview();
	});

	const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('planist')) {
			void refreshCurrentPreview();
		}
	});

	const themeChangeListener = vscode.window.onDidChangeActiveColorTheme(() => {
		void refreshCurrentPreview();
	});

	const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor && isFlowDocument(editor.document)) {
			void refreshCurrentPreview();
		}
	});

	// 6. 將所有 Disposable 加入擴充生命週期管理
	context.subscriptions.push(
		indexer,
		customEditorRegistration,
		configureAppearance,
		createFlowFile,
		createDocsFile,
		previewFlow,
		switchViewMode,
		flowDefProvider,
		definitionProvider,
		tokenProvider,
		highlighter,
		completionProvider,
		hoverProvider,
		codeActionProvider,
		linter,
		openListener,
		saveListener,
		indexerChangeListener,
		fileChangeListener,
		configChangeListener,
		themeChangeListener,
		activeEditorListener,
	);
}

/**
 * VS Code 擴充功能銷毀引腳
 */
export function deactivate() {
	// 擴充關閉時銷毀面板與記憶體
}
