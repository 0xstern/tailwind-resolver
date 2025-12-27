/**
 * Smart file writing utilities with change detection
 * Only writes files when meaningful content has changed, ignoring timestamp differences
 */

import { readFile, writeFile } from 'node:fs/promises';

/**
 * Regular expression patterns for timestamp lines in generated files
 * These patterns match timestamps that should be ignored when comparing file content
 */
const TIMESTAMP_PATTERNS: ReadonlyArray<RegExp> = [
  // TypeScript/JavaScript JSDoc comment: ` * Generated at: 2025-01-15T10:30:00.000Z`
  /^\s*\*\s*Generated at:\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?\s*$/gm,
  // Markdown bold: `**Generated:** 2025-01-15T10:30:00.000Z`
  /^\*\*Generated:\*\*\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?\s*$/gm,
  // JSON property: `"generatedAt": "2025-01-15T10:30:00.000Z"`
  /"generatedAt":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?"/g,
];

/**
 * Strips timestamp patterns from content for comparison purposes
 * This allows comparing file content while ignoring generated timestamps
 *
 * @param content - The file content to process
 * @returns Content with timestamp patterns replaced with a placeholder
 */
export function stripTimestamps(content: string): string {
  let result = content;

  for (const pattern of TIMESTAMP_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[TIMESTAMP]');
  }

  return result;
}

/**
 * Checks if content has changed by comparing without timestamps
 *
 * @param existingContent - The current file content (may be undefined if file doesn't exist)
 * @param newContent - The new content to compare
 * @returns True if the meaningful content has changed
 */
export function hasContentChanged(
  existingContent: string | undefined,
  newContent: string,
): boolean {
  if (existingContent === undefined) {
    return true;
  }

  const strippedExisting = stripTimestamps(existingContent);
  const strippedNew = stripTimestamps(newContent);

  return strippedExisting !== strippedNew;
}

/**
 * Result of a smart write operation
 */
export interface SmartWriteResult {
  /** Whether the file was written (true) or skipped (false) */
  written: boolean;
  /** The file path */
  filePath: string;
}

/**
 * Writes a file only if its meaningful content has changed
 * Compares content excluding timestamps to avoid unnecessary writes
 *
 * @param filePath - Path to the file to write
 * @param content - New content to write
 * @returns Promise resolving to write result indicating if file was written
 */
export async function smartWriteFile(
  filePath: string,
  content: string,
): Promise<SmartWriteResult> {
  let existingContent: string | undefined;

  try {
    existingContent = await readFile(filePath, 'utf-8');
  } catch {
    // File doesn't exist, will write
    existingContent = undefined;
  }

  if (!hasContentChanged(existingContent, content)) {
    return { written: false, filePath };
  }

  await writeFile(filePath, content, 'utf-8');
  return { written: true, filePath };
}

/**
 * Writes multiple files, only if their meaningful content has changed
 * Processes all files in parallel for performance
 *
 * @param files - Array of file path and content pairs
 * @returns Promise resolving to array of write results
 */
export async function smartWriteFiles(
  files: ReadonlyArray<{ filePath: string; content: string }>,
): Promise<Array<SmartWriteResult>> {
  return Promise.all(
    files.map(({ filePath, content }) => smartWriteFile(filePath, content)),
  );
}

/**
 * Writes a file only if its meaningful content has changed
 * Compatible version that returns Promise<void> for drop-in replacement of fs.writeFile
 *
 * @param filePath - Path to the file to write
 * @param content - New content to write
 * @returns Promise resolving when operation completes
 */
export async function smartWriteFileCompat(
  filePath: string,
  content: string,
): Promise<void> {
  await smartWriteFile(filePath, content);
}
