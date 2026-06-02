# planist-vscode

A VS Code extension for tree-shaped flow management with a text-first `.flow` DSL.

## Features

- Define one entity per file with plain text.
- Use `-> TargetEntity` references to jump to definitions with Ctrl+Click.
- Automatically create a missing target file when jumping to a new entity.
- Open a live flow graph preview from the editor title button.
- Render the graph with Cytoscape.js and Dagre for automatic layered layout.
- Double-click a node in the preview to open its source file.

## File format

```text
entity OrderSystem
-> PaymentService
-> InventoryService
```

## Usage

- Save files with the `.flow` extension.
- Click the preview button in the editor title bar to open the graph.
- Double-click a node in the graph to jump back to its file.

## Packaging

Run `npm run package:vsix` to build a local VSIX package.
