/**
 * Unit tests for smart file writer with change detection
 * Tests timestamp stripping and content comparison functionality
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  hasContentChanged,
  smartWriteFile,
  smartWriteFileCompat,
  smartWriteFiles,
  stripTimestamps,
} from '../../../../src/v4/core/utils/smart_writer';

describe('stripTimestamps', () => {
  describe('TypeScript/JavaScript JSDoc timestamps', () => {
    it('should strip JSDoc timestamp comments', () => {
      const content = `/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * Generated at: 2025-01-15T10:30:00.000Z
 *
 * To modify: Edit your theme CSS file
 */`;

      const result = stripTimestamps(content);

      expect(result).toContain('[TIMESTAMP]');
      expect(result).not.toContain('2025-01-15T10:30:00.000Z');
    });

    it('should strip timestamps without milliseconds', () => {
      const content = ` * Generated at: 2025-01-15T10:30:00Z`;

      const result = stripTimestamps(content);

      expect(result).toContain('[TIMESTAMP]');
      expect(result).not.toContain('2025-01-15T10:30:00Z');
    });

    it('should handle multiple timestamp occurrences', () => {
      const content = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
// Some code
/**
 * Generated at: 2025-12-31T23:59:59.999Z
 */`;

      const result = stripTimestamps(content);

      expect(result.match(/\[TIMESTAMP\]/g)?.length).toBe(2);
      expect(result).not.toContain('2025-01-15');
      expect(result).not.toContain('2025-12-31');
    });
  });

  describe('Markdown timestamps', () => {
    it('should strip markdown bold timestamps', () => {
      const content = `# CSS Rule Conflicts

**Generated:** 2025-01-15T10:30:00.000Z
**Source:** ../input.css`;

      const result = stripTimestamps(content);

      expect(result).toContain('[TIMESTAMP]');
      expect(result).not.toContain('2025-01-15T10:30:00.000Z');
      expect(result).toContain('**Source:**');
    });

    it('should strip markdown timestamps without milliseconds', () => {
      const content = `**Generated:** 2025-01-15T10:30:00Z`;

      const result = stripTimestamps(content);

      expect(result).toContain('[TIMESTAMP]');
    });
  });

  describe('JSON timestamps', () => {
    it('should strip JSON generatedAt property', () => {
      const content = JSON.stringify(
        {
          generatedAt: '2025-01-15T10:30:00.000Z',
          source: '../input.css',
          summary: { total: 5 },
        },
        null,
        2,
      );

      const result = stripTimestamps(content);

      expect(result).toContain('[TIMESTAMP]');
      expect(result).not.toContain('2025-01-15T10:30:00.000Z');
      expect(result).toContain('"source"');
    });

    it('should handle compact JSON format', () => {
      const content = `{"generatedAt":"2025-01-15T10:30:00.000Z","source":"test.css"}`;

      const result = stripTimestamps(content);

      expect(result).toContain('[TIMESTAMP]');
      expect(result).not.toContain('2025-01-15');
    });
  });

  describe('mixed content', () => {
    it('should strip all timestamp formats in mixed content', () => {
      const content = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
export const data = {
  "generatedAt": "2025-01-15T10:30:00.000Z"
};`;

      const result = stripTimestamps(content);

      expect(result.match(/\[TIMESTAMP\]/g)?.length).toBe(2);
      expect(result).not.toContain('2025-01-15');
    });
  });

  describe('content without timestamps', () => {
    it('should return unchanged content when no timestamps present', () => {
      const content = `export interface Theme {
  colors: { primary: string };
}`;

      const result = stripTimestamps(content);

      expect(result).toBe(content);
    });
  });
});

describe('hasContentChanged', () => {
  it('should return true when existing content is undefined', () => {
    const result = hasContentChanged(undefined, 'new content');

    expect(result).toBe(true);
  });

  it('should return false when content is identical', () => {
    const content = `export interface Theme {
  colors: { primary: string };
}`;

    const result = hasContentChanged(content, content);

    expect(result).toBe(false);
  });

  it('should return false when only timestamps differ', () => {
    const existing = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
export interface Theme {}`;

    const newContent = `/**
 * Generated at: 2025-12-31T23:59:59.999Z
 */
export interface Theme {}`;

    const result = hasContentChanged(existing, newContent);

    expect(result).toBe(false);
  });

  it('should return true when actual content differs', () => {
    const existing = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
export interface Theme {
  colors: { primary: string };
}`;

    const newContent = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
export interface Theme {
  colors: { primary: string; secondary: string };
}`;

    const result = hasContentChanged(existing, newContent);

    expect(result).toBe(true);
  });

  it('should detect changes in JSON reports', () => {
    const existing = JSON.stringify(
      {
        generatedAt: '2025-01-15T10:30:00.000Z',
        conflicts: [{ id: 1 }],
      },
      null,
      2,
    );

    const newContent = JSON.stringify(
      {
        generatedAt: '2025-12-31T23:59:59.999Z',
        conflicts: [{ id: 1 }, { id: 2 }],
      },
      null,
      2,
    );

    const result = hasContentChanged(existing, newContent);

    expect(result).toBe(true);
  });

  it('should not detect changes when only JSON timestamp differs', () => {
    const existing = JSON.stringify(
      {
        generatedAt: '2025-01-15T10:30:00.000Z',
        conflicts: [{ id: 1 }],
      },
      null,
      2,
    );

    const newContent = JSON.stringify(
      {
        generatedAt: '2025-12-31T23:59:59.999Z',
        conflicts: [{ id: 1 }],
      },
      null,
      2,
    );

    const result = hasContentChanged(existing, newContent);

    expect(result).toBe(false);
  });
});

describe('smartWriteFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'smart-writer-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write file when it does not exist', async () => {
    const filePath = join(tempDir, 'new-file.ts');
    const content = 'export const x = 1;';

    const result = await smartWriteFile(filePath, content);

    expect(result.written).toBe(true);
    expect(result.filePath).toBe(filePath);

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should write file when content has changed', async () => {
    const filePath = join(tempDir, 'existing.ts');
    await writeFile(filePath, 'export const x = 1;', 'utf-8');

    const newContent = 'export const x = 2;';
    const result = await smartWriteFile(filePath, newContent);

    expect(result.written).toBe(true);

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(newContent);
  });

  it('should skip write when content is identical', async () => {
    const filePath = join(tempDir, 'unchanged.ts');
    const content = 'export const x = 1;';
    await writeFile(filePath, content, 'utf-8');

    const result = await smartWriteFile(filePath, content);

    expect(result.written).toBe(false);
    expect(result.filePath).toBe(filePath);
  });

  it('should skip write when only timestamp differs', async () => {
    const filePath = join(tempDir, 'types.ts');
    const existingContent = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
export interface Theme {}`;

    await writeFile(filePath, existingContent, 'utf-8');

    const newContent = `/**
 * Generated at: 2025-12-31T23:59:59.999Z
 */
export interface Theme {}`;

    const result = await smartWriteFile(filePath, newContent);

    expect(result.written).toBe(false);

    // Verify original content is preserved
    const actualContent = await readFile(filePath, 'utf-8');
    expect(actualContent).toBe(existingContent);
  });

  it('should write when content changes despite same timestamp', async () => {
    const filePath = join(tempDir, 'types.ts');
    const timestamp = '2025-01-15T10:30:00.000Z';

    const existingContent = `/**
 * Generated at: ${timestamp}
 */
export interface Theme {
  colors: {};
}`;

    await writeFile(filePath, existingContent, 'utf-8');

    const newContent = `/**
 * Generated at: ${timestamp}
 */
export interface Theme {
  colors: { primary: string };
}`;

    const result = await smartWriteFile(filePath, newContent);

    expect(result.written).toBe(true);

    const actualContent = await readFile(filePath, 'utf-8');
    expect(actualContent).toBe(newContent);
  });
});

describe('smartWriteFileCompat', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'smart-writer-compat-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return void and write file', async () => {
    const filePath = join(tempDir, 'test.ts');
    const content = 'export const x = 1;';

    const result = await smartWriteFileCompat(filePath, content);

    expect(result).toBeUndefined();

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should skip write when only timestamp differs', async () => {
    const filePath = join(tempDir, 'types.ts');
    const existingContent = `/**
 * Generated at: 2025-01-15T10:30:00.000Z
 */
export interface Theme {}`;

    await writeFile(filePath, existingContent, 'utf-8');

    const newContent = `/**
 * Generated at: 2025-12-31T23:59:59.999Z
 */
export interface Theme {}`;

    await smartWriteFileCompat(filePath, newContent);

    // Verify original content is preserved
    const actualContent = await readFile(filePath, 'utf-8');
    expect(actualContent).toBe(existingContent);
  });
});

describe('smartWriteFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'smart-writer-multi-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write multiple files in parallel', async () => {
    const files = [
      { filePath: join(tempDir, 'a.ts'), content: 'export const a = 1;' },
      { filePath: join(tempDir, 'b.ts'), content: 'export const b = 2;' },
      { filePath: join(tempDir, 'c.ts'), content: 'export const c = 3;' },
    ];

    const results = await smartWriteFiles(files);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.written)).toBe(true);

    for (const { filePath, content } of files) {
      const actual = await readFile(filePath, 'utf-8');
      expect(actual).toBe(content);
    }
  });

  it('should return mixed results for changed and unchanged files', async () => {
    const unchangedPath = join(tempDir, 'unchanged.ts');
    const changedPath = join(tempDir, 'changed.ts');
    const newPath = join(tempDir, 'new.ts');

    // Pre-create files
    await writeFile(unchangedPath, 'export const x = 1;', 'utf-8');
    await writeFile(changedPath, 'export const y = 1;', 'utf-8');

    const files = [
      { filePath: unchangedPath, content: 'export const x = 1;' },
      { filePath: changedPath, content: 'export const y = 2;' },
      { filePath: newPath, content: 'export const z = 3;' },
    ];

    const results = await smartWriteFiles(files);

    expect(results).toHaveLength(3);

    const unchangedResult = results.find((r) => r.filePath === unchangedPath);
    const changedResult = results.find((r) => r.filePath === changedPath);
    const newResult = results.find((r) => r.filePath === newPath);

    expect(unchangedResult?.written).toBe(false);
    expect(changedResult?.written).toBe(true);
    expect(newResult?.written).toBe(true);
  });
});
