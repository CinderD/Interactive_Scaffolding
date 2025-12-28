"""
Flask API server for Azure OpenAI integration
Handles chat requests and returns structured scaffolding responses
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from azure.identity import (
    AzureCliCredential,
    ChainedTokenCredential,
    ManagedIdentityCredential,
    get_bearer_token_provider,
)
from openai import AzureOpenAI
import json
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Azure OpenAI Configuration
# Load from environment variables for security
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

# Initialize Azure OpenAI client
def get_azure_client():
    """Initialize Azure OpenAI client with authentication"""
    try:
        # Try Managed Identity first (for production)
        credential = ChainedTokenCredential(
            ManagedIdentityCredential(),
            AzureCliCredential()
        )
        token_provider = get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default")
        
        if not AZURE_OPENAI_ENDPOINT:
            raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is required")
        
        client = AzureOpenAI(
            azure_ad_token_provider=token_provider,
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
        return client
    except Exception as e:
        print(f"Error initializing Azure client: {e}")
        # Fallback: try with API key if available
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if api_key:
            if not AZURE_OPENAI_ENDPOINT:
                raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is required")
            client = AzureOpenAI(
                api_key=api_key,
                api_version=AZURE_OPENAI_API_VERSION,
                azure_endpoint=AZURE_OPENAI_ENDPOINT
            )
            return client
        raise

# Scaffolding framework information
SCAFFOLDING_SYSTEM_PROMPT = """You are an intelligent tutoring system for mathematical proofs. Your role is to help students understand proofs through adaptive scaffolding.

## Scaffolding Framework

### Scaffolding Means (Methods):
1. **Hints**: Provide subtle guidance without giving away the answer directly
2. **Explaining**: Clarify concepts, definitions, or terminology
3. **Instructing**: Break down complex steps into structured instructions
4. **Modeling**: Show worked examples or demonstrate problem-solving steps
5. **Feeding back**: Provide feedback on student responses
6. **Questioning**: Ask probing questions to guide thinking

### Scaffolding Intentions (Purposes):
- **Cognitive**: Support students' cognitive activities (understanding, reasoning, problem-solving)
- **Metacognitive**: Support students' metacognitive activities (monitoring, planning, reflecting on learning)
- **Affect**: Support student affect (engagement, motivation, emotion management)

## Current Context
The student is learning about a proof that shows "There are infinitely many triadic primes."

**Proof Summary:**
- Monadic numbers: form 4k+1
- Triadic numbers: form 4k+3
- The proof shows that products of monadic numbers are monadic
- It assumes finitely many triadic primes and constructs M = 4p₂...pₙ + 3
- Shows no triadic prime divides M, and 2 doesn't divide M
- Concludes all prime factors of M are monadic, so M is monadic
- But M is clearly triadic (form 4(...)+3), creating a contradiction

## Your Task
When a student asks a question:
1. **Decide if scaffolding is appropriate** - Some questions may be straightforward and not need scaffolding
2. **Choose the most appropriate scaffolding means** (hints, explaining, instructing, or modeling)
3. **Identify the scaffolding intention** (cognitive, metacognitive, or affect)
4. **Generate a helpful response** that includes key concepts/phrases that should be masked for interactive learning
5. **Mark which words/phrases should be hidden** using a special format

## Response Format
You MUST respond with valid JSON in this exact structure:
{
    "usesScaffolding": true or false,
    "scaffoldType": "hinting" or "explaining" or "instructing" or "modeling" or null,
    "scaffoldIntent": "cognitive" or "metacognitive" or "affect" or null,
    "responseText": "Your response text here. Use <MASK>word or phrase</MASK> to mark content that should be hidden for interactive learning. Only mask key concepts, important terms, or critical information that benefits from active recall.",
    "maskedWords": ["word1", "phrase 2", "concept 3"]
}

**Important Guidelines:**
- Only use scaffolding when it genuinely helps learning
- Choose the means that best fits the question type
- Mask only 2-5 key concepts per response (not too many)
- Mask important terms, definitions, or critical logical steps
- Keep masked content concise (single words or short phrases)
- Ensure the response is pedagogically sound and helpful
- Always return valid JSON - use null (not "null" string) when scaffolding is not used
"""

def create_chat_prompt(user_question):
    """Create the full prompt for the LLM"""
    return f"""Based on the scaffolding framework and the proof context, respond to this student question:

**Student Question:** {user_question}

IMPORTANT: You must respond with ONLY valid JSON in the exact format specified. Do not include any text before or after the JSON. The JSON must be parseable.

Example valid response:
{{
    "usesScaffolding": true,
    "scaffoldType": "explaining",
    "scaffoldIntent": "cognitive",
    "responseText": "A <MASK>monadic</MASK> number has the form <MASK>4k+1</MASK>.",
    "maskedWords": ["monadic", "4k+1"]
}}"""

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests and return structured scaffolding responses"""
    try:
        data = request.json
        user_question = data.get('question', '')
        
        if not user_question:
            return jsonify({'error': 'Question is required'}), 400
        
        # Get Azure OpenAI client
        client = get_azure_client()
        
        # Create messages for chat completion
        messages = [
            {"role": "system", "content": SCAFFOLDING_SYSTEM_PROMPT},
            {"role": "user", "content": create_chat_prompt(user_question)}
        ]
        
        # Validate deployment name
        if not AZURE_OPENAI_DEPLOYMENT:
            return jsonify({'error': 'AZURE_OPENAI_DEPLOYMENT environment variable is required'}), 500
        
        # Call Azure OpenAI
        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=messages,
            temperature=0.7,
            max_tokens=1000,
            response_format={"type": "json_object"}  # Force JSON response
        )
        
        # Parse response
        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON if there's extra text
        import re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
        
        try:
            result = json.loads(content)
        except json.JSONDecodeError as e:
            # If JSON parsing fails, return error
            return jsonify({
                'error': f'Invalid JSON from LLM: {str(e)}',
                'raw_content': content[:200]  # First 200 chars for debugging
            }), 500
        
        # Validate required fields
        if 'responseText' not in result and 'text' not in result:
            return jsonify({
                'error': 'Missing responseText in LLM response',
                'received': list(result.keys())
            }), 500
        
        # Validate and process the response
        if 'responseText' in result:
            # Convert <MASK> tags to HTML span elements for frontend
            text = result['responseText']
            masked_words = result.get('maskedWords', [])
            
            # Replace <MASK>...</MASK> with HTML spans
            def replace_mask(match):
                masked_content = match.group(1)
                # Escape HTML in masked content for safety
                import html
                escaped = html.escape(masked_content)
                return f'<span class="scaffold-blur" data-word="{escaped}">{escaped}</span>'
            
            text = re.sub(r'<MASK>(.*?)</MASK>', replace_mask, text)
            result['responseText'] = text
        
        return jsonify(result)
        
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON response from LLM: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # Run on port 5000 by default
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

