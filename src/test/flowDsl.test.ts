import * as assert from 'assert';

import {
	buildFlowGraphModel,
	findEntityDeclarationLine,
	findReferenceAtPosition,
	getFlowFileName,
	parseFlowDocument,
	parseFlowDocuments,
	parseExternalClass,
} from '../dsl/flowDsl';
import { LogManager } from '../config/logger';

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
		assert.strictEqual(getFlowFileName('OrderSystem'), 'OrderSystem.pln');
	});

	test('builds graph nodes and edges from documents', () => {
		const graph = buildFlowGraphModel([
			{ fileName: 'OrderSystem.pln', text: 'class OrderSystem {\n    [Relations]\n    -> PaymentService\n}\n' },
			{ fileName: 'PaymentService.pln', text: 'class PaymentService {\n}\n' },
		]);

		assert.deepStrictEqual(graph.entities.map((entity) => entity.name).sort(), [
			'OrderSystem',
			'PaymentService',
		]);
		assert.strictEqual(graph.entities[0]?.relationTargets[0], 'PaymentService');
	});

	test('parses #reference, methods, and relations', () => {
		const parsed = parseFlowDocument(
			'#reference "../src/OrderController.ts"\n' +
			'class OrderController {\n' +
			'[Relations]\n' +
			'-> BaseController\n' +
			'[Methods]\n' +
			'+ createOrder(userId, items) {\n' +
			'  -> PaymentService.charge(amount)\n' +
			'}\n',
		);

		assert.strictEqual(parsed.blockKind, 'class');
		assert.deepStrictEqual(parsed.referenceFiles, ['../src/OrderController.ts']);
		assert.deepStrictEqual(parsed.relationTargets, ['BaseController']);
		assert.strictEqual(parsed.methods[0]?.name, 'createOrder');
		assert.deepStrictEqual(parsed.methods[0]?.parameters, ['userId', 'items']);
		assert.strictEqual(parsed.methods[0]?.callsTo[0]?.targetName, 'PaymentService');
		assert.strictEqual(parsed.methods[0]?.callsTo[0]?.targetMethodName, 'charge');
	});

	test('parses multiple entities in one file', () => {
		const docs = parseFlowDocuments(
			'#reference "./Helper.ts"\n' +
			'class ServiceA {\n' +
			'  + doSomething()\n' +
			'}\n' +
			'interface ServiceB {\n' +
			'  + doOther()\n' +
			'}\n' +
			'bind ServiceC\n'
		);

		assert.strictEqual(docs.length, 3);
		assert.strictEqual(docs[0].entityName, 'ServiceA');
		assert.strictEqual(docs[0].blockKind, 'class');
		assert.deepStrictEqual(docs[0].referenceFiles, ['./Helper.ts']);
		assert.strictEqual(docs[0].methods[0].name, 'doSomething');

		assert.strictEqual(docs[1].entityName, 'ServiceB');
		assert.strictEqual(docs[1].blockKind, 'interface');
		assert.deepStrictEqual(docs[1].referenceFiles, ['./Helper.ts']);
		assert.strictEqual(docs[1].methods[0].name, 'doOther');

		assert.strictEqual(docs[2].entityName, 'ServiceC');
		assert.strictEqual(docs[2].blockKind, 'bind');
		assert.deepStrictEqual(docs[2].referenceFiles, ['./Helper.ts']);
	});

	test('parses external classes', () => {
		const externalText = `
			// This is a comment
			public class MyClass {
				// field comment
				private String name;
				
				/** method comment */
				public int getNameCount(List<String> list) {
					return 0;
				}
			}
		`;
		const parsed = parseExternalClass(externalText, 'MyClass');
		assert.ok(parsed);
		assert.strictEqual(parsed?.kind, 'class');
		assert.strictEqual(parsed?.accessModifier, '+');
		assert.strictEqual(parsed?.fields[0]?.name, 'name');
		assert.strictEqual(parsed?.fields[0]?.accessModifier, '-');
		assert.strictEqual(parsed?.methods[0]?.name, 'getNameCount');
		assert.strictEqual(parsed?.methods[0]?.accessModifier, '+');
		assert.deepStrictEqual(parsed?.methods[0]?.comments, ['method comment']);
	});

	test('buildFlowGraphModel resolves bind kind with external class details', () => {
		const graph = buildFlowGraphModel(
			[
				{
					fileName: 'App.pln',
					text: '#reference "@/src/MyClass.ts"\nbind MyClass\n'
				}
			],
			(p) => p.replace('@', 'd:/workspace'),
			(p) => {
				if (p === 'd:/workspace/src/MyClass.ts') {
					return 'class MyClass {\n  + fetchDetails(): void\n}';
				}
				return undefined;
			}
		);

		assert.strictEqual(graph.entities.length, 1);
		const entity = graph.entities[0];
		assert.strictEqual(entity.name, 'MyClass');
		assert.strictEqual(entity.kind, 'class');
		assert.strictEqual(entity.methods[0]?.name, 'fetchDetails');
	});

	test('parses modifiers and shorthand access symbols', () => {
		const parsed = parseFlowDocument(
			'+ class MyClass {\n' +
			'  static const myField: int[]\n' +
			'  -myPrivateMethod(): void {\n' +
			'  }\n' +
			'  # final static myProtectedMethod() {\n' +
			'  }\n' +
			'}\n'
		);

		assert.strictEqual(parsed.blockKind, 'class');
		assert.strictEqual(parsed.entityName, 'MyClass');
		assert.strictEqual(parsed.accessModifier, '+');

		// fields
		assert.strictEqual(parsed.fields[0]?.name, 'myField');
		assert.strictEqual(parsed.fields[0]?.accessModifier, null);
		assert.deepStrictEqual(parsed.fields[0]?.modifiers, ['static', 'const']);
		assert.strictEqual(parsed.fields[0]?.type, 'int[]');

		// methods
		assert.strictEqual(parsed.methods[0]?.name, 'myPrivateMethod');
		assert.strictEqual(parsed.methods[0]?.accessModifier, '-');
		assert.strictEqual(parsed.methods[0]?.modifiers, undefined);

		assert.strictEqual(parsed.methods[1]?.name, 'myProtectedMethod');
		assert.strictEqual(parsed.methods[1]?.accessModifier, '#');
		assert.deepStrictEqual(parsed.methods[1]?.modifiers, ['final', 'static']);
	});



	test('parses public static final and complex return types with array, generics, const, pointers/references', () => {
		const parsed = parseFlowDocument(
			'class TestClass {\n' +
			'  public static final method1(): void {\n' +
			'  }\n' +
			'  # method2(): const std::map<int, std::vector<char>>* const& {\n' +
			'  }\n' +
			'  myField: const int*\n' +
			'}\n'
		);

		assert.strictEqual(parsed.entityName, 'TestClass');
		
		// fields
		assert.strictEqual(parsed.fields[0]?.name, 'myField');
		assert.strictEqual(parsed.fields[0]?.type, 'const int*');

		// methods
		assert.strictEqual(parsed.methods[0]?.name, 'method1');
		assert.strictEqual(parsed.methods[0]?.accessModifier, 'public');
		assert.deepStrictEqual(parsed.methods[0]?.modifiers, ['static', 'final']);
		assert.strictEqual(parsed.methods[0]?.returnType, 'void');

		assert.strictEqual(parsed.methods[1]?.name, 'method2');
		assert.strictEqual(parsed.methods[1]?.accessModifier, '#');
		assert.strictEqual(parsed.methods[1]?.returnType, 'const std::map<int, std::vector<char>>* const&');
	});

	test('parses instantiation, emit events, and conditional method blocks', () => {
		const parsed = parseFlowDocument(
			'class OrderService {\n' +
			'  public createOrder(): void {\n' +
			'    new -> Order\n' +
			'    if (isVIP) {\n' +
			'      -> VIPDiscount.apply()\n' +
			'    } else {\n' +
			'      -> RegularDiscount.apply()\n' +
			'    }\n' +
			'  }\n' +
			'  public charge(): void {\n' +
			'    emit -> PaymentEvent.Success\n' +
			'  }\n' +
			'}\n'
		);

		assert.strictEqual(parsed.entityName, 'OrderService');
		assert.strictEqual(parsed.methods.length, 2);

		// method 1: createOrder
		const m1 = parsed.methods[0];
		assert.strictEqual(m1.name, 'createOrder');
		assert.strictEqual(m1.callsTo.length, 3);
		
		// new -> Order
		assert.strictEqual(m1.callsTo[0].targetName, 'Order');
		assert.strictEqual(m1.callsTo[0].relationType, 'new');
		assert.strictEqual(m1.callsTo[0].condition, undefined);

		// if (isVIP) -> VIPDiscount
		assert.strictEqual(m1.callsTo[1].targetName, 'VIPDiscount');
		assert.strictEqual(m1.callsTo[1].condition, 'isVIP');

		// else -> RegularDiscount
		assert.strictEqual(m1.callsTo[2].targetName, 'RegularDiscount');
		assert.strictEqual(m1.callsTo[2].condition, 'else');

		// method 2: charge
		const m2 = parsed.methods[1];
		assert.strictEqual(m2.name, 'charge');
		assert.strictEqual(m2.callsTo.length, 1);
		
		// emit -> PaymentEvent.Success
		assert.strictEqual(m2.callsTo[0].targetName, 'PaymentEvent');
		assert.strictEqual(m2.callsTo[0].targetMethodName, 'Success');
		assert.strictEqual(m2.callsTo[0].relationType, 'emit');
	});

	test('parses visual overrides', () => {
		const parsed = parseFlowDocument(
			'class OrderController {\n' +
			'    @style.color: rgba(75, 192, 192, 1.0)\n' +
			'    @style.borderColor: rgba(255, 99, 132, 1.0)\n' +
			'    @style.borderRadius: 12\n' +
			'    @style.opacity: 0.85\n' +
			'}\n'
		);

		assert.deepStrictEqual(parsed.visualOverride, {
			color: 'rgba(75, 192, 192, 1.0)',
			borderColor: 'rgba(255, 99, 132, 1.0)',
			borderRadius: 12,
			opacity: 0.85
		});
	});

	test('parses inline OO relationship keywords', () => {
		const parsed = parseFlowDocument(
			'class CustomerService {\n' +
			'    inherits -> BaseService\n' +
			'    implements -> IService\n' +
			'    associates -> Address\n' +
			'    aggregates -> Order\n' +
			'    composes -> Account\n' +
			'    dependsOn -> LogManager\n' +
			'}\n'
		);

		assert.deepStrictEqual(parsed.inheritsTargets, ['BaseService']);
		assert.deepStrictEqual(parsed.implementsTargets, ['IService']);
		assert.deepStrictEqual(parsed.associatesTargets, ['Address']);
		assert.deepStrictEqual(parsed.aggregatesTargets, ['Order']);
		assert.deepStrictEqual(parsed.composesTargets, ['Account']);
		assert.deepStrictEqual(parsed.dependsOnTargets, ['LogManager']);
	});

	test('LogManager assertions check parameters and flows', () => {
		// LogManager.assert should pass when condition is true
		assert.doesNotThrow(() => {
			LogManager.assert(true, 'This should not throw');
		});

		// LogManager.assert should throw when condition is false
		assert.throws(() => {
			LogManager.assert(false, 'This should throw');
		}, /\[Planist-AssertionError\]/);
	});

	test('parses package and module block kinds', () => {
		const parsedPkg = parseFlowDocument(
			'package MyPkg {\n' +
			'  display: "My Beautiful Package"\n' +
			'  -> ChildA\n' +
			'  -> ChildB\n' +
			'}\n'
		);
		assert.strictEqual(parsedPkg.blockKind, 'package');
		assert.strictEqual(parsedPkg.entityName, 'MyPkg');
		assert.strictEqual(parsedPkg.display, 'My Beautiful Package');
		assert.deepStrictEqual(parsedPkg.contains, ['ChildA', 'ChildB']);

		const parsedMod = parseFlowDocument(
			'module MyMod {\n' +
			'  display: "My Beautiful Module"\n' +
			'  -> ChildC\n' +
			'}\n'
		);
		assert.strictEqual(parsedMod.blockKind, 'module');
		assert.strictEqual(parsedMod.entityName, 'MyMod');
		assert.strictEqual(parsedMod.display, 'My Beautiful Module');
		assert.deepStrictEqual(parsedMod.contains, ['ChildC']);
	});

	test('parses text block kinds and extracts textBody content', () => {
		const parsedText = parseFlowDocument(
			'text MyText {\n' +
			'  Line 1 of text\n' +
			'  Line 2 of text\n' +
			'  style.color: #fff\n' +
			'}\n'
		);
		assert.strictEqual(parsedText.blockKind, 'text');
		assert.strictEqual(parsedText.entityName, 'MyText');
		assert.strictEqual(parsedText.textBody, 'Line 1 of text\nLine 2 of text');
	});

	test('buildFlowGraphModel maps parent packages correctly', () => {
		const graph = buildFlowGraphModel(
			[
				{
					fileName: 'MyPkg.pln',
					uri: { fsPath: 'd:/workspace/pkg/MyPkg.pln' } as any,
					text: 'package MyPkg {\n  display: "My Beautiful Package"\n  -> ChildC\n}\n'
				},
				{
					fileName: 'ChildA.pln',
					uri: { fsPath: 'd:/workspace/pkg/ChildA.pln' } as any,
					text: 'class ChildA {}\n'
				},
				{
					fileName: 'ChildB.pln',
					uri: { fsPath: 'd:/workspace/other/ChildB.pln' } as any,
					text: 'class ChildB {}\n'
				},
				{
					fileName: 'ChildC.pln',
					uri: { fsPath: 'd:/workspace/other/ChildC.pln' } as any,
					text: 'class ChildC {}\n'
				}
			]
		);

		const childA = graph.entities.find(e => e.name === 'ChildA');
		const childB = graph.entities.find(e => e.name === 'ChildB');
		const childC = graph.entities.find(e => e.name === 'ChildC');

		// ChildA is in the same directory as MyPkg -> parent should be MyPkg
		assert.strictEqual(childA?.parent, 'MyPkg');
		// ChildB is in a different directory and not in contains -> parent should be undefined
		assert.strictEqual(childB?.parent, undefined);
		// ChildC is in a different directory but explicitly in contains of MyPkg -> parent should be MyPkg
		assert.strictEqual(childC?.parent, 'MyPkg');
	});
});
