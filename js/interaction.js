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
    
    // Show loading
    const loadingId = addLoading();
    
    try {
        // Fetch real LLM response
        const llmResponse = await fetchLLMResponse(question.text);
        removeLoading(loadingId);
        
        // Render the response
        renderBotResponse(llmResponse);
        updateProgress();
        
        // Check if all questions used, then show quiz
        if (state.usedQuestions.size >= PRESET_QUESTIONS.length) {
            setTimeout(() => {
                showQuiz();
            }, 2000);
        }
    } catch (error) {
        removeLoading(loadingId);
        addMessage('bot', `Error: ${error.message}. Please try again.`);
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
    
    // Show loading
    const loadingId = addLoading();
    
    try {
        // Fetch real LLM response
        const llmResponse = await fetchLLMResponse(questionText);
        removeLoading(loadingId);
        
        // Render the response
        renderBotResponse(llmResponse);
    } catch (error) {
        removeLoading(loadingId);
        addMessage('bot', `Error: ${error.message}. Please try again.`);
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

