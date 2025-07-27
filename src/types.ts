export type JSONSchema = Record<string, unknown>;

export interface Tool<TArgs = unknown> {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: JSONSchema;
  readonly run: (args: TArgs) => Promise<string> | string;
}

/**
 * Source type for discovered tools
 */
export type ToolSource = 'global' | 'local';

/**
 * Enhanced tool with source metadata
 */
export interface DiscoveredTool {
  /** The tool itself */
  readonly tool: Tool;
  /** Source type (global or local) */
  readonly source: ToolSource;
  /** Absolute path to the tools directory */
  readonly sourcePath: string;
  /** Filename of the tool */
  readonly filename: string;
}

/**
 * Results from tool discovery with source tracking
 */
export interface DiscoveryResults {
  /** All discovered tools with source metadata */
  readonly tools: DiscoveredTool[];
  /** Summary of discovery results */
  readonly summary: {
    /** Total number of tools found */
    readonly total: number;
    /** Number of global tools */
    readonly global: number;
    /** Number of local tools */
    readonly local: number;
    /** Tools that had name conflicts (local overrode global) */
    readonly conflicts: string[];
  };
}

/**
 * Utility functions for working with discovery results
 */
export class DiscoveryResultsUtils {
  /**
   * Extracts just the Tool objects from DiscoveryResults for MCPServer compatibility
   */
  static extractTools(results: DiscoveryResults): Tool[] {
    return results.tools.map(dt => dt.tool);
  }

  /**
   * Finds a discovered tool by name
   */
  static findByName(
    results: DiscoveryResults,
    name: string
  ): DiscoveredTool | undefined {
    return results.tools.find(dt => dt.tool.name === name);
  }

  /**
   * Gets tools filtered by source
   */
  static getBySource(
    results: DiscoveryResults,
    source: ToolSource
  ): DiscoveredTool[] {
    return results.tools.filter(dt => dt.source === source);
  }
}
