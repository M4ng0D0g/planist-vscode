// @status GREEN
import { UIComponent } from '../core/Component';
import { Logger } from '../../../utils/logger';

export class PlanistToolbar extends UIComponent {
    private logger = new Logger('PlanistToolbar', 'GREEN');

    constructor() {
        super();
        this.logger.info('Toolbar component created');
    }

    public render(): string {
        this.logger.info(`Rendering toolbar with ${this.children.length} children`);
        return `<div id="toolbar">\n\t\t\t${this.renderChildren()}\n\t\t</div>`;
    }
}
