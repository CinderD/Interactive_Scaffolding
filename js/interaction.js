// ==========================================
// USER INTERACTION HANDLERS
// ==========================================

/**
 * Handle preset question click
 * @param {Object} question - Question object
 */
async function handleQuestionClick(question) {
    if (state.usedQuestions.has(question.id)) return;
    
    state.usedQuestions.add(question.id);
    state.currentQuestionIndex++;
    
    // Mark button as used
    const btn = document.getElementById(`q-${question.id}`);
    if (btn) {
        btn.classList.add('used');
        btn.disabled = true;
    }
    
    // Add user message
    addMessage('user', question.text);

    const turnIndex = (state.turnCounter = (state.turnCounter || 0) + 1);
    
    // Show loading
    const loadingId = addLoading();
    
    try {
        // Fetch real LLM response
        const llmResponse = await fetchLLMResponse(question.text);
        llmResponse.__turnIndex = turnIndex;
        removeLoading(loadingId);
        
        // Render the response
        renderBotResponse(llmResponse);
        updateProgress();

        // Log dialogue turn (best-effort)
        logTurn({
            sessionId: state.sessionId,
            turnIndex,
            userText: question.text,
            llmResponse,
        });
        
    } catch (error) {
        removeLoading(loadingId);
        addMessage('bot', `Error: ${error.message}. Please try again.`);

        logTurn({
            sessionId: state.sessionId,
            turnIndex,
            userText: question.text,
            llmResponse: { error: String(error?.message || error) },
        });
    }
}

/**
 * Handle free-form user questions
 * @param {string} questionText - User's question
 */
async function handleUserQuestion(questionText) {
    if (!questionText.trim()) return;
    
    // Add user message
    addMessage('user', questionText);

    const turnIndex = (state.turnCounter = (state.turnCounter || 0) + 1);
    
    // Show loading
    const loadingId = addLoading();
    
    try {
        // Fetch real LLM response
        const llmResponse = await fetchLLMResponse(questionText);
        llmResponse.__turnIndex = turnIndex;
        removeLoading(loadingId);
        
        // Render the response
        renderBotResponse(llmResponse);
        updateProgress();

        // Log dialogue turn (best-effort)
        logTurn({
            sessionId: state.sessionId,
            turnIndex,
            userText: questionText,
            llmResponse,
        });
    } catch (error) {
        removeLoading(loadingId);
        addMessage('bot', `Error: ${error.message}. Please try again.`);

        logTurn({
            sessionId: state.sessionId,
            turnIndex,
            userText: questionText,
            llmResponse: { error: String(error?.message || error) },
        });
    }
}

/**
 * Handle blur element click (scaffolding interaction)
 * @param {HTMLElement} el - The blur element
 * @param {string} word - The hidden word
 */
function handleBlurClick(el, word) {
    if (el.classList.contains('scaffold-revealed')) return;
    
    const responsibility = document.getElementById('responsibility-slider')?.value || CONFIG.DEFAULT_RESPONSIBILITY;
    const isHighResp = parseInt(responsibility) > CONFIG.RESPONSIBILITY_THRESHOLD;
    
    if (isHighResp) {
        openPredictionPopover(el, word);
    } else {
        el.classList.remove('scaffold-blur');
        el.classList.add('scaffold-revealed');
    }
}

// ==========================================
// SCRATCH-OFF ("刮刮乐") INTERACTION
// ==========================================

function revealMaskedElement(el) {
    const existingCanvas = el.querySelector(':scope > canvas.scaffold-scratch-canvas, :scope > canvas.scratch-canvas');
    if (existingCanvas) {
        existingCanvas.style.opacity = '0';
        // Let CSS transition play, then remove.
        setTimeout(() => {
            existingCanvas.remove();
        }, 520);
    }
    el.classList.remove('scaffold-blur');
    el.classList.remove('scratch-wrapper');
    el.classList.add('scaffold-revealed');
    el.onclick = null;
}

function setupScratchOff(el, word) {
    if (!el || el.dataset.scratchInit === '1') return;
    el.dataset.scratchInit = '1';

    // If already revealed (e.g., re-render), do nothing.
    if (el.classList.contains('scaffold-revealed')) return;

    // High responsibility mode keeps the prediction gate (no scratch bypass).
    const responsibility = document.getElementById('responsibility-slider')?.value || CONFIG.DEFAULT_RESPONSIBILITY;
    const isHighResp = parseInt(responsibility) > CONFIG.RESPONSIBILITY_THRESHOLD;
    if (isHighResp) {
        el.onclick = () => handleBlurClick(el, word);
        return;
    }

    // Create scratch canvas overlay.
    const canvas = document.createElement('canvas');
    canvas.className = 'scratch-canvas scaffold-scratch-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    // Ensure the span has a stable box.
    if (!el.style.minHeight) {
        el.style.minHeight = '1em';
    }

    el.appendChild(canvas);

    const dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;
    let brushSize = 12;

    const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
    if (!ctx) {
        // Fallback: click-to-reveal
        el.onclick = () => handleBlurClick(el, word);
        return;
    }

    function paintCoverLayer() {
        // Cover layer: reuse the previous blur background color.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, width, height);

        // Texture to feel more like a scratch card (kept subtle, but visible).
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        for (let i = 0; i < 32; i++) {
            const x = (i * 29) % Math.max(1, width);
            const y = (i * 41) % Math.max(1, height);
            ctx.fillRect(x, y, 14, 7);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let y = -height; y < height * 2; y += 6) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y + width);
            ctx.stroke();
        }
    }

    function resizeCanvasIfNeeded() {
        const canvasRect = canvas.getBoundingClientRect();
        const hostRect = el.getBoundingClientRect();
        const nextW = Math.max(1, Math.ceil(canvasRect.width || hostRect.width));
        const nextH = Math.max(1, Math.ceil(canvasRect.height || hostRect.height));
        if (nextW === width && nextH === height && canvas.width && canvas.height) return;

        width = nextW;
        height = nextH;
        canvas.width = Math.ceil(width * dpr);
        canvas.height = Math.ceil(height * dpr);

        // Brush size: smaller feels more like a real "paintbrush" wipe (visible strokes).
        // Tune primarily by height so short words don't get fully cleared instantly.
        brushSize = Math.max(8, Math.min(22, Math.round(height * 0.85)));

        paintCoverLayer();
    }

    // Layout can report 0x0 if measured too early; wait a frame.
    requestAnimationFrame(() => {
        resizeCanvasIfNeeded();
    });

    let isScratching = false;
    let lastPoint = null;
    let didMove = false;

    // Trajectory logging
    let strokePoints = [];
    let strokeStartTs = 0;
    let lastLoggedPoint = null;
    const maskId = el.dataset.maskId || null;
    const turnIndex = el.dataset.turnIndex ? parseInt(el.dataset.turnIndex, 10) : null;

    function scratchStroke(x0, y0, x1, y1) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        // Brush-like wipe: robust base stroke + soft-edge wipe for realism.
        // In destination-out, source alpha determines how much we erase.
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = Math.max(3, brushSize * 0.85);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        const dx = x1 - x0;
        const dy = y1 - y0;
        const dist = Math.hypot(dx, dy);
        const radius = brushSize / 2;
        // Dense sampling yields a continuous "brush" trail.
        const spacing = Math.max(1.5, radius * 0.16);
        const steps = Math.max(1, Math.floor(dist / spacing));

        for (let k = 0; k < 2; k++) {
            const jScale = 0.9 + k * 0.5;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = x0 + dx * t + (Math.random() - 0.5) * jScale;
                const y = y0 + dy * t + (Math.random() - 0.5) * jScale;

                const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
                // Strong center, feathered edge for a "brush" look.
                g.addColorStop(0.0, 'rgba(0,0,0,1.00)');
                g.addColorStop(0.28, 'rgba(0,0,0,0.85)');
                g.addColorStop(0.70, 'rgba(0,0,0,0.18)');
                g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();

                // Micro "bristles": a few tiny, offset wipes near the edge.
                if (i % 3 === 0) {
                    const bristleCount = 2;
                    for (let b = 0; b < bristleCount; b++) {
                        const ang = Math.random() * Math.PI * 2;
                        const rr = radius * (0.55 + Math.random() * 0.35);
                        const bx = x + Math.cos(ang) * rr;
                        const by = y + Math.sin(ang) * rr;
                        const br = Math.max(1.2, radius * 0.18);
                        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
                        bg.addColorStop(0.0, 'rgba(0,0,0,0.55)');
                        bg.addColorStop(1.0, 'rgba(0,0,0,0.0)');
                        ctx.fillStyle = bg;
                        ctx.beginPath();
                        ctx.arc(bx, by, br, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        ctx.restore();
    }

    function clientToLocal(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        return {
            x: clientX - r.left,
            y: clientY - r.top,
        };
    }

    function clearedRatio() {
        // Coarse sampling of alpha channel (faster + stable).
        // Ensure canvas is sized before sampling.
        resizeCanvasIfNeeded();
        // IMPORTANT: canvas is sized in device pixels (canvas.width/height),
        // so sampling must use device pixels too. Using CSS pixels here can
        // under-sample on high-DPR screens and make the reveal threshold feel inconsistent.
        const w = canvas.width;
        const h = canvas.height;
        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        let cleared = 0;
        let total = 0;
        const step = Math.max(6, Math.round(8 * (window.devicePixelRatio || 1))); // device pixels
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const idx = (y * w + x) * 4 + 3;
                total++;
                if (data[idx] === 0) cleared++;
            }
        }
        return total ? cleared / total : 0;
    }

    function maybeReveal() {
        try {
            const ratio = clearedRatio();
            // Require substantial area removal before auto-reveal.
            if (ratio >= 0.75) {
                revealMaskedElement(el);
            }
        } catch {
            // If sampling fails for any reason, do nothing.
        }
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (el.classList.contains('scaffold-revealed')) return;
        isScratching = true;
        didMove = false;

        strokePoints = [];
        strokeStartTs = performance.now();
        lastLoggedPoint = null;

        canvas.setPointerCapture?.(e.pointerId);
        const p = clientToLocal(e.clientX, e.clientY);
        lastPoint = p;

        const t = performance.now() - strokeStartTs;
        strokePoints.push({ x: p.x, y: p.y, t });
        lastLoggedPoint = { x: p.x, y: p.y, t };

        e.preventDefault();
        e.stopPropagation();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isScratching) return;
        const p = clientToLocal(e.clientX, e.clientY);
        if (lastPoint) {
            scratchStroke(lastPoint.x, lastPoint.y, p.x, p.y);
        }
        lastPoint = p;
        didMove = true;

        // Down-sample points: log if moved enough or enough time passed.
        const t = performance.now() - strokeStartTs;
        if (!lastLoggedPoint) {
            strokePoints.push({ x: p.x, y: p.y, t });
            lastLoggedPoint = { x: p.x, y: p.y, t };
        } else {
            const dx = p.x - lastLoggedPoint.x;
            const dy = p.y - lastLoggedPoint.y;
            const dist = Math.hypot(dx, dy);
            if (dist >= 2 || t - lastLoggedPoint.t >= 16) {
                strokePoints.push({ x: p.x, y: p.y, t });
                lastLoggedPoint = { x: p.x, y: p.y, t };
            }
        }

        e.preventDefault();
        e.stopPropagation();
    });

    function endScratch(e) {
        if (!isScratching) return;
        isScratching = false;
        lastPoint = null;
        if (didMove) {
            maybeReveal();

            // Log the trajectory for this scratch interaction (best-effort)
            logScratch({
                sessionId: state.sessionId,
                turnIndex,
                maskId,
                maskedText: word,
                points: strokePoints,
                meta: {
                    clearedRatio: (() => {
                        try { return clearedRatio(); } catch { return null; }
                    })(),
                },
            });
        }
        e?.preventDefault?.();
        e?.stopPropagation?.();
    }

    canvas.addEventListener('pointerup', endScratch);
    canvas.addEventListener('pointercancel', endScratch);
    canvas.addEventListener('pointerleave', endScratch);
}

/**
 * Open prediction popover for high responsibility mode
 * @param {HTMLElement} el - The blur element
 * @param {string} word - The hidden word
 */
function openPredictionPopover(el, word) {
    currentBlurEl = el;
    currentHiddenWord = word;
    const popover = document.getElementById('prediction-popover');
    popover.classList.remove('hidden');
    const rect = el.getBoundingClientRect();
    popover.style.top = (rect.bottom + 10) + 'px';
    popover.style.left = Math.max(20, rect.left - 100) + 'px';
    document.getElementById('pred-input').value = '';
    document.getElementById('pred-input').focus();
}

/**
 * Close prediction popover
 */
function closePopover() {
    document.getElementById('prediction-popover').classList.add('hidden');
}

// Setup prediction popover submit handler
document.addEventListener('DOMContentLoaded', () => {
    const predSubmit = document.getElementById('pred-submit');
    if (predSubmit) {
        predSubmit.addEventListener('click', () => {
            const val = document.getElementById('pred-input').value.toLowerCase().trim();
            const wordLower = currentHiddenWord.toLowerCase();
                
            // Accept if input contains the word or is close enough
            if (wordLower.includes(val) || val.length > 2 && wordLower.includes(val.substring(0, 3))) {
                currentBlurEl.classList.remove('scaffold-blur');
                currentBlurEl.classList.add('scaffold-revealed');
                closePopover();
            } else {
                document.getElementById('pred-input').classList.add('shake');
                setTimeout(() => {
                    document.getElementById('pred-input').classList.remove('shake');
                }, 500);
            }
        });
    }
});

