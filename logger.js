const pino = require('pino');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure the logs directory exists
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Configure Pino logger with timestamp and level display
const logger = pino({
    level: 'info', // Minimum log level to capture
    transport: {
        target: 'pino/file',
        options: {
            destination: path.join(logsDir, 'app.log'),
            mkdir: true,
        }
    },
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
        time: () => {
            const now = new Date();
            return {
                time: now.toISOString(),
                formattedTime: now.toLocaleString()
            };
        }
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

module.exports = logger;