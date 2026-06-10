// @status GREEN
import { describe, test, expect } from 'vitest';
import { traverseCallChain } from '../../core/graph/graphTraversal';
import { FlowGraphEntity } from '../../dsl/flowDsl';

describe('Call Chain Traversal Unit Tests', () => {
    test('correctly traverses call relations and builds callchain method nodes', () => {
        const mockEntities: FlowGraphEntity[] = [
            {
                name: 'A',
                kind: 'class',
                bindSourcePath: null,
                autoImport: false,
                styleColor: null,
                styleBorderColor: null,
                styleRadius: null,
                references: [],
                fields: [],
                relationTargets: [],
                extendsTargets: [],
                implementsTargets: [],
                inheritsTargets: [],
                associatesTargets: [],
                aggregatesTargets: [],
                composesTargets: [],
                dependsOnTargets: [],
                methods: [
                    {
                        name: 'methodA',
                        parameters: [],
                        callsTo: [
                            {
                                targetName: 'B',
                                targetMethodName: 'methodB',
                                line: 10,
                                startCharacter: 10,
                                endCharacter: 20
                            }
                        ],
                        line: 5,
                        startCharacter: 5,
                        endCharacter: 30,
                        accessModifier: 'public',
                        modifiers: ['static']
                    }
                ]
            },
            {
                name: 'B',
                kind: 'class',
                bindSourcePath: null,
                autoImport: false,
                styleColor: null,
                styleBorderColor: null,
                styleRadius: null,
                references: [],
                fields: [],
                relationTargets: [],
                extendsTargets: [],
                implementsTargets: [],
                inheritsTargets: [],
                associatesTargets: [],
                aggregatesTargets: [],
                composesTargets: [],
                dependsOnTargets: [],
                methods: [
                    {
                        name: 'methodB',
                        parameters: [],
                        callsTo: [
                            {
                                targetName: 'C',
                                targetMethodName: 'methodC',
                                line: 12,
                                startCharacter: 8,
                                endCharacter: 18
                            }
                        ],
                        line: 6,
                        startCharacter: 6,
                        endCharacter: 25,
                        accessModifier: 'protected',
                        modifiers: ['final']
                    }
                ]
            },
            {
                name: 'C',
                kind: 'class',
                bindSourcePath: null,
                autoImport: false,
                styleColor: null,
                styleBorderColor: null,
                styleRadius: null,
                references: [],
                fields: [],
                relationTargets: [],
                extendsTargets: [],
                implementsTargets: [],
                inheritsTargets: [],
                associatesTargets: [],
                aggregatesTargets: [],
                composesTargets: [],
                dependsOnTargets: [],
                methods: [
                    {
                        name: 'methodC',
                        parameters: [],
                        callsTo: [],
                        line: 7,
                        startCharacter: 7,
                        endCharacter: 20,
                        accessModifier: 'private',
                        modifiers: []
                    }
                ]
            }
        ];

        const result = traverseCallChain(mockEntities, 'A', 'methodA');

        expect(result.nodes.length).toBe(3);

        const nodeA = result.nodes.find(n => n.name === 'A.methodA');
        expect(nodeA).toBeDefined();
        expect(nodeA?.kind).toBe('method');
        expect(nodeA?.accessModifier).toBe('public');
        expect(nodeA?.modifiers).toContain('static');
        expect(nodeA?.relationTargets).toContain('B.methodB');

        const nodeB = result.nodes.find(n => n.name === 'B.methodB');
        expect(nodeB).toBeDefined();
        expect(nodeB?.kind).toBe('method');
        expect(nodeB?.accessModifier).toBe('protected');
        expect(nodeB?.modifiers).toContain('final');
        expect(nodeB?.relationTargets).toContain('C.methodC');

        const nodeC = result.nodes.find(n => n.name === 'C.methodC');
        expect(nodeC).toBeDefined();
        expect(nodeC?.kind).toBe('method');
        expect(nodeC?.accessModifier).toBe('private');
        expect(nodeC?.relationTargets?.length).toBe(0);
    });
});
