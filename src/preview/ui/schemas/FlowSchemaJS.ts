export const FlowSchemaJS = `
(function() {
    console.log('====== Planist 網格畫布前端核心啟動 ======');
    const vscode = acquireVsCodeApi();
    let cyInstance = null;

    // 1. 初始化 Cytoscape 畫布與高級動態網格背景
    function initCanvas(boardConfig) {
        const cyContainer = document.getElementById('cy');
        
        // 套用動態網格配置解算器
        applyGridStyle(cyContainer, boardConfig);

        cyInstance = cytoscape({
            container: cyContainer,
            boxSelectionEnabled: false,
            autounselectify: true,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(renderStyle.backgroundColor)',
                        'label': 'data(name)',
                        'color': '#fff',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '12px',
                        'width': '100px',
                        'height': '45px',
                        'shape': 'round-rectangle',
                        'border-width': '1px',
                        'border-color': '#555'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#666',
                        'target-arrow-color': '#666',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                }
            ],
            elements: []
        });

        // 綁定雙擊事件
        cyInstance.on('dblclick', 'node', function(evt) {
            const nodeName = evt.target.data('name');
            vscode.postMessage({ command: 'openEntityFile', entityName: nodeName });
        });

        document.getElementById('fitBtn').addEventListener('click', () => cyInstance.fit());
        document.getElementById('layoutBtn').addEventListener('click', runLayout);

		// 1. 停用 Cytoscape 內建的滾輪縮放功能，改由我們手動完全接管
        cyInstance.userZoomingEnabled(false);

        // 2. 監聽畫布容器上的滾輪事件
        cyContainer.addEventListener('wheel', function(e) {
            e.preventDefault(); // 阻擋網頁預設滾動行為

            const currentZoom = cyInstance.zoom();
            
            // 定義每次滾輪觸發時變更的絕對百分比步進值（例如每次固定增減 5%）
            const zoomStep = 0.05; 
            let newZoom = currentZoom;

            // e.deltaY < 0 代表滾輪向上（放大），反之向下（縮小）
            if (e.deltaY < 0) {
                newZoom = currentZoom + zoomStep;
            } else {
                newZoom = currentZoom - zoomStep;
            }

            // 🔥 【具體實作】限制縮放範圍在 10% ~ 200% (0.1 ~ 2.0)
            if (newZoom < 0.1) {
                newZoom = 0.1;
            } else if (newZoom > 2.0) {
                newZoom = 2.0;
            }

            // 3. 以滑鼠當前游標所在的位置（Rendered Position）為中心點進行非線性等比縮放
            const mPos = { x: e.clientX, y: e.clientY };
            
            // 獲取畫布相對於視窗的偏移量，算出精準的畫布內座標
            const containerRect = cyContainer.getBoundingClientRect();
            const renderedPos = {
                x: mPos.x - containerRect.left,
                y: mPos.y - containerRect.top
            };

            // 套用新縮放值與中心點
            cyInstance.zoom({
                level: newZoom,
                renderedPosition: renderedPos
            });

            // 4. 【可選】更新 UI 上的百分比文字（若未來有縮放狀態列需求）
            console.log(\`當前畫布縮放比例: \${Math.round(newZoom * 100)}%\`);
        }, { passive: false }); // 必須設為 false 才能成功執行 preventDefault()

		// 1. 攔截畫布容器上的 mousedown 事件
        cyContainer.addEventListener('mousedown', function(e) {
            // 🔥 【具體實作】e.button === 1 代表滑鼠中鍵（滾輪按下）
            if (e.button === 1) {
                e.preventDefault();  // 強制阻擋瀏覽器預設的網頁自動滾動小圖示
                e.stopPropagation(); // 阻止事件向上冒泡
                
                if (cyInstance) {
                    console.log('====== 偵測到滑鼠中鍵按下：自動置中並適應全景 (Fit) ======');
                    
                    // 執行優雅的動畫置中
                    cyInstance.animate({
                        fit: {
                            eles: cyInstance.elements(),
                            padding: 30 // 四周保留 30px 的安全邊距，避免節點貼齊畫布邊緣
                        },
                        duration: 250,   // 250 毫秒平滑過渡
                        easing: 'ease-out-cue'
                    });
                }
            }
        }, { passive: false });

        // 2. 額外防禦：阻擋中鍵引發的輔助選單（部分 Linux/X11 環境滑鼠放開時會彈出）
        cyContainer.addEventListener('auxclick', function(e) {
            if (e.button === 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * 【具體實作】高級複合網格 CSS 構造器
     * 支援使用者輸入任何合法顏色 (HEX, RGB, HSL)，並動態生成主副線幾何網格
     */
    function applyGridStyle(container, config) {
        // 預設防禦配置 (若後端尚未載入，則使用預設暗色網格)
        const cfg = {
            backgroundColor: config?.backgroundColor || '#1e1e1e',
            gridType: config?.gridType || 'mesh',
            lineColor: config?.lineColor || 'rgba(128, 128, 128, 0.15)',
            subLineColor: config?.subLineColor || 'rgba(128, 128, 128, 0.05)',
            mainLineWidth: config?.mainLineWidth || 1.5,
            subLineWidth: config?.subLineWidth || 0.5,
            mainLineGap: config?.mainLineGap || 100, // 主線條間距 (px)
            subLineCount: config?.subLineCount || 4   // 主線之間有幾條副線
        };

        // 基本背景顏色套用 (天然支援 hex, rgb, hsl 字串)
        container.style.backgroundColor = cfg.backgroundColor;

        if (cfg.gridType === 'none') {
            container.style.backgroundImage = 'none';
            return;
        }

        if (cfg.gridType === 'dots') {
            container.style.backgroundImage = \`radial-gradient(circle, \${cfg.lineColor} \${cfg.mainLineWidth}px, transparent \${cfg.mainLineWidth}px)\`;
            container.style.backgroundSize = \`\${cfg.mainLineGap}px \${cfg.mainLineGap}px\`;
            return;
        }

        if (cfg.gridType === 'mesh') {
            // 計算副線之間的間距
            const subLineGap = cfg.mainLineGap / (cfg.subLineCount + 1);

            // 構造複合網格 (線性漸層疊加)
            // 透過 linear-gradient 畫出主線與副線的十字交叉
            container.style.backgroundImage = \`
                linear-gradient(\${cfg.lineColor} \${cfg.mainLineWidth}px, transparent \${cfg.mainLineWidth}px),
                linear-gradient(90deg, \${cfg.lineColor} \${cfg.mainLineWidth}px, transparent \${cfg.mainLineWidth}px),
                linear-gradient(\${cfg.subLineColor} \${cfg.subLineWidth}px, transparent \${cfg.subLineWidth}px),
                linear-gradient(90deg, \${cfg.subLineColor} \${cfg.subLineWidth}px, transparent \${cfg.subLineWidth}px)
            \`;

            // 設定對應的格子大小快取
            container.style.backgroundSize = \`
                \${cfg.mainLineGap}px \${cfg.mainLineGap}px,
                \${cfg.mainLineGap}px \${cfg.mainLineGap}px,
                \${subLineGap}px \${subLineGap}px,
                \${subLineGap}px \${subLineGap}px
            \`;
        }
    }

    function runLayout() {
        if (!cyInstance) return;
        cyInstance.layout({ name: 'dagre', rankDir: 'TB', animate: true, animationDuration: 300 }).run();
    }

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'updateGraph') {
            // 當收到更新時，一併同步更新網格與背景配置
            const cyContainer = document.getElementById('cy');
            if (message.boardConfig) {
                applyGridStyle(cyContainer, message.boardConfig);
            }

            const entities = message.data.entities;
            const elements = [];
            
            entities.forEach(entity => {
                const style = entity.renderStyle || { backgroundColor: '#4a90e2' };
                elements.push({ data: { id: entity.name, name: entity.name, renderStyle: style } });
            });

            entities.forEach(entity => {
                (entity.relationTargets || []).forEach(target => {
                    elements.push({ data: { id: entity.name + '-' + target, source: entity.name, target: target } });
                });
            });

            cyInstance.json({ elements: elements });
            runLayout();
        }
    });

    window.addEventListener('DOMContentLoaded', () => {
        // 首次啟動先傳入預設空配置
        initCanvas(null);
        vscode.postMessage({ command: 'ready' });
    });
})();
`;