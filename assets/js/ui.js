/**
 * ui.js — DOM interactions, event handling, and editor parsing
 *
 * Manages the editor toolbar, sidebar selection, font upload modal,
 * canvas drag-and-drop, and the rich-text → structured-data parser.
 */

import { getCanvasCoordinates, showUploadStatus } from './utils.js';

// ─── Editor Toolbar ─────────────────────────────────────────────────

/**
 * Wire up the formatting toolbar (underline, lists, headings).
 *
 * @param {object} el — DOM element references
 * @param {HTMLElement} el.textInput
 * @param {HTMLButtonElement} el.btnUnderline
 * @param {HTMLButtonElement} el.btnBulletList
 * @param {HTMLButtonElement} el.btnNumberList
 * @param {HTMLSelectElement} el.headingSelect
 */
export function initEditorToolbar(el) {
  el.btnUnderline.addEventListener('click', () => {
    document.execCommand('underline', false, null);
    el.textInput.focus();
    updateToolbarState(el);
  });

  el.btnBulletList.addEventListener('click', () => {
    document.execCommand('insertUnorderedList', false, null);
    el.textInput.focus();
    updateToolbarState(el);
  });

  el.btnNumberList.addEventListener('click', () => {
    document.execCommand('insertOrderedList', false, null);
    el.textInput.focus();
    updateToolbarState(el);
  });

  el.headingSelect.addEventListener('change', () => {
    document.execCommand('formatBlock', false, el.headingSelect.value);
    el.textInput.focus();
    updateToolbarState(el);
  });

  // Reflect formatting state when the caret moves
  document.addEventListener('selectionchange', () => {
    const active = document.activeElement;
    if (el.textInput.contains(active) || el.textInput === active) {
      updateToolbarState(el);
    }
  });

  // Paste as plain text to prevent rich-HTML injection
  el.textInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
}

/**
 * Synchronise toolbar button active-states with the current selection.
 */
export function updateToolbarState(el) {
  el.btnUnderline.classList.toggle('active', document.queryCommandState('underline'));
  el.btnBulletList.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
  el.btnNumberList.classList.toggle('active', document.queryCommandState('insertOrderedList'));

  const VALID_FORMATS = ['h1', 'h2', 'h3', 'p'];
  let format = (document.queryCommandValue('formatBlock') || 'p').toLowerCase();
  el.headingSelect.value = VALID_FORMATS.includes(format) ? format : 'p';
}

// ─── Sidebar: Paper & Font Selection ────────────────────────────────

/**
 * Handle paper-background and font-style sidebar clicks.
 *
 * @param {object} el
 * @param {HTMLElement} el.paperGrid
 * @param {HTMLElement} el.fontGrid
 * @param {HTMLSelectElement} el.paperTypeSelect
 * @param {HTMLSelectElement} el.fontSelect
 * @param {Function} onSelectionChange — callback after any change
 */
export function initSidebar(el, onSelectionChange) {
  el.paperGrid.addEventListener('click', (e) => {
    const thumb = e.target.closest('.paper-thumb');
    if (!thumb) return;

    el.paperGrid.querySelectorAll('.paper-thumb').forEach((t) => t.classList.remove('active'));
    thumb.classList.add('active');
    el.paperTypeSelect.value = thumb.dataset.paper;
    onSelectionChange();
  });

  el.fontGrid.addEventListener('click', (e) => {
    const thumb = e.target.closest('.font-thumb');
    if (!thumb || !thumb.dataset.font) return; // skip the "+" button

    el.fontGrid.querySelectorAll('.font-thumb').forEach((t) => t.classList.remove('active'));
    thumb.classList.add('active');
    el.fontSelect.value = thumb.dataset.font;
    onSelectionChange();
  });
}

// ─── Custom Font Upload Modal ───────────────────────────────────────

/**
 * Manage custom-font-upload modal: open, close, and file processing.
 *
 * @param {object} el
 * @param {HTMLElement}       el.addFontBtn
 * @param {HTMLElement}       el.fontModal
 * @param {HTMLButtonElement} el.closeFontModal
 * @param {HTMLElement}       el.modalOverlay
 * @param {HTMLInputElement}  el.fontUpload
 * @param {HTMLElement}       el.uploadStatus
 * @param {HTMLSelectElement} el.fontSelect
 * @param {HTMLElement}       el.fontGrid
 */
export function initFontModal(el) {
  const MAX_FONT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  function openModal() {
    el.fontModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    el.fontModal.classList.add('hidden');
    document.body.style.overflow = '';
    el.uploadStatus.classList.add('hidden');
    el.uploadStatus.textContent = '';
  }

  el.addFontBtn.addEventListener('click', openModal);
  el.closeFontModal.addEventListener('click', closeModal);
  el.modalOverlay.addEventListener('click', closeModal);

  el.fontUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FONT_SIZE_BYTES) {
      showUploadStatus(el.uploadStatus, 'File is too large (max 5 MB)', 'error');
      return;
    }

    const fontName = `CustomFont_${Date.now()}`;
    const displayName = file.name.split('.')[0].substring(0, 15);

    showUploadStatus(el.uploadStatus, 'Loading font…', 'info');

    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onload = async () => {
        try {
          const fontFace = new FontFace(fontName, reader.result);
          const loadedFace = await fontFace.load();
          document.fonts.add(loadedFace);

          // Add to hidden <select>
          const option = document.createElement('option');
          option.value = fontName;
          option.textContent = displayName;
          el.fontSelect.appendChild(option);

          // Add to sidebar grid (before the "+" button)
          const newThumb = document.createElement('div');
          newThumb.className = 'font-thumb';
          newThumb.dataset.font = fontName;
          newThumb.innerHTML =
            `<span style="font-family:'${fontName}', cursive; font-size: 15px;">${displayName}</span>`;
          el.fontGrid.insertBefore(newThumb, el.addFontBtn);

          // Auto-select the new font
          newThumb.click();

          showUploadStatus(el.uploadStatus, 'Font uploaded successfully!', 'success');
          setTimeout(closeModal, 1000);
        } catch (err) {
          console.error('Font loading error:', err);
          showUploadStatus(el.uploadStatus, 'Failed to load font. Is it a valid font file?', 'error');
        }
      };
    } catch (err) {
      showUploadStatus(el.uploadStatus, 'Error reading file.', 'error');
    }
  });
}

// ─── Input Page Styling ─────────────────────────────────────────────

const BASE_FONT_SIZE = 24;
const FIXED_LINE_SPACING = 36;

/**
 * Mirror the selected font and ink colour onto the contenteditable editor.
 */
export function syncInputPageStyles(textInput, fontSelect, inkColorInput) {
  const fontFamily = `"${fontSelect.value}", cursive`;

  textInput.style.fontSize = `${BASE_FONT_SIZE}px`;
  textInput.style.fontFamily = fontFamily;
  textInput.style.lineHeight = `${FIXED_LINE_SPACING}px`;
  textInput.style.color = inkColorInput.value;
}

// ─── Rich Text → Structured Paragraphs Parser ──────────────────────

/**
 * Parse the contenteditable HTML into an array of structured paragraph
 * objects suitable for canvas rendering.
 *
 * Each object has: { type, text, textSize, segments, num? }
 *   - type: 'text' | 'bullet' | 'number'
 *   - segments: [{ text, underline }]
 *
 * @param {HTMLElement} textInput — the contenteditable element
 * @returns {Array}
 */
export function parseEditorContent(textInput) {
  const items = [];

  /**
   * Recursively extract { text, underline } segments from a DOM node,
   * preserving underline state through nested elements.
   */
  function extractTextSegments(node) {
    const segments = [];

    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        segments.push({ text: node.textContent, underline: false });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      if (tag === 'br') {
        segments.push({ text: '\n', underline: false });
      } else if (tag === 'u') {
        node.childNodes.forEach((child) => {
          const childSegs = extractTextSegments(child);
          childSegs.forEach((s) => { s.underline = true; });
          segments.push(...childSegs);
        });
      } else {
        node.childNodes.forEach((child) => {
          segments.push(...extractTextSegments(child));
        });
      }
    }

    return segments;
  }

  /**
   * Process a top-level DOM node into one or more paragraph items.
   */
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          if (line || i < lines.length - 1) {
            items.push({
              type: 'text',
              text: line,
              segments: [{ text: line, underline: false }],
            });
          }
        });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === 'br') {
      items.push({ type: 'text', text: '', segments: [] });
      return;
    }

    if (tag === 'ul') {
      node.querySelectorAll(':scope > li').forEach((li) => {
        const segs = extractTextSegments(li);
        const text = segs.map((s) => s.text).join('');
        items.push({ type: 'bullet', text, segments: segs });
      });
      return;
    }

    if (tag === 'ol') {
      let num = 1;
      node.querySelectorAll(':scope > li').forEach((li) => {
        const segs = extractTextSegments(li);
        const text = segs.map((s) => s.text).join('');
        items.push({ type: 'number', num, text, segments: segs });
        num++;
      });
      return;
    }

    if (['h1', 'h2', 'h3', 'div', 'p', 'span', 'u'].includes(tag)) {
      const segs = extractTextSegments(node);
      const text = segs.map((s) => s.text).join('');
      const textSize = ['h1', 'h2', 'h3'].includes(tag) ? tag : 'p';

      const lines = text.split('\n');
      if (lines.length > 1) {
        lines.forEach((line) => {
          items.push({
            type: 'text',
            textSize,
            text: line,
            segments: [{ text: line, underline: tag === 'u' }],
          });
        });
      } else if (['h1', 'h2', 'h3', 'div', 'p'].includes(tag)) {
        items.push({ type: 'text', textSize, text, segments: segs });
      } else {
        // Inline element — merge into the previous item if possible
        if (items.length > 0 && items[items.length - 1].type === 'text') {
          items[items.length - 1].text += text;
          items[items.length - 1].segments.push(...segs);
        } else {
          items.push({ type: 'text', textSize, text, segments: segs });
        }
      }
      return;
    }

    // Fallback: recurse into unknown block elements
    node.childNodes.forEach((child) => processNode(child));
  }

  textInput.childNodes.forEach((child) => processNode(child));
  return items;
}

// ─── Canvas Drag & Drop ─────────────────────────────────────────────

/**
 * Enable drag-and-drop repositioning of paragraphs on the canvas
 * via the floating toolbar's move handle.
 *
 * @param {object} el
 * @param {HTMLCanvasElement}  el.canvas
 * @param {HTMLElement}        el.floatingMove
 * @param {HTMLElement}        el.floatingToolbar
 * @param {object}             state — shared application state
 * @param {Function}           renderCanvas — re-render callback
 */
export function initDragAndDrop(el, state, renderCanvas) {
  let isDragging = false;
  let activeParaIndex = -1;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialOffsetX = 0;
  let initialOffsetY = 0;

  // --- Canvas click: select / deselect a paragraph ---

  function handleCanvasPointerDown(e) {
    if (!state.isCanvasGenerated) return;

    const pos = getCanvasCoordinates(e, el.canvas);
    let clickedIndex = -1;

    // Iterate backwards so top-most (last-drawn) wins
    for (let i = state.paragraphsState.length - 1; i >= 0; i--) {
      const box = state.paragraphsState[i].boundingBox;
      if (
        box &&
        pos.x >= box.x && pos.x <= box.x + box.w &&
        pos.y >= box.y && pos.y <= box.y + box.h
      ) {
        clickedIndex = i;
        break;
      }
    }

    if (state.selectedParaIndex !== clickedIndex) {
      state.selectedParaIndex = clickedIndex;
      updateSelectionUI(el, state, renderCanvas);
    }
  }

  el.canvas.addEventListener('mousedown', handleCanvasPointerDown);
  el.canvas.addEventListener('touchstart', handleCanvasPointerDown, { passive: false });

  // --- Hover cursor on canvas ---

  el.canvas.addEventListener('mousemove', (e) => {
    if (isDragging || !state.isCanvasGenerated) return;

    const pos = getCanvasCoordinates(e, el.canvas);
    let hovered = false;

    for (let i = state.paragraphsState.length - 1; i >= 0; i--) {
      const box = state.paragraphsState[i].boundingBox;
      if (
        box &&
        pos.x >= box.x && pos.x <= box.x + box.w &&
        pos.y >= box.y && pos.y <= box.y + box.h
      ) {
        hovered = true;
        break;
      }
    }

    el.canvas.style.cursor = hovered ? 'pointer' : 'default';
  });

  // --- Floating toolbar move handle ---

  function startDrag(e) {
    if (state.selectedParaIndex === -1 || !state.isCanvasGenerated) return;

    e.preventDefault();
    isDragging = true;
    activeParaIndex = state.selectedParaIndex;
    document.body.style.cursor = 'grabbing';

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartX = clientX;
    dragStartY = clientY;
    initialOffsetX = state.paragraphsState[activeParaIndex].offsetX;
    initialOffsetY = state.paragraphsState[activeParaIndex].offsetY;
  }

  el.floatingMove.addEventListener('mousedown', startDrag);
  el.floatingMove.addEventListener('touchstart', startDrag, { passive: false });

  // --- Global drag tracking ---

  function onDragMove(e) {
    if (!isDragging || activeParaIndex === -1) return;
    if (e.type === 'touchmove') e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    const rect = el.canvas.getBoundingClientRect();
    const scaleX = el.canvas.width / rect.width;
    const scaleY = el.canvas.height / rect.height;

    state.paragraphsState[activeParaIndex].offsetX = initialOffsetX + dx * scaleX;
    state.paragraphsState[activeParaIndex].offsetY = initialOffsetY + dy * scaleY;
    renderCanvas();
  }

  function stopDrag() {
    isDragging = false;
    activeParaIndex = -1;
    document.body.style.cursor = 'default';
  }

  window.addEventListener('mousemove', (e) => { if (isDragging) onDragMove(e); }, { passive: false });
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchmove', (e) => { if (isDragging) onDragMove(e); }, { passive: false });
  window.addEventListener('touchend', stopDrag);
}

// ─── Floating Toolbar Positioning ───────────────────────────────────

/**
 * Position the floating toolbar above (or below) the selected paragraph.
 */
export function positionFloatingToolbar(el, state) {
  if (state.selectedParaIndex === -1 || !state.paragraphsState[state.selectedParaIndex]) {
    el.floatingToolbar.classList.add('hidden');
    return;
  }

  const box = state.paragraphsState[state.selectedParaIndex].boundingBox;
  if (!box) return;

  const rect = el.canvas.getBoundingClientRect();
  const scaleX = rect.width / el.canvas.width;
  const scaleY = rect.height / el.canvas.height;

  const screenX = rect.left + window.scrollX + box.x * scaleX;
  const screenY = rect.top + window.scrollY + box.y * scaleY;
  const boxScreenWidth = box.w * scaleX;

  const toolbarLeft = screenX + boxScreenWidth / 2 - el.floatingToolbar.offsetWidth / 2;
  let toolbarTop = screenY - 55;

  // If too close to the top, show below instead
  if (box.y * scaleY < 50) {
    toolbarTop = screenY + box.h * scaleY + 15;
  }

  el.floatingToolbar.style.left = `${toolbarLeft}px`;
  el.floatingToolbar.style.top = `${toolbarTop}px`;
}

/**
 * Show or hide the floating toolbar based on current selection,
 * and re-render so the selection highlight is in sync.
 */
export function updateSelectionUI(el, state, renderCanvas) {
  if (state.selectedParaIndex !== -1 && state.paragraphsState[state.selectedParaIndex]) {
    el.floatingToolbar.classList.remove('hidden');
    el.floatingColor.value =
      state.paragraphsState[state.selectedParaIndex].color || el.inkColorInput.value;
    positionFloatingToolbar(el, state);
  } else {
    el.floatingToolbar.classList.add('hidden');
  }

  if (state.isCanvasGenerated) renderCanvas();
}
