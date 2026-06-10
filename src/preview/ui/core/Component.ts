export abstract class UIComponent {
	protected children: UIComponent[] = [];

	public addChild(child: UIComponent): void {
		this.children.push(child);
	}

	public addChildren(children: UIComponent[]): void {
		this.children.push(...children);
	}

	public abstract render(): string;

	protected renderChildren(): string {
		return this.children.map(c => c.render()).join('\n');
	}
}

export class RawHtmlComponent extends UIComponent {
	constructor(private html: string) {
		super();
	}
	public render(): string {
		return this.html + this.renderChildren();
	}
}
