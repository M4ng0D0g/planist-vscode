// @state: red
export const DocsSchemaJS = String.raw`
(function() {
    const vscode = acquireVsCodeApi();
    let localPages = [];
    let activeTab = 'dir';
    let activePageIndex = 0;

    let rawDocText = '';
    let currentMode = 'render';
    let isReadonly = false;
    let currentFontFamily = 'sans-serif';
    let isFullWidth = false;
    let themeOverride = 'system';
    let isSnapping = false;

    const docTitle = document.getElementById('doc-title');
    const tabDir = document.getElementById('tab-dir');
    const tabOutline = document.getElementById('tab-outline');
    const sidebarList = document.getElementById('sidebar-list');
    const scrollContainer = document.getElementById('content-viewport');
    const docsContainer = document.getElementById('document-scroll-container');
    const addPageBtn = document.getElementById('add-page-btn');

    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const modeRenderBtn = document.getElementById('mode-render-btn');
    const modeSourceBtn = document.getElementById('mode-source-btn');
    const readonlyBtn = document.getElementById('readonly-btn');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fullWidthBtn = document.getElementById('full-width-btn');
    const themeOverrideBtn = document.getElementById('theme-override-btn');
    
    const rawEditorContainer = document.getElementById('raw-editor-container');
    const rawEditorTextarea = document.getElementById('raw-editor-textarea');
    const appContainer = document.getElementById('app-container');

    const styleBtn = document.getElementById('style-btn');
    const styleMenu = document.getElementById('style-menu');
    const formatToolbar = document.getElementById('format-toolbar');
    const colorBtn = document.getElementById('color-btn');
    const colorDropdown = document.getElementById('color-dropdown');
    const highlightBtn = document.getElementById('highlight-btn');
    const highlightDropdown = document.getElementById('highlight-dropdown');

    const colors = [
        { name: 'Red', hex: '#ef4444' },
        { name: 'Orange', hex: '#f97316' },
        { name: 'Yellow', hex: '#eab308' },
        { name: 'Green', hex: '#22c55e' },
        { name: 'Blue', hex: '#3b82f6' },
        { name: 'Purple', hex: '#a855f7' },
        { name: 'Default', hex: '#71717a' }
    ];

    const highlights = [
        { name: 'Red', hex: '#fee2e2' },
        { name: 'Orange', hex: '#ffedd5' },
        { name: 'Yellow', hex: '#fef9c3' },
        { name: 'Green', hex: '#dcfce7' },
        { name: 'Blue', hex: '#dbeafe' },
        { name: 'Purple', hex: '#f3e8ff' },
        { name: 'Gray', hex: '#f4f4f5' }
    ];

    tabDir.addEventListener('click', function() {
        activeTab = 'dir';
        tabDir.classList.add('active');
        tabOutline.classList.remove('active');
        renderSidebar();
    });

    tabOutline.addEventListener('click', function() {
        activeTab = 'outline';
        tabOutline.classList.add('active');
        tabDir.classList.remove('active');
        renderSidebar();
    });

    addPageBtn.addEventListener('click', function() {
        vscode.postMessage({ command: 'addDocsPage' });
    });

    window.addEventListener('message', function(event) {
        const message = event.data;
        if (message.command === 'updateSchemaData' && message.schema === 'docs') {
            docTitle.textContent = message.data.docName || 'Untitled Document';
            localPages = Array.isArray(message.data.pages) ? message.data.pages : [];
            rawDocText = message.text || '';
            if (activePageIndex >= localPages.length) {
                activePageIndex = Math.max(localPages.length - 1, 0);
            }
            renderSidebar();
            
            // Avoid re-rendering pages if currently editing to preserve cursor position
            const activeEl = document.activeElement;
            const isEditing = activeEl && (activeEl.classList.contains('editor-title-input') || activeEl.classList.contains('editor-textarea'));
            if (!isEditing) {
                renderPages();
            }
        }
    });

    // Toolbar Event Listeners
    toggleSidebarBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
    });

    modeSourceBtn.addEventListener('click', function() {
        if (currentMode === 'render') {
            currentMode = 'source';
            modeSourceBtn.classList.add('active');
            modeRenderBtn.classList.remove('active');
            modeSourceBtn.setAttribute('aria-selected', 'true');
            modeRenderBtn.setAttribute('aria-selected', 'false');
            appContainer.style.display = 'none';
            rawEditorContainer.style.display = 'block';
            rawEditorTextarea.value = rawDocText;
        }
    });

    modeRenderBtn.addEventListener('click', function() {
        if (currentMode === 'source') {
            currentMode = 'render';
            modeRenderBtn.classList.add('active');
            modeSourceBtn.classList.remove('active');
            modeRenderBtn.setAttribute('aria-selected', 'true');
            modeSourceBtn.setAttribute('aria-selected', 'false');
            rawEditorContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            rawDocText = rawEditorTextarea.value;
            vscode.postMessage({ command: 'updateRawText', text: rawDocText });
        }
    });

    readonlyBtn.addEventListener('click', function() {
        isReadonly = !isReadonly;
        const icon = document.getElementById('readonly-icon');
        if (isReadonly) {
            if (icon) icon.textContent = '🔒';
            readonlyBtn.title = '唯讀模式，點擊切換為編輯模式';
        } else {
            if (icon) icon.textContent = '🔓';
            readonlyBtn.title = '編輯模式，點擊切換為唯讀模式';
        }
        renderSidebar();
        renderPages();
    });

    fontFamilySelect.addEventListener('change', function() {
        currentFontFamily = fontFamilySelect.value;
        let fontVal = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        if (currentFontFamily === 'serif') {
            fontVal = 'Georgia, "Times New Roman", serif';
        } else if (currentFontFamily === 'monospace') {
            fontVal = 'ui-monospace, SFMono-Regular, Consolas, monospace';
        } else if (currentFontFamily === 'system-ui') {
            fontVal = 'system-ui, sans-serif';
        }
        document.documentElement.style.setProperty('--paper-font-family', fontVal);
    });

    fullWidthBtn.addEventListener('click', function() {
        isFullWidth = !isFullWidth;
        if (isFullWidth) {
            fullWidthBtn.textContent = '全寬模式';
            document.documentElement.style.setProperty('--paper-width', '95%');
        } else {
            fullWidthBtn.textContent = 'A4 比例';
            document.documentElement.style.setProperty('--paper-width', '794px');
        }
    });

    themeOverrideBtn.addEventListener('click', function() {
        if (themeOverride === 'system') {
            themeOverride = 'light';
            themeOverrideBtn.textContent = '主題：強制淺色';
            document.documentElement.style.setProperty('--theme-paper-bg', '#ffffff');
            document.documentElement.style.setProperty('--theme-paper-text', '#202124');
            document.documentElement.style.setProperty('--theme-paper-border', '#d4d4d8');
        } else if (themeOverride === 'light') {
            themeOverride = 'dark';
            themeOverrideBtn.textContent = '主題：強制深色';
            document.documentElement.style.setProperty('--theme-paper-bg', '#1e1e1e');
            document.documentElement.style.setProperty('--theme-paper-text', '#e5e7eb');
            document.documentElement.style.setProperty('--theme-paper-border', 'rgba(255,255,255,0.15)');
        } else {
            themeOverride = 'system';
            themeOverrideBtn.textContent = '主題：跟隨系統';
            document.documentElement.style.setProperty('--theme-paper-bg', 'var(--paper-bg)');
            document.documentElement.style.setProperty('--theme-paper-text', 'var(--paper-text)');
            document.documentElement.style.setProperty('--theme-paper-border', 'var(--paper-border)');
        }
    });

    // Color Pickers Swatches Generation
    colors.forEach(function(c) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = c.hex;
        swatch.title = c.name;
        swatch.addEventListener('mousedown', function(e) {
            e.preventDefault();
            applyStyleToSelection('<span style="color:' + c.hex + '">', '</span>', false);
            colorDropdown.classList.remove('open');
        });
        colorDropdown.appendChild(swatch);
    });
    // Clear swatch
    const clearTextSwatch = document.createElement('div');
    clearTextSwatch.className = 'color-swatch clear-swatch';
    clearTextSwatch.title = '清除文字顏色';
    clearTextSwatch.textContent = '❌';
    clearTextSwatch.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList.contains('editor-textarea')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            const text = activeEl.value;
            const selectedText = text.substring(start, end);
            const stripped = selectedText.replace(/<span style="color:[^>]+">([\s\S]*?)<\/span>/gi, '$1');
            activeEl.focus();
            activeEl.setRangeText(stripped, start, end, 'select');
            const event = new Event('input', { bubbles: true });
            activeEl.dispatchEvent(event);
        }
        colorDropdown.classList.remove('open');
    });
    colorDropdown.appendChild(clearTextSwatch);

    highlights.forEach(function(h) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = h.hex;
        swatch.title = h.name;
        swatch.addEventListener('mousedown', function(e) {
            e.preventDefault();
            applyStyleToSelection('<mark style="background-color:' + h.hex + '">', '</mark>', false);
            highlightDropdown.classList.remove('open');
        });
        highlightDropdown.appendChild(swatch);
    });
    // Clear highlight swatch
    const clearHighlightSwatch = document.createElement('div');
    clearHighlightSwatch.className = 'color-swatch clear-swatch';
    clearHighlightSwatch.title = '清除螢光筆';
    clearHighlightSwatch.textContent = '❌';
    clearHighlightSwatch.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList.contains('editor-textarea')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            const text = activeEl.value;
            const selectedText = text.substring(start, end);
            let stripped = selectedText.replace(/<mark style="background-color:[^>]+">([\s\S]*?)<\/mark>/gi, '$1');
            stripped = stripped.replace(/<span style="background-color:[^>]+">([\s\S]*?)<\/span>/gi, '$1');
            activeEl.focus();
            activeEl.setRangeText(stripped, start, end, 'select');
            const event = new Event('input', { bubbles: true });
            activeEl.dispatchEvent(event);
        }
        highlightDropdown.classList.remove('open');
    });
    highlightDropdown.appendChild(clearHighlightSwatch);

    // Dropdowns toggling
    colorBtn.addEventListener('mousedown', function(e) {
        e.preventDefault();
        colorDropdown.classList.toggle('open');
        highlightDropdown.classList.remove('open');
    });

    highlightBtn.addEventListener('mousedown', function(e) {
        e.preventDefault();
        highlightDropdown.classList.toggle('open');
        colorDropdown.classList.remove('open');
    });

    styleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        styleMenu.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
        if (styleMenu && styleBtn && !styleMenu.contains(e.target) && !styleBtn.contains(e.target)) {
            styleMenu.classList.remove('open');
        }
        if (colorDropdown && colorBtn && !colorDropdown.contains(e.target) && !colorBtn.contains(e.target)) {
            colorDropdown.classList.remove('open');
        }
        if (highlightDropdown && highlightBtn && !highlightDropdown.contains(e.target) && !highlightBtn.contains(e.target)) {
            highlightDropdown.classList.remove('open');
        }
    });

    // Formatting bindings
    document.getElementById('format-h1').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('# ', '', true);
    });
    document.getElementById('format-h2').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('## ', '', true);
    });
    document.getElementById('format-h3').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('### ', '', true);
    });
    document.getElementById('format-bold').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('**', '**', false);
    });
    document.getElementById('format-italic').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('*', '*', false);
    });
    document.getElementById('format-underline').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('<u>', '</u>', false);
    });
    document.getElementById('format-strike').addEventListener('mousedown', function(e) {
        e.preventDefault();
        applyStyleToSelection('~~', '~~', false);
    });

    // Selection checking
    document.addEventListener('selectionchange', function() {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList.contains('editor-textarea')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            if (start !== end) {
                formatToolbar.classList.add('visible');
                detectSelectionFormat();
                return;
            }
        }
        const activeElInToolbar = activeEl && (activeEl.closest('#format-toolbar') || activeEl.closest('.picker-dropdown') || activeEl.closest('.dropdown-menu'));
        if (!activeElInToolbar) {
            formatToolbar.classList.remove('visible');
        }
    });

    // Debounced VS Code document updates
    let updateTimeout = null;
    function debouncedUpdate(pageIndex, updates) {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(function() {
            vscode.postMessage({
                command: 'updateDocsPage',
                pageIndex: pageIndex,
                updates: updates
            });
        }, 300);
    }

    // @state: green
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // @state: red
    function parseInlineMarkdown(text) {
        let escaped = escapeHtml(text);
        escaped = escaped
            .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi, '<u>$1</u>')
            .replace(/&lt;del&gt;([\s\S]*?)&lt;\/del&gt;/gi, '<del>$1</del>')
            .replace(/&lt;s&gt;([\s\S]*?)&lt;\/s&gt;/gi, '<s>$1</s>')
            .replace(/&lt;span style=&quot;color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+);?&quot;&gt;([\s\S]*?)&lt;\/span&gt;/gi, '<span style="color:$1">$2</span>')
            .replace(/&lt;span style=&quot;background-color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+);?&quot;&gt;([\s\S]*?)&lt;\/span&gt;/gi, '<span style="background-color:$1">$2</span>')
            .replace(/&lt;mark style=&quot;background-color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+);?&quot;&gt;([\s\S]*?)&lt;\/mark&gt;/gi, '<mark style="background-color:$1">$2</mark>')
            .replace(/&lt;mark&gt;([\s\S]*?)&lt;\/mark&gt;/gi, '<mark>$1</mark>');

        return escaped
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/\`(.+?)\`/g, '<code>$1</code>')
            .replace(/~~(.+?)~~/g, '<del>$1</del>');
    }

    // @state: green
    function closeOpenBlocks(state, html) {
        if (state.inList) {
            html.push('</ul>');
            state.inList = false;
        }
        if (state.inOrderedList) {
            html.push('</ol>');
            state.inOrderedList = false;
        }
        if (state.inQuote) {
            html.push('</blockquote>');
            state.inQuote = false;
        }
    }

    // @state: green
    function parseMarkdown(text) {
        const lines = String(text || '').split('\n');
        const html = [];
        const state = {
            inList: false,
            inOrderedList: false,
            inQuote: false
        };

        lines.forEach(function(line) {
            const trimmed = line.trim();
            const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/);
            const orderedMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);

            if (unorderedMatch) {
                if (state.inOrderedList) {
                    html.push('</ol>');
                    state.inOrderedList = false;
                }
                if (!state.inList) {
                    html.push('<ul>');
                    state.inList = true;
                }
                html.push('<li>' + parseInlineMarkdown(unorderedMatch[1]) + '</li>');
                return;
            }

            if (orderedMatch) {
                if (state.inList) {
                    html.push('</ul>');
                    state.inList = false;
                }
                if (!state.inOrderedList) {
                    html.push('<ol>');
                    state.inOrderedList = true;
                }
                html.push('<li>' + parseInlineMarkdown(orderedMatch[1]) + '</li>');
                return;
            }

            if (state.inList || state.inOrderedList) {
                if (state.inList) html.push('</ul>');
                if (state.inOrderedList) html.push('</ol>');
                state.inList = false;
                state.inOrderedList = false;
            }

            if (trimmed.startsWith('>')) {
                if (!state.inQuote) {
                    html.push('<blockquote>');
                    state.inQuote = true;
                }
                html.push('<p>' + parseInlineMarkdown(trimmed.substring(1).trim()) + '</p>');
                return;
            }

            if (state.inQuote) {
                html.push('</blockquote>');
                state.inQuote = false;
            }

            if (trimmed.startsWith('### ')) {
                html.push('<h3>' + parseInlineMarkdown(trimmed.substring(4)) + '</h3>');
            } else if (trimmed.startsWith('## ')) {
                html.push('<h2>' + parseInlineMarkdown(trimmed.substring(3)) + '</h2>');
            } else if (trimmed.startsWith('# ')) {
                html.push('<h1>' + parseInlineMarkdown(trimmed.substring(2)) + '</h1>');
            } else if (trimmed === '') {
                html.push('<p></p>');
            } else {
                html.push('<p>' + parseInlineMarkdown(line) + '</p>');
            }
        });

        closeOpenBlocks(state, html);
        return html.join('\n');
    }

    // @state: green
    function visiblePageIndexes() {
        return localPages
            .map(function(page, idx) {
                return { page: page, idx: idx };
            })
            .filter(function(entry) {
                return activeTab !== 'outline' || entry.page.isOutline;
            });
    }

    // @state: red
    function renderSidebar() {
        sidebarList.innerHTML = '';
        const entries = visiblePageIndexes();

        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'sidebar-empty';
            empty.textContent = activeTab === 'outline' ? 'No outline pages' : 'No pages';
            sidebarList.appendChild(empty);
            return;
        }

        entries.forEach(function(entry) {
            const page = entry.page;
            const idx = entry.idx;
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'sidebar-item' + (idx === activePageIndex ? ' active' : '');
            item.setAttribute('data-index', String(idx));

            const pageNumber = document.createElement('span');
            pageNumber.className = 'sidebar-page-number';
            pageNumber.textContent = String(idx + 1);
            item.appendChild(pageNumber);

            const titleSpan = document.createElement('span');
            titleSpan.className = 'sidebar-item-title';
            titleSpan.textContent = page.title || 'Page ' + (idx + 1);
            item.appendChild(titleSpan);

            const outlineIndicator = document.createElement('button');
            outlineIndicator.type = 'button';
            outlineIndicator.className = 'outline-toggle' + (page.isOutline ? ' active' : '');
            outlineIndicator.title = page.isOutline ? 'Remove from outline' : 'Add to outline';
            outlineIndicator.textContent = page.isOutline ? 'O' : '+';
            outlineIndicator.addEventListener('click', function(e) {
                e.stopPropagation();
                vscode.postMessage({
                    command: 'updateDocsPage',
                    pageIndex: idx,
                    updates: { isOutline: !page.isOutline }
                });
            });
            outlineIndicator.style.display = isReadonly ? 'none' : 'inline-block';
            item.appendChild(outlineIndicator);

            const deleteIndicator = document.createElement('button');
            deleteIndicator.type = 'button';
            deleteIndicator.className = 'delete-page-btn';
            deleteIndicator.title = '刪除此頁';
            deleteIndicator.textContent = '❌';
            deleteIndicator.style.display = isReadonly ? 'none' : 'inline-block';
            deleteIndicator.addEventListener('click', function(e) {
                e.stopPropagation();
                if (confirm('確定要刪除此頁嗎？')) {
                    vscode.postMessage({
                        command: 'deleteDocsPage',
                        pageIndex: idx
                    });
                }
            });
            item.appendChild(deleteIndicator);

            item.addEventListener('click', function() {
                scrollToPage(idx);
            });

            sidebarList.appendChild(item);
        });
        addPageBtn.style.display = isReadonly ? 'none' : 'block';
    }

    // @state: red
    function scrollToPage(index) {
        if (index < 0 || index >= localPages.length) return;
        const sheet = document.getElementById('page-sheet-' + index);
        if (sheet) {
            activePageIndex = index;
            isSnapping = true;
            sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
            renderSidebar();
            setTimeout(function() {
                isSnapping = false;
            }, 600);
        }
    }

    // @state: red
    function renderPages() {
        docsContainer.innerHTML = '';

        localPages.forEach(function(page, idx) {
            const sheet = document.createElement('section');
            sheet.className = 'paper-page';
            sheet.id = 'page-sheet-' + idx;
            sheet.setAttribute('data-index', String(idx));

            if (isReadonly) {
                renderPreview(sheet, page, idx);
            } else {
                renderEditor(sheet, page, idx);
            }

            docsContainer.appendChild(sheet);
        });
    }

    // @state: red
    function renderEditor(sheet, page, idx) {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'editor-title-input';
        titleInput.value = page.title || '';
        titleInput.placeholder = '頁面標題';
        titleInput.addEventListener('input', function() {
            page.title = titleInput.value;
            const sidebarTitle = document.querySelector('.sidebar-item[data-index="' + idx + '"] .sidebar-item-title');
            if (sidebarTitle) {
                sidebarTitle.textContent = titleInput.value || 'Page ' + (idx + 1);
            }
            debouncedUpdate(idx, { title: titleInput.value });
        });
        sheet.appendChild(titleInput);

        const textarea = document.createElement('textarea');
        textarea.className = 'editor-textarea';
        textarea.value = page.content || '';
        textarea.placeholder = '在此輸入 Markdown 內容...';
        
        textarea.addEventListener('input', function() {
            page.content = textarea.value;
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            debouncedUpdate(idx, { content: textarea.value });
        });
        sheet.appendChild(textarea);

        // Auto grow initially
        setTimeout(function() {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }, 0);
    }

    // @state: red
    function renderPreview(sheet, page, idx) {
        const body = document.createElement('div');
        body.className = 'markdown-body';
        body.innerHTML = parseMarkdown(page.content || '');
        sheet.appendChild(body);

        const pageNum = document.createElement('div');
        pageNum.className = 'page-number-hud';
        pageNum.textContent = String(idx + 1);
        sheet.appendChild(pageNum);
    }

    // @state: red
    function applyStyleToSelection(prefix, suffix, isBlock) {
        const activeEl = document.activeElement;
        if (!activeEl || !activeEl.classList.contains('editor-textarea')) return;
        
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        const text = activeEl.value;
        const selectedText = text.substring(start, end);
        
        let replacement = '';
        if (isBlock) {
            const before = text.substring(0, start);
            const lineStartIdx = before.lastIndexOf('\n') + 1;
            const lineEndIdx = text.indexOf('\n', end);
            const actualLineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
            const lineText = text.substring(lineStartIdx, actualLineEnd);
            
            if (lineText.startsWith(prefix)) {
                replacement = lineText.substring(prefix.length);
            } else {
                const cleanLineText = lineText.replace(/^#{1,3}\s+/, '');
                replacement = prefix + cleanLineText;
            }
            
            activeEl.focus();
            activeEl.setRangeText(replacement, lineStartIdx, actualLineEnd, 'select');
        } else {
            if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
                replacement = selectedText.substring(prefix.length, selectedText.length - suffix.length);
            } else {
                replacement = prefix + selectedText + suffix;
            }
            activeEl.focus();
            activeEl.setRangeText(replacement, start, end, 'select');
        }
        
        const event = new Event('input', { bubbles: true });
        activeEl.dispatchEvent(event);
        
        detectSelectionFormat();
    }

    // @state: red
    function detectSelectionFormat() {
        const activeEl = document.activeElement;
        const buttons = {
            bold: document.getElementById('format-bold'),
            italic: document.getElementById('format-italic'),
            underline: document.getElementById('format-underline'),
            strike: document.getElementById('format-strike'),
            h1: document.getElementById('format-h1'),
            h2: document.getElementById('format-h2'),
            h3: document.getElementById('format-h3')
        };
        
        for (const key in buttons) {
            if (buttons[key]) buttons[key].classList.remove('active');
        }
        
        if (!activeEl || !activeEl.classList.contains('editor-textarea')) return;
        
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        const text = activeEl.value;
        const selectedText = text.substring(start, end);
        
        if (selectedText.startsWith('**') && selectedText.endsWith('**')) {
            if (buttons.bold) buttons.bold.classList.add('active');
        }
        if (selectedText.startsWith('*') && selectedText.endsWith('*')) {
            if (buttons.italic) buttons.italic.classList.add('active');
        }
        if (selectedText.startsWith('<u>') && selectedText.endsWith('</u>')) {
            if (buttons.underline) buttons.underline.classList.add('active');
        }
        if (selectedText.startsWith('~~') && selectedText.endsWith('~~')) {
            if (buttons.strike) buttons.strike.classList.add('active');
        }
        
        const before = text.substring(0, start);
        const lineStartIdx = before.lastIndexOf('\n') + 1;
        const lineEndIdx = text.indexOf('\n', start);
        const actualLineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
        const lineText = text.substring(lineStartIdx, actualLineEnd);
        
        if (lineText.startsWith('# ')) {
            if (buttons.h1) buttons.h1.classList.add('active');
        } else if (lineText.startsWith('## ')) {
            if (buttons.h2) buttons.h2.classList.add('active');
        } else if (lineText.startsWith('### ')) {
            if (buttons.h3) buttons.h3.classList.add('active');
        }
    }

    // @state: green
    function syncActivePageFromScroll() {
        if (isSnapping) return;
        const sheets = Array.from(document.querySelectorAll('.paper-page'));
        if (sheets.length === 0) {
            activePageIndex = 0;
            return;
        }

        const viewportTop = scrollContainer.scrollTop;
        const viewportCenter = viewportTop + scrollContainer.clientHeight * 0.35;
        let bestIndex = 0;
        let bestDistance = Infinity;

        sheets.forEach(function(sheet) {
            const idx = Number(sheet.getAttribute('data-index'));
            const distance = Math.abs(sheet.offsetTop - viewportCenter);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = idx;
            }
        });

        if (bestIndex !== activePageIndex) {
            activePageIndex = bestIndex;
            renderSidebar();
        }
    }

    scrollContainer.addEventListener('scroll', syncActivePageFromScroll);

    // Mouse wheel page snapping
    scrollContainer.addEventListener('wheel', function(e) {
        if (isSnapping) {
            e.preventDefault();
            return;
        }
        const activePage = document.getElementById('page-sheet-' + activePageIndex);
        if (!activePage) return;
        
        const pageTopInViewport = activePage.offsetTop;
        const pageBottomInViewport = activePage.offsetTop + activePage.offsetHeight;
        const viewportTop = scrollContainer.scrollTop;
        const viewportBottom = viewportTop + scrollContainer.clientHeight;
        
        if (e.deltaY > 0) {
            if (pageBottomInViewport > viewportBottom + 5) {
                return;
            } else {
                if (activePageIndex < localPages.length - 1) {
                    e.preventDefault();
                    scrollToPage(activePageIndex + 1);
                }
            }
        } else if (e.deltaY < 0) {
            if (pageTopInViewport < viewportTop - 5) {
                return;
            } else {
                if (activePageIndex > 0) {
                    e.preventDefault();
                    scrollToPage(activePageIndex - 1);
                }
            }
        }
    }, { passive: false });

    vscode.postMessage({ command: 'ready' });
})();
`;
