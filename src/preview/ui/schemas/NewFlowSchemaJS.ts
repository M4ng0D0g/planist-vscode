// @state: green
export const NewFlowSchemaJS = `
(function() {
    console.log('====== Planist New Infinite Board Core Activated ======');
    const vscode = acquireVsCodeApi();

    // Board state
    let panX = 0;
    let panY = 0;
    let zoom = 1.0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    const minZoom = 0.15;
    const maxZoom = 4.0;
    const baseGridSize = 60; // Major grid spacing
    const subLineCount = 4;   // Subdivisions (5 grid squares)

    // Node layout positions cache
    let nodePositions = {};
    let activeEntities = [];
    let configuredConnections = [];
    let selectedEntityName = null;
    let connectionFrameId = null;
    let lastSelectedKind = 'class';
    let contextMenuX = 0;
    let contextMenuY = 0;

    // Advanced selection and clipboard variables
    let selectedEntities = []; // Array of selected entity names
    let clipboardEntities = []; // Array of copied entity data objects
    let mouseX = 0; // Current cursor X in workspace coords
    let mouseY = 0; // Current cursor Y in workspace coords
    let isBoxSelecting = false;
    let boxSelectStartX = 0;
    let boxSelectStartY = 0;

    // DOM Elements
    let viewport = null;
    let workspace = null;
    let gridBg = null;
    let zoomDisplay = null;
    let tooltipEl = null;

    function triggerRenderConnections() {
        if (connectionFrameId) return;
        connectionFrameId = requestAnimationFrame(() => {
            renderConnections();
            connectionFrameId = null;
        });
    }

    // @state: green
    function formatAccessModifier(access) {
        if (!access) return '';
        const trimmed = access.trim().toLowerCase();
        if (trimmed === 'public' || trimmed === '+') return '+';
        if (trimmed === 'protected' || trimmed === '#') return '#';
        if (trimmed === 'private' || trimmed === '-') return '-';
        return '';
    }

    // @state: green
    function init() {
        viewport = document.getElementById('viewport');
        workspace = document.getElementById('workspace');
        gridBg = document.getElementById('grid-bg');
        zoomDisplay = document.getElementById('zoom-display');
        tooltipEl = document.getElementById('tooltip');

        if (!viewport || !workspace || !gridBg) {
            console.error('Core elements missing from DOM');
            return;
        }

        // Register event listeners
        viewport.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        viewport.addEventListener('contextmenu', handleContextMenu);
        viewport.addEventListener('wheel', () => hideContextMenu(), { passive: true });
        viewport.addEventListener('mousedown', () => hideContextMenu());

        // HUD Controls
        document.getElementById('zoom-in-btn')?.addEventListener('click', () => adjustZoom(1.2));
        document.getElementById('zoom-out-btn')?.addEventListener('click', () => adjustZoom(1 / 1.2));
        document.getElementById('zoom-reset-btn')?.addEventListener('click', resetView);
        document.getElementById('backBtn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'exitCallChain' });
        });
        document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'toggleFullscreen' });
        });

        // [修正註解] 透過監聽自訂 DOM 事件，讓 decoupled 的 Settings 面板能與後端通訊，
        // 避免 Settings 腳本需要重複 acquireVsCodeApi() 或引用未宣告的 vscode 導致 ReferenceError。
        document.addEventListener('planist-update-entity', (e) => {
            if (e.detail && e.detail.data && e.detail.data.kind) {
                lastSelectedKind = e.detail.data.kind;
            }
            vscode.postMessage({
                command: 'updateEntity',
                originalName: e.detail.originalName,
                data: e.detail.data
            });
        });

        document.addEventListener('planist-update-entity-color', (e) => {
            vscode.postMessage({
                command: 'updateEntityColor',
                entityName: e.detail.entityName,
                color: e.detail.color
            });
        });

        document.addEventListener('planist-update-entity-position', (e) => {
            vscode.postMessage({
                command: 'updateEntityPosition',
                entityName: e.detail.entityName,
                position: e.detail.position
            });
        });

        document.addEventListener('planist-update-connection', (e) => {
            vscode.postMessage({
                command: 'updateConnection',
                connection: e.detail
            });
        });

        document.addEventListener('planist-update-multiple-connections', (e) => {
            vscode.postMessage({
                command: 'updateMultipleConnections',
                connections: e.detail.connections
            });
        });

        document.addEventListener('planist-node-selected', (e) => {
            if (e.detail && e.detail.entity && e.detail.entity.kind) {
                lastSelectedKind = e.detail.entity.kind;
            }
        });

        document.getElementById('ctx-create-node')?.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            vscode.postMessage({
                command: 'createEntityPrompt',
                x: contextMenuX,
                y: contextMenuY,
                lastSelectedKind: lastSelectedKind
            });
        });

        window.addEventListener('mousedown', (e) => {
            const menu = document.getElementById('canvas-context-menu');
            if (menu && !menu.contains(e.target)) {
                hideContextMenu();
            }
        });

        // Unified keybindings listener
        window.addEventListener('keydown', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            if (isInput) return; // Skip if typing in inputs

            const key = e.key.toLowerCase();
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && key === 'l') {
                e.preventDefault();
                triggerResetConnectionLayoutForSelected();
            } else if (isCtrl && key === 'c') {
                // Ctrl+C: Copy selected entities
                e.preventDefault();
                if (selectedEntities.length > 0) {
                    clipboardEntities = selectedEntities.map(name => {
                        const ent = activeEntities.find(entObj => entObj.name === name);
                        return ent ? JSON.parse(JSON.stringify(ent)) : null;
                    }).filter(Boolean);
                }
            } else if (isCtrl && key === 'x') {
                // Ctrl+X: Cut selected entities
                e.preventDefault();
                if (selectedEntities.length > 0) {
                    clipboardEntities = selectedEntities.map(name => {
                        const ent = activeEntities.find(entObj => entObj.name === name);
                        return ent ? JSON.parse(JSON.stringify(ent)) : null;
                    }).filter(Boolean);
                    selectedEntities.forEach(name => {
                        vscode.postMessage({ command: 'deleteEntity', entityName: name });
                    });
                    selectedEntities = [];
                    selectedEntityName = null;
                    document.dispatchEvent(new CustomEvent('planist-node-deselected'));
                }
            } else if (isCtrl && key === 'v') {
                // Ctrl+V: Paste copied entities near mouse pointer
                e.preventDefault();
                if (clipboardEntities.length > 0) {
                    let sumX = 0, sumY = 0, count = 0;
                    clipboardEntities.forEach(ent => {
                        const pos = nodePositions[ent.name];
                        if (pos) {
                            sumX += pos.x;
                            sumY += pos.y;
                            count++;
                        }
                    });
                    const midX = count > 0 ? sumX / count : mouseX;
                    const midY = count > 0 ? sumY / count : mouseY;
                    const dx = mouseX - midX;
                    const dy = mouseY - midY;

                    clipboardEntities.forEach(copied => {
                        const pos = nodePositions[copied.name] || { x: mouseX, y: mouseY };
                        const targetX = pos.x + dx;
                        const targetY = pos.y + dy;

                        let baseName = 'CopyOf' + copied.name;
                        let counter = 1;
                        let newName = baseName;
                        while (activeEntities.some(ent => ent.name === newName)) {
                            newName = baseName + '_' + counter;
                            counter++;
                        }

                        vscode.postMessage({
                            command: 'pasteEntity',
                            entityName: newName,
                            entityData: copied,
                            position: { x: targetX, y: targetY }
                        });
                    });
                }
            } else if (isCtrl && key === 'a') {
                // Ctrl+A: Select all entities
                e.preventDefault();
                selectedEntities = activeEntities.map(ent => ent.name);
                workspace.querySelectorAll('.board-node').forEach(card => card.classList.add('selected'));
                if (selectedEntities.length > 0) {
                    selectedEntityName = selectedEntities[selectedEntities.length - 1];
                    const lastSelectedEntity = activeEntities.find(ent => ent.name === selectedEntityName);
                    if (lastSelectedEntity) {
                        document.dispatchEvent(new CustomEvent('planist-node-selected', {
                            detail: {
                                entity: lastSelectedEntity,
                                allEntities: activeEntities
                            }
                        }));
                    }
                }
            } else if (isCtrl && key === 'z') {
                // Ctrl+Z: Forward undo command to backend editor
                e.preventDefault();
                vscode.postMessage({ command: 'undo' });
            }
        });

        // Set initial state
        updateTransform();
        
        // Notify VS Code that webview is ready
        vscode.postMessage({ command: 'ready' });
    }

    // @state: green
    function handleContextMenu(e) {
        if (e.target === viewport || e.target === gridBg || e.target.id === 'workspace') {
            e.preventDefault();
            e.stopPropagation();

            const clientX = e.clientX;
            const clientY = e.clientY;

            // Convert click position to canvas coordinates
            contextMenuX = (clientX - panX) / zoom;
            contextMenuY = (clientY - panY) / zoom;

            const menu = document.getElementById('canvas-context-menu');
            if (menu) {
                menu.style.left = clientX + 'px';
                menu.style.top = clientY + 'px';
                menu.classList.add('open');
            }
        } else {
            hideContextMenu();
        }
    }

    // @state: green
    function hideContextMenu() {
        const menu = document.getElementById('canvas-context-menu');
        if (menu) {
            menu.classList.remove('open');
        }
    }

    // @state: green
    function updateTransform() {
        // Apply transform to workspace
        workspace.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';

        // Update infinite background grid
        if (gridBg) {
            const majorSize = baseGridSize * zoom;
            const minorSize = (baseGridSize / (subLineCount + 1)) * zoom;

            // Background sizes for major & minor grid lines
            gridBg.style.backgroundSize = 
                majorSize + 'px ' + majorSize + 'px, ' +
                majorSize + 'px ' + majorSize + 'px, ' +
                minorSize + 'px ' + minorSize + 'px, ' +
                minorSize + 'px ' + minorSize + 'px';

            // Background positions matching current pan offset
            gridBg.style.backgroundPosition = 
                panX + 'px ' + panY + 'px, ' +
                panX + 'px ' + panY + 'px, ' +
                panX + 'px ' + panY + 'px, ' +
                panX + 'px ' + panY + 'px';
        }

        // Update HUD Zoom Display
        if (zoomDisplay) {
            zoomDisplay.textContent = Math.round(zoom * 100) + '%';
        }
    }

    // @state: green
    function handleMouseDown(e) {
        // Track global click to update coordinates
        mouseX = (e.clientX - panX) / zoom;
        mouseY = (e.clientY - panY) / zoom;

        // Prevent default only if clicking directly on viewport or grid background
        if (e.target === viewport || e.target === gridBg || e.target.id === 'workspace') {
            if (e.ctrlKey || e.metaKey) {
                // Start Range Box Selection
                isBoxSelecting = true;
                boxSelectStartX = (e.clientX - panX) / zoom;
                boxSelectStartY = (e.clientY - panY) / zoom;
                const box = document.getElementById('selection-box');
                if (box) {
                    box.style.left = e.clientX + 'px';
                    box.style.top = e.clientY + 'px';
                    box.style.width = '0px';
                    box.style.height = '0px';
                    box.style.display = 'block';
                }
                e.preventDefault();
            } else {
                // Click canvas background without Ctrl clears selection
                document.querySelectorAll('.board-node').forEach(n => n.classList.remove('selected'));
                selectedEntities = [];
                selectedEntityName = null;
                document.dispatchEvent(new CustomEvent('planist-node-deselected'));

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startPanX = panX;
                startPanY = panY;
                viewport.style.cursor = 'grabbing';
                e.preventDefault();
            }
        }
    }

    // @state: green
    function handleMouseMove(e) {
        mouseX = (e.clientX - panX) / zoom;
        mouseY = (e.clientY - panY) / zoom;

        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panX = startPanX + dx;
            panY = startPanY + dy;
            updateTransform();
        } else if (isBoxSelecting) {
            const curX = (e.clientX - panX) / zoom;
            const curY = (e.clientY - panY) / zoom;

            const x1 = Math.min(boxSelectStartX, curX);
            const y1 = Math.min(boxSelectStartY, curY);
            const x2 = Math.max(boxSelectStartX, curX);
            const y2 = Math.max(boxSelectStartY, curY);

            // Update range selection box coordinates
            const clientX1 = x1 * zoom + panX;
            const clientY1 = y1 * zoom + panY;
            const clientW = (x2 - x1) * zoom;
            const clientH = (y2 - y1) * zoom;

            const box = document.getElementById('selection-box');
            if (box) {
                box.style.left = clientX1 + 'px';
                box.style.top = clientY1 + 'px';
                box.style.width = clientW + 'px';
                box.style.height = clientH + 'px';
            }

            // Hit testing with board node cards
            const cards = workspace.querySelectorAll('.board-node');
            cards.forEach(card => {
                const titleEl = card.querySelector('.node-title');
                if (!titleEl) return;
                const name = titleEl.textContent.trim();
                const pos = nodePositions[name];
                if (!pos) return;
                const w = card.offsetWidth || 240;
                const h = card.offsetHeight || 150;

                const nodeX1 = pos.x;
                const nodeY1 = pos.y;
                const nodeX2 = pos.x + w;
                const nodeY2 = pos.y + h;

                const intersect = !(nodeX1 > x2 || nodeX2 < x1 || nodeY1 > y2 || nodeY2 < y1);
                if (intersect) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            });
        }
    }

    // @state: green
    function handleMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            if (viewport) {
                viewport.style.cursor = 'grab';
            }
        } else if (isBoxSelecting) {
            isBoxSelecting = false;
            const box = document.getElementById('selection-box');
            if (box) {
                box.style.display = 'none';
            }

            // Save box selection results
            selectedEntities = [];
            const cards = workspace.querySelectorAll('.board-node');
            cards.forEach(card => {
                if (card.classList.contains('selected')) {
                    const titleEl = card.querySelector('.node-title');
                    if (titleEl) {
                        selectedEntities.push(titleEl.textContent.trim());
                    }
                }
            });

            if (selectedEntities.length > 0) {
                selectedEntityName = selectedEntities[selectedEntities.length - 1];
                const lastSelectedEntity = activeEntities.find(ent => ent.name === selectedEntityName);
                if (lastSelectedEntity) {
                    document.dispatchEvent(new CustomEvent('planist-node-selected', {
                        detail: {
                            entity: lastSelectedEntity,
                            allEntities: activeEntities
                        }
                    }));
                }
            } else {
                selectedEntityName = null;
                document.dispatchEvent(new CustomEvent('planist-node-deselected'));
            }
        }
    }

    // @state: green
    function handleWheel(e) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Exponential zoom factor
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const nextZoom = Math.min(maxZoom, Math.max(minZoom, zoom * zoomFactor));

        // Center zoom on mouse coordinates
        const wx = (mx - panX) / zoom;
        const wy = (my - panY) / zoom;

        zoom = nextZoom;
        panX = mx - wx * zoom;
        panY = my - wy * zoom;

        updateTransform();
    }

    // @state: green
    function adjustZoom(factor) {
        const rect = viewport.getBoundingClientRect();
        const mx = rect.width / 2;
        const my = rect.height / 2;

        const nextZoom = Math.min(maxZoom, Math.max(minZoom, zoom * factor));
        const wx = (mx - panX) / zoom;
        const wy = (my - panY) / zoom;

        zoom = nextZoom;
        panX = mx - wx * zoom;
        panY = my - wy * zoom;

        updateTransform();
    }

    // @state: green
    function resetView() {
        // Smoothly transition back to center
        let duration = 250;
        let start = null;
        const fromPanX = panX;
        const fromPanY = panY;
        const fromZoom = zoom;

        // @state: green
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1.0);
            
            // Easing function (easeOutCubic)
            const ease = 1 - Math.pow(1 - progress, 3);

            panX = fromPanX + (0 - fromPanX) * ease;
            panY = fromPanY + (0 - fromPanY) * ease;
            zoom = fromZoom + (1.0 - fromZoom) * ease;

            updateTransform();

            if (progress < 1.0) {
                requestAnimationFrame(animate);
            }
        }
        requestAnimationFrame(animate);
    }

    // @state: green
    function showTooltip(evt, title, comments) {
        if (!tooltipEl) {
            tooltipEl = document.getElementById('tooltip');
        }
        if (!tooltipEl || !comments || comments.length === 0) return;

        let html = '<div class="tooltip-title">' + title + '</div>';
        html += '<div class="tooltip-comment">' + comments.join('\\n') + '</div>';
        tooltipEl.innerHTML = html;
        tooltipEl.style.display = 'block';
        positionTooltip(evt);
    }

    // @state: green
    function positionTooltip(evt) {
        if (!tooltipEl) return;
        const padding = 10;
        let x = evt.clientX + padding;
        let y = evt.clientY + padding;

        const rect = tooltipEl.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) {
            x = evt.clientX - rect.width - padding;
        }
        if (y + rect.height > window.innerHeight) {
            y = evt.clientY - rect.height - padding;
        }

        tooltipEl.style.left = x + 'px';
        tooltipEl.style.top = y + 'px';
    }

    // @state: green
    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.style.display = 'none';
        }
    }

    function isVerticalSegmentSafe(x, y1, y2, excludeNodes, nodes) {
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        for (const n of nodes) {
            if (excludeNodes.includes(n.name)) continue;
            const shrink = 2.0;
            if (x > n.left + shrink && x < n.right - shrink) {
                if (maxY > n.top + shrink && minY < n.bottom - shrink) {
                    return false;
                }
            }
        }
        return true;
    }

    function isHorizontalSegmentSafe(y, x1, x2, excludeNodes, nodes) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        for (const n of nodes) {
            if (excludeNodes.includes(n.name)) continue;
            const shrink = 2.0;
            if (y > n.top + shrink && y < n.bottom - shrink) {
                if (maxX > n.left + shrink && minX < n.right - shrink) {
                    return false;
                }
            }
        }
        return true;
    }

    function findSafeMidX(sX, minTargetX, minY, maxY, excludeNodes, nodes) {
        const candidateX = sX + (minTargetX - sX) / 2;
        if (isVerticalSegmentSafe(candidateX, minY, maxY, excludeNodes, nodes)) {
            return candidateX;
        }
        const x1 = sX + 20;
        if (x1 < minTargetX && isVerticalSegmentSafe(x1, minY, maxY, excludeNodes, nodes)) {
            return x1;
        }
        const x2 = minTargetX - 20;
        if (x2 > sX && isVerticalSegmentSafe(x2, minY, maxY, excludeNodes, nodes)) {
            return x2;
        }
        return candidateX;
    }

    function findSafeMidY(sY, minTargetY, minX, maxX, excludeNodes, nodes) {
        const candidateY = sY + (minTargetY - sY) / 2;
        if (isHorizontalSegmentSafe(candidateY, minX, maxX, excludeNodes, nodes)) {
            return candidateY;
        }
        const y1 = sY + 20;
        if (y1 < minTargetY && isHorizontalSegmentSafe(y1, minX, maxX, excludeNodes, nodes)) {
            return y1;
        }
        const y2 = minTargetY - 20;
        if (y2 > sY && isHorizontalSegmentSafe(y2, minX, maxX, excludeNodes, nodes)) {
            return y2;
        }
        return candidateY;
    }

    // @state: green
    function renderConnections() {
        if (!workspace) return;
        
        let svg = document.getElementById('connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'connections-svg';
            workspace.insertBefore(svg, workspace.firstChild);
        }
        
        // Remove existing paths and handles
        const paths = svg.querySelectorAll('path:not([id]):not(defs path)');
        paths.forEach(p => p.remove());
        const handles = svg.querySelectorAll('.connection-handle');
        handles.forEach(h => h.remove());
        
        // Ensure defs exists
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
             defs.innerHTML = \`
                <marker id="arrow-hollow-triangle" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 Z" fill="var(--bg-color)" stroke="var(--connection-color)" stroke-width="1.5"/>
                </marker>
                <marker id="arrow-vee" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9" fill="none" stroke="var(--connection-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </marker>
                <marker id="arrow-hollow-diamond" viewBox="0 0 12 10" refX="12" refY="5" markerWidth="10" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 5 L 6 1 L 12 5 L 6 9 Z" fill="var(--bg-color)" stroke="var(--connection-color)" stroke-width="1.5"/>
                </marker>
                <marker id="arrow-filled-diamond" viewBox="0 0 12 10" refX="12" refY="5" markerWidth="10" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 5 L 6 1 L 12 5 L 6 9 Z" fill="var(--connection-color)" stroke="var(--connection-color)" stroke-width="1.5"/>
                </marker>
             \`;
            svg.appendChild(defs);
        }

        // 1. Collect all node boxes with their dimensions
        const nodes = [];
        const cardElements = workspace.querySelectorAll('.board-node');
        
        activeEntities.forEach(entity => {
            const pos = nodePositions[entity.name];
            if (!pos) return;
            
            let width = 240;
            let height = 150;
            for (let i = 0; i < cardElements.length; i++) {
                const titleEl = cardElements[i].querySelector('.node-title');
                if (titleEl && titleEl.textContent === entity.name) {
                    width = cardElements[i].offsetWidth || 240;
                    height = cardElements[i].offsetHeight || 150;
                    break;
                }
            }
            
            nodes.push({
                name: entity.name,
                left: pos.x,
                top: pos.y,
                right: pos.x + width,
                bottom: pos.y + height,
                midX: pos.x + width / 2,
                midY: pos.y + height / 2,
                w: width,
                h: height
            });
        });

        // 2. Build list of all relations
        const relationTypes = [
            { key: 'extendsTargets', type: 'extends' },
            { key: 'inheritsTargets', type: 'inherits' },
            { key: 'implementsTargets', type: 'implements' },
            { key: 'associatesTargets', type: 'associates' },
            { key: 'aggregatesTargets', type: 'aggregates' },
            { key: 'composesTargets', type: 'composes' },
            { key: 'dependsOnTargets', type: 'dependsOn' }
        ];

        const connections = [];
        activeEntities.forEach(entity => {
            relationTypes.forEach(rel => {
                const targets = entity[rel.key] || [];
                targets.forEach(targetName => {
                    if (nodePositions[targetName]) {
                        const match = configuredConnections.find(c => c.from === entity.name && c.to === targetName && c.relationType === rel.type);
                        connections.push({
                            from: entity.name,
                            to: targetName,
                            relationType: rel.type,
                            direction: match ? match.direction : null,
                            midX: match ? match.midX : null,
                            midY: match ? match.midY : null
                        });
                    }
                });
            });
        });



        // Group connections by source node and classified direction
        const groups = {};
        connections.forEach(conn => {
            const fromNode = nodes.find(n => n.name === conn.from);
            const toNode = nodes.find(n => n.name === conn.to);
            if (!fromNode || !toNode) return;

            let dir = conn.direction;
            if (!dir) {
                const dx = toNode.midX - fromNode.midX;
                const dy = toNode.midY - fromNode.midY;
                if (Math.abs(dx) >= Math.abs(dy)) {
                    dir = dx > 0 ? 'East' : 'West';
                } else {
                    dir = dy > 0 ? 'South' : 'North';
                }
            }

            const groupKey = conn.from + '->' + dir;
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    fromNode,
                    direction: dir,
                    conns: []
                };
            }
            groups[groupKey].conns.push({ conn, toNode });
        });

        // Route each group
        Object.keys(groups).forEach(key => {
            const group = groups[key];
            const fromNode = group.fromNode;
            const dir = group.direction;
            const conns = group.conns;

            const excludeNodeNames = [fromNode.name];
            conns.forEach(c => excludeNodeNames.push(c.toNode.name));

            if (dir === 'East') {
                const sPort = { x: fromNode.right, y: fromNode.midY };
                const targets = conns.map(c => {
                    return {
                        tPort: { x: c.toNode.left, y: c.toNode.midY },
                        conn: c.conn
                    };
                });

                const minTargetLeft = Math.min(...conns.map(c => c.toNode.left));
                const targetLimitX = Math.max(minTargetLeft, sPort.x + 30);
                const minY = Math.min(sPort.y, ...targets.map(t => t.tPort.y));
                const maxY = Math.max(sPort.y, ...targets.map(t => t.tPort.y));

                targets.forEach(t => {
                    let finalMidX = t.conn.midX;
                    if (finalMidX === undefined || finalMidX === null) {
                        finalMidX = findSafeMidX(sPort.x, targetLimitX, minY, maxY, excludeNodeNames, nodes);
                    }
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + finalMidX + ' ' + sPort.y +
                                  ' L ' + finalMidX + ' ' + t.tPort.y +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn, dir, sPort, t.tPort, finalMidX, null);
                });

            } else if (dir === 'West') {
                const sPort = { x: fromNode.left, y: fromNode.midY };
                const targets = conns.map(c => {
                    return {
                        tPort: { x: c.toNode.right, y: c.toNode.midY },
                        conn: c.conn
                    };
                });

                const maxTargetRight = Math.max(...conns.map(c => c.toNode.right));
                const targetLimitX = Math.min(maxTargetRight, sPort.x - 30);
                const minY = Math.min(sPort.y, ...targets.map(t => t.tPort.y));
                const maxY = Math.max(sPort.y, ...targets.map(t => t.tPort.y));

                targets.forEach(t => {
                    let finalMidX = t.conn.midX;
                    if (finalMidX === undefined || finalMidX === null) {
                        finalMidX = findSafeMidX(targetLimitX, sPort.x, minY, maxY, excludeNodeNames, nodes);
                    }
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + finalMidX + ' ' + sPort.y +
                                  ' L ' + finalMidX + ' ' + t.tPort.y +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn, dir, sPort, t.tPort, finalMidX, null);
                });

            } else if (dir === 'South') {
                const sPort = { x: fromNode.midX, y: fromNode.bottom };
                const targets = conns.map(c => {
                    return {
                        tPort: { x: c.toNode.midX, y: c.toNode.top },
                        conn: c.conn
                    };
                });

                const minTargetTop = Math.min(...conns.map(c => c.toNode.top));
                const targetLimitY = Math.max(minTargetTop, sPort.y + 30);
                const minX = Math.min(sPort.x, ...targets.map(t => t.tPort.x));
                const maxX = Math.max(sPort.x, ...targets.map(t => t.tPort.x));

                targets.forEach(t => {
                    let finalMidY = t.conn.midY;
                    if (finalMidY === undefined || finalMidY === null) {
                        finalMidY = findSafeMidY(sPort.y, targetLimitY, minX, maxX, excludeNodeNames, nodes);
                    }
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + sPort.x + ' ' + finalMidY +
                                  ' L ' + t.tPort.x + ' ' + finalMidY +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn, dir, sPort, t.tPort, null, finalMidY);
                });

            } else if (dir === 'North') {
                const sPort = { x: fromNode.midX, y: fromNode.top };
                const targets = conns.map(c => {
                    return {
                        tPort: { x: c.toNode.midX, y: c.toNode.bottom },
                        conn: c.conn
                    };
                });

                const maxTargetBottom = Math.max(...conns.map(c => c.toNode.bottom));
                const targetLimitY = Math.min(maxTargetBottom, sPort.y - 30);
                const minX = Math.min(sPort.x, ...targets.map(t => t.tPort.x));
                const maxX = Math.max(sPort.x, ...targets.map(t => t.tPort.x));

                targets.forEach(t => {
                    let finalMidY = t.conn.midY;
                    if (finalMidY === undefined || finalMidY === null) {
                        finalMidY = findSafeMidY(targetLimitY, sPort.y, minX, maxX, excludeNodeNames, nodes);
                    }
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + sPort.x + ' ' + finalMidY +
                                  ' L ' + t.tPort.x + ' ' + finalMidY +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn, dir, sPort, t.tPort, null, finalMidY);
                });
            }
        });

        function drawPath(d, conn, actualDir, sPort, tPort, finalMidX, finalMidY) {
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', d);
            pathEl.setAttribute('fill', 'none');
            
            let strokeColor = 'var(--connection-color)';
            let markerId = '';
            
            if (conn.relationType === 'extends' || conn.relationType === 'inherits') {
                markerId = 'arrow-hollow-triangle';
            } else if (conn.relationType === 'implements') {
                markerId = 'arrow-hollow-triangle';
                pathEl.setAttribute('stroke-dasharray', '6,4');
            } else if (conn.relationType === 'associates') {
                markerId = 'arrow-vee';
            } else if (conn.relationType === 'dependsOn') {
                markerId = 'arrow-vee';
                pathEl.setAttribute('stroke-dasharray', '6,4');
            } else if (conn.relationType === 'aggregates') {
                markerId = 'arrow-hollow-diamond';
            } else if (conn.relationType === 'composes') {
                markerId = 'arrow-filled-diamond';
            }

            pathEl.setAttribute('stroke', strokeColor);
            pathEl.setAttribute('stroke-width', '1.5');
            if (markerId) {
                pathEl.setAttribute('marker-end', 'url(#' + markerId + ')');
            }

            svg.appendChild(pathEl);

            // Transparent helper path for hover/drag
            const touchPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            touchPathEl.setAttribute('d', d);
            touchPathEl.setAttribute('fill', 'none');
            touchPathEl.setAttribute('stroke', 'transparent');
            touchPathEl.setAttribute('stroke-width', '10');
            touchPathEl.setAttribute('style', 'cursor: pointer;');
            svg.appendChild(touchPathEl);

            // 1. Port handle (at source port)
            const portHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            portHandle.setAttribute('cx', sPort.x);
            portHandle.setAttribute('cy', sPort.y);
            portHandle.setAttribute('r', '5');
            portHandle.setAttribute('class', 'connection-handle port-handle');
            portHandle.setAttribute('style', 'cursor: crosshair; fill: #fff; stroke: var(--connection-color); stroke-width: 1.5px; opacity: 0.4; transition: opacity 0.2s, r 0.2s;');

            // 2. Mid handle (at midpoint of the middle segment)
            let midHandleX = 0;
            let midHandleY = 0;
            if (actualDir === 'East' || actualDir === 'West') {
                midHandleX = finalMidX;
                midHandleY = (sPort.y + tPort.y) / 2;
            } else {
                midHandleX = (sPort.x + tPort.x) / 2;
                midHandleY = finalMidY;
            }

            const midHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            midHandle.setAttribute('cx', midHandleX);
            midHandle.setAttribute('cy', midHandleY);
            midHandle.setAttribute('r', '5');
            midHandle.setAttribute('class', 'connection-handle mid-handle');
            midHandle.setAttribute('style', 'cursor: move; fill: #fff; stroke: var(--connection-color); stroke-width: 1.5px; opacity: 0.4; transition: opacity 0.2s, r 0.2s;');

            [portHandle, midHandle].forEach(h => {
                h.addEventListener('mouseenter', () => {
                    h.setAttribute('opacity', '1.0');
                    h.setAttribute('r', '7');
                });
                h.addEventListener('mouseleave', () => {
                    h.setAttribute('opacity', '0.4');
                    h.setAttribute('r', '5');
                });
            });

            // Handle Mid-handle dragging
            midHandle.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                e.preventDefault();

                const startDragX = e.clientX;
                const startDragY = e.clientY;
                const initialMidX = finalMidX;
                const initialMidY = finalMidY;
                let hasMoved = false;

                function onMouseMove(moveEvt) {
                    const dx = (moveEvt.clientX - startDragX) / zoom;
                    const dy = (moveEvt.clientY - startDragY) / zoom;
                    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                        hasMoved = true;
                    }

                    let newMidX = initialMidX;
                    let newMidY = initialMidY;

                    if (actualDir === 'East' || actualDir === 'West') {
                        newMidX = initialMidX + dx;
                        midHandle.setAttribute('cx', newMidX);
                        const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                      ' L ' + newMidX + ' ' + sPort.y +
                                      ' L ' + newMidX + ' ' + tPort.y +
                                      ' L ' + tPort.x + ' ' + tPort.y;
                        pathEl.setAttribute('d', pathD);
                        touchPathEl.setAttribute('d', pathD);
                    } else {
                        newMidY = initialMidY + dy;
                        midHandle.setAttribute('cy', newMidY);
                        const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                      ' L ' + sPort.x + ' ' + newMidY +
                                      ' L ' + tPort.x + ' ' + newMidY +
                                      ' L ' + tPort.x + ' ' + tPort.y;
                        pathEl.setAttribute('d', pathD);
                        touchPathEl.setAttribute('d', pathD);
                    }
                }

                function onMouseUp(upEvt) {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);

                    if (hasMoved) {
                        const finalDx = (upEvt.clientX - startDragX) / zoom;
                        const finalDy = (upEvt.clientY - startDragY) / zoom;

                        const finalUpdateMidX = (actualDir === 'East' || actualDir === 'West') ? (initialMidX + finalDx) : null;
                        const finalUpdateMidY = (actualDir === 'North' || actualDir === 'South') ? (initialMidY + finalDy) : null;

                        document.dispatchEvent(new CustomEvent('planist-update-connection', {
                            detail: {
                                from: conn.from,
                                to: conn.to,
                                relationType: conn.relationType,
                                direction: actualDir,
                                midX: finalUpdateMidX,
                                midY: finalUpdateMidY
                            }
                        }));
                    }
                }

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            // Handle Port-handle dragging
            portHandle.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                e.preventDefault();

                const fromNode = nodes.find(n => n.name === conn.from);
                if (!fromNode) return;

                let tempDir = actualDir;

                function onMouseMove(moveEvt) {
                    const rect = viewport.getBoundingClientRect();
                    const mx = (moveEvt.clientX - rect.left - panX) / zoom;
                    const my = (moveEvt.clientY - rect.top - panY) / zoom;

                    const dx = mx - fromNode.midX;
                    const dy = my - fromNode.midY;

                    let newDir = 'East';
                    if (Math.abs(dx) >= Math.abs(dy)) {
                        newDir = dx > 0 ? 'East' : 'West';
                    } else {
                        newDir = dy > 0 ? 'South' : 'North';
                    }

                    if (newDir !== tempDir) {
                        tempDir = newDir;
                        
                        // Temporarily update cache and redraw
                        const connIndex = configuredConnections.findIndex(c => c.from === conn.from && c.to === conn.to && c.relationType === conn.relationType);
                        if (connIndex !== -1) {
                            configuredConnections[connIndex].direction = newDir;
                            configuredConnections[connIndex].midX = null;
                            configuredConnections[connIndex].midY = null;
                        } else {
                            configuredConnections.push({
                                from: conn.from,
                                to: conn.to,
                                relationType: conn.relationType,
                                direction: newDir,
                                midX: null,
                                midY: null
                            });
                        }
                        renderConnections();
                    }
                }

                function onMouseUp() {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);

                    // Dispatch final connection update to persist
                    document.dispatchEvent(new CustomEvent('planist-update-connection', {
                        detail: {
                            from: conn.from,
                            to: conn.to,
                            relationType: conn.relationType,
                            direction: tempDir,
                            midX: null,
                            midY: null
                        }
                    }));
                }

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            svg.appendChild(portHandle);
            svg.appendChild(midHandle);
        }
    }

    // @state: green
    function triggerResetConnectionLayoutForSelected() {
        if (selectedEntities.length === 0) return;
        
        const nodes = [];
        const cardElements = workspace.querySelectorAll('.board-node');
        
        activeEntities.forEach(entity => {
            const pos = nodePositions[entity.name];
            if (!pos) return;
            
            let width = 240;
            let height = 150;
            for (let i = 0; i < cardElements.length; i++) {
                const titleEl = cardElements[i].querySelector('.node-title');
                if (titleEl && titleEl.textContent === entity.name) {
                    width = cardElements[i].offsetWidth || 240;
                    height = cardElements[i].offsetHeight || 150;
                    break;
                }
            }
            
            nodes.push({
                name: entity.name,
                left: pos.x,
                top: pos.y,
                right: pos.x + width,
                bottom: pos.y + height,
                midX: pos.x + width / 2,
                midY: pos.y + height / 2,
                w: width,
                h: height
            });
        });

        const relationTypes = [
            { key: 'extendsTargets', type: 'extends' },
            { key: 'inheritsTargets', type: 'inherits' },
            { key: 'implementsTargets', type: 'implements' },
            { key: 'associatesTargets', type: 'associates' },
            { key: 'aggregatesTargets', type: 'aggregates' },
            { key: 'composesTargets', type: 'composes' },
            { key: 'dependsOnTargets', type: 'dependsOn' }
        ];

        const connectionsToReset = [];
        
        activeEntities.forEach(entity => {
            relationTypes.forEach(rel => {
                const targets = entity[rel.key] || [];
                targets.forEach(targetName => {
                    if (nodePositions[targetName]) {
                        if (selectedEntities.includes(entity.name) || selectedEntities.includes(targetName)) {
                            const fromNode = nodes.find(n => n.name === entity.name);
                            const toNode = nodes.find(n => n.name === targetName);
                            if (!fromNode || !toNode) return;

                            const dx = toNode.midX - fromNode.midX;
                            const dy = toNode.midY - fromNode.midY;
                            
                            let dir = 'East';
                            if (Math.abs(dx) >= Math.abs(dy)) {
                                dir = dx > 0 ? 'East' : 'West';
                            } else {
                                dir = dy > 0 ? 'South' : 'North';
                            }

                            let midX = null;
                            let midY = null;
                            const excludeNodeNames = [fromNode.name, toNode.name];

                            if (dir === 'East') {
                                const sPortX = fromNode.right;
                                const tPortX = toNode.left;
                                const minY = Math.min(fromNode.midY, toNode.midY);
                                const maxY = Math.max(fromNode.midY, toNode.midY);
                                const targetLimitX = Math.max(tPortX, sPortX + 30);
                                midX = findSafeMidX(sPortX, targetLimitX, minY, maxY, excludeNodeNames, nodes);
                            } else if (dir === 'West') {
                                const sPortX = fromNode.left;
                                const tPortX = toNode.right;
                                const minY = Math.min(fromNode.midY, toNode.midY);
                                const maxY = Math.max(fromNode.midY, toNode.midY);
                                const targetLimitX = Math.min(tPortX, sPortX - 30);
                                midX = findSafeMidX(targetLimitX, sPortX, minY, maxY, excludeNodeNames, nodes);
                            } else if (dir === 'South') {
                                const sPortY = fromNode.bottom;
                                const tPortY = toNode.top;
                                const minX = Math.min(fromNode.midX, toNode.midX);
                                const maxX = Math.max(fromNode.midX, toNode.midX);
                                const targetLimitY = Math.max(tPortY, sPortY + 30);
                                midY = findSafeMidY(sPortY, targetLimitY, minX, maxX, excludeNodeNames, nodes);
                            } else if (dir === 'North') {
                                const sPortY = fromNode.top;
                                const tPortY = toNode.bottom;
                                const minX = Math.min(fromNode.midX, toNode.midX);
                                const maxX = Math.max(fromNode.midX, toNode.midX);
                                const targetLimitY = Math.min(tPortY, sPortY - 30);
                                midY = findSafeMidY(targetLimitY, sPortY, minX, maxX, excludeNodeNames, nodes);
                            }

                            connectionsToReset.push({
                                from: entity.name,
                                to: targetName,
                                relationType: rel.type,
                                direction: dir,
                                midX: midX,
                                midY: midY
                            });
                        }
                    }
                });
            });
        });

        if (connectionsToReset.length > 0) {
            document.dispatchEvent(new CustomEvent('planist-update-multiple-connections', {
                detail: { connections: connectionsToReset }
            }));
        }
    }

    // @state: green
    function renderBoardNodes(entities) {
        if (!workspace) return;
        
        activeEntities = entities;

        // Clear previous items except connections SVG
        workspace.querySelectorAll('.board-node').forEach(n => n.remove());

        const styles = getComputedStyle(document.documentElement);
        const defaultBorderColor = styles.getPropertyValue('--vscode-widget-border') || 'rgba(255, 255, 255, 0.1)';

        const colsCount = 3;
        const colWidth = 280;
        const rowHeight = 250;
        const startX = 60;
        const startY = 60;

        entities.forEach((entity, index) => {
            if (!nodePositions[entity.name]) {
                if (entity.position) {
                    nodePositions[entity.name] = {
                        x: entity.position.x,
                        y: entity.position.y
                    };
                } else {
                    const col = index % colsCount;
                    const row = Math.floor(index / colsCount);
                    nodePositions[entity.name] = {
                        x: startX + col * colWidth,
                        y: startY + row * rowHeight
                    };
                }
            }

            const pos = nodePositions[entity.name];
            const isTextNode = entity.kind === 'text';
            const isMethodNode = entity.kind === 'method';

            const card = document.createElement('div');
            card.className = 'board-node' + (isTextNode ? ' text-node' : (isMethodNode ? ' method-node' : ' class-node'));
            card.style.left = pos.x + 'px';
            card.style.top = pos.y + 'px';

            const style = entity.renderStyle || {};
            const vo = entity.visualOverride || {};
            const bgColor = vo.color || style.color || 'rgba(30, 30, 35, 0.95)';
            const borderColor = vo.borderColor || style.borderColor || defaultBorderColor;
            const radius = vo.borderRadius !== undefined ? vo.borderRadius : (style.radius !== undefined ? style.radius : 8);
            const opacity = vo.opacity !== undefined ? vo.opacity : (style.opacity !== undefined ? style.opacity : 0.95);

            card.style.backgroundColor = bgColor;
            card.style.borderColor = borderColor;
            card.style.borderRadius = radius + 'px';
            card.style.opacity = opacity;

            let headerKind = entity.kind || 'class';
            let title = entity.name;

            if (isMethodNode) {
                const accessSym = formatAccessModifier(entity.accessModifier);
                const modArray = entity.modifiers || [];
                const staticStr = modArray.includes('static') ? 'static' : '';
                const finalStr = modArray.includes('final') ? 'final' : '';
                
                const modsParts = [];
                if (accessSym) modsParts.push(accessSym);
                if (staticStr) modsParts.push(staticStr);
                if (finalStr) modsParts.push(finalStr);
                
                const prefix = modsParts.join(' ');
                const returnTypeStr = entity.returnType ? ': ' + entity.returnType : '';
                title = (prefix ? prefix + ' ' : '') + entity.entityName + '.' + entity.methodName + '()' + returnTypeStr;
            }

            let html = '';

            html += '<div class="node-header">';
            html += '  <span class="node-kind">' + headerKind + '</span>';
            html += '  <span class="node-title">' + title + '</span>';
            html += '</div>';

            if (!isMethodNode) {
                html += '<div class="node-divider"></div>';
                html += '<div class="node-body">';
                
                const fields = (entity.fields || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                const methods = (entity.methods || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));

                if (isTextNode) {
                    const bodyText = entity.textBody || '';
                    html += '  <div class="text-body">' + bodyText.replace(/\\\\r?\\\\n/g, '<br>') + '</div>';
                } else {
                    if (fields.length > 0 || methods.length > 0) {
                        if (fields.length > 0) {
                            html += '  <div class="node-section">';
                            fields.forEach(f => {
                                const accessSym = formatAccessModifier(f.accessModifier);
                                const accessPrefix = accessSym ? accessSym + ' ' : '';
                                const typeStr = f.type ? ': ' + f.type : '';
                                html += '    <button class="node-item field-item item-btn" data-line="' + (f.line || 0) + '">' + accessPrefix + f.name + typeStr + '</button>';
                            });
                            html += '  </div>';
                        }
                        if (fields.length > 0 && methods.length > 0) {
                            html += '  <div class="node-divider"></div>';
                        }
                        if (methods.length > 0) {
                            html += '  <div class="node-section">';
                            methods.forEach(m => {
                                const accessSym = formatAccessModifier(m.accessModifier);
                                const accessPrefix = accessSym ? accessSym + ' ' : '';
                                const returnTypeStr = m.returnType ? ': ' + m.returnType : '';
                                html += '    <button class="node-item method-item item-btn" data-line="' + (m.line || 0) + '">' + accessPrefix + m.name + '()' + returnTypeStr + '</button>';
                            });
                            html += '  </div>';
                        }
                    } else {
                        html += '  <div style="font-style: italic; color: rgba(255,255,255,0.3)">Empty Block</div>';
                    }
                }
                html += '</div>';
            }

            card.innerHTML = html;
            workspace.appendChild(card);

            nodePositions[entity.name].w = card.offsetWidth || 240;
            nodePositions[entity.name].h = card.offsetHeight || 150;

            card.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                
                const startNodeX = nodePositions[entity.name].x;
                const startNodeY = nodePositions[entity.name].y;
                const dragStartX = e.clientX;
                const dragStartY = e.clientY;
                let hasMoved = false;

                // @state: green
                function onMouseMove(moveEvt) {
                    const dx = moveEvt.clientX - dragStartX;
                    const dy = moveEvt.clientY - dragStartY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        hasMoved = true;
                    }

                    nodePositions[entity.name].x = startNodeX + dx / zoom;
                    nodePositions[entity.name].y = startNodeY + dy / zoom;

                    card.style.left = nodePositions[entity.name].x + 'px';
                    card.style.top = nodePositions[entity.name].y + 'px';
                    
                    triggerRenderConnections();
                }

                function onMouseUp() {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    
                    if (hasMoved) {
                        document.dispatchEvent(new CustomEvent('planist-update-entity-position', {
                            detail: {
                                entityName: entity.name,
                                position: {
                                    x: nodePositions[entity.name].x,
                                    y: nodePositions[entity.name].y
                                }
                            }
                        }));
                    } else if (e.button === 0) {
                        if (e.ctrlKey || e.metaKey) {
                            if (selectedEntities.includes(entity.name)) {
                                selectedEntities = selectedEntities.filter(name => name !== entity.name);
                                card.classList.remove('selected');
                            } else {
                                selectedEntities.push(entity.name);
                                card.classList.add('selected');
                            }
                        } else {
                            document.querySelectorAll('.board-node').forEach(n => n.classList.remove('selected'));
                            selectedEntities = [entity.name];
                            card.classList.add('selected');
                        }

                        if (selectedEntities.length > 0) {
                            selectedEntityName = selectedEntities[selectedEntities.length - 1];
                            const lastSelectedEntity = activeEntities.find(ent => ent.name === selectedEntityName);
                            if (lastSelectedEntity) {
                                document.dispatchEvent(new CustomEvent('planist-node-selected', {
                                    detail: {
                                        entity: lastSelectedEntity,
                                        allEntities: activeEntities
                                    }
                                }));
                            }
                        } else {
                            selectedEntityName = null;
                            document.dispatchEvent(new CustomEvent('planist-node-deselected'));
                        }
                    }
                }

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            card.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                if (isMethodNode) {
                    vscode.postMessage({ command: 'openEntityFile', entityName: entity.entityName });
                } else {
                    vscode.postMessage({ command: 'openEntityFile', entityName: entity.name });
                }
            });

            const header = card.querySelector('.node-header');
            if (header && entity.comments && entity.comments.length > 0) {
                header.style.cursor = 'help';
                header.addEventListener('mouseenter', function(evt) {
                    showTooltip(evt, entity.name, entity.comments);
                });
                header.addEventListener('mousemove', function(evt) {
                    positionTooltip(evt);
                });
                header.addEventListener('mouseleave', function() {
                    hideTooltip();
                });
            }

            if (!isMethodNode) {
                const fields = (entity.fields || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                const methods = (entity.methods || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                
                const fieldButtons = card.querySelectorAll('.field-item');
                fieldButtons.forEach((btn, idx) => {
                    const f = fields[idx];
                    if (f) {
                        btn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            vscode.postMessage({ command: 'gotoLine', line: f.line || 0 });
                        });
                        if (f.comments && f.comments.length > 0) {
                            btn.style.cursor = 'help';
                            btn.addEventListener('mouseenter', function(evt) {
                                showTooltip(evt, f.name, f.comments);
                            });
                            btn.addEventListener('mousemove', function(evt) {
                                positionTooltip(evt);
                            });
                            btn.addEventListener('mouseleave', function() {
                                hideTooltip();
                            });
                        }
                    }
                });

                const methodButtons = card.querySelectorAll('.method-item');
                methodButtons.forEach((btn, idx) => {
                    const m = methods[idx];
                    if (m) {
                        btn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            vscode.postMessage({
                                command: 'startCallChain',
                                entityName: entity.name,
                                methodName: m.name
                            });
                        });
                        if (m.comments && m.comments.length > 0) {
                            btn.style.cursor = 'help';
                            btn.addEventListener('mouseenter', function(evt) {
                                showTooltip(evt, m.name + '()', m.comments);
                            });
                            btn.addEventListener('mousemove', function(evt) {
                                positionTooltip(evt);
                            });
                            btn.addEventListener('mouseleave', function() {
                                hideTooltip();
                            });
                        }
                    }
                });
            }
        });

        setTimeout(renderConnections, 50);
    }

    // Handle messages from the extension main side
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'updateGraph') {
            console.log('Received updateGraph in new board, rendering entities:', message.data);
            const entities = message.data.entities || [];
            configuredConnections = message.data.connections || [];
            
            const backPanel = document.getElementById('back-btn-panel');
            if (backPanel) {
                backPanel.style.display = message.mode === 'callchain' ? 'flex' : 'none';
            }
            
            renderBoardNodes(entities);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
`;
