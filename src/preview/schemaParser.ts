import {
	FlowFieldDefinition,
	FlowMethodCall
} from '../dsl/flowDsl';

export interface DesignConfig {
	[key: string]: string | number;
}
export interface UIComponent {
	type: string;
	name: string;
	properties: { [key: string]: string | number };
	children: UIComponent[];
}
export interface UITemplate {
	name: string;
	rootComponent: UIComponent;
}
export interface DesignSchemaData {
	themeName: string;
	config: DesignConfig;
	panels: UIComponent[];
	templates: UITemplate[];
}

export interface TaskItem {
	text: string;
	target?: string;
}
export interface TaskSchemaData {
	boardName: string;
	todo: TaskItem[];
	in_progress: TaskItem[];
	done: TaskItem[];
}

export interface ApiRoute {
	method: string;
	path: string;
	request?: string;
	response?: string;
	handler?: string;
}
export interface ApiSchemaData {
	apiName: string;
	baseUrl: string;
	routes: ApiRoute[];
}

export interface StateTransition {
	event: string;
	target: string;
}
export interface StateBlock {
	name: string;
	transitions: StateTransition[];
}
export interface StateSchemaData {
	stateMachineName: string;
	initialState: string;
	states: StateBlock[];
}

export interface DbColumn {
	name: string;
	type: string;
	constraints: string[];
	fkTarget?: string;
}
export interface DbTable {
	name: string;
	columns: DbColumn[];
}
export interface DatabaseSchemaData {
	dbName: string;
	tables: DbTable[];
}

export interface DocPage {
	title: string;
	isOutline: boolean;
	content: string;
}
export interface DocsSchemaData {
	docName: string;
	pages: DocPage[];
}

export function parseSchemaDocument(schema: string, text: string): any {
	switch (schema.toLowerCase()) {
		case 'design':
			return parseDesignSchema(text);
		case 'task':
			return parseTaskSchema(text);
		case 'api':
			return parseApiSchema(text);
		case 'state':
			return parseStateSchema(text);
		case 'database':
			return parseDatabaseSchema(text);
		case 'docs':
			return parseDocsSchema(text);
		default:
			return {};
	}
}

function parseDesignSchema(text: string): DesignSchemaData {
	const lines = text.split(/\r?\n/);
	let themeName = '';
	const config: DesignConfig = {};
	const panels: UIComponent[] = [];
	const templates: UITemplate[] = [];

	const schemaMatch = text.match(/^\s*#schema\s+design\s+([A-Za-z0-9_-]+)/i);
	if (schemaMatch) {
		themeName = schemaMatch[1];
	}

	const stack: any[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith('//') || trimmed.startsWith('#schema') || !trimmed) {
			continue;
		}

		if (trimmed === 'config {') {
			stack.push({ type: 'config', properties: {} });
			continue;
		}

		const templateMatch = trimmed.match(/^template\s+([A-Za-z0-9_-]+)\s*\{/i);
		if (templateMatch) {
			stack.push({ type: 'template', name: templateMatch[1], rootComponent: null });
			continue;
		}

		const compMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s*\{/i);
		if (compMatch) {
			const compType = compMatch[1];
			const compName = compMatch[2];
			const newComp: UIComponent = {
				type: compType,
				name: compName,
				properties: {},
				children: []
			};

			const parent = stack[stack.length - 1];
			if (parent) {
				if (parent.type === 'template') {
					if (!parent.rootComponent) {
						parent.rootComponent = newComp;
					} else {
						parent.rootComponent.children.push(newComp);
					}
				} else if (parent.children) {
					parent.children.push(newComp);
				}
			}

			stack.push(newComp);
			continue;
		}

		if (trimmed === '}') {
			const popped = stack.pop();
			if (popped) {
				if (popped.type === 'config') {
					Object.assign(config, popped.properties);
				} else if (popped.type === 'template') {
					templates.push({
						name: popped.name,
						rootComponent: popped.rootComponent || { type: 'stackPanel', name: 'Empty', properties: {}, children: [] }
					});
				} else if (stack.length === 0) {
					panels.push(popped);
				}
			}
			continue;
		}

		const propMatch = trimmed.match(/^([A-Za-z0-9_\.-]+)\s*:\s*(.+)$/);
		if (propMatch) {
			const key = propMatch[1];
			let valStr = propMatch[2].replace(/,$/, '').trim();
			if (valStr.startsWith('"') && valStr.endsWith('"')) {
				valStr = valStr.substring(1, valStr.length - 1);
			}
			const numVal = Number(valStr);
			const finalVal = isNaN(numVal) ? valStr : numVal;

			const current = stack[stack.length - 1];
			if (current) {
				if (current.type === 'config') {
					current.properties[key] = finalVal;
				} else if (current.properties) {
					current.properties[key] = finalVal;
				}
			}
		}
	}

	return { themeName, config, panels, templates };
}

function parseTaskSchema(text: string): TaskSchemaData {
	let boardName = '';
	const schemaMatch = text.match(/^\s*#schema\s+task\s+([A-Za-z0-9_-]+)/i);
	if (schemaMatch) {
		boardName = schemaMatch[1];
	}

	const todo: TaskItem[] = [];
	const in_progress: TaskItem[] = [];
	const done: TaskItem[] = [];

	const parseList = (sectionName: string): TaskItem[] => {
		const regex = new RegExp(`${sectionName}\\s*:\\s*\\[([^\\]]*)\\]`, 'is');
		const match = text.match(regex);
		if (!match) return [];
		
		const itemsText = match[1];
		const lines = itemsText.split(/\r?\n/);
		const result: TaskItem[] = [];
		for (const line of lines) {
			const trimmed = line.trim().replace(/^-\s*/, '').replace(/,$/, '').trim();
			if (!trimmed) continue;
			const linkMatch = trimmed.match(/^(.+?)\s*->\s*([A-Za-z0-9_\.]+)\s*$/);
			if (linkMatch) {
				result.push({
					text: linkMatch[1].trim(),
					target: linkMatch[2].trim()
				});
			} else {
				result.push({
					text: trimmed
				});
			}
		}
		return result;
	};

	return {
		boardName,
		todo: parseList('todo'),
		in_progress: parseList('in_progress'),
		done: parseList('done')
	};
}

function parseApiSchema(text: string): ApiSchemaData {
	let apiName = '';
	const schemaMatch = text.match(/^\s*#schema\s+api\s+([A-Za-z0-9_-]+)/i);
	if (schemaMatch) {
		apiName = schemaMatch[1];
	}

	let baseUrl = '';
	const baseUrlMatch = text.match(/baseUrl\s*:\s*["']?([^"'\r\n]+)["']?/i);
	if (baseUrlMatch) {
		baseUrl = baseUrlMatch[1];
	}

	const routes: ApiRoute[] = [];
	const routeRegex = /(GET|POST|PUT|DELETE|PATCH)\s+([^\s{]+)\s*\{([^}]*)\}/gis;
	let match;
	while ((match = routeRegex.exec(text)) !== null) {
		const method = match[1];
		const path = match[2];
		const body = match[3];

		const route: ApiRoute = { method, path };
		
		const reqMatch = body.match(/request\s*:\s*({[^}]+})/s);
		if (reqMatch) {
			route.request = reqMatch[1].trim();
		} else {
			const reqLineMatch = body.match(/request\s*:\s*(.+)$/m);
			if (reqLineMatch) route.request = reqLineMatch[1].trim();
		}

		const resMatch = body.match(/response\s*:\s*({[^}]+})/s);
		if (resMatch) {
			route.response = resMatch[1].trim();
		} else {
			const resLineMatch = body.match(/response\s*:\s*(.+)$/m);
			if (resLineMatch) route.response = resLineMatch[1].trim();
		}

		const handlerMatch = body.match(/handler\s*:\s*->\s*([A-Za-z0-9_\.]+)/i);
		if (handlerMatch) {
			route.handler = handlerMatch[1].trim();
		}

		routes.push(route);
	}

	return { apiName, baseUrl, routes };
}

function parseStateSchema(text: string): StateSchemaData {
	let stateMachineName = '';
	const schemaMatch = text.match(/^\s*#schema\s+state\s+([A-Za-z0-9_-]+)/i);
	if (schemaMatch) {
		stateMachineName = schemaMatch[1];
	}

	let initialState = '';
	const initialMatch = text.match(/initial\s*:\s*([A-Za-z0-9_-]+)/i);
	if (initialMatch) {
		initialState = initialMatch[1];
	}

	const states: StateBlock[] = [];
	const stateRegex = /state\s+([A-Za-z0-9_-]+)\s*\{([^}]+)\}/gis;
	let match;
	while ((match = stateRegex.exec(text)) !== null) {
		const name = match[1];
		const body = match[2];
		const transitions: StateTransition[] = [];

		const lines = body.split(/\r?\n/);
		for (const line of lines) {
			const transitionMatch = line.match(/on\s+([A-Za-z0-9_-]+)\s*->\s*([A-Za-z0-9_-]+)/i);
			if (transitionMatch) {
				transitions.push({
					event: transitionMatch[1],
					target: transitionMatch[2]
				});
			}
		}

		states.push({ name, transitions });
	}

	return { stateMachineName, initialState, states };
}

function parseDatabaseSchema(text: string): DatabaseSchemaData {
	let dbName = '';
	const schemaMatch = text.match(/^\s*#schema\s+database\s+([A-Za-z0-9_-]+)/i);
	if (schemaMatch) {
		dbName = schemaMatch[1];
	}

	const tables: DbTable[] = [];
	const tableRegex = /table\s+([A-Za-z0-9_-]+)\s*\{([^}]+)\}/gis;
	let match;
	while ((match = tableRegex.exec(text)) !== null) {
		const name = match[1];
		const body = match[2];
		const columns: DbColumn[] = [];

		const lines = body.split(/\r?\n/);
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('//')) continue;

			const colMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_\(\)]+)(?:\s*\[(.*)\])?/i);
			if (colMatch) {
				const colName = colMatch[1];
				const colType = colMatch[2];
				const rawConstraints = colMatch[3] || '';
				
				const constraints = rawConstraints.split(',').map(c => c.trim()).filter(Boolean);
				let fkTarget: string | undefined;
				
				const fkMatch = rawConstraints.match(/fk\s*->\s*([A-Za-z0-9_\.]+)/i);
				if (fkMatch) {
					fkTarget = fkMatch[1];
				}

				columns.push({
					name: colName,
					type: colType,
					constraints,
					fkTarget
				});
			}
		}

		tables.push({ name, columns });
	}

	return { dbName, tables };
}

// @state: green
export function parseDocsSchema(text: string): DocsSchemaData {
	let docName = 'Untitled Document';
	const schemaMatch = text.match(/^\s*#schema\s+docs\s+([A-Za-z0-9_-]+)/i);
	if (schemaMatch) {
		docName = schemaMatch[1];
	}

	const pageBlocks = text.split(/^\s*===\s*$/m);
	const pages: DocPage[] = [];

	for (const block of pageBlocks) {
		const lines = block.split(/\r?\n/);
		let title = '';
		let isOutline = false;
		const contentLines: string[] = [];
		let foundContentSeparator = false;

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith('#schema')) {
				continue;
			}

			if (!foundContentSeparator) {
				const pageMatch = trimmed.match(/^page\s+["']([^"']+)["'](?:\s+(outline))?/i);
				if (pageMatch) {
					title = pageMatch[1];
					isOutline = !!pageMatch[2];
					continue;
				}
				if (trimmed === '---') {
					foundContentSeparator = true;
					continue;
				}
				if (trimmed !== '') {
					foundContentSeparator = true;
					contentLines.push(line);
				}
			} else {
				contentLines.push(line);
			}
		}

		const content = contentLines.join('\n').trim();
		if (title || content) {
			if (!title) {
				title = `Page ${pages.length + 1}`;
			}
			pages.push({
				title,
				isOutline,
				content
			});
		}
	}

	return { docName, pages };
}
