import * as vscode from 'vscode';
import { buildFlowTemplate, createModuleStructure, type FlowDeclarationKind } from './workspaceManager';
import {
	normalizePlanistConfig,
	loadPlanistConfig,
	writePlanistConfig,
	type PlanistConfig,
	type PlanistBackgroundPattern,
} from './planistConfig';

const declarationKinds: Array<{ label: string; value: FlowDeclarationKind; description: string }> = [
	{ label: 'class', value: 'class', description: '標準類別流程' },
	{ label: 'abstract', value: 'abstract', description: '抽象類別流程' },
	{ label: 'interface', value: 'interface', description: '介面定義' },
	{ label: 'record', value: 'record', description: '記錄型結構' },
	{ label: 'enum', value: 'enum', description: '列舉型結構' },
	{ label: 'text', value: 'text', description: '純文字流程' },
];

export class CommandController {
	public static async handleCreateFlow(): Promise<void> {
		const moduleName = await vscode.window.showInputBox({
			prompt: '請輸入功能模組名稱',
			placeHolder: 'OrderModule',
		});
		if (!moduleName) {
			return;
		}

		const entryName = await vscode.window.showInputBox({
			prompt: '請輸入入口文件名稱',
			placeHolder: 'OrderController',
		});
		if (!entryName) {
			return;
		}

		const selectedKind = await vscode.window.showQuickPick(declarationKinds, {
			placeHolder: '請選擇流程文件開頭類型',
		});
		if (!selectedKind) {
			return;
		}

		try {
			const fileUri = await createModuleStructure({
				moduleName,
				entryName,
				declarationKind: selectedKind.value,
			});

			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document, {
				preview: false,
			});
			vscode.window.showInformationMessage(`成功建立 ${entryName}.plan (${selectedKind.label})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : '未知錯誤';
			vscode.window.showErrorMessage(`建立失敗: ${message}`);
		}
	}

	public static async handleConfigureAppearance(): Promise<void> {
		const currentConfig = await loadPlanistConfig();
		const backgroundColor = await promptInput('背景顏色 (rgb)', currentConfig.appearance.backgroundColor);
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

		const entityCornerRadius = await promptNumber('實體圓角程度', currentConfig.appearance.entity.cornerRadius);
		if (entityCornerRadius === undefined) {
			return;
		}

		const entityBorderColor = await promptInput('實體邊框顏色', currentConfig.appearance.entity.borderColor);
		if (!entityBorderColor) {
			return;
		}

		const typeColorsInput = await promptInput(
			'不同類型實體顏色 JSON',
			JSON.stringify(currentConfig.appearance.entity.typeColors, null, 2),
		);

		if (!typeColorsInput) {
			return;
		}

		let typeColors: PlanistConfig['appearance']['entity']['typeColors'];
		try {
			typeColors = JSON.parse(typeColorsInput) as PlanistConfig['appearance']['entity']['typeColors'];
		} catch {
			vscode.window.showErrorMessage('實體類型顏色 JSON 格式錯誤');
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
		vscode.window.showInformationMessage('Planist 設定已更新');
	}
}

export function buildDefaultTemplatePreview(entryName: string, declarationKind: FlowDeclarationKind): string {
	return buildFlowTemplate(entryName, declarationKind);
}

async function promptInput(label: string, defaultValue: string): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: label,
		value: defaultValue,
	});
}

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

		vscode.window.showErrorMessage(`${label} 必須是正數`);
	}
}

async function promptPattern(defaultValue: PlanistBackgroundPattern): Promise<PlanistBackgroundPattern | undefined> {
	const selected = await vscode.window.showQuickPick(
		[
			{ label: 'dots', value: 'dots' as const },
			{ label: 'grid', value: 'grid' as const },
			{ label: 'none', value: 'none' as const },
		],
		{
			placeHolder: '背景線條樣式',
		},
	);

	return selected?.value ?? defaultValue;
}

async function buildDotsConfig(currentConfig: Awaited<ReturnType<typeof loadPlanistConfig>>) {
	const color = await promptInput('點顏色', currentConfig.appearance.dots.color);
	if (!color) {
		return undefined;
	}

	const size = await promptNumber('點的寬度', currentConfig.appearance.dots.size);
	const spacing = await promptNumber('點間距', currentConfig.appearance.dots.spacing);
	if (size === undefined || spacing === undefined) {
		return undefined;
	}

	return {
		size,
		spacing,
		color,
	};
}

async function buildGridConfig(currentConfig: Awaited<ReturnType<typeof loadPlanistConfig>>) {
	const majorColor = await promptInput('主要線顏色', currentConfig.appearance.grid.majorColor);
	if (!majorColor) {
		return undefined;
	}

	const minorColor = await promptInput('次要線顏色', currentConfig.appearance.grid.minorColor);
	if (!minorColor) {
		return undefined;
	}

	const majorLineWidth = await promptNumber('主要線寬度', currentConfig.appearance.grid.majorLineWidth);
	const minorLineWidth = await promptNumber('次要線寬度', currentConfig.appearance.grid.minorLineWidth);
	const majorSpacing = await promptNumber('主要線間距', currentConfig.appearance.grid.majorSpacing);
	const minorSpacing = await promptNumber('次要線間距', currentConfig.appearance.grid.minorSpacing);
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
