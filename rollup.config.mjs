import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const isProduction = !process.env.ROLLUP_WATCH;

function basePlugins(declarations = false) {
    return [
        typescript({
            declaration: declarations,
            declarationDir: declarations ? "dist" : undefined,
        }),

        // Minify production packages while preserving public class and function names.
        // minify if we're building for production
        // (aka. npm run build instead of npm run dev)
        isProduction && terser({
            keep_classnames: true,
            keep_fnames: true,
            output: {
                comments: false,
            },
        }),
    ]
}

export default [
    // ES bundle (the RustaBase client as default export + additional helper classes).
    {
        input: 'src/index.ts',
        output: [
            {
                file:      'dist/rustabase.es.mjs',
                format:    'es',
                sourcemap: isProduction,
            },
        ],
        plugins: basePlugins(true),
        watch: { clearScreen: false },
    },

    // ES bundle but with .js extension.
    //
    // React Native environments commonly require a .js module entry.
    {
        input: 'src/index.ts',
        output: [
            {
                file:      'dist/rustabase.es.js',
                format:    'es',
                sourcemap: isProduction,
            },
        ],
        plugins: basePlugins(),
        watch: { clearScreen: false },
    },

    // UMD bundle (all exports under the RustaBase global).
    {
        input: 'src/index.ts',
        output: [
            {
                name:      'RustaBase',
                file:      'dist/rustabase.umd.js',
                format:    'umd',
                exports:   'named',
                sourcemap: isProduction,
            },
        ],
        plugins: basePlugins(),
        watch: { clearScreen: false },
    },

    // CommonJS bundle (all exports under the RustaBase global).
    {
        input: 'src/index.ts',
        output: [
            {
                name:      'RustaBase',
                file:      'dist/rustabase.cjs.js',
                format:    'cjs',
                exports:   'named',
                sourcemap: isProduction,
            }
        ],
        plugins: basePlugins(),
        watch: { clearScreen: false },
    },

];
