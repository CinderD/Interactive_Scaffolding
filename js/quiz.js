// ==========================================
// QUIZ FUNCTIONALITY
// ==========================================

/**
 * Show quiz view
 */
function showQuiz() {
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('quiz-view').classList.remove('hidden');
    const content = document.getElementById('quiz-content');
    content.innerHTML = '';
    QUIZ_DATA.forEach((item, idx) => {
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
}

/**
 * Navigate directly to quiz
 */
function goToQuizDirect() {
    showQuiz();
}

/**
 * Submit quiz and calculate score
 */
function submitQuiz() {
    let score = 0;
    const userAnswers = [];
    
    QUIZ_DATA.forEach(item => {
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
    
    document.getElementById('quiz-content').innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                <i data-lucide="trophy" class="w-10 h-10"></i>
            </div>
            <h2 class="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
            <p class="text-xl text-slate-600">You scored <span class="font-bold text-indigo-600">${score}/${QUIZ_DATA.length}</span></p>
            <div class="flex gap-3 mt-6">
                <button onclick="exportQuizAnswers()" class="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex items-center gap-2">
                    <i data-lucide="download" class="w-4 h-4"></i> Export Answers
                </button>
                <button onclick="location.reload()" class="bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-300 shadow-md transition-all active:scale-95">
                    Restart Session
                </button>
            </div>
        </div>
    `;
    document.querySelector('#quiz-view button').style.display = 'none';
    safeCreateIcons();
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

