# Interactive Scaffolding Tutor

An intelligent tutoring system for mathematical proofs that uses adaptive scaffolding techniques based on the ICAP Framework and Transfer of Responsibility principles.

## Features

- **Adaptive Scaffolding**: LLM-powered responses that automatically select appropriate scaffolding means (Hinting, Explaining, Instructing, Modeling)
- **Interactive Learning**: "Scratch-off" interaction for revealing key concepts
- **Multiple Modes**: Interactive and Non-Interactive modes
- **Responsibility Slider**: Adjustable learning responsibility level
- **Self-Explanation Questions**: Guided questions based on self-explanation training
- **Comprehension Quiz**: 10-question assessment with export functionality
- **Real-time LLM Integration**: Uses Azure OpenAI API for dynamic responses

## Project Structure

```
interactive_scaffolding/
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # Custom styles
├── js/
│   ├── config.js          # Configuration and state
│   ├── data.js            # Preset questions and quiz data
│   ├── api.js             # API communication
│   ├── ui.js              # UI rendering functions
│   ├── interaction.js     # User interaction handlers
│   ├── quiz.js            # Quiz functionality
│   └── utils.js           # Utility functions
├── api_server.py          # Flask API server
├── requirements.txt       # Python dependencies
├── README_API.md          # API documentation
└── 运行指南.md            # Chinese setup guide
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Tip: using a virtual environment is recommended.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Azure Authentication

Choose one method:

**Option A: Azure CLI (Recommended)**
```bash
az login
```

**Option B: API Key**
```bash
export AZURE_OPENAI_API_KEY=your-api-key
```

You may also need these environment variables (see `.env.example`):
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- (optional) `AZURE_OPENAI_API_VERSION`

If you prefer using a `.env` file:

```bash
cp .env.example .env
# edit .env
```

### 3. Start API Server

Recommended (single-port mode; serves frontend + API on 8000):

```bash
bash start_all.sh
```

Stop:

```bash
bash stop_all.sh
```

Alternatively, run directly:

```bash
FLASK_DEBUG=0 PORT=8000 python api_server.py
```

### 4. Open Frontend

Open:
- `http://localhost:8000/index.html`

## Configuration

Edit `js/config.js` to change:
- API server URL
- Default responsibility level
- Responsibility threshold

Edit `api_server.py` to change:
- Azure OpenAI endpoint
- Deployment name
- API version

## Sharing / Collaborator Setup

For collaborators on another machine:

1) Clone and install:

```bash
git clone https://github.com/CinderD/Interactive_Scaffolding.git
cd Interactive_Scaffolding
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Configure Azure access:
- `az login` (recommended), OR set `AZURE_OPENAI_API_KEY`
- copy `.env.example` to `.env` and fill in `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT`

3) Start:

```bash
bash start_all.sh
```

4) Open in browser:
- local: `http://localhost:8000/index.html`
- remote: `http://<server-ip>:8000/index.html`

Note: remote access requires the server firewall/security group to allow inbound TCP 8000.

## Scaffolding Framework

### Scaffolding Means
- **Hinting**: Subtle guidance without direct answers
- **Explaining**: Clarify concepts and definitions
- **Instructing**: Break down into structured steps
- **Modeling**: Show worked examples

### Scaffolding Intentions
- **Cognitive**: Support understanding, reasoning, problem-solving
- **Metacognitive**: Support monitoring, planning, reflection
- **Affect**: Support engagement, motivation, emotion management

## API Response Format

```json
{
    "usesScaffolding": true,
    "scaffoldType": "hinting" | "explaining" | "instructing" | "modeling",
    "scaffoldIntent": "cognitive" | "metacognitive" | "affect",
    "responseText": "Response with <MASK>hidden content</MASK>",
    "maskedWords": ["word1", "phrase 2"]
}
```

## Development

The codebase is organized into modular JavaScript files:

- **config.js**: State management and configuration
- **data.js**: Static data (questions, quiz)
- **api.js**: API communication layer
- **ui.js**: DOM manipulation and rendering
- **interaction.js**: Event handlers and user interactions
- **quiz.js**: Quiz logic and export
- **utils.js**: Helper functions and initialization

## License

This project is for research and educational purposes.

## Acknowledgments

Based on the ICAP Framework and Transfer of Responsibility principles for adaptive scaffolding in educational technology.

