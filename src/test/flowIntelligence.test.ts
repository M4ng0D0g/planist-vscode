import * as assert from 'assert';
import * as vscode from 'vscode';
import { FlowIndexer } from '../indexing/flowIndexer';
import { FlowCompletionItemProvider } from '../providers/completionProvider';
import { FlowHoverProvider } from '../providers/hoverProvider';

suite('Planist Language Intelligence Tests', () => {
	let indexer: FlowIndexer;

	setup(() => {
		indexer = new FlowIndexer();
	});

	teardown(() => {
		indexer.dispose();
	});

	test('Indexer can parse and index content manually', () => {
		const testUri = vscode.Uri.file('/path/to/workspace/OrderSystem.pln');
		const content = `#schema flow
class OrderSystem {
    bind: "../src/OrderSystem.ts"
    [Methods]
    + processOrder(orderId, amount) {
        -> PaymentService.charge(amount)
    }
}`;
		// Since indexContent is private, we can cast indexer as any to call it for unit testing
		(indexer as any).indexContent(testUri, content);

		const entity = indexer.getEntity('OrderSystem');
		assert.ok(entity);
		assert.strictEqual(entity?.entityName, 'OrderSystem');
		assert.strictEqual(entity?.kind, 'class');
		assert.strictEqual(entity?.methods.length, 1);
		assert.strictEqual(entity?.methods[0].name, 'processOrder');
		assert.deepStrictEqual(entity?.methods[0].parameters, ['orderId', 'amount']);
	});

	test('CompletionProvider suggests entities on -> trigger', async () => {
		const testUri = vscode.Uri.file('/path/to/workspace/OrderSystem.pln');
		const content = `#schema flow
class OrderSystem {
    [Relations]
    -> 
}`;
		(indexer as any).indexContent(testUri, content);
		// Also index another dummy entity
		(indexer as any).indexContent(vscode.Uri.file('/path/to/workspace/PaymentService.pln'), '#schema flow\nclass PaymentService {}');

		const provider = new FlowCompletionItemProvider(indexer);
		
		// Create a mock TextDocument and Position
		const doc = {
			lineAt: (pos: vscode.Position) => ({ text: '    -> ' }),
			getText: () => content,
			uri: testUri,
		} as unknown as vscode.TextDocument;

		const position = new vscode.Position(2, 7); // position after "-> "
		const token = new vscode.CancellationTokenSource().token;
		const context = { triggerKind: vscode.CompletionTriggerKind.TriggerCharacter, triggerCharacter: ' ' } as vscode.CompletionContext;

		const result = await provider.provideCompletionItems(doc, position, token, context);
		assert.ok(Array.isArray(result));
		const items = result as vscode.CompletionItem[];
		
		const labels = items.map(item => item.label);
		assert.ok(labels.includes('OrderSystem'));
		assert.ok(labels.includes('PaymentService'));
	});

	test('CompletionProvider suggests methods on entity. trigger', async () => {
		const testUri = vscode.Uri.file('/path/to/workspace/OrderSystem.pln');
		const content = `#schema flow\nclass OrderSystem {}`;
		(indexer as any).indexContent(testUri, content);

		// Index target entity with methods
		const targetContent = `#schema flow
class PaymentService {
    [Methods]
    + charge(amount)
    + refund(amount)
}`;
		(indexer as any).indexContent(vscode.Uri.file('/path/to/workspace/PaymentService.pln'), targetContent);

		const provider = new FlowCompletionItemProvider(indexer);
		
		const doc = {
			lineAt: (pos: vscode.Position) => ({ text: '    -> PaymentService.' }),
			getText: () => content,
			uri: testUri,
		} as unknown as vscode.TextDocument;

		const position = new vscode.Position(0, 22); // position after "PaymentService."
		const token = new vscode.CancellationTokenSource().token;
		const context = { triggerKind: vscode.CompletionTriggerKind.TriggerCharacter, triggerCharacter: '.' } as vscode.CompletionContext;

		const result = await provider.provideCompletionItems(doc, position, token, context);
		assert.ok(Array.isArray(result));
		const items = result as vscode.CompletionItem[];
		
		const labels = items.map(item => item.label);
		assert.ok(labels.includes('charge'));
		assert.ok(labels.includes('refund'));
	});

	test('HoverProvider shows entity and method previews', async () => {
		const testUri = vscode.Uri.file('/path/to/workspace/OrderSystem.pln');
		const content = `#schema flow
class OrderSystem {
    [Methods]
    + run() {
        -> PaymentService.charge(100)
    }
}`;
		(indexer as any).indexContent(testUri, content);

		const targetContent = `#schema flow
class PaymentService {
    [Methods]
    + charge(amount)
}`;
		(indexer as any).indexContent(vscode.Uri.file('/path/to/workspace/PaymentService.pln'), targetContent);

		const provider = new FlowHoverProvider(indexer);

		// Cursor is on "PaymentService"
		const doc = {
			getText: () => content,
			uri: testUri,
		} as unknown as vscode.TextDocument;

		const position = new vscode.Position(4, 15); // "-> PaymentService.charge"
		const token = new vscode.CancellationTokenSource().token;

		const hover = await provider.provideHover(doc, position, token);
		assert.ok(hover);
		assert.ok(hover?.contents);
		const hoverText = (hover?.contents[0] as vscode.MarkdownString).value;
		
		assert.ok(hoverText.includes('PaymentService'));
		assert.ok(hoverText.includes('charge'));
	});

	test('CompletionProvider suggests UML relationship keywords', async () => {
		const provider = new FlowCompletionItemProvider(indexer);
		
		const doc = {
			lineAt: (pos: vscode.Position) => ({ text: '    ' }),
			getText: () => '#schema flow\nclass OrderSystem {\n    ',
			uri: vscode.Uri.file('/path/to/workspace/OrderSystem.pln'),
		} as unknown as vscode.TextDocument;

		const position = new vscode.Position(2, 4); // position inside the class block after spaces
		const token = new vscode.CancellationTokenSource().token;
		const context = { triggerKind: vscode.CompletionTriggerKind.Invoke } as vscode.CompletionContext;

		const result = await provider.provideCompletionItems(doc, position, token, context);
		assert.ok(Array.isArray(result));
		const items = result as vscode.CompletionItem[];
		
		const labels = items.map(item => item.label);
		assert.ok(labels.includes('inherits ->'));
		assert.ok(labels.includes('implements ->'));
		assert.ok(labels.includes('associates ->'));
		assert.ok(labels.includes('aggregates ->'));
		assert.ok(labels.includes('composes ->'));
		assert.ok(labels.includes('dependsOn ->'));
	});
});
