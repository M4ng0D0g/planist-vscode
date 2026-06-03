export const FlowSchemaJS = `
﻿				<button class="btn" onclick="setMode('general')">銝?祆芋撘?/button>
				<button class="btn" onclick="setMode('callchain')">?澆??/button>
				<button class="btn" onclick="setMode('relation')">憿??</button>
				<button class="btn" id="scaleToggleBtn" onclick="toggleScaleMode()">???喳凝閫 (Micro)</button>
				<button class="btn" onclick="fitGraph()">?拇?閬?</button>
				<div class="badge" id="modeBadge">銝?祆芋撘?(撌刻?)</div>
			</div>
			<div id="cy"></div>
			<div id="tooltip"></div>

			<script nonce="\${nonce}">
				const vscode = acquireVsCodeApi();
				let cy = null;
				let currentMode = 'general';
				let currentScaleMode = 'macro';
				let rawGraphData = null;
				let appearance = null;
				vscode.postMessage({ command: 'ready' });

				function ensureCy() {
					if (cy) {
						return cy;
					}

					if (typeof cytoscape === 'undefined') {
						return null;
					}

					if (typeof cytoscapeDagre !== 'undefined') {
						cytoscape.use(cytoscapeDagre);
					}

					cy = cytoscape({
						container: document.getElementById('cy'),
						style: [
							{
								selector: 'node',
								style: {
									'background-color': 'data(fillColor)',
									'label': 'data(label)',
									'color': '#fff',
									'shape': 'round-rectangle',
									'border-width': 2,
									'border-color': 'data(borderColor)',
									'corner-radius': 'data(radius)'
								}
							},
							{
								selector: 'node:childless',
								style: {
									'width': '120px',
									'height': '40px',
									'text-valign': 'center',
									'text-halign': 'center',
									'font-size': '12px'
								}
							},
							{
								selector: 'node:parent',
								style: {
									'background-opacity': 0.15,
									'text-valign': 'top',
									'text-halign': 'center',
									'font-size': '14px',
									'font-weight': 'bold',
									'border-style': 'dashed',
									'padding': '15px'
								}
							},
							{
								selector: 'edge',
								style: {
									'width': 'data(width)',
									'line-color': '#555',
									'target-arrow-color': '#555',
									'target-arrow-shape': 'triangle',
									'curve-style': 'bezier',
									'arrow-scale': 1.2
								}
							},
							{
								selector: 'edge[label]',
								style: {
									'label': 'data(label)',
									'font-size': '10px',
									'color': '#aaa',
									'text-background-color': '#1a1a1a',
									'text-background-opacity': 0.8,
									'text-background-padding': '3px',
									'text-background-shape': 'round-rectangle'
								}
							}
						],
						layout: { name: 'dagre' }
					});

					cy.on('dblclick', 'node', function(evt) {
						const node = evt.target;
						const type = node.data('type');
						const entityName = node.id().replace('entity:', '');
						
						if (currentScaleMode === 'macro' && (type === 'package' || type === 'module')) {
							currentScaleMode = 'micro';
							const scaleBtn = document.getElementById('scaleToggleBtn');
							if (scaleBtn) {
								scaleBtn.textContent = '???喳楊閫 (Macro)';
							}
							renderByMode();
							
							const targetNode = cy.getElementById('entity:' + entityName);
							if (targetNode.length > 0) {
								cy.animate({
									center: { eles: targetNode },
									zoom: 1.2,
									duration: 500
								});
							}
							updateModeBadge();
						} else {
							vscode.postMessage({
								command: 'openEntityFile',
								entityName,
							});
						}
					});

					cy.on('mouseover', 'edge', function(evt) {
						const edge = evt.target;
						const details = edge.data('details');
						if (details) {
							const tooltip = document.getElementById('tooltip');
							tooltip.innerHTML = details.split('\\n').join('<br>');
							tooltip.style.display = 'block';
							
							const x = evt.originalEvent.clientX;
							const y = evt.originalEvent.clientY;
							tooltip.style.left = (x + 15) + 'px';
							tooltip.style.top = (y + 15) + 'px';
						}
					});

					cy.on('mouseout', 'edge', function(evt) {
						const tooltip = document.getElementById('tooltip');
						tooltip.style.display = 'none';
					});

					cy.on('pan zoom drag', function() {
						const tooltip = document.getElementById('tooltip');
						tooltip.style.display = 'none';
					});

					return cy;
				}

				function cycleMode() {
					const nextMode = currentMode === 'general' ? 'callchain' : currentMode === 'callchain' ? 'relation' : 'general';
					setMode(nextMode);
				}

				function setMode(mode) {
					vscode.postMessage({ command: 'setViewMode', mode });
				}

				function toggleScaleMode() {
					currentScaleMode = currentScaleMode === 'macro' ? 'micro' : 'macro';
					const btn = document.getElementById('scaleToggleBtn');
					if (btn) {
						btn.textContent = currentScaleMode === 'macro' ? '???喳凝閫 (Micro)' : '???喳楊閫 (Macro)';
					}
					renderByMode();
				}

				function fitGraph() {
					if (cy) {
						cy.fit();
					}
				}

				function refreshGraphVisuals() {
					if (!cy) {
						return;
					}

					cy.style().update();
				}

				function applyAppearance(nextAppearance) {
					appearance = nextAppearance;
					if (!appearance) {
						return;
					}

					document.body.style.backgroundColor = appearance.backgroundColor;
					if (appearance.backgroundPattern === 'dots') {
						document.body.style.backgroundImage = 'radial-gradient(circle, ' + appearance.dots.color + ' ' + appearance.dots.size + 'px, transparent ' + appearance.dots.size + 'px)';
						document.body.style.backgroundSize = appearance.dots.spacing + 'px ' + appearance.dots.spacing + 'px';
						document.body.style.backgroundRepeat = 'repeat';
					} else if (appearance.backgroundPattern === 'grid') {
						document.body.style.backgroundImage = [
							'repeating-linear-gradient(0deg, transparent 0, transparent ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + appearance.grid.minorSpacing + 'px)',
							'repeating-linear-gradient(90deg, transparent 0, transparent ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + Math.max(appearance.grid.minorSpacing - appearance.grid.minorLineWidth, 0) + 'px, ' + appearance.grid.minorColor + ' ' + appearance.grid.minorSpacing + 'px)',
							'repeating-linear-gradient(0deg, transparent 0, transparent ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + appearance.grid.majorSpacing + 'px)',
							'repeating-linear-gradient(90deg, transparent 0, transparent ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + Math.max(appearance.grid.majorSpacing - appearance.grid.majorLineWidth, 0) + 'px, ' + appearance.grid.majorColor + ' ' + appearance.grid.majorSpacing + 'px)'
						].join(', ');
						document.body.style.backgroundSize = 'auto';
						document.body.style.backgroundRepeat = 'repeat';
					} else {
						document.body.style.backgroundImage = 'none';
					}
				}

				function updateModeBadge() {
					const badge = document.getElementById('modeBadge');
					if (badge) {
						const modeText = currentMode === 'general' ? '銝?祆芋撘? : currentMode === 'callchain' ? '?澆?芋撘? : '憿??璅∪?';
						const scaleText = currentScaleMode === 'macro' ? '撌刻?' : '敺株?';
						badge.textContent = modeText + ' (' + scaleText + ')';
					}
				}

				function renderByMode() {
					if (!cy || !rawGraphData) {
						return;
					}

					const elements = currentMode === 'callchain'
						? transformToCallChainElements(rawGraphData)
						: currentMode === 'relation'
							? transformToRelationElements(rawGraphData)
							: transformToGeneralElements(rawGraphData);

					cy.elements().remove();
					cy.add(elements);
					applyLayout(currentMode);
					cy.fit();
					updateModeBadge();
				}

				function buildStyleLookup(data) {
					const lookup = new Map();
					for (const entity of data.entities) {
						lookup.set(entity.name, entity.renderStyle);
					}

					return lookup;
				}

				function getEntityRenderStyle(data, entityName) {
					const lookup = buildStyleLookup(data);
					return lookup.get(entityName) ?? { color: '#007acc', borderColor: '#005a9e', radius: 14 };
				}

				function applyLayout(mode) {
					const direction = mode === 'callchain' ? 'LR' : 'TB';
					cy.layout({
						name: 'dagre',
						nodeSep: 50,
						rankSep: 100,
						rankDir: direction,
					}).run();
				}

				function resolveEntity(data, name) {
					const entity = data.entities.find(e => e.name === name);
					if (currentScaleMode === 'macro' && entity && entity.parent) {
						const parentExists = data.entities.some(e => e.name === entity.parent);
						if (parentExists) {
							return {
								id: 'entity:' + entity.parent,
								name: entity.parent,
								isPackage: true
							};
						}
					}
					return {
						id: 'entity:' + name,
						name: name,
						isPackage: false
					};
				}

				function resolveNodeId(data, nodeId) {
					if (nodeId.indexOf('method:') === 0) {
						const parts = nodeId.substring(7).split('.');
						const className = parts[0];
						const resolved = resolveEntity(data, className);
						if (resolved.isPackage) {
							return resolved.id;
						}
						return nodeId;
					} else if (nodeId.indexOf('entity:') === 0) {
						const className = nodeId.substring(7);
						const resolved = resolveEntity(data, className);
						return resolved.id;
					}
					return nodeId;
				}

				function transformToGeneralElements(data) {
					const nodes = [];
					const nodeSet = new Set();

					const compoundGroups = new Map();
					for (const entity of data.entities) {
						if (entity.patternStyle && entity.patternStyle.compoundGroup) {
							const groupName = entity.patternStyle.compoundGroup;
							if (!compoundGroups.has(groupName)) {
								compoundGroups.set(groupName, {
									id: 'group:' + groupName,
									label: groupName,
									type: 'pattern_group'
								});
							}
						}
					}
					for (const group of compoundGroups.values()) {
						nodes.push({
							data: {
								id: group.id,
								label: group.label,
								type: group.type,
								fillColor: 'transparent',
								borderColor: '#888',
								radius: 8
							}
						});
						nodeSet.add(group.id);
					}
					
					for (const entity of data.entities) {
						const renderStyle = getEntityRenderStyle(data, entity.name);
						let nodeLabel = entity.display || entity.name;
						if (entity.patternStyle && entity.patternStyle.badge) {
							nodeLabel = '[' + entity.patternStyle.badge + ']\\n' + nodeLabel;
						}
						const borderColor = (entity.patternStyle && entity.patternStyle.badgeColor) ? entity.patternStyle.badgeColor : renderStyle.borderColor;
						
						if (currentScaleMode === 'macro') {
							if (entity.parent && data.entities.some(e => e.name === entity.parent)) {
								continue;
							}
							const id = 'entity:' + entity.name;
							const nodeData = {
								id: id,
								label: nodeLabel,
								entityName: entity.name,
								type: entity.kind || 'entity',
								fillColor: renderStyle.color,
								borderColor: borderColor,
								radius: renderStyle.radius
							};
							
							if (entity.patternStyle && entity.patternStyle.compoundGroup) {
								nodeData.parent = 'group:' + entity.patternStyle.compoundGroup;
							}
							
							nodes.push({ data: nodeData });
							nodeSet.add(id);
						} else {
							const id = 'entity:' + entity.name;
							const nodeData = {
								id: id,
								label: nodeLabel,
								entityName: entity.name,
								type: entity.kind || 'entity',
								fillColor: renderStyle.color,
								borderColor: borderColor,
								radius: renderStyle.radius
							};
							
							if (entity.parent && data.entities.some(e => e.name === entity.parent)) {
								nodeData.parent = 'entity:' + entity.parent;
							} else if (entity.patternStyle && entity.patternStyle.compoundGroup) {
								nodeData.parent = 'group:' + entity.patternStyle.compoundGroup;
							}
							
							nodes.push({ data: nodeData });
							nodeSet.add(id);
						}
					}
					
					const rawEdges = [];
					for (const entity of data.entities) {
						const rels = [
							{ list: entity.references, type: 'reference', verb: 'references' },
							{ list: entity.relationTargets, type: 'relation', verb: 'relations' },
							{ list: entity.extendsTargets, type: 'extends', verb: 'extends' },
							{ list: entity.implementsTargets, type: 'implements', verb: 'implements' },
							{ list: entity.inheritsTargets, type: 'inherits', verb: 'inherits' },
							{ list: entity.associatesTargets, type: 'associates', verb: 'associates' },
							{ list: entity.aggregatesTargets, type: 'aggregates', verb: 'aggregates' },
							{ list: entity.composesTargets, type: 'composes', verb: 'composes' },
							{ list: entity.dependsOnTargets, type: 'dependsOn', verb: 'dependsOn' }
						];
						
						for (const rel of rels) {
							if (rel.list) {
								for (const target of rel.list) {
									const targetName = typeof target === 'string' ? target : target.targetName;
									rawEdges.push({
										sourceName: entity.name,
										targetName: targetName,
										type: rel.type,
										verb: rel.verb
									});
								}
							}
						}
					}
					
					const edges = [];
					if (currentScaleMode === 'macro') {
						const groups = {};
						for (const edge of rawEdges) {
							const resolvedSource = resolveNodeId(data, 'entity:' + edge.sourceName);
							const resolvedTarget = resolveNodeId(data, 'entity:' + edge.targetName);
							
							if (resolvedSource === resolvedTarget) {
								continue;
							}
							
							if (!nodeSet.has(resolvedSource) || !nodeSet.has(resolvedTarget)) {
								continue;
							}
							
							const groupKey = resolvedSource + '->' + resolvedTarget;
							if (!groups[groupKey]) {
								groups[groupKey] = {
									source: resolvedSource,
									target: resolvedTarget,
									connections: []
								};
							}
							groups[groupKey].connections.push(edge);
						}
						
						for (const key in groups) {
							const group = groups[key];
							const count = group.connections.length;
							const detailLines = group.connections.map(c => c.sourceName + ' (' + c.verb + ') -> ' + c.targetName);
							const uniqueDetails = Array.from(new Set(detailLines)).join('\\n');
							
							edges.push({
								data: {
									id: 'agg-edge:' + group.source + ':' + group.target,
									source: group.source,
									target: group.target,
									label: count > 1 ? 'x' + count : '',
									width: Math.min(2 + count, 8),
									details: uniqueDetails
								}
							});
						}
					} else {
						for (const edge of rawEdges) {
							const srcId = 'entity:' + edge.sourceName;
							const tgtId = 'entity:' + edge.targetName;
							if (nodeSet.has(srcId) && nodeSet.has(tgtId)) {
								edges.push({
									data: {
										id: edge.type + ':' + edge.sourceName + ':' + edge.targetName,
										source: srcId,
										target: tgtId,
										relationType: edge.type,
										width: 2
									}
								});
							}
						}
					}
					
					return [...nodes, ...edges];
				}

				function transformToCallChainElements(data) {
					const nodes = [];
					const nodeSet = new Set();
					
					function ensurePackageNode(pkgName) {
						const id = 'entity:' + pkgName;
						if (nodeSet.has(id)) {
							return;
						}
						const renderStyle = getEntityRenderStyle(data, pkgName);
						const pkgEntity = data.entities.find(e => e.name === pkgName);
						nodes.push({
							data: {
								id: id,
								label: (pkgEntity && pkgEntity.display) || pkgName,
								entityName: pkgName,
								type: (pkgEntity && pkgEntity.kind) || 'package',
								fillColor: renderStyle.color,
								borderColor: renderStyle.borderColor,
								radius: renderStyle.radius
							}
						});
						nodeSet.add(id);
					}
					
					const rawCalls = [];
					for (const entity of data.entities) {
						for (const method of entity.methods) {
							const sourceId = 'method:' + entity.name + '.' + method.name;
							for (const call of method.callsTo) {
								const targetId = call.targetMethodName 
									? 'method:' + call.targetName + '.' + call.targetMethodName 
									: 'entity:' + call.targetName;
								rawCalls.push({
									sourceId: sourceId,
									sourceEntity: entity.name,
									sourceMethod: method.name,
									targetId: targetId,
									targetEntity: call.targetName,
									targetMethod: call.targetMethodName
								});
							}
						}
					}
					
					const allDefinedMethods = [];
					for (const entity of data.entities) {
						for (const method of entity.methods) {
							allDefinedMethods.push({
								id: 'method:' + entity.name + '.' + method.name,
								entityName: entity.name,
								methodName: method.name,
								parameters: method.parameters || []
							});
						}
					}
					
					if (currentScaleMode === 'macro') {
						for (const m of allDefinedMethods) {
							const resolved = resolveNodeId(data, m.id);
							if (resolved.indexOf('entity:') === 0) {
								const pkgName = resolved.substring(7);
								ensurePackageNode(pkgName);
							} else {
								const renderStyle = getEntityRenderStyle(data, m.entityName);
								nodes.push({
									data: {
										id: m.id,
										label: m.entityName + '.' + m.methodName + '(' + m.parameters.join(', ') + ')',
										entityName: m.entityName,
										methodName: m.methodName,
										type: 'method',
										fillColor: renderStyle.color,
										borderColor: renderStyle.borderColor,
										radius: renderStyle.radius
									}
								});
								nodeSet.add(m.id);
							}
						}
						
						for (const call of rawCalls) {
							const resolvedTgt = resolveNodeId(data, call.targetId);
							if (resolvedTgt.indexOf('entity:') === 0) {
								const pkgName = resolvedTgt.substring(7);
								const pkgEntity = data.entities.find(e => e.name === pkgName);
								if (pkgEntity && (pkgEntity.kind === 'package' || pkgEntity.kind === 'module')) {
									ensurePackageNode(pkgName);
								} else {
									if (!nodeSet.has(resolvedTgt)) {
										const renderStyle = getEntityRenderStyle(data, pkgName);
										nodes.push({
											data: {
												id: resolvedTgt,
												label: pkgName,
												entityName: pkgName,
												type: 'entity',
												fillColor: renderStyle.color,
												borderColor: renderStyle.borderColor,
												radius: renderStyle.radius
											}
										});
										nodeSet.add(resolvedTgt);
									}
								}
							} else {
								if (!nodeSet.has(resolvedTgt)) {
									const renderStyle = getEntityRenderStyle(data, call.targetEntity);
									nodes.push({
										data: {
											id: resolvedTgt,
											label: call.targetEntity + '.' + (call.targetMethod || '...') + '()',
											entityName: call.targetEntity,
											methodName: call.targetMethod,
											type: 'method',
											fillColor: renderStyle.color,
											borderColor: renderStyle.borderColor,
											radius: renderStyle.radius
										}
									});
									nodeSet.add(resolvedTgt);
								}
							}
						}
						
						const groups = {};
						const edges = [];
						for (const call of rawCalls) {
							const resolvedSrc = resolveNodeId(data, call.sourceId);
							const resolvedTgt = resolveNodeId(data, call.targetId);
							
							if (resolvedSrc === resolvedTgt) {
								continue;
							}
							
							if (!nodeSet.has(resolvedSrc) || !nodeSet.has(resolvedTgt)) {
								continue;
							}
							
							const groupKey = resolvedSrc + '->' + resolvedTgt;
							if (!groups[groupKey]) {
								groups[groupKey] = {
									source: resolvedSrc,
									target: resolvedTgt,
									connections: []
								};
							}
							groups[groupKey].connections.push(call);
						}
						
						for (const key in groups) {
							const group = groups[key];
							const count = group.connections.length;
							const detailLines = group.connections.map(c => {
								const srcLabel = c.sourceEntity + '.' + c.sourceMethod;
								const tgtLabel = c.targetMethod ? c.targetEntity + '.' + c.targetMethod : c.targetEntity;
								return srcLabel + ' -> ' + tgtLabel;
							});
							const uniqueDetails = Array.from(new Set(detailLines)).join('\\n');
							
							edges.push({
								data: {
									id: 'agg-call:' + group.source + ':' + group.target,
									source: group.source,
									target: group.target,
									label: count > 1 ? 'x' + count : '',
									width: Math.min(2 + count, 8),
									details: uniqueDetails
								}
							});
						}
						
						return [...nodes, ...edges];
					} else {
						for (const entity of data.entities) {
							if (entity.kind === 'package' || entity.kind === 'module') {
								ensurePackageNode(entity.name);
							}
						}
						
						for (const m of allDefinedMethods) {
							const renderStyle = getEntityRenderStyle(data, m.entityName);
							const nodeData = {
								id: m.id,
								label: m.entityName + '.' + m.methodName + '(' + m.parameters.join(', ') + ')',
								entityName: m.entityName,
								methodName: m.methodName,
								type: 'method',
								fillColor: renderStyle.color,
								borderColor: renderStyle.borderColor,
								radius: renderStyle.radius
							};
							
							const entityDef = data.entities.find(e => e.name === m.entityName);
							if (entityDef && entityDef.parent && data.entities.some(e => e.name === entityDef.parent)) {
								nodeData.parent = 'entity:' + entityDef.parent;
								ensurePackageNode(entityDef.parent);
							}
							
							nodes.push({ data: nodeData });
							nodeSet.add(m.id);
						}
						
						for (const call of rawCalls) {
							if (!nodeSet.has(call.targetId)) {
								const renderStyle = getEntityRenderStyle(data, call.targetEntity);
								const nodeData = {
									id: call.targetId,
									label: call.targetMethod ? call.targetEntity + '.' + call.targetMethod + '(...)' : call.targetEntity,
									entityName: call.targetEntity,
									methodName: call.targetMethod,
									type: call.targetMethod ? 'method' : 'entity',
									fillColor: renderStyle.color,
									borderColor: renderStyle.borderColor,
									radius: renderStyle.radius
								};
								
								const entityDef = data.entities.find(e => e.name === call.targetEntity);
								if (entityDef && entityDef.parent && data.entities.some(e => e.name === entityDef.parent)) {
									nodeData.parent = 'entity:' + entityDef.parent;
									ensurePackageNode(entityDef.parent);
								}
								
								nodes.push({ data: nodeData });
								nodeSet.add(call.targetId);
							}
						}
						
						const edges = [];
						for (const call of rawCalls) {
							if (nodeSet.has(call.sourceId) && nodeSet.has(call.targetId)) {
								edges.push({
									data: {
										id: 'call:' + call.sourceId + ':' + call.targetId,
										source: call.sourceId,
										target: call.targetId,
										relationType: 'call',
										width: 2
									}
								});
							}
						}
						
						return [...nodes, ...edges];
					}
				}

				function transformToRelationElements(data) {
					const nodes = [];
					const nodeSet = new Set();
					
					for (const entity of data.entities) {
						const renderStyle = getEntityRenderStyle(data, entity.name);
						
						if (currentScaleMode === 'macro') {
							if (entity.parent && data.entities.some(e => e.name === entity.parent)) {
								continue;
							}
							const id = 'entity:' + entity.name;
							nodes.push({
								data: {
									id: id,
									label: entity.display || entity.name,
									entityName: entity.name,
									type: entity.kind || 'entity',
									fillColor: renderStyle.color,
									borderColor: renderStyle.borderColor,
									radius: renderStyle.radius
								}
							});
							nodeSet.add(id);
						} else {
							const id = 'entity:' + entity.name;
							const nodeData = {
								id: id,
								label: entity.display || entity.name,
								entityName: entity.name,
								type: entity.kind || 'entity',
								fillColor: renderStyle.color,
								borderColor: renderStyle.borderColor,
								radius: renderStyle.radius
							};
							
							if (entity.parent && data.entities.some(e => e.name === entity.parent)) {
								nodeData.parent = 'entity:' + entity.parent;
							}
							
							nodes.push({ data: nodeData });
							nodeSet.add(id);
						}
					}
					
					const rawEdges = [];
					for (const entity of data.entities) {
						const rels = [
							{ list: entity.relationTargets, type: 'relation', verb: 'relations' },
							{ list: entity.extendsTargets, type: 'extends', verb: 'extends' },
							{ list: entity.implementsTargets, type: 'implements', verb: 'implements' },
							{ list: entity.inheritsTargets, type: 'inherits', verb: 'inherits' },
							{ list: entity.associatesTargets, type: 'associates', verb: 'associates' },
							{ list: entity.aggregatesTargets, type: 'aggregates', verb: 'aggregates' },
							{ list: entity.composesTargets, type: 'composes', verb: 'composes' },
							{ list: entity.dependsOnTargets, type: 'dependsOn', verb: 'dependsOn' }
						];
						
						for (const rel of rels) {
							if (rel.list) {
								for (const target of rel.list) {
									const targetName = typeof target === 'string' ? target : target.targetName;
									rawEdges.push({
										sourceName: entity.name,
										targetName: targetName,
										type: rel.type,
										verb: rel.verb
									});
								}
							}
						}
					}
					
					const edges = [];
					if (currentScaleMode === 'macro') {
						const groups = {};
						for (const edge of rawEdges) {
							const resolvedSource = resolveNodeId(data, 'entity:' + edge.sourceName);
							const resolvedTarget = resolveNodeId(data, 'entity:' + edge.targetName);
							
							if (resolvedSource === resolvedTarget) {
								continue;
							}
							
							if (!nodeSet.has(resolvedSource) || !nodeSet.has(resolvedTarget)) {
								continue;
							}
							
							const groupKey = resolvedSource + '->' + resolvedTarget;
							if (!groups[groupKey]) {
								groups[groupKey] = {
									source: resolvedSource,
									target: resolvedTarget,
									connections: []
								};
							}
							groups[groupKey].connections.push(edge);
						}
						
						for (const key in groups) {
							const group = groups[key];
							const count = group.connections.length;
							const detailLines = group.connections.map(c => c.sourceName + ' (' + c.verb + ') -> ' + c.targetName);
							const uniqueDetails = Array.from(new Set(detailLines)).join('\\n');
							
							edges.push({
								data: {
									id: 'agg-edge:' + group.source + ':' + group.target,
									source: group.source,
									target: group.target,
									label: count > 1 ? 'x' + count : '',
									width: Math.min(2 + count, 8),
									details: uniqueDetails
								}
							});
						}
					} else {
						for (const edge of rawEdges) {
							const srcId = 'entity:' + edge.sourceName;
							const tgtId = 'entity:' + edge.targetName;
							if (nodeSet.has(srcId) && nodeSet.has(tgtId)) {
								edges.push({
									data: {
										id: edge.type + ':' + edge.sourceName + ':' + edge.targetName,
										source: srcId,
										target: tgtId,
										relationType: edge.type,
										width: 2
									}
								});
							}
						}
					}
					
					return [...nodes, ...edges];
				}

				window.addEventListener('message', event => {
					const message = event.data;
					if (message.command !== 'updateGraph') {
						return;
					}

					const graph = ensureCy();
					if (!graph) {
						return;
					}

					applyAppearance(message.appearance);
					rawGraphData = message.data;
					if (message.mode) {
						currentMode = message.mode;
					}
					renderByMode();
					refreshGraphVisuals();
				});
			</script>
		</body>
		</html>
	\`;
}

function getNonce(): string {
	return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');

`;