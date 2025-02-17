let selectedPdfPaths = [];
let selectedXmlPath = null;
let currentLang = 'de';
let deleteOriginals = false;

// Elements
const pdfPathsElement = document.getElementById('pdf-paths');
const xmlPathElement = document.getElementById('xml-path');
const selectPdfsBtn = document.getElementById('select-pdfs');
const selectXmlBtn = document.getElementById('select-xml');
const renameBtn = document.getElementById('rename-btn');
const resultElement = document.getElementById('result');
const clearSelectionBtn = document.getElementById('clear-selection');
const languageToggleBtn = document.getElementById('language-toggle');
const managerHeaderTitle = document.querySelector('.file-manager-title');

const translations = {
    en: {
        title: "Tagleser",
        step1: "Select PDF Files",
        selectPdfs: "Select PDFs",
        selectedPdfs: "Selected PDF Files",
        clearSelection: "Clear",
        step2: "Select XML File",
        selectXml: "Select XML File",
        selectedFile: "Selected file:",
        none: "None",
        step3: "Rename the PDFs",
        renamePdfs: "Rename PDFs",
        processing: "Processing...",
        successTitle: "Successfully renamed files:",
        errorsTitle: "Errors:",
        filesSelected: "file(s) selected",
        switchToGerman: "Zu Deutsch wechseln",
        switchToEnglish: "Zu Englisch wechseln",
        filesRenamed: "files renamed successfully",
        filesFailed: "files failed to rename",
        deleteOriginals: "Delete original files after renaming",
        filesDeleted: "original files deleted"
    },
    de: {
        title: "Tagleser",
        step1: "PDF-Dateien auswählen",
        selectPdfs: "PDFs auswählen",
        selectedPdfs: "Ausgewählte PDF-Dateien",
        clearSelection: "Leeren",
        step2: "XML-Datei mit",
        selectXml: "XML-Datei auswählen",
        selectedFile: "Ausgewählte Datei:",
        none: "Keine",
        step3: "PDFs umbenennen",
        renamePdfs: "PDFs umbenennen",
        processing: "Verarbeitung...",
        successTitle: "Erfolgreich umbenannte Dateien:",
        errorsTitle: "Fehler:",
        filesSelected: "Datei(en) ausgewählt",
        switchToGerman: "Switch to German",
        switchToEnglish: "Switch to English",
        filesRenamed: "Dateien erfolgreich umbenannt",
        filesFailed: "Dateien konnten nicht umbenannt werden",
        deleteOriginals: "Originaldateien nach dem Umbenennen löschen",
        filesDeleted: "Originaldateien gelöscht",
    }
};

// Function to update UI language
function updateLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];

    // Update all text elements
    document.getElementById('app-title').textContent = t.title;
    document.getElementById('step1-title').textContent = t.step1;
    selectPdfsBtn.textContent = t.selectPdfs;
    clearSelectionBtn.textContent = t.clearSelection;
    document.getElementById('step2-title').textContent = t.step2;
    selectXmlBtn.textContent = t.selectXml;
    document.getElementById('selected-file-text').textContent = t.selectedFile;
    document.getElementById('step3-title').textContent = t.step3;
    renameBtn.textContent = t.renamePdfs;
    managerHeaderTitle.textContent = t.selectedPdfs;

    // Toggle button text
    languageToggleBtn.textContent = lang === 'en' ? t.switchToGerman : t.switchToEnglish;
    document.getElementById('delete-originals-label').textContent = translations[lang].deleteOriginals;

    // Update "None" text if no files are selected
    if (selectedPdfPaths.length === 0) {
        document.querySelector('#pdf-paths .text-muted').textContent = t.none;
    }
    if (!selectedXmlPath) {
        xmlPathElement.textContent = t.none;
    }

    // Update file count if files are selected
    updatePdfPathsList();
}

document.getElementById('delete-originals').addEventListener('change', (e) => {
    deleteOriginals = e.target.checked;
});

// Event listeners
selectPdfsBtn.addEventListener('click', async () => {
    const files = await window.electron.selectPdfs();
    if (files && files.length > 0) {
        selectedPdfPaths = [...new Set([...selectedPdfPaths, ...files])];
        updatePdfPathsList();
        checkEnableRenameButton();
    }
});

selectXmlBtn.addEventListener('click', async () => {
    const file = await window.electron.selectXml();
    if (file) {
        selectedXmlPath = file;
        xmlPathElement.textContent = file.fileName;
        checkEnableRenameButton();
    }
});

clearSelectionBtn.addEventListener('click', () => {
    selectedPdfPaths = [];
    updatePdfPathsList();
    checkEnableRenameButton();
    resultElement.innerHTML = '';
});

languageToggleBtn.addEventListener('click', () => {
    const newLang = currentLang === 'en' ? 'de' : 'en';
    updateLanguage(newLang);
});

renameBtn.addEventListener('click', async () => {
    if (selectedPdfPaths.length > 0 && selectedXmlPath) {
        const t = translations[currentLang];
        renameBtn.disabled = true;
        renameBtn.textContent = t.processing;

        // Extract full paths for the rename operation
        const pdfFullPaths = selectedPdfPaths.map(file => file.fullPath);

        const result = await window.electron.renamePdfs(
            pdfFullPaths,
            selectedXmlPath.fullPath,
            currentLang,
            deleteOriginals
        );

        const resultContainer = document.createElement('div');

        if (result.results && result.results.length > 0) {
            const successDiv = document.createElement('div');
            successDiv.className = 'success';
            successDiv.innerHTML = `
                <h3>${t.successTitle}</h3>
                <p>${result.results.length} ${t.filesRenamed}</p>
                ${deleteOriginals ? `<p>${result.results.length} ${t.filesDeleted}</p>` : ''}
            `;
            resultContainer.appendChild(successDiv);
        }

        if (result.errors && result.errors.length > 0) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = `
                <h3>${t.errorsTitle}</h3>
                <p>${result.errors.length} ${t.filesFailed}</p>
                <ul class="error-list">
                    ${result.errors.map(filename => `<li>${filename}</li>`).join('')}
                </ul>
            `;
            resultContainer.appendChild(errorDiv);
        }

        resultElement.innerHTML = '';
        resultElement.appendChild(resultContainer);

        renameBtn.disabled = false;
        renameBtn.textContent = t.renamePdfs;
    }
});

function updatePdfPathsList() {
    const t = translations[currentLang];

    if (selectedPdfPaths.length === 0) {
        pdfPathsElement.innerHTML = `<span class="text-muted">${t.none}</span>`;
        return;
    }

    let html = '<ul class="file-list">';
    selectedPdfPaths.forEach(file => {
        html += `<li>${file.fileName}</li>`;
    });
    html += '</ul>';
    html += `<p class="file-count">${selectedPdfPaths.length} ${t.filesSelected}</p>`;

    pdfPathsElement.innerHTML = html;
}

function checkEnableRenameButton() {
    renameBtn.disabled = !(selectedPdfPaths.length > 0 && selectedXmlPath);
}

// Initialize
updateLanguage('de');
updatePdfPathsList();
checkEnableRenameButton();