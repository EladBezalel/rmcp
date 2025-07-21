import { existsSync, statSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { Tool } from './types.js';

export class ToolDiscovery {
  private toolsPath: string;

  constructor(toolsPath: string) {
    this.toolsPath = resolve(toolsPath);
  }

  async discoverTools(): Promise<Tool[]> {
    if (!existsSync(this.toolsPath)) {
      throw new Error(`Tools path does not exist: ${this.toolsPath}`);
    }

    const stat = statSync(this.toolsPath);
    if (!stat.isDirectory()) {
      throw new Error(`Tools path is not a directory: ${this.toolsPath}`);
    }

    const tools: Tool[] = [];
    const files = readdirSync(this.toolsPath);

    for (const file of files) {
      if (this.isToolFile(file)) {
        try {
          const tool = await this.loadTool(file);
          if (tool) {
            tools.push(tool);
          }
        } catch (error) {
          console.warn(`Failed to load tool from ${file}:`, error);
        }
      }
    }

    return tools;
  }

  private isToolFile(filename: string): boolean {
    return (
      filename.endsWith('.js') ||
      filename.endsWith('.ts') ||
      filename.endsWith('.mjs')
    );
  }

  private async loadTool(filename: string): Promise<Tool | null> {
    const fullPath = join(this.toolsPath, filename);

    try {
      const module: unknown = await import(fullPath);

      const moduleObj = module as Record<string, unknown>;
      const tool = moduleObj.default as Record<string, unknown> | undefined;

      if (tool == null) {
        console.warn(`Tool in ${filename} does not have a default export`);
        return null;
      }

      if (!this.isValidTool(tool)) {
        console.warn(
          `Tool in ${filename} does not match the expected interface`
        );
        const toolObj = tool as Record<string, unknown>;
        console.warn(`Tool structure:`, {
          name: toolObj?.name,
          hasRunFn: typeof toolObj?.run === 'function',
          hasInputSchema: !!toolObj?.inputSchema,
          keys: Object.keys(toolObj ?? {})
        });
        return null;
      }

      return tool;
    } catch (error) {
      console.error(`Error loading tool from ${filename}:`, error);
      return null;
    }
  }

  private isValidTool(tool: unknown): tool is Tool {
    if (typeof tool !== 'object' || tool === null) {
      return false;
    }

    const toolObj = tool as Record<string, unknown>;
    return (
      typeof toolObj.name === 'string' &&
      typeof toolObj.run === 'function' &&
      typeof toolObj.inputSchema === 'object' &&
      toolObj.inputSchema !== null
    );
  }
}
