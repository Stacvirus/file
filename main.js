if (require('electron-squirrel-startup')) return;

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { XMLParser } = require('fast-xml-parser');
const logger = require('./logger');
const iconv = require('iconv-lite');

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
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
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
let selectedPdfPaths = new Set();
ipcMain.handle('select-pdfs', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const newPdfs = [];
        const duplicates = [];

        for (const filePath of result.filePaths) {
            if (selectedPdfPaths.has(filePath)) {
                duplicates.push(path.basename(filePath));
            } else {
                selectedPdfPaths.add(filePath);
                newPdfs.push({
                    fullPath: filePath,
                    fileName: path.basename(filePath)
                });
            }
        }

        // Optionally notify about duplicates
        if (duplicates.length > 0) {
            logger.info(`Skipped duplicate PDFs: ${duplicates.join(', ')}`);
        }

        return newPdfs;
    }
    logger.info('No PDF files selected');
    return [];
});

ipcMain.handle('clear-pdfs', () => {
    selectedPdfPaths.clear();
    logger.info('Cleared selected PDFs');
    return true;
});

// Handle xml file selection
ipcMain.handle('select-xml', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'XML Files', extensions: ['xml'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return {
            fullPath: result.filePaths[0],
            fileName: path.basename(result.filePaths[0])
        };
    }
    logger.info('No XML file selected');
    return null;
});

const INDEX_NAMES = [
    'Organisationseinheit',
    'Bemerkung',
    'Belegnummernkreis',
    'Buchungsbelegnummer',
    'Rechnung-Nr'
];

// Handle the renaming process for multiple PDFs
ipcMain.handle('rename-pdfs', async (event, pdfPaths, xmlPath, lang, deleteOriginals) => {
    try {
        logger.info('Starting PDF renaming process');

        const xmlBuffer = fs.readFileSync(xmlPath);
        const xmlData = iconv.decode(xmlBuffer, 'iso-8859-1');

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            trimValues: true,
            cdataTagName: "__cdata",
            cdataPositionChar: "\\c",
            parseAttributeValue: false,
            parseTagValue: true,
            processEntities: true,
            decodeHTMLchar: true
        });
        const jsonObj = parser.parse(xmlData);

        if (!jsonObj.documents || !jsonObj.documents.document) {
            const message = translations[lang].noDocumentsFound;
            logger.error(message);
            return { success: false, message, errors: [message] };
        }

        const documents = Array.isArray(jsonObj.documents.document)
            ? jsonObj.documents.document
            : [jsonObj.documents.document];

        const results = [];
        const errors = [];

        const baseDir = path.dirname(pdfPaths[0]);
        const renamedDir = path.join(baseDir, 'renamed_files');

        if (!fs.existsSync(renamedDir)) {
            fs.mkdirSync(renamedDir);
            logger.info(`Created directory: ${renamedDir}`);
        }

        for (const pdfPath of pdfPaths) {
            const pdfBaseName = path.basename(pdfPath);
            logger.info(`Processing file: ${pdfBaseName}`);

            const targetDocument = documents.find(doc => {
                if (!doc.file) return false;
                const xmlFilePath = doc.file;
                const xmlFileName = xmlFilePath.includes('\\')
                    ? xmlFilePath.split('\\').pop()
                    : xmlFilePath;
                return xmlFileName === pdfBaseName;
            });

            if (!targetDocument) {
                const message = translations[lang].documentEntryNotFound.replace('{fileName}', pdfBaseName);
                errors.push(pdfBaseName);
                logger.error(message);
                continue;
            }

            if (!targetDocument.indexes || !targetDocument.indexes.index) {
                const message = translations[lang].noIndexesFound.replace('{fileName}', pdfBaseName);
                errors.push(pdfBaseName);
                logger.error(message);
                continue;
            }

            const indexes = Array.isArray(targetDocument.indexes.index)
                ? targetDocument.indexes.index
                : [targetDocument.indexes.index];

            // Collect values for all required indexes
            const indexValues = [];
            for (const indexName of INDEX_NAMES) {
                const targetIndex = indexes.find(idx => idx['@_name'] === indexName);
                if (targetIndex && targetIndex.value) {
                    const value = Array.isArray(targetIndex.value)
                        ? targetIndex.value[0]
                        : targetIndex.value;
                    if (value) {
                        indexValues.push(value.toString().trim());
                    }
                }
                // Don't add empty placeholder if index not found - skip it
            }

            if (indexValues.length === 0) {
                const message = translations[lang].noValidNameFound.replace('{fileName}', pdfBaseName);
                errors.push(pdfBaseName);
                logger.error(message);
                continue;
            }

            // Combine all found values with underscores
            const newName = indexValues.join('_')
                .replace(/[/\\?%*:|"<>]/g, '-');

            const pdfExt = path.extname(pdfPath);
            const newPath = path.join(renamedDir, newName + pdfExt);

            try {
                await fsExtra.copy(pdfPath, newPath);
                logger.info(`Renamed file: ${pdfBaseName} → ${newName + pdfExt}`);

                if (deleteOriginals) {
                    try {
                        await fsExtra.remove(pdfPath);
                        logger.info(`Deleted original file: ${pdfBaseName}`);
                    } catch (deleteErr) {
                        logger.error(`Error deleting original file ${pdfBaseName}: ${deleteErr.message}`);
                    }
                }

                results.push({
                    oldPath: pdfPath,
                    newPath: newPath,
                    oldName: pdfBaseName,
                    newName: newName + pdfExt,
                    deleted: deleteOriginals && !fs.existsSync(pdfPath)
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