// @status GREEN
import { UIComponent } from '../core/Component';
import { Logger } from '../../../utils/logger';

export class PlanistButton extends UIComponent {
    private logger = new Logger('PlanistButton', 'GREEN');

    constructor(
        private id: string,
        private text: string,
        private buttonType: string = 'primary',
        private title?: string
    ) {
        super();
        this.logger.info(`Component created with id="${this.id}", type="${this.buttonType}"`);
    }

    public render(): string {
        this.logger.info(`Rendering button id="${this.id}"`);
        const titleAttr = this.title ? ` title="${this.title}"` : '';
        return `<button id="${this.id}" class="btn btn-${this.buttonType}"${titleAttr}>${this.text}</button>`;
    }
}
