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
            body: JSON.stringify({ question: questionText })
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

