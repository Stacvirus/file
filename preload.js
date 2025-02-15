const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use the ipcRenderer
contextBridge.exposeInMainWorld('electron', {
    selectPdfs: () => ipcRenderer.invoke('select-pdfs'),
    selectXml: () => ipcRenderer.invoke('select-xml'),
    renamePdfs: (pdfPaths, xmlPath) => ipcRenderer.invoke('rename-pdfs', pdfPaths, xmlPath)
});