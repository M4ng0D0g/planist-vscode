import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function getWorkspaceRootPath(): string | undefined {
	const folders = vscode.workspace.workspaceFolders;
	return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

export function loadShortcuts(): Record<string, string> {
	const root = getWorkspaceRootPath();
	if (!root) {
		return {};
	}
	const configDir = path.join(root, '.planist');
	const filePath = path.join(configDir, 'shortcuts.json');
	try {
		if (!fs.existsSync(filePath)) {
			// Auto-generate default shortcuts.json
			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true });
			}
			const defaultShortcuts = {
				"@include": "./include"
			};
			fs.writeFileSync(filePath, JSON.stringify(defaultShortcuts, null, 4), 'utf8');
			return defaultShortcuts;
		}
		const content = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(content);
	} catch (e) {
		console.error("Error loading shortcuts:", e);
		return {};
	}
}

export function resolveShortcutPath(inputPath: string, docUri?: vscode.Uri): string {
	if (inputPath.startsWith('@')) {
		const shortcuts = loadShortcuts();
		for (const key of Object.keys(shortcuts)) {
			if (inputPath === key || inputPath.startsWith(key + '/') || inputPath.startsWith(key + '\\')) {
				const replacement = shortcuts[key];
				const root = getWorkspaceRootPath() || '';
				const resolvedBase = path.isAbsolute(replacement) ? replacement : path.resolve(root, replacement);
				const remaining = inputPath.substring(key.length);
				return path.join(resolvedBase, remaining);
			}
		}
		// If not matched by shortcuts, treat @ as workspace root
		const root = getWorkspaceRootPath() || '';
		const remaining = inputPath.startsWith('@/') || inputPath.startsWith('@\\') ? inputPath.substring(2) : inputPath.substring(1);
		return path.join(root, remaining);
	}
	// Resolve relative paths if a document URI is provided
	if (docUri) {
		return path.resolve(path.dirname(docUri.fsPath), inputPath);
	}
	// Fallback: resolve relative to workspace root if path is relative and no docUri provided
	if (!path.isAbsolute(inputPath)) {
		const root = getWorkspaceRootPath() || '';
		return path.resolve(root, inputPath);
	}
	return inputPath;
}
