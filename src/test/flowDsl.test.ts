import * as assert from 'assert';

import {
	buildFlowGraphModel,
	findEntityDeclarationLine,
	findReferenceAtPosition,
	getFlowFileName,
	parseFlowDocument,
} from '../flowDsl';
import { buildDefaultTemplatePreview } from '../commandController';

suite('Flow DSL helpers', () => {
	test('parses entity and references', () => {
		const parsed = parseFlowDocument('entity OrderSystem\n-> PaymentService\n-> InventoryService\n');

		assert.strictEqual(parsed.entityName, 'OrderSystem');
		assert.deepStrictEqual(parsed.references.map((reference) => reference.targetName), [
			'PaymentService',
			'InventoryService',
		]);
	});

	test('finds reference at cursor position', () => {
		const reference = findReferenceAtPosition('entity OrderSystem\n-> PaymentService\n', 1, 5);

		assert.ok(reference);
		assert.strictEqual(reference?.targetName, 'PaymentService');
	});

	test('finds entity declaration line', () => {
		const line = findEntityDeclarationLine('// note\nentity InventoryService\n', 'InventoryService');

		assert.strictEqual(line, 1);
	});

	test('builds flow file names', () => {
		assert.strictEqual(getFlowFileName('OrderSystem'), 'OrderSystem.plan');
	});

	test('builds graph nodes and edges from documents', () => {
		const graph = buildFlowGraphModel([
			{ fileName: 'OrderSystem.plan', text: 'class OrderSystem {\n    [Relations]\n    -> PaymentService\n}\n' },
			{ fileName: 'PaymentService.plan', text: 'class PaymentService {\n}\n' },
		]);

		assert.deepStrictEqual(graph.entities.map((entity) => entity.name).sort(), [
			'OrderSystem',
			'PaymentService',
		]);
		assert.strictEqual(graph.entities[0]?.relationTargets[0], 'PaymentService');
	});

	test('parses bind, methods, and relations', () => {
		const parsed = parseFlowDocument(
			'class OrderController {\n' +
			'bind: "../src/OrderController.ts"\n' +
			'autoImport: true\n' +
			'[Relations]\n' +
			'-> BaseController\n' +
			'[Methods]\n' +
			'+ createOrder(userId, items) {\n' +
			'  -> PaymentService.charge(amount)\n' +
			'}\n',
		);

		assert.strictEqual(parsed.blockKind, 'class');
		assert.strictEqual(parsed.bindSourcePath, '../src/OrderController.ts');
		assert.strictEqual(parsed.autoImport, true);
		assert.deepStrictEqual(parsed.relationTargets, ['BaseController']);
		assert.strictEqual(parsed.methods[0]?.name, 'createOrder');
		assert.deepStrictEqual(parsed.methods[0]?.parameters, ['userId', 'items']);
		assert.strictEqual(parsed.methods[0]?.callsTo[0]?.targetName, 'PaymentService');
		assert.strictEqual(parsed.methods[0]?.callsTo[0]?.targetMethodName, 'charge');
	});

	test('builds flow templates for plan entry files', () => {
		const preview = buildDefaultTemplatePreview('OrderController', 'class');

		assert.ok(preview.includes('class OrderController {'));
		assert.ok(preview.includes('[Methods]'));
	});
});
