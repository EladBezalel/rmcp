#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { ToolDiscovery } from './tool-discovery.js';
import { MCPServer } from './mcp-server.js';

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
  .option('-n, --name <name>', 'Server name', 'rmcp')
  .option('-s, --server-version <version>', 'Server version', '1.0.0')
  .action(
    async (
      folderPath: string,
      options: { name: string; serverVersion: string }
    ) => {
      try {
        const resolvedPath = resolve(
          process.env.WORKSPACE_FOLDER_PATHS ?? process.cwd(),
          folderPath
        );

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
