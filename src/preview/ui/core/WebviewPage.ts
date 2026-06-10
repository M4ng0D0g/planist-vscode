import { UIComponent } from './Component';

export class WebviewPage extends UIComponent {
    private headTags: string[] = [];
    private styles: string[] = [];
    private scriptSrcTags: string[] = [];
    private inlineScripts: Array<{ code: string; nonce: string }> = [];

    constructor(private title: string = 'Planist Flow Preview') {
        super();
    }

    public addMeta(metaStr: string): void {
        this.headTags.push(metaStr);
    }

    public addStyle(css: string): void {
        this.styles.push(css);
    }

    public addExternalScript(srcUrl: string, nonce: string): void {
        this.scriptSrcTags.push(`<script nonce="${nonce}" src="${srcUrl}"></script>`);
    }

    public addInlineScript(scriptCode: string, nonce: string): void {
        this.inlineScripts.push({ code: scriptCode, nonce });
    }

    public render(): string {
        const headContent = this.headTags.join('\n\t');
        const styleContent = this.styles.length > 0 ? `<style nonce="${this.inlineScripts[0]?.nonce || ''}">\n${this.styles.join('\n')}\n</style>` : '';
        const externalScripts = this.scriptSrcTags.join('\n\t');
        
        // 強制為每段行內腳本注入獨立的驗證權限
        const inlineScriptsCompiled = this.inlineScripts.map(script => 
            `<script nonce="${script.nonce}">\n${script.code}\n</script>`
        ).join('\n');

        return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>${this.title}</title>
    ${headContent}
    ${styleContent}
</head>
<body>
    ${this.renderChildren()}
    ${externalScripts}
    ${inlineScriptsCompiled}
</body>
</html>`;
    }
}