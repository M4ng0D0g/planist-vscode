// @status GREEN
import { UIComponent } from '../core/Component';
import { Logger } from '../../../utils/logger';

export class PlanistTooltip extends UIComponent {
    private logger = new Logger('PlanistTooltip', 'GREEN');

    constructor() {
        super();
        this.logger.info('Tooltip component created');
    }

    public render(): string {
        this.logger.info('Rendering tooltip element');
        return '<div id="tooltip"></div>';
    }
}
