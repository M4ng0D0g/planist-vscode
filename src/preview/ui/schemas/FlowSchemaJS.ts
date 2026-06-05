export const FlowSchemaJS = `
(function() {
    console.log('====== Planist 網格畫布前端核心啟動 ======');
    const vscode = acquireVsCodeApi();
    let cyInstance = null;
    let lastEntities = [];
    let layoutTimer = null; // 🛠️ 引入防抖定時器
    let currentGridConfig = null;

    // 1. 初始化 Cytoscape 畫布與高級動態網格背景
    function initCanvas(boardConfig) {
        const cyContainer = document.getElementById('cy');
        if (!cyContainer) return; // 安全閘限制

        applyGridStyle(cyContainer, boardConfig);

        cyInstance = cytoscape({
            container: cyContainer,
            boxSelectionEnabled: false,
            autounselectify: true,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(backgroundColor)',
                        'border-color': 'data(borderColor)',
                        'border-width': '1px',
                        'border-radius': 'data(borderRadius)',
                        'background-opacity': 'data(backgroundOpacity)',
                        'label': 'data(labelText)',
                        'color': '#fff',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-justification': 'left',
                        'font-size': '11px',
                        'font-family': 'monospace', // 🛠️ 強制等寬字體，讓字元寬度計算 100% 精準
                        'width': 'data(width)',
                        'height': 'data(height)',
                        'shape': 'round-rectangle',
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#888',
                        'target-arrow-color': '#888',
                        'target-arrow-shape': 'triangle',
                        'target-arrow-fill': 'filled',
                        'curve-style': 'taxi',
                        'taxi-direction': 'auto',
                        'taxi-turn': 24,
                        'line-style': 'solid'
                    }
                },
                {
                    selector: 'edge[relationType = "extends"], edge[relationType = "inherits"]',
                    style: {
                        'target-arrow-shape': 'triangle',
                        'target-arrow-fill': 'hollow',
                        'line-style': 'solid'
                    }
                },
                {
                    selector: 'edge[relationType = "implements"]',
                    style: {
                        'target-arrow-shape': 'triangle',
                        'target-arrow-fill': 'hollow',
                        'line-style': 'dashed',
                        'line-dash-pattern': [6, 4]
                    }
                },
                {
                    selector: 'edge[relationType = "associates"]',
                    style: {
                        'target-arrow-shape': 'vee',
                        'line-style': 'solid'
                    }
                },
                {
                    selector: 'edge[relationType = "dependsOn"]',
                    style: {
                        'target-arrow-shape': 'vee',
                        'line-style': 'dashed',
                        'line-dash-pattern': [6, 4]
                    }
                },
                {
                    selector: 'edge[relationType = "aggregates"]',
                    style: {
                        'target-arrow-shape': 'diamond',
                        'target-arrow-fill': 'hollow',
                        'line-style': 'solid'
                    }
                },
                {
                    selector: 'edge[relationType = "composes"]',
                    style: {
                        'target-arrow-shape': 'diamond',
                        'target-arrow-fill': 'filled',
                        'line-style': 'solid'
                    }
                }
            ],
            elements: []
        });

        // 綁定動態網格平移與縮放事件監聽
        cyInstance.on('pan zoom', updateGridPositionAndScale);

        // 輔助函式：轉換權限修飾詞為符號
        function formatAccessModifier(access) {
            if (!access) return '';
            const trimmed = access.trim().toLowerCase();
            if (trimmed === 'public' || trimmed === '+') return '+';
            if (trimmed === 'protected' || trimmed === '#') return '#';
            if (trimmed === 'private' || trimmed === '-') return '-';
            return access;
        }

        // 綁定雙擊事件：雙擊開啟對應實體檔案
        cyInstance.on('dblclick', 'node', function(evt) {
            const node = evt.target;
            const kind = node.data('kind');
            let entityName = node.data('name');
            if (kind === 'method') {
                entityName = node.data('entityName');
            }
            vscode.postMessage({ command: 'openEntityFile', entityName: entityName });
        });

        // 綁定單擊事件：點擊方法線進入呼叫鏈模式
        cyInstance.on('tap', 'node', function(evt) {
            const node = evt.target;
            const kind = node.data('kind');
            if (kind !== 'method') {
                const nodeName = node.data('name');
                const labelText = node.data('labelText') || '';
                const lines = labelText.split('\n');
                
                const clickPos = evt.position;
                const nodePos = node.position();
                const nodeHeight = node.height();
                
                const relativeY = clickPos.y - (nodePos.y - nodeHeight / 2);
                const lineIndex = Math.floor((relativeY - 10) / 15);
                
                const entity = lastEntities.find(e => e.name === nodeName);
                if (entity) {
                    const fields = (entity.fields || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                    const methods = (entity.methods || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                    
                    const methodStartIndex = 2 + fields.length + (fields.length > 0 ? 1 : 0);
                    const clickedMethodIndex = lineIndex - methodStartIndex;
                    
                    if (clickedMethodIndex >= 0 && clickedMethodIndex < methods.length) {
                        const clickedMethod = methods[clickedMethodIndex];
                        vscode.postMessage({
                            command: 'startCallChain',
                            entityName: nodeName,
                            methodName: clickedMethod.name
                        });
                    }
                }
            }
        });

        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'exitCallChain' });
            });
        }

        document.getElementById('fitBtn').addEventListener('click', () => {
            if (cyInstance && cyInstance.elements().length > 0) cyInstance.fit();
        });
        document.getElementById('layoutBtn').addEventListener('click', runLayout);

        cyInstance.userZoomingEnabled(false);

        // 接管滾輪縮放
        cyContainer.addEventListener('wheel', function(e) {
            e.preventDefault(); 
            const currentZoom = cyInstance.zoom();
            const zoomStep = 0.05; 
            let newZoom = e.deltaY < 0 ? currentZoom + zoomStep : currentZoom - zoomStep;

            if (newZoom < 0.1) newZoom = 0.1;
            if (newZoom > 2.0) newZoom = 2.0;

            const containerRect = cyContainer.getBoundingClientRect();
            const renderedPos = {
                x: e.clientX - containerRect.left,
                y: e.clientY - containerRect.top
            };

            cyInstance.zoom({ level: newZoom, renderedPosition: renderedPos });
        }, { passive: false });

        // 攔截滑鼠中鍵動畫縮放
        cyContainer.addEventListener('mousedown', function(e) {
            if (e.button === 1) {
                e.preventDefault();  
                e.stopPropagation(); 
                if (cyInstance && cyInstance.elements().length > 0) {
                    cyInstance.animate({
                        fit: { eles: cyInstance.elements(), padding: 30 },
                        duration: 250,   
                        easing: 'ease-out-cubic'
                    });
                }
            }
        }, { passive: false });

        cyContainer.addEventListener('auxclick', function(e) {
            if (e.button === 1) e.preventDefault();
        }, { passive: false });
    }

    function updateGridPositionAndScale() {
        const cyContainer = document.getElementById('cy');
        if (!cyInstance || !currentGridConfig || !cyContainer) return;

        const pan = cyInstance.pan();
        const zoom = cyInstance.zoom();
        const cfg = currentGridConfig;

        if (cfg.gridType === 'none') {
            cyContainer.style.backgroundImage = 'none';
            return;
        }

        if (cfg.gridType === 'dots') {
            cyContainer.style.backgroundImage = 'radial-gradient(circle, ' + cfg.lineColor + ' ' + (cfg.mainLineWidth * zoom) + 'px, transparent ' + (cfg.mainLineWidth * zoom) + 'px)';
            const mainSize = cfg.mainLineGap * zoom;
            cyContainer.style.backgroundSize = mainSize + 'px ' + mainSize + 'px';
            cyContainer.style.backgroundPosition = pan.x + 'px ' + pan.y + 'px';
            return;
        }

        if (cfg.gridType === 'mesh') {
            const subLineGap = cfg.mainLineGap / (cfg.subLineCount + 1);
            
            cyContainer.style.backgroundImage = 
                'linear-gradient(' + cfg.lineColor + ' ' + (cfg.mainLineWidth * zoom) + 'px, transparent ' + (cfg.mainLineWidth * zoom) + 'px), ' +
                'linear-gradient(90deg, ' + cfg.lineColor + ' ' + (cfg.mainLineWidth * zoom) + 'px, transparent ' + (cfg.mainLineWidth * zoom) + 'px), ' +
                'linear-gradient(' + cfg.subLineColor + ' ' + (cfg.subLineWidth * zoom) + 'px, transparent ' + (cfg.subLineWidth * zoom) + 'px), ' +
                'linear-gradient(90deg, ' + cfg.subLineColor + ' ' + (cfg.subLineWidth * zoom) + 'px, transparent ' + (cfg.subLineWidth * zoom) + 'px)';

            const mainSize = cfg.mainLineGap * zoom;
            const subSize = subLineGap * zoom;
            
            cyContainer.style.backgroundSize = 
                mainSize + 'px ' + mainSize + 'px, ' +
                mainSize + 'px ' + mainSize + 'px, ' +
                subSize + 'px ' + subSize + 'px, ' +
                subSize + 'px ' + subSize + 'px';

            cyContainer.style.backgroundPosition = 
                pan.x + 'px ' + pan.y + 'px, ' +
                pan.x + 'px ' + pan.y + 'px, ' +
                pan.x + 'px ' + pan.y + 'px, ' +
                pan.x + 'px ' + pan.y + 'px';
        }
    }

    function applyGridStyle(container, config) {
        const themeBg = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background');
        const defaultBg = themeBg || '#1e1e1e';
        const safeConfig = config || {};
        
        const cfg = {
            backgroundColor: (!safeConfig.backgroundColor || safeConfig.backgroundColor === '#1e1e1e') ? defaultBg : safeConfig.backgroundColor,
            gridType: safeConfig.gridType || 'mesh',
            lineColor: safeConfig.lineColor || 'rgba(128, 128, 128, 0.15)',
            subLineColor: safeConfig.subLineColor || 'rgba(128, 128, 128, 0.05)',
            mainLineWidth: safeConfig.mainLineWidth || 1.5,
            subLineWidth: safeConfig.subLineWidth || 0.5,
            mainLineGap: safeConfig.mainLineGap || 100, 
            subLineCount: safeConfig.subLineCount || 4   
        };
        currentGridConfig = cfg;

        container.style.backgroundColor = cfg.backgroundColor;
        updateGridPositionAndScale();
    }

    function runLayout() {
        if (!cyInstance || cyInstance.elements().length === 0) return;
        
        // 🛠️ 實作排版防抖：避免連續快速 updateGraph 造成的畫布劇烈閃爍與運算死鎖
        if (layoutTimer) clearTimeout(layoutTimer);
        layoutTimer = setTimeout(() => {
            cyInstance.layout({ name: 'dagre', rankDir: 'TB', animate: true, animationDuration: 250 }).run();
        }, 80); 
    }

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'updateGraph') {
            const cyContainer = document.getElementById('cy');
            if (message.boardConfig) {
                applyGridStyle(cyContainer, message.boardConfig);
            }

            const backBtn = document.getElementById('backBtn');
            if (message.mode === 'callchain') {
                if (backBtn) backBtn.style.display = 'inline-block';
            } else {
                if (backBtn) backBtn.style.display = 'none';
            }

            const styles = getComputedStyle(document.documentElement);
            const keywordColor = styles.getPropertyValue('--vscode-symbolIcon-keywordForeground') 
                                 || styles.getPropertyValue('--vscode-textLink-activeForeground')
                                 || '#4a90e2';
            const defaultBorderColor = styles.getPropertyValue('--vscode-widget-border') || '#555';

            const entities = message.data.entities || [];
            lastEntities = entities;
            const elements = [];
            
            entities.forEach(entity => {
                const style = entity.renderStyle || {};
                const isClassLike = ['class', 'abstract', 'interface', 'record', 'enum', 'bind'].includes(entity.kind);
                
                let labelText = entity.name;
                let nodeWidth = 100;
                let nodeHeight = 45;
                
                if (isClassLike) {
                    const fields = (entity.fields || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                    const methods = (entity.methods || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
                    
                    if (fields.length > 0 || methods.length > 0) {
                        const lines = [entity.name];
                        lines.push('---------------------');
                        fields.forEach(f => {
                            const access = formatAccessModifier(f.accessModifier);
                            const typeStr = f.type ? ': ' + f.type : '';
                            lines.push(access + ' ' + f.name + typeStr);
                        });
                        if (methods.length > 0) {
                            if (fields.length > 0) {
                                lines.push('---------------------');
                            }
                            methods.forEach(m => {
                                const access = formatAccessModifier(m.accessModifier);
                                const returnTypeStr = m.returnType ? ': ' + m.returnType : '';
                                lines.push(access + ' ' + m.name + '()' + returnTypeStr);
                            });
                        }
                        labelText = lines.join('\n');
                        
                        let maxLength = entity.name.length;
                        fields.forEach(f => {
                            const accessSymbol = formatAccessModifier(f.accessModifier);
                            const len = accessSymbol.length + f.name.length + (f.type ? f.type.length + 2 : 0) + 1;
                            if (len > maxLength) maxLength = len;
                        });
                        methods.forEach(m => {
                            const accessSymbol = formatAccessModifier(m.accessModifier);
                            const len = accessSymbol.length + m.name.length + 3 + (m.returnType ? m.returnType.length + 2 : 0) + 1;
                            if (len > maxLength) maxLength = len;
                        });
                        nodeWidth = Math.max(120, maxLength * 7 + 30);
                        nodeHeight = lines.length * 15 + 20;
                    }
                } else if (entity.kind === 'method') {
                    const accessSym = formatAccessModifier(entity.accessModifier);
                    const qualifiers = (entity.modifiers || []).join(' ');
                    const sig = entity.entityName + '.' + entity.methodName + '()';
                    const ret = entity.returnType ? ': ' + entity.returnType : '';
                    labelText = [accessSym, qualifiers, sig].filter(Boolean).join(' ') + ret;
                    
                    nodeWidth = Math.max(120, labelText.length * 7 + 30);
                    nodeHeight = 40;
                }

                elements.push({
                    data: {
                        id: entity.name,
                        name: entity.name,
                        kind: entity.kind,
                        entityName: entity.entityName,
                        methodName: entity.methodName,
                        labelText: labelText,
                        width: nodeWidth,
                        height: nodeHeight,
                        backgroundColor: style.color || keywordColor,
                        borderColor: style.borderColor || defaultBorderColor,
                        borderRadius: style.radius !== undefined ? style.radius : 0,
                        backgroundOpacity: style.opacity !== undefined ? style.opacity : 0.9
                    }
                });
            });
            // 建立連線關係
            entities.forEach(entity => {
                const relKeys = [
                    'relationTargets', 'extendsTargets', 'implementsTargets', 
                    'inheritsTargets', 'associatesTargets', 'aggregatesTargets', 
                    'composesTargets', 'dependsOnTargets'
                ];
                relKeys.forEach(relKey => {
                    const targets = entity[relKey] || [];
                    let relationType = 'relation';
                    if (relKey === 'extendsTargets') relationType = 'extends';
                    else if (relKey === 'implementsTargets') relationType = 'implements';
                    else if (relKey === 'inheritsTargets') relationType = 'inherits';
                    else if (relKey === 'associatesTargets') relationType = 'associates';
                    else if (relKey === 'aggregatesTargets') relationType = 'aggregates';
                    else if (relKey === 'composesTargets') relationType = 'composes';
                    else if (relKey === 'dependsOnTargets') relationType = 'dependsOn';

                    targets.forEach(target => {
                        elements.push({
                            data: {
                                id: entity.name + '-' + relationType + '-' + target,
                                source: entity.name,
                                target: target,
                                relationType: relationType
                            }
                        });
                    });
                });
            });

            if (cyInstance) {
                cyInstance.elements().remove();
                if (elements.length > 0) {
                    cyInstance.add(elements);
                    runLayout();
                }
            }
        }
    });

    // 🛠️ 雙軌安全初始化：若 DOM 渲染尚未就緒，則退回到 window.onload 觸發，徹底消除「黑屏」賽跑 Bug
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initCanvas(null);
        vscode.postMessage({ command: 'ready' });
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            initCanvas(null);
            vscode.postMessage({ command: 'ready' });
        });
    }
})();
`;