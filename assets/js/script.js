// DOM Elements
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('textInput');
const fontSelect = document.getElementById('fontSelect');
const headingSelect = document.getElementById('headingSelect');
const inkColorInput = document.getElementById('inkColor');
const paperTypeSelect = document.getElementById('paperType');
const downloadBtn = document.getElementById('downloadBtn');
const resetLayoutBtn = document.getElementById('resetLayoutBtn');
const generateBtn = document.getElementById('generateBtn');

// Sidebar elements
const paperGrid = document.getElementById('paperGrid');
const fontGrid = document.getElementById('fontGrid');

// Floating toolbar
const floatingToolbar = document.getElementById('floatingToolbar');
const floatingMove = document.getElementById('floatingMove');
const floatingColor = document.getElementById('floatingColor');
const floatingReset = document.getElementById('floatingReset');

// Editor toolbar buttons
const btnUnderline = document.getElementById('btnUnderline');
const btnBulletList = document.getElementById('btnBulletList');
const btnNumberList = document.getElementById('btnNumberList');

// Preload background images
const bg1Image = new Image();
bg1Image.src = 'assets/picture/Background 1.jpeg';

// State
let paragraphsState = [];
let selectedParaIndex = -1;
let isCanvasGenerated = false;

// Paper configuration
const PAPER_PADDING_LEFT = 80;
const PAPER_PADDING_RIGHT = 30;
const PAPER_PADDING_TOP = 80;

// ==========================================
// Editor Formatting Toolbar
// ==========================================

btnUnderline.addEventListener('click', () => {
    document.execCommand('underline', false, null);
    textInput.focus();
    updateToolbarState();
});

btnBulletList.addEventListener('click', () => {
    document.execCommand('insertUnorderedList', false, null);
    textInput.focus();
    updateToolbarState();
});

btnNumberList.addEventListener('click', () => {
    document.execCommand('insertOrderedList', false, null);
    textInput.focus();
    updateToolbarState();
});


headingSelect.addEventListener('change', () => {
    document.execCommand('formatBlock', false, headingSelect.value);
    textInput.focus();
    updateToolbarState();
});

// Update toolbar active states based on current selection
function updateToolbarState() {
    btnUnderline.classList.toggle('active', document.queryCommandState('underline'));
    btnBulletList.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
    btnNumberList.classList.toggle('active', document.queryCommandState('insertOrderedList'));
    
    // Update heading select
    let format = document.queryCommandValue('formatBlock') || 'p';
    // queryCommandValue might return 'h1', 'H1', 'p', etc.
    const validFormats = ['h1', 'h2', 'h3', 'p'];
    format = format.toLowerCase();
    
    if (validFormats.includes(format)) {
        headingSelect.value = format;
    } else {
        headingSelect.value = 'p';
    }
}

// Listen for selection changes to update toolbar
document.addEventListener('selectionchange', () => {
    if (textInput.contains(document.activeElement) || textInput === document.activeElement) {
        updateToolbarState();
    }
});

// Paste plain text only
textInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
});

// ==========================================
// Sidebar: Paper & Font Selection
// ==========================================

paperGrid.addEventListener('click', (e) => {
    const thumb = e.target.closest('.paper-thumb');
    if (!thumb) return;
    paperGrid.querySelectorAll('.paper-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    paperTypeSelect.value = thumb.dataset.paper;
    syncInputPageStyles();
});

fontGrid.addEventListener('click', (e) => {
    const thumb = e.target.closest('.font-thumb');
    if (!thumb) return;
    fontGrid.querySelectorAll('.font-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    fontSelect.value = thumb.dataset.font;
    syncInputPageStyles();
});



// ==========================================
// Canvas Drawing Functions
// ==========================================

function drawBlankCanvas() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d1d5db";
    ctx.font = '22px "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Click 'Convert to Handwriting'", canvas.width / 2, canvas.height / 2 - 14);
    ctx.fillText("to generate your note", canvas.width / 2, canvas.height / 2 + 14);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
}

function drawPaperBackground(lineSpacing) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const paperVal = paperTypeSelect.value;

    if (paperVal === 'bg1') {
        if (bg1Image.complete && bg1Image.naturalWidth > 0) {
            ctx.drawImage(bg1Image, 0, 0, canvas.width, canvas.height);
        }
    } else if (paperVal === 'ruled') {
        ctx.strokeStyle = "rgba(0, 150, 255, 0.2)";
        ctx.lineWidth = 1;
        for (let y = PAPER_PADDING_TOP; y < canvas.height; y += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PAPER_PADDING_LEFT - 10, 0);
        ctx.lineTo(PAPER_PADDING_LEFT - 10, canvas.height);
        ctx.stroke();
    } else if (paperVal === 'grid') {
        const gridSize = lineSpacing;
        ctx.strokeStyle = "rgba(0, 150, 255, 0.12)";
        ctx.lineWidth = 0.5;
        for (let y = PAPER_PADDING_TOP; y < canvas.height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        for (let x = PAPER_PADDING_LEFT; x < canvas.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
    }
}

// ==========================================
// Rich Text → Structured Paragraphs Parser
// ==========================================

function parseEditorContent() {
    // Parse the contenteditable HTML into structured paragraph objects
    const items = [];
    const childNodes = textInput.childNodes;

    function extractTextSegments(node) {
        // Returns array of { text, underline } segments
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
                // Underlined content
                node.childNodes.forEach(child => {
                    const childSegs = extractTextSegments(child);
                    childSegs.forEach(s => { s.underline = true; });
                    segments.push(...childSegs);
                });
            } else {
                node.childNodes.forEach(child => {
                    segments.push(...extractTextSegments(child));
                });
            }
        }
        return segments;
    }

    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                const lines = text.split('\n');
                lines.forEach((line, i) => {
                    if (line || i < lines.length - 1) {
                        items.push({ type: 'text', text: line, segments: [{ text: line, underline: false }] });
                    }
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();

            if (tag === 'br') {
                items.push({ type: 'text', text: '', segments: [] });
            } else if (tag === 'ul') {
                node.querySelectorAll(':scope > li').forEach(li => {
                    const segs = extractTextSegments(li);
                    const text = segs.map(s => s.text).join('');
                    items.push({ type: 'bullet', text, segments: segs });
                });
            } else if (tag === 'ol') {
                let num = 1;
                node.querySelectorAll(':scope > li').forEach(li => {
                    const segs = extractTextSegments(li);
                    const text = segs.map(s => s.text).join('');
                    items.push({ type: 'number', num, text, segments: segs });
                    num++;
                });
            } else if (['h1', 'h2', 'h3', 'div', 'p', 'span', 'u'].includes(tag)) {
                // Inline elements — extract segments preserving underline
                const segs = extractTextSegments(node);
                const text = segs.map(s => s.text).join('');
                const textSize = ['h1', 'h2', 'h3'].includes(tag) ? tag : 'p';
                // Split on newlines
                const lines = text.split('\n');
                if (lines.length > 1) {
                    lines.forEach(line => {
                        items.push({ type: 'text', textSize, text: line, segments: [{ text: line, underline: tag === 'u' }] });
                    });
                } else {
                    if (['h1', 'h2', 'h3', 'div', 'p'].includes(tag)) {
                        items.push({ type: 'text', textSize, text, segments: segs });
                    } else {
                        // Inline: merge into last item or create new
                        if (items.length > 0 && items[items.length - 1].type === 'text') {
                            items[items.length - 1].text += text;
                            items[items.length - 1].segments.push(...segs);
                        } else {
                            items.push({ type: 'text', textSize, text, segments: segs });
                        }
                    }
                }
            } else {
                // Other block elements — recurse
                node.childNodes.forEach(child => processNode(child));
            }
        }
    }

    childNodes.forEach(child => processNode(child));
    return items;
}

// ==========================================
// Canvas Rendering: Draw Paragraphs with Rich Format
// ==========================================

function processAndDrawParagraphs(maxWidth, globalLineSpacing, globalFontSize) {
    const fontFamily = `"${fontSelect.value}", cursive`;
    let currentBaseY = PAPER_PADDING_TOP - (globalFontSize * 0.2);
    const startX = PAPER_PADDING_LEFT + 10;
    
    // Base sizes for headings
    const sizeMap = { h1: 48, h2: 36, h3: 28, p: 24 };

    paragraphsState.forEach((para, index) => {
        const baseSize = sizeMap[para.textSize] || sizeMap['p'];
        const paraFontSize = baseSize;
        const paraLineSpacing = paraFontSize * 1.4;


        // Text / bullet / number items
        if ((!para.text || para.text.length === 0) && para.type === 'text') {
            currentBaseY += paraLineSpacing;
            para.boundingBox = null;
            return;
        }

        // Build display text with prefix
        let prefix = '';
        if (para.type === 'bullet') prefix = '•  ';
        else if (para.type === 'number') prefix = `${para.num || 1}.  `;

        const fullText = prefix + (para.text || '');
        const segments = para.segments || [{ text: para.text, underline: false }];

        ctx.font = `${paraFontSize}px ${fontFamily}`;

        // Word-wrap the full text
        const words = fullText.split(' ');
        let currentLine = '';
        let lines = [];

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);

        const paraStartX = startX + para.offsetX;
        const paraStartY = currentBaseY + para.offsetY;
        const height = lines.length * paraLineSpacing;

        // Draw text lines
        ctx.fillStyle = para.color || inkColorInput.value;

        // Check whether any segment is underlined
        const hasUnderline = segments.some(s => s.underline);

        lines.forEach((line, i) => {
            const lineY = paraStartY + (i * paraLineSpacing);
            ctx.fillText(line, paraStartX, lineY);

            // Draw underline if applicable
            if (hasUnderline) {
                // Simple approach: underline lines that contain underlined text
                const lineWidth = ctx.measureText(line).width;

                // Find underlined portions. For simplicity, if the paragraph's raw text
                // has underline segments, underline the rendered lines proportionally.
                const rawText = para.text || '';
                const underlinedChars = new Set();
                let charIdx = 0;
                segments.forEach(seg => {
                    for (let c = 0; c < seg.text.length; c++) {
                        if (seg.underline) underlinedChars.add(charIdx);
                        charIdx++;
                    }
                });

                // Determine which characters of this line are underlined
                // Map line back to fullText chars
                let lineStartInFull = 0;
                for (let l = 0; l < i; l++) lineStartInFull += lines[l].length;
                const lineText = line;
                const prefixLen = prefix.length;

                // Draw underline spans
                let spanStart = -1;
                for (let ch = 0; ch <= lineText.length; ch++) {
                    const fullIdx = lineStartInFull + ch;
                    const rawIdx = fullIdx - prefixLen;
                    const isUL = rawIdx >= 0 && rawIdx < rawText.length && underlinedChars.has(rawIdx);

                    if (isUL && spanStart === -1) {
                        spanStart = ch;
                    } else if (!isUL && spanStart !== -1) {
                        // Draw underline for this span
                        const spanText = lineText.substring(0, spanStart);
                        const spanEndText = lineText.substring(0, ch);
                        const x1 = paraStartX + ctx.measureText(spanText).width;
                        const x2 = paraStartX + ctx.measureText(spanEndText).width;
                        ctx.beginPath();
                        ctx.strokeStyle = para.color || inkColorInput.value;
                        ctx.lineWidth = Math.max(1, paraFontSize * 0.06);
                        ctx.moveTo(x1, lineY + 3);
                        ctx.lineTo(x2, lineY + 3);
                        ctx.stroke();
                        spanStart = -1;
                    }
                }
                // Close final span
                if (spanStart !== -1) {
                    const spanText = lineText.substring(0, spanStart);
                    const x1 = paraStartX + ctx.measureText(spanText).width;
                    const x2 = paraStartX + ctx.measureText(lineText.trimEnd()).width;
                    ctx.beginPath();
                    ctx.strokeStyle = para.color || inkColorInput.value;
                    ctx.lineWidth = Math.max(1, paraFontSize * 0.06);
                    ctx.moveTo(x1, lineY + 3);
                    ctx.lineTo(x2, lineY + 3);
                    ctx.stroke();
                }
            }
        });

        para.boundingBox = {
            x: startX - 10,
            y: paraStartY - paraFontSize,
            w: maxWidth + 20,
            h: height + (paraFontSize * 0.2)
        };

        if (index === selectedParaIndex) {
            drawSelectionHighlight(para.boundingBox);
        }

        currentBaseY += height;
    });
}

function drawSelectionHighlight(box) {
    ctx.save();
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
}

// ==========================================
// Input Page Styling
// ==========================================

function syncInputPageStyles() {
    const fontSize = 24; // base paragraph size
    const fontFamily = `"${fontSelect.value}", cursive`;
    const FIXED_LINE_SPACING = 36;

    textInput.style.fontSize = `${fontSize}px`;
    textInput.style.fontFamily = fontFamily;
    textInput.style.lineHeight = `${FIXED_LINE_SPACING}px`;
    textInput.style.color = inkColorInput.value;
}

// ==========================================
// Render & Generate
// ==========================================

function renderCanvas() {
    if (!isCanvasGenerated) return;

    // We use a base size for spacing scale calculations.
    const baseFontSize = 24;
    const baseLineSpacing = baseFontSize * 1.4;
    const fontFamily = `"${fontSelect.value}", cursive`;

    drawPaperBackground(baseLineSpacing);
    ctx.font = `${baseFontSize}px ${fontFamily}`;
    ctx.fillStyle = inkColorInput.value;
    ctx.textBaseline = "alphabetic";

    const maxTextWidth = canvas.width - PAPER_PADDING_LEFT - PAPER_PADDING_RIGHT;
    processAndDrawParagraphs(maxTextWidth, baseLineSpacing, baseFontSize);
    positionFloatingToolbar();
}

function syncTextState() {
    const parsedItems = parseEditorContent();

    paragraphsState = parsedItems.map((item, index) => {
        const existing = paragraphsState[index];
        if (existing) {
            return {
                ...existing,
                text: item.text || '',
                type: item.type,
                textSize: item.textSize || 'p',
                segments: item.segments || [],
                tableData: item.tableData || null,
                num: item.num || null
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
            color: inkColorInput.value
        };
    });

    if (selectedParaIndex >= paragraphsState.length) {
        selectedParaIndex = -1;
        updateSelectionUI();
    }
}

function generateCanvas() {
    isCanvasGenerated = true;
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    resetLayoutBtn.classList.remove('hidden');
    syncTextState();
    renderCanvas();
}

// ==========================================
// Event Listeners
// ==========================================

inkColorInput.addEventListener('input', () => {
    syncInputPageStyles();
    paragraphsState.forEach(para => { para.color = inkColorInput.value; });
    if (selectedParaIndex !== -1 && paragraphsState[selectedParaIndex]) {
        floatingColor.value = inkColorInput.value;
    }
});

generateBtn.addEventListener('click', generateCanvas);

floatingColor.addEventListener('input', (e) => {
    if (selectedParaIndex !== -1 && paragraphsState[selectedParaIndex]) {
        paragraphsState[selectedParaIndex].color = e.target.value;
        if (isCanvasGenerated) renderCanvas();
    }
});

floatingReset.addEventListener('click', () => {
    if (selectedParaIndex !== -1 && paragraphsState[selectedParaIndex]) {
        paragraphsState[selectedParaIndex].offsetX = 0;
        paragraphsState[selectedParaIndex].offsetY = 0;
        if (isCanvasGenerated) {
            renderCanvas();
        }
    }
});

resetLayoutBtn.addEventListener('click', () => {
    paragraphsState.forEach(para => { para.offsetX = 0; para.offsetY = 0; });
    if (isCanvasGenerated) renderCanvas();
});

downloadBtn.addEventListener('click', () => {
    if (!isCanvasGenerated) return;
    const link = document.createElement('a');
    link.download = `handwritten-note-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// ==========================================
// Drag and Drop on Canvas
// ==========================================
let isDragging = false;
let activeParaIndex = -1;
let dragStartX = 0, dragStartY = 0;
let initialOffsetX = 0, initialOffsetY = 0;

function positionFloatingToolbar() {
    if (selectedParaIndex === -1 || !paragraphsState[selectedParaIndex]) {
        floatingToolbar.classList.add('hidden'); return;
    }
    const box = paragraphsState[selectedParaIndex].boundingBox;
    if (!box) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const screenX = rect.left + window.scrollX + (box.x * scaleX);
    const screenY = rect.top + window.scrollY + (box.y * scaleY);
    const boxScreenWidth = box.w * scaleX;
    const toolbarLeft = screenX + (boxScreenWidth / 2) - (floatingToolbar.offsetWidth / 2);
    let toolbarTop = screenY - 55;
    if (box.y * scaleY < 50) toolbarTop = screenY + (box.h * scaleY) + 15;
    floatingToolbar.style.left = `${toolbarLeft}px`;
    floatingToolbar.style.top = `${toolbarTop}px`;
}

function updateSelectionUI() {
    if (selectedParaIndex !== -1 && paragraphsState[selectedParaIndex]) {
        floatingToolbar.classList.remove('hidden');
        floatingColor.value = paragraphsState[selectedParaIndex].color || inkColorInput.value;
        positionFloatingToolbar();
    } else {
        floatingToolbar.classList.add('hidden');
    }
    if (isCanvasGenerated) renderCanvas();
}

window.addEventListener('resize', positionFloatingToolbar);
window.addEventListener('scroll', positionFloatingToolbar);

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function handleCanvasPointerDown(e) {
    if (!isCanvasGenerated) return;
    const pos = getCanvasCoordinates(e);
    let clickedParaIndex = -1;
    for (let i = paragraphsState.length - 1; i >= 0; i--) {
        const box = paragraphsState[i].boundingBox;
        if (box && pos.x >= box.x && pos.x <= box.x + box.w && pos.y >= box.y && pos.y <= box.y + box.h) {
            clickedParaIndex = i; break;
        }
    }
    if (selectedParaIndex !== clickedParaIndex) { 
        selectedParaIndex = clickedParaIndex; 
        updateSelectionUI(); 
    }
}

floatingMove.addEventListener('mousedown', (e) => {
    if (selectedParaIndex !== -1 && isCanvasGenerated) {
        e.preventDefault();
        isDragging = true;
        activeParaIndex = selectedParaIndex;
        document.body.style.cursor = 'grabbing';
        dragStartX = e.clientX; 
        dragStartY = e.clientY;
        initialOffsetX = paragraphsState[activeParaIndex].offsetX;
        initialOffsetY = paragraphsState[activeParaIndex].offsetY;
    }
});

floatingMove.addEventListener('touchstart', (e) => {
    if (selectedParaIndex !== -1 && isCanvasGenerated) {
        e.preventDefault();
        isDragging = true;
        activeParaIndex = selectedParaIndex;
        dragStartX = e.touches[0].clientX; 
        dragStartY = e.touches[0].clientY;
        initialOffsetX = paragraphsState[activeParaIndex].offsetX;
        initialOffsetY = paragraphsState[activeParaIndex].offsetY;
    }
}, { passive: false });

function drag(e) {
    if (!isDragging || activeParaIndex === -1) return;
    if (e.type === 'touchmove') e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    paragraphsState[activeParaIndex].offsetX = initialOffsetX + (dx * scaleX);
    paragraphsState[activeParaIndex].offsetY = initialOffsetY + (dy * scaleY);
    renderCanvas();
}

function stopDrag() { 
    isDragging = false; 
    activeParaIndex = -1; 
    document.body.style.cursor = 'default'; 
}

canvas.addEventListener('mousedown', handleCanvasPointerDown);
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging && isCanvasGenerated) {
        const pos = getCanvasCoordinates(e);
        let hovered = false;
        for (let i = paragraphsState.length - 1; i >= 0; i--) {
            const box = paragraphsState[i].boundingBox;
            if (box && pos.x >= box.x && pos.x <= box.x + box.w && pos.y >= box.y && pos.y <= box.y + box.h) { hovered = true; break; }
        }
        canvas.style.cursor = hovered ? 'pointer' : 'default';
    }
});
window.addEventListener('mousemove', (e) => { if (isDragging) drag(e); }, { passive: false });
window.addEventListener('mouseup', stopDrag);
canvas.addEventListener('touchstart', handleCanvasPointerDown, { passive: false });
window.addEventListener('touchmove', (e) => { if (isDragging) drag(e); }, { passive: false });
window.addEventListener('touchend', stopDrag);

// Init
document.fonts.ready.then(() => { syncInputPageStyles(); });
syncInputPageStyles();
drawBlankCanvas();
