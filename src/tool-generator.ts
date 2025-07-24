import chalk from 'chalk';
import { resolve, join } from 'path';
import {
  existsSync,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync
} from 'fs';
import { execSync } from 'child_process';

// Tool name validation regex for kebab-case
const TOOL_NAME_REGEX = /^[a-z]+(-[a-z]+)*$/;
const RESERVED_NAMES = [
  'index',
  'cli',
  'server',
  'types',
  'tool-discovery',
  'mcp-server'
];

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface PackageManagerInfo {
  manager: 'npm' | 'yarn' | 'bun' | 'pnpm';
  lockFile: string;
}

export interface ContextInfo {
  isInsideRepo: boolean;
  projectPath: string;
  packageManager: PackageManagerInfo | null;
  hasRmcpDependency: boolean;
  hasTypeScriptSupport: boolean;
}

export interface ToolGeneratorOptions {
  toolName: string;
  toolsPath: string;
  projectPath?: string;
}

export class ToolGenerator {
  private projectPath: string;
  private packageJson: PackageJson | null; // null if doesn't exist or parse error

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.packageJson = this.parsePackageJson();
  }

  /**
   * Parse package.json once during construction
   * @returns Parsed package.json object or null if file doesn't exist/can't be parsed
   */
  private parsePackageJson(): PackageJson | null {
    const packageJsonPath = join(this.projectPath, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageContent = readFileSync(packageJsonPath, 'utf-8');
      return JSON.parse(packageContent);
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️  Warning: Could not parse package.json at ${packageJsonPath}: ${error}`
        )
      );
      return null;
    }
  }

  async generateTool(options: ToolGeneratorOptions): Promise<void> {
    const { toolName, toolsPath } = options;

    // Validate tool name
    const validatedName = this.validateToolName(toolName);

    // Check for conflicts
    this.checkToolNameConflict(validatedName, toolsPath);

    // Detect project context
    const context = this.detectProjectContext();

    console.error(chalk.blue(`🛠️  Generating new tool: ${validatedName}`));

    const hasPackageJson = this.packageJson !== null;

    if (!hasPackageJson) {
      // No package.json = CommonJS standalone tool (no dependency management possible)
      console.error(
        chalk.gray(
          '   📍 No package.json found - generating standalone CommonJS tool'
        )
      );
      const template = this.generateCommonJSTemplate(validatedName);
      this.writeToolFile(validatedName, template, toolsPath, context);
      return;
    }

    if (!context.hasTypeScriptSupport) {
      // Package.json exists but no TypeScript support = CommonJS with package management
      console.error(
        chalk.gray(
          '   📍 CommonJS project detected (no TypeScript support) - generating standalone CommonJS tool'
        )
      );
      const template = this.generateCommonJSTemplate(validatedName);
      this.writeToolFile(validatedName, template, toolsPath, context);
      return;
    }

    // TypeScript project detected (has package.json and TypeScript support via dependency or tsconfig.json)
    if (context.isInsideRepo) {
      console.error(
        chalk.gray('   📍 Inside rmcp repository - using local imports')
      );
    } else {
      console.error(chalk.gray('   📍 External TypeScript project detected'));

      if (!context.hasRmcpDependency) {
        const packageManager = context.packageManager || {
          manager: 'npm',
          lockFile: 'package-lock.json'
        };
        console.error(
          chalk.yellow(
            `   📦 Package manager detected: ${packageManager.manager} (${packageManager.lockFile})`
          )
        );

        const shouldInstall = this.promptUserForDependency(
          packageManager.manager
        );
        if (shouldInstall) {
          this.addRmcpDependency(context.projectPath, packageManager);
        } else {
          console.error(
            chalk.red('❌ Cannot generate tool without @rmcp/cli dependency')
          );
          process.exit(1);
        }
      } else {
        console.error(chalk.green('   ✅ @rmcp/cli dependency found'));
      }
    }

    // Generate TypeScript template with appropriate imports
    const template = this.generateTypeScriptTemplate(
      validatedName,
      context.isInsideRepo
    );
    this.writeToolFile(validatedName, template, toolsPath, context);
  }

  private detectPackageManager(projectPath: string): PackageManagerInfo | null {
    const lockFiles: Array<{
      file: string;
      manager: PackageManagerInfo['manager'];
    }> = [
      { file: 'bun.lockb', manager: 'bun' },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'package-lock.json', manager: 'npm' }
    ];

    for (const { file, manager } of lockFiles) {
      const lockPath = join(projectPath, file);
      if (existsSync(lockPath)) {
        return { manager, lockFile: file };
      }
    }

    return null; // No lock file found, will default to npm
  }

  private isInsideRmcpRepo(): boolean {
    return this.packageJson?.name === '@rmcp/cli';
  }

  private checkRmcpDependency(): boolean {
    if (!this.packageJson) return false;

    const deps = this.packageJson.dependencies || {};
    const devDeps = this.packageJson.devDependencies || {};

    return '@rmcp/cli' in deps || '@rmcp/cli' in devDeps;
  }

  private checkTypeScriptDependency(): boolean {
    if (!this.packageJson) return false;

    const deps = this.packageJson.dependencies || {};
    const devDeps = this.packageJson.devDependencies || {};

    return 'typescript' in deps || 'typescript' in devDeps;
  }

  private hasTypeScriptSupport(): boolean {
    // Check for either TypeScript dependency OR tsconfig.json existence
    const hasTsConfig = existsSync(join(this.projectPath, 'tsconfig.json'));
    const hasTsDependency = this.checkTypeScriptDependency();

    return hasTsConfig || hasTsDependency;
  }

  private getLatestRmcpVersion(): string {
    try {
      const version = execSync('npm view @rmcp/cli version', {
        encoding: 'utf-8',
        timeout: 10000 // 10 second timeout
      }).trim();
      return version;
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Warning: Could not fetch latest version: ${error}`)
      );
      return '^1.0.0'; // Fallback version
    }
  }

  private promptUserForDependency(packageManager: string): boolean {
    console.error(chalk.yellow('\n📦 External project detected!'));
    console.error(
      chalk.blue(
        '   To use rmcp tools, we need to add @rmcp/cli as a dependency.'
      )
    );
    console.error(
      chalk.gray(`   This will run: ${packageManager} add @rmcp/cli`)
    );

    // For now, auto-approve in CLI context (no interactive prompt available)
    // In a real implementation, you might want to add a --yes flag or use readline
    console.error(
      chalk.green('   ✅ Proceeding with dependency installation...')
    );

    return true;
  }

  private addRmcpDependency(
    projectPath: string,
    packageManager: PackageManagerInfo
  ): void {
    try {
      const version = this.getLatestRmcpVersion();
      console.error(chalk.blue(`📦 Installing @rmcp/cli@${version}...`));

      const installCommand = (() => {
        switch (packageManager.manager) {
          case 'bun':
            return `bun add @rmcp/cli@${version}`;
          case 'pnpm':
            return `pnpm add @rmcp/cli@${version}`;
          case 'yarn':
            return `yarn add @rmcp/cli@${version}`;
          default:
            return `npm install @rmcp/cli@${version}`;
        }
      })();

      execSync(installCommand, {
        cwd: projectPath,
        stdio: 'inherit',
        timeout: 60000 // 60 second timeout
      });

      console.error(
        chalk.green('✅ Successfully installed @rmcp/cli dependency')
      );
    } catch (error) {
      console.error(chalk.red(`❌ Error installing dependency: ${error}`));
      console.error(
        chalk.yellow('   You may need to install @rmcp/cli manually:')
      );
      console.error(chalk.gray(`   ${packageManager.manager} add @rmcp/cli`));
      process.exit(1);
    }
  }

  private detectProjectContext(): ContextInfo {
    const isInsideRepo = this.isInsideRmcpRepo();
    const packageManager = this.detectPackageManager(this.projectPath);
    const hasRmcpDependency = this.checkRmcpDependency();
    const typeScriptSupport = this.hasTypeScriptSupport();

    return {
      isInsideRepo,
      projectPath: this.projectPath,
      packageManager,
      hasRmcpDependency,
      hasTypeScriptSupport: typeScriptSupport
    };
  }

  private isToolFile(filename: string): boolean {
    return (
      filename.endsWith('.js') ||
      filename.endsWith('.ts') ||
      filename.endsWith('.mjs')
    );
  }

  private extractToolNameFromFile(filename: string): string {
    // Remove file extension and return base name
    return filename.replace(/\.(js|ts|mjs)$/, '');
  }

  private checkToolNameConflict(toolName: string, toolsPath: string): void {
    // Normalize tool name for comparison (case-insensitive on case-insensitive filesystems)
    const normalizedToolName = toolName.toLowerCase();

    // Handle non-existent directories gracefully
    if (!existsSync(toolsPath)) {
      // No conflict if directory doesn't exist
      return;
    }

    const stat = statSync(toolsPath);
    if (!stat.isDirectory()) {
      // No conflict if path is not a directory
      return;
    }

    try {
      const files = readdirSync(toolsPath);

      for (const file of files) {
        if (this.isToolFile(file)) {
          const existingToolName = this.extractToolNameFromFile(file);
          const normalizedExistingName = existingToolName.toLowerCase();

          if (normalizedExistingName === normalizedToolName) {
            console.error(
              chalk.red(`❌ Error: Tool '${toolName}' already exists`)
            );
            console.error(
              chalk.yellow(`   Existing file: ${resolve(toolsPath, file)}`)
            );
            console.error(
              chalk.yellow(
                '   Choose a different tool name or remove the existing file first'
              )
            );
            process.exit(1);
          }
        }
      }
    } catch (error) {
      // Handle permission errors or other filesystem issues gracefully
      console.warn(
        chalk.yellow(`⚠️  Warning: Could not scan tools directory: ${error}`)
      );
      console.warn(
        chalk.yellow(
          '   Proceeding with tool generation (conflict check skipped)'
        )
      );
    }
  }

  private validateToolName(toolName: string): string {
    if (!TOOL_NAME_REGEX.test(toolName)) {
      console.error(
        chalk.red(
          '❌ Error: Tool name must be in kebab-case format (e.g., my-tool)'
        )
      );
      console.error(
        chalk.yellow('   Valid characters: lowercase letters and hyphens only')
      );
      process.exit(1);
    }

    if (RESERVED_NAMES.includes(toolName)) {
      console.error(
        chalk.red(
          `❌ Error: '${toolName}' is a reserved name and cannot be used`
        )
      );
      console.error(
        chalk.yellow(`   Reserved names: ${RESERVED_NAMES.join(', ')}`)
      );
      process.exit(1);
    }

    return toolName;
  }

  private generateTypeScriptTemplate(
    toolName: string,
    isInsideRepo: boolean
  ): string {
    const importPath = isInsideRepo ? '../src/types' : '@rmcp/cli';

    return `import type { Tool } from '${importPath}';

interface ${this.toPascalCase(toolName)}Args {
  // Define your input arguments here
  readonly message: string;
}

const ${this.toCamelCase(toolName)}: Tool<${this.toPascalCase(toolName)}Args> = {
  name: '${toolName}',
  description: 'A description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'An example input parameter',
      },
    },
    required: ['message'],
  },
  run: async args => {
    // Implement your tool logic here
    return \`Tool ${toolName} received: \${args.message}\`;
  },
};

// eslint-disable-next-line import/no-default-export
export default ${this.toCamelCase(toolName)};
`;
  }

  private generateCommonJSTemplate(toolName: string): string {
    return `// Standalone CommonJS tool - no external dependencies required
const ${this.toCamelCase(toolName)} = {
  name: '${toolName}',
  description: 'A description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'An example input parameter',
      },
    },
    required: ['message'],
  },
  run: async (args) => {
    // Implement your tool logic here
    return \`Tool ${toolName} received: \${args.message}\`;
  },
};

module.exports = ${this.toCamelCase(toolName)};
`;
  }

  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  private ensureDirectoryExists(dirPath: string): void {
    try {
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.error(chalk.gray(`   📁 Created directory: ${dirPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error creating directory: ${error}`));
      console.error(
        chalk.yellow('   Check directory permissions and try again')
      );
      process.exit(1);
    }
  }

  private writeToolFile(
    toolName: string,
    content: string,
    toolsPath: string,
    context: ContextInfo
  ): void {
    const fileExtension = context.hasTypeScriptSupport ? '.ts' : '.js';
    const fileName = `${toolName}${fileExtension}`;
    const filePath = join(toolsPath, fileName);

    try {
      this.ensureDirectoryExists(toolsPath);

      writeFileSync(filePath, content, 'utf-8');

      console.error(chalk.green(`✅ Created tool file: ${filePath}`));
      console.error(
        chalk.gray(
          `   📝 File type: ${fileExtension === '.ts' ? 'TypeScript' : 'CommonJS JavaScript'}`
        )
      );

      // Provide usage hints
      console.error(chalk.blue('\n📚 Next steps:'));
      console.error(
        chalk.gray('   1. Edit the generated file to implement your tool logic')
      );
      console.error(
        chalk.gray('   2. Update the input schema to match your requirements')
      );
      console.error(chalk.gray('   3. Test your tool with the MCP server'));
    } catch (error) {
      console.error(chalk.red(`❌ Error writing tool file: ${error}`));
      console.error(
        chalk.yellow('   Check file permissions and available disk space')
      );
      process.exit(1);
    }
  }
}
