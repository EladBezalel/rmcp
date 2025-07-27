import { resolve, join, isAbsolute, sep } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

/**
 * Default global tools directory name relative to user's home directory
 */
const DEFAULT_GLOBAL_TOOLS_DIR = '.rmcp-tools';

/**
 * Environment variable name for global tools path override
 */
const GLOBAL_TOOLS_ENV_VAR = 'RMCP_GLOBAL_TOOLS_PATH';

/**
 * Forbidden system directories that should not be used as global tools paths
 */
const FORBIDDEN_PATHS = [
  '/',
  '/bin',
  '/usr',
  '/usr/bin',
  '/usr/local',
  '/usr/local/bin',
  '/etc',
  '/var',
  '/tmp',
  '/System',
  '/Library',
  'C:\\',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)'
];

/**
 * Options for resolving global tools path
 */
export interface GlobalPathOptions {
  /** CLI flag override path */
  cliPath?: string;
  /** Whether to validate the resolved path for safety */
  validate?: boolean;
}

/**
 * Result of path resolution with metadata
 */
export interface ResolvedGlobalPath {
  /** The resolved absolute path */
  path: string;
  /** Source of the path resolution */
  source: 'cli-flag' | 'env-var' | 'default';
  /** Whether the path exists */
  exists: boolean;
}

/**
 * Resolves the global tools path with precedence: CLI flag > env var > default
 *
 * @param options - Configuration options for path resolution
 * @returns Resolved path information with source metadata
 * @throws Error if path validation fails
 */
export function resolveGlobalToolsPath(
  options: GlobalPathOptions = {}
): ResolvedGlobalPath {
  const { cliPath, validate = true } = options;

  let resolvedPath: string;
  let source: ResolvedGlobalPath['source'];

  // Precedence: CLI flag > environment variable > default
  if (cliPath && cliPath !== '') {
    resolvedPath = expandHomePath(cliPath);
    source = 'cli-flag';
  } else if (process.env[GLOBAL_TOOLS_ENV_VAR]) {
    resolvedPath = expandHomePath(process.env[GLOBAL_TOOLS_ENV_VAR]);
    source = 'env-var';
  } else {
    resolvedPath = getDefaultGlobalToolsPath();
    source = 'default';
  }

  // Ensure absolute path
  resolvedPath = resolve(resolvedPath);

  // Validate path safety if requested
  if (validate) {
    validateGlobalPath(resolvedPath);
  }

  // Check if path exists (but don't create it here)
  const exists = existsSync(resolvedPath);

  return {
    path: resolvedPath,
    source,
    exists
  };
}

/**
 * Expands ~ to the user's home directory in a path
 *
 * @param inputPath - Path that may contain ~ prefix
 * @returns Expanded absolute path
 */
export function expandHomePath(inputPath: string): string {
  if (inputPath.startsWith('~/') || inputPath === '~') {
    return join(homedir(), inputPath.slice(1) || '');
  }

  return inputPath;
}

/**
 * Gets the default global tools path (~/.rmcp-tools)
 *
 * @returns Absolute path to default global tools directory
 */
export function getDefaultGlobalToolsPath(): string {
  return join(homedir(), DEFAULT_GLOBAL_TOOLS_DIR);
}

/**
 * Validates that a global tools path is safe to use
 *
 * @param globalPath - Absolute path to validate
 * @throws Error if path is unsafe or forbidden
 */
export function validateGlobalPath(globalPath: string): void {
  if (!isAbsolute(globalPath)) {
    throw new Error(`Global tools path must be absolute: ${globalPath}`);
  }

  // Normalize path for comparison (handle case sensitivity and separators)
  const normalizedPath = resolve(globalPath).toLowerCase();

  // Check against forbidden system directories
  for (const forbidden of FORBIDDEN_PATHS) {
    const normalizedForbidden = resolve(forbidden).toLowerCase();

    if (
      normalizedPath === normalizedForbidden ||
      normalizedPath.startsWith(normalizedForbidden + sep)
    ) {
      throw new Error(
        `Global tools path cannot be in system directory: ${globalPath}\n` +
          `This path is forbidden for security reasons.`
      );
    }
  }

  // Ensure path is within user's home directory or explicitly allowed locations
  const homeDir = resolve(homedir()).toLowerCase();
  const isInHomeDir =
    normalizedPath.startsWith(homeDir + sep) || normalizedPath === homeDir;

  // Allow paths in home directory or custom user-specified locations outside forbidden areas
  if (!isInHomeDir) {
    // For paths outside home, just ensure they're not in forbidden system areas
    // This allows flexibility for users who want global tools elsewhere
    console.warn(
      `Warning: Global tools path is outside home directory: ${globalPath}\n` +
        `Ensure you have proper permissions for this location.`
    );
  }
}
