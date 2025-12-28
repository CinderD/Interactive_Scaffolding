// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    API_BASE_URL: 'http://localhost:5000', // Change to your API server URL
    DEFAULT_RESPONSIBILITY: 30,
    RESPONSIBILITY_THRESHOLD: 50 // Above this is "high responsibility"
};

// ==========================================
// STATE MANAGEMENT
// ==========================================
let state = {
    currentQuestionIndex: 0,
    isInteractive: true, // Interactive mode by default
    usedQuestions: new Set(),
    quizAnswers: [],
    quizScore: 0
};

let currentBlurEl = null;
let currentHiddenWord = null;

