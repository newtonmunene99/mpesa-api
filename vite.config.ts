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
});

export default config;
