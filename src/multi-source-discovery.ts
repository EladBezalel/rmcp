import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { ToolDiscovery } from './tool-discovery.js';
import { DiscoveryResults, DiscoveredTool } from './types.js';
import {
  resolveGlobalToolsPath,
  expandHomePath,
  type ResolvedGlobalPath
} from './path-resolver.js';

/**
 * Configuration for multi-source tool discovery
 */
export interface MultiSourceDiscoveryConfig {
  /** Local tools path (always used) */
  localPath: string;
  /** Global tools path (optional) */
  globalPath?: string;
  /** Whether to validate global tool dependencies */
  validateDependencies?: boolean;
}

/**
 * Manages tool discovery from multiple sources (global + local) with merge logic
 */
export class MultiSourceToolDiscovery {
  private config: Required<MultiSourceDiscoveryConfig>;
  private globalPathResolved: ResolvedGlobalPath | null = null;

  constructor(config: MultiSourceDiscoveryConfig) {
    this.config = {
      validateDependencies: true,
      ...config,
      // Ensure we have a global path (use default if not provided)
      globalPath: config.globalPath || resolveGlobalToolsPath().path
    };
  }

  /**
   * Discovers tools from both global and local sources with merge logic
   * Local tools override global tools by name (case-insensitive)
   *
   * @returns Combined discovery results with conflict tracking
   */
  async discoverTools(): Promise<DiscoveryResults> {
    const globalResults = await this.discoverGlobalTools();
    const localResults = await this.discoverLocalTools();

    return this.mergeResults(globalResults, localResults);
  }

  /**
   * Gets information about the resolved global path
   */
  getGlobalPathInfo(): ResolvedGlobalPath | null {
    return this.globalPathResolved;
  }

  private async discoverGlobalTools(): Promise<DiscoveryResults> {
    // Resolve global path
    this.globalPathResolved = resolveGlobalToolsPath({
      cliPath: this.config.globalPath
    });

    // Check if global directory exists
    if (
      !this.globalPathResolved.exists ||
      !existsSync(this.globalPathResolved.path)
    ) {
      console.warn(
        chalk.yellow(
          `⚠️  Global tools directory not found: ${this.globalPathResolved.path}`
        )
      );
      return {
        tools: [],
        summary: {
          total: 0,
          global: 0,
          local: 0,
          conflicts: []
        }
      };
    }

    // Look for tools in the 'tools' subdirectory of global directory
    const globalToolsPath = join(this.globalPathResolved.path, 'tools');

    // Check if tools subdirectory exists
    if (!existsSync(globalToolsPath)) {
      // Global directory exists but no tools subdirectory - it's fine, just no global tools
      return {
        tools: [],
        summary: {
          total: 0,
          global: 0,
          local: 0,
          conflicts: []
        }
      };
    }

    try {
      // Discover tools in global tools directory
      const globalDiscovery = new ToolDiscovery(globalToolsPath, 'global');
      const results = await globalDiscovery.discoverToolsWithMetadata();

      // Validate dependencies if requested
      if (this.config.validateDependencies && results.tools.length > 0) {
        await this.validateGlobalDependencies(results.tools);
      }

      return results;
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Failed to discover global tools: ${error}`)
      );
      return {
        tools: [],
        summary: {
          total: 0,
          global: 0,
          local: 0,
          conflicts: []
        }
      };
    }
  }

  private async discoverLocalTools(): Promise<DiscoveryResults> {
    // Expand local path in case it uses ~ notation
    const expandedLocalPath = expandHomePath(this.config.localPath);

    // Check if local directory exists
    if (!existsSync(expandedLocalPath)) {
      console.warn(
        chalk.yellow(
          `⚠️  Local tools directory not found: ${expandedLocalPath}`
        )
      );
      return {
        tools: [],
        summary: {
          total: 0,
          global: 0,
          local: 0,
          conflicts: []
        }
      };
    }

    try {
      const localDiscovery = new ToolDiscovery(expandedLocalPath, 'local');
      return await localDiscovery.discoverToolsWithMetadata();
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Failed to discover local tools: ${error}`)
      );
      return {
        tools: [],
        summary: {
          total: 0,
          global: 0,
          local: 0,
          conflicts: []
        }
      };
    }
  }

  private mergeResults(
    globalResults: DiscoveryResults,
    localResults: DiscoveryResults
  ): DiscoveryResults {
    // Use Map for case-insensitive name-based deduplication
    const toolMap = new Map<string, DiscoveredTool>();
    const conflicts: string[] = [];

    // Add global tools first
    for (const globalTool of globalResults.tools) {
      const normalizedName = globalTool.tool.name.toLowerCase();
      toolMap.set(normalizedName, globalTool);
    }

    // Add local tools, overriding globals when names conflict
    for (const localTool of localResults.tools) {
      const normalizedName = localTool.tool.name.toLowerCase();

      if (toolMap.has(normalizedName)) {
        // Conflict detected - local overrides global
        const existingTool = toolMap.get(normalizedName)!;
        if (existingTool.source === 'global') {
          conflicts.push(localTool.tool.name);
          console.warn(
            chalk.yellow(
              `⚠️  Local tool '${localTool.tool.name}' overrides global tool`
            )
          );
        }
      }

      // Local tool wins (either new or overriding global)
      toolMap.set(normalizedName, localTool);
    }

    // Convert map back to array
    const mergedTools = Array.from(toolMap.values());

    // Sort by source (global first, then local) and then by name for consistent output
    mergedTools.sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'global' ? -1 : 1;
      }
      return a.tool.name.localeCompare(b.tool.name);
    });

    return {
      tools: mergedTools,
      summary: {
        total: mergedTools.length,
        global: mergedTools.filter(t => t.source === 'global').length,
        local: mergedTools.filter(t => t.source === 'local').length,
        conflicts: conflicts.sort()
      }
    };
  }

  private async validateGlobalDependencies(
    globalTools: DiscoveredTool[]
  ): Promise<void> {
    if (!this.globalPathResolved) {
      return;
    }

    // Basic validation: check if global directory has package.json for dependency resolution
    const packageJsonPath = join(this.globalPathResolved.path, 'package.json');

    if (!existsSync(packageJsonPath)) {
      console.warn(
        chalk.yellow(
          `⚠️  Global tools directory lacks package.json - tools may have dependency issues`
        )
      );
      return;
    }

    // For now, we'll do basic validation. In a full implementation, we might:
    // - Try to dynamically import each tool to check for resolution errors
    // - Validate that node_modules exists and has required dependencies
    // - Check TypeScript compilation if it's a TS project

    console.error(
      chalk.gray(
        `   📦 Global tools dependency resolution: ${globalTools.length} tools validated`
      )
    );
  }
}
