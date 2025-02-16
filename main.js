if (require('electron-squirrel-startup')) return;

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { XMLParser } = require('fast-xml-parser');
const logger = require('./logger'); // Import the logger

const translations = {
    en: {
        successMessage: "Processed {count} files successfully",
        errorMessage: "Error processing files: {error}",
        noDocumentsFound: "Invalid XML structure: no documents found",
        documentEntryNotFound: "Could not find document entry for {fileName} in the XML file",
        noIndexesFound: "No indexes found in the document for {fileName}",
        bemerkungIndexNotFound: 'Index with name "Bemerkung" not found for {fileName}',
        noValidNameFound: "No valid name found in the Bemerkung index for {fileName}",
        fileCopyError: "Error copying {fileName}: {error}"
    },
    de: {
        successMessage: "{count} Dateien erfolgreich verarbeitet",
        errorMessage: "Fehler beim Verarbeiten der Dateien: {error}",
        noDocumentsFound: "Ungültige XML-Struktur: Keine Dokumente gefunden",
        documentEntryNotFound: "Dokumenteintrag für {fileName} in der XML-Datei nicht gefunden",
        noIndexesFound: "Keine Indizes im Dokument für {fileName} gefunden",
        bemerkungIndexNotFound: 'Index mit dem Namen "Bemerkung" für {fileName} nicht gefunden',
        noValidNameFound: "Kein gültiger Name im Bemerkung-Index für {fileName} gefunden",
        fileCopyError: "Fehler beim Kopieren von {fileName}: {error}"
    }
};

// Keep a global reference of the window object to avoid it being garbage collected
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    Menu.setApplicationMenu(null); // Remove the menu bar

    // Load the index.html file
    mainWindow.loadFile('index.html');

    // Open DevTools in development (comment out for production)
    // mainWindow.webContents.openDevTools();

    // Handle window being closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        logger.info('Main window closed');
    });

    logger.info('Application started');
}

// Create window when Electron is ready
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        logger.info('Application closed');
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
        logger.info(`Selected PDF files: ${result.filePaths.join(', ')}`);
        return result.filePaths;
    }
    logger.info('No PDF files selected');
    return [];
});

// Handle XML file selection
ipcMain.handle('select-xml', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'XML Files', extensions: ['xml'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        logger.info(`Selected XML file: ${result.filePaths[0]}`);
        return result.filePaths[0];
    }
    logger.info('No XML file selected');
    return null;
});

// Handle the renaming process for multiple PDFs
ipcMain.handle('rename-pdfs', async (event, pdfPaths, xmlPath, lang) => {
    try {
        logger.info('Starting PDF renaming process');

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
            const message = translations[lang].noDocumentsFound;
            logger.error(message);
            return { success: false, message, errors: [message] };
        }

        // Ensure we have an array of documents even if there's only one
        const documents = Array.isArray(jsonObj.documents.document)
            ? jsonObj.documents.document
            : [jsonObj.documents.document];

        const results = [];
        const errors = [];

        // Get the directory of the first PDF file (assuming all PDFs are in the same directory)
        const baseDir = path.dirname(pdfPaths[0]);

        // Create a new directory for renamed files
        const renamedDir = path.join(baseDir, 'renamed_files');

        // Ensure the directory exists
        if (!fs.existsSync(renamedDir)) {
            fs.mkdirSync(renamedDir);
            logger.info(`Created directory: ${renamedDir}`);
        }

        // Process each PDF file
        for (const pdfPath of pdfPaths) {
            const pdfBaseName = path.basename(pdfPath);
            logger.info(`Processing file: ${pdfBaseName}`);

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
                const message = translations[lang].documentEntryNotFound.replace('{fileName}', pdfBaseName);
                errors.push(message);
                logger.error(message);
                continue;
            }

            // Find the Bemerkung index in the document
            if (!targetDocument.indexes || !targetDocument.indexes.index) {
                const message = translations[lang].noIndexesFound.replace('{fileName}', pdfBaseName);
                errors.push(message);
                logger.error(message);
                continue;
            }

            const indexes = Array.isArray(targetDocument.indexes.index)
                ? targetDocument.indexes.index
                : [targetDocument.indexes.index];

            const targetIndex = indexes.find(idx => idx['@_name'] === 'Bemerkung');

            if (!targetIndex) {
                const message = translations[lang].bemerkungIndexNotFound.replace('{fileName}', pdfBaseName);
                errors.push(message);
                logger.error(message);
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
                const message = translations[lang].noValidNameFound.replace('{fileName}', pdfBaseName);
                errors.push(message);
                logger.error(message);
                continue;
            }

            // Clean the new name to be valid for a filename (basic cleaning)
            newName = newName.replace(/[/\\?%*:|"<>]/g, '-');

            // Get extension of the original PDF
            const pdfExt = path.extname(pdfPath);

            // Create new path in the renamed_files directory
            const newPath = path.join(renamedDir, newName + pdfExt);

            try {
                // Copy the file to the new path
                await fsExtra.copy(pdfPath, newPath);
                logger.info(`Renamed file: ${pdfBaseName} → ${newName + pdfExt}`);

                results.push({
                    oldPath: pdfPath,
                    newPath: newPath,
                    oldName: pdfBaseName,
                    newName: newName + pdfExt
                });
            } catch (err) {
                const message = translations[lang].fileCopyError
                    .replace('{fileName}', pdfBaseName)
                    .replace('{error}', err.message);
                errors.push(message);
                logger.error(message);
            }
        }

        const successMessage = translations[lang].successMessage.replace('{count}', results.length) +
            (errors.length > 0 ? ` ${translations[lang].errorMessage.replace('{error}', errors.length)}` : '');
        logger.info(successMessage);

        return {
            success: results.length > 0,
            results: results,
            errors: errors,
            message: successMessage
        };
    } catch (error) {
        const message = translations[lang].errorMessage.replace('{error}', error.message);
        logger.error(message);
        return {
            success: false,
            message: message,
            errors: [message]
        };
    }
});