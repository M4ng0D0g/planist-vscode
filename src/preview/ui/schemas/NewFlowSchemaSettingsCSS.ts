// @state: green
export const NewFlowSchemaSettingsCSS = `
    /* Settings panel styling */
    .settings-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 380px;
        height: 100vh;
        background: rgba(20, 20, 25, 0.85);
        border-left: 1px solid var(--hud-border);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        z-index: 100;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        color: var(--text-color);
        pointer-events: auto;
    }
    
    .settings-panel.open {
        transform: translateX(0);
    }
    
    .settings-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--hud-border);
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
        color: rgba(255, 255, 255, 0.5);
        font-size: 22px;
        cursor: pointer;
        transition: color 0.2s, background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
    }
    
    .close-settings-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
    }
    
    .settings-tabs {
        display: flex;
        border-bottom: 1px solid var(--hud-border);
        background: rgba(255, 255, 255, 0.02);
        flex-shrink: 0;
    }
    
    .settings-tab {
        flex: 1;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.6);
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
    }
    
    .settings-tab:hover {
        color: var(--text-color);
        background: rgba(255, 255, 255, 0.02);
    }
    
    .settings-tab.active {
        color: var(--accent-color);
        border-bottom-color: var(--accent-color);
        background: rgba(59, 130, 246, 0.05);
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
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .settings-input, .settings-select {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--hud-border);
        border-radius: 6px;
        padding: 8px 12px;
        color: var(--text-color);
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
    }
    
    .settings-input:focus, .settings-select:focus {
        border-color: var(--accent-color);
    }
    
    .list-section-header {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-color);
        margin-top: 10px;
        border-bottom: 1px solid var(--hud-border);
        padding-bottom: 6px;
    }
    
    .list-item-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
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
        color: rgba(255, 255, 255, 0.8);
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
    
    .reset-color-btn {
        margin-top: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--hud-border);
        border-radius: 6px;
        padding: 10px;
        color: var(--text-color);
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
    }
    
    .reset-color-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.3);
    }
`;