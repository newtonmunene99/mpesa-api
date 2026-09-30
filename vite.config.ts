import { defineConfig, type ViteUserConfig } from 'vite-plus';

const config: ViteUserConfig = defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['__tests__/**/*.spec.ts'],
          exclude: ['__tests__/sandbox/**'],
        },
      },
      {
        // Calls the live Daraja sandbox. Every spec skips unless MPESA_SANDBOX=1.
        extends: true,
        test: {
          name: 'sandbox',
          include: ['__tests__/sandbox/**/*.spec.ts'],
          testTimeout: 120_000,
        },
      },
    ],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    // Complexity gate. Cyclomatic complexity sizes test effort; cognitive complexity and
    // nesting depth are the readability signals. Exceed a limit only with an
    // `oxlint-disable-next-line <rule> -- <reason>` comment explaining why.
    jsPlugins: ['eslint-plugin-sonarjs'],
    rules: {
      // 'modified' counts a whole switch as one branch, so dispatch tables don't trip it.
      complexity: ['error', { max: 15, variant: 'modified' }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 4],
      'max-nested-callbacks': ['warn', 4],
    },
    overrides: [
      {
        // describe/test blocks legitimately nest and run long.
        files: ['__tests__/**'],
        rules: {
          'max-lines-per-function': 'off',
          'max-nested-callbacks': 'off',
          'sonarjs/cognitive-complexity': 'off',
        },
      },
    ],
  },
  fmt: {
    singleQuote: true,
  },
  pack: {
    entry: ['src/index.ts'],
    format: ['esm'],
    platform: 'neutral',
    fixedExtension: true,
    dts: { sourcemap: true },
    sourcemap: true,
  },
});

export default config;
