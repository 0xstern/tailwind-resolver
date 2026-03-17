/**
 * Tests for multiline CSS values and nested non-color properties
 * Verifies fix for GitHub issue #16:
 * - [object Object] in types.ts for nested shadow/animation keys
 * - \n newlines in theme.ts for multi-line CSS values
 */

import type { TailwindResult } from '../../../src/v4/types';

import { beforeAll, describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';
import { isRecord } from '../../../src/v4/core/utils/type_guards';
import {
  generateRuntimeFile,
  generateTypeDeclarations,
} from '../../../src/v4/shared/type_generator';

const CSS_INPUT = `@theme inline {
  /** Custom shadow with line breaks */
  --shadow-skeuomorphic-xs:
    0px 1px 2px rgba(10, 13, 18, 0.05),
    inset 0px 0px 0px 1px rgba(10, 13, 18, 0.18),
    inset 0px -2px 0px rgba(10, 13, 18, 0.05);

  /** Custom animations */
  --animate-circular-progress: circular-progress-rotate 1.4s linear infinite;
  @keyframes circular-progress-rotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  --animate-circular-progress-dash: circular-progress-dash 1.4s ease-in-out
    infinite;
  @keyframes circular-progress-dash {
    0% { stroke-dasharray: 1px, 200px; stroke-dashoffset: 0; }
    50% { stroke-dasharray: 100px, 200px; stroke-dashoffset: -15px; }
    100% { stroke-dasharray: 100px, 200px; stroke-dashoffset: -125px; }
  }
}`;

const EXPECTED_SHADOW_VALUE =
  '0px 1px 2px rgba(10, 13, 18, 0.05), ' +
  'inset 0px 0px 0px 1px rgba(10, 13, 18, 0.18), ' +
  'inset 0px -2px 0px rgba(10, 13, 18, 0.05)';

let result: TailwindResult;
let typesOutput: string;
let runtimeOutput: string;

/**
 * Safely traverses a nested object by key path using runtime checks
 *
 * @param obj - The root object to traverse
 * @param keys - Array of string keys forming the path
 * @returns The value at the path, or undefined if any segment is missing
 */
function getNestedValue(
  obj: Record<string, unknown>,
  keys: Array<string>,
): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

beforeAll(async () => {
  result = await resolveTheme({
    css: CSS_INPUT,
    includeDefaults: false,
  });
  typesOutput = generateTypeDeclarations(result);
  runtimeOutput = generateRuntimeFile(result);
});

describe('Multiline CSS value normalization (issue #16)', () => {
  test('normalizes shadow values to single line', () => {
    const value = getNestedValue(result.variants.default.shadows, [
      'skeuomorphic',
      'xs',
    ]);
    expect(typeof value).toBe('string');
    expect(value).not.toContain('\n');
    expect(value).toBe(EXPECTED_SHADOW_VALUE);
  });

  test('normalizes multi-line animation values to single line', () => {
    const value = getNestedValue(result.variants.default.animations, [
      'circular',
      'progress',
      'dash',
    ]);
    expect(typeof value).toBe('string');
    expect(value).not.toContain('\n');
    expect(value).toBe('circular-progress-dash 1.4s ease-in-out infinite');
  });

  test('runtime file shadow values contain no literal newlines', () => {
    const shadowMatch = runtimeOutput.match(/"xs":\s*"([^"]*)"/);
    expect(shadowMatch).not.toBeNull();
    expect(shadowMatch![1]).not.toContain('\\n');
  });
});

describe('Nested non-color properties in types (issue #16)', () => {
  test('types.ts contains no [object Object]', () => {
    expect(typesOutput).not.toContain('[object Object]');
  });

  test('shadow type generates nested structure correctly', () => {
    expect(typesOutput).toContain('skeuomorphic: { xs:');
    expect(typesOutput).toContain(`${EXPECTED_SHADOW_VALUE}'`);
  });

  test('animation type generates nested structure correctly', () => {
    expect(typesOutput).toContain('circular: { progress:');
    expect(typesOutput).toContain(
      "DEFAULT: 'circular-progress-rotate 1.4s linear infinite'",
    );
    expect(typesOutput).toContain(
      "dash: 'circular-progress-dash 1.4s ease-in-out infinite'",
    );
  });
});

describe('Resolved theme structure', () => {
  test('shadows have correct nested structure', () => {
    const shadows = result.variants.default.shadows;
    expect(shadows).toHaveProperty('skeuomorphic');

    const skeuomorphic = getNestedValue(shadows, ['skeuomorphic']);
    expect(isRecord(skeuomorphic)).toBe(true);
    expect(skeuomorphic).toHaveProperty('xs');
  });

  test('animations have correct nested structure with DEFAULT', () => {
    const animations = result.variants.default.animations;
    const progress = getNestedValue(animations, ['circular', 'progress']);
    expect(isRecord(progress)).toBe(true);
    expect(progress).toHaveProperty('DEFAULT');
    expect(progress).toHaveProperty('dash');
    expect(
      getNestedValue(animations, ['circular', 'progress', 'DEFAULT']),
    ).toBe('circular-progress-rotate 1.4s linear infinite');
    expect(getNestedValue(animations, ['circular', 'progress', 'dash'])).toBe(
      'circular-progress-dash 1.4s ease-in-out infinite',
    );
  });

  test('keyframes are extracted', () => {
    expect(result.variants.default.keyframes).toHaveProperty(
      'circular-progress-rotate',
    );
    expect(result.variants.default.keyframes).toHaveProperty(
      'circular-progress-dash',
    );
  });
});
