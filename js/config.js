// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    // Default to the SAME host the page is served from, so remote users don't call their own localhost.
    // Override options:
    // - URL param:   ?api=http://<host>:5000
    // - localStorage: localStorage.setItem('API_BASE_URL', 'http://<host>:5000')
    API_BASE_URL: (() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromQuery = params.get('api');
            if (fromQuery) return fromQuery;
            const fromStorage = window.localStorage.getItem('API_BASE_URL');
            if (fromStorage) return fromStorage;
        } catch (_) {
            // ignore
        }
        // Single-port default: call backend on the same origin as the page.
        // This avoids CORS and means teammates only need to forward one port.
        return '';
    })(),
    DEFAULT_RESPONSIBILITY: 30,
    RESPONSIBILITY_THRESHOLD: 50 // Above this is "high responsibility"
};

// ==========================================
// STATE MANAGEMENT
// ==========================================
let state = {
    sessionId: null,
    turnCounter: 0,
    currentQuestionIndex: 0,
    isInteractive: true, // Interactive mode by default
    usedQuestions: new Set(),
    quizAnswers: [],
    quizScore: 0,

    // Within-subject study flow
    studyOrder: null,           // 1 or 2
    studySequence: null,        // array of condition objects
    studyPhaseIndex: 0,
    currentConditionId: null,   // 'control' | 'experimental'
    currentProofId: 'A',        // 'A' | 'C'
};

let currentBlurEl = null;
let currentHiddenWord = null;

