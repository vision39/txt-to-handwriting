/**
 * main.js — Application entry point
 *
 * Caches DOM references, initialises shared state, wires up
 * all UI modules, and boots the application.
 */

import { addCanvasPageToPDF, downloadCanvasAsImage } from './utils.js';
import {
  PAPER_PADDING_LEFT,
  PAPER_PADDING_RIGHT,
  PAPER_PADDING_TOP,
  PAPER_PADDING_BOTTOM,
  drawBlankCanvas,
  drawPaperBackground,
  calculateDocumentLayout,
  drawCalculatedPage,
} from './canvas.js';
import {
  initEditorToolbar,
  initSidebar,
  initFontModal,
  initDragAndDrop,
  syncInputPageStyles,
  parseEditorContent,
  positionFloatingToolbar,
  updateSelectionUI,
  initPagination,
  initEditAreaModal,
} from './ui.js';

// ─── DOM Element References ─────────────────────────────────────────

const el = {
  // Canvas
  canvas: document.getElementById('outputCanvas'),
  ctx: null, // set below

  // Editor
  textInput: document.getElementById('textInput'),
  headingSelect: document.getElementById('headingSelect'),
  inkColorInput: document.getElementById('inkColor'),

  // Hidden selects (controlled by sidebar)
  fontSelect: document.getElementById('fontSelect'),
  paperTypeSelect: document.getElementById('paperType'),

  // Header buttons
  generateBtn: document.getElementById('generateBtn'),
  resetLayoutBtn: document.getElementById('resetLayoutBtn'),
  downloadDropdownContainer: document.getElementById('downloadDropdownContainer'),
  downloadBtn: document.getElementById('downloadBtn'),
  downloadBtnText: document.getElementById('downloadBtnText'),
  downloadDropdownIcon: document.getElementById('downloadDropdownIcon'),
  downloadMenu: document.getElementById('downloadMenu'),
  downloadCurrentBtn: document.getElementById('downloadCurrentBtn'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  downloadPDFBtn: document.getElementById('downloadPDFBtn'),
  downloadPDFBtnText: document.getElementById('downloadPDFBtnText'),

  // Editor toolbar
  btnUnderline: document.getElementById('btnUnderline'),
  btnBulletList: document.getElementById('btnBulletList'),
  btnNumberList: document.getElementById('btnNumberList'),

  // Sidebar
  paperGrid: document.getElementById('paperGrid'),
  fontGrid: document.getElementById('fontGrid'),

  // Floating toolbar
  floatingToolbar: document.getElementById('floatingToolbar'),
  floatingMove: document.getElementById('floatingMove'),
  floatingColor: document.getElementById('floatingColor'),
  floatingReset: document.getElementById('floatingReset'),

  // Pagination UI
  paginationUI: document.getElementById('paginationUI'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageIndicator: document.getElementById('pageIndicator'),

  // Font upload modal
  addFontBtn: document.getElementById('addFontBtn'),
  fontModal: document.getElementById('fontModal'),
  closeFontModal: document.getElementById('closeFontModal'),
  modalOverlay: document.getElementById('modalOverlay'),
  fontUpload: document.getElementById('fontUpload'),
  uploadStatus: document.getElementById('uploadStatus'),

  // Edit Area Modal
  editAreaBtn: document.getElementById('editAreaBtn'),
  editAreaModal: document.getElementById('editAreaModal'),
  closeEditArea: document.getElementById('closeEditArea'),
  cancelEditArea: document.getElementById('cancelEditArea'),
  saveEditArea: document.getElementById('saveEditArea'),
  editAreaOverlay: document.getElementById('editAreaOverlay'),
  editAreaContainer: document.getElementById('editAreaContainer'),
  editAreaCanvas: document.getElementById('editAreaCanvas'),
  selectionBox: document.getElementById('selectionBox'),
};

el.ctx = el.canvas.getContext('2d');

// ─── Preloaded Assets ───────────────────────────────────────────────

const bg1Image = new Image();
bg1Image.src = 'assets/picture/Background 1.jpeg';

// ─── Shared Application State ───────────────────────────────────────
const { jsPDF } = window.jspdf;
const state = {
  paragraphsState: [],
  selectedParaIndex: -1,
  isCanvasGenerated: false,
  currentPage: 0,
  totalPages: 1,
  pageArea: {
    x: PAPER_PADDING_LEFT,
    y: PAPER_PADDING_TOP,
    w: 794 - PAPER_PADDING_LEFT - PAPER_PADDING_RIGHT,
    h: 1123 - PAPER_PADDING_TOP - PAPER_PADDING_BOTTOM
  }
};

// ─── Core Render / Generate Cycle ───────────────────────────────────

/**
 * Recalculate the entire document layout (word wrap, pagination).
 * Call this when content, font, or canvas size changes.
 */
function updateLayout() {
  if (!state.isCanvasGenerated) return;

  const baseFontSize = 24;
  const fontFamily = `"${el.fontSelect.value}", cursive`;
  el.ctx.font = `${baseFontSize}px ${fontFamily}`; // important for correct measurement

  const maxTextWidth = state.pageArea.w;

  state.totalPages = calculateDocumentLayout(
    el.ctx, el.canvas, state.paragraphsState, fontFamily, maxTextWidth, state.pageArea
  );

  // Ensure currentPage doesn't exceed totalPages if content shrank
  if (state.currentPage >= state.totalPages && state.totalPages > 0) {
    state.currentPage = Math.max(0, state.totalPages - 1);
  }
}

/**
 * Re-render the canvas using the pre-calculated layout state.
 * Extremely fast. Call this for pagination & drag events.
 */
function renderCanvas() {
  if (!state.isCanvasGenerated) return;

  const baseFontSize = 24;
  const baseLineSpacing = baseFontSize * 1.4;
  const fontFamily = `"${el.fontSelect.value}", cursive`;

  drawPaperBackground(el.ctx, el.canvas, el.paperTypeSelect.value, baseLineSpacing, bg1Image);

  el.ctx.textBaseline = 'alphabetic';

  drawCalculatedPage(
    el.ctx, state.paragraphsState, fontFamily,
    el.inkColorInput.value, state.selectedParaIndex, state.currentPage, state.pageArea
  );

  updatePaginationUI();
  positionFloatingToolbar(el, state);
}

/**
 * Update the visibility and state of the pagination overlay controls.
 */
function updatePaginationUI() {
  if (!state.isCanvasGenerated || state.totalPages <= 1) {
    el.paginationUI.classList.add('hidden');
    // Hide dropdown elements for single page
    if (el.downloadDropdownIcon) el.downloadDropdownIcon.classList.add('hidden');
    if (el.downloadMenu) el.downloadMenu.classList.add('hidden');
    return;
  }
  
  el.paginationUI.classList.remove('hidden');
  el.pageIndicator.textContent = `Page ${state.currentPage + 1} of ${state.totalPages}`;
  
  el.prevPageBtn.disabled = state.currentPage === 0;
  el.nextPageBtn.disabled = state.currentPage >= state.totalPages - 1;

  // Show dropdown arrow if multiple pages
  if (el.downloadDropdownIcon) el.downloadDropdownIcon.classList.remove('hidden');
}

/**
 * Synchronise the internal paragraph state with the current editor DOM.
 */
function syncTextState() {
  const parsedItems = parseEditorContent(el.textInput);

  state.paragraphsState = parsedItems.map((item, index) => {
    const existing = state.paragraphsState[index];

    if (existing) {
      return {
        ...existing,
        text: item.text || '',
        type: item.type,
        textSize: item.textSize || 'p',
        segments: item.segments || [],
        tableData: item.tableData || null,
        num: item.num || null,
      };
    }

    return {
      text: item.text || '',
      type: item.type,
      textSize: item.textSize || 'p',
      segments: item.segments || [],
      tableData: item.tableData || null,
      num: item.num || null,
      offsetX: 0,
      offsetY: 0,
      boundingBox: null,
      color: el.inkColorInput.value,
    };
  });

  // Deselect if the selected paragraph no longer exists
  if (state.selectedParaIndex >= state.paragraphsState.length) {
    state.selectedParaIndex = -1;
  }
  
  // Update layout and refresh UI
  updateLayout();
  updateSelectionUI(el, state, renderCanvas);
}

/**
 * Generate the handwriting output from the current editor content.
 */
function generateCanvas() {
  state.isCanvasGenerated = true;
  state.currentPage = 0; // Reset to page 1 on fresh generation

  el.downloadBtn.disabled = false;
  el.downloadPDFBtn.disabled = false;
  el.downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  el.downloadPDFBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  el.resetLayoutBtn.classList.remove('hidden');

  syncTextState();
  renderCanvas();
}

// ─── Event Wiring ───────────────────────────────────────────────────

// Generate button
el.generateBtn.addEventListener('click', generateCanvas);

// Close dropdown if clicked outside
document.addEventListener('click', (e) => {
  if (el.downloadDropdownContainer && !el.downloadDropdownContainer.contains(e.target)) {
    if (el.downloadMenu) el.downloadMenu.classList.add('hidden');
  }
});

// Download button (main)
el.downloadBtn.addEventListener('click', () => {
  if (!state.isCanvasGenerated) return;
  
  if (state.totalPages > 1) {
    // Toggle dropdown
    el.downloadMenu.classList.toggle('hidden');
  } else {
    // Single page download
    downloadCanvasAsImage(el.canvas);
  }
});

// Dropdown item: Download Current
if (el.downloadCurrentBtn) {
  el.downloadCurrentBtn.addEventListener('click', () => {
    el.downloadMenu.classList.add('hidden');
    if (!state.isCanvasGenerated) return;
    downloadCanvasAsImage(el.canvas, state.currentPage + 1);
  });
}

// Dropdown item: Download All
if (el.downloadAllBtn) {
  el.downloadAllBtn.addEventListener('click', async () => {
    el.downloadMenu.classList.add('hidden');
    if (!state.isCanvasGenerated) return;

    const originalPage = state.currentPage;
    const origDownloadText = el.downloadBtnText.textContent;

    // Disable button and other interactive elements to prevent state corruption
    el.downloadBtn.disabled = true;
    el.generateBtn.disabled = true;
    el.textInput.contentEditable = 'false';
    el.downloadBtn.classList.add('opacity-50', 'cursor-not-allowed');
    el.downloadBtnText.textContent = "Downloading...";

    try {
      const timestamp = Date.now(); // Use a single timestamp for the batch
      for (let i = 0; i < state.totalPages; i++) {
        state.currentPage = i;
        renderCanvas();

        // Wait for canvas to repaint and to space out downloads to avoid browser blocking
        await new Promise(r => setTimeout(r, 250));

        // Note: assumes downloadCanvasAsImage takes (canvas, pageNum, timestamp)
        downloadCanvasAsImage(el.canvas, i + 1, timestamp);
      }
    } finally {
      // Restore UI state safely
      state.currentPage = originalPage;
      renderCanvas();
      el.downloadBtnText.textContent = origDownloadText;
      el.downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      el.downloadBtn.disabled = false;
      el.generateBtn.disabled = false;
      el.textInput.contentEditable = 'true';
    }
  });
}

// Download PDF
if (el.downloadPDFBtn) {
  el.downloadPDFBtn.addEventListener('click', async () => {
    el.downloadMenu.classList.add('hidden');
    if (!state.isCanvasGenerated) return;

    
    const pdfDoc = new jsPDF({
      unit: 'pt',
      format: [state.pageArea.w + PAPER_PADDING_LEFT + PAPER_PADDING_RIGHT, 
              state.pageArea.h + PAPER_PADDING_TOP + PAPER_PADDING_BOTTOM
      ],
    });

    const originalPage = state.currentPage;
    const origDownloadText = el.downloadPDFBtnText.textContent;

    // Disable button and other interactive elements to prevent state corruption
    el.downloadPDFBtn.disabled = true;
    el.downloadBtn.disabled = true;
    el.generateBtn.disabled = true;
    el.textInput.contentEditable = 'false';
    el.downloadBtn.classList.add('opacity-50', 'cursor-not-allowed');
    el.downloadPDFBtn.classList.add('opacity-50', 'cursor-not-allowed');
    el.downloadPDFBtnText.textContent = "Downloading...";

    try {
      for (let i = 0; i < state.totalPages; i++) {
        state.currentPage = i;
        renderCanvas();

        // Wait for canvas to repaint and to space out downloads to avoid browser blocking
        await new Promise(r => setTimeout(r, 250));

        addCanvasPageToPDF(pdfDoc, el.canvas, i + 1);
      }
    } finally {
      // Restore UI state safely
      pdfDoc.save(`handwritten-note-${Date.now()}.pdf`);
      state.currentPage = originalPage;
      renderCanvas();
      el.downloadPDFBtnText.textContent = origDownloadText;
      el.downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      el.downloadPDFBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      el.downloadBtn.disabled = false;
      el.downloadPDFBtn.disabled = false;
      el.generateBtn.disabled = false;
      el.textInput.contentEditable = 'true';
    }
  });
}


// Ink colour picker (global)
el.inkColorInput.addEventListener('input', () => {
  syncInputPageStyles(el.textInput, el.fontSelect, el.inkColorInput);
  state.paragraphsState.forEach((para) => { para.color = el.inkColorInput.value; });

  if (state.selectedParaIndex !== -1 && state.paragraphsState[state.selectedParaIndex]) {
    el.floatingColor.value = el.inkColorInput.value;
  }
  
  // Color change doesn't alter layout, so we just render
  if (state.isCanvasGenerated) renderCanvas();
});

// Floating toolbar — per-paragraph colour override
el.floatingColor.addEventListener('input', (e) => {
  if (state.selectedParaIndex !== -1 && state.paragraphsState[state.selectedParaIndex]) {
    state.paragraphsState[state.selectedParaIndex].color = e.target.value;
    if (state.isCanvasGenerated) renderCanvas();
  }
});

// Floating toolbar — reset paragraph position
el.floatingReset.addEventListener('click', () => {
  if (state.selectedParaIndex !== -1 && state.paragraphsState[state.selectedParaIndex]) {
    state.paragraphsState[state.selectedParaIndex].offsetX = 0;
    state.paragraphsState[state.selectedParaIndex].offsetY = 0;
    if (state.isCanvasGenerated) renderCanvas();
  }
});

// Reset all paragraph positions
el.resetLayoutBtn.addEventListener('click', () => {
  state.paragraphsState.forEach((para) => { para.offsetX = 0; para.offsetY = 0; });
  if (state.isCanvasGenerated) renderCanvas();
});

// Keep floating toolbar positioned on resize / scroll
window.addEventListener('resize', () => positionFloatingToolbar(el, state));
window.addEventListener('scroll', () => positionFloatingToolbar(el, state));

// ─── Initialise Modules ─────────────────────────────────────────────

initEditorToolbar(el);
initSidebar(el, () => {
  syncInputPageStyles(el.textInput, el.fontSelect, el.inkColorInput);
  // Font/Paper change alters layout or background respectively, recalibrate layout and draw
  if (state.isCanvasGenerated) {
    updateLayout();
    renderCanvas();
  }
});
initFontModal(el);
initDragAndDrop(el, state, renderCanvas);
initPagination(el, state, renderCanvas);
initEditAreaModal(el, state, renderCanvas, updateLayout, drawPaperBackground, bg1Image, syncTextState);

// ─── Boot ───────────────────────────────────────────────────────────

document.fonts.ready.then(() => {
  syncInputPageStyles(el.textInput, el.fontSelect, el.inkColorInput);
});
syncInputPageStyles(el.textInput, el.fontSelect, el.inkColorInput);
drawBlankCanvas(el.ctx, el.canvas);

// ─── GitHub Contributors ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('contributorsGrid');
  if (!grid) return;

  const FALLBACK_CONTRIBUTORS = [
    {
      login: 'vision39',
      avatar_url: 'https://avatars.githubusercontent.com/u/87428861?v=4',
      html_url: 'https://github.com/vision39',
      contributions: 22,
    },
    {
      login: 'github-actions[bot]',
      avatar_url: 'https://avatars.githubusercontent.com/in/15368?v=4',
      html_url: 'https://github.com/apps/github-actions',
      contributions: 2,
    },
  ];

  function renderContributors(contributors) {
    if (contributors.length === 0) {
      grid.innerHTML = '<p class="text-xs text-gray-400">No contributors found.</p>';
      return;
    }

    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-4xl mx-auto';
    grid.innerHTML = contributors
      .map(
        (c) => `
      <a href="${c.html_url}" target="_blank" rel="noopener noreferrer"
         class="flex flex-col items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all group aspect-square"
         title="@${c.login}">
        <img src="${c.avatar_url}${c.avatar_url.includes('?') ? '&' : '?'}s=96" alt="${c.login}"
             class="w-16 h-16 rounded-full ring-2 ring-gray-100 group-hover:ring-blue-100 transition-all">
        <span class="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-center w-full truncate">@${c.login}</span>
      </a>`
      )
      .join('');
  }

  try {
    const response = await fetch('https://api.github.com/repos/vision39/txt-to-write/contributors');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    renderContributors(data);
  } catch {
    renderContributors(FALLBACK_CONTRIBUTORS);
  }
});

// ==========================================
// Dark Mode Toggle Logic
// ==========================================

const darkModeToggle = document.getElementById('dark-mode-toggle');
const toggleText = darkModeToggle.querySelector('span'); 
const moonIcon = document.getElementById('moon-icon');
const sunIcon = document.getElementById('sun-icon');
const siteLogo = document.getElementById('siteLogo');

// Helper function to apply colors
function applyTheme(theme) {
    const isDark = theme === 'dark';
    
    if (isDark) {
        document.body.classList.add('dark-mode');
        toggleText.textContent = 'Light Mode';
        moonIcon.classList.replace('block', 'hidden');
        sunIcon.classList.replace('hidden', 'block');
        if (siteLogo) siteLogo.src = 'assets/picture/icon-nobg.png';
    } else {
        document.body.classList.remove('dark-mode');
        toggleText.textContent = 'Dark Mode';
        sunIcon.classList.replace('block', 'hidden');
        moonIcon.classList.replace('hidden', 'block');
        if (siteLogo) siteLogo.src = 'assets/picture/icon.png';
    }
    
    // Add Accessibility (ARIA) states for screen readers
    darkModeToggle.setAttribute('aria-pressed', String(isDark));
    darkModeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

// 1. Check if the user already chose dark mode in a previous visit, else adapt to system preference
const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const currentTheme = localStorage.getItem('theme') || (systemPrefersDark ? 'dark' : 'light');
applyTheme(currentTheme);

// 2. Listen for clicks on the toggle button
darkModeToggle.addEventListener('click', () => {
    // Check what the NEW theme should be
    const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    
    // Apply it
    applyTheme(newTheme);
    
    // Save it to memory
    localStorage.setItem('theme', newTheme);

    // Re-draw the canvas so the UI updates instantly
    if (state.isCanvasGenerated) {
        renderCanvas();
    } else {
        drawBlankCanvas(el.ctx, el.canvas);
    }
});