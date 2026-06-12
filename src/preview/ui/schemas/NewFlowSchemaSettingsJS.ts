// @state: red
export const NewFlowSchemaSettingsJS = `
(function() {
    console.log('====== Planist Visualizer Node Settings Panel Core Activated ======');
    let selectedEntity = null;
    let allEntitiesList = [];
    let recentColors = [];
    let selectedRecentColor = null;

    // DOM Elements
    const settingsPanel = document.getElementById('settings-panel');
    const closeBtn = document.getElementById('close-settings-btn');
    const tabDef = document.getElementById('tab-definition');
    const tabRelations = document.getElementById('tab-relations');
    const tabRender = document.getElementById('tab-rendering');
    
    const contentDef = document.getElementById('settings-content-definition');
    const contentRelations = document.getElementById('settings-content-relations');
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
    tabRelations.addEventListener('click', () => switchTab('relations'));
    tabRender.addEventListener('click', () => switchTab('rendering'));

    function switchTab(tab) {
        const tabs = [
            { id: 'definition', tabEl: tabDef, contentEl: contentDef },
            { id: 'relations', tabEl: tabRelations, contentEl: contentRelations },
            { id: 'rendering', tabEl: tabRender, contentEl: contentRender }
        ];
        
        tabs.forEach(t => {
            if (t.tabEl && t.contentEl) {
                if (t.id === tab) {
                    t.tabEl.classList.add('active');
                    t.contentEl.style.display = 'flex';
                } else {
                    t.tabEl.classList.remove('active');
                    t.contentEl.style.display = 'none';
                }
            }
        });
    }

    // Listen to node selection custom events from board visualizer
    document.addEventListener('planist-node-selected', (e) => {
        selectedEntity = e.detail.entity;
        allEntitiesList = e.detail.allEntities || [];
        populateSettings(selectedEntity);
        populateRelations(selectedEntity);
        
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
            populateSettings(entity); // Re-populate based on new kind
        });
        kindGroup.appendChild(kindSelect);
        contentDef.appendChild(kindGroup);

        const kind = entity.kind || 'class';

        // Kind 1: text flow description -> Text Area
        if (kind === 'text') {
            const textGroup = createFormGroup('文字描述主體 (Text Body)');
            const textTextarea = document.createElement('textarea');
            textTextarea.className = 'settings-input';
            textTextarea.style.minHeight = '150px';
            textTextarea.style.fontFamily = 'monospace';
            textTextarea.style.resize = 'vertical';
            textTextarea.value = entity.textBody || '';
            textTextarea.addEventListener('input', () => {
                entity.textBody = textTextarea.value;
                triggerEntityUpdate(entity.name);
            });
            textGroup.appendChild(textTextarea);
            contentDef.appendChild(textGroup);
            return;
        }

        // Kind 2: bind -> File Path Input
        if (kind === 'bind') {
            const bindGroup = createFormGroup('綁定檔案路徑 (Bind File Path)');
            const bindInput = document.createElement('input');
            bindInput.type = 'text';
            bindInput.className = 'settings-input';
            bindInput.placeholder = '例如: src/User.ts';
            bindInput.value = entity.bindSourcePath || '';
            bindInput.addEventListener('input', () => {
                entity.bindSourcePath = bindInput.value;
                triggerEntityUpdate(entity.name);
            });
            bindGroup.appendChild(bindInput);
            contentDef.appendChild(bindGroup);
            return;
        }

        // Kind 3: OO Entities & Enum -> Fields & Methods Editor
        if (kind !== 'interface') {
            const fieldsHeader = document.createElement('div');
            fieldsHeader.className = 'list-section-header';
            fieldsHeader.innerHTML = '<span>變數列表 (Variables)</span>';
            
            const addFieldBtn = document.createElement('button');
            addFieldBtn.className = 'add-btn';
            addFieldBtn.style.marginTop = '0';
            addFieldBtn.style.padding = '2px 8px';
            addFieldBtn.textContent = '+ 新增';
            addFieldBtn.addEventListener('click', () => {
                if (!entity.fields) entity.fields = [];
                entity.fields.push({ name: 'newField', type: kind === 'enum' ? '' : 'string' });
                populateSettings(entity);
                triggerEntityUpdate(entity.name);
            });
            fieldsHeader.appendChild(addFieldBtn);
            contentDef.appendChild(fieldsHeader);

            const fieldsList = entity.fields || [];
            fieldsList.forEach((f, idx) => {
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
                row.appendChild(fNameInput);

                if (kind !== 'enum') {
                    const fTypeInput = document.createElement('input');
                    fTypeInput.type = 'text';
                    fTypeInput.className = 'settings-input';
                    fTypeInput.placeholder = '類型';
                    fTypeInput.value = f.type || '';
                    fTypeInput.addEventListener('input', () => {
                        f.type = fTypeInput.value;
                        triggerEntityUpdate(entity.name);
                    });
                    row.appendChild(fTypeInput);
                }

                // Delete Button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerHTML = '&times;';
                deleteBtn.title = '刪除此變數';
                deleteBtn.addEventListener('click', () => {
                    entity.fields.splice(idx, 1);
                    populateSettings(entity);
                    triggerEntityUpdate(entity.name);
                });
                row.appendChild(deleteBtn);

                contentDef.appendChild(row);
            });
        }

        // Methods list editor
        const methodsHeader = document.createElement('div');
        methodsHeader.className = 'list-section-header';
        methodsHeader.innerHTML = '<span>方法列表 (Methods)</span>';
        
        const addMethodBtn = document.createElement('button');
        addMethodBtn.className = 'add-btn';
        addMethodBtn.style.marginTop = '0';
        addMethodBtn.style.padding = '2px 8px';
        addMethodBtn.textContent = '+ 新增';
        addMethodBtn.addEventListener('click', () => {
            if (!entity.methods) entity.methods = [];
            entity.methods.push({ name: 'newMethod', returnType: 'void' });
            populateSettings(entity);
            triggerEntityUpdate(entity.name);
        });
        methodsHeader.appendChild(addMethodBtn);
        contentDef.appendChild(methodsHeader);

        const methodsList = entity.methods || [];
        methodsList.forEach((m, idx) => {
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
            row.appendChild(mNameInput);

            const mTypeInput = document.createElement('input');
            mTypeInput.type = 'text';
            mTypeInput.className = 'settings-input';
            mTypeInput.placeholder = '傳回值';
            mTypeInput.value = m.returnType || '';
            mTypeInput.addEventListener('input', () => {
                m.returnType = mTypeInput.value;
                triggerEntityUpdate(entity.name);
            });
            row.appendChild(mTypeInput);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = '刪除此方法';
            deleteBtn.addEventListener('click', () => {
                entity.methods.splice(idx, 1);
                populateSettings(entity);
                triggerEntityUpdate(entity.name);
            });
            row.appendChild(deleteBtn);

            contentDef.appendChild(row);
        });
    }

    function populateRelations(entity) {
        if (!entity) return;
        contentRelations.innerHTML = '';

        const relationsHeader = document.createElement('div');
        relationsHeader.className = 'list-section-header';
        relationsHeader.innerHTML = '<span>關聯清單 (Relations)</span>';
        
        const addRelationBtn = document.createElement('button');
        addRelationBtn.className = 'add-btn';
        addRelationBtn.style.marginTop = '0';
        addRelationBtn.style.padding = '2px 8px';
        addRelationBtn.textContent = '+ 新增關聯';
        addRelationBtn.addEventListener('click', () => {
            const targetCandidate = allEntitiesList.find(e => e.name !== entity.name);
            if (!targetCandidate) {
                alert('無其他實體可建立關聯！');
                return;
            }
            if (!entity.associatesTargets) entity.associatesTargets = [];
            entity.associatesTargets.push(targetCandidate.name);
            populateRelations(entity);
            triggerEntityUpdate(entity.name);
        });
        relationsHeader.appendChild(addRelationBtn);
        contentRelations.appendChild(relationsHeader);

        // Collect all outgoing relations
        const relations = [];
        const relationKeys = [
            { key: 'extendsTargets', type: 'extends' },
            { key: 'inheritsTargets', type: 'inherits' },
            { key: 'implementsTargets', type: 'implements' },
            { key: 'associatesTargets', type: 'associates' },
            { key: 'aggregatesTargets', type: 'aggregates' },
            { key: 'composesTargets', type: 'composes' },
            { key: 'dependsOnTargets', type: 'dependsOn' }
        ];

        relationKeys.forEach(rel => {
            const targets = entity[rel.key] || [];
            targets.forEach((target, index) => {
                relations.push({
                    key: rel.key,
                    type: rel.type,
                    target: target,
                    index: index
                });
            });
        });

        if (relations.length === 0) {
            const emptyTip = document.createElement('div');
            emptyTip.style.fontStyle = 'italic';
            emptyTip.style.color = 'var(--vscode-sideBar-foreground, rgba(0,0,0,0.4))';
            emptyTip.style.padding = '10px 0';
            emptyTip.textContent = '目前無任何指出的關聯線。';
            contentRelations.appendChild(emptyTip);
            return;
        }

        relations.forEach(rel => {
            const row = document.createElement('div');
            row.className = 'list-item-row';

            // Relation Type Select
            const typeSelect = document.createElement('select');
            typeSelect.className = 'settings-select';
            typeSelect.style.flex = '1';
            relationKeys.forEach(rk => {
                const opt = document.createElement('option');
                opt.value = rk.type;
                opt.textContent = rk.type;
                if (rk.type === rel.type) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.addEventListener('change', () => {
                const newType = typeSelect.value;
                const newKey = relationKeys.find(rk => rk.type === newType).key;
                
                // Remove from old
                entity[rel.key].splice(rel.index, 1);
                
                // Add to new
                if (!entity[newKey]) entity[newKey] = [];
                entity[newKey].push(rel.target);
                
                populateRelations(entity);
                triggerEntityUpdate(entity.name);
            });
            row.appendChild(typeSelect);

            // Target Node Select
            const targetSelect = document.createElement('select');
            targetSelect.className = 'settings-select';
            targetSelect.style.flex = '1.2';
            allEntitiesList.forEach(ent => {
                if (ent.name === entity.name) return; // Cannot connect to self
                const opt = document.createElement('option');
                opt.value = ent.name;
                opt.textContent = ent.name;
                if (ent.name === rel.target) opt.selected = true;
                targetSelect.appendChild(opt);
            });
            targetSelect.addEventListener('change', () => {
                entity[rel.key][rel.index] = targetSelect.value;
                triggerEntityUpdate(entity.name);
            });
            row.appendChild(targetSelect);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = '刪除此關聯';
            deleteBtn.addEventListener('click', () => {
                entity[rel.key].splice(rel.index, 1);
                populateRelations(entity);
                triggerEntityUpdate(entity.name);
            });
            row.appendChild(deleteBtn);

            contentRelations.appendChild(row);
        });
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
                    accessModifier: selectedEntity.accessModifier,
                    bindSourcePath: selectedEntity.bindSourcePath,
                    bindTargetEntity: selectedEntity.bindTargetEntity,
                    textBody: selectedEntity.textBody,
                    
                    extendsTargets: selectedEntity.extendsTargets,
                    implementsTargets: selectedEntity.implementsTargets,
                    inheritsTargets: selectedEntity.inheritsTargets,
                    associatesTargets: selectedEntity.associatesTargets,
                    aggregatesTargets: selectedEntity.aggregatesTargets,
                    composesTargets: selectedEntity.composesTargets,
                    dependsOnTargets: selectedEntity.dependsOnTargets,
                    relationTargets: selectedEntity.relationTargets
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

        sliderS.style.background = 'linear-gradient(to right, hsl(' + h + ', 0%, ' + l + '%), hsl(' + h + ', 100%, ' + l + '%))';
        sliderL.style.background = 'linear-gradient(to right, hsl(' + h + ', ' + s + '%, 0%), hsl(' + h + ', ' + s + '%, 50%), hsl(' + h + ', ' + s + '%, 100%))';
    }

    function handleSliderInput() {
        if (!selectedEntity) return;
        const h = parseInt(sliderH.value, 10);
        const s = parseInt(sliderS.value, 10);
        const l = parseInt(sliderL.value, 10);
        
        updateSlidersUI(h, s, l);

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

        document.dispatchEvent(new CustomEvent('planist-update-entity-color', {
            detail: {
                entityName: selectedEntity.name,
                color: color
            }
        }));

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

    resetColorBtn.addEventListener('click', () => {
        if (!selectedEntity) return;
        
        const nodeCards = Array.from(document.querySelectorAll('.board-node'));
        const targetCard = nodeCards.find(card => {
            const titleEl = card.querySelector('.node-title');
            return titleEl && titleEl.textContent.trim() === selectedEntity.name;
        });
        if (targetCard) {
            targetCard.style.backgroundColor = '';
        }

        document.dispatchEvent(new CustomEvent('planist-update-entity-color', {
            detail: {
                entityName: selectedEntity.name,
                color: null
            }
        }));
    });

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

    document.addEventListener('click', () => {
        if (colorContextMenu) {
            colorContextMenu.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedRecentColor) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
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

    renderRecentColors();
})();
`;