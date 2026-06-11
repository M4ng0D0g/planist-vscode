import * as vscode from 'vscode';
import { ISchemaRenderer } from './SchemaRenderer';
import { WebviewPage } from '../core/WebviewPage';
import { RawHtmlComponent } from '../core/Component';

// @state: yellow
export class DesignSchemaRenderer implements ISchemaRenderer {
	// @state: yellow
	public renderPage(webview: vscode.Webview, nonce: string): WebviewPage {
		const page = new WebviewPage('Planist UI Designer');

		page.addMeta(`<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">`);

		page.addStyle(`
			:root {
				--bg-color: #0c0d12;
				--sidebar-bg: rgba(20, 21, 26, 0.85);
				--border-color: rgba(255, 255, 255, 0.08);
				--text-color: #f3f4f6;
				--accent-color: #3b82f6;
				--accent-hover: #2563eb;
				--success-color: #10b981;
				--success-hover: #059669;
				--danger-color: #ef4444;
				--danger-hover: #dc2626;
			}

			* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
			body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background-color: var(--bg-color); color: var(--text-color); }

			#designer-container { display: flex; flex-direction: column; width:100%; height:100%; }

			#toolbar {
				height: 50px;
				background: rgba(18, 19, 24, 0.9);
				border-bottom: 1px solid var(--border-color);
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0 20px;
				backdrop-filter: blur(10px);
				z-index: 10;
			}
			.brand-title { font-weight: 800; background: linear-gradient(135deg, #60a5fa, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size:15px; letter-spacing:0.5px; }
			.toolbar-group { display: flex; gap: 10px; align-items: center; }

			#main-content { display: flex; flex: 1; overflow: hidden; }

			.sidebar {
				width: 280px;
				background: var(--sidebar-bg);
				border-right: 1px solid var(--border-color);
				display: flex;
				flex-direction: column;
				padding: 15px;
				overflow-y: auto;
				backdrop-filter: blur(10px);
			}
			#right-sidebar { border-right: none; border-left: 1px solid var(--border-color); }

			.section { margin-bottom: 25px; }
			.section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: rgba(255,255,255,0.4); letter-spacing: 1.2px; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; }

			.catalog-list { display: flex; flex-direction: column; gap: 8px; }
			.catalog-item {
				background: rgba(255,255,255,0.03);
				border: 1px solid rgba(255,255,255,0.06);
				border-radius: 6px;
				padding: 8px 12px;
				font-size: 12px;
				cursor: grab;
				transition: all 0.2s ease;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.catalog-item:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
			.catalog-icon { font-size: 10px; color: var(--accent-color); opacity: 0.8; }

			#canvas-container { flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; padding:20px; background:#111216; position: relative; }
			#canvas {
				width: 800px;
				height: 600px;
				background-color: #17181c;
				border: 1px solid rgba(255,255,255,0.1);
				position: relative;
				border-radius: 8px;
				box-shadow: 0 10px 40px rgba(0,0,0,0.6);
				overflow: hidden;
			}

			.bg-grid {
				background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
								  linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
				background-size: 20px 20px;
			}
			.bg-dots {
				background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 0);
				background-size: 20px 20px;
			}
			.bg-none { background-image: none !important; }

			/* UI Elements inside Canvas */
			.canvas-element {
				outline: 1px dashed rgba(255,255,255,0.18);
				box-sizing: border-box;
				min-height: 24px;
				min-width: 24px;
				position: relative;
			}
			.canvas-element:hover {
				outline-color: rgba(59, 130, 246, 0.5);
			}
			.canvas-element.selected {
				outline: 2px solid var(--accent-color) !important;
				z-index: 5;
			}
			.drag-over-container {
				outline: 2px dashed var(--success-color) !important;
				background: rgba(16, 185, 129, 0.05) !important;
			}

			/* Right Property Fields */
			.prop-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
			.prop-label { font-size: 11px; color: rgba(255,255,255,0.6); font-weight:500; }
			.prop-input, .prop-select {
				background: rgba(255,255,255,0.05);
				border: 1px solid rgba(255,255,255,0.1);
				border-radius: 6px;
				color: #fff;
				padding: 6px 10px;
				font-size: 12px;
				width: 100%;
			}
			.prop-input:focus, .prop-select:focus { outline:none; border-color: var(--accent-color); }

			/* Tree View Styles */
			#tree-container { display: flex; flex-direction: column; gap: 2px; }
			.tree-item-wrapper { display: flex; flex-direction: column; }
			.tree-node {
				padding: 6px 10px;
				font-size: 12px;
				cursor: pointer;
				border-radius: 6px;
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 2px;
				background: rgba(255,255,255,0.02);
				border: 1px solid transparent;
				transition: all 0.15s;
			}
			.tree-node:hover { background: rgba(255,255,255,0.06); }
			.tree-node.selected { background: rgba(59, 130, 246, 0.15) !important; border-color: var(--accent-color); color:#fff; }
			.tree-node-title { display: flex; align-items: center; gap: 6px; }
			.tree-node-delete { color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; border: none; background: none; padding: 2px 6px; }
			.tree-node-delete:hover { color: #f43f5e; }

			/* Buttons */
			.t-btn {
				background: rgba(255,255,255,0.08);
				border: 1px solid rgba(255,255,255,0.1);
				color: #fff;
				padding: 6px 12px;
				border-radius: 6px;
				font-size: 12px;
				cursor: pointer;
				transition: all 0.2s;
			}
			.t-btn:hover { background: rgba(255,255,255,0.15); }
			.t-btn.primary { background: var(--accent-color); border-color:transparent; }
			.t-btn.primary:hover { background: var(--accent-hover); }
			.t-btn.success { background: var(--success-color); border-color:transparent; }
			.t-btn.success:hover { background: var(--success-hover); }
			.t-btn.danger { background: var(--danger-color); border-color:transparent; }
			.t-btn.danger:hover { background: var(--danger-hover); }

			.no-selection { font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; margin-top: 30px; font-style: italic; }
		`);

		const html = `
			<div id="designer-container">
				<div id="toolbar">
					<span class="brand-title">PLANIST DESIGN STUDIO</span>
					<div class="toolbar-group">
						<button class="t-btn" id="bg-pattern-btn" title="切換背景網格/點圖/無">網格</button>
						<button class="t-btn danger" id="clear-btn">清空畫布</button>
					</div>
				</div>
				<div id="main-content">
					<!-- Left Sidebar -->
					<div id="left-sidebar" class="sidebar">
						<div class="section">
							<div class="section-title">基礎元件庫 (Catalog)</div>
							<div class="catalog-list">
								<div class="catalog-item" draggable="true" data-type="stackPanel">
									<span>StackPanel (疊排)</span>
									<span class="catalog-icon">☰</span>
								</div>
								<div class="catalog-item" draggable="true" data-type="grid">
									<span>Grid (網格)</span>
									<span class="catalog-icon">⚏</span>
								</div>
								<div class="catalog-item" draggable="true" data-type="container">
									<span>Container (容器)</span>
									<span class="catalog-icon">⛶</span>
								</div>
								<div class="catalog-item" draggable="true" data-type="textBlock">
									<span>TextBlock (文字)</span>
									<span class="catalog-icon">T</span>
								</div>
								<div class="catalog-item" draggable="true" data-type="button">
									<span>Button (按鈕)</span>
									<span class="catalog-icon">🔘</span>
								</div>
								<div class="catalog-item" draggable="true" data-type="image">
									<span>Image (圖片)</span>
									<span class="catalog-icon">🖼</span>
								</div>
								<div class="catalog-item" draggable="true" data-type="textField">
									<span>TextField (輸入框)</span>
									<span class="catalog-icon">✎</span>
								</div>
							</div>
						</div>
						<div class="section">
							<div class="section-title">元件樹架構 (Tree View)</div>
							<div id="tree-container"></div>
						</div>
						<div class="section">
							<div class="section-title">模板庫 (Templates)</div>
							<div id="templates-container" class="catalog-list"></div>
						</div>
					</div>
					
					<!-- Center Canvas -->
					<div id="canvas-container">
						<div id="canvas" class="bg-grid"></div>
					</div>
					
					<!-- Right Sidebar -->
					<div id="right-sidebar" class="sidebar">
						<div class="section-title">屬性面板 (Properties)</div>
						<div id="properties-editor">
							<div class="no-selection">請選擇元件以進行編輯</div>
						</div>
						
						<div id="template-action-section" style="display:none; margin-top:20px; border-top:1px solid var(--border-color); padding-top:15px;">
							<button class="t-btn success" id="create-template-btn" style="width:100%;">建立為新模板</button>
						</div>
					</div>
				</div>
			</div>
		`;

		const js = `
			const vscode = acquireVsCodeApi();
			let themeData = {
				themeName: 'MyUIDraft',
				config: { background: 'grid', primaryColor: '#3b82f6', backgroundColor: '#111827' },
				panels: [],
				templates: []
			};
			let selectedNodeName = null;
			let currentDragType = null;
			let currentDragIsTemplate = false;

			// Elements
			const canvas = document.getElementById('canvas');
			const bgPatternBtn = document.getElementById('bg-pattern-btn');
			const clearBtn = document.getElementById('clear-btn');
			const treeContainer = document.getElementById('tree-container');
			const templatesContainer = document.getElementById('templates-container');
			const propertiesEditor = document.getElementById('properties-editor');
			const templateActionSection = document.getElementById('template-action-section');
			const createTemplateBtn = document.getElementById('create-template-btn');

			// Handle incoming VS Code messages
			window.addEventListener('message', event => {
				const message = event.data;
				if (message.command === 'updateSchemaData' && message.schema === 'design') {
					if (message.data) {
						themeData = {
							themeName: message.data.themeName || 'MyUIDraft',
							config: message.data.config || { background: 'grid', primaryColor: '#3b82f6', backgroundColor: '#111827' },
							panels: message.data.panels || [],
							templates: message.data.templates || []
						};
						
						// Sync default config properties
						if (!themeData.config.background) themeData.config.background = 'grid';
						if (!themeData.config.primaryColor) themeData.config.primaryColor = '#3b82f6';
						if (!themeData.config.backgroundColor) themeData.config.backgroundColor = '#111827';

						reRender();
					}
				}
			});

			// Setup Catalog drag start
			document.querySelectorAll('.catalog-item').forEach(item => {
				item.addEventListener('dragstart', (e) => {
					currentDragType = item.getAttribute('data-type');
					currentDragIsTemplate = false;
					e.dataTransfer.setData('text/plain', currentDragType);
				});
			});

			// Canvas background pattern selector
			bgPatternBtn.addEventListener('click', () => {
				const patterns = ['grid', 'dots', 'none'];
				const current = themeData.config.background || 'grid';
				const nextIndex = (patterns.indexOf(current) + 1) % patterns.length;
				const next = patterns[nextIndex];
				themeData.config.background = next;
				bgPatternBtn.textContent = next === 'grid' ? '網格' : (next === 'dots' ? '點圖' : '無');
				reRender();
				syncChanges();
			});

			// Clear Canvas
			clearBtn.addEventListener('click', () => {
				themeData.panels = [];
				selectedNodeName = null;
				reRender();
				syncChanges();
			});

			// Create template from selected node
			createTemplateBtn.addEventListener('click', () => {
				if (!selectedNodeName) return;
				const node = findNodeByName(themeData.panels, selectedNodeName);
				if (!node) return;
				
				const templateName = prompt('請輸入模板名稱:', 'NewTemplate');
				if (!templateName) return;
				
				const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '') || 'CustomTemplate';
				
				// Deep clone node to build template
				const nodeClone = JSON.parse(JSON.stringify(node));
				
				// Ensure templates list exists
				if (!themeData.templates) themeData.templates = [];
				themeData.templates.push({
					name: safeName,
					rootComponent: nodeClone
				});

				reRender();
				syncChanges();
				alert('模板 "' + safeName + '" 建立成功！可在左側欄模板庫中拖放使用。');
			});

			// Render routine
			function reRender() {
				// 1. Update Canvas background
				canvas.className = 'bg-' + (themeData.config.background || 'grid');
				canvas.style.backgroundColor = themeData.config.backgroundColor || '#17181c';
				
				// 2. Clear Canvas HTML
				canvas.innerHTML = '';
				
				// 3. Render top level panels recursively
				themeData.panels.forEach(panel => {
					const el = renderComponentNode(panel);
					canvas.appendChild(el);
				});

				// 4. Render Tree View
				renderTreeView();

				// 5. Render Templates List
				renderTemplatesCatalog();

				// 6. Update Properties Sidebar
				renderProperties();
			}

			// Recursive renderer for UIComponent -> HTMLElement
			function renderComponentNode(comp) {
				const el = document.createElement('div');
				el.className = 'canvas-element';
				el.setAttribute('data-name', comp.name);
				el.setAttribute('data-type', comp.type);

				if (selectedNodeName === comp.name) {
					el.classList.add('selected');
				}

				// Apply base layout styles
				const props = comp.properties || {};
				if (props.width) el.style.width = typeof props.width === 'number' ? props.width + 'px' : props.width;
				if (props.height) el.style.height = typeof props.height === 'number' ? props.height + 'px' : props.height;
				if (props.backgroundColor) el.style.backgroundColor = props.backgroundColor;
				if (props.borderRadius) el.style.borderRadius = props.borderRadius + 'px';
				if (props.padding) el.style.padding = props.padding + 'px';
				if (props.margin) el.style.margin = props.margin + 'px';
				if (props.opacity !== undefined) el.style.opacity = props.opacity;

				// Specific elements styling & layout
				if (comp.type === 'panel') {
					el.style.position = 'absolute';
					el.style.left = (props.left || 0) + 'px';
					el.style.top = (props.top || 0) + 'px';
					el.style.display = 'flex';
					el.style.flexDirection = 'column';
				} else if (comp.type === 'stackPanel') {
					el.style.display = 'flex';
					el.style.flexDirection = props.orientation === 'horizontal' ? 'row' : 'column';
					el.style.gap = (props.gap || 0) + 'px';
				} else if (comp.type === 'grid') {
					el.style.display = 'grid';
					if (props.rows) el.style.gridTemplateRows = props.rows;
					if (props.columns) el.style.gridTemplateColumns = props.columns;
				} else if (comp.type === 'textBlock') {
					el.style.display = 'inline-block';
					el.textContent = props.text || 'TextBlock';
					if (props.fontSize) el.style.fontSize = props.fontSize + 'px';
					if (props.color) el.style.color = props.color;
					if (props.fontWeight) el.style.fontWeight = props.fontWeight;
				} else if (comp.type === 'button') {
					const btn = document.createElement('button');
					btn.className = 't-btn primary';
					btn.style.width = '100%';
					btn.style.height = '100%';
					btn.textContent = props.text || 'Button';
					if (props.color) btn.style.backgroundColor = props.color;
					el.appendChild(btn);
				} else if (comp.type === 'image') {
					const img = document.createElement('img');
					img.src = props.src || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23444"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23aaa">Image</text></svg>';
					img.style.width = '100%';
					img.style.height = '100%';
					img.style.objectFit = 'cover';
					el.appendChild(img);
				} else if (comp.type === 'textField') {
					const input = document.createElement('input');
					input.type = 'text';
					input.className = 'prop-input';
					input.style.width = '100%';
					input.placeholder = props.placeholder || 'Enter text...';
					input.disabled = true; // Preview only
					el.appendChild(input);
				}

				// Grid placement child values
				if (props['grid.row'] !== undefined) el.style.gridRow = props['grid.row'] + 1; // 1-indexed for CSS
				if (props['grid.column'] !== undefined) el.style.gridColumn = props['grid.column'] + 1;

				// Dragging top-level panels absolutely
				if (comp.type === 'panel') {
					el.style.cursor = 'move';
					el.addEventListener('mousedown', (e) => {
						if (e.target.closest('.canvas-element') !== el) return; // Only drag panel itself
						e.stopPropagation();
						selectedNodeName = comp.name;
						reRender();

						const startX = e.clientX;
						const startY = e.clientY;
						const startLeft = props.left || 0;
						const startTop = props.top || 0;

						function doDrag(dragEvt) {
							props.left = startLeft + dragEvt.clientX - startX;
							props.top = startTop + dragEvt.clientY - startY;
							el.style.left = props.left + 'px';
							el.style.top = props.top + 'px';
						}

						function stopDrag() {
							document.documentElement.removeEventListener('mousemove', doDrag);
							document.documentElement.removeEventListener('mouseup', stopDrag);
							syncChanges();
						}

						document.documentElement.addEventListener('mousemove', doDrag);
						document.documentElement.addEventListener('mouseup', stopDrag);
					});
				} else {
					el.addEventListener('click', (e) => {
						e.stopPropagation();
						selectedNodeName = comp.name;
						reRender();
					});
				}

				// Setup Drag & Drop nesting target
				const containerTypes = ['panel', 'stackPanel', 'grid', 'container'];
				if (containerTypes.includes(comp.type)) {
					el.addEventListener('dragover', (e) => {
						e.preventDefault();
						e.stopPropagation();
						el.classList.add('drag-over-container');
					});
					el.addEventListener('dragleave', (e) => {
						e.stopPropagation();
						el.classList.remove('drag-over-container');
					});
					el.addEventListener('drop', (e) => {
						e.preventDefault();
						e.stopPropagation();
						el.classList.remove('drag-over-container');

						let newChild = null;

						if (currentDragIsTemplate) {
							const template = themeData.templates.find(t => t.name === currentDragType);
							if (template) {
								newChild = JSON.parse(JSON.stringify(template.rootComponent));
								// Rename recursively to prevent naming collision
								renameSubtree(newChild);
							}
						} else {
							const nameCount = countNodesByType(themeData.panels, currentDragType) + 1;
							newChild = {
								type: currentDragType,
								name: currentDragType + nameCount,
								properties: getDefaultProps(currentDragType),
								children: []
							};
						}

						if (newChild) {
							if (!comp.children) comp.children = [];
							comp.children.push(newChild);
							selectedNodeName = newChild.name;
							reRender();
							syncChanges();
						}
					});
				}

				// Render children
				if (comp.children && comp.children.length > 0 && comp.type !== 'button' && comp.type !== 'image' && comp.type !== 'textField') {
					comp.children.forEach(child => {
						el.appendChild(renderComponentNode(child));
					});
				}

				return el;
			}

			// Drag-over setup for the main canvas (to allow dropping top-level panels)
			canvas.addEventListener('dragover', (e) => {
				e.preventDefault();
			});
			canvas.addEventListener('drop', (e) => {
				e.preventDefault();
				if (e.target !== canvas) return; // handled by child dropping

				const rect = canvas.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;

				let newComp = null;

				if (currentDragIsTemplate) {
					const template = themeData.templates.find(t => t.name === currentDragType);
					if (template) {
						newComp = JSON.parse(JSON.stringify(template.rootComponent));
						renameSubtree(newComp);
						// Force position left/top if it's placed on canvas root
						newComp.properties.left = x;
						newComp.properties.top = y;
					}
				} else {
					// We only drop panels directly onto canvas root
					const type = currentDragType === 'panel' ? 'panel' : 'panel';
					const nameCount = countNodesByType(themeData.panels, type) + 1;
					newComp = {
						type: type,
						name: type + nameCount,
						properties: {
							width: 300,
							height: 200,
							left: x,
							top: y,
							backgroundColor: '#1f2937',
							borderRadius: 8,
							padding: 12
						},
						children: []
					};
					// If dropped non-panel component directly, wrap it in a panel or add it inside a new panel
					if (currentDragType !== 'panel') {
						const childCount = countNodesByType(themeData.panels, currentDragType) + 1;
						newComp.children.push({
							type: currentDragType,
							name: currentDragType + childCount,
							properties: getDefaultProps(currentDragType),
							children: []
						});
					}
				}

				if (newComp) {
					themeData.panels.push(newComp);
					selectedNodeName = newComp.name;
					reRender();
					syncChanges();
				}
			});

			// Helper: Rename recursively to avoid collision
			function renameSubtree(node) {
				const typeCount = countNodesByType(themeData.panels, node.type) + 1;
				node.name = node.type + typeCount;
				if (node.children) {
					node.children.forEach(child => renameSubtree(child));
				}
			}

			// Helper: Get default properties by component type
			function getDefaultProps(type) {
				switch(type) {
					case 'stackPanel': return { orientation: 'vertical', gap: 8 };
					case 'grid': return { rows: '1*', columns: '1*' };
					case 'container': return { width: '100%', height: 100, backgroundColor: 'rgba(255,255,255,0.02)' };
					case 'textBlock': return { text: 'TextBlock Content', fontSize: 14, color: '#ffffff' };
					case 'button': return { text: 'Click Me', width: 100, height: 36 };
					case 'image': return { width: 120, height: 80 };
					case 'textField': return { placeholder: 'Type here...' };
					default: return {};
				}
			}

			// Helper: Count node occurrences in tree
			function countNodesByType(list, type) {
				let count = 0;
				function recurse(arr) {
					arr.forEach(node => {
						if (node.type === type) count++;
						if (node.children) recurse(node.children);
					});
				}
				recurse(list);
				return count;
			}

			// Helper: Find node by name in tree
			function findNodeByName(list, name) {
				let found = null;
				function recurse(arr) {
					for (let i = 0; i < arr.length; i++) {
						if (arr[i].name === name) {
							found = arr[i];
							return;
						}
						if (arr[i].children) recurse(arr[i].children);
					}
				}
				recurse(list);
				return found;
			}

			// Helper: Remove node by name from tree
			function removeNodeByName(list, name) {
				for (let i = 0; i < list.length; i++) {
					if (list[i].name === name) {
						list.splice(i, 1);
						return true;
					}
					if (list[i].children) {
						const removed = removeNodeByName(list[i].children, name);
						if (removed) return true;
					}
				}
				return false;
			}

			// Render Tree view recursively
			function renderTreeView() {
				treeContainer.innerHTML = '';
				if (themeData.panels.length === 0) {
					const empty = document.createElement('div');
					empty.className = 'no-selection';
					empty.style.marginTop = '10px';
					empty.textContent = '拖曳元件至畫布以開始';
					treeContainer.appendChild(empty);
					return;
				}

				function buildTreeNodeEl(node, indent) {
					const wrapper = document.createElement('div');
					wrapper.className = 'tree-item-wrapper';

					const row = document.createElement('div');
					row.className = 'tree-node';
					if (selectedNodeName === node.name) row.classList.add('selected');
					row.style.paddingLeft = (indent * 12 + 8) + 'px';
					
					const titleGroup = document.createElement('div');
					titleGroup.className = 'tree-node-title';
					const icon = node.type === 'panel' ? '⛶' : (node.type === 'stackPanel' ? '☰' : (node.type === 'grid' ? '⚏' : '📄'));
					titleGroup.innerHTML = '<span style="opacity:0.5; font-size:10px;">' + icon + '</span> <span>' + node.name + '</span>';
					row.appendChild(titleGroup);

					const delBtn = document.createElement('button');
					delBtn.className = 'tree-node-delete';
					delBtn.textContent = '✕';
					delBtn.addEventListener('click', (e) => {
						e.stopPropagation();
						removeNodeByName(themeData.panels, node.name);
						if (selectedNodeName === node.name) selectedNodeName = null;
						reRender();
						syncChanges();
					});
					row.appendChild(delBtn);

					row.addEventListener('click', (e) => {
						e.stopPropagation();
						selectedNodeName = node.name;
						reRender();
					});

					wrapper.appendChild(row);

					if (node.children && node.children.length > 0) {
						node.children.forEach(child => {
							wrapper.appendChild(buildTreeNodeEl(child, indent + 1));
						});
					}

					return wrapper;
				}

				themeData.panels.forEach(panel => {
					treeContainer.appendChild(buildTreeNodeEl(panel, 0));
				});
			}

			// Render Templates list Catalog
			function renderTemplatesCatalog() {
				templatesContainer.innerHTML = '';
				const list = themeData.templates || [];
				if (list.length === 0) {
					const empty = document.createElement('div');
					empty.className = 'no-selection';
					empty.style.marginTop = '10px';
					empty.textContent = '尚未建立自訂模板';
					templatesContainer.appendChild(empty);
					return;
				}

				list.forEach(t => {
					const el = document.createElement('div');
					el.className = 'catalog-item';
					el.setAttribute('draggable', 'true');
					el.innerHTML = '<span>' + t.name + '</span> <span class="catalog-icon">★</span>';
					
					el.addEventListener('dragstart', (e) => {
						currentDragType = t.name;
						currentDragIsTemplate = true;
						e.dataTransfer.setData('text/plain', t.name);
					});

					templatesContainer.appendChild(el);
				});
			}

			// Render Right sidebar property controls
			function renderProperties() {
				propertiesEditor.innerHTML = '';
				if (!selectedNodeName) {
					propertiesEditor.innerHTML = '<div class="no-selection">請選擇元件以進行編輯</div>';
					templateActionSection.style.display = 'none';
					return;
				}

				const node = findNodeByName(themeData.panels, selectedNodeName);
				if (!node) {
					selectedNodeName = null;
					propertiesEditor.innerHTML = '<div class="no-selection">請選擇元件以進行編輯</div>';
					templateActionSection.style.display = 'none';
					return;
				}

				templateActionSection.style.display = 'block';

				// Name field
				const nameRow = createPropRow('元件名稱 (ID)', 'text', node.name, (val) => {
					const safe = val.replace(/[^a-zA-Z0-9_-]/g, '') || node.name;
					node.name = safe;
					selectedNodeName = safe;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(nameRow);

				// Universal fields: width, height
				const widthRow = createPropRow('寬度 (width)', 'text', node.properties.width || '', (val) => {
					const num = Number(val);
					node.properties.width = isNaN(num) || val === '' ? val : num;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(widthRow);

				const heightRow = createPropRow('高度 (height)', 'text', node.properties.height || '', (val) => {
					const num = Number(val);
					node.properties.height = isNaN(num) || val === '' ? val : num;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(heightRow);

				// Background color
				const bgRow = createPropRow('背景顏色', 'text', node.properties.backgroundColor || '', (val) => {
					node.properties.backgroundColor = val || undefined;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(bgRow);

				// Padding
				const paddingRow = createPropRow('內距 (padding)', 'number', node.properties.padding || 0, (val) => {
					node.properties.padding = parseInt(val) || 0;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(paddingRow);

				// Margin
				const marginRow = createPropRow('外距 (margin)', 'number', node.properties.margin || 0, (val) => {
					node.properties.margin = parseInt(val) || 0;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(marginRow);

				// Border Radius
				const radiusRow = createPropRow('圓角 (radius)', 'number', node.properties.borderRadius || 0, (val) => {
					node.properties.borderRadius = parseInt(val) || 0;
					reRender();
					syncChanges();
				});
				propertiesEditor.appendChild(radiusRow);

				// Type-specific properties
				if (node.type === 'panel') {
					propertiesEditor.appendChild(createPropRow('X 座標 (left)', 'number', node.properties.left || 0, (val) => {
						node.properties.left = parseInt(val) || 0;
						reRender();
						syncChanges();
					}));
					propertiesEditor.appendChild(createPropRow('Y 座標 (top)', 'number', node.properties.top || 0, (val) => {
						node.properties.top = parseInt(val) || 0;
						reRender();
						syncChanges();
					}));
				} else if (node.type === 'stackPanel') {
					const orientGroup = document.createElement('div');
					orientGroup.className = 'prop-row';
					orientGroup.innerHTML = '<span class="prop-label">排列方向 (orientation)</span>' +
											'<select class="prop-select" id="prop-orient-select">' +
											'<option value="vertical"' + (node.properties.orientation === 'vertical' ? ' selected' : '') + '>Vertical (垂直)</option>' +
											'<option value="horizontal"' + (node.properties.orientation === 'horizontal' ? ' selected' : '') + '>Horizontal (水平)</option>' +
											'</select>';
					orientGroup.querySelector('#prop-orient-select').addEventListener('change', (e) => {
						node.properties.orientation = e.target.value;
						reRender();
						syncChanges();
					});
					propertiesEditor.appendChild(orientGroup);

					propertiesEditor.appendChild(createPropRow('間距 (gap)', 'number', node.properties.gap || 0, (val) => {
						node.properties.gap = parseInt(val) || 0;
						reRender();
						syncChanges();
					}));
				} else if (node.type === 'grid') {
					propertiesEditor.appendChild(createPropRow('行定義 (rows)', 'text', node.properties.rows || '1*', (val) => {
						node.properties.rows = val;
						reRender();
						syncChanges();
					}));
					propertiesEditor.appendChild(createPropRow('列定義 (columns)', 'text', node.properties.columns || '1*', (val) => {
						node.properties.columns = val;
						reRender();
						syncChanges();
					}));
				} else if (node.type === 'textBlock') {
					propertiesEditor.appendChild(createPropRow('文字內容 (text)', 'text', node.properties.text || '', (val) => {
						node.properties.text = val;
						reRender();
						syncChanges();
					}));
					propertiesEditor.appendChild(createPropRow('文字大小 (fontSize)', 'number', node.properties.fontSize || 14, (val) => {
						node.properties.fontSize = parseInt(val) || 12;
						reRender();
						syncChanges();
					}));
					propertiesEditor.appendChild(createPropRow('文字顏色 (color)', 'text', node.properties.color || '#ffffff', (val) => {
						node.properties.color = val;
						reRender();
						syncChanges();
					}));
				} else if (node.type === 'button') {
					propertiesEditor.appendChild(createPropRow('按鈕文字 (text)', 'text', node.properties.text || 'Button', (val) => {
						node.properties.text = val;
						reRender();
						syncChanges();
					}));
				} else if (node.type === 'image') {
					propertiesEditor.appendChild(createPropRow('圖片網址 (src)', 'text', node.properties.src || '', (val) => {
						node.properties.src = val;
						reRender();
						syncChanges();
					}));
				} else if (node.type === 'textField') {
					propertiesEditor.appendChild(createPropRow('提示文字 (placeholder)', 'text', node.properties.placeholder || '', (val) => {
						node.properties.placeholder = val;
						reRender();
						syncChanges();
					}));
				}

				// Parent-dependent layout properties (Grid Row/Column)
				const parent = findParentNode(themeData.panels, node.name);
				if (parent && parent.type === 'grid') {
					propertiesEditor.appendChild(createPropRow('Grid 行號 (grid.row)', 'number', node.properties['grid.row'] || 0, (val) => {
						node.properties['grid.row'] = Math.max(0, parseInt(val) || 0);
						reRender();
						syncChanges();
					}));
					propertiesEditor.appendChild(createPropRow('Grid 列號 (grid.column)', 'number', node.properties['grid.column'] || 0, (val) => {
						node.properties['grid.column'] = Math.max(0, parseInt(val) || 0);
						reRender();
						syncChanges();
					}));
				}
			}

			// Helper: Find parent component in tree
			function findParentNode(list, childName) {
				let parentNode = null;
				function recurse(arr, currentParent) {
					for (let i = 0; i < arr.length; i++) {
						if (arr[i].name === childName) {
							parentNode = currentParent;
							return;
						}
						if (arr[i].children) recurse(arr[i].children, arr[i]);
					}
				}
				recurse(list, null);
				return parentNode;
			}

			// Helper: Create property row input group
			function createPropRow(label, type, value, onChange) {
				const row = document.createElement('div');
				row.className = 'prop-row';
				
				const lbl = document.createElement('span');
				lbl.className = 'prop-label';
				lbl.textContent = label;
				row.appendChild(lbl);

				const input = document.createElement('input');
				input.type = type;
				input.className = 'prop-input';
				input.value = value;
				input.addEventListener('change', () => onChange(input.value));
				row.appendChild(input);

				return row;
			}

			// Serialize design tree back to DSL and post message to VS Code
			function syncChanges() {
				const dsl = [];
				dsl.push('#schema design ' + themeData.themeName);
				dsl.push('');
				
				// Serialize config block
				dsl.push('config {');
				for (const key of Object.keys(themeData.config)) {
					const val = themeData.config[key];
					const valStr = typeof val === 'string' ? '"' + val + '"' : val;
					dsl.push('    ' + key + ': ' + valStr);
				}
				dsl.push('}');
				dsl.push('');

				// Serialize templates
				if (themeData.templates && themeData.templates.length > 0) {
					themeData.templates.forEach(t => {
						dsl.push('template ' + t.name + ' {');
						serializeComponentNode(t.rootComponent, 1, dsl);
						dsl.push('}');
						dsl.push('');
					});
				}

				// Serialize panels
				themeData.panels.forEach(panel => {
					serializeComponentNode(panel, 0, dsl);
					dsl.push('');
				});

				vscode.postMessage({
					command: 'updateDocumentText',
					text: dsl.join('\\n')
				});
			}

			// Recursive serializer for UIComponent
			function serializeComponentNode(comp, indent, lines) {
				const spacing = '    '.repeat(indent);
				lines.push(spacing + comp.type + ' ' + comp.name + ' {');
				
				// Properties
				for (const key of Object.keys(comp.properties)) {
					const val = comp.properties[key];
					if (val === undefined || val === '') continue;
					const valStr = typeof val === 'string' ? '"' + val + '"' : val;
					lines.push(spacing + '    ' + key + ': ' + valStr);
				}
				
				// Children
				if (comp.children && comp.children.length > 0) {
					comp.children.forEach(child => {
						serializeComponentNode(child, indent + 1, lines);
					});
				}
				
				lines.push(spacing + '}');
			}

			// Notify extension we are ready to receive data
			vscode.postMessage({ command: 'ready' });
		`;

		page.addChild(new RawHtmlComponent(html));
		page.addInlineScript(js, nonce);
		return page;
	}
}
