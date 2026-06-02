import * as path from 'path';
import * as vscode from 'vscode';

export type FlowDeclarationKind = 'class' | 'abstract' | 'interface' | 'record' | 'enum' | 'text';

export interface CreateFlowRequest {
	moduleName: string;
	entryName: string;
	declarationKind: FlowDeclarationKind;
}

export const PLANIST_ROOT_FOLDER = '.planist';
export const PLANIST_SYSTEM_FOLDER = '.system';
export const PLANIST_SUBFLOWS_FOLDER = '.subflows';
export const PLAN_FILE_EXTENSION = '.plan';

export function sanitizeSegment(value: string): string {
	return value
		.trim()
		.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
		.replace(/\s+/g, ' ')
		.replace(/^-+|-+$/g, '');
}

export function buildFlowTemplate(entryName: string, declarationKind: FlowDeclarationKind): string {
	if (declarationKind === 'text') {
		return [
			`text ${entryName} {`,
			'    title: ' + entryName + ' core flow',
			'',
			'    // 這裡可以自由撰寫 plaintext，仍可使用 -> 指向其他實體',
			'',
			'    -> NextStep',
			'}',
			'',
		].join('\n');
	}

	return [
		`${declarationKind} ${entryName} {`,
		'    bind: ""',
		'    autoImport: false',
		'',
		'    [Relations]',
		'    // 在此定義繼承、實作或一般關聯',
		'',
		'    [Methods]',
		'    // 在此定義方法與呼叫鏈',
		'}',
		'',
	].join('\n');
}

export async function createModuleStructure(request: CreateFlowRequest): Promise<vscode.Uri> {
	const workspaceRoot = getWorkspaceRoot();
	const safeModuleName = sanitizeSegment(request.moduleName);
	const safeEntryName = sanitizeSegment(request.entryName);

	if (!safeModuleName) {
		throw new Error('功能模組名稱不能為空');
	}

	if (!safeEntryName) {
		throw new Error('入口文件名稱不能為空');
	}

	const planistRootUri = vscode.Uri.file(path.join(workspaceRoot.fsPath, PLANIST_ROOT_FOLDER));
	const systemDirUri = vscode.Uri.file(path.join(planistRootUri.fsPath, PLANIST_SYSTEM_FOLDER));
	const moduleDirUri = vscode.Uri.file(path.join(planistRootUri.fsPath, safeModuleName));
	const subflowsDirUri = vscode.Uri.file(path.join(moduleDirUri.fsPath, PLANIST_SUBFLOWS_FOLDER));
	const entryFileUri = vscode.Uri.file(path.join(moduleDirUri.fsPath, `${safeEntryName}${PLAN_FILE_EXTENSION}`));

	await vscode.workspace.fs.createDirectory(planistRootUri);
	await vscode.workspace.fs.createDirectory(systemDirUri);
	await vscode.workspace.fs.createDirectory(moduleDirUri);
	await vscode.workspace.fs.createDirectory(subflowsDirUri);

	await ensureConfigFile(systemDirUri);
	await vscode.workspace.fs.writeFile(entryFileUri, Buffer.from(buildFlowTemplate(safeEntryName, request.declarationKind), 'utf8'));

	return entryFileUri;
}

function getWorkspaceRoot(): vscode.Uri {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		throw new Error('請先在 VS Code 中開啟一個專案資料夾');
	}

	return workspaceFolders[0].uri;
}

async function ensureConfigFile(systemDirUri: vscode.Uri): Promise<void> {
	const configUri = vscode.Uri.file(path.join(systemDirUri.fsPath, 'config.json'));
	try {
		await vscode.workspace.fs.stat(configUri);
	} catch {
		await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify({
			version: 1,
			appearance: {
				backgroundColor: 'rgb(26, 26, 26)',
				backgroundPattern: 'none',
				dots: {
					size: 2,
					spacing: 24,
					color: 'rgba(255, 255, 255, 0.12)',
				},
				grid: {
					majorLineWidth: 1,
					minorLineWidth: 1,
					majorSpacing: 120,
					minorSpacing: 24,
					majorColor: 'rgba(255, 255, 255, 0.18)',
					minorColor: 'rgba(255, 255, 255, 0.08)',
				},
				entity: {
					cornerRadius: 14,
					borderColor: '#005a9e',
					typeColors: {
						class: '#007acc',
						abstract: '#4f46e5',
						interface: '#16a34a',
						record: '#d97706',
						enum: '#db2777',
						text: '#6b7280',
					},
					typeBorderColors: {
						class: '#005a9e',
						abstract: '#3730a3',
						interface: '#15803d',
						record: '#b45309',
						enum: '#be185d',
						text: '#4b5563',
					},
				},
			},
		}, null, 2), 'utf8'));
	}
}
