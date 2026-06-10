// @state: yellow
export const DocsSchemaJS = String.raw`
(function() {
    const vscode = acquireVsCodeApi();
    let localPages = [];
    let activeTab = 'dir';
    let editingIndex = null;
    let activePageIndex = 0;

    const docTitle = document.getElementById('doc-title');
    const tabDir = document.getElementById('tab-dir');
    const tabOutline = document.getElementById('tab-outline');
    const sidebarList = document.getElementById('sidebar-list');
    const scrollContainer = document.getElementById('content-viewport');
    const docsContainer = document.getElementById('document-scroll-container');
    const addPageBtn = document.getElementById('add-page-btn');

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
            if (activePageIndex >= localPages.length) {
                activePageIndex = Math.max(localPages.length - 1, 0);
            }
            renderSidebar();
            renderPages();
        }
    });

    // @state: yellow
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // @state: yellow
    function parseInlineMarkdown(text) {
        return escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/\`(.+?)\`/g, '<code>$1</code>');
    }

    // @state: yellow
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

    // @state: yellow
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

    // @state: yellow
    function visiblePageIndexes() {
        return localPages
            .map(function(page, idx) {
                return { page: page, idx: idx };
            })
            .filter(function(entry) {
                return activeTab !== 'outline' || entry.page.isOutline;
            });
    }

    // @state: yellow
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
            item.appendChild(outlineIndicator);

            item.addEventListener('click', function() {
                scrollToPage(idx);
            });

            sidebarList.appendChild(item);
        });
    }

    // @state: yellow
    function scrollToPage(index) {
        const sheet = document.getElementById('page-sheet-' + index);
        if (sheet) {
            activePageIndex = index;
            sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
            renderSidebar();
        }
    }

    // @state: yellow
    function renderPages() {
        docsContainer.innerHTML = '';

        localPages.forEach(function(page, idx) {
            const sheet = document.createElement('section');
            sheet.className = 'paper-page';
            sheet.id = 'page-sheet-' + idx;
            sheet.setAttribute('data-index', String(idx));

            if (editingIndex === idx) {
                renderEditor(sheet, page, idx);
            } else {
                renderPreview(sheet, page, idx);
            }

            docsContainer.appendChild(sheet);
        });
    }

    // @state: yellow
    function renderEditor(sheet, page, idx) {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'editor-title-input';
        titleInput.value = page.title || '';
        titleInput.placeholder = 'Page title';
        sheet.appendChild(titleInput);

        const textarea = document.createElement('textarea');
        textarea.className = 'editor-textarea';
        textarea.value = page.content || '';
        textarea.placeholder = 'Write Markdown';
        sheet.appendChild(textarea);

        const actions = document.createElement('div');
        actions.className = 'editor-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'editor-btn';
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function() {
            editingIndex = null;
            renderPages();
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'editor-btn save';
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', function() {
            vscode.postMessage({
                command: 'updateDocsPage',
                pageIndex: idx,
                updates: {
                    title: titleInput.value || 'Page ' + (idx + 1),
                    content: textarea.value
                }
            });
            editingIndex = null;
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        sheet.appendChild(actions);
    }

    // @state: yellow
    function renderPreview(sheet, page, idx) {
        const hud = document.createElement('div');
        hud.className = 'page-header-hud';

        const outlineBtn = document.createElement('button');
        outlineBtn.className = 'hud-icon-btn';
        outlineBtn.type = 'button';
        outlineBtn.textContent = page.isOutline ? 'Outline' : 'Add outline';
        outlineBtn.title = page.isOutline ? 'Remove from outline' : 'Add to outline';
        outlineBtn.addEventListener('click', function() {
            vscode.postMessage({
                command: 'updateDocsPage',
                pageIndex: idx,
                updates: { isOutline: !page.isOutline }
            });
        });
        hud.appendChild(outlineBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'hud-icon-btn';
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.title = 'Edit page';
        editBtn.addEventListener('click', function() {
            editingIndex = idx;
            activePageIndex = idx;
            renderSidebar();
            renderPages();
            scrollToPage(idx);
        });
        hud.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'hud-icon-btn delete';
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.title = 'Delete page';
        deleteBtn.addEventListener('click', function() {
            if (confirm('Delete this page?')) {
                vscode.postMessage({
                    command: 'deleteDocsPage',
                    pageIndex: idx
                });
            }
        });
        hud.appendChild(deleteBtn);
        sheet.appendChild(hud);

        const body = document.createElement('div');
        body.className = 'markdown-body';
        body.innerHTML = parseMarkdown(page.content || '');
        sheet.appendChild(body);

        const pageNum = document.createElement('div');
        pageNum.className = 'page-number-hud';
        pageNum.textContent = String(idx + 1);
        sheet.appendChild(pageNum);
    }

    // @state: yellow
    function syncActivePageFromScroll() {
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
    vscode.postMessage({ command: 'ready' });
})();
`;
