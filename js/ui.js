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
    
    // Add scaffolding type badge (only if scaffolding is used)
    if (llmResponse.usesScaffolding && llmResponse.scaffoldType) {
        const scaffoldTypeNames = {
            'hinting': 'Hinting',
            'explaining': 'Explaining',
            'instructing': 'Instructing',
            'modeling': 'Modeling'
        };
        
        const intentNames = {
            'cognitive': 'Cognitive',
            'metacognitive': 'Metacognitive',
            'affect': 'Affect'
        };
        
        const badge = document.createElement('div');
        badge.className = "inline-block mb-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mr-2";
        const badgeColors = {
            'hinting': 'bg-blue-100 text-blue-700',
            'explaining': 'bg-purple-100 text-purple-700',
            'instructing': 'bg-green-100 text-green-700',
            'modeling': 'bg-amber-100 text-amber-700'
        };
        badge.className += ' ' + (badgeColors[llmResponse.scaffoldType] || 'bg-slate-100 text-slate-700');
        badge.textContent = scaffoldTypeNames[llmResponse.scaffoldType] || llmResponse.scaffoldType;
        contentDiv.appendChild(badge);
        
        // Add intent badge if available
        if (llmResponse.scaffoldIntent) {
            const intentBadge = document.createElement('div');
            intentBadge.className = "inline-block mb-2 px-2 py-1 rounded text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200";
            const intentDisplayName = intentNames[llmResponse.scaffoldIntent] || llmResponse.scaffoldIntent;
            intentBadge.textContent = `Intent: ${intentDisplayName}`;
            contentDiv.appendChild(intentBadge);
        }
    }
    
    // Render text with blur elements
    const textDiv = document.createElement('div');
    const responseText = llmResponse.responseText || llmResponse.text || '';
    textDiv.innerHTML = responseText;
    contentDiv.appendChild(textDiv);
    
    // Attach click handlers to blur elements
    if (state.isInteractive) {
        const blurElements = textDiv.querySelectorAll('.scaffold-blur');
        blurElements.forEach(el => {
            const word = el.getAttribute('data-word');
            el.onclick = () => handleBlurClick(el, word);
        });
    } else {
        // Non-interactive mode: reveal all immediately
        const blurElements = textDiv.querySelectorAll('.scaffold-blur');
        blurElements.forEach(el => {
            el.classList.remove('scaffold-blur');
            el.classList.add('scaffold-revealed');
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
    const pct = Math.min(100, (state.usedQuestions.size / PRESET_QUESTIONS.length) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('turn-display').textContent = `${state.usedQuestions.size}/${PRESET_QUESTIONS.length}`;
}

/**
 * Initialize question buttons
 */
function initializeQuestions() {
    questionsList.innerHTML = '';
    PRESET_QUESTIONS.forEach((q, idx) => {
        const btn = document.createElement('button');
        btn.className = "question-btn w-full text-left bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-3 rounded-lg border border-indigo-200 text-sm font-medium";
        btn.textContent = `${idx + 1}. ${q.text}`;
        btn.id = `q-${q.id}`;
        btn.onclick = () => handleQuestionClick(q);
        questionsList.appendChild(btn);
    });
    document.getElementById('max-questions').textContent = PRESET_QUESTIONS.length;
}

