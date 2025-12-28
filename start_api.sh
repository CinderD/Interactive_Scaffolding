#!/bin/bash

# Start the Flask API server for Azure OpenAI integration

echo "Starting API server..."
echo "Make sure you have:"
echo "  1. Installed dependencies: pip install -r requirements.txt"
echo "  2. Authenticated with Azure: az login"
echo "  3. Or set AZURE_OPENAI_API_KEY environment variable"
echo ""

python api_server.py

