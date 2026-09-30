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
