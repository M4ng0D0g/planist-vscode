import { ISchemaRenderer } from './SchemaRenderer';
import { FlowSchemaRenderer } from './FlowSchemaRenderer';

export class RendererFactory {
	public static getRenderer(schema: string): ISchemaRenderer {
		switch (schema.toLowerCase()) {
			case 'flow':
				return new FlowSchemaRenderer();
			default:
				// Fallback to flow renderer for unknown schemas
				return new FlowSchemaRenderer();
		}
	}
}
