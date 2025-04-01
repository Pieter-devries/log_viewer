// webpack.config.js
const path = require('path');

module.exports = {
    // Entry point for your visualization
    entry: './src/index.ts',

    // Output configuration
    output: {
        // The bundled JavaScript file Looker will load
        filename: 'log-viewer.js',
        // Output directory (e.g., 'dist')
        path: path.resolve(__dirname, 'dist'),
        // Clean the output directory before emit
        clean: true,
        // Optional: Configure library if needed, usually not necessary for simple Looker vis
        // library: {
        //   name: 'LogViewerVis',
        //   type: 'umd', // Universal Module Definition
        // },
    },

    // Mode ('development' for easier debugging, 'production' for optimized build)
    mode: 'development', // Change to 'production' for deployment

    // Enable source maps for debugging
    devtool: 'inline-source-map', // Or other options like 'source-map'

    // Module resolution and rules
    module: {
        rules: [
            // Rule for TypeScript files
            {
                test: /\.tsx?$/, // Matches .ts and .tsx files
                use: 'ts-loader', // Use ts-loader to compile TypeScript
                exclude: /node_modules/, // Don't process node_modules
            },
            // Rule for CSS files
            {
                test: /\.css$/i, // Matches .css files
                // Use style-loader to inject CSS into the DOM
                // Use css-loader to resolve CSS imports and url() paths
                use: ['style-loader', 'css-loader'],
            },
        ],
    },

    // File extensions to resolve
    resolve: {
        extensions: ['.tsx', '.ts', '.js'], // Allow importing without extensions
    },

    // Optional: Configure development server if needed
    // devServer: {
    //   static: './dist',
    // },
};
