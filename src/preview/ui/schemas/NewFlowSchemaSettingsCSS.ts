// @state: green
export const NewFlowSchemaSettingsCSS = `
    /* Settings panel styling */
    .settings-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 380px;
        height: 100vh;
        background: var(--vscode-sideBar-background, var(--vscode-editor-background, #ffffff));
        border-left: 1px solid var(--vscode-sideBar-border, var(--hud-border, rgba(0,0,0,0.1)));
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        z-index: 100;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: none; /* Removed pop-out slide animation */
        display: flex;
        flex-direction: column;
        color: var(--vscode-sideBar-foreground, var(--text-color, #333333));
        pointer-events: auto;
    }
    
    .settings-panel.open {
        transform: translateX(0);
    }
    
    .settings-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--vscode-sideBar-border, var(--hud-border, rgba(0,0,0,0.1)));
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
    }
    
    .settings-title {
        font-size: 16px;
        font-weight: 600;
        background: linear-gradient(135deg, #60a5fa, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .close-settings-btn {
        background: none;
        border: none;
        color: var(--vscode-sideBar-foreground, rgba(0, 0, 0, 0.5));
        font-size: 22px;
        cursor: pointer;
        transition: color 0.2s, background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        opacity: 0.7;
    }
    
    .close-settings-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        opacity: 1;
    }
    
    .settings-tabs {
        display: flex;
        border-bottom: 1px solid var(--vscode-sideBar-border, var(--hud-border, rgba(0,0,0,0.1)));
        background: rgba(0, 0, 0, 0.02);
        flex-shrink: 0;
    }
    
    .settings-tab {
        flex: 1;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--vscode-sideBar-foreground, rgba(0, 0, 0, 0.6));
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
        opacity: 0.7;
    }
    
    .settings-tab:hover {
        color: var(--vscode-sideBar-foreground, var(--text-color));
        background: rgba(0, 0, 0, 0.02);
        opacity: 1;
    }
    
    .settings-tab.active {
        color: var(--vscode-button-background, var(--accent-color));
        border-bottom-color: var(--vscode-button-background, var(--accent-color));
        background: rgba(59, 130, 246, 0.05);
        opacity: 1;
    }
    
    .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .form-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--vscode-sideBar-foreground, rgba(0, 0, 0, 0.5));
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.8;
    }
    
    .settings-input, .settings-select {
        background: var(--vscode-input-background, rgba(0, 0, 0, 0.03)) !important;
        border: 1px solid var(--vscode-input-border, var(--hud-border, rgba(0,0,0,0.1))) !important;
        border-radius: 6px !important;
        padding: 8px 12px !important;
        color: var(--vscode-input-foreground, var(--text-color, #333333)) !important;
        font-size: 14px !important;
        outline: none !important;
    }
    
    .settings-input:focus, .settings-select:focus {
        border-color: var(--vscode-focusBorder, var(--accent-color)) !important;
    }
    
    .list-section-header {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-sideBar-foreground, var(--text-color, #333333));
        margin-top: 10px;
        border-bottom: 1px solid var(--vscode-sideBar-border, var(--hud-border, rgba(0,0,0,0.1)));
        padding-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .list-item-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        align-items: center;
    }
    
    .list-item-row input {
        flex: 1;
        min-width: 0;
    }
    
    /* HSL Sliders styling */
    .hsl-slider-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .slider-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .slider-header {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--vscode-sideBar-foreground, rgba(0, 0, 0, 0.8));
    }
    
    .slider-container input[type="range"] {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        outline: none;
        -webkit-appearance: none;
        cursor: pointer;
    }
    
    #slider-h {
        background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);
    }
    
    #slider-s {
        background: linear-gradient(to right, #808080, var(--accent-color, #3b82f6));
    }
    
    #slider-l {
        background: linear-gradient(to right, #000000, var(--accent-color, #3b82f6), #ffffff);
    }
    
    .slider-container input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        transition: transform 0.1s;
    }
    
    .slider-container input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }
    
    /* Recent Colors Container */
    .recent-colors-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 4px 0;
    }
    
    .recent-color-circle {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1.5px solid rgba(255, 255, 255, 0.2);
        cursor: pointer;
        transition: transform 0.15s ease, border-color 0.15s ease;
    }
    
    .recent-color-circle:hover {
        transform: scale(1.15);
        border-color: rgba(255, 255, 255, 0.8);
    }
    
    .recent-color-circle.selected {
        border: 2px solid #ffffff !important;
        box-shadow: 0 0 8px #ffffff;
        transform: scale(1.15);
    }
    
    /* Global buttons styled via VS Code themes */
    .settings-btn, .reset-color-btn, .add-btn {
        margin-top: 10px;
        background: var(--vscode-button-background, #007acc) !important;
        color: var(--vscode-button-foreground, #ffffff) !important;
        border: none !important;
        border-radius: 6px !important;
        padding: 8px 12px !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: background 0.15s ease !important;
        text-align: center !important;
        font-weight: 500 !important;
    }
    
    .settings-btn:hover, .reset-color-btn:hover, .add-btn:hover {
        background: var(--vscode-button-hoverBackground, #0062a3) !important;
    }

    .delete-btn {
        background: none !important;
        border: none !important;
        color: var(--vscode-sideBar-foreground, rgba(0, 0, 0, 0.4)) !important;
        cursor: pointer !important;
        font-size: 16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 4px !important;
        transition: color 0.15s ease !important;
        opacity: 0.6;
    }
    .delete-btn:hover {
        color: #ef4444 !important;
        opacity: 1;
    }
    body.vscode-light .delete-btn {
        color: rgba(0, 0, 0, 0.4) !important;
    }
    body.vscode-light .delete-btn:hover {
        color: #ef4444 !important;
    }
`;