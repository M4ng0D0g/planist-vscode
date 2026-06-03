/**
 * ============================================================================
 * 模組定位：Planist 指令互動控制器 (src/commands/commandController.ts)
 * 
 * 此檔案負責處理所有透過 VS Code Command Palette（或選單快捷按鈕）觸發的交互指令。
 * 包括檔案建立精靈（QuickPick / InputBox 彈出引導窗）與外觀調色盤樣式設定精靈。
 * 
 * 重要類別與函數：
 * - CommandController: 靜態指令操作集成控制器。
 * - buildDefaultTemplatePreview: 獲取指定類型 DSL 範本內容。
 * 
 * 擴充與修改指引：
 * 1. 若要增加新的操作指令（如導出為 SVG 等），可在 `CommandController` 內增加靜態方法，
 *    並在入口 `extension.ts` 內註冊該命令。
 * 2. 若要增加可供創建的類別（例如新增 `class` 或 `interface` 以外的新實體類型選項），
 *    可直接擴充 `declarationKinds` 陣列。
 * ============================================================================
 */

import * as vscode from 'vscode';
import { LogManager } from '../config/logger';

import {
	normalizePlanistConfig,
	loadPlanistConfig,
	writePlanistConfig,
	type PlanistConfig,
	type PlanistBackgroundPattern,
} from '../config/planistConfig';

export class CommandController {
	/**
	 * 開啟互動式引導窗以逐項設定外觀樣式，配置完成後寫入 config.json
	 */
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
