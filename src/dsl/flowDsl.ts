/**
 * ============================================================================
 * 模組定位：Planist 領域特定語言 (DSL) 編譯與解析器 (src/dsl/flowDsl.ts)
 * 
 * 此檔案負責定義 Planist (.pln) 語法的抽象語法樹 (AST) 資料模型，並提供正則表達式
 * Token 掃描與整份文件的分析解析器 (parser)。
 * 
 * 核心介面與函數：
 * - FlowDocumentModel: 單一文件的 AST 節點資料模型。
 * - FlowGraphEntity / FlowGraphModel: 多檔案依賴結合後的整體拓撲關係模型。
 * - parseFlowDocuments: 核心編譯器，將字串文字轉化為多個結構化的 AST 物件。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的語法關鍵字（例如增加新關係 `implements` 等），請先於 `inlineRelationPattern`
 *    與 `relKeywordRegex` 補齊正則關鍵字，並在 AST 模型中增加對應的 Targets 陣列。
 * 2. 任何欄位與方法的 UML 符號變更，可在 `methodPattern` 與 `fieldPattern` 進行正則修改。
 * ============================================================================
 */

import * as path from 'path';
import { LogManager } from '../config/logger';

export const FLOW_LANGUAGE_ID = 'flowlang';
export const FLOW_FILE_EXTENSION = '.pln';
export const LEGACY_FLOW_FILE_EXTENSION = '.flow';

/**
 * 跨文件對外部方法或實體的呼叫引用介面
 */
export interface FlowReference {
	targetName: string;
	targetMethodName: string | null;
	line: number;
	startCharacter: number;
	endCharacter: number;
}

/**
 * 方法內部調用其他服務/方法之引用節點
 */
export interface FlowMethodCall {
	targetName: string;
	targetMethodName: string | null;
	line: number;
	startCharacter: number;
	endCharacter: number;
}

/**
 * 方法定義之 AST 節點
 */
export interface FlowMethodDefinition {
	name: string;
	parameters: string[];
	callsTo: FlowMethodCall[];
	line: number;
	startCharacter: number;
	endCharacter: number;
	accessModifier?: string | null;
	modifiers?: string[];
	returnType?: string | null;
	comments?: string[]; // 支持註解
}

/**
 * 屬性/欄位定義之 AST 節點
 */
export interface FlowFieldDefinition {
	name: string;
	type: string | null;
	accessModifier: string | null;
	modifiers?: string[];
	line: number;
	comments?: string[]; // 支持註解
}

/**
 * 單一文件的完整 AST 節點結構
 */
export interface FlowDocumentModel {
	entityName: string | null;
	blockKind: string | null;
	accessModifier?: string | null;
	pattern?: string;
	bindSourcePath: string | null;
	autoImport: boolean;
	styleColor: string | null;
	styleBorderColor: string | null;
	styleRadius: number | null;
	references: FlowReference[];
	methods: FlowMethodDefinition[];
	relationTargets: string[];
	extendsTargets: string[];
	implementsTargets: string[];
	inheritsTargets: string[];
	associatesTargets: string[];
	aggregatesTargets: string[];
	composesTargets: string[];
	dependsOnTargets: string[];
	fields: FlowFieldDefinition[];
	comments?: string[]; // 文件/類別頂部註解
	members?: Array<
		| { type: 'field'; field: FlowFieldDefinition }
		| { type: 'method'; method: FlowMethodDefinition }
		| { type: 'divider'; divider: { name: string; align: 'left' | 'center' | 'right' } }
	>; // 用於保留順序和分隔線的成員列表
	visualOverride?: {
		color?: string;
		borderColor?: string;
		borderRadius?: number;
		opacity?: number;
	};
	referenceFiles?: string[]; // 本檔案頂部引用的外部程式路徑
	display?: string;          // 包裹顯示名稱
	contains?: string[];        // 包裹明確包含的實體
	parent?: string;            // 所屬的父級包裹
}

/**
 * 整合後包含渲染及依賴的圖表節點
 */
export interface FlowGraphEntity {
	name: string;
	kind: string | null;
	accessModifier?: string | null;
	pattern?: string;
	bindSourcePath: string | null;
	autoImport: boolean;
	styleColor: string | null;
	styleBorderColor: string | null;
	styleRadius: number | null;
	references: FlowReference[];
	methods: FlowMethodDefinition[];
	relationTargets: string[];
	extendsTargets: string[];
	implementsTargets: string[];
	inheritsTargets: string[];
	associatesTargets: string[];
	aggregatesTargets: string[];
	composesTargets: string[];
	dependsOnTargets: string[];
	fields: FlowFieldDefinition[];
	comments?: string[];
	members?: Array<
		| { type: 'field'; field: FlowFieldDefinition }
		| { type: 'method'; method: FlowMethodDefinition }
		| { type: 'divider'; divider: { name: string; align: 'left' | 'center' | 'right' } }
	>;
	visualOverride?: {
		color?: string;
		borderColor?: string;
		borderRadius?: number;
		opacity?: number;
	};
	referenceFiles?: string[];
	display?: string;
	contains?: string[];
	parent?: string;
}

/**
 * 整體畫布之拓撲圖資料包模型
 */
export interface FlowGraphModel {
	entities: FlowGraphEntity[];
}

// ----------------------------------------------------------------------------
// 正則解析表達式 Tokens
// ----------------------------------------------------------------------------

const entityPattern = /^\s*entity\s+([A-Za-z_][\w-]*)\s*$/i;
const headerPattern = /^\s*(?:(?:(public|protected|private)\s+)|(?:(\+|-|#)\s*))?(class|abstract|interface|record|enum|text|bind|package|module)\s+([A-Za-z_][\w-]*)\s*\{?\s*$/i;
const bindPattern = /^\s*bind:\s*["']?([^"']+)["']?\s*$/i;
const autoImportPattern = /^\s*autoImport:\s*(true|false)\s*$/i;
const stylePattern = /^\s*(?:style\.)?(color|borderColor|radius)\s*:\s*(.+)\s*$/i;
const sectionPattern = /^\s*\[(Relations|Extends|Implements|Methods|Flow)\]\s*$/i;
const methodPattern = /^\s*(?:(?:(public|protected|private)\s+)|(?:(\+|-|#)\s*))?((?:(?:final|static|const|variable)\s+)*)([A-Za-z_][\w-]*)\s*\(([^)]*)\)(?:\s*:\s*([A-Za-z0-9_<>\s\[\]]+))?\s*\{?\s*$/i;
const referencePattern = /->\s*([A-Za-z_][\w-]*)(?:\.([A-Za-z_][\w-]*))?/g;
const inlineRelationPattern = /^\s*(?:(public|protected|private)\s+)?(?:(extends|implements|inherits|associates|aggregates|composes|dependsOn)\s+->|([A-Za-z_][\w-]*)\s*:\s*->)\s*([A-Za-z_][\w-]*)\s*$/i;
const fieldPattern = /^\s*(?:(?:(public|protected|private)\s+)|(?:(\+|-|#)\s*))?((?:(?:final|static|const|variable)\s+)*)([A-Za-z_][\w-]*)(?:\s*:\s*([A-Za-z0-9_<>\s\[\]]+))?\s*$/i;
const dividerPattern = /^\s*---\s*(?:([Cc]enter|[Ll]eft|[Rr]ight)\s*:\s*(.+?))?\s*$/;
const displayPattern = /^\s*display\s*:\s*["']?([^"']+)["']?\s*$/i;

/**
 * 解析一個檔案內部所有的 FlowDocumentModel 實體
 */
export function parseFlowDocuments(text: string): FlowDocumentModel[] {
	// [除錯日誌] 紀錄方法開始與輸入參數
	LogManager.log('parseFlowDocuments: start parsing text with length', text.length);

	// [參數驗證] 驗證輸入參數型態是否正確
	LogManager.assert(typeof text === 'string', 'parseFlowDocuments: input parameter "text" must be a string');

	const lines = text.split(/\r?\n/);
	const documents: FlowDocumentModel[] = [];

	// 1. 蒐集文件頂部所有的 #reference 外部檔案引用
	const referenceFiles: string[] = [];
	const referenceFilePattern = /^\s*(?:#?reference|#?refer)\s+["']?([^"']+)["']?\s*$/i;
	for (const line of lines) {
		const match = line.match(referenceFilePattern);
		if (match) {
			referenceFiles.push(match[1].trim());
		}
	}

	// [除錯日誌] 紀錄解析到的外部依賴檔案清單
	LogManager.log('parseFlowDocuments: collected reference files:', referenceFiles);

	let currentEntity: {
		entityName: string;
		blockKind: string | null;
		accessModifier: string | null;
		pattern?: string;
		styleColor: string | null;
		styleBorderColor: string | null;
		styleRadius: number | null;
		references: FlowReference[];
		methods: FlowMethodDefinition[];
		relationTargets: string[];
		extendsTargets: string[];
		implementsTargets: string[];
		inheritsTargets: string[];
		associatesTargets: string[];
		aggregatesTargets: string[];
		composesTargets: string[];
		dependsOnTargets: string[];
		fields: FlowFieldDefinition[];
		comments: string[];
		members: NonNullable<FlowDocumentModel['members']>;
		visualOverride?: {
			color?: string;
			borderColor?: string;
			borderRadius?: number;
			opacity?: number;
		};
		braceDepth: number;
		hasBraces: boolean;
		currentSection: 'general' | 'relations' | 'extends' | 'implements' | 'methods' | 'flow';
		currentMethod?: FlowMethodDefinition;
		inVisualOverride: boolean;
		display?: string;
		contains: string[];
	} | null = null;

	let activeComments: string[] = [];
	let activePattern: string | undefined = undefined;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const trimmed = line.trim();

		// 註解處理
		if (trimmed.startsWith('//')) {
			activeComments.push(trimmed.substring(2).trim());
			continue;
		}
		if (trimmed.startsWith('/*')) {
			const clean = trimmed.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
			if (clean) {
				activeComments.push(clean);
			}
			continue;
		}

		// Pattern tag parsing
		const patternMatch = trimmed.match(/^@pattern\s*\(\s*["']([^"']+)["']\s*\)/i);
		if (patternMatch) {
			activePattern = patternMatch[1];
			continue;
		}

		// 偵測是否到了新的實體宣告
		let newEntityName: string | null = null;
		let newBlockKind: string | null = null;
		let newAccessMod: string | null = null;

		const entityMatch = line.match(entityPattern);
		if (entityMatch) {
			newEntityName = entityMatch[1];
			newBlockKind = null;
		} else {
			const headerMatch = line.match(headerPattern);
			if (headerMatch) {
				newAccessMod = headerMatch[1] || headerMatch[2] || null;
				newBlockKind = headerMatch[3].toLowerCase();
				newEntityName = headerMatch[4];
			}
		}

		if (newEntityName) {
			// 若本來已有解析中的實體，先將其封存
			if (currentEntity) {
				// [除錯日誌] 紀錄實體轉換，封存上一實體
				LogManager.log('parseFlowDocuments: finalizing entity before switching:', currentEntity.entityName);
				documents.push(finalizeEntity(currentEntity, referenceFiles));
				currentEntity = null;
			}

			const hasOpeningBrace = /\{/.test(line);

			currentEntity = {
				entityName: newEntityName,
				blockKind: newBlockKind,
				accessModifier: newAccessMod,
				pattern: activePattern,
				styleColor: null,
				styleBorderColor: null,
				styleRadius: null,
				references: [],
				methods: [],
				relationTargets: [],
				extendsTargets: [],
				implementsTargets: [],
				inheritsTargets: [],
				associatesTargets: [],
				aggregatesTargets: [],
				composesTargets: [],
				dependsOnTargets: [],
				fields: [],
				comments: [...activeComments],
				members: [],
				braceDepth: hasOpeningBrace ? 1 : 0,
				hasBraces: hasOpeningBrace,
				currentSection: 'general',
				inVisualOverride: false,
				display: undefined,
				contains: [],
			};
			activeComments = [];
			activePattern = undefined;

			// 若此行沒有大括號，向後看下一行非空行是否為 '{'
			if (!hasOpeningBrace) {
				let lookAheadIdx = lineIndex + 1;
				while (lookAheadIdx < lines.length) {
					const laTrimmed = lines[lookAheadIdx].trim();
					if (laTrimmed === '') {
						lookAheadIdx++;
						continue;
					}
					if (laTrimmed.startsWith('//') || laTrimmed.startsWith('/*')) {
						lookAheadIdx++;
						continue;
					}
					if (laTrimmed.startsWith('{')) {
						currentEntity.hasBraces = true;
						currentEntity.braceDepth = 1;
						lineIndex = lookAheadIdx;
					}
					break;
				}
			}

			// 若是 bind/package/module 實體且沒有大括號，直接視為單行定義封存
			if ((currentEntity.blockKind === 'bind' || currentEntity.blockKind === 'package' || currentEntity.blockKind === 'module') && !currentEntity.hasBraces) {
				documents.push(finalizeEntity(currentEntity, referenceFiles));
				currentEntity = null;
			}
			continue;
		}

		// 若不在任何實體區塊內部，忽略本行 (除了 directives 以外)
		if (!currentEntity) {
			if (trimmed !== '') {
				activeComments = [];
			}
			continue;
		}

		// 處理實體內部細節
		if (/^\s*\[Visual-Override\]\s*$/i.test(line)) {
			currentEntity.inVisualOverride = true;
			currentEntity.currentSection = 'general';
			currentEntity.currentMethod = undefined;
			activeComments = [];
			continue;
		}

		if (currentEntity.inVisualOverride) {
			const propMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)\s*$/);
			if (propMatch) {
				const propName = propMatch[1].trim();
				const propVal = propMatch[2].trim();
				if (!currentEntity.visualOverride) {
					currentEntity.visualOverride = {};
				}
				if (propName === 'borderColor') {
					currentEntity.visualOverride.borderColor = propVal;
				} else if (propName === 'borderRadius') {
					const parsed = Number(propVal);
					if (Number.isFinite(parsed)) {
						currentEntity.visualOverride.borderRadius = parsed;
					}
				} else if (propName === 'opacity') {
					const parsed = Number(propVal);
					if (Number.isFinite(parsed)) {
						currentEntity.visualOverride.opacity = parsed;
					}
				} else if (propName === 'color') {
					currentEntity.visualOverride.color = propVal;
				}
			}
			continue;
		}

		// 計算大括號深度
		if (currentEntity.hasBraces) {
			const opens = (line.match(/\{/g) || []).length;
			const closes = (line.match(/\}/g) || []).length;
			currentEntity.braceDepth += opens - closes;
		}

		// 解析 display: "..." 屬性 (可用於 package / module)
		const displayMatch = line.match(displayPattern);
		if (displayMatch && (currentEntity.blockKind === 'package' || currentEntity.blockKind === 'module')) {
			currentEntity.display = displayMatch[1].trim();
			activeComments = [];
			continue;
		}

		// 解析樣式
		const styleMatch = line.match(stylePattern);
		if (styleMatch) {
			const styleKey = styleMatch[1].toLowerCase();
			const styleValue = styleMatch[2].trim();
			if (styleKey === 'color') {
				currentEntity.styleColor = styleValue;
			} else if (styleKey === 'bordercolor') {
				currentEntity.styleBorderColor = styleValue;
			} else if (styleKey === 'radius') {
				const parsedRadius = Number(styleValue);
				currentEntity.styleRadius = Number.isFinite(parsedRadius) ? parsedRadius : null;
			}
			activeComments = [];
			continue;
		}

		// 檢查分隔線
		const dividerMatch = line.match(dividerPattern);
		if (dividerMatch) {
			const alignStr = (dividerMatch[1] || 'center').toLowerCase() as 'left' | 'center' | 'right';
			const name = dividerMatch[2] ? dividerMatch[2].trim() : '';
			currentEntity.members.push({
				type: 'divider',
				divider: { name, align: alignStr },
			});
			activeComments = [];
			continue;
		}

		// 解析 inline 關係
		const inlineRelMatch = line.match(inlineRelationPattern);
		if (inlineRelMatch) {
			const relType = inlineRelMatch[2] ? inlineRelMatch[2].toLowerCase() : '';
			const target = inlineRelMatch[4];
			if (relType === 'extends') {
				currentEntity.extendsTargets.push(target);
			} else if (relType === 'implements') {
				currentEntity.implementsTargets.push(target);
			} else if (relType === 'inherits') {
				currentEntity.inheritsTargets.push(target);
			} else if (relType === 'associates') {
				currentEntity.associatesTargets.push(target);
			} else if (relType === 'aggregates') {
				currentEntity.aggregatesTargets.push(target);
			} else if (relType === 'composes') {
				currentEntity.composesTargets.push(target);
			} else if (relType === 'dependson') {
				currentEntity.dependsOnTargets.push(target);
			} else {
				currentEntity.relationTargets.push(target);
			}
			activeComments = [];
			continue;
		}

		// 解析 Section
		const sectionMatch = line.match(sectionPattern);
		if (sectionMatch) {
			currentEntity.currentSection = sectionMatch[1].toLowerCase() as typeof currentEntity.currentSection;
			currentEntity.currentMethod = undefined;
			activeComments = [];
			continue;
		}

		const methodMatch = line.match(methodPattern);

		// 解析欄位
		if (currentEntity.currentSection === 'general' && currentEntity.currentMethod === undefined) {
			const fieldMatch = line.match(fieldPattern);
			if (fieldMatch && !sectionMatch && !methodMatch && !styleMatch && !inlineRelMatch && !dividerMatch) {
				const trimmedLine = line.trim();
				if (trimmedLine && trimmedLine !== '{' && trimmedLine !== '}' && !trimmedLine.startsWith('//')) {
					const accessMod = fieldMatch[1] || fieldMatch[2] || null;
					const modifiersStr = fieldMatch[3] || '';
					const modifiers = modifiersStr.trim().split(/\s+/).filter(Boolean);
					const fieldNode: FlowFieldDefinition = {
						name: fieldMatch[4],
						type: fieldMatch[5] ? fieldMatch[5].trim() : null,
						accessModifier: accessMod,
						modifiers: modifiers.length > 0 ? modifiers : undefined,
						line: lineIndex,
						comments: [...activeComments],
					};
					currentEntity.fields.push(fieldNode);
					currentEntity.members.push({ type: 'field', field: fieldNode });
					activeComments = [];
					continue;
				}
			}
		}

		// 解析方法
		if (currentEntity.currentSection === 'methods' || currentEntity.currentSection === 'general') {
			if (methodMatch) {
				const accessMod = methodMatch[1] || methodMatch[2] || null;
				const modifiersStr = methodMatch[3] || '';
				const modifiers = modifiersStr.trim().split(/\s+/).filter(Boolean);
				currentEntity.currentMethod = {
					name: methodMatch[4],
					parameters: splitParameters(methodMatch[5]),
					callsTo: [],
					line: lineIndex,
					startCharacter: line.indexOf(methodMatch[4]),
					endCharacter: line.indexOf(methodMatch[4]) + methodMatch[4].length,
					accessModifier: accessMod,
					modifiers: modifiers.length > 0 ? modifiers : undefined,
					returnType: methodMatch[6] ? methodMatch[6].trim() : null,
					comments: [...activeComments],
				};
				currentEntity.methods.push(currentEntity.currentMethod);
				currentEntity.members.push({ type: 'method', method: currentEntity.currentMethod });
				activeComments = [];
				continue;
			}

			if (currentEntity.currentMethod) {
				collectReferenceMatches(line, lineIndex, (reference) => {
					currentEntity?.currentMethod?.callsTo.push({
						targetName: reference.targetName,
						targetMethodName: reference.targetMethodName,
						line: reference.line,
						startCharacter: reference.startCharacter,
						endCharacter: reference.endCharacter,
					});
				});

				if (/\}/.test(line)) {
					currentEntity.currentMethod = undefined;
				}
				activeComments = [];

				if (currentEntity.hasBraces && currentEntity.braceDepth <= 0) {
					documents.push(finalizeEntity(currentEntity, referenceFiles));
					currentEntity = null;
				}
				continue;
			}
		}

		// 解析引用關係
		referencePattern.lastIndex = 0;
		if (currentEntity.currentSection === 'extends' || currentEntity.currentSection === 'implements' || currentEntity.currentSection === 'relations' || currentEntity.currentSection === 'flow' || currentEntity.currentSection === 'general') {
			collectReferenceMatches(line, lineIndex, (reference) => {
				if (currentEntity!.currentSection === 'extends') {
					currentEntity!.extendsTargets.push(reference.targetName);
					return;
				}
				if (currentEntity!.currentSection === 'implements') {
					currentEntity!.implementsTargets.push(reference.targetName);
					return;
				}
				if (currentEntity!.currentSection === 'relations') {
					currentEntity!.relationTargets.push(reference.targetName);
					return;
				}
				// 收集 Package 包裹對象
				if (currentEntity!.blockKind === 'package' || currentEntity!.blockKind === 'module') {
					if (!currentEntity!.contains.includes(reference.targetName)) {
						currentEntity!.contains.push(reference.targetName);
					}
				}
				currentEntity!.references.push(reference);
			});
		}

		// 關閉實體
		if (currentEntity && currentEntity.hasBraces && currentEntity.braceDepth <= 0) {
			documents.push(finalizeEntity(currentEntity, referenceFiles));
			currentEntity = null;
		}

		if (trimmed !== '') {
			activeComments = [];
		}
	}

	if (currentEntity) {
		// [除錯日誌] 紀錄封存最後一個解析實體
		LogManager.log('parseFlowDocuments: finalizing last entity:', currentEntity.entityName);
		documents.push(finalizeEntity(currentEntity, referenceFiles));
	}

	// [除錯日誌] 記錄解析出的實體總數
	LogManager.log('parseFlowDocuments: completed parsing. Total entities:', documents.length);

	// [流程驗證] 驗證回傳的 documents 陣列合法性與參數正確性
	LogManager.assert(Array.isArray(documents), 'parseFlowDocuments: returned value must be an array');
	for (const doc of documents) {
		LogManager.assert(doc.entityName !== null && doc.entityName !== undefined, 'parseFlowDocuments: parsed document must contain a valid entity name');
	}

	return documents;
}

function finalizeEntity(entity: any, referenceFiles: string[]): FlowDocumentModel {
	return {
		entityName: entity.entityName,
		blockKind: entity.blockKind,
		accessModifier: entity.accessModifier,
		pattern: entity.pattern,
		bindSourcePath: null,
		autoImport: false,
		styleColor: entity.styleColor,
		styleBorderColor: entity.styleBorderColor,
		styleRadius: entity.styleRadius,
		references: entity.references,
		methods: entity.methods,
		relationTargets: entity.relationTargets,
		extendsTargets: entity.extendsTargets,
		implementsTargets: entity.implementsTargets,
		inheritsTargets: entity.inheritsTargets,
		associatesTargets: entity.associatesTargets,
		aggregatesTargets: entity.aggregatesTargets,
		composesTargets: entity.composesTargets,
		dependsOnTargets: entity.dependsOnTargets,
		fields: entity.fields,
		comments: entity.comments.length > 0 ? entity.comments : undefined,
		members: entity.members.length > 0 ? entity.members : undefined,
		visualOverride: entity.visualOverride,
		referenceFiles: referenceFiles,
		display: entity.display,
		contains: entity.contains && entity.contains.length > 0 ? entity.contains : undefined,
	};
}

/**
 * 將文字內容解析為結構化的 AST 資料模型 (向下相容)
 */
export function parseFlowDocument(text: string): FlowDocumentModel {
	// [除錯日誌] 紀錄輸入參數
	LogManager.log('parseFlowDocument: start processing document. Text length:', text ? text.length : 0);

	// [參數驗證]
	LogManager.assert(typeof text === 'string', 'parseFlowDocument: parameter "text" must be a string');

	const docs = parseFlowDocuments(text);

	// [流程驗證]
	LogManager.assert(Array.isArray(docs), 'parseFlowDocument: internal parseFlowDocuments returned invalid structure');

	if (docs.length > 0) {
		// [除錯日誌] 成功解析回傳第一個實體
		LogManager.log('parseFlowDocument completed successfully. Parsed entityName:', docs[0].entityName);
		return docs[0];
	}

	// [除錯日誌] 回傳預設空物件
	LogManager.log('parseFlowDocument completed: returned empty fallback model.');
	return {
		entityName: null,
		blockKind: null,
		bindSourcePath: null,
		autoImport: false,
		styleColor: null,
		styleBorderColor: null,
		styleRadius: null,
		references: [],
		methods: [],
		relationTargets: [],
		extendsTargets: [],
		implementsTargets: [],
		inheritsTargets: [],
		associatesTargets: [],
		aggregatesTargets: [],
		composesTargets: [],
		dependsOnTargets: [],
		fields: [],
	};
}

export interface ExternalParsedClass {
	kind: string;
	accessModifier: string | null;
	fields: FlowFieldDefinition[];
	methods: FlowMethodDefinition[];
	comments?: string[];
	members: Array<
		| { type: 'field'; field: FlowFieldDefinition }
		| { type: 'method'; method: FlowMethodDefinition }
	>;
}

/**
 * 解析標準程式語言原始碼中的類別屬性與方法
 */
export function parseExternalClass(fileText: string, className: string): ExternalParsedClass | undefined {
	const headerRegex = new RegExp('(?:\\b(public|protected|private)\\s+)?(?:\\b(abstract|class|interface|enum|record)\\s+)' + className + '\\b', 'i');
	const headerMatch = fileText.match(headerRegex);
	if (!headerMatch) {
		return undefined;
	}

	const kind = headerMatch[2].toLowerCase();
	const accessModRaw = headerMatch[1];
	const accessModifier = accessModRaw === 'private' ? '-' : (accessModRaw === 'protected' ? '#' : '+');

	// 提取類別註解
	const classComments: string[] = [];
	let pattern: string | undefined = undefined;
	const beforeText = fileText.substring(0, headerMatch.index);
	const beforeLines = beforeText.split(/\r?\n/);
	for (let i = beforeLines.length - 1; i >= 0; i--) {
		const line = beforeLines[i].trim();
		if (line.startsWith('//')) {
			classComments.unshift(line.substring(2).trim());
		} else if (line.endsWith('*/')) {
			let blockComments: string[] = [];
			while (i >= 0) {
				const laLine = beforeLines[i].trim();
				const clean = laLine.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
				if (clean) {
					blockComments.unshift(clean);
				}
				if (laLine.startsWith('/*')) {
					break;
				}
				i--;
			}
			classComments.unshift(...blockComments);
		} else if (line === '') {
			break;
		} else {
			const patternMatch = line.match(/^@pattern\s*\(\s*["']([^"']+)["']\s*\)/i);
			if (patternMatch) {
				pattern = patternMatch[1];
			} else {
				break;
			}
		}
	}

	let startIdx = fileText.indexOf('{', headerMatch.index!);
	if (startIdx === -1) {
		return {
			kind,
			accessModifier,
			fields: [],
			methods: [],
			comments: classComments.length > 0 ? classComments : undefined,
			members: [],
		};
	}

	let braceCount = 1;
	let endIdx = startIdx + 1;
	while (endIdx < fileText.length && braceCount > 0) {
		if (fileText[endIdx] === '{') {
			braceCount++;
		} else if (fileText[endIdx] === '}') {
			braceCount--;
		}
		endIdx++;
	}
	const bodyText = fileText.substring(startIdx + 1, endIdx - 1);
	const bodyLines = bodyText.split(/\r?\n/);

	const fields: FlowFieldDefinition[] = [];
	const methods: FlowMethodDefinition[] = [];
	const members: ExternalParsedClass['members'] = [];

	let activeComments: string[] = [];

	// 方法比對正則 (包含 Java 及 TypeScript/C# 風格)
	const methodRegex = /^\s*(?:(public|protected|private)\s+)?((?:(?:static|final|async|const|readonly|public|protected|private)\s+)*)(?:([A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])?)\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)(?:\s*:\s*([A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])?))?/;
	// 屬性比對正則
	const fieldRegex = /^\s*(?:(public|protected|private)\s+)?((?:(?:static|final|const|readonly|public|protected|private)\s+)*)(?:([A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])?)\s+)?([A-Za-z_]\w*)\s*(?::\s*([A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])?))?\s*(?:=.*)?(?:;)?\s*$/;

	for (let lineIndex = 0; lineIndex < bodyLines.length; lineIndex++) {
		const line = bodyLines[lineIndex];
		const trimmed = line.trim();

		if (trimmed.startsWith('//')) {
			activeComments.push(trimmed.substring(2).trim());
			continue;
		}
		if (trimmed.startsWith('/*')) {
			const clean = trimmed.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
			if (clean) {
				activeComments.push(clean);
			}
			continue;
		}
		if (trimmed === '') {
			continue;
		}

		const isMethod = trimmed.includes('(');
		if (isMethod) {
			const mMatch = line.match(methodRegex);
			if (mMatch) {
				const accessModRaw = mMatch[1];
				const accessModifier = accessModRaw === 'private' ? '-' : (accessModRaw === 'protected' ? '#' : '+');
				const modifiersStr = mMatch[2] || '';
				const modifiers = modifiersStr.trim().split(/\s+/).filter(Boolean);
				
				const returnType = mMatch[6] ? mMatch[6].trim() : (mMatch[3] ? mMatch[3].trim() : null);
				const name = mMatch[4];
				const paramsRaw = mMatch[5];
				
				const parameters = paramsRaw.split(',').map(p => {
					const parts = p.trim().split(/\s+/);
					const lastPart = parts[parts.length - 1];
					if (lastPart.includes(':')) {
						return lastPart.split(':')[0].trim();
					}
					return lastPart;
				}).filter(Boolean);

				const methodNode: FlowMethodDefinition = {
					name,
					parameters,
					callsTo: [],
					line: lineIndex,
					startCharacter: line.indexOf(name),
					endCharacter: line.indexOf(name) + name.length,
					accessModifier,
					modifiers: modifiers.length > 0 ? modifiers : undefined,
					returnType,
					comments: [...activeComments],
				};
				methods.push(methodNode);
				members.push({ type: 'method', method: methodNode });
				activeComments = [];
				continue;
			}
		} else {
			const fMatch = line.match(fieldRegex);
			if (fMatch) {
				const accessModRaw = fMatch[1];
				const accessModifier = accessModRaw === 'private' ? '-' : (accessModRaw === 'protected' ? '#' : '+');
				const modifiersStr = fMatch[2] || '';
				const modifiers = modifiersStr.trim().split(/\s+/).filter(Boolean);
				
				const type = fMatch[5] ? fMatch[5].trim() : (fMatch[3] ? fMatch[3].trim() : null);
				const name = fMatch[4];

				if (name === 'return' || name === 'break' || name === 'continue' || name === 'throw') {
					activeComments = [];
					continue;
				}

				const fieldNode: FlowFieldDefinition = {
					name,
					type,
					accessModifier,
					modifiers: modifiers.length > 0 ? modifiers : undefined,
					line: lineIndex,
					comments: [...activeComments],
				};
				fields.push(fieldNode);
				members.push({ type: 'field', field: fieldNode });
				activeComments = [];
				continue;
			}
		}

		activeComments = [];
	}

	return {
		kind,
		accessModifier,
		fields,
		methods,
		comments: classComments.length > 0 ? classComments : undefined,
		members,
	};
}

/**
 * 尋找滑鼠游標所在位置之引用節點
 */
export function findReferenceAtPosition(text: string, line: number, character: number): FlowReference | undefined {
	const lines = text.split(/\r?\n/);
	const lineText = lines[line];
	if (lineText === undefined) {
		return undefined;
	}

	referencePattern.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = referencePattern.exec(lineText)) !== null) {
		const startCharacter = match.index + match[0].lastIndexOf(match[1]);
		const endCharacter = match[2]
			? startCharacter + match[1].length + 1 + match[2].length
			: startCharacter + match[1].length;
		if (character >= startCharacter && character < endCharacter) {
			return {
				targetName: match[1],
				targetMethodName: match[2] ?? null,
				line,
				startCharacter,
				endCharacter,
			};
		}
	}

	return undefined;
}

/**
 * 快速定位方法聲明的起始行號
 */
export function findMethodDeclarationLine(text: string, methodName: string): number | undefined {
	const lines = text.split(/\r?\n/);
	const methodLinePattern = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*${escapeRegExp(methodName)}\\s*\\(`, 'i');

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		if (methodLinePattern.test(lines[lineIndex])) {
			return lineIndex;
		}
	}

	return undefined;
}

/**
 * 快速定位實體結構聲明的起始行號
 */
export function findEntityDeclarationLine(text: string, entityName: string): number | undefined {
	const lines = text.split(/\r?\n/);
	const entityLinePattern = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*(class|abstract|interface|record|enum|text|bind|package|module)?\\s*${escapeRegExp(entityName)}\\b`, 'i');

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		if (entityLinePattern.test(lines[lineIndex])) {
			return lineIndex;
		}
	}

	return undefined;
}

/**
 * 獲取實體對應的 .pln 檔名
 */
export function getFlowFileName(entityName: string): string {
	return `${entityName}${FLOW_LANGUAGE_ID === 'flowlang' ? '.pln' : FLOW_FILE_EXTENSION}`;
}

/**
 * 從專案檔案集合編譯構建出整體拓撲模型
 */
export function buildFlowGraphModel(
	files: Array<{ fileName: string; text: string; uri?: any }>,
	resolvePathFn?: (p: string, docUri?: any) => string,
	readFileFn?: (p: string) => string | undefined
): FlowGraphModel {
	// [除錯日誌] 驗證輸入參數型態是否正確
	LogManager.assert(Array.isArray(files), 'buildFlowGraphModel: parameter "files" must be an array');

	const entities = new Map<string, FlowGraphEntity>();

	// 解析出所有的 document models
	const parsedDocs: Array<{ doc: FlowDocumentModel; fileName: string; uri?: any }> = [];
	for (const file of files) {
		LogManager.assert(!!file.fileName, 'buildFlowGraphModel: each file must have a valid fileName');
		const docs = parseFlowDocuments(file.text);
		for (const doc of docs) {
			parsedDocs.push({ doc, fileName: file.fileName, uri: file.uri });
		}
	}

	// 建立目錄到 Package 實體名稱的對照，並找出所有明確包含的子實體關係
	const dirToPackage = new Map<string, string>();
	const packageContains = new Map<string, string[]>();

	for (const { doc, uri } of parsedDocs) {
		if ((doc.blockKind === 'package' || doc.blockKind === 'module') && doc.entityName) {
			if (uri) {
				const dir = path.dirname(uri.fsPath);
				dirToPackage.set(dir, doc.entityName);
			}
			if (doc.contains && doc.contains.length > 0) {
				packageContains.set(doc.entityName, doc.contains);
			}
		}
	}

	for (const { doc, fileName, uri } of parsedDocs) {
		const entityName = doc.entityName ?? stripFlowFileExtension(fileName);
		let kind = doc.blockKind;
		let accessModifier = doc.accessModifier;
		let fields = doc.fields;
		let methods = doc.methods;
		let members = doc.members;
		let comments = doc.comments;

		// 處理 bind 類型實體的外部載入
		if (doc.blockKind === 'bind' && resolvePathFn && readFileFn && doc.referenceFiles) {
			// [除錯日誌] 偵測到 bind 區塊，嘗試載入外部檔案關聯
			LogManager.log('buildFlowGraphModel: loading external class files for bind entity:', entityName);
			for (const refPath of doc.referenceFiles) {
				const resolved = resolvePathFn(refPath, uri);
				const fileText = readFileFn(resolved);
				if (fileText) {
					const parsedClass = parseExternalClass(fileText, entityName);
					if (parsedClass) {
						kind = parsedClass.kind;
						accessModifier = parsedClass.accessModifier;
						fields = parsedClass.fields;
						methods = parsedClass.methods;
						members = parsedClass.members as any;
						if (parsedClass.comments) {
							comments = parsedClass.comments;
						}
						LogManager.log('buildFlowGraphModel: successfully bound external file. Path:', resolved);
						break;
					}
				}
			}
		}

		let parent: string | undefined = undefined;

		// 優先檢查是否有被 Package 顯式包含
		for (const [pkgName, containsList] of packageContains.entries()) {
			if (containsList.includes(entityName)) {
				parent = pkgName;
				break;
			}
		}

		// 若無，則檢查該實體檔案是否與某 Package 在相同資料夾 (預設包含該資料夾下所有檔案)
		if (!parent && uri) {
			const dir = path.dirname(uri.fsPath);
			const localPkg = dirToPackage.get(dir);
			if (localPkg && localPkg !== entityName) {
				parent = localPkg;
			}
		}

		entities.set(entityName, {
			name: entityName,
			kind: kind,
			accessModifier: accessModifier,
			bindSourcePath: doc.bindSourcePath,
			autoImport: doc.autoImport,
			styleColor: doc.styleColor,
			styleBorderColor: doc.styleBorderColor,
			styleRadius: doc.styleRadius,
			references: doc.references,
			methods: methods,
			relationTargets: doc.relationTargets,
			extendsTargets: doc.extendsTargets,
			implementsTargets: doc.implementsTargets,
			inheritsTargets: doc.inheritsTargets,
			associatesTargets: doc.associatesTargets,
			aggregatesTargets: doc.aggregatesTargets,
			composesTargets: doc.composesTargets,
			dependsOnTargets: doc.dependsOnTargets,
			fields: fields,
			comments: comments,
			members: members,
			visualOverride: doc.visualOverride,
			referenceFiles: doc.referenceFiles,
			display: doc.display,
			contains: doc.contains,
			parent: parent,
		});
	}

	const result = {
		entities: Array.from(entities.values()),
	};

	// [流程驗證] 驗證結果結構是否正確，且無重複名稱節點
	LogManager.assert(Array.isArray(result.entities), 'buildFlowGraphModel: result entities must be an array');
	LogManager.log('buildFlowGraphModel: completed. Total entities built:', result.entities.length);

	return result;
}

function splitParameters(rawParameters: string): string[] {
	return rawParameters
		.split(',')
		.map((parameter) => parameter.trim())
		.filter(Boolean);
}

function collectReferenceMatches(
	line: string,
	lineIndex: number,
	collector: (reference: FlowReference) => void,
): void {
	referencePattern.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = referencePattern.exec(line)) !== null) {
		const startCharacter = match.index + match[0].lastIndexOf(match[1]);
		const endCharacter = match[2]
			? startCharacter + match[1].length + 1 + match[2].length
			: startCharacter + match[1].length;

		collector({
			targetName: match[1],
			targetMethodName: match[2] ?? null,
			line: lineIndex,
			startCharacter,
			endCharacter,
		});
	}
}

function stripFlowFileExtension(fileName: string): string {
	const normalizedFileName = fileName.toLowerCase();
	if (normalizedFileName.endsWith(FLOW_FILE_EXTENSION)) {
		return fileName.slice(0, -FLOW_FILE_EXTENSION.length);
	}

	if (normalizedFileName.endsWith(LEGACY_FLOW_FILE_EXTENSION)) {
		return fileName.slice(0, -LEGACY_FLOW_FILE_EXTENSION.length);
	}

	return fileName;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
