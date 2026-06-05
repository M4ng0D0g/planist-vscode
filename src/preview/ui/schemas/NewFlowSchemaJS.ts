// @state: red
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
    let connectionFrameId = null;

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

    // @state: red
    function formatAccessModifier(access) {
        if (!access) return '';
        const trimmed = access.trim().toLowerCase();
        if (trimmed === 'public' || trimmed === '+') return '+';
        if (trimmed === 'protected' || trimmed === '#') return '#';
        if (trimmed === 'private' || trimmed === '-') return '-';
        return '';
    }

    // @state: red
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

        // Set initial state
        updateTransform();
        
        // Notify VS Code that webview is ready
        vscode.postMessage({ command: 'ready' });
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
        // Prevent default only if clicking directly on viewport or grid background
        if (e.target === viewport || e.target === gridBg || e.target.id === 'workspace') {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            viewport.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    // @state: green
    function handleMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panX = startPanX + dx;
        panY = startPanY + dy;
        updateTransform();
    }

    // @state: green
    function handleMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            if (viewport) {
                viewport.style.cursor = 'grab';
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

    // @state: green
    function renderConnections() {
        if (!workspace) return;
        
        let svg = document.getElementById('connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'connections-svg';
            workspace.insertBefore(svg, workspace.firstChild);
        }
        
        // Remove existing paths (leave defs intact)
        const paths = svg.querySelectorAll('path:not([id]):not(defs path)');
        paths.forEach(p => p.remove());
        
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
                        connections.push({
                            from: entity.name,
                            to: targetName,
                            relationType: rel.type
                        });
                    }
                });
            });
        });

        function isVerticalSegmentSafe(x, y1, y2, excludeNodes) {
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

        function isHorizontalSegmentSafe(y, x1, x2, excludeNodes) {
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

        function findSafeMidX(sX, minTargetX, minY, maxY, excludeNodes) {
            const candidateX = sX + (minTargetX - sX) / 2;
            if (isVerticalSegmentSafe(candidateX, minY, maxY, excludeNodes)) {
                return candidateX;
            }
            const x1 = sX + 20;
            if (x1 < minTargetX && isVerticalSegmentSafe(x1, minY, maxY, excludeNodes)) {
                return x1;
            }
            const x2 = minTargetX - 20;
            if (x2 > sX && isVerticalSegmentSafe(x2, minY, maxY, excludeNodes)) {
                return x2;
            }
            return candidateX;
        }

        function findSafeMidY(sY, minTargetY, minX, maxX, excludeNodes) {
            const candidateY = sY + (minTargetY - sY) / 2;
            if (isHorizontalSegmentSafe(candidateY, minX, maxX, excludeNodes)) {
                return candidateY;
            }
            const y1 = sY + 20;
            if (y1 < minTargetY && isHorizontalSegmentSafe(y1, minX, maxX, excludeNodes)) {
                return y1;
            }
            const y2 = minTargetY - 20;
            if (y2 > sY && isHorizontalSegmentSafe(y2, minX, maxX, excludeNodes)) {
                return y2;
            }
            return candidateY;
        }

        // Group connections by source node and classified direction
        const groups = {};
        connections.forEach(conn => {
            const fromNode = nodes.find(n => n.name === conn.from);
            const toNode = nodes.find(n => n.name === conn.to);
            if (!fromNode || !toNode) return;

            const dx = toNode.midX - fromNode.midX;
            const dy = toNode.midY - fromNode.midY;
            
            let dir = 'East';
            if (Math.abs(dx) >= Math.abs(dy)) {
                dir = dx > 0 ? 'East' : 'West';
            } else {
                dir = dy > 0 ? 'South' : 'North';
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
                
                const midX = findSafeMidX(sPort.x, targetLimitX, minY, maxY, excludeNodeNames);

                targets.forEach(t => {
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + midX + ' ' + sPort.y +
                                  ' L ' + midX + ' ' + t.tPort.y +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn);
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

                const midX = findSafeMidX(targetLimitX, sPort.x, minY, maxY, excludeNodeNames);

                targets.forEach(t => {
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + midX + ' ' + sPort.y +
                                  ' L ' + midX + ' ' + t.tPort.y +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn);
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

                const midY = findSafeMidY(sPort.y, targetLimitY, minX, maxX, excludeNodeNames);

                targets.forEach(t => {
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + sPort.x + ' ' + midY +
                                  ' L ' + t.tPort.x + ' ' + midY +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn);
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

                const midY = findSafeMidY(targetLimitY, sPort.y, minX, maxX, excludeNodeNames);

                targets.forEach(t => {
                    const pathD = 'M ' + sPort.x + ' ' + sPort.y +
                                  ' L ' + sPort.x + ' ' + midY +
                                  ' L ' + t.tPort.x + ' ' + midY +
                                  ' L ' + t.tPort.x + ' ' + t.tPort.y;
                    drawPath(pathD, t.conn);
                });
            }
        });

        function drawPath(d, conn) {
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
        }
    }

    // @state: red
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
                const col = index % colsCount;
                const row = Math.floor(index / colsCount);
                nodePositions[entity.name] = {
                    x: startX + col * colWidth,
                    y: startY + row * rowHeight
                };
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

                // @state: red
                function onMouseMove(moveEvt) {
                    const dx = moveEvt.clientX - dragStartX;
                    const dy = moveEvt.clientY - dragStartY;

                    nodePositions[entity.name].x = startNodeX + dx / zoom;
                    nodePositions[entity.name].y = startNodeY + dy / zoom;

                    card.style.left = nodePositions[entity.name].x + 'px';
                    card.style.top = nodePositions[entity.name].y + 'px';
                    
                    triggerRenderConnections();
                }

                function onMouseUp() {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
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
