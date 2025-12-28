# Azure OpenAI API Integration

This project now uses a real Azure OpenAI API instead of preset responses.

## Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Azure Authentication

The API server supports multiple authentication methods:

**Option A: Azure CLI (Recommended for development)**
```bash
az login
```

**Option B: Managed Identity (For production/Azure deployments)**
- Automatically uses Managed Identity if available

**Option C: API Key (Fallback)**
- Set environment variable: `export AZURE_OPENAI_API_KEY=your-api-key`

### 3. Configure API Settings

Set environment variables (create a `.env` file or export them):

```bash
export AZURE_OPENAI_ENDPOINT="https://your-endpoint.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT="your-deployment-name"
export AZURE_OPENAI_API_VERSION="2024-10-21"
```

Or create a `.env` file (see `.env.example` for template):
```bash
cp .env.example .env
# Then edit .env with your actual values
```

### 4. Start the API Server

```bash
python api_server.py
```

The server will run on `http://localhost:5000` by default.

### 5. Update Frontend API URL (if needed)

If your API server runs on a different URL, edit `index.html`:
```javascript
const API_BASE_URL = 'http://localhost:5000'; // Change to your API server URL
```

## API Response Format

The API returns structured JSON responses:

```json
{
    "usesScaffolding": true,
    "scaffoldType": "hinting" | "explaining" | "instructing" | "modeling" | null,
    "scaffoldIntent": "cognitive" | "metacognitive" | "affect" | null,
    "responseText": "Response with <MASK>hidden content</MASK> tags",
    "maskedWords": ["word1", "phrase 2"]
}
```

### Scaffolding Types
- **hinting**: Subtle guidance without giving direct answers
- **explaining**: Clarify concepts and definitions
- **instructing**: Break down into structured steps
- **modeling**: Show worked examples

### Scaffolding Intentions
- **cognitive**: Support students' cognitive activities (understanding, reasoning, problem-solving)
- **metacognitive**: Support students' metacognitive activities (monitoring, planning, reflecting on learning)
- **affect**: Support student affect (engagement, motivation, emotion management)

## Features

1. **Real LLM Responses**: Uses Azure OpenAI GPT-5.1 to generate contextual responses
2. **Adaptive Scaffolding**: LLM decides when and how to use scaffolding based on the question
3. **Structured Output**: Responses include scaffolding type, intention, and masked content
4. **Free-form Questions**: Users can ask any question, not just preset ones
5. **Interactive Masking**: Key concepts are masked for active learning

## Troubleshooting

- **"API error"**: Check if the API server is running and accessible
- **Authentication errors**: Ensure Azure CLI is logged in or API key is set
- **CORS errors**: Make sure `flask-cors` is installed and CORS is enabled in the server
- **Connection refused**: Check the API_BASE_URL in `index.html` matches your server URL

