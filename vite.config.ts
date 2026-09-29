import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    environment: 'node',
  },
});
