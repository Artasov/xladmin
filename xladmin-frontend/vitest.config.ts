import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';

const rootDir = fileURLToPath(new URL('./packages/xladmin-core/src', import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@xladmin-core': rootDir,
        },
    },
    test: {
        environment: 'jsdom',
    },
});
