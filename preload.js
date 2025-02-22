const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    selectPdfs: () => ipcRenderer.invoke('select-pdfs'),
    selectXml: () => ipcRenderer.invoke('select-xml'),
    clearPdfs: () => ipcRenderer.invoke('clear-pdfs'),
    renamePdfs: (pdfPaths, xmlPath, lang, deleteOriginals) => ipcRenderer
        .invoke('rename-pdfs', pdfPaths, xmlPath, lang, deleteOriginals)
});