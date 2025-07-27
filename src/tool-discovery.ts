import { existsSync, statSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { Tool, DiscoveredTool, DiscoveryResults, ToolSource } from './types.js';

export class ToolDiscovery {
  private toolsPath: string;
  private source: ToolSource;

  constructor(toolsPath: string, source: ToolSource = 'local') {
    this.toolsPath = resolve(toolsPath);
    this.source = source;
  }

  async discoverTools(): Promise<Tool[]> {
    const results = await this.discoverToolsWithMetadata();
    return results.tools.map(dt => dt.tool);
  }

  async discoverToolsWithMetadata(): Promise<DiscoveryResults> {
    if (!existsSync(this.toolsPath)) {
      console.warn(`⚠️  Tools path does not exist: ${this.toolsPath}`);
      console.warn(`📂 Continuing with no ${this.source} tools loaded`);
      return {
        tools: [],
        summary: {
          total: 0,
          global: this.source === 'global' ? 0 : 0,
          local: this.source === 'local' ? 0 : 0,
          conflicts: []
        }
      };
    }

    const stat = statSync(this.toolsPath);
    if (!stat.isDirectory()) {
      console.warn(`⚠️  Tools path is not a directory: ${this.toolsPath}`);
      console.warn(`📂 Continuing with no ${this.source} tools loaded`);
      return {
        tools: [],
        summary: {
          total: 0,
          global: this.source === 'global' ? 0 : 0,
          local: this.source === 'local' ? 0 : 0,
          conflicts: []
        }
      };
    }

    const discoveredTools: DiscoveredTool[] = [];
    const files = readdirSync(this.toolsPath);

    for (const file of files) {
      if (this.isToolFile(file)) {
        try {
          const discoveredTool = await this.loadToolWithMetadata(file);
          if (discoveredTool) {
            discoveredTools.push(discoveredTool);
          }
        } catch (error) {
          console.warn(`Failed to load tool from ${file}:`, error);
        }
      }
    }

    return {
      tools: discoveredTools,
      summary: {
        total: discoveredTools.length,
        global: this.source === 'global' ? discoveredTools.length : 0,
        local: this.source === 'local' ? discoveredTools.length : 0,
        conflicts: [] // No conflicts in single-source discovery
      }
    };
  }

  private isToolFile(filename: string): boolean {
    return (
      filename.endsWith('.js') ||
      filename.endsWith('.ts') ||
      filename.endsWith('.mjs')
    );
  }

  private async loadTool(filename: string): Promise<Tool | null> {
    const discoveredTool = await this.loadToolWithMetadata(filename);
    return discoveredTool?.tool ?? null;
  }

  private async loadToolWithMetadata(
    filename: string
  ): Promise<DiscoveredTool | null> {
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

      return {
        tool,
        source: this.source,
        sourcePath: this.toolsPath,
        filename
      };
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
