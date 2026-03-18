/**
 * main.js — Application entry point
 *
 * Caches DOM references, initialises shared state, wires up
 * all UI modules, and boots the application.
 */

import { downloadCanvasAsImage } from './utils.js';
import {
  PAPER_PADDING_LEFT,
  PAPER_PADDING_RIGHT,
  drawBlankCanvas,
  drawPaperBackground,
  processAndDrawParagraphs,
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
  downloadBtn: document.getElementById('downloadBtn'),
  resetLayoutBtn: document.getElementById('resetLayoutBtn'),

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

  // Font upload modal
  addFontBtn: document.getElementById('addFontBtn'),
  fontModal: document.getElementById('fontModal'),
  closeFontModal: document.getElementById('closeFontModal'),
  modalOverlay: document.getElementById('modalOverlay'),
  fontUpload: document.getElementById('fontUpload'),
  uploadStatus: document.getElementById('uploadStatus'),
};

el.ctx = el.canvas.getContext('2d');

// ─── Preloaded Assets ───────────────────────────────────────────────

const bg1Image = new Image();
bg1Image.src = 'assets/picture/Background 1.jpeg';

// ─── Shared Application State ───────────────────────────────────────

const state = {
  paragraphsState: [],
  selectedParaIndex: -1,
  isCanvasGenerated: false,
};

// ─── Core Render / Generate Cycle ───────────────────────────────────

/**
 * Re-render the canvas using the current state.
 * Does nothing if the user hasn't generated output yet.
 */
function renderCanvas() {
  if (!state.isCanvasGenerated) return;

  const baseFontSize = 24;
  const baseLineSpacing = baseFontSize * 1.4;
  const fontFamily = `"${el.fontSelect.value}", cursive`;

  drawPaperBackground(el.ctx, el.canvas, el.paperTypeSelect.value, baseLineSpacing, bg1Image);

  el.ctx.font = `${baseFontSize}px ${fontFamily}`;
  el.ctx.fillStyle = el.inkColorInput.value;
  el.ctx.textBaseline = 'alphabetic';

  const maxTextWidth = el.canvas.width - PAPER_PADDING_LEFT - PAPER_PADDING_RIGHT;

  processAndDrawParagraphs(
    el.ctx, state.paragraphsState, fontFamily,
    el.inkColorInput.value, maxTextWidth, state.selectedParaIndex
  );

  positionFloatingToolbar(el, state);
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
    updateSelectionUI(el, state, renderCanvas);
  }
}

/**
 * Generate the handwriting output from the current editor content.
 */
function generateCanvas() {
  state.isCanvasGenerated = true;

  el.downloadBtn.disabled = false;
  el.downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  el.resetLayoutBtn.classList.remove('hidden');

  syncTextState();
  renderCanvas();
}

// ─── Event Wiring ───────────────────────────────────────────────────

// Generate button
el.generateBtn.addEventListener('click', generateCanvas);

// Download button
el.downloadBtn.addEventListener('click', () => {
  if (!state.isCanvasGenerated) return;
  downloadCanvasAsImage(el.canvas);
});

// Ink colour picker (global)
el.inkColorInput.addEventListener('input', () => {
  syncInputPageStyles(el.textInput, el.fontSelect, el.inkColorInput);
  state.paragraphsState.forEach((para) => { para.color = el.inkColorInput.value; });

  if (state.selectedParaIndex !== -1 && state.paragraphsState[state.selectedParaIndex]) {
    el.floatingColor.value = el.inkColorInput.value;
  }
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
initSidebar(el, () => syncInputPageStyles(el.textInput, el.fontSelect, el.inkColorInput));
initFontModal(el);
initDragAndDrop(el, state, renderCanvas);

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

    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto';
    grid.innerHTML = contributors
      .map(
        (c) => `
      <a href="${c.html_url}" target="_blank" rel="noopener noreferrer"
         class="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all group"
         title="${c.login} — ${c.contributions} contributions">
        <img src="${c.avatar_url}${c.avatar_url.includes('?') ? '&' : '?'}s=96" alt="${c.login}"
             class="w-16 h-16 rounded-full ring-2 ring-gray-100 group-hover:ring-blue-100 transition-all">
        <div class="flex flex-col">
          <span class="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">@${c.login}</span>
          <span class="text-xs text-gray-500">${c.contributions} contributions</span>
        </div>
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
