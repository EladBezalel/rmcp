import chalk from 'chalk';
import type { DiscoveryResults, Tool } from './types.js';
import type { ResolvedGlobalPath } from './path-resolver.js';

/**
 * Enhanced tool output utilities for displaying tool discovery results
 */
export class ToolOutputFormatter {
  /**
   * Displays enhanced tool discovery results with source information
   */
  static displayEnhancedToolResults(
    results: DiscoveryResults,
    globalInfo: ResolvedGlobalPath | null
  ): void {
    const { summary, tools } = results;

    // Check for empty results
    if (summary.total === 0) {
      console.error(
        chalk.red('❌ No valid tools found in local or global directories')
      );
      process.exit(1);
    }

    // Main summary with enhanced formatting
    console.error(
      chalk.green(
        `✅ Found ${summary.global} global + ${summary.local} local tools (${summary.total} total)`
      )
    );

    // Conflict information
    if (summary.conflicts.length > 0) {
      console.error(
        chalk.yellow(
          `   ⚠️  ${summary.conflicts.length} conflicts resolved (local tools override global)`
        )
      );
    }

    // Global source information
    if (globalInfo) {
      const sourceLabel = this.getSourceLabel(globalInfo.source);
      console.error(
        chalk.gray(`   🌐 Global tools from: ${globalInfo.path} ${sourceLabel}`)
      );
    }

    // Detailed tool listing with source indicators
    if (tools.length <= 10) {
      // Show detailed list for reasonable number of tools
      console.error(chalk.blue('\n📋 Tool Details:'));

      const globalTools = tools.filter(t => t.source === 'global');
      const localTools = tools.filter(t => t.source === 'local');

      if (globalTools.length > 0) {
        console.error(chalk.gray('   🌐 Global tools:'));
        globalTools.forEach(dt => {
          const status = summary.conflicts.includes(dt.tool.name)
            ? chalk.yellow(' (overridden)')
            : '';
          console.error(
            chalk.gray(
              `     • ${dt.tool.name}: ${dt.tool.description || 'No description'}${status}`
            )
          );
        });
      }

      if (localTools.length > 0) {
        console.error(chalk.gray('   📁 Local tools:'));
        localTools.forEach(dt => {
          const isOverride = summary.conflicts.includes(dt.tool.name);
          const status = isOverride ? chalk.green(' (overrides global)') : '';
          console.error(
            chalk.gray(
              `     • ${dt.tool.name}: ${dt.tool.description || 'No description'}${status}`
            )
          );
        });
      }
    } else {
      // Compact view for many tools
      console.error(chalk.blue('\n📋 Tools loaded (showing first 10):'));
      tools.slice(0, 10).forEach(dt => {
        const sourceIcon = dt.source === 'global' ? '🌐' : '📁';
        console.error(
          chalk.gray(
            `   ${sourceIcon} ${dt.tool.name}: ${dt.tool.description || 'No description'}`
          )
        );
      });

      if (tools.length > 10) {
        console.error(chalk.gray(`   ... and ${tools.length - 10} more tools`));
      }
    }
  }

  /**
   * Displays simple tool results for single-source discovery
   */
  static displaySimpleToolResults(tools: Tool[]): void {
    console.error(chalk.green(`✅ Found ${tools.length} tool(s)`));

    if (tools.length <= 5) {
      // Show tool names for small number of tools
      console.error(chalk.gray('   📁 Local tools:'));
      tools.forEach(tool => {
        console.error(
          chalk.gray(
            `     • ${tool.name}: ${tool.description || 'No description'}`
          )
        );
      });
    }
  }

  /**
   * Gets a formatted source label for display
   */
  private static getSourceLabel(
    source: 'cli-flag' | 'env-var' | 'default'
  ): string {
    switch (source) {
      case 'cli-flag':
        return chalk.blue('(from CLI flag)');
      case 'env-var':
        return chalk.yellow('(from RMCP_GLOBAL_TOOLS_PATH)');
      case 'default':
        return chalk.gray('(default)');
    }
  }
}
