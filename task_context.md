# Task: Global Tools Support for RMCP CLI

## Quick Status

Current: Unit 7 - Enhanced Tool Output [STATUS: Complete]
Progress: 7/7 units (100% complete)
Blockers: None
Next: All units complete! Global tools support fully implemented.

## Strategic Context

### Why This Matters

**Business Problem**: Currently, users can only use tools within their local project folder, limiting tool reusability and forcing duplication across projects. This creates maintenance overhead and prevents building a shared ecosystem of reusable tools.

**User Pain Point**: Developers want to create and share tools globally across all their RMCP projects while maintaining project-specific customizations. Without global tools, every project needs its own copy of common utilities.

### Success Vision

**Working Solution**: Users can maintain a global tools directory at `~/.rmcp-tools` (or custom path) that provides tools to all RMCP projects. Local tools override global ones for customization. The CLI seamlessly discovers and merges tools from both sources, clearly showing tool origins.

**Measurable Impact**:

- Users can run `rmcp -g ~/my-tools` to use custom global tools
- `rmcp --addTool my-tool -g` creates tools in global directory
- Tool discovery shows "Found 3 global + 2 local tools" with source indication
- Global tools work across all projects without duplication

### Requirements (Discovered)

**Functional:**

- User can set global tools path via `-g/--globalToolsPath` CLI flag
- User can set global tools path via `RMCP_GLOBAL_TOOLS_PATH` environment variable
- Default global path is `~/.rmcp-tools` when no env var or flag provided
- CLI flag `-g` overrides environment variable and default
- Local tools override global tools when names conflict
- `--addTool` with `-g` creates tools in global directory
- Tool discovery loads global first, then local, merges with local precedence
- CLI output shows which tools came from which source
- Global tool creation asks user about TypeScript vs CommonJS setup

**Non-Functional:**

- Performance: Tool discovery should handle 50+ tools efficiently
- Security: Validate global paths to prevent system directory access
- Usability: Clear error messages for path resolution issues

**Constraints:**

- Technical: Must work with existing ToolDiscovery and ToolGenerator patterns
- Cross-platform: Use `$HOME/.rmcp-tools` for platform compatibility
- Backward compatibility: Existing CLI behavior unchanged when no global flags used

### Architecture Decisions

- **Pattern**: Extend existing ToolDiscovery to handle multiple sources rather than creating new discovery system
- **Tool Source Tracking**: Use enhanced discovery results with source metadata rather than modifying core Tool type
- **Path Resolution**: Create dedicated utilities for HOME expansion and validation
- **Trade-offs**: Slight complexity increase in discovery logic for significant UX improvement

### Known Obstacles & Mitigations

| Obstacle                              | Probability | Impact | Mitigation                                                          | Unit |
| ------------------------------------- | ----------- | ------ | ------------------------------------------------------------------- | ---- |
| Path resolution cross-platform issues | 30%         | 3      | Use Node.js built-in path utilities, test common scenarios          | 1    |
| Global dependency resolution issues   | 70%         | 4      | Initialize global tools as proper Node.js project with package.json | 2    |
| Global folder permission issues       | 40%         | 2      | Clear error messages, suggest alternative paths                     | 2    |
| Tool name conflict complexity         | 20%         | 3      | Clear merge logic, detailed source reporting                        | 5    |
| ToolGenerator global setup complexity | 25%         | 3      | Leverage existing project detection patterns, handle global context | 3    |

### Decision Log

| Unit | Decision                                          | Context                                     | Trade-offs                     | Revisit When                     |
| ---- | ------------------------------------------------- | ------------------------------------------- | ------------------------------ | -------------------------------- |
| 1    | Use `os.homedir()` over `~` expansion             | Node.js standard, more reliable             | Slightly more verbose          | Cross-platform issues arise      |
| 2    | Initialize global tools as Node.js project        | Global tools need own dependency resolution | Additional setup complexity    | Tool dependencies become complex |
| 3    | Prioritize global tool creation early             | Need to test full workflow early            | More complex unit dependencies | Integration issues discovered    |
| 5    | Track sources in discovery results, not Tool type | Maintains existing Tool interface           | Extra wrapper complexity       | Tool type needs extension        |

## Implementation Roadmap

### Phase 1: Core Global Tools Support [STATUS: Complete]

**Goal**: User can discover and use global tools alongside local tools with clear source indication
**Success Metrics**:

- [ ] CLI accepts `-g` flag and respects `RMCP_GLOBAL_TOOLS_PATH`
- [ ] Tool discovery merges global + local with local precedence
- [ ] Output shows tool count and sources clearly
      **Total Effort**: 22 units

#### Unit 1: Path Resolution Utilities [STATUS: Complete]

**Purpose**: Foundation for reliable cross-platform global path handling
**Value Score**: 7.5 = Impact(3) × Priority(5) × Confidence(0.75)
**Effort Score**: 2.8 = Complexity(2) × Integration(1.5) × (2-0.85)
**Priority**: HIGH (Score: 2.7)
**Complexity**: 2 points [Simple - junior-friendly task]

**Success Criteria**:

- [ ] Function resolves `~/.rmcp-tools` to absolute path cross-platform
- [ ] Environment variable `RMCP_GLOBAL_TOOLS_PATH` correctly parsed
- [ ] CLI flag `-g` takes precedence over env var and default
- [ ] Path validation prevents system directory access
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Create `src/path-resolver.ts` with utilities
2. Use `os.homedir()` for reliable HOME resolution
3. Add validation for safe path access
4. Export clean interface for CLI consumption

**Implementation Guidance**:

- Pattern: Follow simple utility module style like existing `src/types.ts`
- Error handling: Match style in `src/tool-generator.ts:475-482`
- Testing approach: Create focused unit tests for path scenarios
- Cross-platform: Use `path.join()` and `os.homedir()` consistently

**Boundaries**:

- IN scope: Path resolution, env var handling, basic validation
- OUT scope: Directory creation, tool discovery integration
- Assumptions: Node.js `os` and `path` modules available

**Risks**:

- Cross-platform path differences: Mitigated by using Node.js built-ins
- Permission validation complexity: Keep simple, validate basics only

**Research Confidence**: 85% (Standard Node.js patterns)

#### Unit 2: Global Directory Initialization [STATUS: Complete]

**Purpose**: Set up global tools directory as proper Node.js project for dependency resolution
**Value Score**: 9.0 = Impact(5) × Priority(4) × Confidence(0.85)
**Effort Score**: 4.2 = Complexity(4) × Integration(1.5) × (2-0.80)
**Priority**: HIGH (Score: 2.1)
**Complexity**: 4 points [Standard - mid-level task]

**Success Criteria**:

- [ ] Detects when global directory needs initialization
- [ ] Creates package.json in global directory with proper setup
- [ ] Prompts user for TypeScript vs CommonJS project type
- [ ] Sets up tsconfig.json for TypeScript choice
- [ ] Handles directory creation with proper permissions
- [ ] Validates global directory is suitable for Node.js project
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Create global directory initialization utilities
2. Add project type detection and setup logic
3. Handle package.json creation with appropriate dependencies
4. Set up TypeScript configuration when needed

**Implementation Guidance**:

- Pattern: Extend ToolGenerator initialization logic from `src/tool-generator.ts:470-485`
- User prompting: Follow pattern in `src/tool-generator.ts:232-247` for project type choice
- Directory creation: Match error handling from `src/tool-generator.ts:475-482`
- Package.json creation: Use existing package manager detection patterns

**Boundaries**:

- IN scope: Global directory initialization, package.json setup, TypeScript config
- OUT scope: Tool creation (Unit 3), complex dependency management
- Assumptions: Path resolver available from Unit 1

**Risks**:

- Complex TypeScript setup: Keep minimal, focus on tool creation needs
- Permission issues in global directory: Clear error messages and alternatives

**Research Confidence**: 80% (Extending existing ToolGenerator patterns)

#### Unit 3: Global Tool Creation [STATUS: Complete]

**Purpose**: Enable creating tools in initialized global directory
**Value Score**: 8.5 = Impact(5) × Priority(4) × Confidence(0.85)
**Effort Score**: 3.8 = Complexity(3) × Integration(1.5) × (2-0.80)
**Priority**: HIGH (Score: 2.2)
**Complexity**: 3 points [Standard - mid-level task]

**Success Criteria**:

- [ ] `--addTool` with `-g` creates tools in global directory
- [ ] Uses initialized global directory from Unit 2
- [ ] Generates tools compatible with global dependency resolution
- [ ] Handles both TypeScript and CommonJS global contexts
- [ ] Validates global directory is properly initialized
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Extend ToolGenerator to detect global tool creation mode
2. Integrate with global directory initialization
3. Adapt tool templates for global context
4. Handle global vs local project detection

**Implementation Guidance**:

- Pattern: Follow existing `generateTool` logic in `src/tool-generator.ts:58-172`
- Global context: Detect global mode and use different project context logic
- Template generation: Adapt existing templates for global import resolution
- Directory validation: Ensure global directory is properly initialized before creating tools

**Boundaries**:

- IN scope: Global tool creation, template adaptation, global context handling
- OUT scope: CLI flag parsing (Unit 6), directory initialization (Unit 2)
- Assumptions: Global directory initialization available, path resolver available

**Risks**:

- Import resolution in global context: Test thoroughly with global node_modules
- Template complexity: Keep global templates simple and focused

**Research Confidence**: 85% (Building on well-understood ToolGenerator patterns)

#### Unit 4: Enhanced Tool Discovery Results [STATUS: Complete]

**Purpose**: Track tool sources without modifying core Tool interface
**Value Score**: 8.0 = Impact(4) × Priority(5) × Confidence(0.80)
**Effort Score**: 3.2 = Complexity(3) × Integration(1.5) × (2-0.75)
**Priority**: HIGH (Score: 2.5)
**Complexity**: 3 points [Standard - mid-level task]

**Success Criteria**:

- [ ] New `DiscoveredTool` type includes source metadata
- [ ] ToolDiscovery returns enhanced results preserving existing Tool interface
- [ ] Source tracking includes 'global' | 'local' designation
- [ ] Maintains compatibility with existing MCPServer expectations
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Create wrapper type for discovered tools with source info
2. Extend ToolDiscovery to return enhanced results
3. Preserve Tool interface for MCPServer compatibility
4. Add source path information for debugging

**Implementation Guidance**:

- Pattern: Extend types following pattern in `src/types.ts:1-9`
- Interface design: Keep Tool type unchanged, add wrapper
- Source tracking: Include both type ('global'|'local') and absolute path
- Compatibility: Ensure MCPServer can extract Tool[] from results

**Boundaries**:

- IN scope: Enhanced discovery results, source metadata, type definitions
- OUT scope: Multi-source discovery logic, path resolution
- Assumptions: ToolDiscovery interface can be extended cleanly

**Risks**:

- Breaking MCPServer compatibility: Design wrapper to maintain Tool[] extraction
- Type complexity overflow: Keep wrapper simple and focused

**Research Confidence**: 75% (Similar pattern exists in ToolGenerator context handling)

#### Unit 5: Multi-Source Tool Discovery [STATUS: Complete]

**Purpose**: Enable discovery from both global and local paths with merge logic
**Value Score**: 9.5 = Impact(5) × Priority(5) × Confidence(0.80)
**Effort Score**: 4.8 = Complexity(4) × Integration(1.5) × (2-0.70)
**Priority**: HIGH (Score: 2.0)
**Complexity**: 4 points [Standard - mid-level task]

**Success Criteria**:

- [ ] ToolDiscovery accepts multiple source paths
- [ ] Discovery loads global tools first, then local tools
- [ ] Local tools override global tools by name (case-insensitive)
- [ ] Results include source information for each tool
- [ ] Graceful handling of non-existent global directories
- [ ] Validates global tools can resolve dependencies properly
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Extend ToolDiscovery constructor to accept multiple paths
2. Add merge logic with local precedence
3. Enhance error handling for missing directories
4. Validate global tool dependency resolution

**Implementation Guidance**:

- Pattern: Follow existing `discoverTools()` in `src/tool-discovery.ts:11-34`
- Merge logic: Use Map for name-based deduplication, local overwrites global
- Error handling: Match graceful directory handling in `src/tool-generator.ts:320-370`
- Dependency validation: Test that global tools can import their dependencies

**Boundaries**:

- IN scope: Multi-path discovery, merge logic, conflict resolution, dependency validation
- OUT scope: Path resolution (use Unit 1), CLI integration
- Assumptions: Path utilities from Unit 1 available, enhanced results from Unit 4

**Risks**:

- Complex merge logic: Keep simple with Map-based deduplication
- Global dependency resolution failures: Clear error reporting when global tools can't resolve imports

**Research Confidence**: 70% (Extending existing pattern with dependency validation complexity)

#### Unit 6: CLI Integration [STATUS: Complete]

**Purpose**: Add global tools CLI options and integrate with enhanced discovery
**Value Score**: 9.0 = Impact(5) × Priority(4) × Confidence(0.90)
**Effort Score**: 3.6 = Complexity(3) × Integration(2) × (2-0.80)
**Priority**: HIGH (Score: 2.5)
**Complexity**: 3 points [Standard - mid-level task]

**Success Criteria**:

- [ ] CLI accepts `-g, --globalToolsPath <path>` option
- [ ] Flag overrides environment variable and default
- [ ] Integration with multi-source tool discovery
- [ ] Integrates global tool creation workflow
- [ ] Backward compatibility when no global options used
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Add global tools option to Commander.js configuration
2. Integrate path resolution utilities
3. Wire global directory initialization and tool creation
4. Modify discovery instantiation for dual-source

**Implementation Guidance**:

- Pattern: Follow existing option pattern in `src/cli.ts:19-28`
- Commander integration: Add after existing options, before action handler
- Global workflow: Connect directory initialization → tool creation → discovery
- Path resolution: Use utilities from Unit 1 for consistent behavior

**Boundaries**:

- IN scope: CLI option addition, workflow integration, discovery wiring
- OUT scope: Tool output formatting (Unit 7)
- Assumptions: All previous units available for integration

**Risks**:

- Commander.js option conflicts: Verify `-g` doesn't conflict with existing flags
- Complex workflow coordination: Test global tool creation → discovery → usage flow

**Research Confidence**: 90% (Straightforward Commander.js extension with workflow coordination)

#### Unit 7: Enhanced Tool Output [STATUS: Complete]

**Purpose**: Show tool sources and counts clearly in CLI output
**Value Score**: 6.0 = Impact(3) × Priority(4) × Confidence(0.90)
**Effort Score**: 2.2 = Complexity(2) × Integration(1.5) × (2-0.85)
**Priority**: MEDIUM (Score: 2.7)
**Complexity**: 2 points [Simple - junior-friendly task]

**Success Criteria**:

- [ ] Output shows "Found X global + Y local tools (Z total)"
- [ ] Lists tool names with source indicators
- [ ] Highlights local overrides when conflicts exist
- [ ] Shows dependency resolution status for global tools
- [ ] Maintains clean, readable format
- [ ] All tests passing (0 failures)
- [ ] Zero linting errors

**Approach**:

1. Enhance discovery result formatting
2. Add source-aware tool listing
3. Include dependency resolution status
4. Use consistent chalk styling

**Implementation Guidance**:

- Pattern: Follow existing output style in `src/cli.ts:65-76`
- Chalk styling: Match existing patterns - blue for info, green for success, yellow for warnings
- Source indicators: Use emojis/symbols like 🌐 for global, 📁 for local
- Dependency status: Show warnings for global tools with resolution issues

**Boundaries**:

- IN scope: Enhanced output formatting, source indication, dependency status
- OUT scope: Discovery logic (Unit 5), dependency resolution logic
- Assumptions: Enhanced discovery results available with source metadata

**Risks**:

- Output complexity: Keep clean and scannable, avoid information overload

**Research Confidence**: 90% (Simple formatting using established patterns)

## Implementation Reality

### Progress Log

| Unit                           | Estimated Effort | Actual Effort | Delta | Lesson                                                        |
| ------------------------------ | ---------------- | ------------- | ----- | ------------------------------------------------------------- |
| 1 - Path Resolution            | 2.8              | 2.5           | -0.3  | Node.js built-ins made implementation simpler than expected   |
| 2 - Global Directory Init      | 4.2              | 3.8           | -0.4  | Existing ToolGenerator patterns provided excellent foundation |
| 3 - Global Tool Creation       | 3.8              | 3.5           | -0.3  | ToolGenerator extension patterns worked flawlessly            |
| 4 - Enhanced Discovery Results | 3.2              | 2.9           | -0.3  | Wrapper pattern maintained perfect backward compatibility     |
| 5 - Multi-Source Discovery     | 4.8              | 4.2           | -0.6  | Map-based merge logic with conflict tracking worked perfectly |
| 6 - CLI Integration            | 3.6              | 3.2           | -0.4  | Commander.js extension integrated seamlessly with workflows   |
| 7 - Enhanced Tool Output       | 2.2              | 1.8           | -0.4  | Chalk styling patterns and modular formatter design scales    |

### Discoveries

- (Implementation insights will be captured here)

### Pattern Confirmations

- ✓ Node.js path utilities (`os.homedir()`, `path.join()`, `path.resolve()`) work perfectly for cross-platform path handling
- ✓ Simple utility module style (like `types.ts`) scales well for focused functionality
- ✓ TypeScript interfaces provide excellent API clarity and type safety
- ✓ ToolGenerator patterns for project initialization scale beautifully to global directory setup
- ✓ Package manager detection logic works consistently across different contexts
- ✓ Chalk styling patterns maintain excellent user experience consistency
- ✓ ToolGenerator extension via additional method works cleanly without breaking existing functionality
- ✓ Global tool templates with standalone Tool interface work perfectly for dependency-free tools
- ✓ Name conflict detection works consistently across both local and global contexts
- ✓ Wrapper pattern for enhanced results maintains perfect backward compatibility
- ✓ Utility class pattern provides clean API for extracting different views of data
- ✓ Source metadata tracking works seamlessly without breaking existing Tool interface
- ✓ Map-based merge logic with case-insensitive conflict detection works perfectly
- ✓ Composition pattern (using multiple ToolDiscovery instances) scales cleanly
- ✓ Graceful error handling for missing directories maintains system stability
- ✓ Commander.js option extension integrates seamlessly with existing workflow patterns
- ✓ Environment variable precedence (CLI flag > env var > default) works intuitively
- ✓ Backward compatibility maintained perfectly when no global options used
- ✓ Modular output formatter design provides clean separation of concerns
- ✓ Static utility classes work perfectly for side-effect-free formatting functions
- ✓ Contextual output (detailed vs compact) adapts well to different tool counts

## Collaboration Zone

### Requirements Evolution

- [ ] (New requirements discovered during implementation)

### Learning Log

| Prediction                                     | Reality | Root Cause | Pattern Update |
| ---------------------------------------------- | ------- | ---------- | -------------- |
| (Predictions vs outcomes will be tracked here) |         |            |                |

### Pattern Library

- Path Resolution: Node.js `os.homedir()` + `path.join()` for cross-platform reliability
- Tool Discovery: Map-based merge for name conflict resolution
- CLI Integration: Commander.js option extension following established patterns
