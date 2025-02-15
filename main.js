const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');

// Keep a global reference of the window object to avoid it being garbage collected
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    // Load the index.html file
    mainWindow.loadFile('index.html');

    // Open DevTools in development (comment out for production)
    // mainWindow.webContents.openDevTools();

    // Handle window being closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create window when Electron is ready
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, recreate the window when dock icon is clicked and no other windows are open
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle PDF file selection
ipcMain.handle('select-pdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Handle text file selection
ipcMain.handle('select-txt', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Handle the renaming process
ipcMain.handle('rename-pdf', async (event, pdfPath, txtPath) => {
    try {
        // Read the text file to get the new name
        const fileContent = fs.readFileSync(txtPath, 'utf8');
        // Get the first line as the new name (you can modify this logic as needed)
        const newName = fileContent.split('\n')[0].trim();

        if (!newName) {
            return { success: false, message: 'No valid name found in the text file' };
        }

        // Get directory and extension of the original PDF
        const pdfDir = path.dirname(pdfPath);
        const pdfExt = path.extname(pdfPath);

        // Create new path with the new name
        const newPath = path.join(pdfDir, newName + pdfExt);

        // Copy the file to the new path (using fs-extra as it handles existing files better)
        await fsExtra.copy(pdfPath, newPath);

        return {
            success: true,
            message: 'File renamed successfully',
            oldPath: pdfPath,
            newPath: newPath
        };
    } catch (error) {
        return {
            success: false,
            message: `Error renaming file: ${error.message}`
        };
    }
});