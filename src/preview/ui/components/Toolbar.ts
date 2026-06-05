import { PlanistButton } from './PlanistButton';
import { PlanistToolbar } from './PlanistToolbar';
import { PlanistBadge } from './PlanistBadge';

export class ButtonComponent extends PlanistButton {
	constructor(id: string, text: string, title?: string) {
		super(id, text, 'primary', title);
	}
}

export class ToolbarComponent extends PlanistToolbar {}

export class BadgeComponent extends PlanistBadge {}
