import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';
import process from 'process';
import postcss from 'rollup-plugin-postcss';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const isWatch = process.env.ROLLUP_WATCH;

async function getServeAndLiveloadPlugins() {
    console.log('loading server and liveReload plugins');
    // we can't always load these as apparently they start processes and so
    // node never exits.
    const { default: livereload } = await import('rollup-plugin-livereload');
    const { default: serve } = await import('rollup-plugin-serve');

    return [
        serve({
            open: true,
            openPage: process.env.START_PATH || '/examples/',
            verbose: true,
            contentBase: [''],
            host: 'localhost',
            port: 3000,
        }),
        livereload({ watch: 'dist' }),
    ];
}

const plugins = [
    resolve({
        browser: true,
    }),
    typescript({ tsconfig: './tsconfig.json' }),
];

const commonUIConfig = {
    input: 'src/ui/index.ts',
    output: [
        {
            file: packageJson.module,
            format: 'esm',
            sourcemap: true,
        },
    ],
    // This is a hack to workaround a warning that should be fixed
    onwarn(warning, warn) {
        if (warning.code === 'THIS_IS_UNDEFINED') {
            return;
        }
        warn(warning);
    },
    plugins: [
        resolve({
            browser: true,
        }),
        replace({
            preventAssignment: true,
            values: {
                'process.env.NODE_ENV': JSON.stringify('development'),
            },
        }),
        commonjs({
            include: /node_modules/,
            requireReturnsDefault: 'auto', // <---- this solves default issue
        }),
        typescript({
            tsconfig: './tsconfig.json',
            sourceRoot: '/src',
        }),
        postcss({
            minimize: true,
            sourceMap: true,
        }),
        ...(isWatch ? await getServeAndLiveloadPlugins() : []),
    ],
};

async function getConfig() {
    return [
        {
            input: 'src/capture/index.ts',
            output: [
                {
                    file: 'dist/capture.js',
                    format: 'esm',
                    sourcemap: true,
                },
            ],
            plugins,
        },
        {
            input: 'src/replay/index.ts',
            output: [
                {
                    file: 'dist/replay.js',
                    format: 'esm',
                    sourcemap: true,
                },
            ],
            plugins,
        },
        {
            ...commonUIConfig,
            output: [
                {
                    file: packageJson.module,
                    format: 'esm',
                    sourcemap: true,
                },
            ],
        },
        {
            ...commonUIConfig,
            output: [
                {
                    file: 'dist/spector2.umd.js',
                    format: 'umd',
                    sourcemap: true,
                    name: 'spector2',
                },
            ],
        },
        //{
        //  input: "dist/esm/types/index.d.ts",
        //  output: [{ file: "dist/index.d.ts", format: "esm" }],
        //  external: [/\.css$/],
        //  plugins: [dts()],
        //},
    ];
}

export default getConfig();
