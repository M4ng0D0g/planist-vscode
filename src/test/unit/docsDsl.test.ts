import { describe, test, expect } from 'vitest';
import { parseDocsSchema } from '../../preview/schemaParser';

describe('Docs DSL Parser Unit Tests', () => {
    // @state: green
    test('correctly parses a basic docs schema document into pages', () => {
        const text = `#schema docs ProjectGuide

page "1. Getting Started" outline
---
# Getting Started
This is page 1.

===

page "2. Advanced Usage"
---
# Advanced Usage
This is page 2.
`;

        const data = parseDocsSchema(text);
        expect(data.docName).toBe('ProjectGuide');
        expect(data.pages.length).toBe(2);

        expect(data.pages[0].title).toBe('1. Getting Started');
        expect(data.pages[0].isOutline).toBe(true);
        expect(data.pages[0].content).toBe('# Getting Started\nThis is page 1.');

        expect(data.pages[1].title).toBe('2. Advanced Usage');
        expect(data.pages[1].isOutline).toBe(false);
        expect(data.pages[1].content).toBe('# Advanced Usage\nThis is page 2.');
    });

    // @state: green
    test('handles fallback page naming when no title is defined', () => {
        const text = `#schema docs UntitledDoc
---
No title content here
`;
        const data = parseDocsSchema(text);
        expect(data.docName).toBe('UntitledDoc');
        expect(data.pages.length).toBe(1);
        expect(data.pages[0].title).toBe('Page 1');
        expect(data.pages[0].content).toBe('No title content here');
    });
});
