let selectedPdfPath = null;
let selectedTxtPath = null;

// Elements
const pdfPathElement = document.getElementById('pdf-path');
const txtPathElement = document.getElementById('txt-path');
const selectPdfBtn = document.getElementById('select-pdf');
const selectTxtBtn = document.getElementById('select-txt');
const renameBtn = document.getElementById('rename-btn');
const resultElement = document.getElementById('result');

// Event listeners
selectPdfBtn.addEventListener('click', async () => {
    const path = await window.electron.selectPdf();
    if (path) {
        selectedPdfPath = path;
        pdfPathElement.textContent = path;
        checkEnableRenameButton();
    }
});

selectTxtBtn.addEventListener('click', async () => {
    const path = await window.electron.selectTxt();
    if (path) {
        selectedTxtPath = path;
        txtPathElement.textContent = path;
        checkEnableRenameButton();
    }
});

renameBtn.addEventListener('click', async () => {
    if (selectedPdfPath && selectedTxtPath) {
        renameBtn.disabled = true;
        renameBtn.textContent = 'Processing...';

        const result = await window.electron.renamePdf(selectedPdfPath, selectedTxtPath);

        if (result.success) {
            resultElement.innerHTML = `
        <div class="success">
          <p>${result.message}</p>
          <p>Original: ${result.oldPath}</p>
          <p>New: ${result.newPath}</p>
        </div>
      `;
        } else {
            resultElement.innerHTML = `
        <div class="error">
          <p>${result.message}</p>
        </div>
      `;
        }

        renameBtn.disabled = false;
        renameBtn.textContent = 'Rename PDF';
    }
});

function checkEnableRenameButton() {
    renameBtn.disabled = !(selectedPdfPath && selectedTxtPath);
}

// Initialize button state
checkEnableRenameButton();