import { FlowGraphEntity } from '../../dsl/flowDsl';
import { FlowIndexer } from '../../indexing/flowIndexer';

export interface MappedGraphEntity {
    name: string;
    kind: string;
    pattern?: string;
    patternStyle: any;
    display?: any;
    contains?: string[];
    parent?: string;
    methods: Array<{ name: string; parameters: any; callsTo: any[] }>;
    references: any[];
    relationTargets: string[];
    extendsTargets: string[];
    implementsTargets: string[];
    inheritsTargets: string[];
    associatesTargets: string[];
    aggregatesTargets: string[];
    composesTargets: string[];
    dependsOnTargets: string[];
    renderStyle: any;
}

export function findStartEntity(
    allEntities: FlowGraphEntity[], 
    activeText: string | undefined, 
    activeUri: any, 
    indexer: FlowIndexer | undefined
): FlowGraphEntity | undefined {
    if (!activeUri || !indexer) return allEntities[0];

    const indexed = indexer.getEntityByUri(activeUri);
    if (indexed) {
        const entity = allEntities.find(e => e.name === indexed.entityName);
        if (entity) return entity;
    }

    if (activeText) {
        const headerRegex = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\s+([A-Za-z_][\w-]*)\b/i;
        const match = activeText.match(headerRegex);
        if (match) {
            const entity = allEntities.find(e => e.name === match[2]);
            if (entity) return entity;
        }
    }

    return allEntities[0];
}

export function filterEntitiesByView(
    allEntities: FlowGraphEntity[], 
    startEntity: FlowGraphEntity | undefined
): FlowGraphEntity[] {
    if (!startEntity) return [];

    if (startEntity.kind === 'package' || startEntity.kind === 'module') {
        return allEntities.filter(e => e.parent === startEntity.name || e.name === startEntity.name);
    }

    const entityMap = new Map(allEntities.map(e => [e.name, e]));
    const visited = new Set<string>();
    const reachableEntities = new Map<string, FlowGraphEntity>();

    function traverse(entityName: string) {
        if (visited.has(entityName)) return;
        visited.add(entityName);

        const entity = entityMap.get(entityName);
        if (!entity) return;

        reachableEntities.set(entityName, entity);
        
        if (entity.parent) {
            const parentPkg = entityMap.get(entity.parent);
            if (parentPkg) reachableEntities.set(entity.parent, parentPkg);
        }

        const targets = getEntityAllTargets(entity);
        for (const t of targets) {
            traverse(t);
        }
    }

    traverse(startEntity.name);
    return Array.from(reachableEntities.values());
}

function getEntityAllTargets(entity: FlowGraphEntity): string[] {
    const targets = new Set<string>();
    const relationKeys: Array<keyof FlowGraphEntity> = [
        'relationTargets', 'extendsTargets', 'implementsTargets', 
        'inheritsTargets', 'associatesTargets', 'aggregatesTargets', 
        'composesTargets', 'dependsOnTargets'
    ];

    for (const key of relationKeys) {
        const values = entity[key];
        if (Array.isArray(values)) {
            values.forEach(t => typeof t === 'string' && targets.add(t));
        }
    }
    
    if (entity.methods) {
        for (const m of entity.methods) {
            m.callsTo?.forEach(call => targets.add(call.targetName));
        }
    }
    
    return Array.from(targets);
}

export function mapGraphEntity(e: FlowGraphEntity, config: any, patterns: any): MappedGraphEntity {
    const patternStyle = e.pattern ? patterns[e.pattern]?.webview_style : undefined;
    return {
        name: e.name,
        kind: e.kind ?? 'default',
        pattern: e.pattern,
        patternStyle,
        display: e.display,
        contains: e.contains,
        parent: e.parent,
        methods: (e.methods || []).map((m: any) => ({
            name: m.name,
            parameters: m.parameters,
            callsTo: m.callsTo || []
        })),
        references: e.references || [],
        relationTargets: e.relationTargets || [],
        extendsTargets: e.extendsTargets || [],
        implementsTargets: e.implementsTargets || [],
        inheritsTargets: e.inheritsTargets || [],
        associatesTargets: e.associatesTargets || [],
        aggregatesTargets: e.aggregatesTargets || [],
        composesTargets: e.composesTargets || [],
        dependsOnTargets: e.dependsOnTargets || [],
        renderStyle: {}
    };
}