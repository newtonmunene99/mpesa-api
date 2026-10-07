import { type DefaultTheme, defineConfig, type UserConfig } from 'vitepress';

/** The sidebar, shared by every page. */
const sidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Guide',
    items: [
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Configuration', link: '/guide/configuration' },
      { text: 'Certificates', link: '/guide/certificates' },
      { text: 'Callbacks', link: '/guide/callbacks' },
      { text: 'Errors', link: '/guide/errors' },
      { text: 'Token store', link: '/guide/token-store' },
      { text: 'Runtimes', link: '/guide/runtimes' },
      { text: 'Limits', link: '/guide/limits' },
    ],
  },
  {
    text: 'APIs',
    items: [
      { text: 'M-Pesa Express (STK push)', link: '/apis/stk-push' },
      { text: 'Customer to Business (C2B)', link: '/apis/c2b' },
      { text: 'Business to Customer (B2C)', link: '/apis/b2c' },
      { text: 'Business to Business (B2B)', link: '/apis/b2b' },
      { text: 'Transaction Status', link: '/apis/transaction-status' },
      { text: 'Account Balance', link: '/apis/account-balance' },
      { text: 'Reversal', link: '/apis/reversal' },
    ],
  },
  {
    text: 'More',
    items: [
      { text: 'Migrating from 3.x', link: '/migration' },
      { text: 'Reference', link: '/reference/exports' },
    ],
  },
];

const config: UserConfig<DefaultTheme.Config> = defineConfig({
  title: 'mpesa-api',
  description:
    "A typed client for Safaricom's M-Pesa Daraja 3.0 API, with no runtime dependencies, for Node.js, Bun, Deno and edge runtimes.",
  // Served from https://newtonmunene99.github.io/mpesa-api/
  base: '/mpesa-api/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'APIs', link: '/apis/stk-push' },
      { text: 'Migrating from 3.x', link: '/migration' },
      { text: 'Reference', link: '/reference/exports' },
      {
        text: 'npm',
        link: 'https://www.npmjs.com/package/mpesa-api',
      },
    ],
    sidebar,
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/newtonmunene99/mpesa-api/edit/dev/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/newtonmunene99/mpesa-api' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2018-present Newton Munene',
    },
  },
});

export default config;
