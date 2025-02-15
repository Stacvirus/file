let selectedPdfPaths = [];
let selectedXmlPath = null;

// Elements
const pdfPathsElement = document.getElementById('pdf-paths');
const xmlPathElement = document.getElementById('xml-path');
const selectPdfsBtn = document.getElementById('select-pdfs');
const selectXmlBtn = document.getElementById('select-xml');
const renameBtn = document.getElementById('rename-btn');
const resultElement = document.getElementById('result');

// Event listeners
selectPdfsBtn.addEventListener('click', async () => {
    const paths = await window.electron.selectPdfs();
    if (paths && paths.length > 0) {
        // Add new paths to the existing selection
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

renameBtn.addEventListener('click', async () => {
    if (selectedPdfPaths.length > 0 && selectedXmlPath) {
        renameBtn.disabled = true;
        renameBtn.textContent = 'Processing...';

        const result = await window.electron.renamePdfs(selectedPdfPaths, selectedXmlPath);

        if (result.success) {
            let successHtml = `
        <div class="success">
          <h3>${result.message}</h3>
          <h4>Successfully renamed files:</h4>
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
          <h4>Errors:</h4>
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
        renameBtn.textContent = 'Rename PDFs';
    }
});

function updatePdfPathsList() {
    if (selectedPdfPaths.length === 0) {
        pdfPathsElement.innerHTML = '<span class="text-muted">None</span>';
        return;
    }

    let html = '<ul class="file-list">';
    selectedPdfPaths.forEach(path => {
        html += `<li>${path}</li>`;
    });
    html += '</ul>';
    html += `<p class="file-count">${selectedPdfPaths.length} file(s) selected</p>`;

    pdfPathsElement.innerHTML = html;
}

function checkEnableRenameButton() {
    renameBtn.disabled = !(selectedPdfPaths.length > 0 && selectedXmlPath);
}

// Initialize
updatePdfPathsList();
checkEnableRenameButton();

// Add clear selection button functionality
const clearSelectionBtn = document.getElementById('clear-selection');
if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
        selectedPdfPaths = [];
        updatePdfPathsList();
        checkEnableRenameButton();
    });
}