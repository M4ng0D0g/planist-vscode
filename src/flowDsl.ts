export const FLOW_LANGUAGE_ID = 'flowlang';
export const FLOW_FILE_EXTENSION = '.plan';
export const LEGACY_FLOW_FILE_EXTENSION = '.flow';

export interface FlowReference {
	targetName: string;
	targetMethodName: string | null;
	line: number;
	startCharacter: number;
	endCharacter: number;
}

export interface FlowMethodCall {
	targetName: string;
	targetMethodName: string | null;
	line: number;
	startCharacter: number;
	endCharacter: number;
}

export interface FlowMethodDefinition {
	name: string;
	parameters: string[];
	callsTo: FlowMethodCall[];
	line: number;
	startCharacter: number;
	endCharacter: number;
}

export interface FlowDocumentModel {
	entityName: string | null;
	blockKind: string | null;
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
}

export interface FlowGraphEntity {
	name: string;
	kind: string | null;
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
}

export interface FlowGraphModel {
	entities: FlowGraphEntity[];
}

const entityPattern = /^\s*entity\s+([A-Za-z_][\w-]*)\s*$/i;
const headerPattern = /^\s*(class|abstract|interface|record|enum|text)\s+([A-Za-z_][\w-]*)\s*\{?\s*$/i;
const bindPattern = /^\s*bind:\s*["']?([^"']+)["']?\s*$/i;
const autoImportPattern = /^\s*autoImport:\s*(true|false)\s*$/i;
const stylePattern = /^\s*(?:style\.)?(color|borderColor|radius)\s*:\s*(.+)\s*$/i;
const sectionPattern = /^\s*\[(Relations|Extends|Implements|Methods|Flow)\]\s*$/i;
const methodPattern = /^\s*\+\s*([A-Za-z_][\w-]*)\s*\(([^)]*)\)\s*\{?\s*$/;
const referencePattern = /->\s*([A-Za-z_][\w-]*)(?:\.([A-Za-z_][\w-]*))?/g;

export function parseFlowDocument(text: string): FlowDocumentModel {
	const references: FlowReference[] = [];
	const methods: FlowMethodDefinition[] = [];
	const relationTargets: string[] = [];
	const extendsTargets: string[] = [];
	const implementsTargets: string[] = [];
	const lines = text.split(/\r?\n/);
	let entityName: string | null = null;
	let blockKind: string | null = null;
	let bindSourcePath: string | null = null;
	let autoImport = false;
	let styleColor: string | null = null;
	let styleBorderColor: string | null = null;
	let styleRadius: number | null = null;
	let currentSection: 'general' | 'relations' | 'extends' | 'implements' | 'methods' | 'flow' = 'general';
	let currentMethod: FlowMethodDefinition | undefined;

	lines.forEach((line, lineIndex) => {
		if (entityName === null) {
			const entityMatch = line.match(entityPattern);
			if (entityMatch) {
				entityName = entityMatch[1];
			}

			const headerMatch = line.match(headerPattern);
			if (headerMatch) {
				blockKind = headerMatch[1].toLowerCase();
				entityName = headerMatch[2];
			}
		}

		const bindMatch = line.match(bindPattern);
		if (bindMatch) {
			bindSourcePath = bindMatch[1].trim();
			return;
		}

		const autoImportMatch = line.match(autoImportPattern);
		if (autoImportMatch) {
			autoImport = autoImportMatch[1].toLowerCase() === 'true';
			return;
		}

		const styleMatch = line.match(stylePattern);
		if (styleMatch) {
			const styleKey = styleMatch[1].toLowerCase();
			const styleValue = styleMatch[2].trim();
			if (styleKey === 'color') {
				styleColor = styleValue;
			}
			if (styleKey === 'bordercolor') {
				styleBorderColor = styleValue;
			}
			if (styleKey === 'radius') {
				const parsedRadius = Number(styleValue);
				styleRadius = Number.isFinite(parsedRadius) ? parsedRadius : null;
			}
			return;
		}

		const sectionMatch = line.match(sectionPattern);
		if (sectionMatch) {
			currentSection = sectionMatch[1].toLowerCase() as typeof currentSection;
			currentMethod = undefined;
			return;
		}

		if (currentSection === 'methods') {
			const methodMatch = line.match(methodPattern);
			if (methodMatch) {
				currentMethod = {
					name: methodMatch[1],
					parameters: splitParameters(methodMatch[2]),
					callsTo: [],
					line: lineIndex,
					startCharacter: line.indexOf(methodMatch[1]),
					endCharacter: line.indexOf(methodMatch[1]) + methodMatch[1].length,
				};
				methods.push(currentMethod);
			}

			if (currentMethod) {
				collectReferenceMatches(line, lineIndex, (reference) => {
					currentMethod?.callsTo.push({
						targetName: reference.targetName,
						targetMethodName: reference.targetMethodName,
						line: reference.line,
						startCharacter: reference.startCharacter,
						endCharacter: reference.endCharacter,
					});
				});

				if (/\}/.test(line)) {
					currentMethod = undefined;
				}
			}

			return;
		}

		referencePattern.lastIndex = 0;
		if (currentSection === 'extends' || currentSection === 'implements' || currentSection === 'relations' || currentSection === 'flow' || currentSection === 'general') {
			collectReferenceMatches(line, lineIndex, (reference) => {
				if (currentSection === 'extends') {
					extendsTargets.push(reference.targetName);
					return;
				}

				if (currentSection === 'implements') {
					implementsTargets.push(reference.targetName);
					return;
				}

				if (currentSection === 'relations') {
					relationTargets.push(reference.targetName);
					return;
				}

				references.push(reference);
			});
		}
	});

	return {
		entityName,
		blockKind,
		bindSourcePath,
		autoImport,
		styleColor,
		styleBorderColor,
		styleRadius,
		references,
		methods,
		relationTargets,
		extendsTargets,
		implementsTargets,
	};
}

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

export function findMethodDeclarationLine(text: string, methodName: string): number | undefined {
	const lines = text.split(/\r?\n/);
	const methodLinePattern = new RegExp(`^\\s*\\+\\s*${escapeRegExp(methodName)}\\s*\\(`, 'i');

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		if (methodLinePattern.test(lines[lineIndex])) {
			return lineIndex;
		}
	}

	return undefined;
}

export function findEntityDeclarationLine(text: string, entityName: string): number | undefined {
	const lines = text.split(/\r?\n/);
	const entityLinePattern = new RegExp(`^\\s*entity\\s+${escapeRegExp(entityName)}\\s*$`, 'i');

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		if (entityLinePattern.test(lines[lineIndex])) {
			return lineIndex;
		}
	}

	return undefined;
}

export function getFlowFileName(entityName: string): string {
	return `${entityName}${FLOW_FILE_EXTENSION}`;
}

export function buildFlowGraphModel(files: Array<{ fileName: string; text: string }>): FlowGraphModel {
	const entities = new Map<string, FlowGraphEntity>();

	for (const file of files) {
		const parsedDocument = parseFlowDocument(file.text);
		const entityName = parsedDocument.entityName ?? stripFlowFileExtension(file.fileName);
		entities.set(entityName, {
			name: entityName,
			kind: parsedDocument.blockKind,
			bindSourcePath: parsedDocument.bindSourcePath,
			autoImport: parsedDocument.autoImport,
			styleColor: parsedDocument.styleColor,
			styleBorderColor: parsedDocument.styleBorderColor,
			styleRadius: parsedDocument.styleRadius,
			references: parsedDocument.references,
			methods: parsedDocument.methods,
			relationTargets: parsedDocument.relationTargets,
			extendsTargets: parsedDocument.extendsTargets,
			implementsTargets: parsedDocument.implementsTargets,
		});
	}

	return {
		entities: Array.from(entities.values()),
	};
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
