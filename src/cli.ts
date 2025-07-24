#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { ToolDiscovery } from './tool-discovery.js';
import { MCPServer } from './mcp-server.js';
import { ToolGenerator } from './tool-generator.js';

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
    '-a, --addTool [toolName]',
    'Generate a new tool file with optional name (default: example-tool)',
    'example-tool'
  )
  .action(
    async (
      folderPath: string,
      options: {
        name: string;
        serverVersion: string;
        addTool?: string;
      }
    ) => {
      try {
        // Shared workspace path resolution
        const WORKSPACE_PATH =
          process.env.WORKSPACE_FOLDER_PATHS ?? process.cwd();
        const resolvedPath = resolve(WORKSPACE_PATH, folderPath);

        // Handle tool generation mode
        if (options.addTool !== undefined) {
          // Resolve tools path for generation

          // Use ToolGenerator to handle all tool generation logic
          const projectPath = WORKSPACE_PATH;
          const generator = new ToolGenerator(projectPath);

          await generator.generateTool({
            toolName: options.addTool,
            toolsPath: resolvedPath,
            projectPath
          });

          return;
        }

        console.error(
          chalk.blue(`🚀 Starting MCP server from: ${resolvedPath}`)
        );

        // Discover tools
        const discovery = new ToolDiscovery(resolvedPath);
        console.error(chalk.yellow('🔍 Discovering tools...'));

        const tools = await discovery.discoverTools();

        if (tools.length === 0) {
          console.error(
            chalk.red('❌ No valid tools found in the specified folder')
          );
          process.exit(1);
        }

        console.error(chalk.green(`✅ Found ${tools.length} tool(s)`));

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

program.parse();
