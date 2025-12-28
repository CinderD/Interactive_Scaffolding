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

### 3. Start API Server

```bash
python api_server.py
```

The server runs on `http://localhost:5000` by default.

### 4. Open Frontend

Open `index.html` in a browser, or use a local server:

```bash
python -m http.server 8000
# Then visit http://localhost:8000/index.html
```

## Configuration

Edit `js/config.js` to change:
- API server URL
- Default responsibility level
- Responsibility threshold

Edit `api_server.py` to change:
- Azure OpenAI endpoint
- Deployment name
- API version

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

