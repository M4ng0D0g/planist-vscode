/**
 * Command interaction controller for Planist VS Code commands.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
	normalizePlanistConfig,
	loadPlanistConfig,
	writePlanistConfig,
	type PlanistConfig,
	type PlanistBackgroundPattern,
} from '../config/planistConfig';

export class CommandController {
	// @state: green
	public static async handleCreateFlowFile(): Promise<void> {
		const fileUri = await promptPlanistFilePath('Create Flow File', 'new-flow.pln');
		if (!fileUri) {
			return;
		}

		const baseName = path.basename(fileUri.fsPath, '.pln');
		const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '') || 'Untitled';

		const template = `#schema flow ${safeName}

class Start {
	[Flow]
	-> Process
}

class Process {
	[Flow]
	-> Done
}

class Done {
}
`;

		try {
			fs.mkdirSync(path.dirname(fileUri.fsPath), { recursive: true });
			fs.writeFileSync(fileUri.fsPath, template, 'utf8');
			const doc = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(doc);
		} catch (err: any) {
			vscode.window.showErrorMessage(`Failed to create flow file: ${err?.message || err}`);
		}
	}

	// @state: green
	public static async handleCreateDocsFile(): Promise<void> {
		const fileUri = await promptPlanistFilePath('Create Docs File', 'new-docs.pln');
		if (!fileUri) {
			return;
		}

		const baseName = path.basename(fileUri.fsPath, '.pln');
		const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '') || 'Untitled';

		const template = `#schema docs ${safeName}

page "1. Overview" outline
---
# Overview
Write with **Markdown** here.

- Add notes
- Add headings
- Mark this page as an outline entry

===

page "2. Details"
---
## Details
Use the page separator above whenever you want a new Word-like page.
`;

		try {
			fs.mkdirSync(path.dirname(fileUri.fsPath), { recursive: true });
			fs.writeFileSync(fileUri.fsPath, template, 'utf8');
			const doc = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(doc);
		} catch (err: any) {
			vscode.window.showErrorMessage(`Failed to create docs file: ${err?.message || err}`);
		}
	}

	// @state: yellow
	public static async handleCreateUIDesignFile(): Promise<void> {
		const fileUri = await promptPlanistFilePath('Create UI Design File', 'new-ui.pln');
		if (!fileUri) {
			return;
		}

		const baseName = path.basename(fileUri.fsPath, '.pln');
		const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '') || 'Untitled';

		const template = `#schema design ${safeName}

config {
    background: "grid"
    primaryColor: "#3b82f6"
    backgroundColor: "#111827"
}

panel MainWindow {
    width: 800
    height: 600
    grid RootGrid {
        rows: "auto, *"
        columns: "*"
        
        stackPanel Header {
            grid.row: 0
            orientation: "horizontal"
            padding: 12
            backgroundColor: "#1f2937"
            
            textBlock Title {
                text: "My Application"
                fontSize: 16
            }
        }
    }
}
`;

		try {
			fs.mkdirSync(path.dirname(fileUri.fsPath), { recursive: true });
			fs.writeFileSync(fileUri.fsPath, template, 'utf8');
			const doc = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(doc);
		} catch (err: any) {
			vscode.window.showErrorMessage(`Failed to create UI design file: ${err?.message || err}`);
		}
	}

	// @state: green
	public static async handleConfigureAppearance(): Promise<void> {
		const currentConfig = await loadPlanistConfig();
		const backgroundColor = await promptInput('Background color (RGB/RGBA/Hex)', currentConfig.appearance.backgroundColor);
		if (!backgroundColor) {
			return;
		}

		const backgroundPattern = await promptPattern(currentConfig.appearance.backgroundPattern);
		if (!backgroundPattern) {
			return;
		}

		const dots = backgroundPattern === 'dots'
			? await buildDotsConfig(currentConfig)
			: currentConfig.appearance.dots;
		if (!dots) {
			return;
		}

		const grid = backgroundPattern === 'grid'
			? await buildGridConfig(currentConfig)
			: currentConfig.appearance.grid;
		if (!grid) {
			return;
		}

		const entityCornerRadius = await promptNumber('Entity corner radius', currentConfig.appearance.entity.cornerRadius);
		if (entityCornerRadius === undefined) {
			return;
		}

		const entityBorderColor = await promptInput('Entity border color', currentConfig.appearance.entity.borderColor);
		if (!entityBorderColor) {
			return;
		}

		const typeColorsInput = await promptInput(
			'Entity type colors JSON',
			JSON.stringify(currentConfig.appearance.entity.typeColors, null, 2),
		);

		if (!typeColorsInput) {
			return;
		}

		let typeColors: PlanistConfig['appearance']['entity']['typeColors'];
		try {
			typeColors = JSON.parse(typeColorsInput) as PlanistConfig['appearance']['entity']['typeColors'];
		} catch {
			vscode.window.showErrorMessage('Entity type colors must be valid JSON.');
			return;
		}

		const nextConfig = normalizePlanistConfig({
			version: 1,
			appearance: {
				backgroundColor,
				backgroundPattern,
				dots,
				grid,
				entity: {
					cornerRadius: entityCornerRadius,
					borderColor: entityBorderColor,
					typeColors,
					typeBorderColors: currentConfig.appearance.entity.typeBorderColors,
				},
			},
		});

		await writePlanistConfig(nextConfig);
		vscode.window.showInformationMessage('Planist appearance settings updated.');
	}
}

// @state: red
async function promptPlanistFilePath(title: string, defaultFileName: string): Promise<vscode.Uri | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	let rootUri: vscode.Uri | undefined;

	if (workspaceFolders.length === 1) {
		rootUri = workspaceFolders[0].uri;
	} else if (workspaceFolders.length > 1) {
		const selected = await vscode.window.showQuickPick(
			workspaceFolders.map(folder => ({
				label: folder.name,
				description: folder.uri.fsPath,
				uri: folder.uri,
			})),
			{
				placeHolder: `${title}: choose a workspace folder`,
			},
		);
		rootUri = selected?.uri;
	}

	// 1. Ask for file name first
	const fileNameInput = await vscode.window.showInputBox({
		prompt: `${title}: enter a file name`,
		value: defaultFileName,
		placeHolder: defaultFileName,
		validateInput: value => {
			const trimmed = value.trim();
			if (!trimmed) {
				return 'Enter a file name.';
			}
			if (/[<>:"|?*/\\]/.test(trimmed)) {
				return 'The file name contains invalid characters.';
			}
			return undefined;
		}
	});

	if (!fileNameInput) {
		return undefined;
	}

	const fileName = ensurePlanistExtension(fileNameInput.trim());

	// 2. Select folder location
	if (!rootUri) {
		// Fallback if no workspace folder is open
		const absInput = await vscode.window.showInputBox({
			prompt: `${title}: Enter absolute directory path to create the file in`,
			placeHolder: 'C:\\Projects',
		});
		if (!absInput) {
			return undefined;
		}
		return vscode.Uri.file(path.resolve(absInput.trim(), fileName));
	}

	const folderUri = await promptDirectorySelection(title, rootUri);
	if (!folderUri) {
		return undefined;
	}

	return vscode.Uri.file(path.resolve(folderUri.fsPath, fileName));
}

// @state: yellow
async function promptDirectorySelection(title: string, rootUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	let currentDir = rootUri.fsPath;

	while (true) {
		const items: { label: string; description?: string; isDir: boolean; path: string }[] = [];
		const relPath = path.relative(rootUri.fsPath, currentDir) || '.';

		// Option to select the current directory
		items.push({
			label: `📁 Select this folder: ${relPath}`,
			isDir: false,
			path: currentDir,
		});

		// Parent directory option if not at the rootUri
		if (currentDir !== rootUri.fsPath) {
			items.push({
				label: '📁 .. (Up)',
				isDir: true,
				path: path.dirname(currentDir),
			});
		}

		// List subfolders
		try {
			const files = fs.readdirSync(currentDir, { withFileTypes: true });
			const folders = files
				.filter(file => file.isDirectory() && !file.name.startsWith('.'))
				.sort((a, b) => a.name.localeCompare(b.name));

			folders.forEach(f => {
				const fullPath = path.join(currentDir, f.name);
				const rel = path.relative(rootUri.fsPath, fullPath);
				items.push({
					label: `📁 ${f.name}/`,
					description: rel,
					isDir: true,
					path: fullPath,
				});
			});
		} catch (e) {
			vscode.window.showErrorMessage(`Failed to read folder: ${e}`);
			return undefined;
		}

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: `${title}: Choose folder location (currently: ${relPath})`,
			ignoreFocusOut: true,
		});

		if (!selected) {
			return undefined;
		}

		if (selected.isDir) {
			currentDir = selected.path;
		} else {
			return vscode.Uri.file(selected.path);
		}
	}
}

// @state: green
function validatePlanistFilePath(value: string, rootUri: vscode.Uri | undefined): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return 'Enter a file path.';
	}

	if (/[<>:"|?*]/.test(trimmed.replace(/^[A-Za-z]:/, ''))) {
		return 'The path contains characters that are not allowed in file names.';
	}

	const withExtension = ensurePlanistExtension(trimmed);
	if (path.extname(withExtension).toLowerCase() !== '.pln') {
		return 'Planist files must use the .pln extension.';
	}

	if (rootUri) {
		if (path.isAbsolute(withExtension)) {
			return 'Enter a path relative to the selected workspace folder.';
		}

		const resolved = path.resolve(rootUri.fsPath, withExtension);
		const rootPath = path.resolve(rootUri.fsPath);
		if (resolved !== rootPath && !resolved.startsWith(rootPath + path.sep)) {
			return 'The path must stay inside the selected workspace folder.';
		}
	}

	return undefined;
}

// @state: green
function ensurePlanistExtension(filePath: string): string {
	return path.extname(filePath) ? filePath : `${filePath}.pln`;
}

// @state: green
async function promptInput(label: string, defaultValue: string): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: label,
		value: defaultValue,
	});
}

// @state: green
async function promptNumber(label: string, defaultValue: number): Promise<number | undefined> {
	while (true) {
		const input = await vscode.window.showInputBox({
			prompt: label,
			value: String(defaultValue),
		});
		if (input === undefined) {
			return undefined;
		}

		const parsed = Number(input);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}

		vscode.window.showErrorMessage(`${label} must be a positive number.`);
	}
}

// @state: green
async function promptPattern(defaultValue: PlanistBackgroundPattern): Promise<PlanistBackgroundPattern | undefined> {
	const selected = await vscode.window.showQuickPick(
		[
			{ label: 'dots', value: 'dots' as const },
			{ label: 'grid', value: 'grid' as const },
			{ label: 'none', value: 'none' as const },
		],
		{
			placeHolder: 'Choose a background pattern',
		},
	);

	return selected?.value ?? defaultValue;
}

// @state: green
async function buildDotsConfig(currentConfig: Awaited<ReturnType<typeof loadPlanistConfig>>) {
	const color = await promptInput('Dot color', currentConfig.appearance.dots.color);
	if (!color) {
		return undefined;
	}

	const size = await promptNumber('Dot size', currentConfig.appearance.dots.size);
	const spacing = await promptNumber('Dot spacing', currentConfig.appearance.dots.spacing);
	if (size === undefined || spacing === undefined) {
		return undefined;
	}

	return {
		size,
		spacing,
		color,
	};
}

// @state: green
async function buildGridConfig(currentConfig: Awaited<ReturnType<typeof loadPlanistConfig>>) {
	const majorColor = await promptInput('Major grid color', currentConfig.appearance.grid.majorColor);
	if (!majorColor) {
		return undefined;
	}

	const minorColor = await promptInput('Minor grid color', currentConfig.appearance.grid.minorColor);
	if (!minorColor) {
		return undefined;
	}

	const majorLineWidth = await promptNumber('Major grid line width', currentConfig.appearance.grid.majorLineWidth);
	const minorLineWidth = await promptNumber('Minor grid line width', currentConfig.appearance.grid.minorLineWidth);
	const majorSpacing = await promptNumber('Major grid spacing', currentConfig.appearance.grid.majorSpacing);
	const minorSpacing = await promptNumber('Minor grid spacing', currentConfig.appearance.grid.minorSpacing);
	if (
		majorLineWidth === undefined
		|| minorLineWidth === undefined
		|| majorSpacing === undefined
		|| minorSpacing === undefined
	) {
		return undefined;
	}

	return {
		majorLineWidth,
		minorLineWidth,
		majorSpacing,
		minorSpacing,
		majorColor,
		minorColor,
	};
}
