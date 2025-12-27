import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

/**
 * Tests for CSS var() fallback resolution
 *
 * These tests verify that var() expressions with fallback values
 * are correctly resolved when the primary variable is not found.
 */
describe('CSS var() Fallback Resolution', () => {
  describe('Simple fallback values', () => {
    test('uses literal fallback when variable is missing', async () => {
      const css = `
        @theme {
          --color-primary: var(--missing-var, #3b82f6);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.primary).toBe('#3b82f6');
    });

    test('uses primary variable when it exists', async () => {
      const css = `
        :root {
          --brand-color: #ef4444;
        }
        @theme {
          --color-primary: var(--brand-color, #3b82f6);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.primary).toBe('#ef4444');
    });

    test('uses fallback with oklch color value', async () => {
      const css = `
        @theme {
          --color-accent: var(--missing-accent, oklch(0.6 0.2 250));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.accent).toBe('oklch(0.6 0.2 250)');
    });
  });

  describe('Nested var() fallbacks', () => {
    test('resolves nested var() when primary is missing', async () => {
      const css = `
        :root {
          --base-blue: #2563eb;
        }
        @theme {
          --color-primary: var(--brand-primary, var(--base-blue));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.primary).toBe('#2563eb');
    });

    test('resolves deeply nested var() chain', async () => {
      const css = `
        :root {
          --fallback-color: #10b981;
        }
        @theme {
          --color-success: var(--brand-success, var(--theme-success, var(--fallback-color)));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.success).toBe('#10b981');
    });

    test('stops at first available variable in chain', async () => {
      const css = `
        :root {
          --theme-warning: #f59e0b;
          --fallback-warning: #fbbf24;
        }
        @theme {
          --color-warning: var(--brand-warning, var(--theme-warning, var(--fallback-warning)));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // Should use --theme-warning since it exists, not --fallback-warning
      expect(result.variants.default.colors.warning).toBe('#f59e0b');
    });

    test('resolves nested fallback with defined colors', async () => {
      const css = `
        :root {
          --color-red-600: #dc2626;
        }
        @theme {
          --color-destructive: var(--brand-destructive, var(--color-red-600));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // Should resolve to the defined red-600 color via fallback
      expect(result.variants.default.colors.destructive).toBe('#dc2626');
    });
  });

  describe('Fallbacks in CSS functions', () => {
    test('resolves fallback inside calc()', async () => {
      const css = `
        :root {
          --base-size: 1rem;
        }
        @theme {
          --spacing-custom: calc(var(--missing-multiplier, 2) * var(--base-size));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.spacing.custom).toBe('calc(2 * 1rem)');
    });

    test('resolves multiple fallbacks inside calc()', async () => {
      const css = `
        @theme {
          --spacing-padded: calc(var(--missing-base, 1rem) + var(--missing-extra, 0.5rem));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.spacing.padded).toBe(
        'calc(1rem + 0.5rem)',
      );
    });

    test('resolves fallback inside clamp()', async () => {
      const css = `
        @theme {
          --spacing-fluid: clamp(var(--missing-min, 1rem), 5vw, var(--missing-max, 3rem));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.spacing.fluid).toBe(
        'clamp(1rem, 5vw, 3rem)',
      );
    });

    test('resolves nested var() fallback inside min()', async () => {
      const css = `
        :root {
          --container-default: 80rem;
        }
        @theme {
          --container-main: min(100%, var(--brand-container, var(--container-default)));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.containers.main).toBe('min(100%, 80rem)');
    });
  });

  describe('Variant-specific fallback resolution', () => {
    test('resolves fallbacks in dark variant', async () => {
      const css = `
        :root {
          --light-bg: #ffffff;
        }
        .dark {
          --dark-bg: #1f2937;
        }
        @theme {
          --color-background: var(--theme-bg, var(--light-bg));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // Default variant uses --light-bg fallback
      expect(result.variants.default.colors.background).toBe('#ffffff');
    });

    test('resolves variant-specific variables before fallback', async () => {
      const css = `
        :root {
          --accent-color: #3b82f6;
        }
        .dark {
          --accent-color: #60a5fa;
        }
        @theme {
          --color-accent: var(--brand-accent, var(--accent-color));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // Default variant uses :root value
      expect(result.variants.default.colors.accent).toBe('#3b82f6');

      // Dark variant should use its own --accent-color from .dark selector
      // Note: result.variants.dark IS the theme directly (not wrapped in { theme })
      expect(result.variants.dark?.colors.accent).toBe('#60a5fa');
    });
  });

  describe('Edge cases', () => {
    test('handles empty fallback gracefully', async () => {
      const css = `
        @theme {
          --color-transparent: var(--missing-var, transparent);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.transparent).toBe('transparent');
    });

    test('handles fallback with spaces', async () => {
      const css = `
        @theme {
          --shadow-custom: var(--missing-shadow, 0 4px 6px -1px rgb(0 0 0 / 0.1));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.shadows.custom).toBe(
        '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      );
    });

    test('handles fallback with commas in value', async () => {
      const css = `
        @theme {
          --font-sans: var(--brand-font, ui-sans-serif, system-ui, sans-serif);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.fonts.sans).toBe(
        'ui-sans-serif, system-ui, sans-serif',
      );
    });

    test('preserves unresolvable var() when no fallback provided', async () => {
      const css = `
        @theme {
          --color-dynamic: var(--runtime-injected-color);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // Should preserve the var() since it cannot be resolved and has no fallback
      expect(result.variants.default.colors.dynamic).toBe(
        'var(--runtime-injected-color)',
      );
    });

    test('handles whitespace around fallback values', async () => {
      const css = `
        @theme {
          --color-spaced: var(  --missing  ,   #abcdef   );
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.spaced).toBe('#abcdef');
    });
  });

  describe('Real-world scenarios from Issue #9', () => {
    test('resolves brand kit pattern with defined fallback colors', async () => {
      const css = `
        :root {
          --color-blue-600: #2563eb;
          --color-gray-700: #374151;
          --color-purple-500: #a855f7;
        }
        @theme {
          --color-primary: var(--primary-from-brand-kit, var(--color-blue-600));
          --color-primary-foreground: var(--primary-foreground-from-brand-kit, #fff);
          --color-secondary: var(--secondary-from-brand-kit, var(--color-gray-700));
          --color-secondary-foreground: var(--secondary-foreground-from-brand-kit, #fff);
          --color-tertiary: var(--tertiary-from-brand-kit, var(--color-purple-500));
          --color-tertiary-foreground: var(--tertiary-foreground-from-brand-kit, #fff);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // All colors should be resolved to fallback values
      // When both color and color-foreground exist, they're nested with DEFAULT
      const { colors } = result.variants.default;
      expect(colors.primary).toMatchObject({
        DEFAULT: '#2563eb',
        foreground: '#fff',
      });
      expect(colors.secondary).toMatchObject({
        DEFAULT: '#374151',
        foreground: '#fff',
      });
      expect(colors.tertiary).toMatchObject({
        DEFAULT: '#a855f7',
        foreground: '#fff',
      });
    });

    test('resolves brand kit with imported variables (primary takes precedence)', async () => {
      const css = `
        :root {
          --primary-from-brand-kit: #00205b;
          --primary-foreground-from-brand-kit: #ffffff;
          --color-blue-600: #2563eb;
        }
        @theme {
          --color-primary: var(--primary-from-brand-kit, var(--color-blue-600));
          --color-primary-foreground: var(--primary-foreground-from-brand-kit, #fff);
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      // Should use the :root defined brand kit colors (primary variable exists)
      const { colors } = result.variants.default;
      expect(colors.primary).toMatchObject({
        DEFAULT: '#00205b',
        foreground: '#ffffff',
      });
    });

    test('handles mixed resolved and unresolved in same theme', async () => {
      const css = `
        :root {
          --existing-color: #22c55e;
          --color-red-500: #ef4444;
        }
        @theme {
          --color-success: var(--existing-color);
          --color-warning: var(--missing-warning, #f59e0b);
          --color-error: var(--missing-error, var(--color-red-500));
        }
      `;

      const result = await resolveTheme({ css, includeDefaults: false });

      expect(result.variants.default.colors.success).toBe('#22c55e');
      expect(result.variants.default.colors.warning).toBe('#f59e0b');
      expect(result.variants.default.colors.error).toBe('#ef4444');
    });
  });
});
