import { FlowDocumentModel, parseFlowDocuments } from '../../dsl/flowDsl';

// @state: green
export class PlanistDocument {
    public schema: string = 'flow';
    public references: string[] = [];
    public entities: FlowDocumentModel[] = [];

    // @state: green
    constructor(text?: string) {
        if (text) {
            this.parse(text);
        }
    }

    // @state: green
    public parse(text: string): void {
        // 1. Detect schema
        const schemaMatch = text.match(/^\s*#schema\s+([a-zA-Z0-9_-]+)/i);
        this.schema = schemaMatch ? schemaMatch[1].toLowerCase() : 'flow';

        // 2. Parse references
        const lines = text.split(/\r?\n/);
        this.references = [];
        const referenceFilePattern = /^\s*(?:#?reference|#?refer)\s+["']?([^"']+)["']?\s*$/i;
        for (const line of lines) {
            const match = line.match(referenceFilePattern);
            if (match) {
                this.references.push(match[1].trim());
            }
        }

        // 3. Parse entities using DSL parser
        this.entities = parseFlowDocuments(text);
    }

    // @state: green
    public updateEntity(originalName: string, updatedData: any): void {
        const index = this.entities.findIndex(e => e.entityName === originalName);
        if (index === -1) {
            // If it doesn't exist, create it as a new entity
            this.addEntity({
                entityName: updatedData.name || originalName,
                blockKind: updatedData.kind || 'class',
                accessModifier: updatedData.accessModifier || null,
                bindSourcePath: updatedData.bindSourcePath || null,
                autoImport: updatedData.autoImport || false,
                styleColor: null,
                styleBorderColor: null,
                styleRadius: null,
                references: [],
                methods: updatedData.methods || [],
                fields: updatedData.fields || [],
                relationTargets: updatedData.relationTargets || [],
                extendsTargets: updatedData.extendsTargets || [],
                implementsTargets: updatedData.implementsTargets || [],
                inheritsTargets: updatedData.inheritsTargets || [],
                associatesTargets: updatedData.associatesTargets || [],
                aggregatesTargets: updatedData.aggregatesTargets || [],
                composesTargets: updatedData.composesTargets || [],
                dependsOnTargets: updatedData.dependsOnTargets || [],
                textBody: updatedData.textBody || undefined,
                display: updatedData.display || undefined,
                contains: updatedData.contains || undefined
            });
            return;
        }

        const current = this.entities[index];
        
        // Map updated fields
        const newEntity: FlowDocumentModel = {
            ...current,
            entityName: updatedData.name || current.entityName,
            blockKind: updatedData.kind || current.blockKind,
            accessModifier: updatedData.accessModifier !== undefined ? updatedData.accessModifier : current.accessModifier,
            bindSourcePath: updatedData.bindSourcePath !== undefined ? updatedData.bindSourcePath : current.bindSourcePath,
            autoImport: updatedData.autoImport !== undefined ? updatedData.autoImport : current.autoImport,
            fields: updatedData.fields || current.fields,
            methods: updatedData.methods || current.methods,
            textBody: updatedData.textBody !== undefined ? updatedData.textBody : current.textBody,
            display: updatedData.display !== undefined ? updatedData.display : current.display,
            contains: updatedData.contains || current.contains
        };

        // If specific OO relationship lists are provided, update them
        if (updatedData.extendsTargets !== undefined) newEntity.extendsTargets = updatedData.extendsTargets;
        if (updatedData.implementsTargets !== undefined) newEntity.implementsTargets = updatedData.implementsTargets;
        if (updatedData.inheritsTargets !== undefined) newEntity.inheritsTargets = updatedData.inheritsTargets;
        if (updatedData.associatesTargets !== undefined) newEntity.associatesTargets = updatedData.associatesTargets;
        if (updatedData.aggregatesTargets !== undefined) newEntity.aggregatesTargets = updatedData.aggregatesTargets;
        if (updatedData.composesTargets !== undefined) newEntity.composesTargets = updatedData.composesTargets;
        if (updatedData.dependsOnTargets !== undefined) newEntity.dependsOnTargets = updatedData.dependsOnTargets;
        if (updatedData.relationTargets !== undefined) newEntity.relationTargets = updatedData.relationTargets;

        if (updatedData.visualOverride !== undefined) {
            newEntity.visualOverride = {
                ...current.visualOverride,
                ...updatedData.visualOverride
            };
        }

        this.entities[index] = newEntity;
    }

    // @state: green
    public addEntity(entity: FlowDocumentModel): void {
        this.entities.push(entity);
    }

    // @state: green
    public removeEntity(entityName: string): void {
        this.entities = this.entities.filter(e => e.entityName !== entityName);
    }

    // @state: green
    public toDslString(): string {
        const blocks: string[] = [];

        // 1. Output schema header
        blocks.push(`#schema ${this.schema}`);

        // 2. Output references
        this.references.forEach(ref => {
            blocks.push(`#reference "${ref}"`);
        });

        // 3. Output entities
        this.entities.forEach(entity => {
            blocks.push(this.serializeEntity(entity));
        });

        return blocks.join('\n\n') + '\n';
    }

    // @state: green
    private serializeEntity(entity: FlowDocumentModel): string {
        const lines: string[] = [];

        // Comments before entity header
        if (entity.comments && entity.comments.length > 0) {
            entity.comments.forEach(c => lines.push(`// ${c}`));
        }

        // Pattern tag
        if (entity.pattern) {
            lines.push(`@pattern("${entity.pattern}")`);
        }

        // Header kind and access modifiers
        const accessStr = entity.accessModifier ? `${entity.accessModifier} ` : '';
        const kind = entity.blockKind || 'class';
        const name = entity.entityName;
        
        // Check if we need a braced block
        const hasBraces = entity.blockKind !== 'bind' || 
                          entity.bindSourcePath !== null || 
                          (entity.fields && entity.fields.length > 0) || 
                          (entity.methods && entity.methods.length > 0) ||
                          (entity.relationTargets && entity.relationTargets.length > 0) ||
                          (entity.extendsTargets && entity.extendsTargets.length > 0) ||
                          (entity.implementsTargets && entity.implementsTargets.length > 0) ||
                          (entity.visualOverride && Object.keys(entity.visualOverride).length > 0);
        
        if (hasBraces) {
            lines.push(`${accessStr}${kind} ${name} {`);

            // Display (for package/module)
            if (entity.display) {
                lines.push(`    display: "${entity.display}"`);
            }

            // Bind source path
            if (entity.bindSourcePath) {
                lines.push(`    bind: "${entity.bindSourcePath}"`);
            }

            // autoImport
            if (entity.autoImport !== undefined && entity.blockKind !== 'bind') {
                lines.push(`    autoImport: ${entity.autoImport}`);
            }

            // Text body (for text block kind)
            if (entity.blockKind === 'text' && entity.textBody) {
                entity.textBody.split(/\r?\n/).forEach(l => lines.push(`    ${l}`));
            }

            // Fields
            if (entity.fields && entity.fields.length > 0) {
                lines.push('    [Fields]');
                entity.fields.forEach(f => {
                    if (f.comments && f.comments.length > 0) {
                        f.comments.forEach(fc => lines.push(`    // ${fc}`));
                    }
                    const fAccess = f.accessModifier ? `${f.accessModifier} ` : '';
                    const fMods = f.modifiers && f.modifiers.length > 0 ? `${f.modifiers.join(' ')} ` : '';
                    const fType = f.type ? `: ${f.type}` : '';
                    lines.push(`    ${fAccess}${fMods}${f.name}${fType}`);
                });
            }

            // Methods
            if (entity.methods && entity.methods.length > 0) {
                lines.push('    [Methods]');
                entity.methods.forEach(m => {
                    if (m.comments && m.comments.length > 0) {
                        m.comments.forEach(mc => lines.push(`    // ${mc}`));
                    }
                    const mAccess = m.accessModifier ? `${m.accessModifier} ` : '';
                    const mMods = m.modifiers && m.modifiers.length > 0 ? `${m.modifiers.join(' ')} ` : '';
                    const params = m.parameters ? m.parameters.join(', ') : '';
                    const retType = m.returnType ? `: ${m.returnType}` : '';
                    
                    if (m.callsTo && m.callsTo.length > 0) {
                        lines.push(`    ${mAccess}${mMods}${m.name}(${params})${retType} {`);
                        
                        const groupedCalls: Record<string, typeof m.callsTo> = {};
                        const noConditionCalls: typeof m.callsTo = [];
                        m.callsTo.forEach(call => {
                            if (call.condition) {
                                if (!groupedCalls[call.condition]) groupedCalls[call.condition] = [];
                                groupedCalls[call.condition].push(call);
                            } else {
                                noConditionCalls.push(call);
                            }
                        });

                        noConditionCalls.forEach(call => {
                            const rel = call.relationType ? `${call.relationType} ` : '';
                            const targetMethod = call.targetMethodName ? `.${call.targetMethodName}()` : '';
                            lines.push(`        ${rel}-> ${call.targetName}${targetMethod}`);
                        });

                        Object.keys(groupedCalls).forEach(cond => {
                            if (cond === 'else') {
                                lines.push(`        else {`);
                            } else {
                                lines.push(`        if (${cond}) {`);
                            }
                            groupedCalls[cond].forEach(call => {
                                const rel = call.relationType ? `${call.relationType} ` : '';
                                const targetMethod = call.targetMethodName ? `.${call.targetMethodName}()` : '';
                                lines.push(`            ${rel}-> ${call.targetName}${targetMethod}`);
                            });
                            lines.push(`        }`);
                        });

                        lines.push(`    }`);
                    } else {
                        lines.push(`    ${mAccess}${mMods}${m.name}(${params})${retType}`);
                    }
                });
            }

            // Relations
            const relations: string[] = [];
            if (entity.extendsTargets) {
                entity.extendsTargets.forEach(t => relations.push(`    extends -> ${t}`));
            }
            if (entity.implementsTargets) {
                entity.implementsTargets.forEach(t => relations.push(`    implements -> ${t}`));
            }
            if (entity.inheritsTargets) {
                entity.inheritsTargets.forEach(t => relations.push(`    inherits -> ${t}`));
            }
            if (entity.associatesTargets) {
                entity.associatesTargets.forEach(t => relations.push(`    associates -> ${t}`));
            }
            if (entity.aggregatesTargets) {
                entity.aggregatesTargets.forEach(t => relations.push(`    aggregates -> ${t}`));
            }
            if (entity.composesTargets) {
                entity.composesTargets.forEach(t => relations.push(`    composes -> ${t}`));
            }
            if (entity.dependsOnTargets) {
                entity.dependsOnTargets.forEach(t => relations.push(`    dependsOn -> ${t}`));
            }
            if (entity.relationTargets) {
                entity.relationTargets.forEach(t => relations.push(`    -> ${t}`));
            }
            if (entity.contains) {
                entity.contains.forEach(t => relations.push(`    -> ${t}`));
            }
            if (entity.references) {
                entity.references.forEach(r => {
                    const exists = (entity.extendsTargets?.includes(r.targetName)) ||
                                   (entity.implementsTargets?.includes(r.targetName)) ||
                                   (entity.inheritsTargets?.includes(r.targetName)) ||
                                   (entity.associatesTargets?.includes(r.targetName)) ||
                                   (entity.aggregatesTargets?.includes(r.targetName)) ||
                                   (entity.composesTargets?.includes(r.targetName)) ||
                                   (entity.dependsOnTargets?.includes(r.targetName)) ||
                                   (entity.relationTargets?.includes(r.targetName)) ||
                                   (entity.contains?.includes(r.targetName));
                    if (!exists) {
                        relations.push(`    -> ${r.targetName}`);
                    }
                });
            }

            if (relations.length > 0) {
                lines.push('    [Relations]');
                relations.forEach(r => lines.push(r));
            }

            // Visual overrides
            if (entity.visualOverride) {
                if (entity.visualOverride.color) {
                    lines.push(`    @style.color: ${entity.visualOverride.color}`);
                }
                if (entity.visualOverride.borderColor) {
                    lines.push(`    @style.borderColor: ${entity.visualOverride.borderColor}`);
                }
                if (entity.visualOverride.borderRadius !== undefined) {
                    lines.push(`    @style.borderRadius: ${entity.visualOverride.borderRadius}`);
                }
                if (entity.visualOverride.opacity !== undefined) {
                    lines.push(`    @style.opacity: ${entity.visualOverride.opacity}`);
                }
            }

            lines.push('}');
        } else {
            lines.push(`${accessStr}${kind} ${name}`);
        }

        return lines.join('\n');
    }
}
