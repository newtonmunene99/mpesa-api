import { defineConfig, type ViteUserConfig } from 'vite-plus';

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    environment: 'node',
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
    platform: 'node',
    dts: true,
    sourcemap: true,
    copy: [{ from: 'src/keys/*.cer', to: 'dist/keys' }],
  },
});

export default config;
