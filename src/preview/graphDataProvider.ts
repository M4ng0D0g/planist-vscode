import * as vscode from 'vscode';
import { buildCompiledGraph } from '../core/graph/graphBuilder';
import { findStartEntities, filterEntitiesByView, mapGraphEntity, MappedGraphEntity, traverseCallChain } from '../core/graph/graphTraversal';
import { loadPlanistConfig, resolveEntityStyle } from '../config/planistConfig';
import { PatternManager } from '../config/patternManager';
import { FlowIndexer } from '../indexing/flowIndexer';

// @state: red
export async function prepareGraphData(
    indexer: FlowIndexer | undefined, 
    viewMode: string,
    callChainStart?: { entityName: string; methodName: string }
): Promise<{
    entities: MappedGraphEntity[];
    config: any;
    boardConfig: any;
}> {
    const config = await loadPlanistConfig();
    const graph = await buildCompiledGraph();
    const allEntities = graph.entities;

    let graphEntities: MappedGraphEntity[] = [];

    if (viewMode === 'callchain' && callChainStart) {
        const result = traverseCallChain(allEntities, callChainStart.entityName, callChainStart.methodName);
        graphEntities = result.nodes;
    } else {
        const activeEditor = vscode.window.activeTextEditor;
        const activeText = activeEditor?.document.getText();
        const activeUri = activeEditor?.document.uri;

        const startEntities = findStartEntities(allEntities, activeText, activeUri, indexer);
        const filteredEntities = filterEntitiesByView(allEntities, startEntities);
        
        const patterns = PatternManager.loadPatterns();
        graphEntities = filteredEntities.map(e => {
            const mapped = mapGraphEntity(e, config, patterns);
            mapped.renderStyle = resolveEntityStyle(e, config);
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
        config,
        boardConfig
    };
}