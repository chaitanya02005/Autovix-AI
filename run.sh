#!/bin/bash
set -e

# Permanent fix for macOS fork safety crashes
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Activate virtual environment
source venv/bin/activate

echo "=========================================================="
echo " Starting Autovix (FastAPI Backend + React Frontend)"
echo "=========================================================="

# Start FastAPI backend on port 8000
echo "Starting FastAPI backend on http://127.0.0.1:8000..."
uvicorn backend.api:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Trap Ctrl+C (SIGINT) and exit signals to kill backend on exit
cleanup() {
    echo ""
    echo "Shutting down Autovix services..."
    kill $BACKEND_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start Vite React frontend on port 5173
echo "Starting React Vite frontend on http://127.0.0.1:5173..."
cd "$DIR/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
