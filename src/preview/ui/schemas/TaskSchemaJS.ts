export const TaskSchemaJS = `
const vscode = acquireVsCodeApi();
let boardData = null;
let draggedCardId = null;

window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'updateSchemaData' && message.schema === 'task') {
        boardData = message.data;
        updateUI();
    }
});

function updateUI() {
    if (!boardData) return;
    document.getElementById('board-title').textContent = (boardData.boardName || 'DevSprint') + " Kanban Board";
    
    renderColumn('todo', boardData.todo || []);
    renderColumn('in_progress', boardData.in_progress || []);
    renderColumn('done', boardData.done || []);
}

function renderColumn(colId, list) {
    const listEl = document.getElementById('list-' + colId);
    const countEl = document.getElementById('count-' + colId);
    listEl.innerHTML = '';
    countEl.textContent = list.length;

    list.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.draggable = true;
        card.id = colId + '-' + idx;
        card.setAttribute('ondragstart', 'drag(event)');
        card.setAttribute('data-text', item.text);
        if (item.target) {
            card.setAttribute('data-target', item.target);
        }
        
        let cardInner = '<div>' + item.text + '</div>';
        if (item.target) {
            cardInner += '<div class="card-link" onclick="openLink(\\'' + item.target + '\\')">🔗' + item.target + '</div>';
        }
        card.innerHTML = cardInner;
        listEl.appendChild(card);
    });
}

window.openLink = function(targetName) {
    const entityName = targetName.split('.')[0];
    vscode.postMessage({
        command: 'openEntityFile',
        entityName: entityName
    });
};

window.allowDrop = function(e) {
    e.preventDefault();
    const col = e.currentTarget;
    col.classList.add('drag-over');
};

window.dragLeave = function(colId) {
    const col = document.getElementById('col-' + colId);
    col.classList.remove('drag-over');
};

window.drag = function(e) {
    e.dataTransfer.setData("text", e.target.id);
    draggedCardId = e.target.id;
};

window.drop = function(e, targetColId) {
    e.preventDefault();
    const col = document.getElementById('col-' + targetColId);
    col.classList.remove('drag-over');

    const dataId = e.dataTransfer.getData("text");
    if (!dataId) return;

    const [sourceColId, sourceIdxStr] = dataId.split('-');
    const sourceIdx = parseInt(sourceIdxStr);
    
    if (sourceColId === targetColId) return;

    // Get the dragged item data before removing it from local state
    const sourceList = sourceColId === 'todo' ? boardData.todo : sourceColId === 'in_progress' ? boardData.in_progress : boardData.done;
    const targetList = targetColId === 'todo' ? boardData.todo : targetColId === 'in_progress' ? boardData.in_progress : boardData.done;
    
    const [movedItem] = sourceList.splice(sourceIdx, 1);
    targetList.push(movedItem);

    // Update locally immediately
    updateUI();

    // Send precise sync command to SyncHub
    vscode.postMessage({
        command: 'moveTask',
        taskTitle: movedItem.text,
        taskTarget: movedItem.target,
        fromList: sourceColId,
        toList: targetColId
    });
};

vscode.postMessage({ command: 'ready' });
`;
