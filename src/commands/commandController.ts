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

// @state: green
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

	const input = await vscode.window.showInputBox({
		prompt: rootUri
			? `${title}: enter a .pln path relative to ${path.basename(rootUri.fsPath)}`
			: `${title}: enter an absolute .pln file path`,
		value: defaultFileName,
		placeHolder: rootUri ? `flows/${defaultFileName}` : `C:\\Projects\\${defaultFileName}`,
		validateInput: value => validatePlanistFilePath(value, rootUri),
	});

	if (!input) {
		return undefined;
	}

	const normalizedInput = ensurePlanistExtension(input.trim());
	if (!rootUri) {
		return vscode.Uri.file(path.resolve(normalizedInput));
	}

	return vscode.Uri.file(path.resolve(rootUri.fsPath, normalizedInput));
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
