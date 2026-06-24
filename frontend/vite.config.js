import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'Poupa+',
                short_name: 'Poupa+',
                description: 'Controle financeiro pessoal offline-first.',
                theme_color: '#176b5b',
                background_color: '#f7fbf8',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: '/favicon.svg',
                        sizes: '64x64',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
            },
            devOptions: {
                enabled: true
            }
        })
    ],
    test: {
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true
    }
});
