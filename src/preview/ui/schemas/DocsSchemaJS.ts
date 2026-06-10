// @state: yellow
export const DocsSchemaJS = `
(function() {
    const vscode = acquireVsCodeApi();
    let localPages = [];
    let activeTab = 'dir'; // 'dir' or 'outline'
    let editingIndex = null;

    // DOM Elements
    const docTitle = document.getElementById('doc-title');
    const tabDir = document.getElementById('tab-dir');
    const tabOutline = document.getElementById('tab-outline');
    const sidebarList = document.getElementById('sidebar-list');
    const scrollContainer = document.getElementById('content-viewport');
    const docsContainer = document.getElementById('document-scroll-container');
    const addPageBtn = document.getElementById('add-page-btn');

    // Tab Event Listeners
    tabDir.addEventListener('click', () => {
        activeTab = 'dir';
        tabDir.classList.add('active');
        tabOutline.classList.remove('active');
        renderSidebar();
    });

    tabOutline.addEventListener('click', () => {
        activeTab = 'outline';
        tabOutline.classList.add('active');
        tabDir.classList.remove('active');
        renderSidebar();
    });

    // Add Page click
    addPageBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'addDocsPage' });
    });

    // Handle VS Code messages
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'updateSchemaData' && message.schema === 'docs') {
            docTitle.textContent = message.data.docName || 'Untitled Document';
            localPages = message.data.pages || [];
            renderSidebar();
            renderPages();
        }
    });

    // @state: yellow
    function parseInlineMarkdown(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
            .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/\`(.*?)\`/g, '<code>$1</code>');
    }

    // @state: yellow
    function parseMarkdown(text) {
        const lines = text.split('\\n');
        const html = [];
        let inList = false;
        let inQuote = false;

        for (let line of lines) {
            const trimmed = line.trim();

            // Handle lists
            const listMatch = line.match(/^(\\s*)(?:-|\\*)\\s+(.*)/);
            if (listMatch) {
                if (!inList) {
                    html.push('<ul>');
                    inList = true;
                }
                html.push('<li>' + parseInlineMarkdown(listMatch[2]) + '</li>');
                continue;
            } else {
                if (inList) {
                    html.push('</ul>');
                    inList = false;
                }
            }

            // Handle blockquotes
            if (trimmed.startsWith('>')) {
                if (!inQuote) {
                    html.push('<blockquote>');
                    inQuote = true;
                }
                html.push(parseInlineMarkdown(trimmed.substring(1).trim()) + '<br>');
                continue;
            } else {
                if (inQuote) {
                    html.push('</blockquote>');
                    inQuote = false;
                }
            }

            // Headers
            if (trimmed.startsWith('# ')) {
                html.push('<h1>' + parseInlineMarkdown(trimmed.substring(2)) + '</h1>');
            } else if (trimmed.startsWith('## ')) {
                html.push('<h2>' + parseInlineMarkdown(trimmed.substring(3)) + '</h2>');
            } else if (trimmed.startsWith('### ')) {
                html.push('<h3>' + parseInlineMarkdown(trimmed.substring(4)) + '</h3>');
            } else if (trimmed === '') {
                html.push('<p></p>');
            } else {
                html.push('<p>' + parseInlineMarkdown(line) + '</p>');
            }
        }

        if (inList) html.push('</ul>');
        if (inQuote) html.push('</blockquote>');

        return html.join('\\n');
    }

    // @state: yellow
    function renderSidebar() {
        sidebarList.innerHTML = '';
        localPages.forEach((page, idx) => {
            if (activeTab === 'outline' && !page.isOutline) {
                return;
            }

            const item = document.createElement('div');
            item.className = 'sidebar-item';
            item.setAttribute('data-index', idx);
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'sidebar-item-title';
            titleSpan.textContent = page.title || \`Page \${idx + 1}\`;
            item.appendChild(titleSpan);

            // Bookmark/Outline toggle indicator in sidebar
            const outlineIndicator = document.createElement('span');
            outlineIndicator.className = 'sidebar-item-outline';
            outlineIndicator.innerHTML = page.isOutline ? '★' : '☆';
            outlineIndicator.style.fontSize = '12px';
            outlineIndicator.style.cursor = 'pointer';
            outlineIndicator.style.marginLeft = '8px';
            outlineIndicator.style.color = page.isOutline ? '#eab308' : '#858585';
            
            outlineIndicator.addEventListener('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({
                    command: 'updateDocsPage',
                    pageIndex: idx,
                    updates: { isOutline: !page.isOutline }
                });
            });
            item.appendChild(outlineIndicator);

            item.addEventListener('click', () => {
                const sheet = document.getElementById(\`page-sheet-\${idx}\`);
                if (sheet) {
                    sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
            });

            sidebarList.appendChild(item);
        });
    }

    // @state: yellow
    function renderPages() {
        docsContainer.innerHTML = '';
        localPages.forEach((page, idx) => {
            const sheet = document.createElement('div');
            sheet.className = 'paper-page';
            sheet.id = \`page-sheet-\${idx}\`;

            // If we are currently editing this page, render the editor layout
            if (editingIndex === idx) {
                const editWrapper = document.createElement('div');
                editWrapper.style.display = 'flex';
                editWrapper.style.flexDirection = 'column';
                editWrapper.style.height = '100%';

                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'editor-title-input';
                titleInput.value = page.title;
                titleInput.placeholder = '頁面標題 (Page Title)';
                titleInput.style.fontSize = '18px';
                titleInput.style.fontWeight = 'bold';
                titleInput.style.marginBottom = '15px';
                titleInput.style.padding = '8px';
                titleInput.style.border = '1px solid #ccc';
                titleInput.style.borderRadius = '4px';
                editWrapper.appendChild(titleInput);

                const textarea = document.createElement('textarea');
                textarea.className = 'editor-textarea';
                textarea.value = page.content;
                textarea.placeholder = '在此使用 Markdown 格式撰寫文件內容...';
                editWrapper.appendChild(textarea);

                const actions = document.createElement('div');
                actions.className = 'editor-actions';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'editor-btn';
                cancelBtn.textContent = '取消';
                cancelBtn.addEventListener('click', () => {
                    editingIndex = null;
                    renderPages();
                });

                const saveBtn = document.createElement('button');
                saveBtn.className = 'editor-btn save';
                saveBtn.textContent = '保存變更';
                saveBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'updateDocsPage',
                        pageIndex: idx,
                        updates: {
                            title: titleInput.value,
                            content: textarea.value
                        }
                    });
                    editingIndex = null;
                });

                actions.appendChild(cancelBtn);
                actions.appendChild(saveBtn);
                editWrapper.appendChild(actions);
                sheet.appendChild(editWrapper);
            } else {
                // Read-only Rendered Markdown layout
                const hud = document.createElement('div');
                hud.className = 'page-header-hud';

                // Outline Toggle
                const outlineBtn = document.createElement('button');
                outlineBtn.className = 'hud-icon-btn';
                outlineBtn.innerHTML = page.isOutline ? '★ 大綱' : '☆ 大綱';
                outlineBtn.style.color = page.isOutline ? '#eab308' : '';
                outlineBtn.title = '加到大綱';
                outlineBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'updateDocsPage',
                        pageIndex: idx,
                        updates: { isOutline: !page.isOutline }
                    });
                });
                hud.appendChild(outlineBtn);

                // Edit Button
                const editBtn = document.createElement('button');
                editBtn.className = 'hud-icon-btn';
                editBtn.innerHTML = '✎ 編輯';
                editBtn.title = '編輯頁面';
                editBtn.addEventListener('click', () => {
                    editingIndex = idx;
                    renderPages();
                });
                hud.appendChild(editBtn);

                // Delete Button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'hud-icon-btn delete';
                deleteBtn.innerHTML = '🗑 刪除';
                deleteBtn.title = '刪除頁面';
                deleteBtn.addEventListener('click', () => {
                    if (confirm('確定要刪除此頁面嗎？')) {
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
                pageNum.textContent = idx + 1;
                sheet.appendChild(pageNum);
            }

            docsContainer.appendChild(sheet);
        });
    }

    // Scrollspy to highlight active page in sidebar
    scrollContainer.addEventListener('scroll', () => {
        const sheets = Array.from(document.querySelectorAll('.paper-page'));
        const viewportCenter = scrollContainer.scrollTop + scrollContainer.clientHeight / 2;

        let activeIdx = 0;
        let minDiff = Infinity;

        sheets.forEach((sheet, idx) => {
            const sheetTop = sheet.offsetTop;
            const sheetBottom = sheetTop + sheet.clientHeight;
            const center = (sheetTop + sheetBottom) / 2;
            const diff = Math.abs(viewportCenter - center);
            if (diff < minDiff) {
                minDiff = diff;
                activeIdx = idx;
            }
        });

        // Set active class in sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            const idx = parseInt(item.getAttribute('data-index'), 10);
            if (idx === activeIdx) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    });

    // Notify ready
    vscode.postMessage({ command: 'ready' });
})();
`;
