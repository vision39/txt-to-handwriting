/**
 * canvas.js — All canvas drawing and rendering logic
 *
 * Handles paper backgrounds, text rendering with word-wrap,
 * underline support, and selection highlights.
 */

// ─── Paper Layout Constants ─────────────────────────────────────────

export const PAPER_PADDING_LEFT = 80;
export const PAPER_PADDING_RIGHT = 30;
export const PAPER_PADDING_TOP = 80;
export const PAPER_PADDING_BOTTOM = 80;

/** Font-size to canvas-pixel mapping for heading levels */
const HEADING_SIZE_MAP = { h1: 48, h2: 36, h3: 28, p: 24 };

// ─── Blank Canvas ───────────────────────────────────────────────────

/**
 * Draw the initial placeholder message before any content is generated.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 */
export function drawBlankCanvas(ctx, canvas) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#d1d5db';
  ctx.font = '22px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Click 'Convert to Handwriting'", canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillText('to generate your note', canvas.width / 2, canvas.height / 2 + 14);

  // Reset alignment to defaults
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ─── Paper Background ───────────────────────────────────────────────

/**
 * Fill the canvas with the selected paper background style.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {string} paperType     — 'ruled' | 'blank' | 'grid' | 'bg1'
 * @param {number} lineSpacing   — vertical distance between lines
 * @param {HTMLImageElement} bg1Image — preloaded background photo
 */
export function drawPaperBackground(ctx, canvas, paperType, lineSpacing, bg1Image) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  switch (paperType) {
    case 'bg1':
      if (bg1Image.complete && bg1Image.naturalWidth > 0) {
        ctx.drawImage(bg1Image, 0, 0, canvas.width, canvas.height);
      }
      break;

    case 'ruled':
      drawRuledLines(ctx, canvas, lineSpacing);
      break;

    case 'grid':
      drawGridLines(ctx, canvas, lineSpacing);
      break;

    // 'blank' needs no additional drawing
  }
}

/**
 * Draw horizontal ruled lines with a left margin indicator.
 */
function drawRuledLines(ctx, canvas, lineSpacing) {
  ctx.strokeStyle = 'rgba(0, 150, 255, 0.2)';
  ctx.lineWidth = 1;

  for (let y = PAPER_PADDING_TOP; y < canvas.height; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Red margin line
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAPER_PADDING_LEFT - 10, 0);
  ctx.lineTo(PAPER_PADDING_LEFT - 10, canvas.height);
  ctx.stroke();
}

/**
 * Draw a square grid pattern across the canvas.
 */
function drawGridLines(ctx, canvas, gridSize) {
  ctx.strokeStyle = 'rgba(0, 150, 255, 0.12)';
  ctx.lineWidth = 0.5;

  for (let y = PAPER_PADDING_TOP; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (let x = PAPER_PADDING_LEFT; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

// ─── Selection Highlight ────────────────────────────────────────────

/**
 * Draw a blue selection rectangle around a paragraph bounding box.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} box
 */
export function drawSelectionHighlight(ctx, box) {
  ctx.save();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

// ─── Paragraph Rendering ────────────────────────────────────────────

/**
 * Calculate the full document layout, word-wrapping paragraphs and computing page breaks.
 * This caches the exact line positions and hitboxes in the `para.layout` object,
 * returning the total number of pages required.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {Array}  paragraphsState
 * @param {string} fontFamily
 * @param {number} maxWidth
 * @param {object} pageArea - The bounding box {x, y, w, h}
 * @returns {number} totalPages
 */
export function calculateDocumentLayout(ctx, canvas, paragraphsState, fontFamily, maxWidth, pageArea) {
  const BASE_FONT_SIZE = HEADING_SIZE_MAP.p;
  // Use the defined safe area, rather than fixed global constants
  const startX = pageArea.x;
  const MAX_Y = pageArea.y + pageArea.h;

  let currentVirtualY = pageArea.y - (BASE_FONT_SIZE * 0.2);
  let currentPage = 0;
  let totalPages = 1;

  paragraphsState.forEach((para) => {
    const paraFontSize = HEADING_SIZE_MAP[para.textSize] || HEADING_SIZE_MAP.p;
    const paraLineSpacing = paraFontSize * 1.4;

    para.layout = { lines: [], boundingBoxesByPage: {} };
    ctx.font = `${paraFontSize}px ${fontFamily}`;

    if ((!para.text || para.text.length === 0) && para.type === 'text') {
      currentVirtualY += paraLineSpacing;
      if (currentVirtualY > MAX_Y) {
        currentVirtualY = pageArea.y;
        currentPage++;
        totalPages = Math.max(totalPages, currentPage + 1);
      }
      return;
    }

    const prefix = buildListPrefix(para);
    const fullText = prefix + (para.text || '');
    const segments = para.segments || [{ text: para.text, underline: false }];
    const lines = wordWrap(ctx, fullText, maxWidth);
    const hasUnderline = segments.some((s) => s.underline);

    let firstYOnPage = {};
    let lastYOnPage = {};

    lines.forEach((line, lineIndex) => {
      // Check if we need to pagination-break before placing this line
      if (currentVirtualY + paraLineSpacing > MAX_Y) {
        currentPage++;
        totalPages = Math.max(totalPages, currentPage + 1);
        currentVirtualY = pageArea.y; // reset to top of new page
      }

      const lineY = currentVirtualY;

      const wordsInLine = line.split(' ');
      const wordJittersX = wordsInLine.map(() => (Math.random() * 3) - 1.5);
      const wordJittersY = wordsInLine.map(() => (Math.random() * 2) - 1.0);

      para.layout.lines.push({
        text: line,
        lineIndex,
        isUnderlined: hasUnderline,
        rawLinesArray: lines,
        prefix,
        segments,
        pageIndex: currentPage,
        baseY: lineY,
        fontSize: paraFontSize,
        wordJittersX,
        wordJittersY
      });

      if (firstYOnPage[currentPage] === undefined) firstYOnPage[currentPage] = lineY;
      lastYOnPage[currentPage] = lineY;

      currentVirtualY += paraLineSpacing;
    });

    // Create a bounding box for each page this paragraph touches
    for (const pg of Object.keys(firstYOnPage)) {
      const pId = parseInt(pg, 10);
      para.layout.boundingBoxesByPage[pId] = {
        x: startX - 10,
        y: firstYOnPage[pId] - paraFontSize,
        w: maxWidth + 20,
        h: (lastYOnPage[pId] - firstYOnPage[pId]) + paraLineSpacing,
      };
    }

    // Sub-margin after a paragraph
    currentVirtualY += (paraFontSize * 0.2);
  });

  return totalPages;
}

/**
 * Fast-path rendering function that simply loops through pre-calculated layout state
 * and draws only the lines meant for the given targetPageIndex.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array}  paragraphsState
 * @param {string} fontFamily
 * @param {string} inkColor
 * @param {number} selectedIndex
 * @param {number} targetPageIndex
 * @param {object} pageArea
 */
export function drawCalculatedPage(ctx, paragraphsState, fontFamily, inkColor, selectedIndex, targetPageIndex, pageArea) {
  const startX = pageArea.x;

  paragraphsState.forEach((para, index) => {
    if (!para.layout) return;

    // Determine physics hitbox based on the current page rendering
    const box = para.layout.boundingBoxesByPage[targetPageIndex];
    if (box) {
      // Inject the live drag offset into the active hitbox tracking
      para.boundingBox = {
        x: box.x + para.offsetX,
        y: box.y + para.offsetY,
        w: box.w,
        h: box.h
      };

      if (index === selectedIndex) {
        drawSelectionHighlight(ctx, para.boundingBox);
      }
    } else {
      para.boundingBox = null; // Para does not exist on this page
    }

    // Filter lines belonging to this page
    const linesToDraw = para.layout.lines.filter(l => l.pageIndex === targetPageIndex);
    if (linesToDraw.length === 0) return;

    ctx.font = `${linesToDraw[0].fontSize}px ${fontFamily}`;
    ctx.fillStyle = para.color || inkColor;

    const paraStartX = startX + para.offsetX;

    // Draw the precalculated lines
    linesToDraw.forEach(lineCtx => {
      const lineY = lineCtx.baseY + para.offsetY;
      
      let currentX = paraStartX;
      const words = lineCtx.text.split(' ');
      
      words.forEach((word, idx) => {
        if (word === '' && idx === words.length - 1) return;
        
        const jitterX = lineCtx.wordJittersX ? lineCtx.wordJittersX[idx] : 0;
        const jitterY = lineCtx.wordJittersY ? lineCtx.wordJittersY[idx] : 0;
        
        ctx.fillText(word, currentX, lineY + jitterY);
        
        const wordWidth = ctx.measureText(word).width;
        const spaceWidth = ctx.measureText(' ').width;
        
        currentX += wordWidth + spaceWidth + jitterX;
      });

      if (lineCtx.isUnderlined) {
        drawUnderlineSpans(
          ctx, lineCtx.text, lineCtx.rawLinesArray, lineCtx.lineIndex, lineY,
          paraStartX, lineCtx.fontSize, lineCtx.prefix, para, lineCtx.segments, inkColor
        );
      }
    });
  });
}

// ─── Internal Helpers ───────────────────────────────────────────────

/**
 * Return the bullet/number prefix string for a paragraph.
 */
function buildListPrefix(para) {
  if (para.type === 'bullet') return '•  ';
  if (para.type === 'number') return `${para.num || 1}.  `;
  return '';
}

/**
 * Simple greedy word-wrap algorithm.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wordWrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    let word = words[i];

    if (ctx.measureText(currentLine + word + ' ').width > maxWidth) {
      if (currentLine !== '') {
        lines.push(currentLine);
        currentLine = '';
      }

      if (ctx.measureText(word + ' ').width > maxWidth) {
        let brokenWord = '';
        for (let j = 0; j < word.length; j++) {
          const char = word[j];
          if (ctx.measureText(brokenWord + char).width > maxWidth) {
            if (brokenWord !== '') {
              lines.push(brokenWord);
              brokenWord = char;
            } else {
              brokenWord = char;
            }
          } else {
            brokenWord += char;
          }
        }
        currentLine = brokenWord + ' ';
      } else {
        currentLine = word + ' ';
      }
    } else {
      currentLine += word + ' ';
    }
  }

  if (currentLine !== '') {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draw underline decoration spans for a single rendered line,
 * mapping character indices back to the original segment data.
 */
function drawUnderlineSpans(
  ctx, line, lines, lineIndex, lineY,
  paraStartX, paraFontSize, prefix, para, segments, inkColor
) {
  const rawText = para.text || '';

  // Build a set of underlined character indices
  const underlinedChars = new Set();
  let charIdx = 0;
  segments.forEach((seg) => {
    for (let c = 0; c < seg.text.length; c++) {
      if (seg.underline) underlinedChars.add(charIdx);
      charIdx++;
    }
  });

  // Determine where this line starts in the full text
  let lineStartInFull = 0;
  for (let l = 0; l < lineIndex; l++) lineStartInFull += lines[l].length;

  const prefixLen = prefix.length;
  let spanStart = -1;

  for (let ch = 0; ch <= line.length; ch++) {
    const rawIdx = lineStartInFull + ch - prefixLen;
    const isUnderlined =
      rawIdx >= 0 && rawIdx < rawText.length && underlinedChars.has(rawIdx);

    if (isUnderlined && spanStart === -1) {
      spanStart = ch;
    } else if (!isUnderlined && spanStart !== -1) {
      drawUnderlineSegment(ctx, line, spanStart, ch, paraStartX, lineY, paraFontSize, para.color || inkColor);
      spanStart = -1;
    }
  }

  // Close any trailing underline span
  if (spanStart !== -1) {
    drawUnderlineSegment(
      ctx, line, spanStart, line.trimEnd().length,
      paraStartX, lineY, paraFontSize, para.color || inkColor
    );
  }
}

/**
 * Draw a single underline segment beneath a portion of a text line.
 */
function drawUnderlineSegment(ctx, line, start, end, x, y, fontSize, color) {
  const x1 = x + ctx.measureText(line.substring(0, start)).width;
  const x2 = x + ctx.measureText(line.substring(0, end)).width;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, fontSize * 0.06);
  ctx.moveTo(x1, y + 3);
  ctx.lineTo(x2, y + 3);
  ctx.stroke();
}
