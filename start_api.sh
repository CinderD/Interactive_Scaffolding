#!/bin/bash

# Start the Flask API server for Azure OpenAI integration

echo "Starting API server..."
echo "Make sure you have:"
echo "  1. Installed dependencies: pip install -r requirements.txt"
echo "  2. Authenticated with Azure: az login"
echo "  3. Or set AZURE_OPENAI_API_KEY environment variable"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONDA_ENV_PY="$PROJECT_PARENT_DIR/.conda-envs/interactive-scaffolding/bin/python"

if [ -x "$CONDA_ENV_PY" ]; then
	echo "Using conda env python: $CONDA_ENV_PY"
	"$CONDA_ENV_PY" "$SCRIPT_DIR/api_server.py"
else
	echo "Using system python: ${PYTHON:-python3}"
	"${PYTHON:-python3}" "$SCRIPT_DIR/api_server.py"
fi

