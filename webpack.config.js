// webpack.config.js
const path = require('path');

module.exports = {
    entry: './src/index.ts',
    output: {
        filename: 'log-viewer.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    // Use development mode for easier debugging via package.json script
    // mode: 'development', // Set via CLI
    devtool: 'inline-source-map',
    cache: false, // Keep cache disabled for debugging
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [ // Can be an array of loaders or just one
                    {
                        loader: 'ts-loader',
                        options: {
                            // <<< Explicitly point to tsconfig.json >>>
                            configFile: 'tsconfig.json'
                        }
                    }
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
};
