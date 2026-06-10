import * as vscode from 'vscode';
import { buildCompiledGraph } from '../core/graph/graphBuilder';
import { findStartEntities, filterEntitiesByView, mapGraphEntity, MappedGraphEntity, traverseCallChain } from '../core/graph/graphTraversal';
import { loadPlanistConfig, resolveEntityStyle } from '../config/planistConfig';
import { PatternManager } from '../config/patternManager';
import { FlowIndexer } from '../indexing/flowIndexer';

// @state: green
export async function prepareGraphData(
    indexer: FlowIndexer | undefined, 
    viewMode: string,
    callChainStart?: { entityName: string; methodName: string },
    documentUri?: vscode.Uri
): Promise<{
    entities: MappedGraphEntity[];
    connections: any[];
    config: any;
    boardConfig: any;
}> {
    const config = await loadPlanistConfig();
    const graph = await buildCompiledGraph();
    const allEntities = graph.entities;

    // Read style, position and connection overrides from .planist/.render/.render.json
    let renderData: any = null;
    const targetUri = documentUri || vscode.window.activeTextEditor?.document.uri;
    if (targetUri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
        if (workspaceFolder) {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(workspaceFolder.uri.fsPath, '.planist', '.render', '.render.json');
            if (fs.existsSync(filePath)) {
                try {
                    renderData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                } catch (err) {
                    console.error('Failed to parse .render.json:', err);
                }
            }
        }
    }

    let graphEntities: MappedGraphEntity[] = [];

    if (viewMode === 'callchain' && callChainStart) {
        const result = traverseCallChain(allEntities, callChainStart.entityName, callChainStart.methodName);
        graphEntities = result.nodes.map(node => {
            if (renderData && renderData.entities && renderData.entities[node.name]) {
                const custom = renderData.entities[node.name];
                if (custom.position) {
                    (node as any).position = custom.position;
                }
                if (custom.color) {
                    if (!node.visualOverride) {
                        node.visualOverride = {};
                    }
                    node.visualOverride.color = custom.color;
                    if (node.renderStyle) {
                        node.renderStyle.color = custom.color;
                    }
                }
            }
            return node;
        });
    } else {
        let activeText = '';
        if (documentUri) {
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === documentUri.toString());
            if (doc) {
                activeText = doc.getText();
            } else {
                activeText = vscode.window.activeTextEditor?.document.getText() || '';
            }
        } else {
            activeText = vscode.window.activeTextEditor?.document.getText() || '';
        }
        const activeUri = documentUri || vscode.window.activeTextEditor?.document.uri;

        const startEntities = findStartEntities(allEntities, activeText, activeUri, indexer);
        const filteredEntities = filterEntitiesByView(allEntities, startEntities);
        
        const patterns = PatternManager.loadPatterns();

        graphEntities = filteredEntities.map(e => {
            const mapped = mapGraphEntity(e, config, patterns);
            mapped.renderStyle = resolveEntityStyle(e, config);
            
            if (renderData && renderData.entities && renderData.entities[mapped.name]) {
                const custom = renderData.entities[mapped.name];
                if (custom.position) {
                    (mapped as any).position = custom.position;
                }
                if (custom.color) {
                    if (!mapped.visualOverride) {
                        mapped.visualOverride = {};
                    }
                    mapped.visualOverride.color = custom.color;
                    if (mapped.renderStyle) {
                        mapped.renderStyle.color = custom.color;
                    }
                }
            }
            return mapped;
        });
    }

    const planistConfig = vscode.workspace.getConfiguration('planist.board');
    const boardConfig = {
        backgroundColor: planistConfig.get<string>('backgroundColor', '#1e1e1e'),
        gridType: planistConfig.get<string>('gridType', 'mesh'),
        lineColor: planistConfig.get<string>('lineColor', 'rgba(128, 128, 128, 0.15)'),
        subLineColor: planistConfig.get<string>('subLineColor', 'rgba(128, 128, 128, 0.05)'),
        mainLineWidth: planistConfig.get<number>('mainLineWidth', 1.5),
        subLineWidth: planistConfig.get<number>('subLineWidth', 0.5),
        mainLineGap: planistConfig.get<number>('mainLineGap', 100),
        subLineCount: planistConfig.get<number>('subLineCount', 4)
    };

    return {
        entities: graphEntities,
        connections: renderData?.connections || [],
        config,
        boardConfig
    };
}