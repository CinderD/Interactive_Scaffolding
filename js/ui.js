// ==========================================
// UI RENDERING & INTERACTION
// ==========================================

const chatContainer = document.getElementById('chat-container');
const questionsList = document.getElementById('questions-list');

/**
 * Render bot response with scaffolding badges
 * @param {Object} llmResponse - Response from LLM API
 */
function renderBotResponse(llmResponse) {
    const msgDiv = document.createElement('div');
    msgDiv.className = "flex gap-4 slide-in mb-6";
    
    const iconDiv = document.createElement('div');
    iconDiv.className = "w-10 h-10 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-md text-white";
    iconDiv.innerHTML = `<i data-lucide="bot" class="w-6 h-6"></i>`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = "bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm max-w-[85%] text-sm text-slate-700";
    
    // Intentionally do NOT display scaffolding means/intent badges in the UI.
    
    // Render text as Markdown (LLM response is markdown).
    // We also support <MASK>...</MASK> tags, which are converted into scratch-off spans.
    const textDiv = document.createElement('div');
    const responseText = llmResponse.responseText || llmResponse.text || '';

    // Configure marked (if present)
    if (window.marked && !window.__markedConfigured) {
        try {
            window.marked.setOptions({
                gfm: true,
                breaks: true,
                headerIds: false,
                mangle: false,
            });
            window.__markedConfigured = true;
        } catch {
            // ignore
        }
    }

    function escapeAttr(s) {
        return String(s)
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    function renderMarkdown(md) {
        if (window.marked && typeof window.marked.parse === 'function') {
            return window.marked.parse(md);
        }
        // Fallback: preserve line breaks (best-effort)
        return String(md)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replace(/\n/g, '<br>');
    }

    function renderMaskedMarkdown(md, interactive) {
        if (!interactive) {
            // In non-interactive mode, simply remove masking and render normally.
            return renderMarkdown(String(md).replace(/<MASK>([\s\S]*?)<\/MASK>/g, '$1'));
        }

        // Replace each <MASK>...</MASK> block with a unique placeholder token,
        // render the whole response as Markdown, then swap placeholders with scratch spans.
        const maskedSegments = [];
        const placeholder = (i) => `@@MASK_SENTENCE_${i}@@`;

        const withPlaceholders = String(md).replace(/<MASK>([\s\S]*?)<\/MASK>/g, (_m, inner) => {
            const idx = maskedSegments.length;
            maskedSegments.push(String(inner));
            return placeholder(idx);
        });

        let html = renderMarkdown(withPlaceholders);

        // Swap placeholders with scratch-wrapper spans; keep formatting inside masked segment.
        for (let i = 0; i < maskedSegments.length; i++) {
            const token = placeholder(i);
            const innerMd = maskedSegments[i];

            let innerHtml = innerMd;
            if (window.marked && typeof window.marked.parseInline === 'function') {
                innerHtml = window.marked.parseInline(innerMd);
            } else {
                innerHtml = renderMarkdown(innerMd);
            }

            // data-word should be plain text for prediction mode.
            const tmp = document.createElement('div');
            tmp.innerHTML = innerHtml;
            const dataWord = tmp.textContent || '';

            const span =
                `<span class="scratch-wrapper scaffold-blur" data-word="${escapeAttr(dataWord)}">` +
                `<span class="scratch-text">${innerHtml}</span>` +
                `</span>`;

            html = html.split(token).join(span);
        }

        return html;
    }

    textDiv.innerHTML = renderMaskedMarkdown(responseText, state.isInteractive);
    contentDiv.appendChild(textDiv);

    // Assign mask ids for scratch logging and correlate with the turn.
    const turnIndex = llmResponse?.__turnIndex ?? null;
    const blurEls = textDiv.querySelectorAll('.scaffold-blur');
    blurEls.forEach((el) => {
        if (!el.dataset.maskId) {
            try {
                el.dataset.maskId = crypto?.randomUUID ? crypto.randomUUID() : `mask_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            } catch {
                el.dataset.maskId = `mask_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            }
        }
        if (turnIndex !== null) {
            el.dataset.turnIndex = String(turnIndex);
        }
    });
    
    // Attach click handlers to blur elements (interactive mode only).
    if (state.isInteractive) {
        const blurElements = textDiv.querySelectorAll('.scaffold-blur');
        blurElements.forEach(el => {
            const word = el.getAttribute('data-word');
            setupScratchOff(el, word);
        });
    }

    msgDiv.appendChild(iconDiv);
    msgDiv.appendChild(contentDiv);
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    safeCreateIcons();
    if (window.MathJax) MathJax.typesetPromise();
}

/**
 * Add a message to the chat
 * @param {string} role - 'user' or 'bot'
 * @param {string} text - Message text
 */
function addMessage(role, text) { 
    const div = document.createElement('div');
    div.className = `flex gap-4 slide-in mb-6 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    div.innerHTML = `
        <div class="w-10 h-10 ${role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'} rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-md text-white">
            <i data-lucide="${role === 'user' ? 'user' : 'bot'}" class="w-6 h-6"></i>
        </div>
        <div class="${role === 'user' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700'} p-4 rounded-2xl ${role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'} border border-slate-200 shadow-sm max-w-[80%] text-sm">
            ${text}
        </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    safeCreateIcons();
}

/**
 * Show loading indicator
 * @returns {string} Loading element ID
 */
function addLoading() {
    const id = "loading-" + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = "flex gap-4 slide-in mb-6";
    div.innerHTML = `
        <div class="w-10 h-10 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-md text-white">
            <i data-lucide="bot" class="w-6 h-6"></i>
        </div>
        <div class="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2 h-12">
            <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    safeCreateIcons();
    return id;
}

/**
 * Remove loading indicator
 * @param {string} id - Loading element ID
 */
function removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

/**
 * Update progress bar
 */
function updateProgress() {
    const turns = state.turnCounter || 0;
    document.getElementById('turn-display').textContent = `Turns: ${turns}`;
}

/**
 * Initialize question buttons
 */
function initializeQuestions() {
    questionsList.innerHTML = '';
    const questions = getPresetQuestions();
    questions.forEach((q, idx) => {
        const btn = document.createElement('button');
        btn.className = "question-btn w-full text-left bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-3 rounded-lg border border-indigo-200 text-sm font-medium";
        btn.textContent = `${idx + 1}. ${q.text}`;
        btn.id = `q-${q.id}`;
        btn.onclick = () => handleQuestionClick(q);
        questionsList.appendChild(btn);
    });
}

