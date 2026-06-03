/**
 * ============================================================================
 * 模組定位：Planist 全域與樣式配置中心 (src/config/planistConfig.ts)
 * 
 * 此檔案負責定義 Planist 的外觀渲染配置介面與預設設定值。它會將 VS Code 的
 * 擴充功能設定（包含一般、關鍵字、流程圖、渲染模式四大區塊）與底層的 .planist 配置進行
 * 整合，輸出給 Webview 網頁端渲染。
 * 
 * 重要類別與函數：
 * - PlanistAppearanceConfig: 代表網頁端畫布外觀的完整渲染配置。
 * - normalizePlanistConfig: 整合並正規化 settings 與 config.json 數據。
 * - resolveEntityStyle: 根據 VS Code 主題深淺與關鍵字色彩動態解析實體的視覺樣式。
 * 
 * 擴充與修改指引：
 * 1. 若要在設定中加入新的通用渲染屬性，可在 `PlanistAppearanceConfig` 中擴充欄位，
 *    並在 `normalizePlanistConfig()` 中使用 `planistConfig.get()` 取得設定填入。
 * 2. 若要調整實體圓角或預設底色，可修改 `DEFAULT_CONFIG` 內的數值。
 * ============================================================================
 */

import * as path from 'path';
import * as vscode from 'vscode';
import {
	PLANIST_ROOT_FOLDER,
	PLANIST_SYSTEM_FOLDER,
} from '../indexing/workspaceManager';
import type { FlowGraphEntity } from '../dsl/flowDsl';

export type PlanistBackgroundPattern = 'dots' | 'grid' | 'none';

export interface PlanistDotsConfig {
	size: number;
	spacing: number;
	color: string;
}

export interface PlanistGridConfig {
	majorLineWidth: number;
	minorLineWidth: number;
	majorSpacing: number;
	minorSpacing: number;
	majorColor: string;
	minorColor: string;
}

export interface PlanistEntityKindStyleConfig {
	color: string;
	borderColor: string;
}

export interface PlanistEntityStyleConfig {
	cornerRadius: number;
	borderColor: string;
	typeColors: Record<string, string>;
	typeBorderColors: Record<string, string>;
}

/**
 * 送往 Webview 進行畫布繪製的核心外觀配置介面
 */
export interface PlanistAppearanceConfig {
	backgroundColor: string;
	backgroundPattern: PlanistBackgroundPattern;
	dots: PlanistDotsConfig;
	grid: PlanistGridConfig;
	entity: PlanistEntityStyleConfig;
	boardBackground?: string;
	boardGridType?: string;
	boardGridThickness?: number;
	boardGridColor?: string;
	boardMajorGridSpacing?: number;
	boardSubGridLines?: number;
	edgeRadius?: number;
	renderMode?: string;
}

export interface PlanistConfig {
	version: number;
	appearance: PlanistAppearanceConfig;
}

export interface ResolvedEntityStyle {
	color: string;
	borderColor: string;
	radius: number;
	opacity: number;
}

/**
 * 全域預設外觀樣式定義
 */
const DEFAULT_CONFIG: PlanistConfig = {
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
				bind: '#007acc',
				package: '#8b5cf6',
				module: '#8b5cf6',
			},
			typeBorderColors: {
				class: '#005a9e',
				abstract: '#3730a3',
				interface: '#15803d',
				record: '#b45309',
				enum: '#be185d',
				text: '#4b5563',
				bind: '#005a9e',
				package: '#6d28d9',
				module: '#6d28d9',
			},
		},
	},
};

export function getPlanistConfigUri(): vscode.Uri {
	const workspaceRoot = getWorkspaceRoot();
	return vscode.Uri.file(path.join(workspaceRoot.fsPath, PLANIST_ROOT_FOLDER, PLANIST_SYSTEM_FOLDER, 'config.json'));
}

export function buildDefaultPlanistConfig(): PlanistConfig {
	return clonePlanistConfig(DEFAULT_CONFIG);
}

export async function ensureDefaultPlanistConfig(): Promise<void> {
	const configUri = getPlanistConfigUri();
	try {
		await vscode.workspace.fs.stat(configUri);
	} catch {
		await writePlanistConfig(DEFAULT_CONFIG);
	}
}

/**
 * 載入並整合 .planist/config.json 與 VS Code 專案 settings.json 內的配置
 */
export async function loadPlanistConfig(): Promise<PlanistConfig> {
	const configUri = getPlanistConfigUri();
	try {
		const rawContent = await vscode.workspace.fs.readFile(configUri);
		const parsedContent = JSON.parse(Buffer.from(rawContent).toString('utf8')) as Partial<PlanistConfig>;
		return normalizePlanistConfig(parsedContent);
	} catch {
		return normalizePlanistConfig(undefined);
	}
}

export async function writePlanistConfig(config: PlanistConfig): Promise<void> {
	const configUri = getPlanistConfigUri();
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(configUri.fsPath)));
	await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(config, null, 2), 'utf8'));
}

/**
 * 標準化配置檔。在此將 VS Code 用戶設定與 config.json 合併
 */
export function normalizePlanistConfig(config: Partial<PlanistConfig> | undefined): PlanistConfig {
	const appearance = config?.appearance;
	const defaultAppearance = DEFAULT_CONFIG.appearance;

	const planistConfig = vscode.workspace.getConfiguration('planist');

	const boardBackground = planistConfig.get<string>('board.background') ?? appearance?.backgroundColor ?? defaultAppearance.backgroundColor;
	const gridType = planistConfig.get<string>('board.gridType') ?? 'mesh';
	const gridThickness = planistConfig.get<number>('board.gridThickness') ?? 1;
	const gridColor = planistConfig.get<string>('board.gridColor') ?? 'rgba(255, 255, 255, 0.1)';
	const majorGridSpacing = planistConfig.get<number>('board.majorGridSpacing') ?? 50;
	const subGridLines = planistConfig.get<number>('board.subGridLines') ?? 4;
	const edgeRadius = planistConfig.get<number>('board.edgeRadius') ?? 8;
	const renderMode = planistConfig.get<string>('board.renderMode') ?? 'uml';

	return {
		version: 1,
		appearance: {
			backgroundColor: boardBackground,
			backgroundPattern: (gridType === 'mesh' ? 'grid' : gridType === 'dots' ? 'dots' : 'none') as PlanistBackgroundPattern,
			dots: {
				size: gridThickness,
				spacing: majorGridSpacing,
				color: gridColor,
			},
			grid: {
				majorLineWidth: gridThickness,
				minorLineWidth: gridThickness * 0.5,
				majorSpacing: majorGridSpacing,
				minorSpacing: majorGridSpacing / (subGridLines + 1),
				majorColor: gridColor,
				minorColor: gridColor.includes('rgba') ? gridColor.replace(/[\d\.]+\)$/, '0.03)') : 'rgba(255, 255, 255, 0.03)',
			},
			entity: {
				cornerRadius: planistConfig.get<number>('entity.borderRadius') ?? positiveNumberOrDefault(appearance?.entity?.cornerRadius, defaultAppearance.entity.cornerRadius),
				borderColor: planistConfig.get<string>('entity.borderColor') ?? appearance?.entity?.borderColor ?? defaultAppearance.entity.borderColor,
				typeColors: {
					...defaultAppearance.entity.typeColors,
					...appearance?.entity?.typeColors,
				},
				typeBorderColors: {
					...defaultAppearance.entity.typeBorderColors,
					...appearance?.entity?.typeBorderColors,
				},
			},
			boardBackground,
			boardGridType: gridType,
			boardGridThickness: gridThickness,
			boardGridColor: gridColor,
			boardMajorGridSpacing: majorGridSpacing,
			boardSubGridLines: subGridLines,
			edgeRadius,
			renderMode,
		},
	};
}

/**
 * 根據 VS Code 目前主題深淺色，解析單一實體的顏色（支援 text 種類自適應）
 */
export function resolveEntityStyle(entity: { kind: string | null, visualOverride?: any }, config: PlanistConfig): ResolvedEntityStyle {
	const appearance = config.appearance;
	const kindKey = entity.kind ?? 'class';

	const keywordsConfig = vscode.workspace.getConfiguration('planist.theme.keywords');
	const planistConfig = vscode.workspace.getConfiguration('planist');

	const activeTheme = vscode.window.activeColorTheme;
	const isDarkTheme = activeTheme.kind === vscode.ColorThemeKind.Dark || activeTheme.kind === vscode.ColorThemeKind.HighContrast;

	let vsCodeKeywordColor = keywordsConfig.get<string>(kindKey);
	
	// 當 'text' (普通文字) 為預設配置時，自適應主題深淺色：深色主題用白色、淺色主題用黑色
	if (kindKey === 'text' && (vsCodeKeywordColor === 'rgba(107, 114, 128, 1.0)' || !vsCodeKeywordColor)) {
		vsCodeKeywordColor = isDarkTheme ? 'rgba(255, 255, 255, 1.0)' : 'rgba(0, 0, 0, 1.0)';
	}

	const vsCodeBorderColor = planistConfig.get<string>('entity.borderColor');
	const vsCodeRadius = planistConfig.get<number>('entity.borderRadius');
	const vsCodeOpacity = planistConfig.get<number>('entity.opacity');
	const vsCodeFollowBorderColor = planistConfig.get<boolean>('entity.followBorderColor', false);

	const typeBorderColor = vsCodeBorderColor ?? appearance.entity.typeBorderColors[kindKey] ?? appearance.entity.borderColor;
	const typeColor = vsCodeFollowBorderColor
		? typeBorderColor
		: (vsCodeKeywordColor ?? appearance.entity.typeColors[kindKey] ?? appearance.entity.typeColors.class);
	const defaultRadius = vsCodeRadius ?? (entity.kind === 'text' ? 8 : appearance.entity.cornerRadius);
	const defaultOpacity = vsCodeOpacity ?? 0.9;

	let color = typeColor;
	let borderColor = typeBorderColor; // 預設情況下使用對應型態的邊框色彩配置
	let radius = defaultRadius;
	let opacity = defaultOpacity;

	// 整合 .pln 檔案底部手動複寫的 [Visual-Override] / @style 前綴
	if (entity.visualOverride) {
		const vo = entity.visualOverride;
		if (vo.borderColor) {
			borderColor = vo.borderColor;
		}
		if (vo.color) {
			color = vo.color;
		} else if (vsCodeFollowBorderColor && vo.borderColor) {
			color = vo.borderColor;
		}
		if (vo.borderRadius !== undefined) {
			radius = vo.borderRadius;
		}
		if (vo.opacity !== undefined) {
			opacity = vo.opacity;
		}
	}

	if (vsCodeFollowBorderColor && !entity.visualOverride?.color) {
		color = borderColor;
	}

	return {
		color: color,
		borderColor,
		radius,
		opacity,
	};
}

export function buildAppearanceStyles(config: PlanistConfig): string {
	const appearance = config.appearance;
	const backgroundImage = buildBackgroundImage(appearance);

	return [
		`background-color: ${appearance.backgroundColor};`,
		`background-image: ${backgroundImage};`,
	].join(' ');
}

export function buildHumanReadableConfigPreview(config: PlanistConfig): string {
	return JSON.stringify(config, null, 2);
}

function buildBackgroundImage(appearance: PlanistAppearanceConfig): string {
	if (appearance.backgroundPattern === 'dots') {
		return `radial-gradient(circle, ${appearance.dots.color} ${appearance.dots.size}px, transparent ${appearance.dots.size}px)`;
	}

	if (appearance.backgroundPattern === 'grid') {
		const minor = appearance.grid.minorSpacing;
		const major = appearance.grid.majorSpacing;
		const minorStop = Math.max(minor - appearance.grid.minorLineWidth, 0);
		const majorStop = Math.max(major - appearance.grid.majorLineWidth, 0);
		return [
			`repeating-linear-gradient(0deg, transparent 0, transparent ${minorStop}px, ${appearance.grid.minorColor} ${minorStop}px, ${appearance.grid.minorColor} ${minor}px)`,
			`repeating-linear-gradient(90deg, transparent 0, transparent ${minorStop}px, ${appearance.grid.minorColor} ${minorStop}px, ${appearance.grid.minorColor} ${minor}px)`,
			`repeating-linear-gradient(0deg, transparent 0, transparent ${majorStop}px, ${appearance.grid.majorColor} ${majorStop}px, ${appearance.grid.majorColor} ${major}px)`,
			`repeating-linear-gradient(90deg, transparent 0, transparent ${majorStop}px, ${appearance.grid.majorColor} ${majorStop}px, ${appearance.grid.majorColor} ${major}px)`,
		].join(', ');
	}

	return 'none';
}

function getWorkspaceRoot(): vscode.Uri {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		throw new Error('請先在 VS Code 中開啟一個專案資料夾');
	}

	return workspaceFolders[0].uri;
}

function clonePlanistConfig(config: PlanistConfig): PlanistConfig {
	return JSON.parse(JSON.stringify(config)) as PlanistConfig;
}

function positiveNumberOrDefault(value: unknown, fallback: number): number {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}

	return fallback;
}
