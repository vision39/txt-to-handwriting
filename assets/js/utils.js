/**
 * utils.js — Reusable helper functions (no DOM dependencies)
 *
 * Provides coordinate conversion, upload status display,
 * and canvas download utilities.
 */

// ─── Canvas Coordinate Helpers ──────────────────────────────────────

/**
 * Convert a mouse or touch event to canvas-space coordinates,
 * accounting for CSS scaling of the canvas element.
 *
 * @param {MouseEvent|TouchEvent} event
 * @param {HTMLCanvasElement} canvas
 * @returns {{ x: number, y: number }}
 */
export function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// ─── Upload Status Display ──────────────────────────────────────────

/**
 * Unified status message for the font-upload modal.
 *
 * @param {HTMLElement} statusElement  — the status container
 * @param {string}      message       — text to display
 * @param {'info'|'error'|'success'} type
 */
export function showUploadStatus(statusElement, message, type = 'info') {
  const COLOR_MAP = {
    info: 'text-blue-600',
    error: 'text-red-500',
    success: 'text-green-600',
  };

  statusElement.textContent = message;
  statusElement.className = `mt-4 text-xs text-center ${COLOR_MAP[type] || COLOR_MAP.info}`;
  statusElement.classList.remove('hidden');
}

// ─── Canvas Download ────────────────────────────────────────────────

/**
 * Trigger a browser download of the canvas contents as a PNG file.
 *
 * @param {HTMLCanvasElement} canvas
 */
export function downloadCanvasAsImage(canvas, pageNum = null, timestamp = Date.now()) {
  const link = document.createElement('a');
  const suffix = pageNum ? `-page-${pageNum}` : '';
  link.download = `handwritten-note${suffix}-${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function addCanvasPageToPDF(pdfDoc, canvas, pageNum) {
  const imgData = canvas.toDataURL("image/png");

  const pdfWidth = pdfDoc.internal.pageSize.getWidth();
  const pdfHeight = pdfDoc.internal.pageSize.getHeight();

  // Add new page for all pages except the first
  if (pageNum > 1) {
    pdfDoc.addPage([pdfWidth, pdfHeight]);
  }

  // Draw image to PDF page
  pdfDoc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
}
