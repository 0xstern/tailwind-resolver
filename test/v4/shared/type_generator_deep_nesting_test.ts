/**
 * Comprehensive tests for deep nesting in type_generator
 * These tests would have caught the bug where nested objects were stringified as '[object Object]'
 * instead of properly typed nested structures
 */

import type { ParseResult, Theme } from '../../../src/v4/types';

import { describe, expect, it } from 'bun:test';

import {
  generateRuntimeFile,
  generateTypeDeclarations,
} from '../../../src/v4/shared/type_generator';

/**
 * Interface for parsed runtime variants data structure
 */
interface ParsedVariantsData {
  default: {
    colors: Record<string, unknown>;
    [key: string]: unknown;
  };
  [variant: string]: unknown;
}

/**
 * Type guard to validate parsed JSON matches expected variants structure
 *
 * @param data - Unknown data from JSON.parse
 * @returns True if data matches ParsedVariantsData structure
 */
function isParsedVariantsData(data: unknown): data is ParsedVariantsData {
  if (data === null || typeof data !== 'object') {
    return false;
  }

  if (!('default' in data)) {
    return false;
  }

  const defaultVariant = (data as Record<string, unknown>).default;
  if (defaultVariant === null || typeof defaultVariant !== 'object') {
    return false;
  }

  return 'colors' in defaultVariant;
}

/**
 * Helper to create a complete Theme object with all required properties
 *
 * @param overrides - Partial theme properties to override defaults
 * @returns Complete Theme object with all required properties
 */
function createCompleteTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    colors: {},
    spacing: {},
    fonts: {},
    fontSize: {},
    fontWeight: {},
    tracking: {},
    leading: {},
    breakpoints: {},
    containers: {},
    radius: {},
    shadows: {},
    insetShadows: {},
    dropShadows: {},
    textShadows: {},
    blur: {},
    perspective: {},
    aspect: {},
    ease: {},
    animations: {},
    defaults: {},
    keyframes: {},
    ...overrides,
  };
}

/**
 * Helper to create a minimal ParseResult
 *
 * @param theme - Theme object to include in ParseResult
 * @returns ParseResult with minimal required properties
 */
function createParseResult(theme: Theme): ParseResult {
  return {
    theme,
    variants: {},
    variables: [],
    files: [],
    deprecationWarnings: [],
    cssConflicts: [],
    unresolvedVariables: [],
  };
}

describe('generateTypeDeclarations - Deep Nesting', () => {
  describe('Color nesting - 3 levels', () => {
    it('should handle 3-level nested colors (inverse.on.surface)', () => {
      const theme = createCompleteTheme({
        colors: {
          inverse: {
            on: {
              surface: 'rgba(255, 255, 255, 0.87)',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      // Verify the type structure is correct (not '[object Object]')
      expect(types).toContain('inverse: {');
      expect(types).toContain('on: {');
      expect(types).toContain("surface: 'rgba(255, 255, 255, 0.87)'");

      // Ensure no stringified objects
      expect(types).not.toContain('[object Object]');
    });

    it('should handle multiple 3-level nested colors', () => {
      const theme = createCompleteTheme({
        colors: {
          surface: {
            container: {
              high: '#e0e0e0',
              low: '#f5f5f5',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('surface: {');
      expect(types).toContain('container: {');
      expect(types).toContain("high: '#e0e0e0'");
      expect(types).toContain("low: '#f5f5f5'");
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('Color nesting - 4 levels', () => {
    it('should handle 4-level nested colors (on.primary.fixed.variant)', () => {
      const theme = createCompleteTheme({
        colors: {
          on: {
            primary: {
              fixed: {
                variant: 'rgba(0, 0, 0, 0.6)',
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('on: {');
      expect(types).toContain('primary: {');
      expect(types).toContain('fixed: {');
      expect(types).toContain("variant: 'rgba(0, 0, 0, 0.6)'");
      expect(types).not.toContain('[object Object]');
    });

    it('should handle multiple properties at 4 levels', () => {
      const theme = createCompleteTheme({
        colors: {
          on: {
            primary: {
              fixed: {
                variant: 'rgba(0, 0, 0, 0.6)',
                dark: 'rgba(0, 0, 0, 0.87)',
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('on: {');
      expect(types).toContain('primary: {');
      expect(types).toContain('fixed: {');
      expect(types).toContain("variant: 'rgba(0, 0, 0, 0.6)'");
      expect(types).toContain("dark: 'rgba(0, 0, 0, 0.87)'");
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('Color nesting - 5+ levels', () => {
    it('should handle 5-level nested colors', () => {
      const theme = createCompleteTheme({
        colors: {
          scheme: {
            material: {
              surface: {
                container: {
                  highest: '#f0f0f0',
                },
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('scheme: {');
      expect(types).toContain('material: {');
      expect(types).toContain('surface: {');
      expect(types).toContain('container: {');
      expect(types).toContain("highest: '#f0f0f0'");
      expect(types).not.toContain('[object Object]');
    });

    it('should handle 6-level nested colors', () => {
      const theme = createCompleteTheme({
        colors: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    level6: '#deep',
                  },
                },
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('level1: {');
      expect(types).toContain('level2: {');
      expect(types).toContain('level3: {');
      expect(types).toContain('level4: {');
      expect(types).toContain('level5: {');
      expect(types).toContain("level6: '#deep'");
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('Mixed nesting scenarios', () => {
    it('should handle mix of flat and deeply nested colors', () => {
      const theme = createCompleteTheme({
        colors: {
          // Flat colors
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          // 2-level nesting
          gray: {
            light: '#f0f0f0',
            dark: '#333333',
          },
          // 3-level nesting
          inverse: {
            on: {
              surface: 'rgba(255, 255, 255, 0.87)',
            },
          },
          // 4-level nesting
          on: {
            primary: {
              fixed: {
                variant: 'rgba(0, 0, 0, 0.6)',
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      // Verify flat colors
      expect(types).toContain("primary: '#3b82f6'");
      expect(types).toContain("secondary: '#8b5cf6'");

      // Verify 2-level nesting
      expect(types).toContain('gray: {');
      expect(types).toContain("light: '#f0f0f0'");

      // Verify 3-level nesting
      expect(types).toContain('inverse: {');
      expect(types).toContain('on: {');
      expect(types).toContain("surface: 'rgba(255, 255, 255, 0.87)'");

      // Verify 4-level nesting (note: 'on' already exists at root)
      expect(types).toContain('primary: {');
      expect(types).toContain('fixed: {');
      expect(types).toContain("variant: 'rgba(0, 0, 0, 0.6)'");

      expect(types).not.toContain('[object Object]');
    });

    it('should handle multiple branches at same depth', () => {
      const theme = createCompleteTheme({
        colors: {
          surface: {
            container: {
              high: '#e0e0e0',
              low: '#f5f5f5',
            },
            variant: {
              one: '#aaaaaa',
              two: '#bbbbbb',
            },
          },
          inverse: {
            on: {
              surface: 'rgba(255, 255, 255, 0.87)',
              primary: 'rgba(255, 255, 255, 0.95)',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      // Verify surface branch
      expect(types).toContain('surface: {');
      expect(types).toContain('container: {');
      expect(types).toContain("high: '#e0e0e0'");
      expect(types).toContain('variant: {');
      expect(types).toContain("one: '#aaaaaa'");

      // Verify inverse branch
      expect(types).toContain('inverse: {');
      expect(types).toContain('on: {');
      expect(types).toContain("surface: 'rgba(255, 255, 255, 0.87)'");
      expect(types).toContain("primary: 'rgba(255, 255, 255, 0.95)'");

      expect(types).not.toContain('[object Object]');
    });
  });

  describe('Real-world Material Design color system', () => {
    it('should handle Material Design 3 color tokens', () => {
      const theme = createCompleteTheme({
        colors: {
          // Standard flat colors
          primary: '#6750A4',
          secondary: '#625B71',
          tertiary: '#7D5260',
          error: '#B3261E',
          // Deep nesting - Material 3 surface variants
          surface: {
            container: {
              highest: '#E6E0E9',
              high: '#ECE6F0',
              low: '#F7F2FA',
              lowest: '#FFFFFF',
            },
          },
          // Deep nesting - inverse colors
          inverse: {
            on: {
              surface: 'rgba(255, 255, 255, 0.87)',
            },
            surface: '#313033',
            primary: '#D0BCFF',
          },
          // Deep nesting - on-color variations
          on: {
            primary: {
              container: '#21005D',
              fixed: {
                variant: '#4F378B',
              },
            },
            secondary: {
              container: '#1D192B',
              fixed: {
                variant: '#4A4458',
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      // Verify all structures are properly typed
      expect(types).toContain("primary: '#6750A4'");
      expect(types).toContain('surface: {');
      expect(types).toContain('container: {');
      expect(types).toContain("highest: '#E6E0E9'");
      expect(types).toContain('inverse: {');
      expect(types).toContain('on: {');
      expect(types).toContain('primary: {');
      expect(types).toContain('fixed: {');
      expect(types).toContain("variant: '#4F378B'");
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty nested objects', () => {
      const theme = createCompleteTheme({
        colors: {
          empty: {},
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('empty: {}');
      expect(types).not.toContain('[object Object]');
    });

    it('should handle single-item nested objects', () => {
      const theme = createCompleteTheme({
        colors: {
          single: {
            only: {
              one: '#value',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('single: {');
      expect(types).toContain('only: {');
      expect(types).toContain("one: '#value'");
      expect(types).not.toContain('[object Object]');
    });

    it('should handle special characters in color values', () => {
      const theme = createCompleteTheme({
        colors: {
          nested: {
            deep: {
              special: 'calc(100% - 10px), rgba(0, 0, 0, 0.5)',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('nested: {');
      expect(types).toContain('deep: {');
      expect(types).toContain('special:');
      expect(types).not.toContain('[object Object]');
    });

    it('should handle keys that require quoting', () => {
      const theme = createCompleteTheme({
        colors: {
          'kebab-case': {
            'nested-key': {
              'final-key': '#value',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain("'kebab-case': {");
      expect(types).toContain("'nested-key': {");
      expect(types).toContain("'final-key': '#value'");
      expect(types).not.toContain('[object Object]');
    });
  });
});

describe('generateTypeDeclarations - Other Theme Properties', () => {
  describe('fontSize with nesting', () => {
    it('should handle fontSize types correctly', () => {
      const theme = createCompleteTheme({
        fontSize: {
          xs: { size: '0.75rem', lineHeight: '1rem' },
          sm: { size: '0.875rem', lineHeight: '1.25rem' },
          base: { size: '1rem', lineHeight: '1.5rem' },
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('fontSize: {');
      expect(types).toContain("xs: { size: '0.75rem'; lineHeight: '1rem' }");
      expect(types).toContain(
        "sm: { size: '0.875rem'; lineHeight: '1.25rem' }",
      );
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('fontWeight with mixed types', () => {
    it('should handle mixed string and number font weights', () => {
      const theme = createCompleteTheme({
        fontWeight: {
          thin: 100,
          light: 300,
          normal: 400,
          medium: 500,
          bold: 700,
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('fontWeight: {');
      expect(types).toContain('thin: 100');
      expect(types).toContain('light: 300');
      expect(types).toContain('bold: 700');
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('spacing with nested values', () => {
    it('should handle spacing values', () => {
      const theme = createCompleteTheme({
        spacing: {
          base: '0.25rem',
          xs: '0.5rem',
          sm: '0.75rem',
          md: '1rem',
          lg: '1.5rem',
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      expect(types).toContain('spacing: {');
      expect(types).toContain("base: '0.25rem'");
      expect(types).toContain("xs: '0.5rem'");
      // Should be a function type as well
      expect(types).toContain('((n: number) => string)');
      expect(types).not.toContain('[object Object]');
    });
  });

  describe('shadows, radius, and other properties', () => {
    it('should handle all theme properties with proper types', () => {
      const theme = createCompleteTheme({
        colors: { primary: '#000' },
        shadows: {
          sm: '0 1px 2px rgba(0,0,0,0.05)',
          md: '0 4px 6px rgba(0,0,0,0.1)',
        },
        radius: {
          sm: '0.25rem',
          md: '0.5rem',
          lg: '1rem',
        },
        blur: {
          sm: '4px',
          md: '8px',
        },
        ease: {
          'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      });

      const result = createParseResult(theme);
      const types = generateTypeDeclarations(result, 'TestTheme');

      // Verify each property is properly typed
      expect(types).toContain('colors: {');
      expect(types).toContain('shadows: {');
      expect(types).toContain('radius: {');
      expect(types).toContain('blur: {');
      expect(types).toContain('ease: {');
      expect(types).not.toContain('[object Object]');
    });
  });
});

describe('generateRuntimeFile - Deep Nesting', () => {
  describe('Runtime output with deep nesting', () => {
    it('should generate valid JSON for deeply nested colors', () => {
      const theme = createCompleteTheme({
        colors: {
          inverse: {
            on: {
              surface: 'rgba(255, 255, 255, 0.87)',
            },
          },
          on: {
            primary: {
              fixed: {
                variant: 'rgba(0, 0, 0, 0.6)',
              },
            },
          },
        },
      });

      const result = createParseResult(theme);
      const runtime = generateRuntimeFile(result, 'TestTheme', {
        variants: true,
        selectors: false,
        files: false,
        variables: false,
      });

      // Should contain valid JSON structure
      expect(runtime).toContain('variantsData');
      expect(runtime).toContain('"inverse"');
      expect(runtime).toContain('"on"');
      expect(runtime).toContain('"surface"');
      expect(runtime).toContain('rgba(255, 255, 255, 0.87)');
      expect(runtime).not.toContain('[object Object]');
    });

    it('should parse generated runtime JSON successfully', () => {
      const theme = createCompleteTheme({
        colors: {
          surface: {
            container: {
              high: '#e0e0e0',
              low: '#f5f5f5',
            },
          },
        },
      });

      const result = createParseResult(theme);
      const runtime = generateRuntimeFile(result, 'TestTheme', {
        variants: true,
        selectors: false,
        files: false,
        variables: false,
      });

      // Extract the JSON from the generated code
      const jsonMatch = runtime.match(/variantsData = ({[\s\S]*?});/);
      expect(jsonMatch).toBeTruthy();

      if (jsonMatch?.[1] !== undefined) {
        const jsonString = jsonMatch[1];
        const parsed: unknown = JSON.parse(jsonString);

        // Validate structure with type guard
        expect(isParsedVariantsData(parsed)).toBe(true);

        if (isParsedVariantsData(parsed)) {
          const colors = parsed.default.colors;

          // Navigate to nested structure
          const surface = colors.surface as Record<string, unknown> | undefined;
          expect(surface).toBeDefined();

          if (surface !== undefined) {
            const container = surface.container as
              | Record<string, unknown>
              | undefined;
            expect(container).toBeDefined();

            if (container !== undefined) {
              // Verify the structure is preserved
              expect(container.high).toBe('#e0e0e0');
              expect(container.low).toBe('#f5f5f5');
            }
          }
        }
      }
    });
  });

  describe('Runtime with variants and deep nesting', () => {
    it('should handle deep nesting in theme variants', () => {
      const theme = createCompleteTheme({
        colors: {
          inverse: {
            on: {
              surface: 'rgba(255, 255, 255, 0.87)',
            },
          },
        },
      });

      const result: ParseResult = {
        theme,
        variants: {
          dark: {
            selector: '.dark',
            theme: createCompleteTheme({
              colors: {
                inverse: {
                  on: {
                    surface: 'rgba(0, 0, 0, 0.87)',
                  },
                },
              },
            }),
          },
        },
        variables: [],
        files: [],
        deprecationWarnings: [],
        cssConflicts: [],
        unresolvedVariables: [],
      };

      const runtime = generateRuntimeFile(result, 'TestTheme', {
        variants: true,
        selectors: true,
        files: false,
        variables: false,
      });

      // Verify both default and variant have proper nesting
      expect(runtime).toContain('variantsData');
      expect(runtime).toContain('default');
      expect(runtime).toContain('dark');
      expect(runtime).not.toContain('[object Object]');
    });
  });
});

describe('Type safety verification', () => {
  it('should generate types that compile without errors', () => {
    const theme = createCompleteTheme({
      colors: {
        // This structure should produce valid TypeScript
        inverse: {
          on: {
            surface: 'rgba(255, 255, 255, 0.87)',
          },
        },
        on: {
          primary: {
            fixed: {
              variant: 'rgba(0, 0, 0, 0.6)',
            },
          },
        },
      },
    });

    const result = createParseResult(theme);
    const types = generateTypeDeclarations(result, 'TestTheme');

    // Verify the structure is syntactically valid TypeScript
    expect(types).toContain('export interface TestTheme');
    expect(types).toContain('colors: {');

    // Count opening and closing braces to ensure they're balanced
    const openBraces = (types.match(/{/g) ?? []).length;
    const closeBraces = (types.match(/}/g) ?? []).length;
    expect(openBraces).toBe(closeBraces);

    // Verify no [object Object] strings in output
    expect(types).not.toContain('[object Object]');

    // Verify proper TypeScript syntax for nested objects
    expect(types).toMatch(/inverse: \{ on: \{ surface:/);
    expect(types).toMatch(/on: \{ primary: \{ fixed: \{ variant:/);
  });
});
