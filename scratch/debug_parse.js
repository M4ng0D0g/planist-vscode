const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return {
            window: {
                showInformationMessage: () => {},
                showErrorMessage: () => {}
            },
            workspace: {
                getConfiguration: () => ({
                    get: (key, defaultValue) => defaultValue
                })
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

const { parseFlowDocuments } = require('../out/dsl/flowDsl.js');
const content = `class OrderSystem {
    bind: "../src/OrderSystem.ts"
    [Methods]
    + processOrder(orderId, amount) {
        -> PaymentService.charge(amount)
    }
}`;
const docs = parseFlowDocuments(content);
console.log("Docs parsed:", JSON.stringify(docs, null, 2));
