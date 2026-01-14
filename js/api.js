// ==========================================
// API COMMUNICATION
// ==========================================

/**
 * Fetch LLM response from API server
 * @param {string} questionText - The user's question
 * @returns {Promise<Object>} LLM response with scaffolding information
 */
async function fetchLLMResponse(questionText) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: questionText,
                proofId: state?.currentProofId || 'A',
                conditionId: state?.currentConditionId || null,
                phaseIndex: state?.studyPhaseIndex ?? null,
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data.hasOwnProperty('responseText') && !data.hasOwnProperty('text')) {
            throw new Error('Invalid response format from API');
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching LLM response:', error);
        // Fallback to a helpful error response
        return {
            usesScaffolding: false,
            scaffoldType: null,
            scaffoldIntent: null,
            responseText: `<p class="text-red-600 font-semibold">⚠️ API Connection Error</p><p>Error: ${error.message}</p><p class="text-xs text-slate-500 mt-2">Please ensure the API server is running at ${CONFIG.API_BASE_URL}. Check the console for details.</p>`,
            maskedWords: []
        };
    }
}

async function postLog(path, payload) {
    try {
        await fetch(`${CONFIG.API_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        // Best-effort only; never block UI.
        console.warn('Log post failed:', path, e);
    }
}

function logTurn({ sessionId, turnIndex, userText, llmResponse }) {
    if (!sessionId) return;
    return postLog('/api/log/turn', {
        sessionId,
        turnIndex,
        userText,
        llmResponse,
        proofId: state?.currentProofId || null,
        conditionId: state?.currentConditionId || null,
        phaseIndex: state?.studyPhaseIndex ?? null,
        studyMode: state?.studyMode ?? null,
        interactive: state?.isInteractive ?? null,
        clientTs: new Date().toISOString(),
    });
}

function logScratch({ sessionId, turnIndex, maskId, maskedText, points, meta }) {
    if (!sessionId || !maskId) return;
    return postLog('/api/log/scratch', {
        sessionId,
        turnIndex,
        maskId,
        maskedText,
        points,
        meta,
        proofId: state?.currentProofId || null,
        conditionId: state?.currentConditionId || null,
        phaseIndex: state?.studyPhaseIndex ?? null,
        studyMode: state?.studyMode ?? null,
        interactive: state?.isInteractive ?? null,
        clientTs: new Date().toISOString(),
    });
}

function logStudyStart({ sessionId, studyMode, studySequence }) {
    if (!sessionId) return;
    return postLog('/api/log/study_start', {
        sessionId,
        studyMode: studyMode ?? null,
        studySequence: Array.isArray(studySequence) ? studySequence : null,
        clientTs: new Date().toISOString(),
    });
}

function logQuizSubmit({ sessionId, proofId, phaseIndex, conditionId, studyMode, interactive, score, totalQuestions, answers }) {
    if (!sessionId) return;
    return postLog('/api/log/quiz', {
        sessionId,
        proofId: proofId ?? null,
        phaseIndex: phaseIndex ?? null,
        conditionId: conditionId ?? null,
        studyMode: studyMode ?? null,
        interactive: interactive ?? null,
        score: score ?? null,
        totalQuestions: totalQuestions ?? null,
        answers: Array.isArray(answers) ? answers : null,
        clientTs: new Date().toISOString(),
    });
}

    // ==========================================
    // Hidden export: Self-explanation questions
    // ==========================================

    async function logSelfExplanationQuestions(payload) {
        try {
            await fetch(`${CONFIG.API_BASE_URL}/api/log/self_explanation_questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {}),
            });
        } catch (e) {
            // Best-effort only
            console.warn('logSelfExplanationQuestions failed:', e);
        }
    }

