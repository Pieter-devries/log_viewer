const path = require('path');
const httpsConfig = require('./https-config.js'); // Import the config

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
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        devServer: {
            host: '0.0.0.0',
            server: {
                type: 'https',
                options: {
                    cert: httpsConfig.cert, // Use the certificate from the config
                    key: httpsConfig.key,   // Use the key from the config
                },
            },
            port: 9000,
            static: {
                directory: path.join(__dirname, 'dist'),
            },
            compress: true,
            hot: true,
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow requests from any origin
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization, Accept, Origin', 
            },
            // Add this line to allow serving from any host
            allowedHosts: 'all',
        },
    };
};
