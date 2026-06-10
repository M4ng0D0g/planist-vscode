import { FlowGraphEntity } from '../../dsl/flowDsl';
import { FlowIndexer } from '../../indexing/flowIndexer';

export interface MappedGraphEntity {
    name: string;
    kind: string;
    pattern?: string;
    patternStyle?: any;
    display?: any;
    contains?: string[];
    parent?: string;
    fields: Array<{ name: string; type: string | null; accessModifier: string | null; line?: number; modifiers?: string[] }>;
    methods: Array<{ name: string; parameters: any; callsTo: any[]; returnType?: string | null; accessModifier?: string | null; line?: number; modifiers?: string[] }>;
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
    entityName?: string;
    methodName?: string;
    modifiers?: string[];
    accessModifier?: string | null;
    returnType?: string | null;
    startLine?: number;
    endLine?: number;
    visualOverride?: any;
    comments?: string[];
    textBody?: string;
}

export function findStartEntities(
    allEntities: FlowGraphEntity[], 
    activeText: string | undefined, 
    activeUri: any, 
    indexer: FlowIndexer | undefined
): FlowGraphEntity[] {
    if (!activeUri || !indexer) {
        return allEntities[0] ? [allEntities[0]] : [];
    }

    const indexedList = indexer.getEntitiesByUri(activeUri);
    if (indexedList && indexedList.length > 0) {
        const result: FlowGraphEntity[] = [];
        for (const idx of indexedList) {
            const entity = allEntities.find(e => e.name === idx.entityName);
            if (entity) result.push(entity);
        }
        if (result.length > 0) return result;
    }

    if (activeText) {
        const headerRegex = /^\s*(class|abstract|interface|record|enum|text|bind|package|module)\s+([A-Za-z_][\w-]*)\b/gi;
        let match;
        const result: FlowGraphEntity[] = [];
        while ((match = headerRegex.exec(activeText)) !== null) {
            const name = match[2];
            const entity = allEntities.find(e => e.name === name);
            if (entity) result.push(entity);
        }
        if (result.length > 0) return result;
    }

    return allEntities[0] ? [allEntities[0]] : [];
}

export function filterEntitiesByView(
    allEntities: FlowGraphEntity[], 
    startEntities: FlowGraphEntity[]
): FlowGraphEntity[] {
    if (!startEntities || startEntities.length === 0) return [];

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

    for (const start of startEntities) {
        traverse(start.name);
    }
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

// @state: green
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
        fields: (e.fields || []).map((f: any) => ({
            name: f.name,
            type: f.type,
            accessModifier: f.accessModifier,
            line: f.line,
            modifiers: f.modifiers || [],
            comments: f.comments
        })),
        methods: (e.methods || []).map((m: any) => ({
            name: m.name,
            parameters: m.parameters,
            callsTo: m.callsTo || [],
            returnType: m.returnType,
            accessModifier: m.accessModifier,
            line: m.line,
            modifiers: m.modifiers || [],
            comments: m.comments
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
        renderStyle: {},
        startLine: e.startLine,
        endLine: e.endLine,
        visualOverride: e.visualOverride,
        comments: e.comments,
        textBody: e.textBody
    };
}

export interface CallChainData {
    nodes: MappedGraphEntity[];
}

// @state: green
export function traverseCallChain(
    allEntities: FlowGraphEntity[],
    startEntityName: string,
    startMethodName: string
): CallChainData {
    const nodes: MappedGraphEntity[] = [];
    const visited = new Set<string>();

    function getMethodInfo(entityName: string, methodName: string) {
        const entity = allEntities.find(e => e.name === entityName);
        if (!entity) return null;
        const method = (entity.methods || []).find((m: any) => m.name === methodName);
        return { entity, method };
    }

    function visit(entityName: string, methodName: string) {
        const key = `${entityName}.${methodName}`;
        if (visited.has(key)) return;
        visited.add(key);

        const info = getMethodInfo(entityName, methodName);
        const accessModifier = info?.method?.accessModifier || null;
        const modifiers = info?.method?.modifiers || [];
        const returnType = info?.method?.returnType || null;

        const relationTargets: string[] = [];

        if (info?.method && Array.isArray(info.method.callsTo)) {
            for (const call of info.method.callsTo) {
                const targetEntity = call.targetName;
                const targetMethod = call.targetMethodName || 'new';
                const targetKey = `${targetEntity}.${targetMethod}`;
                relationTargets.push(targetKey);
            }
        }

        nodes.push({
            name: key,
            kind: 'method',
            entityName,
            methodName,
            accessModifier,
            modifiers,
            returnType,
            display: {},
            references: [],
            relationTargets,
            extendsTargets: [],
            implementsTargets: [],
            inheritsTargets: [],
            associatesTargets: [],
            aggregatesTargets: [],
            composesTargets: [],
            dependsOnTargets: [],
            renderStyle: {},
            fields: [],
            methods: []
        });

        if (info?.method && Array.isArray(info.method.callsTo)) {
            for (const call of info.method.callsTo) {
                visit(call.targetName, call.targetMethodName || 'new');
            }
        }
    }

    visit(startEntityName, startMethodName);

    return { nodes };
}