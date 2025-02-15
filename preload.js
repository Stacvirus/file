const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use the ipcRenderer
contextBridge.exposeInMainWorld('electron', {
    selectPdf: () => ipcRenderer.invoke('select-pdf'),
    selectTxt: () => ipcRenderer.invoke('select-txt'),
    renamePdf: (pdfPath, txtPath) => ipcRenderer.invoke('rename-pdf', pdfPath, txtPath)
});