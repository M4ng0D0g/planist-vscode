import { UIComponent } from './Component';

export class WebviewPage extends UIComponent {
	private headTags: string[] = [];
	private styles: string[] = [];
	private scriptTags: string[] = [];
	private inlineScripts: string[] = [];
	private bodyClasses: string[] = [];

	constructor(private title: string = 'Preview') {
		super();
	}

	public addMeta(metaStr: string) {
		this.headTags.push(metaStr);
	}

	public addStyle(css: string) {
		this.styles.push(css);
	}

	public addScriptTag(scriptHtml: string) {
		this.scriptTags.push(scriptHtml);
	}

	public addInlineScript(scriptCode: string) {
		this.inlineScripts.push(scriptCode);
	}

	public addBodyClass(className: string) {
		this.bodyClasses.push(className);
	}

	public render(): string {
		const headContent = this.headTags.join('\n\t\t\t');
		const styleContent = this.styles.length > 0 ? `<style>\n${this.styles.join('\n')}\n\t\t</style>` : '';
		const scriptTagContent = this.scriptTags.join('\n\t\t');
		const inlineScriptContent = this.inlineScripts.length > 0 
			? `<script>\n${this.inlineScripts.join('\n\n')}\n\t\t</script>` 
			: '';
		const bodyClassStr = this.bodyClasses.length > 0 ? ` class="${this.bodyClasses.join(' ')}"` : '';

		return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
	<meta charset="UTF-8">
	<title>${this.title}</title>
	${headContent}
	${styleContent}
</head>
<body${bodyClassStr}>
	${this.renderChildren()}
	${scriptTagContent}
	${inlineScriptContent}
</body>
</html>`;
	}
}
