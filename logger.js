const pino = require('pino');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure the logs directory exists
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Configure Pino logger
const logger = pino({
    level: 'info', // Minimum log level to capture
    transport: {
        target: 'pino/file',
        options: {
            destination: path.join(logsDir, 'app.log'),
            mkdir: true,
        }
    }
});

module.exports = logger;