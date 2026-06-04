import { UIComponent } from '../core/Component';

export class ButtonComponent extends UIComponent {
	constructor(private id: string, private text: string, private title?: string) {
		super();
	}

	public render(): string {
		const titleAttr = this.title ? ` title="${this.title}"` : '';
		return `<button id="${this.id}" class="btn"${titleAttr}>${this.text}</button>`;
	}
}

export class ToolbarComponent extends UIComponent {
	public render(): string {
		return `<div id="toolbar">\n\t\t\t${this.renderChildren()}\n\t\t</div>`;
	}
}

export class BadgeComponent extends UIComponent {
	constructor(private id: string, private initialText: string) {
		super();
	}

	public render(): string {
		return `<span id="${this.id}" class="badge">${this.initialText}</span>`;
	}
}
