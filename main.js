if (require('electron-squirrel-startup')) return;

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { XMLParser } = require('fast-xml-parser');

// Keep a global reference of the window object to avoid it being garbage collected
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
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

// Handle PDF file selection - now with multiSelections
ipcMain.handle('select-pdfs', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths;
    }
    return [];
});

// Handle XML file selection
ipcMain.handle('select-xml', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'XML Files', extensions: ['xml'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Handle the renaming process for multiple PDFs
ipcMain.handle('rename-pdfs', async (event, pdfPaths, xmlPath) => {
    try {
        // Read the XML file
        const xmlData = fs.readFileSync(xmlPath, 'utf8');

        // Parse XML with options to preserve attributes
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const jsonObj = parser.parse(xmlData);

        // Check if documents array exists
        if (!jsonObj.documents || !jsonObj.documents.document) {
            return { success: false, message: 'Invalid XML structure: no documents found' };
        }

        // Ensure we have an array of documents even if there's only one
        const documents = Array.isArray(jsonObj.documents.document)
            ? jsonObj.documents.document
            : [jsonObj.documents.document];

        const results = [];
        const errors = [];

        // Process each PDF file
        for (const pdfPath of pdfPaths) {
            // Get the base name of the PDF (without directory path)
            const pdfBaseName = path.basename(pdfPath);

            // Find the document that contains our PDF file
            const targetDocument = documents.find(doc => {
                if (!doc.file) return false;

                // Extract filename from the file path in XML
                const xmlFilePath = doc.file;
                const xmlFileName = xmlFilePath.includes('\\')
                    ? xmlFilePath.split('\\').pop()
                    : xmlFilePath;

                return xmlFileName === pdfBaseName;
            });

            if (!targetDocument) {
                errors.push(`Could not find document entry for ${pdfBaseName} in the XML file`);
                continue;
            }

            // Find the Bemerkung index in the document
            if (!targetDocument.indexes || !targetDocument.indexes.index) {
                errors.push(`No indexes found in the document for ${pdfBaseName}`);
                continue;
            }

            const indexes = Array.isArray(targetDocument.indexes.index)
                ? targetDocument.indexes.index
                : [targetDocument.indexes.index];

            const targetIndex = indexes.find(idx => idx['@_name'] === 'Bemerkung');

            if (!targetIndex) {
                errors.push(`Index with name "Bemerkung" not found for ${pdfBaseName}`);
                continue;
            }

            // Get the value from the index
            let newName;
            if (targetIndex.value) {
                if (Array.isArray(targetIndex.value)) {
                    // If there are multiple values, use the first one
                    newName = targetIndex.value[0];
                } else {
                    newName = targetIndex.value;
                }
            }

            if (!newName) {
                errors.push(`No valid name found in the Bemerkung index for ${pdfBaseName}`);
                continue;
            }

            // Clean the new name to be valid for a filename (basic cleaning)
            newName = newName.replace(/[/\\?%*:|"<>]/g, '-');

            // Get directory and extension of the original PDF
            const pdfDir = path.dirname(pdfPath);
            const pdfExt = path.extname(pdfPath);

            // Create new path with the new name
            const newPath = path.join(pdfDir, newName + pdfExt);

            try {
                // Copy the file to the new path
                await fsExtra.copy(pdfPath, newPath);

                results.push({
                    oldPath: pdfPath,
                    newPath: newPath,
                    oldName: pdfBaseName,
                    newName: newName + pdfExt
                });
            } catch (err) {
                errors.push(`Error copying ${pdfBaseName}: ${err.message}`);
            }
        }

        return {
            success: results.length > 0,
            results: results,
            errors: errors,
            message: `Processed ${results.length} files successfully` +
                (errors.length > 0 ? ` with ${errors.length} errors` : '')
        };
    } catch (error) {
        return {
            success: false,
            message: `Error processing files: ${error.message}`,
            errors: [error.message]
        };
    }
});