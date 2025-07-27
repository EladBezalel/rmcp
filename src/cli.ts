#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { ToolDiscovery } from './tool-discovery.js';
import { MultiSourceToolDiscovery } from './multi-source-discovery.js';
import { MCPServer } from './mcp-server.js';
import { ToolGenerator } from './tool-generator.js';
import { DiscoveryResultsUtils } from './types.js';
import { resolveGlobalToolsPath } from './path-resolver.js';
import { ToolOutputFormatter } from './tool-output-formatter.js';

const program = new Command();

program
  .name('rmcp')
  .description('Boot MCP servers from folders with predefined tool APIs')
  .version('1.0.0')
  .argument(
    '[folder]',
    'Path to the folder containing tool files',
    './rmcp-tools'
  )
  .option('-n, --name <n>', 'Server name', 'rmcp')
  .option('-s, --server-version <version>', 'Server version', '1.0.0')
  .option(
    '-g, --globalToolsPath [path]',
    'Use global tools directory (optional path overrides RMCP_GLOBAL_TOOLS_PATH env var and default)'
  )
  .option(
    '-a, --addTool [toolName]',
    'Generate a new tool file with optional name (default: example-tool)'
  )
  .action(
    async (
      folderPath: string,
      options: {
        name: string;
        serverVersion: string;
        globalToolsPath?: string;
        addTool?: string;
      }
    ) => {
      try {
        // Shared workspace path resolution
        const WORKSPACE_PATH =
          process.env.WORKSPACE_FOLDER_PATHS ?? process.cwd();
        const resolvedPath = resolve(WORKSPACE_PATH, folderPath);

        const globalPath = resolveGlobalToolsPath({
          cliPath:
            typeof options.globalToolsPath === 'string'
              ? options.globalToolsPath
              : undefined
        });

        // Handle tool generation mode
        if (options.addTool !== undefined) {
          // Set default tool name if not provided
          const toolName = options.addTool || 'example-tool';
          // Use ToolGenerator to handle all tool generation logic
          const projectPath = WORKSPACE_PATH;
          const generator = new ToolGenerator(projectPath);

          // Determine if this is global tool creation
          const isGlobalTool = options.globalToolsPath !== undefined;

          let toolsPath: string;
          if (isGlobalTool) {
            toolsPath = globalPath.path;
            console.error(chalk.blue(`🌐 Creating global tool: ${toolName}`));
            console.error(
              chalk.gray(
                `   📁 Global directory: ${globalPath.path} (${globalPath.source})`
              )
            );
          } else {
            toolsPath = resolvedPath;
          }

          await generator.generateTool({
            toolName,
            toolsPath,
            projectPath,
            isGlobal: isGlobalTool
          });

          return;
        }

        console.error(
          chalk.blue(`🚀 Starting MCP server from: ${resolvedPath}`)
        );

        // Discover tools - always check for global tools and fall back gracefully
        console.error(chalk.yellow('🔍 Discovering tools...'));

        let tools;
        if (globalPath.exists) {
          // Multi-source discovery (global + local)
          const multiDiscovery = new MultiSourceToolDiscovery({
            localPath: resolvedPath,
            globalPath: globalPath.path
          });

          const results = await multiDiscovery.discoverTools();
          tools = DiscoveryResultsUtils.extractTools(results);

          // Enhanced output with source information
          ToolOutputFormatter.displayEnhancedToolResults(results, globalPath);
        } else {
          // Single-source discovery (local only) - global directory doesn't exist
          const discovery = new ToolDiscovery(resolvedPath);
          tools = await discovery.discoverTools();

          if (tools.length === 0) {
            console.error(
              chalk.red('❌ No valid tools found in the specified folder')
            );
            process.exit(1);
          }

          // Simple output for local-only discovery
          ToolOutputFormatter.displaySimpleToolResults(tools);
        }

        // Start MCP server
        const server = new MCPServer(
          options.name,
          options.serverVersion,
          tools
        );

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.error(chalk.yellow('\n🛑 Shutting down MCP server...'));
          await server.stop();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          console.error(chalk.yellow('\n🛑 Shutting down MCP server...'));
          await server.stop();
          process.exit(0);
        });

        // Start the server
        await server.start();
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error);
        process.exit(1);
      }
    }
  );

// Tool output formatting utilities imported from dedicated module

program.parse();
