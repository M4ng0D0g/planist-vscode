import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { resolveShortcutPath } from '../utils/shortcutResolver';
import { FlowIndexer, IndexedEntity } from '../indexing/flowIndexer';
import {
	FLOW_LANGUAGE_ID,
	buildFlowGraphModel,
	findEntityDeclarationLine,
	findMethodDeclarationLine,
	FlowGraphModel,
	FlowGraphEntity,
} from '../dsl/flowDsl';
import { loadPlanistConfig, resolveEntityStyle } from '../config/planistConfig';
import { PatternManager } from '../config/patternManager';
import { RendererFactory } from './ui/schemas/RendererFactory';

let currentPreviewPanel: vscode.WebviewPanel | undefined;
let currentViewMode: FlowViewMode = 'general';
let currentIndexer: FlowIndexer | undefined;

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

function detectSchema(document?: vscode.TextDocument): string {
	if (!document) return 'flow';
	const text = document.getText();
	if (/^\s*#schema flow/.test(text)) {
		return 'flow';
	}
	return 'flow'; // fallback for now
}

export function getOrCreatePreviewPanel(context: vscode.ExtensionContext, indexer: FlowIndexer): vscode.WebviewPanel {
	currentIndexer = indexer;

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

	const activeDocument = vscode.window.activeTextEditor?.document;
	const schema = detectSchema(activeDocument);
	const renderer = RendererFactory.getRenderer(schema);
	currentPreviewPanel.webview.html = renderer.renderPage(currentPreviewPanel.webview, getNonce()).render();
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

export async function togglePreviewMode(): Promise<void> {
	currentViewMode = nextViewMode(currentViewMode);
	await refreshCurrentPreview();
}

export async function refreshCurrentPreview(): Promise<void> {
	if (currentPreviewPanel) {
		await refreshPreview(currentPreviewPanel);
	}
}

async function buildCompiledGraph(): Promise<FlowGraphModel> {
	const [plnFiles, planFiles, legacyFlowFiles] = await Promise.all([
		vscode.workspace.findFiles('**/*.pln', '**/node_modules/**'),
		vscode.workspace.findFiles('**/*.plan', '**/node_modules/**'),
		vscode.workspace.findFiles('**/*.flow', '**/node_modules/**'),
	]);
	const flowFiles = [...plnFiles, ...planFiles, ...legacyFlowFiles];
	const fileContents: Array<{ fileName: string; text: string; uri?: vscode.Uri }> = [];

	for (const file of flowFiles) {
		const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === file.toString());
		if (openDoc) {
			fileContents.push({
				fileName: path.basename(file.fsPath),
				text: openDoc.getText(),
				uri: file,
			});
		} else {
			const data = await vscode.workspace.fs.readFile(file);
			fileContents.push({
				fileName: path.basename(file.fsPath),
				text: Buffer.from(data).toString('utf8'),
				uri: file,
			});
		}
	}

	return buildFlowGraphModel(
		fileContents,
		(p, docUri) => resolveShortcutPath(p, docUri),
		(p) => {
			try {
				if (fs.existsSync(p)) {
					return fs.readFileSync(p, 'utf8');
				}
			} catch (e) {
				console.error("Failed to read referenced file:", p, e);
			}
			return undefined;
		}
	);
}

export async function refreshPreview(panel: vscode.WebviewPanel): Promise<void> {
	if (!currentIndexer) {
		return;
	}
	const config = await loadPlanistConfig();
	
	// 1. Build the fully compiled workspace graph model (resolving binds and packages)
	const graph = await buildCompiledGraph();
	const allEntities = graph.entities;

	// 2. Find the starting entity
	let startEntity: FlowGraphEntity | undefined;
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		const docUri = activeEditor.document.uri;
		const indexed = currentIndexer.getEntityByUri(docUri);
		if (indexed) {
			startEntity = allEntities.find(e => e.name === indexed.entityName);
		}
		if (!startEntity) {
			const text = activeEditor.document.getText();
			const headerRegex = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\s+([A-Za-z_][\w-]*)\b/i;
			const match = text.match(headerRegex);
			if (match) {
				startEntity = allEntities.find(e => e.name === match[2]);
			}
		}
	}

	if (!startEntity && allEntities.length > 0) {
		startEntity = allEntities[0];
	}

	const entityMap = new Map<string, FlowGraphEntity>();
	for (const e of allEntities) {
		entityMap.set(e.name, e);
	}

	const visited = new Set<string>();
	const reachableEntities = new Map<string, FlowGraphEntity>();

	function getEntityAllTargets(entity: FlowGraphEntity): string[] {
		const targets = new Set<string>();
		if (entity.relationTargets) { entity.relationTargets.forEach(t => targets.add(t)); }
		if (entity.extendsTargets) { entity.extendsTargets.forEach(t => targets.add(t)); }
		if (entity.implementsTargets) { entity.implementsTargets.forEach(t => targets.add(t)); }
		if (entity.inheritsTargets) { entity.inheritsTargets.forEach(t => targets.add(t)); }
		if (entity.associatesTargets) { entity.associatesTargets.forEach(t => targets.add(t)); }
		if (entity.aggregatesTargets) { entity.aggregatesTargets.forEach(t => targets.add(t)); }
		if (entity.composesTargets) { entity.composesTargets.forEach(t => targets.add(t)); }
		if (entity.dependsOnTargets) { entity.dependsOnTargets.forEach(t => targets.add(t)); }
		
		if (entity.methods) {
			for (const m of entity.methods) {
				if (m.callsTo) {
					for (const call of m.callsTo) {
						targets.add(call.targetName);
					}
				}
			}
		}
		return Array.from(targets);
	}

	function traverse(entityName: string) {
		if (visited.has(entityName)) {
			return;
		}
		visited.add(entityName);
		const entity = entityMap.get(entityName);
		if (entity) {
			reachableEntities.set(entityName, entity);
			// For micro rendering of compound nodes, we also include the parent package if it exists
			if (entity.parent) {
				const parentPkg = entityMap.get(entity.parent);
				if (parentPkg) {
					reachableEntities.set(entity.parent, parentPkg);
				}
			}
			const targets = getEntityAllTargets(entity);
			for (const t of targets) {
				traverse(t);
			}
		}
	}

	let graphEntities: any[] = [];
	if (startEntity && (startEntity.kind === 'package' || startEntity.kind === 'module')) {
		// Focused/Isolated View: only include this package and its descendants
		const packageChildren = allEntities.filter(e => e.parent === startEntity!.name || e.name === startEntity!.name);
		graphEntities = packageChildren.map(e => mapGraphEntity(e, config));
	} else {
		// General View: Traverse reachability from the active file
		if (startEntity) {
			traverse(startEntity.name);
		}
		graphEntities = Array.from(reachableEntities.values()).map(e => mapGraphEntity(e, config));
	}

	const patterns = PatternManager.loadPatterns();

	function mapGraphEntity(e: FlowGraphEntity, config: any) {
		const patternStyle = e.pattern ? patterns[e.pattern]?.webview_style : undefined;
		return {
			name: e.name,
			kind: e.kind,
			pattern: e.pattern,
			patternStyle: patternStyle,
			display: e.display,
			contains: e.contains,
			parent: e.parent,
			methods: e.methods.map((m: any) => ({
				name: m.name,
				parameters: m.parameters,
				callsTo: m.callsTo || []
			})),
			references: e.references || [],
			relationTargets: e.relationTargets || [],
			extendsTargets: e.extendsTargets || [],
			implementsTargets: e.implementsTargets || [],
			inheritsTargets: e.inheritsTargets || [],
			associatesTargets: e.associatesTargets || [],
			aggregatesTargets: e.aggregatesTargets || [],
			composesTargets: e.composesTargets || [],
			dependsOnTargets: e.dependsOnTargets || [],
			renderStyle: resolveEntityStyle(e, config),
		};
	}

	await panel.webview.postMessage({
		command: 'updateGraph',
		data: {
			entities: graphEntities,
		},
		appearance: config.appearance,
		mode: currentViewMode,
	});
}

async function openEntityFile(entityName: string): Promise<void> {
	if (!currentIndexer) {
		return;
	}
	const entity = currentIndexer.getEntity(entityName);
	
	if (!entity) {
		vscode.window.showErrorMessage(`找不到實體 ${entityName}`);
		return;
	}

	const document = await vscode.workspace.openTextDocument(entity.uri);
	await vscode.window.showTextDocument(document, {
		viewColumn: vscode.ViewColumn.One,
		preview: false,
	});
}

export function getNonce(): string {
	return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

