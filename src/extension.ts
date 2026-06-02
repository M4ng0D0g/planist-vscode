import * as path from 'path';
import * as vscode from 'vscode';
import { CommandController } from './commandController';
import {
	FLOW_LANGUAGE_ID,
	buildFlowGraphModel,
	findEntityDeclarationLine,
	findReferenceAtPosition,
	getFlowFileName,
} from './flowDsl';
import {
	loadPlanistConfig,
	resolveEntityStyle,
} from './planistConfig';

let currentPreviewPanel: vscode.WebviewPanel | undefined;
let currentViewMode: FlowViewMode = 'general';

type FlowViewMode = 'general' | 'callchain' | 'relation';

function nextViewMode(mode: FlowViewMode): FlowViewMode {
	if (mode === 'general') {
		return 'callchain';
	}

	if (mode === 'callchain') {
		return 'relation';
	}

	return 'general';
}

function isFlowViewMode(value: unknown): value is FlowViewMode {
	return value === 'general' || value === 'callchain' || value === 'relation';
}

export function activate(context: vscode.ExtensionContext) {
	const helloWorld = vscode.commands.registerCommand('planist-vscode.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from planist_vscode!');
	});

	const createFlow = vscode.commands.registerCommand('planist.createFlow', () => {
		void CommandController.handleCreateFlow();
	});

	const configureAppearance = vscode.commands.registerCommand('planist.configureAppearance', () => {
		void CommandController.handleConfigureAppearance();
	});

	const previewFlow = vscode.commands.registerCommand('planist-vscode.previewFlow', async () => {
		const panel = getOrCreatePreviewPanel(context);
		panel.reveal(vscode.ViewColumn.Beside, true);
		await refreshPreview(panel);
	});

	const switchViewMode = vscode.commands.registerCommand('planist-vscode.switchViewMode', async () => {
		currentViewMode = nextViewMode(currentViewMode);
		await refreshCurrentPreview();
	});

	const definitionProvider = vscode.languages.registerDefinitionProvider(
		{ language: FLOW_LANGUAGE_ID, scheme: 'file' },
		new FlowDefinitionProvider(),
	);

	const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
		if (isFlowDocument(document)) {
			void refreshCurrentPreview();
		}
	});

	const fileChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
		void refreshCurrentPreview();
	});

	context.subscriptions.push(
		helloWorld,
		createFlow,
		configureAppearance,
		previewFlow,
		switchViewMode,
		definitionProvider,
		saveListener,
		fileChangeListener,
	);
}

export function deactivate() {
	currentPreviewPanel?.dispose();
	currentPreviewPanel = undefined;
}

class FlowDefinitionProvider implements vscode.DefinitionProvider {
	public async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
	): Promise<vscode.Definition | vscode.DefinitionLink[] | undefined> {
		const reference = findReferenceAtPosition(document.getText(), position.line, position.character);
		if (!reference) {
			return undefined;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!workspaceFolder) {
			return undefined;
		}

		const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, getFlowFileName(reference.targetName));
		await ensureFlowFileExists(targetUri, reference.targetName);

		const targetDocument = await vscode.workspace.openTextDocument(targetUri);
		const targetLine = findEntityDeclarationLine(targetDocument.getText(), reference.targetName);
		const range = targetLine !== undefined
			? new vscode.Range(targetLine, 0, targetLine, targetDocument.lineAt(targetLine).text.length)
			: new vscode.Range(0, 0, 0, targetDocument.lineAt(0).text.length);

		return new vscode.Location(targetUri, range);
	}
}

function isFlowDocument(document: vscode.TextDocument): boolean {
	return document.languageId === FLOW_LANGUAGE_ID && document.uri.scheme === 'file';
}

function getOrCreatePreviewPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
	if (currentPreviewPanel) {
		return currentPreviewPanel;
	}

	currentPreviewPanel = vscode.window.createWebviewPanel(
		'flowPreview',
		'Flow Preview',
		vscode.ViewColumn.Beside,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
		},
	);

	currentPreviewPanel.webview.html = getWebviewContent(currentPreviewPanel.webview);
	currentPreviewPanel.onDidDispose(() => {
		currentPreviewPanel = undefined;
	});
	currentPreviewPanel.webview.onDidReceiveMessage((message) => {
		if (message?.command === 'ready') {
			if (currentPreviewPanel) {
				void refreshPreview(currentPreviewPanel);
			}
			return;
		}

		if (message?.command === 'setViewMode' && isFlowViewMode(message.mode)) {
			currentViewMode = message.mode;
			if (currentPreviewPanel) {
				void refreshPreview(currentPreviewPanel);
			}
			return;
		}

		if (message?.command === 'openEntityFile' && typeof message.entityName === 'string') {
			void openEntityFile(message.entityName);
		}
	});

	context.subscriptions.push(currentPreviewPanel);
	return currentPreviewPanel;
}

async function refreshCurrentPreview(): Promise<void> {
	if (currentPreviewPanel) {
		await refreshPreview(currentPreviewPanel);
	}
}

async function refreshPreview(panel: vscode.WebviewPanel): Promise<void> {
	const [graph, config] = await Promise.all([
		collectWorkspaceFlowGraph(),
		loadPlanistConfig(),
	]);
	const entitiesWithStyles = graph.entities.map((entity) => ({
		...entity,
		renderStyle: resolveEntityStyle(entity, config),
	}));
	await panel.webview.postMessage({
		command: 'updateGraph',
		data: {
			entities: entitiesWithStyles,
		},
		appearance: config.appearance,
		mode: currentViewMode,
	});
}

async function collectWorkspaceFlowGraph(): Promise<ReturnType<typeof buildFlowGraphModel>> {
	const [planFiles, legacyFlowFiles] = await Promise.all([
		vscode.workspace.findFiles('**/*.plan', '**/node_modules/**'),
		vscode.workspace.findFiles('**/*.flow', '**/node_modules/**'),
	]);
	const flowFiles = [...planFiles, ...legacyFlowFiles];
	const fileContents: Array<{ fileName: string; text: string }> = [];

	for (const file of flowFiles) {
		const data = await vscode.workspace.fs.readFile(file);
		fileContents.push({
			fileName: path.basename(file.fsPath),
			text: Buffer.from(data).toString('utf8'),
		});
	}

	return buildFlowGraphModel(fileContents);
}

async function openEntityFile(entityName: string): Promise<void> {
	const [planMatches, legacyMatches] = await Promise.all([
		vscode.workspace.findFiles(`**/${entityName}.plan`, '**/node_modules/**'),
		vscode.workspace.findFiles(`**/${entityName}.flow`, '**/node_modules/**'),
	]);
	const matchingFiles = [...planMatches, ...legacyMatches];
	const targetUri = matchingFiles.find((file) => path.basename(file.fsPath) === getFlowFileName(entityName));

	if (!targetUri) {
		vscode.window.showErrorMessage(`找不到實體檔案: ${entityName}.plan`);
		return;
	}

	const document = await vscode.workspace.openTextDocument(targetUri);
	await vscode.window.showTextDocument(document, {
		viewColumn: vscode.ViewColumn.One,
		preview: false,
	});
}

async function ensureFlowFileExists(uri: vscode.Uri, entityName: string): Promise<void> {
	try {
		await vscode.workspace.fs.stat(uri);
	} catch {
		const initialContent = `entity ${entityName}\n`;
		await vscode.workspace.fs.writeFile(uri, Buffer.from(initialContent, 'utf8'));
	}
}

function getWebviewContent(webview: vscode.Webview): string {
	const nonce = getNonce();

	return `
		<!DOCTYPE html>
		<html lang="zh-TW">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<style>
				body { margin: 0; overflow: hidden; background-color: #1a1a1a; color: #eee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
				#cy { width: 100vw; height: 100vh; display: block; }
				#toolbar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; align-items: center; }
				.btn { background: #333; color: white; border: 1px solid #555; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
				.btn:hover { background: #444; }
				.badge { font-size: 12px; color: #888; }
			</style>
			<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
			<script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
			<script src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>
		</head>
		<body>
			<div id="toolbar">
				<button class="btn" onclick="cycleMode()">切換模式</button>
				<button class="btn" onclick="setMode('general')">一般模式</button>
				<button class="btn" onclick="setMode('callchain')">呼叫鏈</button>
				<button class="btn" onclick="setMode('relation')">類別關係</button>
				<button class="btn" onclick="fitGraph()">自動縮放</button>
				<div class="badge" id="modeBadge">一般模式</div>
			</div>
			<div id="cy"></div>

			<script nonce="${nonce}">
				const vscode = acquireVsCodeApi();
				let cy = null;
				let currentMode = 'general';
				let rawGraphData = null;
				let appearance = null;
				vscode.postMessage({ command: 'ready' });

				function ensureCy() {
					if (cy) {
						return cy;
					}

					if (typeof cytoscape === 'undefined') {
						return null;
					}

					if (typeof cytoscapeDagre !== 'undefined') {
						cytoscape.use(cytoscapeDagre);
					}

					cy = cytoscape({
						container: document.getElementById('cy'),
						style: [
							{
								selector: 'node',
								style: {
									'background-color': 'data(fillColor)',
									'label': 'data(label)',
									'color': '#fff',
									'text-valign': 'center',
									'text-halign': 'center',
									'font-size': '12px',
									'width': '120px',
									'height': '40px',
									'shape': 'round-rectangle',
									'border-width': 2,
									'border-color': 'data(borderColor)',
									'corner-radius': 'data(radius)'
								}
							},
							{
								selector: 'edge',
								style: {
									'width': 2,
									'line-color': '#555',
									'target-arrow-color': '#555',
									'target-arrow-shape': 'triangle',
									'curve-style': 'bezier',
									'arrow-scale': 1.2
								}
							}
						],
						layout: { name: 'dagre' }
					});

					cy.on('dblclick', 'node', function(evt) {
						const entityName = evt.target.id();
						vscode.postMessage({
							command: 'openEntityFile',
							entityName,
						});
					});

					return cy;
				}

				function cycleMode() {
					const nextMode = currentMode === 'general' ? 'callchain' : currentMode === 'callchain' ? 'relation' : 'general';
					setMode(nextMode);
				}

				function setMode(mode) {
					vscode.postMessage({ command: 'setViewMode', mode });
				}

				function fitGraph() {
					if (cy) {
						cy.fit();
					}
				}

				function refreshGraphVisuals() {
					if (!cy) {
						return;
					}

					cy.style().update();
				}

				function applyAppearance(nextAppearance) {
					appearance = nextAppearance;
					if (!appearance) {
						return;
					}

					document.body.style.backgroundColor = appearance.backgroundColor;
					if (appearance.backgroundPattern === 'dots') {
						document.body.style.backgroundImage = 'radial-gradient(circle, ' + appearance.dots.color + ' ' + appearance.dots.size + 'px, transparent ' + appearance.dots.size + 'px)';
						document.body.style.backgroundSize = appearance.dots.spacing + 'px ' + appearance.dots.spacing + 'px';
						document.body.style.backgroundRepeat = 'repeat';
					} else if (appearance.backgroundPattern === 'grid') {
						document.body.style.backgroundImage = [
							'repeating-linear-gradient(0deg, transparent 0, transparent ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + appearance.grid.minorSpacing + 'px)',
							'repeating-linear-gradient(90deg, transparent 0, transparent ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + appearance.grid.minorSpacing + 'px)',
							'repeating-linear-gradient(0deg, transparent 0, transparent ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + appearance.grid.majorSpacing + 'px)',
							'repeating-linear-gradient(90deg, transparent 0, transparent ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + appearance.grid.majorSpacing + 'px)'
						].join(', ');
						document.body.style.backgroundSize = 'auto';
						document.body.style.backgroundRepeat = 'repeat';
					} else {
						document.body.style.backgroundImage = 'none';
					}
				}

				function updateModeBadge() {
					const badge = document.getElementById('modeBadge');
					if (badge) {
						badge.textContent = currentMode === 'general' ? '一般模式' : currentMode === 'callchain' ? '呼叫鏈模式' : '類別關係模式';
					}
				}

				function renderByMode() {
					if (!cy || !rawGraphData) {
						return;
					}

					const elements = currentMode === 'callchain'
						? transformToCallChainElements(rawGraphData)
						: currentMode === 'relation'
							? transformToRelationElements(rawGraphData)
							: transformToGeneralElements(rawGraphData);

					cy.elements().remove();
					cy.add(elements);
					applyLayout(currentMode);
					cy.fit();
					updateModeBadge();
				}

				function buildStyleLookup(data) {
					const lookup = new Map();
					for (const entity of data.entities) {
						lookup.set(entity.name, entity.renderStyle);
					}

					return lookup;
				}

				function getEntityRenderStyle(data, entityName) {
					const lookup = buildStyleLookup(data);
					return lookup.get(entityName) ?? { color: '#007acc', borderColor: '#005a9e', radius: 14 };
				}

				function applyLayout(mode) {
					const direction = mode === 'callchain' ? 'LR' : 'TB';
					cy.layout({
						name: 'dagre',
						nodeSep: 50,
						rankSep: 100,
						rankDir: direction,
					}).run();
				}

				function transformToGeneralElements(data) {
					const nodes = data.entities.map(entity => {
						const renderStyle = getEntityRenderStyle(data, entity.name);
						return { data: { id: 'entity:' + entity.name, label: entity.name, entityName: entity.name, type: 'entity', fillColor: renderStyle.color, borderColor: renderStyle.borderColor, radius: renderStyle.radius } };
					});
					const edges = [];
					for (const entity of data.entities) {
						for (const reference of entity.references) {
							edges.push({ data: { id: 'ref:' + entity.name + ':' + reference.targetName, source: 'entity:' + entity.name, target: 'entity:' + reference.targetName, relationType: 'reference' } });
						}
						for (const target of entity.relationTargets) {
							edges.push({ data: { id: 'rel:' + entity.name + ':' + target, source: 'entity:' + entity.name, target: 'entity:' + target, relationType: 'relation' } });
						}
						for (const target of entity.extendsTargets) {
							edges.push({ data: { id: 'ext:' + entity.name + ':' + target, source: 'entity:' + entity.name, target: 'entity:' + target, relationType: 'extends' } });
						}
						for (const target of entity.implementsTargets) {
							edges.push({ data: { id: 'impl:' + entity.name + ':' + target, source: 'entity:' + entity.name, target: 'entity:' + target, relationType: 'implements' } });
						}
					}
					return [...nodes, ...edges];
				}

				function transformToCallChainElements(data) {
					const elements = [];
					const knownNodes = new Set();
					for (const entity of data.entities) {
						const renderStyle = getEntityRenderStyle(data, entity.name);
						for (const method of entity.methods) {
							const methodId = 'method:' + entity.name + '.' + method.name;
							knownNodes.add(methodId);
							elements.push({ data: { id: methodId, label: entity.name + '.' + method.name + '(' + method.parameters.join(', ') + ')', entityName: entity.name, methodName: method.name, type: 'method', fillColor: renderStyle.color, borderColor: renderStyle.borderColor, radius: renderStyle.radius } });
						}
					}

					for (const entity of data.entities) {
						const renderStyle = getEntityRenderStyle(data, entity.name);
						for (const method of entity.methods) {
							const sourceId = 'method:' + entity.name + '.' + method.name;
							for (const call of method.callsTo) {
								const targetId = call.targetMethodName ? 'method:' + call.targetName + '.' + call.targetMethodName : 'entity:' + call.targetName;
								if (!knownNodes.has(targetId)) {
									knownNodes.add(targetId);
									elements.push({ data: { id: targetId, label: call.targetMethodName ? call.targetName + '.' + call.targetMethodName + '(...)' : call.targetName, entityName: call.targetName, methodName: call.targetMethodName, type: call.targetMethodName ? 'method' : 'entity', fillColor: renderStyle.color, borderColor: renderStyle.borderColor, radius: renderStyle.radius } });
								}
								elements.push({ data: { id: 'call:' + sourceId + ':' + targetId, source: sourceId, target: targetId, relationType: 'call' } });
							}
						}
					}

					return elements;
				}

				function transformToRelationElements(data) {
					const elements = [];
					for (const entity of data.entities) {
						const renderStyle = getEntityRenderStyle(data, entity.name);
						elements.push({ data: { id: 'entity:' + entity.name, label: entity.name, entityName: entity.name, type: 'entity', fillColor: renderStyle.color, borderColor: renderStyle.borderColor, radius: renderStyle.radius } });
						for (const target of entity.relationTargets) {
							elements.push({ data: { id: 'relation:' + entity.name + ':' + target, source: 'entity:' + entity.name, target: 'entity:' + target, relationType: 'relation' } });
						}
						for (const target of entity.extendsTargets) {
							elements.push({ data: { id: 'extends:' + entity.name + ':' + target, source: 'entity:' + entity.name, target: 'entity:' + target, relationType: 'extends' } });
						}
						for (const target of entity.implementsTargets) {
							elements.push({ data: { id: 'implements:' + entity.name + ':' + target, source: 'entity:' + entity.name, target: 'entity:' + target, relationType: 'implements' } });
						}
					}
					return elements;
				}

				window.addEventListener('message', event => {
					const message = event.data;
					if (message.command !== 'updateGraph') {
						return;
					}

					const graph = ensureCy();
					if (!graph) {
						return;
					}

					applyAppearance(message.appearance);
					rawGraphData = message.data;
					if (message.mode) {
						currentMode = message.mode;
					}
					renderByMode();
					refreshGraphVisuals();
				});
			</script>
		</body>
		</html>
	`;
}

function getNonce(): string {
	return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}
