import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRootPath } from '../utils/shortcutResolver';

export interface PatternConfig {
	suggested_elements?: {
		methods?: string[];
		relations?: string[];
	};
	webview_style?: {
		badge?: string;
		badgeColor?: string;
		compoundGroup?: string;
	};
}

export class PatternManager {
	public static loadPatterns(): Record<string, PatternConfig> {
		const root = getWorkspaceRootPath();
		if (!root) {
			return {};
		}

		const systemDir = path.join(root, '.planist', '.system');
		const filePath = path.join(systemDir, 'patterns.json');

		if (!fs.existsSync(filePath)) {
			if (!fs.existsSync(systemDir)) {
				fs.mkdirSync(systemDir, { recursive: true });
			}
			const defaultPatterns: Record<string, PatternConfig> = {
				singleton: {
					suggested_elements: {
						methods: [
							"private constructor()",
							"public static getInstance(): $1"
						]
					},
					webview_style: {
						badge: "Singleton",
						badgeColor: "#e74c3c"
					}
				},
				observer: {
					suggested_elements: {
						methods: [
							"public attach(observer: $1): void",
							"public detach(observer: $1): void",
							"public notify(): void"
						],
						relations: [
							"-> $1"
						]
					},
					webview_style: {
						badge: "Subject",
						badgeColor: "#2ecc71",
						compoundGroup: "ObserverPattern"
					}
				},
				factory: {
					suggested_elements: {
						methods: [
							"public create(): $1"
						]
					},
					webview_style: {
						badge: "Factory",
						badgeColor: "#f1c40f"
					}
				}
			};
			fs.writeFileSync(filePath, JSON.stringify(defaultPatterns, null, 4), 'utf8');
			return defaultPatterns;
		}

		try {
			const content = fs.readFileSync(filePath, 'utf8');
			return JSON.parse(content) as Record<string, PatternConfig>;
		} catch (e) {
			console.error("Error loading patterns.json:", e);
			return {};
		}
	}
}
