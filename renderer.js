let selectedPdfPaths = [];
let selectedXmlPath = null;
let currentLang = 'en';

// Elements
const pdfPathsElement = document.getElementById('pdf-paths');
const xmlPathElement = document.getElementById('xml-path');
const selectPdfsBtn = document.getElementById('select-pdfs');
const selectXmlBtn = document.getElementById('select-xml');
const renameBtn = document.getElementById('rename-btn');
const resultElement = document.getElementById('result');
const clearSelectionBtn = document.getElementById('clear-selection');
const languageToggleBtn = document.getElementById('language-toggle');

const translations = {
    en: {
        title: "Tagleser",
        step1: "Step 1: Select PDF Files",
        selectPdfs: "Select PDF Files",
        clearSelection: "Clear Selection",
        step2: "Step 2: Select XML File",
        selectXml: "Select XML File",
        selectedFile: "Selected file:",
        none: "None",
        howItWorks: "How it works:",
        appWill: "The app will:",
        step1Detail: "Find each PDF in the XML document",
        step2Detail: "Look for the index with name=\"Bemerkung\"",
        step3Detail: "Use its value as the new filename",
        step4Detail: "Create a copy of each PDF with its new name",
        step3: "Step 3: Rename the PDFs",
        renamePdfs: "Rename PDFs",
        processing: "Processing...",
        successTitle: "Successfully renamed files:",
        errorsTitle: "Errors:",
        filesSelected: "file(s) selected",
        switchToGerman: "Switch to German",
        switchToEnglish: "Switch to English"
    },
    de: {
        title: "Tagleser",
        step1: "Schritt 1: PDF-Dateien auswählen",
        selectPdfs: "PDF-Dateien auswählen",
        clearSelection: "Auswahl aufheben",
        step2: "Schritt 2: XML-Datei mit",
        selectXml: "XML-Datei auswählen",
        selectedFile: "Ausgewählte Datei:",
        none: "Keine",
        howItWorks: "Wie es funktioniert:",
        appWill: "Die App wird:",
        step1Detail: "Jede PDF im XML-Dokument finden",
        step2Detail: "Nach dem Index mit name=\"Bemerkung\" suchen",
        step3Detail: "Seinen Wert als neuen Dateinamen verwenden",
        step4Detail: "Eine Kopie jeder PDF mit ihrem neuen Namen erstellen",
        step3: "Schritt 3: PDFs umbenennen",
        renamePdfs: "PDFs umbenennen",
        processing: "Verarbeitung...",
        successTitle: "Erfolgreich umbenannte Dateien:",
        errorsTitle: "Fehler:",
        filesSelected: "Datei(en) ausgewählt",
        switchToGerman: "Zu Deutsch wechseln",
        switchToEnglish: "Zu Englisch wechseln"
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
    document.getElementById('how-it-works').textContent = t.howItWorks;
    document.getElementById('app-will').textContent = t.appWill;
    document.getElementById('step1-detail').textContent = t.step1Detail;
    document.getElementById('step2-detail').textContent = t.step2Detail;
    document.getElementById('step3-detail').textContent = t.step3Detail;
    document.getElementById('step4-detail').textContent = t.step4Detail;
    document.getElementById('step3-title').textContent = t.step3;
    renameBtn.textContent = t.renamePdfs;

    // Toggle button text
    languageToggleBtn.textContent = lang === 'en' ? t.switchToGerman : t.switchToEnglish;

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

// Event listeners
selectPdfsBtn.addEventListener('click', async () => {
    const paths = await window.electron.selectPdfs();
    if (paths && paths.length > 0) {
        selectedPdfPaths = [...new Set([...selectedPdfPaths, ...paths])];
        updatePdfPathsList();
        checkEnableRenameButton();
    }
});

selectXmlBtn.addEventListener('click', async () => {
    const path = await window.electron.selectXml();
    if (path) {
        selectedXmlPath = path;
        xmlPathElement.textContent = path;
        checkEnableRenameButton();
    }
});

clearSelectionBtn.addEventListener('click', () => {
    selectedPdfPaths = [];
    updatePdfPathsList();
    checkEnableRenameButton();
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

        const result = await window.electron.renamePdfs(selectedPdfPaths, selectedXmlPath, currentLang);

        if (result.success) {
            let successHtml = `
        <div class="success">
          <h3>${result.message}</h3>
          <h4>${t.successTitle}</h4>
          <ul class="result-list">
      `;

            result.results.forEach(item => {
                successHtml += `
          <li>
            <strong>${item.oldName}</strong> → <strong>${item.newName}</strong>
          </li>
        `;
            });

            successHtml += `</ul>`;

            if (result.errors.length > 0) {
                successHtml += `
          <h4>${t.errorsTitle}</h4>
          <ul class="error-list">
        `;

                result.errors.forEach(error => {
                    successHtml += `<li>${error}</li>`;
                });

                successHtml += `</ul>`;
            }

            successHtml += `</div>`;
            resultElement.innerHTML = successHtml;
        } else {
            resultElement.innerHTML = `
        <div class="error">
          <h3>${result.message}</h3>
          <ul class="error-list">
            ${result.errors.map(err => `<li>${err}</li>`).join('')}
          </ul>
        </div>
      `;
        }

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
    selectedPdfPaths.forEach(path => {
        html += `<li>${path}</li>`;
    });
    html += '</ul>';
    html += `<p class="file-count">${selectedPdfPaths.length} ${t.filesSelected}</p>`;

    pdfPathsElement.innerHTML = html;
}

function checkEnableRenameButton() {
    renameBtn.disabled = !(selectedPdfPaths.length > 0 && selectedXmlPath);
}

// Initialize
updateLanguage('en');
updatePdfPathsList();
checkEnableRenameButton();