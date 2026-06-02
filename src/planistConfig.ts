import * as path from 'path';
import * as vscode from 'vscode';
import {
	PLANIST_ROOT_FOLDER,
	PLANIST_SYSTEM_FOLDER,
	sanitizeSegment,
} from './workspaceManager';
import type { FlowGraphEntity } from './flowDsl';

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

export interface PlanistAppearanceConfig {
	backgroundColor: string;
	backgroundPattern: PlanistBackgroundPattern;
	dots: PlanistDotsConfig;
	grid: PlanistGridConfig;
	entity: PlanistEntityStyleConfig;
}

export interface PlanistConfig {
	version: number;
	appearance: PlanistAppearanceConfig;
}

export interface ResolvedEntityStyle {
	color: string;
	borderColor: string;
	radius: number;
}

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

export async function loadPlanistConfig(): Promise<PlanistConfig> {
	const configUri = getPlanistConfigUri();
	try {
		const rawContent = await vscode.workspace.fs.readFile(configUri);
		const parsedContent = JSON.parse(Buffer.from(rawContent).toString('utf8')) as Partial<PlanistConfig>;
		return normalizePlanistConfig(parsedContent);
	} catch {
		return clonePlanistConfig(DEFAULT_CONFIG);
	}
}

export async function writePlanistConfig(config: PlanistConfig): Promise<void> {
	const configUri = getPlanistConfigUri();
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(configUri.fsPath)));
	await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(config, null, 2), 'utf8'));
}

export function normalizePlanistConfig(config: Partial<PlanistConfig> | undefined): PlanistConfig {
	const appearance = config?.appearance;
	const defaultAppearance = DEFAULT_CONFIG.appearance;

	return {
		version: 1,
		appearance: {
			backgroundColor: appearance?.backgroundColor ?? defaultAppearance.backgroundColor,
			backgroundPattern: appearance?.backgroundPattern === 'dots' || appearance?.backgroundPattern === 'grid' ? appearance.backgroundPattern : 'none',
			dots: {
				size: positiveNumberOrDefault(appearance?.dots?.size, defaultAppearance.dots.size),
				spacing: positiveNumberOrDefault(appearance?.dots?.spacing, defaultAppearance.dots.spacing),
				color: appearance?.dots?.color ?? defaultAppearance.dots.color,
			},
			grid: {
				majorLineWidth: positiveNumberOrDefault(appearance?.grid?.majorLineWidth, defaultAppearance.grid.majorLineWidth),
				minorLineWidth: positiveNumberOrDefault(appearance?.grid?.minorLineWidth, defaultAppearance.grid.minorLineWidth),
				majorSpacing: positiveNumberOrDefault(appearance?.grid?.majorSpacing, defaultAppearance.grid.majorSpacing),
				minorSpacing: positiveNumberOrDefault(appearance?.grid?.minorSpacing, defaultAppearance.grid.minorSpacing),
				majorColor: appearance?.grid?.majorColor ?? defaultAppearance.grid.majorColor,
				minorColor: appearance?.grid?.minorColor ?? defaultAppearance.grid.minorColor,
			},
			entity: {
				cornerRadius: positiveNumberOrDefault(appearance?.entity?.cornerRadius, defaultAppearance.entity.cornerRadius),
				borderColor: appearance?.entity?.borderColor ?? defaultAppearance.entity.borderColor,
				typeColors: {
					...defaultAppearance.entity.typeColors,
					...appearance?.entity?.typeColors,
				},
				typeBorderColors: {
					...defaultAppearance.entity.typeBorderColors,
					...appearance?.entity?.typeBorderColors,
				},
			},
		},
	};
}

export function resolveEntityStyle(entity: FlowGraphEntity, config: PlanistConfig): ResolvedEntityStyle {
	const appearance = config.appearance;
	const kindKey = entity.kind ?? 'class';
	const typeColor = appearance.entity.typeColors[kindKey] ?? appearance.entity.typeColors.class;
	const typeBorderColor = appearance.entity.typeBorderColors[kindKey] ?? appearance.entity.borderColor;

	return {
		color: entity.bindSourcePath ? entity.bindSourcePath : typeColor,
		borderColor: typeBorderColor,
		radius: entity.kind === 'text' ? 8 : appearance.entity.cornerRadius,
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
