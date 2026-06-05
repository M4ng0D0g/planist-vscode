import { ISchemaRenderer } from './SchemaRenderer';
import { FlowSchemaRenderer } from './FlowSchemaRenderer';
import { NewFlowSchemaRenderer } from './NewFlowSchemaRenderer';
import { DesignSchemaRenderer } from './DesignSchemaRenderer';
import { TaskSchemaRenderer } from './TaskSchemaRenderer';
import { ApiSchemaRenderer } from './ApiSchemaRenderer';
import { StateSchemaRenderer } from './StateSchemaRenderer';
import { DatabaseSchemaRenderer } from './DatabaseSchemaRenderer';

export class RendererFactory {
	// @state: green
	public static getRenderer(schema: string): ISchemaRenderer {
		switch (schema.toLowerCase()) {
			case 'flow':
				return new NewFlowSchemaRenderer();
			case 'design':
				return new DesignSchemaRenderer();
			case 'task':
				return new TaskSchemaRenderer();
			case 'api':
				return new ApiSchemaRenderer();
			case 'state':
				return new StateSchemaRenderer();
			case 'database':
				return new DatabaseSchemaRenderer();
			default:
				// Fallback to new flow renderer for unknown schemas
				return new NewFlowSchemaRenderer();
		}
	}
}
