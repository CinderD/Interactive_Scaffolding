"""
Flask API server for Azure OpenAI integration
Handles chat requests and returns structured scaffolding responses
"""
from flask import Flask, request, jsonify, send_from_directory
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
from datetime import datetime, timezone
import re

from dotenv import load_dotenv

load_dotenv()

APP_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(APP_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

REVIEW_DIR = os.path.join(LOG_DIR, 'reviews')
os.makedirs(REVIEW_DIR, exist_ok=True)


def _safe_session_id(session_id: str) -> str:
    session_id = str(session_id or '').strip()
    # Prevent path traversal / weird filesystem chars.
    safe = re.sub(r'[^a-zA-Z0-9._-]+', '_', session_id)
    safe = safe.strip('._-') or 'unknown'
    return safe[:128]


def _append_jsonl(path: str, payload: dict) -> None:
    payload = dict(payload)
    payload['_server_ts'] = datetime.now(timezone.utc).isoformat()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def _read_jsonl(path: str, limit: int | None = None) -> list[dict]:
    out: list[dict] = []
    if not os.path.exists(path):
        return out
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                continue
            if isinstance(limit, int) and limit > 0 and len(out) >= limit:
                break
    return out


def _read_json(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def _write_json_atomic(path: str, obj: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

app = Flask(__name__)

# Enable CORS for browser clients.
# We keep it permissive for this demo so teammates can access via port-forwarding.
# This also ensures CORS headers are present on error responses.
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}, r"/health": {"origins": "*"}},
    supports_credentials=False,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"],
    max_age=86400,
)


@app.after_request
def _add_cors_headers(resp):
    # Belt-and-suspenders: make sure CORS headers exist even if an exception handler returns early.
    resp.headers.setdefault("Access-Control-Allow-Origin", "*")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type,Authorization")
    return resp

# Azure OpenAI Configuration
# Load from environment variables for security
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

# Initialize Azure OpenAI client
def get_azure_client():
    """Initialize Azure OpenAI client with authentication"""
    try:
        if not AZURE_OPENAI_ENDPOINT:
            raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is required")

        auth_mode = os.getenv("AZURE_OPENAI_AUTH_MODE", "auto").strip().lower()
        api_key = (os.getenv("AZURE_OPENAI_API_KEY") or "").strip()

        # Match common working patterns:
        # - If an API key is provided, prefer it (unless auth_mode forces AAD)
        # - Otherwise use AAD via Azure CLI / Managed Identity
        if api_key and auth_mode in ("auto", "api_key", "key"):
            return AzureOpenAI(
                api_key=api_key,
                api_version=AZURE_OPENAI_API_VERSION,
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
            )

        if auth_mode in ("auto", "azure_ad", "aad"):
            credential = ChainedTokenCredential(
                AzureCliCredential(),
                ManagedIdentityCredential(),
            )
            token_provider = get_bearer_token_provider(
                credential,
                "https://cognitiveservices.azure.com/.default",
            )
            return AzureOpenAI(
                azure_ad_token_provider=token_provider,
                api_version=AZURE_OPENAI_API_VERSION,
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
            )

        raise ValueError(
            "Invalid AZURE_OPENAI_AUTH_MODE. Use 'auto', 'api_key', or 'azure_ad'."
        )
    except Exception as e:
        print(f"Error initializing Azure client: {e}")
        raise

_SCAFFOLDING_BASE_PROMPT = """You are an intelligent tutoring system for mathematical proofs. Your role is to help students understand proofs through adaptive scaffolding.

## Scaffolding Framework

### What counts as “Scaffolding” (`usesScaffolding` = true)
Scaffolding is **temporary, adaptive support** that helps the learner do/understand something they could not yet manage alone.
It should have **pedagogical value-add**: it teaches a reusable way to think, helps the learner choose what to do next, or supports persistence—not just delivering an answer.

Practical signals that scaffolding is present:
- **Contingent**: tailored to the student’s question/state (“stuck”, confusion, next-step need).
- **Transfer of responsibility**: prompts the student to attempt, predict, justify, or choose.
- **Fading**: gives only as much help as needed (nudge → steps → worked move).

Non-signals (do NOT set `usesScaffolding` true just for these):
- Standard politeness/closings (“Happy to help”, “Let me know if you have questions”).
- Pure info-gathering with no learning strategy (“paste logs/stack trace” without why/plan).
- Purely procedural “click here then there” steps with no conceptual/strategic rationale.

### Scaffolding Means (Methods) — choose ONE `scaffoldType`:
1. **Hinting**: Give partial cues or guiding questions that move the student forward **without** fully doing the step for them.
2. **Explaining**: Provide **why/how** (mechanism, rationale, underlying logic) that deepens understanding beyond a surface description.
3. **Instructing**: Provide a **problem-solving process** (how to proceed / what to check next / a reusable procedure), not just a recipe.
4. **Modeling**: Show a short **worked reasoning move** (a miniature derivation / how to apply an idea) that the student can emulate.

### How to choose `scaffoldType` (do NOT default to explaining):
- Use `hinting` if the student is close and needs a prompt (“why does this divide?”, “what’s the next move?”, “I’m stuck”).
- Use `explaining` only when the student’s blocker is terminology/definitions/concepts (“what is triadic/monadic?”, “what does divides mean?”).
- Use `instructing` when the student asks for a roadmap or sequencing (“how do we prove…?”, “how do we start?”).
- Use `modeling` when showing a concrete mini-derivation helps (“show why p can’t divide M”, “compute M mod p”, “work a small example”).

### Scaffolding Intentions (Purposes) — choose ONE `scaffoldIntent` (pick the PRIMARY goal):
- **Cognitive**: Help the learner understand or reason (explain/structure the proof logic; reduce complexity; highlight key relations).
- **Metacognitive**: Help the learner **orient and decide** (clarify goals/constraints; choose what to focus on next; plan the approach).
- **Affect**: Support persistence/engagement **in a functional way** (normalize difficulty, reduce frustration, encourage continued effort) while still moving the task forward.

Tie-breaks:
- If unsure between Metacognitive vs Cognitive, prefer **Cognitive**.
- Choose **Affect** only when the encouragement is explicit and functional (not just generic friendliness).

## Current Context
{PROOF_CONTEXT}

## Your Task
When a student asks a question:
1. **Decide if scaffolding is appropriate** - Some questions may be straightforward and not need scaffolding
2. **Choose the most appropriate scaffolding means** (hints, explaining, instructing, or modeling)
3. **Identify the scaffolding intention** (cognitive, metacognitive, or affect)
4. **Generate a helpful response**
5. **Decide which FULL sentences in your response are scaffolding moves** (i.e., sentences that provide a hint / guiding question, a plan/procedure, or a worked reasoning step)
6. **Mask those whole sentences** using a special format so the student can "scratch" to reveal them

## Masking Rules (sentence-level scratch-off)
Masking is for *productive struggle*: the student should try first, then scratch to reveal scaffolding.

Pick **1–3** masked sentences total.

What to mask:
- Sentences that contain a **scaffolding move** (i.e., a concrete instance of the chosen scaffolding means) with **pedagogical value-add**, such as:
    - **Hinting**: a nudge, cue, or guiding question that points to the next inference without completing it.
    - **Instructing**: an actionable problem-solving procedure/plan (what to check/try next and in what order).
    - **Explaining**: a compact **why/how** mechanism that unlocks understanding (not just restating facts).
    - **Modeling**: a short worked reasoning move the student can emulate.

Prefer masking the *highest-leverage* help sentences (the ones that would most reduce struggle if revealed), not background information.

What NOT to mask:
- Purely contextual setup, restating the question, or navigation text (e.g., “Here’s the idea…”, “Let’s look at the proof…”) that does not teach/guide.
- Standard politeness/closings (“Hope this helps”, “Let me know if you have questions”).
- Purely affective encouragement that is not paired with an actionable move (keep motivation visible).
- Purely descriptive statements that only paraphrase what the solution says (no why/how, no strategy).
- Anything required for basic comprehension of the task (do NOT hide the entire goal/ask).
- The entire response: leave at least one clear unmasked sentence that orients the student on what to attempt before scratching.

Constraints:
- Each mask must wrap a FULL sentence (include its punctuation).
- Do not mask partial spans inside a sentence.
- `maskedWords` MUST exactly equal the list of strings inside `<MASK>...</MASK>`, in order of appearance.

## Response Format
You MUST respond with valid JSON in this exact structure:
{
    "usesScaffolding": true or false,
    "scaffoldType": "hinting" or "explaining" or "instructing" or "modeling" or null,
    "scaffoldIntent": "cognitive" or "metacognitive" or "affect" or null,
    "responseText": "Your response text here. Wrap FULL scaffolding sentences with <MASK>sentence</MASK> so the student can scratch to reveal them.",
    "maskedWords": ["sentence 1", "sentence 2"]
}

**Important Guidelines:**
- Only use scaffolding when it genuinely helps learning
- Choose the means that best fits the question type
- Mask only 1-3 scaffolding sentences per response (not too many)
- Mask whole sentences (not individual keywords)
- Ensure the response is pedagogically sound and helpful
- Always return valid JSON - use null (not "null" string) when scaffolding is not used
"""

_PROOF_CONTEXT_A = """The student is learning about a proof that shows \"There are infinitely many triadic primes.\"

**Proof Summary:**
- Monadic numbers: form 4k+1
- Triadic numbers: form 4k+3
- The proof shows that products of monadic numbers are monadic
- It assumes finitely many triadic primes and constructs M = 4p₂...pₙ + 3
- Shows no triadic prime divides M, and 2 doesn't divide M
- Concludes all prime factors of M are monadic, so M is monadic
- But M is clearly triadic (form 4(...)+3), creating a contradiction
"""

_PROOF_CONTEXT_C = """The student is learning about a proof that shows: if p is prime and p divides (4n^2 + 1) for some integer n, then p \u2261 1 (mod 4).

**Proof Skeleton (high-level):**
- Use contradiction: assume p \u2261 3 (mod 4), so p = 4k+3.
- Let y = 2n so that y^2 + 1 = 4n^2 + 1 \u2261 0 (mod p), hence y^2 \u2261 -1 (mod p).
- By Fermat's Little Theorem, y^{p-1} \u2261 1 (mod p).
- But if p-1 = 4k+2, then y^{p-1} = (y^2)^{2k+1} \u2261 (-1)^{2k+1} = -1 (mod p), contradiction.
- Conclude p \u2262 3 (mod 4); with p \u2260 2 this implies p \u2261 1 (mod 4).
"""


def get_scaffolding_system_prompt(proof_id: str) -> str:
    pid = str(proof_id or 'A').strip().upper()
    if pid == 'C':
        ctx = _PROOF_CONTEXT_C
    else:
        ctx = _PROOF_CONTEXT_A
    return _SCAFFOLDING_BASE_PROMPT.replace('{PROOF_CONTEXT}', ctx)

def create_chat_prompt(user_question):
    """Create the full prompt for the LLM"""
    return f"""Based on the scaffolding framework and the proof context, respond to this student question:

**Student Question:** {user_question}

IMPORTANT: You must respond with ONLY valid JSON in the exact format specified. Do not include any text before or after the JSON. The JSON must be parseable.

Examples (different scaffoldType; do NOT copy verbatim):
{{
    "usesScaffolding": true,
    "scaffoldType": "hinting",
    "scaffoldIntent": "cognitive",
    "responseText": "<MASK>Try checking what it would mean if a triadic prime divided M.</MASK> What congruence would M have mod that prime?",
    "maskedWords": ["Try checking what it would mean if a triadic prime divided M."]
}}

{{
    "usesScaffolding": true,
    "scaffoldType": "explaining",
    "scaffoldIntent": "cognitive",
    "responseText": "A triadic number is one congruent to 3 mod 4. <MASK>So any triadic number can be written in the form 4k+3.</MASK>",
    "maskedWords": ["So any triadic number can be written in the form 4k+3."]
}}

{{
    "usesScaffolding": true,
    "scaffoldType": "instructing",
    "scaffoldIntent": "metacognitive",
    "responseText": "<MASK>To answer this, follow these steps: (1) restate the goal, (2) write down the key assumption, (3) construct M = 4p_2\u22ef p_n + 3, (4) test divisibility case-by-case.</MASK>",
    "maskedWords": ["To answer this, follow these steps: (1) restate the goal, (2) write down the key assumption, (3) construct M = 4p_2\u22ef p_n + 3, (4) test divisibility case-by-case."]
}}

{{
    "usesScaffolding": true,
    "scaffoldType": "modeling",
    "responseText": "<MASK>Model check: suppose a listed triadic prime p_i divides M = 4p_2\u22ef p_n + 3. Then M \u2261 3 (mod p_i) but also 4p_2\u22ef p_n \u2261 0 (mod p_i), which can’t both hold, so p_i \u2224 M.</MASK>",
    "maskedWords": ["Model check: suppose a listed triadic prime p_i divides M = 4p_2\u22ef p_n + 3. Then M \u2261 3 (mod p_i) but also 4p_2\u22ef p_n \u2261 0 (mod p_i), which can’t both hold, so p_i \u2224 M."]
    "maskedWords": ["p_i", "M = 4p_2\u22ef p_n + 3", "p_i \u2224 M"]
}}"""

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests and return structured scaffolding responses"""
    try:
        data = request.json
        user_question = data.get('question', '')
        proof_id = data.get('proofId', 'A')
        
        if not user_question:
            return jsonify({'error': 'Question is required'}), 400
        
        # Get Azure OpenAI client
        client = get_azure_client()
        
        # Create messages for chat completion
        messages = [
            {"role": "system", "content": get_scaffolding_system_prompt(proof_id)},
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
            timeout=60,
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
            # Normalize scaffoldType values (make it harder to get stuck on one label)
            raw_scaffold_type = result.get('scaffoldType')
            if isinstance(raw_scaffold_type, str):
                st = raw_scaffold_type.strip().lower()
                scaffold_type_map = {
                    'hint': 'hinting',
                    'hints': 'hinting',
                    'hinting': 'hinting',
                    'explain': 'explaining',
                    'explains': 'explaining',
                    'explaining': 'explaining',
                    'instruct': 'instructing',
                    'instruction': 'instructing',
                    'instructions': 'instructing',
                    'instructing': 'instructing',
                    'model': 'modeling',
                    'models': 'modeling',
                    'modeling': 'modeling',
                }
                result['scaffoldType'] = scaffold_type_map.get(st, raw_scaffold_type)

            # Convert <MASK> tags to HTML span elements for frontend
            text = result['responseText']

            # If the model provided `maskedWords` but did not include <MASK> tags,
            # try to insert <MASK> tags into the plain text before converting to HTML.
            original_masked_words = result.get('maskedWords')
            if '<MASK>' not in text and isinstance(original_masked_words, list) and original_masked_words:
                candidates = [str(x).strip() for x in original_masked_words if str(x).strip()]
                # Prefer longer phrases first to reduce partial overlaps.
                candidates = sorted(dict.fromkeys(candidates), key=len, reverse=True)[:5]
                for phrase in candidates:
                    # Replace first occurrence only.
                    pattern = re.escape(phrase)
                    if re.search(pattern, text):
                        text = re.sub(pattern, f"<MASK>{phrase}</MASK>", text, count=1)

            # Enforce sentence-level masking cap by unmasking extras (keeps UX consistent and prevents over-masking)
            mask_count = 0
            def _limit_masks(match):
                nonlocal mask_count
                mask_count += 1
                content = match.group(1)
                if mask_count <= 3:
                    return f"<MASK>{content}</MASK>"
                return content
            text = re.sub(r'<MASK>(.*?)</MASK>', _limit_masks, text, flags=re.DOTALL)

            # Derive maskedWords from the actual <MASK> tags to keep server/frontend consistent
            extracted = re.findall(r'<MASK>(.*?)</MASK>', text, flags=re.DOTALL)
            extracted = [re.sub(r'\s+', ' ', s).strip() for s in extracted]
            extracted = [s for s in extracted if s]
            result['maskedWords'] = extracted
            
            # IMPORTANT: Keep <MASK>...</MASK> tags in responseText.
            # The frontend renders Markdown and then converts <MASK> blocks into scratch-off spans.
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


@app.route('/api/log/turn', methods=['POST'])
def log_turn():
    """Persist one dialogue turn (user question + LLM response + masked parts)."""
    try:
        data = request.json or {}
        session_id = str(data.get('sessionId', '')).strip()
        if not session_id:
            return jsonify({'error': 'sessionId is required'}), 400

        safe_sid = _safe_session_id(session_id)
        session_dir = os.path.join(LOG_DIR, 'sessions', safe_sid)
        _append_jsonl(os.path.join(session_dir, 'dialogue_turns.jsonl'), data)
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': f'log error: {str(e)}'}), 500


@app.route('/api/log/scratch', methods=['POST'])
def log_scratch():
    """Persist scratch-off mouse/touch trajectory for a single masked element interaction."""
    try:
        data = request.json or {}
        session_id = str(data.get('sessionId', '')).strip()
        mask_id = str(data.get('maskId', '')).strip()
        if not session_id or not mask_id:
            return jsonify({'error': 'sessionId and maskId are required'}), 400

        safe_sid = _safe_session_id(session_id)
        session_dir = os.path.join(LOG_DIR, 'sessions', safe_sid)
        _append_jsonl(os.path.join(session_dir, 'scratch_events.jsonl'), data)
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': f'log error: {str(e)}'}), 500


@app.route('/api/log/study_start', methods=['POST'])
def log_study_start():
    """Persist the chosen study mode (1–4) and its concrete phase combination."""
    try:
        data = request.json or {}
        session_id = str(data.get('sessionId', '')).strip()
        if not session_id:
            return jsonify({'error': 'sessionId is required'}), 400

        safe_sid = _safe_session_id(session_id)
        session_dir = os.path.join(LOG_DIR, 'sessions', safe_sid)
        _append_jsonl(os.path.join(session_dir, 'events.jsonl'), {
            **data,
            'eventType': 'study_start',
        })
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': f'log error: {str(e)}'}), 500


@app.route('/api/log/quiz', methods=['POST'])
def log_quiz():
    """Persist a quiz submission (answers + score) for one phase."""
    try:
        data = request.json or {}
        session_id = str(data.get('sessionId', '')).strip()
        if not session_id:
            return jsonify({'error': 'sessionId is required'}), 400

        safe_sid = _safe_session_id(session_id)
        session_dir = os.path.join(LOG_DIR, 'sessions', safe_sid)
        _append_jsonl(os.path.join(session_dir, 'quiz_submissions.jsonl'), data)
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': f'log error: {str(e)}'}), 500


@app.route('/api/log/self_explanation_questions', methods=['POST'])
def log_self_explanation_questions():
    """Persist (but do not display) the preset self-explanation questions for Proof A/C."""
    try:
        data = request.json or {}
        proof_a = data.get('proofA', [])
        proof_c = data.get('proofC', [])

        if not isinstance(proof_a, list) or not isinstance(proof_c, list):
            return jsonify({'error': 'proofA and proofC must be arrays'}), 400

        payload = {
            'eventType': 'self_explanation_questions_export',
            'sessionId': (str(data.get('sessionId', '')).strip() or None),
            'proofA': proof_a,
            'proofC': proof_c,
        }

        # Append-only for audit.
        _append_jsonl(os.path.join(LOG_DIR, 'self_explanation_questions.jsonl'), payload)

        # Latest snapshot for convenience.
        _write_json_atomic(os.path.join(LOG_DIR, 'self_explanation_questions_latest.json'), payload)

        # Print to backend log for quick copy/paste.
        def _fmt(q):
            try:
                if isinstance(q, dict):
                    return str(q.get('text', q))
                return str(q)
            except Exception:
                return ''

        print('=== Self-Explanation Questions (export) ===', flush=True)
        print(f"Proof A: {len(proof_a)}", flush=True)
        for i, q in enumerate(proof_a, 1):
            print(f"A{i}. {_fmt(q)}", flush=True)
        print(f"Proof C: {len(proof_c)}", flush=True)
        for i, q in enumerate(proof_c, 1):
            print(f"C{i}. {_fmt(q)}", flush=True)
        print('=== End Self-Explanation Questions ===', flush=True)

        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': f'log error: {str(e)}'}), 500


# ==========================================
# Researcher tools: review mask positions
# ==========================================


@app.route('/api/review/sessions', methods=['GET'])
def review_list_sessions():
    """List available session ids for researcher review UI."""
    try:
        sessions_root = os.path.join(LOG_DIR, 'sessions')
        if not os.path.isdir(sessions_root):
            return jsonify({'sessions': []})

        sessions = []
        for name in os.listdir(sessions_root):
            path = os.path.join(sessions_root, name)
            if not os.path.isdir(path):
                continue
            # basic metadata for UI ordering
            newest = os.path.getmtime(path)
            for fn in os.listdir(path):
                fp = os.path.join(path, fn)
                try:
                    newest = max(newest, os.path.getmtime(fp))
                except FileNotFoundError:
                    pass
            sessions.append({'sessionId': name, 'lastModified': datetime.fromtimestamp(newest, timezone.utc).isoformat()})

        sessions.sort(key=lambda x: x.get('lastModified') or '', reverse=True)
        return jsonify({'sessions': sessions})
    except Exception as e:
        return jsonify({'error': f'review error: {str(e)}'}), 500


@app.route('/api/review/session/<session_id>/turns', methods=['GET'])
def review_get_turns(session_id):
    """Load dialogue turns for a session (for mask position checks)."""
    try:
        safe_sid = _safe_session_id(session_id)
        session_dir = os.path.join(LOG_DIR, 'sessions', safe_sid)
        turns_path = os.path.join(session_dir, 'dialogue_turns.jsonl')
        turns = _read_jsonl(turns_path)
        return jsonify({'sessionId': safe_sid, 'turns': turns})
    except Exception as e:
        return jsonify({'error': f'review error: {str(e)}'}), 500


@app.route('/api/review/session/<session_id>/reviews', methods=['GET'])
def review_get_reviews(session_id):
    """Load existing mask reviews for a session (for comparison across reviewers)."""
    try:
        safe_sid = _safe_session_id(session_id)
        latest_path = os.path.join(REVIEW_DIR, safe_sid, 'mask_reviews_latest.json')
        latest = _read_json(latest_path)

        # Back-compat: if latest store doesn't exist yet, fall back to jsonl.
        if not latest:
            reviews_path = os.path.join(REVIEW_DIR, safe_sid, 'mask_reviews.jsonl')
            reviews = _read_jsonl(reviews_path)
            return jsonify({'sessionId': safe_sid, 'reviews': reviews})

        # Flatten latest structure to a list of review records.
        out: list[dict] = []
        for reviewer_id, by_item in latest.items():
            if not isinstance(by_item, dict):
                continue
            for item_key, rec in by_item.items():
                if not isinstance(rec, dict):
                    continue
                r = dict(rec)
                r.setdefault('sessionId', safe_sid)
                r.setdefault('reviewerId', reviewer_id)
                r.setdefault('_key', item_key)
                out.append(r)

        return jsonify({'sessionId': safe_sid, 'reviews': out})
    except Exception as e:
        return jsonify({'error': f'review error: {str(e)}'}), 500


@app.route('/api/review/session/<session_id>/reviews', methods=['POST'])
def review_post_review(session_id):
    """Append one reviewer decision (agree/disagree) for one mask sentence (preferred) or one whole turn (legacy)."""
    try:
        safe_sid = _safe_session_id(session_id)
        data = request.json or {}

        reviewer_id = str(data.get('reviewerId', '')).strip()[:128]
        decision = str(data.get('decision', '')).strip().lower()
        turn_index = data.get('turnIndex', None)
        mask_index = data.get('maskIndex', None)
        masked_text = data.get('maskedText', None)

        if not reviewer_id:
            return jsonify({'error': 'reviewerId is required'}), 400
        if decision not in ('agree', 'disagree'):
            return jsonify({'error': 'decision must be agree or disagree'}), 400
        if turn_index is None:
            return jsonify({'error': 'turnIndex is required'}), 400

        # Sentence-level review is preferred. If maskIndex is provided, validate it.
        if mask_index is not None:
            try:
                mask_index = int(mask_index)
            except Exception:
                return jsonify({'error': 'maskIndex must be an integer'}), 400
            if mask_index < 0:
                return jsonify({'error': 'maskIndex must be >= 0'}), 400
        if masked_text is not None:
            masked_text = str(masked_text)

        payload = {
            'sessionId': safe_sid,
            'reviewerId': reviewer_id,
            'decision': decision,
            'turnIndex': turn_index,
            'maskIndex': mask_index,
            'maskedText': masked_text,
            # Optional metadata to simplify later analysis
            'proofId': data.get('proofId', None),
            'phaseIndex': data.get('phaseIndex', None),
            'conditionId': data.get('conditionId', None),
            'studyMode': data.get('studyMode', None),
            'interactive': data.get('interactive', None),
            'clientTs': data.get('clientTs', None) or datetime.now(timezone.utc).isoformat(),
        }

        # Upsert: keep ONLY ONE label per (reviewerId, turnIndex, maskIndex).
        # This makes per-sentence labels clean for analysis and allows updating.
        out_dir = os.path.join(REVIEW_DIR, safe_sid)
        os.makedirs(out_dir, exist_ok=True)

        latest_path = os.path.join(out_dir, 'mask_reviews_latest.json')
        latest = _read_json(latest_path)
        by_reviewer = latest.get(reviewer_id)
        if not isinstance(by_reviewer, dict):
            by_reviewer = {}

        item_key = f"{turn_index}::{'turn' if mask_index is None else str(mask_index)}"
        by_reviewer[item_key] = payload
        latest[reviewer_id] = by_reviewer
        _write_json_atomic(latest_path, latest)

        return jsonify({'status': 'ok', 'key': item_key})
    except Exception as e:
        return jsonify({'error': f'review error: {str(e)}'}), 500


# ==========================================
# Frontend static serving (single-port mode)
# ==========================================

@app.route('/', methods=['GET'])
def serve_index():
    return send_from_directory(APP_DIR, 'index.html')


@app.route('/index.html', methods=['GET'])
def serve_index_explicit():
    return send_from_directory(APP_DIR, 'index.html')


@app.route('/css/<path:filename>', methods=['GET'])
def serve_css(filename):
    return send_from_directory(os.path.join(APP_DIR, 'css'), filename)


@app.route('/js/<path:filename>', methods=['GET'])
def serve_js(filename):
    return send_from_directory(os.path.join(APP_DIR, 'js'), filename)


@app.route('/<path:filename>', methods=['GET'])
def serve_misc(filename):
    # Best-effort static file serving for other top-level assets.
    # Avoid overlapping with API routes.
    if filename.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(APP_DIR, filename)

if __name__ == '__main__':
    # Single-port mode: serve frontend + backend on the same port.
    # Default to 8000 so teammates only need to forward one port.
    port = int(os.getenv('PORT', 8000))

    # Flask debug/reloader can restart the process (changing PIDs). Make it configurable.
    # Default stays True to match existing behavior, but you can set FLASK_DEBUG=0 to disable.
    flask_debug_raw = os.getenv('FLASK_DEBUG', '1').strip().lower()
    flask_debug = flask_debug_raw not in ('0', 'false', 'no', 'off')

    app.run(host='0.0.0.0', port=port, debug=flask_debug)

