import { LogManager } from '../config/logger';

export interface TaskItem {
    id: string;
    title: string;
    target?: string;
    line: number;
    startChar: number;
    endChar: number;
}

export interface TaskList {
    name: string; // e.g. todo, in_progress, done
    items: TaskItem[];
    startLine: number;
    endLine: number; // The line containing the closing bracket ]
}

export interface TaskDocumentModel {
    schema: 'task';
    name: string;
    lists: TaskList[];
}

export function parseTaskDocument(text: string): TaskDocumentModel {
    const lines = text.split(/\r?\n/);
    const model: TaskDocumentModel = { schema: 'task', name: 'Unknown', lists: [] };

    let currentList: TaskList | null = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Parse Schema Header
        if (i === 0) {
            const schemaMatch = line.match(/^\s*#schema\s+task\s+([A-Za-z0-9_-]+)/i);
            if (schemaMatch) {
                model.name = schemaMatch[1];
            } else {
                model.name = 'TaskBoard';
            }
            continue;
        }

        // Parse List Start
        const listMatch = line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*\[\s*$/i);
        if (listMatch) {
            if (currentList) {
                currentList.endLine = i - 1; // End previous list if not properly closed
            }
            currentList = {
                name: listMatch[1],
                items: [],
                startLine: i,
                endLine: -1
            };
            model.lists.push(currentList);
            continue;
        }

        // Parse List End
        if (currentList && /^\s*\]\s*$/.test(line)) {
            currentList.endLine = i;
            currentList = null;
            continue;
        }

        // Parse Task Item
        if (currentList) {
            const itemMatch = line.match(/^\s*-\s*(.+?)(?:\s*->\s*([A-Za-z_][\w-.]*))?\s*$/);
            if (itemMatch) {
                const title = itemMatch[1].trim();
                const target = itemMatch[2];
                const startChar = line.indexOf('-');
                const endChar = line.length;
                
                // create a deterministic id based on list name and line index to prevent re-rendering issues
                const id = `${currentList.name}_item_${i}`;
                
                currentList.items.push({
                    id,
                    title,
                    target,
                    line: i,
                    startChar,
                    endChar
                });
            }
        }
    }
    
    // Close unclosed lists
    if (currentList && currentList.endLine === -1) {
        currentList.endLine = lines.length - 1;
    }

    return model;
}
