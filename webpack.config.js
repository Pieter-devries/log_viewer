const path = require('path');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    console.log(`Webpack mode: ${isProduction ? 'production' : 'development'}`);
    return {
        mode: isProduction ? 'production' : 'development',
        devtool: isProduction ? false : 'inline-source-map',
        entry: './src/main.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'log-viewer.js',
            clean: true,
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js'],
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                configFile: 'path/to/your/tsconfig.json', // Specify the path here
                            },
                        },
                    ],
                    exclude: /node_modules/,
                },
            ],
        },
        devServer: {
            https: true,
            port: 8080,
            static: {
                directory: path.join(__dirname, 'dist'),
            },
            compress: true,
            hot: true,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
            },
        },
    };
};