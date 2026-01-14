// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Safe wrapper for lucide.createIcons()
 */
function safeCreateIcons() {
    try {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    } catch (e) {
        console.warn('Lucide icons not yet loaded:', e);
    }
}

/**
 * Initialize mode toggle handlers
 */
function initializeModeToggle() {
    document.getElementById('mode-interactive').onclick = () => {
        state.isInteractive = true;
        document.getElementById('mode-interactive').classList.add('bg-indigo-600', 'text-white');
        document.getElementById('mode-interactive').classList.remove('text-slate-600');
        document.getElementById('mode-noninteractive').classList.remove('bg-indigo-600', 'text-white');
        document.getElementById('mode-noninteractive').classList.add('text-slate-600');
    };

    document.getElementById('mode-noninteractive').onclick = () => {
        state.isInteractive = false;
        document.getElementById('mode-noninteractive').classList.add('bg-indigo-600', 'text-white');
        document.getElementById('mode-noninteractive').classList.remove('text-slate-600');
        document.getElementById('mode-interactive').classList.remove('bg-indigo-600', 'text-white');
        document.getElementById('mode-interactive').classList.add('text-slate-600');
    };
}

// ==========================================
// WITHIN-SUBJECT STUDY FLOW
// ==========================================

function _phaseId(proofId, interactive) {
    const p = String(proofId || '').toUpperCase();
    return `${p}_${interactive ? 'interactive' : 'regular'}`;
}

function makeStudyPhase({ proofId, interactive }) {
    const p = String(proofId || '').toUpperCase();
    const isInteractive = !!interactive;
    return {
        id: _phaseId(p, isInteractive),
        proofId: p,
        interactive: isInteractive,
    };
}

// Four counterbalanced modes = (A→C vs C→A) × (which proof is Interactive vs Regular)
const STUDY_MODES = {
    1: [makeStudyPhase({ proofId: 'A', interactive: true }), makeStudyPhase({ proofId: 'C', interactive: false })],
    2: [makeStudyPhase({ proofId: 'A', interactive: false }), makeStudyPhase({ proofId: 'C', interactive: true })],
    3: [makeStudyPhase({ proofId: 'C', interactive: true }), makeStudyPhase({ proofId: 'A', interactive: false })],
    4: [makeStudyPhase({ proofId: 'C', interactive: false }), makeStudyPhase({ proofId: 'A', interactive: true })],
};

function _renderMaterialForProof(proofId) {
    const el = document.getElementById('material-content');
    if (!el) return;

    // Cache the original Proof A HTML so we can restore it after swapping.
    if (!window.__proofAHtml) {
        window.__proofAHtml = el.innerHTML;
    }

    if (proofId === 'C') {
        // Use String.raw so backslashes are preserved for MathJax.
        el.innerHTML = String.raw`
            <div class="prose prose-sm max-w-none text-slate-700">
                <h3 class="font-bold text-lg text-slate-900 mb-2">Proof C</h3>
                <p class="mb-4"><strong>Theorem:</strong> If \(p\) is prime and \(n\in\mathbb{Z}\) and \(p \mid (4n^2 + 1)\), then \(p\equiv 1\ (\mathrm{mod}\ 4)\).</p>

                <!-- One sentence per line (match the screenshot) -->
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L1)</span><strong>Proof:</strong> Clearly, \(p\) cannot be \(2\), so we need only show that \(p\not\equiv 3\ (\mathrm{mod}\ 4)\).</p>
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L2)</span>Suppose \(p = 4k + 3\) for some \(k\in\mathbb{Z}\).</p>
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L3)</span>Let \(y = 2n\).</p>
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L4)</span>Then, by Fermat’s Little Theorem, \(y^{p-1} \equiv 1\ (\mathrm{mod}\ p)\).</p>
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L5)</span>But \(y^2 + 1 \equiv 0\ (\mathrm{mod}\ p)\).</p>
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L6)</span>So, \(y^{p-1} \equiv y^{4k+2} \equiv (y^2)^{2k+1} \equiv (-1)\ (\mathrm{mod}\ p)\).</p>
                <p class="mb-3"><span class="text-xs font-mono text-slate-400 mr-2">(L7)</span>But this cannot be the case.</p>
                <p class="mb-0"><span class="text-xs font-mono text-slate-400 mr-2">(L8)</span>Therefore, \(p \equiv 1\ (\mathrm{mod}\ 4)\). \(\square\)</p>
            </div>
        `;
    } else {
        // Restore the original Proof A markup.
        if (window.__proofAHtml) {
            el.innerHTML = window.__proofAHtml;
        }
    }

    if (window.MathJax) MathJax.typesetPromise();
}

function _resetChatForNewPhase(proofId) {
    state.turnCounter = 0;
    state.currentQuestionIndex = 0;
    state.usedQuestions = new Set();
    updateProgress();

    const chat = document.getElementById('chat-container');
    if (chat) {
        const proofName = proofId === 'C' ? 'Proof C' : 'Proof A';
        chat.innerHTML = `
            <div class="flex gap-4 slide-in">
                <div class="w-10 h-10 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-md text-white">
                    <i data-lucide="bot" class="w-6 h-6"></i>
                </div>
                <div class="bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm max-w-[85%] text-sm text-slate-700">
                    <p class="mb-2 font-bold text-indigo-700">Welcome to the Proof Tutor!</p>
                    <p class="mb-0">Please read <b>${proofName}</b> on the left, then ask questions below.</p>
                </div>
            </div>
        `;
    }
    safeCreateIcons();
}

function startStudyCondition(condition) {
    // condition: {id, proofId, interactive}
    state.currentConditionId = condition.id;
    state.currentProofId = condition.proofId;
    state.isInteractive = !!condition.interactive;

    // Views
    const studyView = document.getElementById('study-view');
    const chatView = document.getElementById('chat-view');
    const quizView = document.getElementById('quiz-view');
    if (studyView) studyView.classList.add('hidden');
    if (quizView) quizView.classList.add('hidden');
    if (chatView) chatView.classList.remove('hidden');

    // Reset submit button if previously hidden
    const submitBtn = document.getElementById('quiz-submit-btn');
    if (submitBtn) submitBtn.style.display = '';

    _renderMaterialForProof(state.currentProofId);
    _resetChatForNewPhase(state.currentProofId);
    initializeQuestions();

    // Restart timer for this condition
    if (typeof window.startQuizCountdown === 'function') {
        window.startQuizCountdown();
    }
}

function beginStudyWithMode(mode) {
    const m = parseInt(mode, 10);
    const seq = STUDY_MODES[m];
    if (!Array.isArray(seq) || seq.length !== 2) {
        console.warn('Unknown study mode:', mode);
        return;
    }
    state.studyMode = m;
    state.studySequence = seq;
    state.studyPhaseIndex = 0;

    // Persist the chosen mode + its concrete combination (proof order + interactive assignment).
    if (typeof logStudyStart === 'function') {
        logStudyStart({
            sessionId: state.sessionId,
            studyMode: state.studyMode,
            studySequence: state.studySequence,
        });
    }
    startStudyCondition(state.studySequence[0]);
}

// Expose for quiz.js
window.startStudyCondition = startStudyCondition;

function generateRandomSessionId() {
    try {
        if (crypto?.randomUUID) return crypto.randomUUID();
    } catch (_) {
        // ignore
    }
    // Fallback: timestamp + random
    const rand = Math.random().toString(16).slice(2);
    return `sid_${Date.now().toString(16)}_${rand}`;
}

function setSessionId(sessionId) {
    state.sessionId = sessionId;
    try {
        window.localStorage.setItem('SESSION_ID', sessionId);
    } catch (_) {
        // ignore
    }

    const btn = document.getElementById('regen-session-id');
    if (btn) {
        btn.title = `Session ID (primary key): ${sessionId}`;
    }
}

function initializeSessionId() {
    let existing = null;
    try {
        existing = window.localStorage.getItem('SESSION_ID');
    } catch (_) {
        // ignore
    }
    if (!existing) {
        existing = generateRandomSessionId();
    }
    setSessionId(existing);

    const btn = document.getElementById('regen-session-id');
    if (btn) {
        btn.onclick = () => {
            const next = generateRandomSessionId();
            // Reset turn counter for the new session id.
            state.turnCounter = 0;
            setSessionId(next);

            // UX feedback
            showToast();
        };
    }
}

function showToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.add('hidden');
    }, 1800);
}

// ==========================================
// QUIZ COUNTDOWN TIMER (15 minutes)
// ==========================================

const QUIZ_COUNTDOWN_MS = 15 * 60 * 1000;
let __quizCountdownInterval = null;
let __quizCountdownDeadline = null;

function _formatTimeMMSS(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function stopQuizCountdown() {
    if (__quizCountdownInterval) {
        clearInterval(__quizCountdownInterval);
        __quizCountdownInterval = null;
    }
    __quizCountdownDeadline = null;
}

function startQuizCountdown() {
    stopQuizCountdown();
    __quizCountdownDeadline = Date.now() + QUIZ_COUNTDOWN_MS;

    const tick = () => {
        // If user is already in quiz, stop ticking.
        const quizView = document.getElementById('quiz-view');
        if (quizView && !quizView.classList.contains('hidden')) {
            stopQuizCountdown();
            return;
        }

        const timerEl = document.getElementById('timer-display');
        const remaining = __quizCountdownDeadline - Date.now();

        if (timerEl) {
            timerEl.textContent = `Time: ${_formatTimeMMSS(remaining)}`;
        }

        if (remaining <= 0) {
            stopQuizCountdown();
            if (typeof showQuiz === 'function') {
                showQuiz();
            }
        }
    };

    tick();
    __quizCountdownInterval = setInterval(tick, 250);
}

// Expose for quiz navigation to stop the timer.
window.startQuizCountdown = startQuizCountdown;
window.stopQuizCountdown = stopQuizCountdown;

/**
 * Initialize application
 */
function initializeApp() {
    initializeModeToggle();
    initializeSessionId();

    // Export (save + print) self-explanation questions for Proof A/C.
    // These should not be shown in the participant UI.
    try {
        if (!window.__selfExplanationExported && typeof logSelfExplanationQuestions === 'function') {
            const proofA = (typeof PRESET_QUESTIONS_A !== 'undefined') ? PRESET_QUESTIONS_A : [];
            const proofC = (typeof PRESET_QUESTIONS_C !== 'undefined') ? PRESET_QUESTIONS_C : [];
            window.__selfExplanationExported = true;
            logSelfExplanationQuestions({
                sessionId: state?.sessionId || null,
                proofA,
                proofC,
            });
        }
    } catch (e) {
        console.warn('self-explanation export failed:', e);
    }

    // Study mode selection (4 counterbalanced modes)
    const m1 = document.getElementById('study-mode-1');
    const m2 = document.getElementById('study-mode-2');
    const m3 = document.getElementById('study-mode-3');
    const m4 = document.getElementById('study-mode-4');
    if (m1) m1.onclick = () => beginStudyWithMode(1);
    if (m2) m2.onclick = () => beginStudyWithMode(2);
    if (m3) m3.onclick = () => beginStudyWithMode(3);
    if (m4) m4.onclick = () => beginStudyWithMode(4);

    // Default to study selection view on load
    const studyView = document.getElementById('study-view');
    const chatView = document.getElementById('chat-view');
    const quizView = document.getElementById('quiz-view');
    if (studyView) studyView.classList.remove('hidden');
    if (chatView) chatView.classList.add('hidden');
    if (quizView) quizView.classList.add('hidden');
    
    // Setup user question form
    const form = document.getElementById('user-question-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('user-question-input');
            if (input) {
                handleUserQuestion(input.value);
                input.value = '';
            }
        });
    }
    
    // Wait for lucide to load, then create icons
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(safeCreateIcons, 100);
        });
    } else {
        setTimeout(safeCreateIcons, 100);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

