// @status GREEN
import { UIComponent } from '../core/Component';
import { Logger } from '../../../utils/logger';

export class PlanistBadge extends UIComponent {
    private logger = new Logger('PlanistBadge', 'GREEN');

    constructor(private id: string, private initialText: string) {
        super();
        this.logger.info(`Badge component created with id="${this.id}", text="${this.initialText}"`);
    }

    public render(): string {
        this.logger.info(`Rendering badge id="${this.id}"`);
        return `<span id="${this.id}" class="badge">${this.initialText}</span>`;
    }
}
