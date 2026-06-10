import { vi, describe, test, expect } from 'vitest';

vi.mock('vscode', () => {
    return {
        window: {
            showInformationMessage: vi.fn(),
            showErrorMessage: vi.fn()
        },
        workspace: {
            getConfiguration: () => ({
                get: (key: string, defaultValue: any) => defaultValue
            })
        }
    };
});

import { PlanistDocument } from '../../core/model/PlanistDocument';

describe('PlanistDocument Unit Tests', () => {
    // @state: green
    test('parses schema and references from text', () => {
        const text = `#schema flow\n#reference "../Helper.pln"\nclass ServiceA {}`;
        const doc = new PlanistDocument(text);
        expect(doc.schema).toBe('flow');
        expect(doc.references).toContain('../Helper.pln');
        expect(doc.entities.length).toBe(1);
        expect(doc.entities[0].entityName).toBe('ServiceA');
    });

    // @state: green
    test('serializes simple class to DSL string', () => {
        const doc = new PlanistDocument();
        doc.schema = 'flow';
        doc.addEntity({
            entityName: 'User',
            blockKind: 'class',
            accessModifier: 'public',
            bindSourcePath: 'src/User.ts',
            autoImport: true,
            references: [],
            methods: [
                {
                    name: 'login',
                    parameters: [],
                    callsTo: [],
                    line: 0,
                    startCharacter: 0,
                    endCharacter: 0,
                    accessModifier: 'public'
                }
            ],
            fields: [
                {
                    name: 'id',
                    type: 'number',
                    accessModifier: 'private',
                    line: 0
                }
            ],
            relationTargets: [],
            extendsTargets: ['BaseEntity'],
            implementsTargets: [],
            inheritsTargets: [],
            associatesTargets: [],
            aggregatesTargets: [],
            composesTargets: [],
            dependsOnTargets: []
        });

        const dsl = doc.toDslString();
        expect(dsl).toContain('#schema flow');
        expect(dsl).toContain('public class User {');
        expect(dsl).toContain('bind: "src/User.ts"');
        expect(dsl).toContain('autoImport: true');
        expect(dsl).toContain('private id: number');
        expect(dsl).toContain('public login()');
        expect(dsl).toContain('extends -> BaseEntity');
    });

    // @state: green
    test('updates existing entity details', () => {
        const text = `#schema flow\nclass User {\n    id: number\n}`;
        const doc = new PlanistDocument(text);
        expect(doc.entities[0].entityName).toBe('User');
        expect(doc.entities[0].fields.length).toBe(1);

        doc.updateEntity('User', {
            name: 'Member',
            kind: 'interface',
            fields: [
                { name: 'email', type: 'string', accessModifier: 'public', line: 0 }
            ],
            methods: [
                { name: 'getEmail', parameters: [], callsTo: [], line: 0, startCharacter: 0, endCharacter: 0 }
            ]
        });

        expect(doc.entities[0].entityName).toBe('Member');
        expect(doc.entities[0].blockKind).toBe('interface');
        expect(doc.entities[0].fields[0].name).toBe('email');
        expect(doc.entities[0].methods[0].name).toBe('getEmail');
    });
});
