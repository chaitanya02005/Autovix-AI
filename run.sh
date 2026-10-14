#!/bin/bash
# Permanent fix for macOS Streamlit fork safety crashes
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

# Activate virtual environment
source venv/bin/activate

# Run Streamlit
streamlit run frontend/app.py
