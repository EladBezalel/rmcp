# rmcp

A TypeScript CLI tool that automatically boots a local MCP server from a specific folder and exposes tools via a predefined API. Supports both JavaScript and TypeScript tools with no build step required.

## Installation

Run directly with Bun (no installation required):

```bash
# Run directly
bunx @rmcp/cli

# Or install globally  
bun install -g @rmcp/cli
```

## Usage

```bash
# Use default ./rmcp-tools folder
bunx @rmcp/cli

# Or specify a custom folder
bunx @rmcp/cli <folder>
```

By default, rmcp looks for tools in the `./rmcp-tools` directory in your current working directory. You can override this by providing a folder path as the first argument.

### Options

- `-n, --name <name>`: Server name (default: "rmcp")
- `-s, --server-version <version>`: Server version (default: "1.0.0")

### Examples

```bash
# Start server with tools from default ./rmcp-tools folder
bunx @rmcp/cli

# Start server with tools from ./my-tools folder
bunx @rmcp/cli ./my-tools

# Start with custom name and server version
bunx @rmcp/cli ./my-tools --name "my-server" --server-version "2.0.0"

# Development mode
bun run src/cli.ts
```

## Tool Interface

Tools must export a default object that implements this interface:

```typescript
export interface Tool<S extends TSchema = TSchema, Ctx = unknown> {
    readonly name: string;
    readonly description?: string;
    readonly inputSchema: S;
    readonly run: (args: StaticDecode<S>, ctx: Ctx) => Promise<string>;
}
```

### Example Tools

#### JavaScript Tool (CommonJS)

```javascript
const { Type } = require('@sinclair/typebox');

const myTool = {
    name: 'echo',
    description: 'Echoes back the input message',
    inputSchema: Type.Object({
        message: Type.String({ description: 'The message to echo back' })
    }),
    run: async (args, ctx) => {
        return `Echo: ${args.message}`;
    }
};

module.exports = { default: myTool };
```

#### TypeScript Tool (ESM) - No Build Required

```typescript
import { Type, StaticDecode } from '@sinclair/typebox';
import { Tool } from '../src/types.js';

const timestampSchema = Type.Object({
    format: Type.Optional(Type.Union([
        Type.Literal('iso'),
        Type.Literal('unix'), 
        Type.Literal('readable')
    ], { description: 'Format for the timestamp', default: 'iso' }))
});

const timestampTool: Tool<typeof timestampSchema> = {
    name: 'timestamp',
    description: 'Returns the current timestamp in various formats',
    inputSchema: timestampSchema,
    run: async (args: StaticDecode<typeof timestampSchema>, _ctx) => {
        const now = new Date();
        
        switch (args.format) {
            case 'unix':
                return `Unix timestamp: ${Math.floor(now.getTime() / 1000)}`;
            case 'readable':
                return `Readable: ${now.toLocaleString()}`;
            case 'iso':
            default:
                return `ISO timestamp: ${now.toISOString()}`;
        }
    }
};

export default timestampTool;
```

## Adding to Claude/Cursor

Once running, add the server to your Claude/Cursor MCP configuration:

### Using Built Binary

```json
{
  "mcpServers": {
    "rmcp": {
      "command": "bunx",
      "args": ["@rmcp/cli"]
    }
  }
}
```

### Development Mode

```json
{
  "mcpServers": {
    "rmcp-dev": {
      "command": "bun",
      "args": ["run", "/path/to/rmcp/src/cli.ts"]
    }
  }
}
```

### With Custom Folder

```json
{
  "mcpServers": {
    "rmcp": {
      "command": "bunx",
      "args": ["@rmcp/cli", "/path/to/your/tools/folder"]
    }
  }
}
```

## Features

- ✅ **No Build Step**: TypeScript tools run directly with Bun
- ✅ **Default Folder**: Uses `./rmcp-tools` by default
- ✅ **Mixed Languages**: Support for both JS and TS tools in the same folder
- ✅ **Type Safety**: Full TypeScript support with proper typing
- ✅ **Auto Discovery**: Automatically finds and loads all `.js`, `.ts`, and `.mjs` files
- ✅ **Error Handling**: Graceful error handling for malformed tools

## Development

### Using Bun (Recommended)

```bash
# Install dependencies
bun install

# Run directly
bun run src/cli.ts

# Test with example tools
bun run src/cli.ts ./rmcp-tools
```

### Using npm

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev

# Lint
npm run lint

# Type check
npm run typecheck
```