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

import { parseFlowDocuments } from '../../dsl/flowDsl';

describe('Flow DSL Parser Comments Unit Tests', () => {
    test('parses single line and multiline comments for class entity', () => {
        const text = `
            // This is a single line class comment
            /* This is a block class comment */
            /**
             * This is a JSDoc block class comment
             * with multiple lines.
             */
            class OrderController {
            }
        `;
        const docs = parseFlowDocuments(text);
        expect(docs.length).toBe(1);
        const doc = docs[0];
        expect(doc.entityName).toBe('OrderController');
        expect(doc.comments).toContain('This is a single line class comment');
        expect(doc.comments).toContain('This is a block class comment');
        expect(doc.comments).toContain('This is a JSDoc block class comment');
        expect(doc.comments).toContain('with multiple lines.');
    });

    test('parses comments associated with fields and methods', () => {
        const text = `
            class OrderController {
                // Comments for fieldA
                fieldA: string
                
                /**
                 * Comments for methodB
                 */
                + methodB(param1)
            }
        `;
        const docs = parseFlowDocuments(text);
        expect(docs.length).toBe(1);
        const doc = docs[0];
        
        const field = doc.fields.find(f => f.name === 'fieldA');
        expect(field).toBeDefined();
        expect(field?.comments).toContain('Comments for fieldA');

        const method = doc.methods.find(m => m.name === 'methodB');
        expect(method).toBeDefined();
        expect(method?.comments).toContain('Comments for methodB');
    });
});
