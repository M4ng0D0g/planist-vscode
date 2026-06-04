import * as vscode from 'vscode';
import { buildCompiledGraph } from '../core/graph/graphBuilder';
import { findStartEntity, filterEntitiesByView, mapGraphEntity, MappedGraphEntity } from '../core/graph/graphTraversal';
import { loadPlanistConfig, resolveEntityStyle } from '../config/planistConfig';
import { PatternManager } from '../config/patternManager';
import { FlowIndexer } from '../indexing/flowIndexer';

export async function prepareGraphData(indexer: FlowIndexer | undefined, viewMode: string): Promise<{
    entities: MappedGraphEntity[];
    config: any;
    boardConfig: any; // 加上這個回傳型別
}> {
    const config = await loadPlanistConfig();
    const graph = await buildCompiledGraph();
    const allEntities = graph.entities;

    const activeEditor = vscode.window.activeTextEditor;
    const activeText = activeEditor?.document.getText();
    const activeUri = activeEditor?.document.uri;

    const startEntity = findStartEntity(allEntities, activeText, activeUri, indexer);
    const filteredEntities = filterEntitiesByView(allEntities, startEntity);
    
    const patterns = PatternManager.loadPatterns();
    const graphEntities = filteredEntities.map(e => {
        const mapped = mapGraphEntity(e, config, patterns);
        mapped.renderStyle = resolveEntityStyle(e, config);
        return mapped;
    });

    // 🔥 【具體實作】從 VS Code settings.json 撈取使用者設定的畫布參數
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
        boardConfig // 將設定同步送出
    };
}