import chalk from 'chalk';
import { join } from 'path';
import {
  existsSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync
} from 'fs';
import { spawn } from 'child_process';
import type { PackageManagerInfo, PackageJson } from './tool-generator.js';
import type { ResolvedGlobalPath } from './path-resolver.js';

/**
 * Project type for global tools directory
 */
export type GlobalProjectType = 'typescript' | 'commonjs';

/**
 * Global directory initialization result
 */
export interface GlobalDirectoryInfo {
  /** Absolute path to global directory */
  path: string;
  /** Whether directory was newly created */
  created: boolean;
  /** Project type (TypeScript or CommonJS) */
  projectType: GlobalProjectType;
  /** Package manager info if Node.js project */
  packageManager: PackageManagerInfo | null;
  /** Whether directory is properly initialized */
  initialized: boolean;
}

/**
 * Manages global tools directory initialization and setup
 */
export class GlobalDirectoryManager {
  /**
   * Initializes a global tools directory as a proper Node.js project
   *
   * @param globalPath - Resolved global path information
   * @returns Directory information after initialization
   */
  async initializeGlobalDirectory(
    globalPath: ResolvedGlobalPath
  ): Promise<GlobalDirectoryInfo> {
    const { path: globalDirPath } = globalPath;

    console.error(
      chalk.blue(`🌐 Initializing global tools directory: ${globalDirPath}`)
    );

    // Ensure directory exists
    const created = this.ensureDirectoryExists(globalDirPath);

    // Check if already initialized
    const packageJsonPath = join(globalDirPath, 'package.json');
    const isInitialized = existsSync(packageJsonPath);

    if (isInitialized) {
      console.error(chalk.green('   ✅ Directory already initialized'));
      const info = this.analyzeExistingDirectory(globalDirPath);
      return {
        path: globalDirPath,
        created,
        projectType: info.projectType,
        packageManager: info.packageManager,
        initialized: true
      };
    }

    // Prompt user for project type
    const projectType = await this.promptForProjectType();

    // Create package.json
    this.createPackageJson(globalDirPath, projectType);

    // Set up TypeScript config if needed
    if (projectType === 'typescript') {
      this.createTypeScriptConfig(globalDirPath);
    }

    // Detect package manager for future use
    const packageManager = this.detectPackageManager(globalDirPath);

    // Install dependencies
    await this.installDependencies(globalDirPath, packageManager);

    console.error(
      chalk.green('✅ Global tools directory initialized successfully')
    );
    console.error(chalk.gray(`   📝 Project type: ${projectType}`));
    if (packageManager) {
      console.error(
        chalk.gray(`   📦 Package manager: ${packageManager.manager}`)
      );
    }

    return {
      path: globalDirPath,
      created,
      projectType,
      packageManager,
      initialized: true
    };
  }

  /**
   * Checks if a global directory needs initialization
   *
   * @param globalDirPath - Absolute path to global directory
   * @returns True if initialization is needed
   */
  needsInitialization(globalDirPath: string): boolean {
    const packageJsonPath = join(globalDirPath, 'package.json');
    return !existsSync(packageJsonPath);
  }

  /**
   * Validates that global directory is suitable for Node.js project
   *
   * @param globalDirPath - Absolute path to validate
   * @throws Error if directory is not suitable
   */
  validateGlobalDirectory(globalDirPath: string): void {
    if (!existsSync(globalDirPath)) {
      return; // Will be created during initialization
    }

    // Check if it's a directory
    const stat = statSync(globalDirPath);
    if (!stat.isDirectory()) {
      throw new Error(
        `Global tools path exists but is not a directory: ${globalDirPath}`
      );
    }

    // Check write permissions by attempting to create a test file
    try {
      const testFile = join(globalDirPath, '.rmcp-test');
      writeFileSync(testFile, 'test');
      unlinkSync(testFile);
    } catch (error) {
      throw new Error(
        `No write permissions for global tools directory: ${globalDirPath}\n` +
          `Check directory permissions and try again.\n` +
          `Error: ${error}`
      );
    }
  }

  private ensureDirectoryExists(dirPath: string): boolean {
    try {
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.error(chalk.gray(`   📁 Created global directory: ${dirPath}`));
        return true;
      }
      return false;
    } catch (error) {
      console.error(chalk.red(`❌ Error creating global directory: ${error}`));
      console.error(
        chalk.yellow(
          '   Check directory permissions and parent directory access'
        )
      );
      process.exit(1);
    }
  }

  private async promptForProjectType(): Promise<GlobalProjectType> {
    console.error(chalk.yellow('\n📝 Global tools project setup'));
    console.error(
      chalk.blue('   Choose project type for your global tools directory:')
    );
    console.error(
      chalk.gray(
        '   1. TypeScript (recommended): Better type safety, modern features'
      )
    );
    console.error(
      chalk.gray('   2. CommonJS: Simple JavaScript, broader compatibility')
    );

    // Prompt for user input
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });

    return new Promise<GlobalProjectType>(resolve => {
      rl.question(
        chalk.blue('   Enter your choice (1 or 2, default: 1): '),
        (answer: string) => {
          rl.close();

          const choice = answer.trim() || '1';

          if (choice === '2' || choice.toLowerCase() === 'commonjs') {
            console.error(chalk.green('   ✅ Selected: CommonJS'));
            resolve('commonjs');
          } else {
            console.error(chalk.green('   ✅ Selected: TypeScript'));
            resolve('typescript');
          }
        }
      );
    });
  }

  private createPackageJson(
    globalDirPath: string,
    projectType: GlobalProjectType
  ): void {
    const packageJsonPath = join(globalDirPath, 'package.json');

    const packageJson: PackageJson = {
      name: '@rmcp/global-tools',
      version: '1.0.0',
      description: 'Global tools for RMCP CLI',
      private: true,
      ...(projectType === 'typescript'
        ? { type: 'module' }
        : { type: 'commonjs' }),
      scripts: {
        ...(projectType === 'typescript' && {
          'type-check': 'tsc --noEmit',
          build: 'tsc'
        })
      },
      dependencies: {},
      devDependencies: {
        ...(projectType === 'typescript' && {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0'
        })
      }
    };

    try {
      writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n',
        'utf-8'
      );
      console.error(chalk.gray(`   📄 Created package.json`));
    } catch (error) {
      console.error(chalk.red(`❌ Error creating package.json: ${error}`));
      process.exit(1);
    }
  }

  private createTypeScriptConfig(globalDirPath: string): void {
    const tsconfigPath = join(globalDirPath, 'tsconfig.json');

    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        allowJs: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        outDir: './dist',
        rootDir: './src'
      },
      include: ['src/**/*', '*.ts', '*.js'],
      exclude: ['node_modules', 'dist']
    };

    try {
      writeFileSync(
        tsconfigPath,
        JSON.stringify(tsconfig, null, 2) + '\n',
        'utf-8'
      );
      console.error(chalk.gray(`   📄 Created tsconfig.json`));
    } catch (error) {
      console.error(chalk.red(`❌ Error creating tsconfig.json: ${error}`));
      process.exit(1);
    }
  }

  private detectPackageManager(projectPath: string): PackageManagerInfo | null {
    // Check for existing lock files first
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

    // Default to npm if no lock file found
    return { manager: 'npm', lockFile: 'package-lock.json' };
  }

  private analyzeExistingDirectory(globalDirPath: string): {
    projectType: GlobalProjectType;
    packageManager: PackageManagerInfo | null;
  } {
    const packageJsonPath = join(globalDirPath, 'package.json');
    const tsconfigPath = join(globalDirPath, 'tsconfig.json');

    let projectType: GlobalProjectType = 'commonjs';

    // Determine project type from existing files
    if (existsSync(packageJsonPath)) {
      try {
        const packageContent = readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);

        // Check for TypeScript indicators
        const hasTypeScriptDeps =
          packageJson.devDependencies?.typescript ||
          packageJson.dependencies?.typescript;
        const hasTypeModule = packageJson.type === 'module';
        const hasTsConfig = existsSync(tsconfigPath);

        if (hasTypeScriptDeps || hasTsConfig || hasTypeModule) {
          projectType = 'typescript';
        }
      } catch (error) {
        console.warn(
          chalk.yellow(
            `⚠️  Warning: Could not parse existing package.json: ${error}`
          )
        );
      }
    }

    const packageManager = this.detectPackageManager(globalDirPath);

    return {
      projectType,
      packageManager
    };
  }

  /**
   * Installs dependencies for the global tools directory
   */
  private async installDependencies(
    globalDirPath: string,
    packageManager: PackageManagerInfo | null
  ): Promise<void> {
    if (!packageManager) {
      console.error(
        chalk.yellow(
          '   ⚠️  No package manager detected, skipping dependency installation'
        )
      );
      return;
    }

    const { manager } = packageManager;
    console.error(
      chalk.blue(`   📦 Installing dependencies with ${manager}...`)
    );

    try {
      await this.runPackageManagerCommand(manager, ['install'], globalDirPath);
      console.error(chalk.green(`   ✅ Dependencies installed successfully`));
    } catch (error) {
      console.error(
        chalk.yellow(`   ⚠️  Warning: Failed to install dependencies: ${error}`)
      );
      console.error(
        chalk.gray(
          `   💡 You can manually install dependencies later by running:`
        )
      );
      console.error(
        chalk.gray(`      cd ${globalDirPath} && ${manager} install`)
      );
    }
  }

  /**
   * Runs a package manager command
   */
  private runPackageManagerCommand(
    manager: string,
    args: string[],
    cwd: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(manager, args, {
        cwd,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `${manager} install failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`
            )
          );
        }
      });

      child.on('error', error => {
        reject(error);
      });
    });
  }
}
