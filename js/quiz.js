// ==========================================
// QUIZ FUNCTIONALITY
// ==========================================

/**
 * Show quiz view
 */
function showQuiz() {
    if (typeof window.stopQuizCountdown === 'function') {
        window.stopQuizCountdown();
    }
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('quiz-view').classList.remove('hidden');

    const submitBtn = document.getElementById('quiz-submit-btn');
    if (submitBtn) submitBtn.style.display = '';

    const content = document.getElementById('quiz-content');
    content.innerHTML = '';

    const hintEl = document.querySelector('#quiz-view p.text-sm.text-indigo-600');
    if (hintEl) hintEl.textContent = getQuizHintText();

    const quizData = getQuizData();
    const countEl = document.getElementById('quiz-count');
    if (countEl) countEl.textContent = `${quizData.length} Questions`;

    quizData.forEach((item, idx) => {
        const qDiv = document.createElement('div');
        qDiv.className = "mb-8 bg-white p-4 rounded-lg border border-slate-200 shadow-sm";
        qDiv.innerHTML = `
            <p class="font-bold text-slate-800 mb-3 text-sm">${idx+1}. ${item.q}</p>
            <div class="space-y-2">
                ${item.opts.map((opt, oid) => `
                    <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-indigo-50 cursor-pointer transition">
                        <input type="radio" name="q${item.id}" value="${oid}" class="accent-indigo-600 w-4 h-4">
                        <span class="text-sm text-slate-600">${opt}</span>
                    </label>
                `).join('')}
            </div>
        `;
        content.appendChild(qDiv);
    });

    // Ensure math in quiz questions/options is rendered (e.g., \(y^{p-1}\), \(p \not\equiv 3\)).
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([content]).catch(() => {});
    }
}

/**
 * Navigate directly to quiz
 */
function goToQuizDirect() {
    if (typeof window.stopQuizCountdown === 'function') {
        window.stopQuizCountdown();
    }
    showQuiz();
}

/**
 * Submit quiz and calculate score
 */
function submitQuiz() {
    let score = 0;
    const userAnswers = [];

    const quizData = getQuizData();
    quizData.forEach(item => {
        const sel = document.querySelector(`input[name="q${item.id}"]:checked`);
        const userAnswer = sel ? parseInt(sel.value) : null;
        const isCorrect = userAnswer === item.ans;
        if (isCorrect) score++;
        
        userAnswers.push({
            questionId: item.id,
            question: item.q,
            userAnswer: userAnswer,
            correctAnswer: item.ans,
            isCorrect: isCorrect,
            options: item.opts
        });
    });
    
    // Store answers for export
    state.quizAnswers = userAnswers;
    state.quizScore = score;

    // Persist quiz answers (best-effort) so analysis doesn't rely on manual export.
    if (typeof logQuizSubmit === 'function') {
        logQuizSubmit({
            sessionId: state.sessionId,
            proofId: state?.currentProofId || null,
            phaseIndex: state?.studyPhaseIndex ?? null,
            conditionId: state?.currentConditionId || null,
            studyMode: state?.studyMode ?? null,
            interactive: state?.isInteractive ?? null,
            score,
            totalQuestions: quizData.length,
            answers: userAnswers,
        });
    }

    const hasNextPhase = Array.isArray(state.studySequence) && state.studyPhaseIndex < state.studySequence.length - 1;
    const nextLabel = hasNextPhase ? 'Next Group' : 'Finish';
    
    document.getElementById('quiz-content').innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                <i data-lucide="trophy" class="w-10 h-10"></i>
            </div>
            <h2 class="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
            <p class="text-xl text-slate-600">You scored <span class="font-bold text-indigo-600">${score}/${quizData.length}</span></p>
            <div class="flex gap-3 mt-6">
                <button onclick="goToNextGroup()" class="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95">
                    ${nextLabel}
                </button>
            </div>
        </div>
    `;

    // Hide submit button after completion
    const submitBtn = document.getElementById('quiz-submit-btn');
    if (submitBtn) submitBtn.style.display = 'none';
    safeCreateIcons();
}

function goToNextGroup() {
    const hasNextPhase = Array.isArray(state.studySequence) && state.studyPhaseIndex < state.studySequence.length - 1;
    if (!hasNextPhase) {
        location.reload();
        return;
    }

    state.studyPhaseIndex += 1;
    const next = state.studySequence[state.studyPhaseIndex];
    if (typeof window.startStudyCondition === 'function') {
        window.startStudyCondition(next);
    }
}

/**
 * Export quiz answers to JSON file
 */
function exportQuizAnswers() {
    const exportData = {
        timestamp: new Date().toISOString(),
        mode: state.isInteractive ? 'Interactive' : 'Non-Interactive',
        responsibility: document.getElementById('responsibility-slider')?.value || CONFIG.DEFAULT_RESPONSIBILITY,
        score: state.quizScore,
        totalQuestions: QUIZ_DATA.length,
        answers: state.quizAnswers,
        questionsAsked: Array.from(state.usedQuestions)
    };
    
    // Create JSON file
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-answers-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

