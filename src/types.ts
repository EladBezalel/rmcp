export type JSONSchema = Record<string, unknown>;

export interface Tool<TArgs = unknown> {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: JSONSchema;
  readonly run: (args: TArgs) => Promise<string>;
}
