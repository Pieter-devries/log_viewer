// https-config.js
const path = require('path'); // Import Node.js path module

module.exports = {
    // Use path.join to create absolute paths from the config file's directory
    cert: path.join(__dirname, "localhost+1.pem"),
    key: path.join(__dirname, "localhost+1-key.pem"),
};