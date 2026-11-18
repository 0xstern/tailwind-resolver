#!/usr/bin/env bun
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { color } from 'bun';

// ANSI Color Definitions
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RESET_BOLD = '\x1b[22m';

const COLOR_SUCCESS = color('#95a863', 'ansi-256') ?? '';
const COLOR_ERROR = color('red', 'ansi') ?? '';

// Check Characters
const CHECK_MARK = `${COLOR_SUCCESS}✓${RESET}`;
const CROSS_MARK = `${COLOR_ERROR}✖${RESET}`;

console.log(
  `${BOLD}Tailwind Theme Resolver - Build Process${RESET_BOLD}${RESET}`,
);

// Configuration
const BYTES_PER_KILOBYTE = 1024;
const FILE_SIZE_DECIMAL_PLACES = 2;

const outDir = './dist';
const target = 'node' as const;
const sourcemap = 'linked' as const;
const minify = true;
const external = ['postcss', 'postcss-import', 'postcss-value-parser', 'vite'];

// Entry points for different builds
const entryPoints = [
  // Root index (exports from v4)
  { name: 'index', path: 'src/index.ts', outputName: 'index' },

  // v4 main entry
  { name: 'v4-index', path: 'src/v4/index.ts', outputName: 'v4/index' },

  // v4 CLI
  { name: 'v4-cli', path: 'src/v4/cli/index.ts', outputName: 'v4/cli' },

  // v4 Vite plugin
  {
    name: 'v4-vite-plugin',
    path: 'src/v4/vite/index.ts',
    outputName: 'v4/vite-plugin',
  },
  {
    name: 'v4-type-generator',
    path: 'src/v4/shared/type_generator.ts',
    outputName: 'v4/type_generator',
  },
  {
    name: 'v4-spacing_helper',
    path: 'src/v4/shared/spacing_helper.ts',
    outputName: 'v4/shared/spacing_helper',
  },
];

/**
 * Runtime exports of a module: export name mapped to `typeof` its value
 */
type ExportShape = Record<string, string>;

/**
 * Node program that loads each bundle path it receives (`.mjs` via import,
 * anything else via require) and prints a JSON report mapping every path to
 * its export shape, or to the error raised while loading it
 */
const DESCRIBE_BUNDLE_EXPORTS = `
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const report = {};
for (const file of process.argv.slice(2)) {
  try {
    const moduleExports = file.endsWith('.mjs')
      ? await import(pathToFileURL(file).href)
      : require(file);
    report[file] = Object.fromEntries(
      Object.keys(moduleExports)
        .sort()
        .map((name) => [name, typeof moduleExports[name]]),
    );
  } catch (error) {
    report[file] = String(error);
  }
}
process.stdout.write(JSON.stringify(report));
`;

async function cleanOutputDirectory(): Promise<void> {
  console.log(`\nCleaning output directory...${RESET}`);
  try {
    await fs.rm(outDir, { recursive: true, force: true });
    console.log(
      `  ${CHECK_MARK} Removed existing directory: ${outDir}${RESET}`,
    );
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code !== 'ENOENT'
    ) {
      console.error(
        `  ${CROSS_MARK} Error during cleanup: ${COLOR_ERROR}${error}${RESET}`,
      );
      process.exit(1);
    } else {
      console.log(`  ${CHECK_MARK} Directory did not exist: ${outDir}${RESET}`);
    }
  }
  await fs.mkdir(outDir, { recursive: true });
  console.log(`  ${CHECK_MARK} Created directory: ${outDir}${RESET}`);
}

/**
 * Formats file size in kilobytes
 *
 * @param bytes - File size in bytes
 * @returns Formatted string with KB suffix
 */
function formatFileSize(bytes: number): string {
  return (bytes / BYTES_PER_KILOBYTE).toFixed(FILE_SIZE_DECIMAL_PLACES);
}

/**
 * Ensures output directory exists for an entry point
 *
 * @param entryOutputName - Output name for the entry point
 */
async function ensureOutputDir(entryOutputName: string): Promise<void> {
  const outputDir = path.dirname(path.join(outDir, entryOutputName));
  await fs.mkdir(outputDir, { recursive: true });
}

/**
 * Identifies the CLI entry point, which runs on load and exposes no exports
 *
 * @param entry - Entry point configuration
 * @param entry.outputName - Output file name
 * @returns True when the entry point builds the CLI
 */
function isCliEntry(entry: { outputName: string }): boolean {
  return entry.outputName.includes('cli');
}

/**
 * Builds a single module in specified format
 *
 * Bundles always carry an explicit module extension: package.json declares
 * `"type": "module"`, so Node would load a CommonJS bundle named `.js` as ESM
 * and fail with `module is not defined in ES module scope`.
 *
 * @param entry - Entry point configuration
 * @param entry.name - Entry point name
 * @param entry.path - Entry point source path
 * @param entry.outputName - Output file name
 * @param format - Module format (esm or cjs)
 */
async function buildModule(
  entry: { name: string; path: string; outputName: string },
  format: 'esm' | 'cjs',
): Promise<void> {
  const extension = format === 'esm' ? '.mjs' : '.cjs';

  // Create nested directory if needed
  await ensureOutputDir(entry.outputName);

  const result = await Bun.build({
    entrypoints: [entry.path],
    outdir: outDir,
    target,
    format,
    sourcemap,
    minify,
    external,
    naming: `${entry.outputName}${extension}`,
  });

  if (!result.success) {
    console.error(
      `  ${CROSS_MARK} ${COLOR_ERROR}Failed to build ${entry.outputName} (${format.toUpperCase()})${RESET}`,
    );
    for (const log of result.logs) {
      console.error(`    ${COLOR_ERROR}${log.message}${RESET}`);
    }
    throw new Error(`Build failed for ${entry.outputName}`);
  }

  const output = result.outputs[0];
  if (output === undefined) {
    throw new Error(`No output generated for ${format} build`);
  }

  const fileSizeKB = formatFileSize(output.size);
  console.log(
    `    ${CHECK_MARK} ${entry.outputName}${extension} (${fileSizeKB} KB)${RESET}`,
  );
}

/**
 * Builds all modules in parallel (both ESM and CJS formats)
 * Significantly faster than sequential builds
 */
async function buildAllModules(): Promise<void> {
  console.log(`\n${BOLD}Building ESM modules...${RESET_BOLD}${RESET}`);

  // Build all ESM modules in parallel
  const esmPromises = entryPoints.map(async (entry) => {
    console.log(`  Building ${entry.outputName}.mjs...${RESET}`);
    return buildModule(entry, 'esm');
  });

  await Promise.all(esmPromises);

  console.log(`\n${BOLD}Building CommonJS modules...${RESET_BOLD}${RESET}`);

  // Build all CJS modules in parallel
  const cjsPromises = entryPoints.map(async (entry) => {
    console.log(`  Building ${entry.outputName}.cjs...${RESET}`);
    return buildModule(entry, 'cjs');
  });

  await Promise.all(cjsPromises);
}

/**
 * Checks whether a value is a non-null object that can be indexed by key
 *
 * @param value - Value to check
 * @returns True when the value is a non-array object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Describes a module's runtime exports, sorted by name so that shapes built
 * here and by DESCRIBE_BUNDLE_EXPORTS serialize identically
 *
 * @param moduleExports - Module namespace object
 * @returns Export shape of the module
 */
function describeExports(moduleExports: Record<string, unknown>): ExportShape {
  const shape: ExportShape = {};
  for (const name of Object.keys(moduleExports).sort()) {
    shape[name] = typeof moduleExports[name];
  }
  return shape;
}

/**
 * Pairs every library bundle (ESM and CJS) with the export shape of its
 * source module. The CLI is skipped: it exposes nothing and runs on load.
 *
 * @returns Absolute bundle paths with their expected export shapes
 */
async function collectExpectedExports(): Promise<
  Array<{ file: string; expected: ExportShape }>
> {
  const libraryEntries = entryPoints.filter((entry) => !isCliEntry(entry));
  const expectations = await Promise.all(
    libraryEntries.map(async (entry) => {
      const sourceModule = (await import(path.resolve(entry.path))) as Record<
        string,
        unknown
      >;
      const expected = describeExports(sourceModule);
      return ['.mjs', '.cjs'].map((extension) => ({
        file: path.resolve(outDir, `${entry.outputName}${extension}`),
        expected,
      }));
    }),
  );
  return expectations.flat();
}

/**
 * Loads bundles in a Node subprocess, the runtime consumers use, and returns
 * the report printed by DESCRIBE_BUNDLE_EXPORTS
 *
 * @param files - Absolute bundle paths
 * @returns Report mapping each path to its export shape or load error
 */
async function describeBundlesInNode(
  files: Array<string>,
): Promise<Record<string, unknown>> {
  // Run from a real module file, not `node --eval`: eval exposes Node's
  // built-in modules (`module`, `fs`, `os`, ...) as globals, which can hide
  // exactly the undeclared-binding errors this check exists to catch
  const scriptDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tailwind-resolver-'),
  );
  const scriptPath = path.join(scriptDir, 'describe_bundle_exports.mjs');

  let stdout: string;
  let stderr: string;
  let exitCode: number;
  try {
    await fs.writeFile(scriptPath, DESCRIBE_BUNDLE_EXPORTS, 'utf-8');
    const proc = Bun.spawn(['node', scriptPath, ...files], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
  } finally {
    await fs.rm(scriptDir, { recursive: true, force: true });
  }

  if (exitCode !== 0) {
    throw new Error(`Node exited with code ${exitCode}: ${stderr}`);
  }

  const report: unknown = JSON.parse(stdout);
  if (!isRecord(report)) {
    throw new Error(`Unexpected export report from Node: ${stdout}`);
  }
  return report;
}

/**
 * Compares a bundle's reported exports with those of its source module
 *
 * @param expected - Export shape of the source module
 * @param actual - Report entry for the bundle (export shape or load error)
 * @returns Description of the mismatch, or null when the bundle matches
 */
function findExportMismatch(
  expected: ExportShape,
  actual: unknown,
): string | null {
  if (typeof actual === 'string') {
    return `failed to load: ${actual}`;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    return `exports ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
  }
  return null;
}

/**
 * Verifies that every library bundle loads in Node and exposes the same
 * runtime exports as its source module.
 *
 * A bundler bug can emit an export clause that references a binding it
 * dropped. The build still succeeds and the bundle fails only when a consumer
 * loads it (#18, #19), so the build has to load the bundles to catch it.
 */
async function verifyBundleExports(): Promise<void> {
  console.log(
    `\n${BOLD}Verifying bundle exports in Node...${RESET_BOLD}${RESET}`,
  );

  const expectations = await collectExpectedExports();
  const report = await describeBundlesInNode(
    expectations.map(({ file }) => file),
  );

  const failures: Array<string> = [];
  for (const { file, expected } of expectations) {
    const bundleName = path.relative(outDir, file);
    const mismatch = findExportMismatch(expected, report[file]);

    if (mismatch === null) {
      const exportCount = Object.keys(expected).length;
      console.log(
        `    ${CHECK_MARK} ${bundleName} (${exportCount} exports)${RESET}`,
      );
    } else {
      failures.push(bundleName);
      console.error(
        `  ${CROSS_MARK} ${COLOR_ERROR}${bundleName} ${mismatch}${RESET}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Export verification failed for ${failures.join(', ')}`);
  }
}

async function buildTypes(): Promise<void> {
  console.log(
    `\n${BOLD}Generating TypeScript declarations...${RESET_BOLD}${RESET}`,
  );

  const proc = Bun.spawn(
    [
      'bunx',
      'tsc',
      '--project',
      'tsconfig.build.json',
      '--declaration',
      '--emitDeclarationOnly',
      '--outDir',
      'dist',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error(
      `  ${CROSS_MARK} ${COLOR_ERROR}TypeScript compilation failed:${RESET}`,
    );
    console.error(`    ${COLOR_ERROR}${stderr}${RESET}`);
    process.exit(1);
  }

  console.log(
    `  ${CHECK_MARK} Generated type declarations in ${outDir}${RESET}`,
  );

  // Create re-export file for vite-plugin.d.ts
  const vitePluginDts = `/**
 * Vite plugin for automatic Tailwind theme type generation
 */
export { tailwindResolver } from './vite/index';
export type { VitePluginOptions } from './vite/index';
`;
  await fs.writeFile(
    path.join(outDir, 'v4', 'vite-plugin.d.ts'),
    vitePluginDts,
    'utf-8',
  );
  console.log(`  ${CHECK_MARK} Created re-export: v4/vite-plugin.d.ts${RESET}`);
}

async function listBuildArtifacts(
  dir: string,
  prefix: string = '',
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    const stats = await fs.stat(fullPath);

    if (entry.isDirectory()) {
      console.log(`  ${CHECK_MARK} ${prefix}${entry.name}/`);
      await listBuildArtifacts(fullPath, `${prefix}${entry.name}/`);
    } else {
      const sizeKB = (stats.size / BYTES_PER_KILOBYTE).toFixed(
        FILE_SIZE_DECIMAL_PLACES,
      );
      console.log(
        `  ${CHECK_MARK} ${prefix}${entry.name} (${sizeKB} KB)${RESET}`,
      );
    }
  }
}

async function addShebangToCLI(): Promise<void> {
  const cliPath = path.join(outDir, 'v4', 'cli.cjs');
  const content = await fs.readFile(cliPath, 'utf-8');

  // Add shebang if not present (use node since it's more compatible)
  if (!content.startsWith('#!')) {
    const wrappedContent = `#!/usr/bin/env node
${content}`;
    await fs.writeFile(cliPath, wrappedContent, 'utf-8');
  }

  // Make executable (0o755 = rwxr-xr-x)
  const EXECUTABLE_MODE = 0o755;
  await fs.chmod(cliPath, EXECUTABLE_MODE);

  console.log(`  ${CHECK_MARK} Added shebang and made CLI executable${RESET}`);
}

async function executeBuildProcess(): Promise<void> {
  await cleanOutputDirectory();
  await buildAllModules();
  await verifyBundleExports();
  await buildTypes();
  await addShebangToCLI();

  console.log(`\n${BOLD}Build artifacts:${RESET_BOLD}${RESET}`);
  await listBuildArtifacts(outDir);
}

// Script Execution
executeBuildProcess()
  .then(() => {
    console.log(
      `\n${CHECK_MARK} ${BOLD}${COLOR_SUCCESS}Build completed successfully${RESET_BOLD}${RESET}`,
    );
  })
  .catch((err) => {
    console.error(
      `\n${CROSS_MARK} ${BOLD}${COLOR_ERROR}Build failed:${RESET_BOLD}${RESET}`,
      err,
    );
    process.exit(1);
  });
