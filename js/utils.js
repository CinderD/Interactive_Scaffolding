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

/**
 * Initialize application
 */
function initializeApp() {
    initializeQuestions();
    initializeModeToggle();
    
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

