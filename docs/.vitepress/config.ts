import { type DefaultTheme, defineConfig, type UserConfig } from 'vitepress';

/** The sidebar, shared by every page. Pages are added as the manual moves out of the README. */
const sidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Introduction',
    items: [{ text: 'Overview', link: '/' }],
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
