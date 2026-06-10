// @state: green
export const NewFlowSchemaSettingsJS = `
(function() {
    console.log('====== Planist Visualizer Node Settings Panel Core Activated ======');
    let selectedEntity = null;
    let recentColors = [];
    let selectedRecentColor = null;

    // DOM Elements
    const settingsPanel = document.getElementById('settings-panel');
    const closeBtn = document.getElementById('close-settings-btn');
    const tabDef = document.getElementById('tab-definition');
    const tabRender = document.getElementById('tab-rendering');
    const contentDef = document.getElementById('settings-content-definition');
    const contentRender = document.getElementById('settings-content-rendering');

    // HSL Sliders DOM
    const sliderH = document.getElementById('slider-h');
    const sliderS = document.getElementById('slider-s');
    const sliderL = document.getElementById('slider-l');
    const valH = document.getElementById('val-h');
    const valS = document.getElementById('val-s');
    const valL = document.getElementById('val-l');
    const resetColorBtn = document.getElementById('reset-color-btn');
    const recentColorsContainer = document.getElementById('recent-colors-container');

    // Close panel click
    closeBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('open');
        document.querySelectorAll('.board-node').forEach(n => n.classList.remove('selected'));
    });

    // Tab switching logic
    tabDef.addEventListener('click', () => switchTab('definition'));
    tabRender.addEventListener('click', () => switchTab('rendering'));

    function switchTab(tab) {
        if (tab === 'definition') {
            tabDef.classList.add('active');
            tabRender.classList.remove('active');
            contentDef.style.display = 'flex';
            contentRender.style.display = 'none';
        } else {
            tabDef.classList.remove('active');
            tabRender.classList.add('active');
            contentDef.style.display = 'none';
            contentRender.style.display = 'flex';
        }
    }

    // Listen to node selection custom events from board visualizer
    document.addEventListener('planist-node-selected', (e) => {
        selectedEntity = e.detail.entity;
        populateSettings(selectedEntity);
        
        // Load color properties
        let h = 210, s = 80, l = 50;
        const colorStr = selectedEntity.styleColor || (selectedEntity.renderStyle && selectedEntity.renderStyle.color) || '';
        const match = colorStr.match(/hsl\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)%\\s*,\\s*(\\d+)%\\s*\\)/i);
        if (match) {
            h = parseInt(match[1], 10);
            s = parseInt(match[2], 10);
            l = parseInt(match[3], 10);
        }
        updateSlidersUI(h, s, l);
        
        settingsPanel.classList.add('open');
    });

    document.addEventListener('planist-node-deselected', () => {
        selectedEntity = null;
        settingsPanel.classList.remove('open');
    });

    function createFormGroup(labelText) {
        const group = document.createElement('div');
        group.className = 'form-group';
        const label = document.createElement('span');
        label.className = 'form-label';
        label.textContent = labelText;
        group.appendChild(label);
        return group;
    }

    function populateSettings(entity) {
        if (!entity) return;
        contentDef.innerHTML = '';

        // Name input
        const nameGroup = createFormGroup('名稱 (Name)');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'settings-input';
        nameInput.value = entity.name || '';
        nameInput.addEventListener('input', () => {
            const originalName = entity.name;
            entity.name = nameInput.value;
            triggerEntityUpdate(originalName);
        });
        nameGroup.appendChild(nameInput);
        contentDef.appendChild(nameGroup);

        // Kind dropdown
        const kindGroup = createFormGroup('類型 (Kind)');
        const kindSelect = document.createElement('select');
        kindSelect.className = 'settings-select';
        
        const standardKinds = ['class', 'interface', 'abstract', 'record', 'enum', 'bind', 'text'];
        const currentKind = entity.kind || 'class';
        if (!standardKinds.includes(currentKind)) {
            standardKinds.push(currentKind);
        }
        standardKinds.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            if (k === currentKind) opt.selected = true;
            kindSelect.appendChild(opt);
        });
        
        kindSelect.addEventListener('change', () => {
            entity.kind = kindSelect.value;
            triggerEntityUpdate(entity.name);
        });
        kindGroup.appendChild(kindSelect);
        contentDef.appendChild(kindGroup);

        // Fields list ("變數列表")
        if (entity.fields && entity.fields.length > 0) {
            const fieldsHeader = document.createElement('div');
            fieldsHeader.className = 'list-section-header';
            fieldsHeader.textContent = '變數列表 (Variables)';
            contentDef.appendChild(fieldsHeader);

            entity.fields.forEach((f, idx) => {
                const row = document.createElement('div');
                row.className = 'list-item-row';

                const fNameInput = document.createElement('input');
                fNameInput.type = 'text';
                fNameInput.className = 'settings-input';
                fNameInput.placeholder = '名稱';
                fNameInput.value = f.name || '';
                fNameInput.addEventListener('input', () => {
                    f.name = fNameInput.value;
                    triggerEntityUpdate(entity.name);
                });

                const fTypeInput = document.createElement('input');
                fTypeInput.type = 'text';
                fTypeInput.className = 'settings-input';
                fTypeInput.placeholder = '類型';
                fTypeInput.value = f.type || '';
                fTypeInput.addEventListener('input', () => {
                    f.type = fTypeInput.value;
                    triggerEntityUpdate(entity.name);
                });

                row.appendChild(fNameInput);
                row.appendChild(fTypeInput);
                contentDef.appendChild(row);
            });
        }

        // Methods list ("方法列表")
        if (entity.methods && entity.methods.length > 0) {
            const methodsHeader = document.createElement('div');
            methodsHeader.className = 'list-section-header';
            methodsHeader.textContent = '方法列表 (Methods)';
            contentDef.appendChild(methodsHeader);

            entity.methods.forEach((m, idx) => {
                const row = document.createElement('div');
                row.className = 'list-item-row';

                const mNameInput = document.createElement('input');
                mNameInput.type = 'text';
                mNameInput.className = 'settings-input';
                mNameInput.placeholder = '名稱';
                mNameInput.value = m.name || '';
                mNameInput.addEventListener('input', () => {
                    m.name = mNameInput.value;
                    triggerEntityUpdate(entity.name);
                });

                const mTypeInput = document.createElement('input');
                mTypeInput.type = 'text';
                mTypeInput.className = 'settings-input';
                mTypeInput.placeholder = '傳回值';
                mTypeInput.value = m.returnType || '';
                mTypeInput.addEventListener('input', () => {
                    m.returnType = mTypeInput.value;
                    triggerEntityUpdate(entity.name);
                });

                row.appendChild(mNameInput);
                row.appendChild(mTypeInput);
                contentDef.appendChild(row);
            });
        }
    }

    function triggerEntityUpdate(originalName) {
        if (!selectedEntity) return;
        document.dispatchEvent(new CustomEvent('planist-update-entity', {
            detail: {
                originalName: originalName,
                data: {
                    name: selectedEntity.name,
                    kind: selectedEntity.kind,
                    fields: selectedEntity.fields,
                    methods: selectedEntity.methods,
                    accessModifier: selectedEntity.accessModifier
                }
            }
        }));
    }

    function updateSlidersUI(h, s, l) {
        valH.textContent = h + '°';
        valS.textContent = s + '%';
        valL.textContent = l + '%';

        sliderH.value = h;
        sliderS.value = s;
        sliderL.value = l;

        // Update slider backgrounds dynamically to preview potential color shifts
        sliderS.style.background = 'linear-gradient(to right, hsl(' + h + ', 0%, ' + l + '%), hsl(' + h + ', 100%, ' + l + '%))';
        sliderL.style.background = 'linear-gradient(to right, hsl(' + h + ', ' + s + '%, 0%), hsl(' + h + ', ' + s + '%, 50%), hsl(' + h + ', ' + s + '%, 100%))';
    }

    // Sliders Event Handlers
    function handleSliderInput() {
        if (!selectedEntity) return;
        const h = parseInt(sliderH.value, 10);
        const s = parseInt(sliderS.value, 10);
        const l = parseInt(sliderL.value, 10);
        
        updateSlidersUI(h, s, l);

        // Update the board node visually in real-time
        const nodeCards = Array.from(document.querySelectorAll('.board-node'));
        const targetCard = nodeCards.find(card => {
            const titleEl = card.querySelector('.node-title');
            return titleEl && titleEl.textContent.trim() === selectedEntity.name;
        });
        if (targetCard) {
            targetCard.style.backgroundColor = 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
        }
    }

    function handleSliderChange() {
        if (!selectedEntity) return;
        const h = parseInt(sliderH.value, 10);
        const s = parseInt(sliderS.value, 10);
        const l = parseInt(sliderL.value, 10);
        const color = 'hsl(' + h + ', ' + s + '%, ' + l + '%)';

        // Save color permanently to file
        document.dispatchEvent(new CustomEvent('planist-update-entity-color', {
            detail: {
                entityName: selectedEntity.name,
                color: color
            }
        }));

        // Add to recent colors list
        if (!recentColors.includes(color)) {
            recentColors.unshift(color);
            if (recentColors.length > 10) {
                recentColors.pop();
            }
            renderRecentColors();
        }
    }

    [sliderH, sliderS, sliderL].forEach(slider => {
        slider.addEventListener('input', handleSliderInput);
        slider.addEventListener('change', handleSliderChange);
    });

    // Reset default color handler
    resetColorBtn.addEventListener('click', () => {
        if (!selectedEntity) return;
        
        // Remove style override from board node
        const nodeCards = Array.from(document.querySelectorAll('.board-node'));
        const targetCard = nodeCards.find(card => {
            const titleEl = card.querySelector('.node-title');
            return titleEl && titleEl.textContent.trim() === selectedEntity.name;
        });
        if (targetCard) {
            targetCard.style.backgroundColor = '';
        }

        // Post message to clear from file
        document.dispatchEvent(new CustomEvent('planist-update-entity-color', {
            detail: {
                entityName: selectedEntity.name,
                color: null
            }
        }));
    });

    // Dynamically manage color context menu to keep markup modular
    let colorContextMenu = document.getElementById('color-context-menu');
    if (!colorContextMenu) {
        colorContextMenu = document.createElement('div');
        colorContextMenu.id = 'color-context-menu';
        colorContextMenu.className = 'color-context-menu';
        colorContextMenu.style.position = 'fixed';
        colorContextMenu.style.display = 'none';
        colorContextMenu.style.zIndex = '1000';
        colorContextMenu.style.background = '#1e1e24';
        colorContextMenu.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        colorContextMenu.style.borderRadius = '4px';
        colorContextMenu.style.padding = '4px 0';
        colorContextMenu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
        
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '刪除';
        deleteItem.style.padding = '8px 16px';
        deleteItem.style.cursor = 'pointer';
        deleteItem.style.color = '#ef4444';
        deleteItem.style.fontSize = '13px';
        deleteItem.addEventListener('mouseenter', () => {
            deleteItem.style.background = 'rgba(239, 68, 68, 0.1)';
        });
        deleteItem.addEventListener('mouseleave', () => {
            deleteItem.style.background = 'transparent';
        });
        
        deleteItem.addEventListener('click', (evt) => {
            evt.stopPropagation();
            if (selectedRecentColor) {
                recentColors = recentColors.filter(c => c !== selectedRecentColor);
                selectedRecentColor = null;
                renderRecentColors();
            }
            colorContextMenu.style.display = 'none';
        });
        
        colorContextMenu.appendChild(deleteItem);
        document.body.appendChild(colorContextMenu);
    }

    // Global click listener to dismiss context menu
    document.addEventListener('click', () => {
        if (colorContextMenu) {
            colorContextMenu.style.display = 'none';
        }
    });

    // Global keydown listener for Delete key color removal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedRecentColor) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return; // ignore if typing in inputs
            }
            recentColors = recentColors.filter(c => c !== selectedRecentColor);
            selectedRecentColor = null;
            renderRecentColors();
        }
    });

    function renderRecentColors() {
        recentColorsContainer.innerHTML = '';
        recentColors.forEach(color => {
            const circle = document.createElement('div');
            circle.className = 'recent-color-circle';
            if (color === selectedRecentColor) {
                circle.classList.add('selected');
            }
            circle.style.backgroundColor = color;
            
            // Left click to select and apply color
            circle.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedRecentColor = color;
                renderRecentColors();

                if (!selectedEntity) return;
                const match = color.match(/hsl\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)%\\s*,\\s*(\\d+)%\\s*\\)/i);
                if (match) {
                    const h = parseInt(match[1], 10);
                    const s = parseInt(match[2], 10);
                    const l = parseInt(match[3], 10);
                    
                    updateSlidersUI(h, s, l);
                    
                    const nodeCards = Array.from(document.querySelectorAll('.board-node'));
                    const targetCard = nodeCards.find(card => {
                        const titleEl = card.querySelector('.node-title');
                        return titleEl && titleEl.textContent.trim() === selectedEntity.name;
                    });
                    if (targetCard) {
                        targetCard.style.backgroundColor = color;
                    }
                    
                    document.dispatchEvent(new CustomEvent('planist-update-entity-color', {
                        detail: {
                            entityName: selectedEntity.name,
                            color: color
                        }
                    }));
                }
            });
            
            // Right click to select color and show context menu
            circle.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                selectedRecentColor = color;
                renderRecentColors();
                
                colorContextMenu.style.left = e.clientX + 'px';
                colorContextMenu.style.top = e.clientY + 'px';
                colorContextMenu.style.display = 'block';
            });

            recentColorsContainer.appendChild(circle);
        });
    }

    // Initialize recent colors list
    renderRecentColors();
})();
`;