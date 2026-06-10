/**
 * ============================================================================
 * 模組定位：Planist 全域實體關係與語法索引器 (src/indexing/flowIndexer.ts)
 * 
 * 此檔案負責在記憶體中建立、維護工作空間中所有實體（Entity）、欄位與方法的索引資料包。
 * 透過監聽檔案系統事件（create/change/delete）與編輯器文件即時變更事件，
 * 提供實時的智慧語法分析基礎資料。
 * 
 * 重要類別與介面：
 * - IndexedMethod: 欄位語意解析。
 * - IndexedEntity: 實體緩存結構。
 * - FlowIndexer: 索引控制器，繼承自 vscode.Disposable。
 * 
 * 擴充與修改指引：
 * 1. 若要修改索引的快取細節，請在 `IndexedEntity` 增加欄位，並於 `indexContent()` 內解析補齊。
 * 2. 任何實體變更觸發的下游反應，皆可透過註冊 `onDidChange` 事件進行訂閱。
 * ============================================================================
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import {
	parseFlowDocuments,
	FlowFieldDefinition,
	FlowMethodCall,
	parseExternalClass,
	FlowMethodDefinition
} from '../dsl/flowDsl';
import { resolveShortcutPath } from '../utils/shortcutResolver';

export interface IndexedMethod {
	name: string;
	parameters: string[];
	line: number;
	accessModifier?: string | null;
	modifiers?: string[];
	returnType?: string | null;
	callsTo?: FlowMethodCall[];
}

export interface IndexedEntity {
	uri: vscode.Uri;
	entityName: string;
	kind: string | null;
	accessModifier?: string | null;
	methods: IndexedMethod[];
	rawText: string;
	fields?: FlowFieldDefinition[];
	referenceFiles?: string[];
	relationTargets?: string[];
	extendsTargets?: string[];
	implementsTargets?: string[];
	inheritsTargets?: string[];
	associatesTargets?: string[];
	aggregatesTargets?: string[];
	composesTargets?: string[];
	dependsOnTargets?: string[];
	display?: string;
	contains?: string[];
	parent?: string;
	startLine?: number;
	endLine?: number;
}

export class FlowIndexer implements vscode.Disposable {
	private entities = new Map<string, IndexedEntity>();
	private fileToEntities = new Map<string, string[]>(); // 記錄檔案路徑到多個實體名稱的映射，以便快速清理
	private disposables: vscode.Disposable[] = [];

	private _onDidChange = new vscode.EventEmitter<void>();
	public readonly onDidChange = this._onDidChange.event;

	constructor() {}

	/**
	 * 初始化索引器，掃描工作空間所有合法檔案並啟動即時檔案監聽
	 */
	public async initialize(): Promise<void> {
		// 掃描工作空間內的所有 Planist 檔案
		const [plnFiles, planFiles, legacyFiles] = await Promise.all([
			vscode.workspace.findFiles('**/*.pln', '**/node_modules/**'),
			vscode.workspace.findFiles('**/*.plan', '**/node_modules/**'),
			vscode.workspace.findFiles('**/*.flow', '**/node_modules/**'),
		]);

		const allFiles = [...plnFiles, ...planFiles, ...legacyFiles];
		for (const file of allFiles) {
			await this.indexFile(file);
		}

		// 註冊檔案系統監聽器以捕捉外部變更
		const watcher = vscode.workspace.createFileSystemWatcher('**/*.{pln,plan,flow}', false, false, false);
		this.disposables.push(
			watcher.onDidCreate(async (uri) => {
				await this.indexFile(uri);
				this._onDidChange.fire();
			}),
			watcher.onDidChange(async (uri) => {
				await this.indexFile(uri);
				this._onDidChange.fire();
			}),
			watcher.onDidDelete((uri) => {
				this.removeFile(uri);
				this._onDidChange.fire();
			})
		);
		this.disposables.push(watcher);

		// 監聽當前開啟編輯器的即時輸入變更（支援未存檔實時渲染）
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (this.isPlanFile(event.document.uri)) {
					this.indexTextDocument(event.document);
					this._onDidChange.fire();
				}
			})
		);

		// 監聽一般程式語言檔案存檔事件，若有 reference 參考則觸發重繪
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument((document) => {
				if (!this.isPlanFile(document.uri)) {
					const savedPath = document.uri.fsPath;
					let matched = false;
					for (const entity of this.entities.values()) {
						if (entity.referenceFiles && entity.referenceFiles.length > 0) {
							for (const refPath of entity.referenceFiles) {
								const resolvedRef = resolveShortcutPath(refPath, entity.uri);
								if (path.normalize(resolvedRef) === path.normalize(savedPath)) {
									matched = true;
									break;
								}
							}
						}
						if (matched) {
							break;
						}
					}
					if (matched) {
						this._onDidChange.fire();
					}
				}
			})
		);
	}

	public getEntities(): IndexedEntity[] {
		return Array.from(this.entities.values());
	}

	public getEntity(name: string): IndexedEntity | undefined {
		return this.entities.get(name);
	}

	public getEntityByUri(uri: vscode.Uri): IndexedEntity | undefined {
		const filePath = uri.fsPath;
		const entityNames = this.fileToEntities.get(filePath);
		if (entityNames && entityNames.length > 0) {
			return this.entities.get(entityNames[0]);
		}
		return undefined;
	}

	public getEntitiesByUri(uri: vscode.Uri): IndexedEntity[] {
		const filePath = uri.fsPath;
		const entityNames = this.fileToEntities.get(filePath) || [];
		return entityNames.map(name => this.entities.get(name)).filter(Boolean) as IndexedEntity[];
	}

	private async indexFile(uri: vscode.Uri): Promise<void> {
		// [除錯日誌] 紀錄輸入參數
		LogManager.log('FlowIndexer: indexFile called with URI:', uri.fsPath);

		// [參數驗證]
		LogManager.assert(uri instanceof vscode.Uri, 'FlowIndexer.indexFile: uri parameter must be vscode.Uri');

		try {
			const data = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(data).toString('utf8');
			this.indexContent(uri, text);
		} catch (err) {
			LogManager.error(`FlowIndexer: Failed to index file at path ${uri.fsPath}`, err);
		}
	}

	private indexTextDocument(document: vscode.TextDocument): void {
		// [除錯日誌] 紀錄輸入參數
		LogManager.log('FlowIndexer: indexTextDocument called for Document URI:', document.uri.fsPath);

		// [參數驗證]
		LogManager.assert(!!document, 'FlowIndexer.indexTextDocument: document cannot be null/undefined');

		this.indexContent(document.uri, document.getText());
	}

	private indexContent(uri: vscode.Uri, text: string): void {
		// [除錯日誌] 紀錄輸入參數及文字長度
		LogManager.log('FlowIndexer: indexContent starting. Uri:', uri.fsPath, 'length:', text ? text.length : 0);

		// [參數驗證]
		LogManager.assert(uri instanceof vscode.Uri, 'FlowIndexer.indexContent: uri must be vscode.Uri');
		LogManager.assert(typeof text === 'string', 'FlowIndexer.indexContent: text must be string');

		if (!/^\s*#schema flow/.test(text)) {
			this.removeFile(uri);
			return;
		}

		const parsedDocs = parseFlowDocuments(text);
		const filePath = uri.fsPath;
		
		// 處理舊映射以防實體名稱被修改或刪除
		const oldEntityNames = this.fileToEntities.get(filePath);
		if (oldEntityNames) {
			LogManager.log('FlowIndexer: clearing old cache for file:', filePath, 'Entities:', oldEntityNames);
			for (const name of oldEntityNames) {
				this.entities.delete(name);
			}
		}

		const newEntityNames: string[] = [];

		for (const parsed of parsedDocs) {
			const entityName = parsed.entityName ?? this.stripExtension(path.basename(uri.fsPath));
			
			let kind = parsed.blockKind;
			let accessModifier = parsed.accessModifier ?? null;
			let fields = parsed.fields;
			let rawMethods = parsed.methods;

			// 處理 bind 類型實體的外部載入
			if (parsed.blockKind === 'bind' && parsed.referenceFiles) {
				for (const refPath of parsed.referenceFiles) {
					try {
						const resolved = resolveShortcutPath(refPath, uri);
						if (fs.existsSync(resolved)) {
							const fileText = fs.readFileSync(resolved, 'utf8');
							const parsedClass = parseExternalClass(fileText, entityName);
							if (parsedClass) {
								kind = parsedClass.kind;
								accessModifier = parsedClass.accessModifier;
								fields = parsedClass.fields;
								rawMethods = parsedClass.methods;
								break;
							}
						}
					} catch (e) {
						LogManager.error(`FlowIndexer: Failed to read external bind file: ${refPath}`, e);
					}
				}
			}

			const indexedMethods: IndexedMethod[] = rawMethods.map((m) => ({
				name: m.name,
				parameters: m.parameters,
				line: m.line,
				accessModifier: m.accessModifier ?? null,
				modifiers: m.modifiers,
				returnType: m.returnType ?? null,
				callsTo: m.callsTo,
			}));

			const indexedEntity: IndexedEntity = {
				uri,
				entityName,
				kind: kind,
				accessModifier: accessModifier,
				methods: indexedMethods,
				rawText: text,
				fields: fields,
				referenceFiles: parsed.referenceFiles,
				relationTargets: parsed.relationTargets,
				extendsTargets: parsed.extendsTargets,
				implementsTargets: parsed.implementsTargets,
				inheritsTargets: parsed.inheritsTargets,
				associatesTargets: parsed.associatesTargets,
				aggregatesTargets: parsed.aggregatesTargets,
				composesTargets: parsed.composesTargets,
				dependsOnTargets: parsed.dependsOnTargets,
				display: parsed.display,
				contains: parsed.contains,
				parent: parsed.parent,
				startLine: parsed.startLine,
				endLine: parsed.endLine,
			};

			// [除錯日誌] 快取實體對象
			LogManager.log('FlowIndexer: caching entity:', entityName);
			this.entities.set(entityName, indexedEntity);
			newEntityNames.push(entityName);
		}

		this.fileToEntities.set(filePath, newEntityNames);

		// [流程驗證] 驗證暫存中的對照狀態是否一致，每個新實體是否都在 Map 中
		for (const name of newEntityNames) {
			LogManager.assert(this.entities.has(name), `FlowIndexer: Cache missing entity "${name}" after indexContent`);
		}

		LogManager.log('FlowIndexer: indexContent completed. Entities created:', newEntityNames);
	}

	private removeFile(uri: vscode.Uri): void {
		// [除錯日誌] 紀錄輸入參數
		LogManager.log('FlowIndexer: removeFile called. Uri:', uri.fsPath);

		// [參數驗證]
		LogManager.assert(uri instanceof vscode.Uri, 'FlowIndexer.removeFile: uri must be vscode.Uri');

		const filePath = uri.fsPath;
		const entityNames = this.fileToEntities.get(filePath);
		if (entityNames) {
			for (const name of entityNames) {
				// [除錯日誌] 刪除對應快取
				LogManager.log('FlowIndexer: deleting entity cache:', name);
				this.entities.delete(name);
			}
			this.fileToEntities.delete(filePath);
		}

		// [流程驗證] 驗證暫存清除是否乾淨
		LogManager.assert(!this.fileToEntities.has(filePath), 'FlowIndexer: Failed to clear fileToEntities mapping');
	}

	private isPlanFile(uri: vscode.Uri): boolean {
		if (uri.scheme !== 'file') {
			return false;
		}
		const ext = path.extname(uri.fsPath).toLowerCase();
		return ext === '.pln' || ext === '.plan' || ext === '.flow';
	}

	private stripExtension(fileName: string): string {
		const ext = path.extname(fileName).toLowerCase();
		if (ext === '.pln' || ext === '.plan' || ext === '.flow') {
			return fileName.slice(0, -ext.length);
		}
		return fileName;
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose());
		this.entities.clear();
		this.fileToEntities.clear();
	}
}
