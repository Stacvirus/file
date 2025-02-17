const pino = require('pino');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const appRootDir = process.cwd();
const logsDir = path.join(appRootDir, 'logs');

// Ensure the logs directory exists
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
        console.error('Failed to create logs directory:', error);
    }
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

logger.info({
    event: 'app_start',
    appPath: appRootDir,
    logsPath: logsDir,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform
});

module.exports = logger;