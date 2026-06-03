/**
 * ============================================================================
 * 模組定位：Planist 智慧輸入自動補全提供者 (src/providers/completionProvider.ts)
 * 
 * 此檔案負責註冊並實現 VS Code 的 `CompletionItemProvider` 介面。當用戶在編輯器內
 * 輸入指向關係 `->` 或存取符號 `.` 時，動態分析上下文，自動推薦專案中定義的實體、方法、
 * UML 關係操作符或代碼區塊範本片段（Snippets）。
 * 
 * 重要類別與函數：
 * - FlowCompletionItemProvider: VS Code 補全引擎對接提供者。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的程式碼片段推薦（如新的 `divider` 語法快速輸入），可在 `provideCompletionItems()`
 *    內部的 Outside/Inside 邏輯區段中，新增 `vscode.CompletionItem` 並以 SnippetString 定義。
 * 2. 方法或實體的 autocomplete 推薦圖標，可透過調整 `vscode.CompletionItemKind` 來微調。
 * ============================================================================
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FlowIndexer } from '../indexing/flowIndexer';
import { findReferenceAtPosition, FLOW_LANGUAGE_ID } from '../dsl/flowDsl';
import { PatternManager } from '../config/patternManager';

export class FlowCompletionItemProvider implements vscode.CompletionItemProvider {
	constructor(private indexer: FlowIndexer) {}

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext
	): vscode.CompletionItem[] | undefined {
		if (!/^\s*#schema flow/.test(document.getText())) {
			return undefined;
		}

		// [除錯日誌] 紀錄輸入參數
		LogManager.log('FlowCompletionItemProvider.provideCompletionItems: start. DocUri:', document.uri.fsPath, 'Position:', position);

		// [參數驗證]
		LogManager.assert(!!document, 'FlowCompletionItemProvider.provideCompletionItems: document cannot be null');
		LogManager.assert(!!position, 'FlowCompletionItemProvider.provideCompletionItems: position cannot be null');

		const linePrefix = document.lineAt(position).text.substring(0, position.character);

		// 1. 方法補全：例如 "-> Entity." 之後按點字元
		const methodMatch = linePrefix.match(/->\s*([A-Za-z_][\w-]*)\.([A-Za-z_0-9-]*)$/);
		if (methodMatch) {
			const entityName = methodMatch[1];
			LogManager.log('FlowCompletionItemProvider: matching method auto-complete for entity:', entityName);
			const entity = this.indexer.getEntity(entityName);
			if (entity) {
				const items: vscode.CompletionItem[] = [];
				for (const method of entity.methods) {
					const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
					item.detail = `+ ${method.name}(${method.parameters ? method.parameters.join(', ') : ''})`;
					item.documentation = new vscode.MarkdownString(`方法定義於實體 **${entityName}**`);
					item.insertText = method.name;
					items.push(item);
				}
				LogManager.log('FlowCompletionItemProvider: returned methods count:', items.length);
				return items;
			}
			return [];
		}

		// 2. 實體關係補全：例如 "-> " 之後推薦實體節點
		const entityMatch = linePrefix.match(/->\s*([A-Za-z_0-9-]*)$/);
		if (entityMatch) {
			LogManager.log('FlowCompletionItemProvider: matching relation auto-complete');
			const items: vscode.CompletionItem[] = [];
			for (const entity of this.indexer.getEntities()) {
				const item = new vscode.CompletionItem(entity.entityName, this.getCompletionItemKind(entity.kind));
				item.detail = entity.kind ? `${entity.kind} ${entity.entityName}` : entity.entityName;
				item.documentation = new vscode.MarkdownString(
					`**檔案：** [${path.basename(entity.uri.fsPath)}](${entity.uri.toString()})\n\n` +
					`**預覽內容：**\n\`\`\`flowlang\n${this.getPreview(entity.rawText)}\n\`\`\``
				);
				items.push(item);
			}
			LogManager.log('FlowCompletionItemProvider: returned entities count:', items.length);
			return items;
		}

		// 3. 判斷游標是否處於實體類別宣告內部，以區分補全種類
		let inClassBlock = false;
		const docTextBeforeCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
		const linesBefore = docTextBeforeCursor.split(/\r?\n/);
		let openBraces = 0;
		for (const line of linesBefore) {
			for (let i = 0; i < line.length; i++) {
				if (line[i] === '{') {
					openBraces++;
				}
				if (line[i] === '}') {
					openBraces--;
				}
			}
		}
		inClassBlock = openBraces > 0;

		const items: vscode.CompletionItem[] = [];

		if (inClassBlock) {
			LogManager.log('FlowCompletionItemProvider: inside class block auto-complete');
			
			// Check for pattern snippets
			const patternName = this.getCurrentPattern(linesBefore);
			if (patternName) {
				const config = PatternManager.loadPatterns()[patternName];
				if (config && config.suggested_elements) {
					const methods = config.suggested_elements.methods || [];
					const relations = config.suggested_elements.relations || [];
					
					if (methods.length > 0 || relations.length > 0) {
						const snippetText = [...methods, ...relations].join('\n');
						const patternItem = new vscode.CompletionItem(`Implement ${patternName} pattern`, vscode.CompletionItemKind.Snippet);
						patternItem.insertText = new vscode.SnippetString(snippetText);
						patternItem.detail = `Auto-generate boilerplate for ${patternName}`;
						patternItem.preselect = true;
						patternItem.sortText = '!00000_pattern'; 
						items.push(patternItem);
					}
				}
			}
			
			// 類別區塊內部補全
			// 存取修飾詞
			const pub = new vscode.CompletionItem('public', vscode.CompletionItemKind.Keyword);
			pub.insertText = 'public ';
			const pri = new vscode.CompletionItem('private', vscode.CompletionItemKind.Keyword);
			pri.insertText = 'private ';
			const pro = new vscode.CompletionItem('protected', vscode.CompletionItemKind.Keyword);
			pro.insertText = 'protected ';

			// 簡短存取修飾符號 (UML)
			const pubSym = new vscode.CompletionItem('+', vscode.CompletionItemKind.Keyword);
			pubSym.insertText = '+';
			pubSym.detail = 'public shorthand';
			const priSym = new vscode.CompletionItem('-', vscode.CompletionItemKind.Keyword);
			priSym.insertText = '-';
			priSym.detail = 'private shorthand';
			const proSym = new vscode.CompletionItem('#', vscode.CompletionItemKind.Keyword);
			proSym.insertText = '#';
			proSym.detail = 'protected shorthand';

			items.push(pub, pri, pro, pubSym, priSym, proSym);

			// 修飾關鍵字 (field & method)
			const fin = new vscode.CompletionItem('final', vscode.CompletionItemKind.Keyword);
			fin.insertText = 'final ';
			fin.detail = '不可重新賦值但可修改';
			const stat = new vscode.CompletionItem('static', vscode.CompletionItemKind.Keyword);
			stat.insertText = 'static ';
			const cst = new vscode.CompletionItem('const', vscode.CompletionItemKind.Keyword);
			cst.insertText = 'const ';
			const vr = new vscode.CompletionItem('variable', vscode.CompletionItemKind.Keyword);
			vr.insertText = 'variable ';

			items.push(fin, stat, cst, vr);

			// UML 箭頭與關係關鍵字
			const ext = new vscode.CompletionItem('extends ->', vscode.CompletionItemKind.Interface);
			ext.insertText = 'extends -> ';
			const imp = new vscode.CompletionItem('implements ->', vscode.CompletionItemKind.Interface);
			imp.insertText = 'implements -> ';
			const inh = new vscode.CompletionItem('inherits ->', vscode.CompletionItemKind.Interface);
			inh.insertText = 'inherits -> ';
			const asc = new vscode.CompletionItem('associates ->', vscode.CompletionItemKind.Interface);
			asc.insertText = 'associates -> ';
			const agg = new vscode.CompletionItem('aggregates ->', vscode.CompletionItemKind.Interface);
			agg.insertText = 'aggregates -> ';
			const cmp = new vscode.CompletionItem('composes ->', vscode.CompletionItemKind.Interface);
			cmp.insertText = 'composes -> ';
			const dep = new vscode.CompletionItem('dependsOn ->', vscode.CompletionItemKind.Interface);
			dep.insertText = 'dependsOn -> ';
			items.push(ext, imp, inh, asc, agg, cmp, dep);

			// 方法片段 Snippet
			const methodSnippet = new vscode.CompletionItem('method definition', vscode.CompletionItemKind.Snippet);
			methodSnippet.detail = 'public myMethod(param) { ... }';
			methodSnippet.insertText = new vscode.SnippetString('public ${1:methodName}(${2:param}) {\n\t$0\n}');
			
			// 分隔線 Snippet
			const dividerSnippet = new vscode.CompletionItem('divider', vscode.CompletionItemKind.Snippet);
			dividerSnippet.detail = '--- center: 分隔線名稱 ---';
			dividerSnippet.insertText = new vscode.SnippetString('--- ${1|center,left,right|}: ${2:標題} ---');

			items.push(methodSnippet, dividerSnippet);
		} else {
			LogManager.log('FlowCompletionItemProvider: outside class block auto-complete');
			// 類別區塊外部補全
			// 存取修飾詞
			const pub = new vscode.CompletionItem('public', vscode.CompletionItemKind.Keyword);
			pub.insertText = 'public ';
			const pri = new vscode.CompletionItem('private', vscode.CompletionItemKind.Keyword);
			pri.insertText = 'private ';
			const pro = new vscode.CompletionItem('protected', vscode.CompletionItemKind.Keyword);
			pro.insertText = 'protected ';

			// 簡短存取修飾符號 (UML)
			const pubSym = new vscode.CompletionItem('+', vscode.CompletionItemKind.Keyword);
			pubSym.insertText = '+';
			pubSym.detail = 'public shorthand';
			const priSym = new vscode.CompletionItem('-', vscode.CompletionItemKind.Keyword);
			priSym.insertText = '-';
			priSym.detail = 'private shorthand';
			const proSym = new vscode.CompletionItem('#', vscode.CompletionItemKind.Keyword);
			proSym.insertText = '#';
			proSym.detail = 'protected shorthand';

			items.push(pub, pri, pro, pubSym, priSym, proSym);

			// 特徵配置片段 Snippet
			const referenceSnippet = new vscode.CompletionItem('#reference snippet', vscode.CompletionItemKind.Snippet);
			referenceSnippet.detail = '#reference "file_path"';
			referenceSnippet.insertText = new vscode.SnippetString('#reference "${1:file_path}"');
			items.push(referenceSnippet);

			// 實體結構宣告 Snippets
			const classSnippet = new vscode.CompletionItem('class declaration', vscode.CompletionItemKind.Snippet);
			classSnippet.detail = 'class MyClass { ... }';
			classSnippet.insertText = new vscode.SnippetString('class ${1:ClassName} {\n\t$0\n}');

			const abstractSnippet = new vscode.CompletionItem('abstract declaration', vscode.CompletionItemKind.Snippet);
			abstractSnippet.detail = 'abstract MyClass { ... }';
			abstractSnippet.insertText = new vscode.SnippetString('abstract ${1:ClassName} {\n\t$0\n}');

			const interfaceSnippet = new vscode.CompletionItem('interface declaration', vscode.CompletionItemKind.Snippet);
			interfaceSnippet.detail = 'interface MyInterface { ... }';
			interfaceSnippet.insertText = new vscode.SnippetString('interface ${1:InterfaceName} {\n\t$0\n}');

			const recordSnippet = new vscode.CompletionItem('record declaration', vscode.CompletionItemKind.Snippet);
			recordSnippet.detail = 'record MyRecord { ... }';
			recordSnippet.insertText = new vscode.SnippetString('record ${1:RecordName} {\n\t$0\n}');

			const enumSnippet = new vscode.CompletionItem('enum declaration', vscode.CompletionItemKind.Snippet);
			enumSnippet.detail = 'enum MyEnum { ... }';
			enumSnippet.insertText = new vscode.SnippetString('enum ${1:EnumName} {\n\t$0\n}');

			const textSnippet = new vscode.CompletionItem('text declaration', vscode.CompletionItemKind.Snippet);
			textSnippet.detail = 'text MyFlow { ... }';
			textSnippet.insertText = new vscode.SnippetString('text ${1:FlowName} {\n\ttitle: ${1:FlowName} core flow\n\t$0\n}');

			const bindSnippet = new vscode.CompletionItem('bind declaration', vscode.CompletionItemKind.Snippet);
			bindSnippet.detail = 'bind BindName';
			bindSnippet.insertText = new vscode.SnippetString('bind ${1:BindName}');

			const packageSnippet = new vscode.CompletionItem('package declaration', vscode.CompletionItemKind.Snippet);
			packageSnippet.detail = 'package MyPackage { ... }';
			packageSnippet.insertText = new vscode.SnippetString('package ${1:PackageName} {\n\tdisplay: "${2:DisplayName}"\n\t$0\n}');

			const moduleSnippet = new vscode.CompletionItem('module declaration', vscode.CompletionItemKind.Snippet);
			moduleSnippet.detail = 'module MyModule { ... }';
			moduleSnippet.insertText = new vscode.SnippetString('module ${1:ModuleName} {\n\tdisplay: "${2:DisplayName}"\n\t$0\n}');

			items.push(classSnippet, abstractSnippet, interfaceSnippet, recordSnippet, enumSnippet, textSnippet, bindSnippet, packageSnippet, moduleSnippet);
		}

		// [流程驗證] 驗證是否成功取得補全項目陣列
		LogManager.assert(Array.isArray(items), 'FlowCompletionItemProvider: output must be an array');
		LogManager.log('FlowCompletionItemProvider: completed. Suggestions count:', items.length);

		return items;
	}

	private getCurrentPattern(linesBefore: string[]): string | undefined {
		for (let i = linesBefore.length - 1; i >= 0; i--) {
			const line = linesBefore[i];
			if (/(?:class|abstract|interface|record|enum|text|bind)\s+[A-Za-z_][\w-]*\s*\{?/.test(line)) {
				for (let j = i - 1; j >= 0; j--) {
					const tagMatch = linesBefore[j].match(/^@pattern\s*\(\s*["']([^"']+)["']\s*\)/i);
					if (tagMatch) {
						return tagMatch[1];
					}
					if (linesBefore[j].trim() === '' || linesBefore[j].trim().startsWith('//')) {
						continue;
					}
					break;
				}
				break;
			}
		}
		return undefined;
	}

	private getCompletionItemKind(kind: string | null): vscode.CompletionItemKind {
		switch (kind) {
			case 'class': return vscode.CompletionItemKind.Class;
			case 'abstract': return vscode.CompletionItemKind.Class;
			case 'interface': return vscode.CompletionItemKind.Interface;
			case 'record': return vscode.CompletionItemKind.Struct;
			case 'enum': return vscode.CompletionItemKind.Enum;
			case 'text': return vscode.CompletionItemKind.Text;
			case 'bind': return vscode.CompletionItemKind.Class;
			case 'package': return vscode.CompletionItemKind.Module;
			case 'module': return vscode.CompletionItemKind.Module;
			default: return vscode.CompletionItemKind.Class;
		}
	}

	private getPreview(text: string): string {
		const lines = text.split(/\r?\n/);
		const filteredLines = lines
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && l !== '{' && l !== '}')
			.slice(0, 5);
		return filteredLines.join('\n');
	}
}
