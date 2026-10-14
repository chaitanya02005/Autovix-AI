import os
os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"

import streamlit as st

# Load GROQ_API_KEY from Streamlit secrets if not already in environment
if not os.environ.get("GROQ_API_KEY"):
    try:
        os.environ["GROQ_API_KEY"] = st.secrets["GROQ_API_KEY"]
    except Exception:
        pass
from streamlit_option_menu import option_menu
import sys
from pathlib import Path
import json
import re

PROJECT_ROOT = Path(__file__).resolve().parent.parent

for folder in [PROJECT_ROOT, PROJECT_ROOT / "rag", PROJECT_ROOT / "ingestion", PROJECT_ROOT / "extraction", PROJECT_ROOT / "analysis", PROJECT_ROOT / "database"]:
    if str(folder) not in sys.path:
        sys.path.insert(0, str(folder))

from ingestion.document_processor import EMPTY_UPLOAD_MESSAGE, process_uploaded_pdf
from rag.rag_pipeline import retrieve_context
from rag.groq_client import generate_answer
from rag.grounding_guard import check_grounding
from database.audit_log import log_event, read_logs
from database.access_control import (
    AuthorizationError,
    can_compare,
    can_upload,
    create_project,
    delete_document,
    get_project_document,
    list_project_documents,
    list_user_projects,
    require_login,
    require_project_access,
)



# ---------------------------------------------------------
# Page configuration
# ---------------------------------------------------------

st.set_page_config(
    page_title="Autovix",
    page_icon="📘",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown(
    """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css');

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS  —  Monochrome / Black & White Theme
═══════════════════════════════════════════════════════════ */
:root {
    --primary:        #111111;
    --primary-dark:   #000000;
    --primary-light:  #F4F4F4;
    --sidebar-bg:     #0b1120;
    --bg:             #F8FAFC;
    --surface:        #FFFFFF;
    --ink:            #0f172a;
    --ink-light:      #334155;
    --muted:          #64748b;
    --muted-light:    #94a3b8;
    --border:         #e2e8f0;
    --border-strong:  #cbd5e1;
    --success:        #10b981;
    --success-bg:     #d1fae5;
    --warning:        #f59e0b;
    --warning-bg:     #fef3c7;
    --error:          #ef4444;
    --error-bg:       #fee2e2;
    --radius:         8px;
    --radius-lg:      12px;
    --shadow-sm:      0 1px 2px rgba(0,0,0,0.05);
    --shadow-card:    0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
    --space-1:  4px; --space-2:  8px; --space-3: 12px; --space-4: 16px;
    --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
    --space-12: 48px; --space-16: 64px;
}

/* ═══════════════════════════════════════════════════════════
   BASE & LAYOUT
═══════════════════════════════════════════════════════════ */
html, body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    color: var(--ink) !important;
    background-color: var(--bg) !important;
}
.stApp {
    background-color: var(--bg) !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    color: var(--ink) !important;
}
.stMarkdown, .stText, p, span, div, label { color: var(--ink); }
[data-testid="stSidebar"] *,
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span,
[data-testid="stSidebar"] div,
[data-testid="stSidebar"] label { color: inherit; }

.block-container {
    max-width: 1160px !important;
    padding: 2.5rem 3rem 3rem !important;
}
@media (max-width: 1024px) { .block-container { padding: 2rem !important; } }
@media (max-width: 768px)  { .block-container { padding: 1.25rem !important; } }
div[data-testid="stVerticalBlock"] { gap: 0.75rem !important; }

/* ═══════════════════════════════════════════════════════════
   STREAMLIT CHROME
═══════════════════════════════════════════════════════════ */
[data-testid="stToolbar"]               { display: none !important; }
header[data-testid="stHeader"]          { background: transparent !important; border-bottom: none !important; }
[data-testid="stSidebarCollapseButton"] { display: none !important; }
[data-testid="collapsedControl"]        { display: none !important; }

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] {
    background-color: var(--sidebar-bg) !important;
    background-image: radial-gradient(circle at bottom left, #1e3a8a 0%, transparent 40%);
    min-width: 260px !important;
    max-width: 260px !important;
    border-right: 1px solid #1e293b !important;
    transform: none !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: relative !important;
}
[data-testid="stSidebar"] > div:first-child {
    background-color: transparent !important;
    padding-top: 0 !important;
    padding-bottom: 48px !important;
}
[data-testid="stSidebar"] iframe              { background-color: #0C0C0C !important; }
[data-testid="stSidebarNav"]                  { display: none !important; }
[data-testid="stSidebar"] [data-testid="stElementToolbar"] { display: none !important; }
[data-testid="stSidebar"] div[data-testid="stVerticalBlock"] { gap: 0 !important; }

.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 22px 18px 18px;
    border-bottom: 1px solid #1C1C1C;
    margin-bottom: 4px;
}
.sidebar-logo-icon {
    background: #FFFFFF;
    color: #111111;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
}
.sidebar-logo-text { font-weight: 700; font-size: 13px; color: #E8E8E8 !important; line-height: 1.2; }
.sidebar-logo-sub  { font-size: 10px; color: #555555 !important; line-height: 1.4; margin-top: 1px; }

.sidebar-status {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid #1e293b;
    background: var(--sidebar-bg);
}
.status-dot    { width: 8px; height: 8px; background: #10b981; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
.status-text   { font-size: 12px; font-weight: 500; color: #cbd5e1 !important; }
.status-version { font-size: 11px; color: #64748b !important; margin-left: auto; font-family: 'Inter', monospace; }

/* ═══════════════════════════════════════════════════════════
   TYPOGRAPHY
═══════════════════════════════════════════════════════════ */
h1 {
    font-size: 24px !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    margin-bottom: 4px !important;
    letter-spacing: -0.4px;
    line-height: 1.25 !important;
}
h2 {
    font-size: 18px !important;
    font-weight: 600 !important;
    color: var(--ink) !important;
    margin-bottom: 4px !important;
    letter-spacing: -0.2px;
    line-height: 1.3 !important;
}
h3 {
    font-size: 14px !important;
    font-weight: 600 !important;
    color: var(--ink) !important;
    margin-bottom: 4px !important;
    line-height: 1.4 !important;
}
p  { font-size: 14px !important; color: var(--muted) !important; margin-bottom: 0 !important; line-height: 1.6 !important; }

.pg-title    { font-size: 21px; font-weight: 700; color: var(--ink); letter-spacing: -0.3px; line-height: 1.25; margin: 0 0 4px; }
.pg-subtitle { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0; }
.sec-title   { font-size: 13px; font-weight: 600; color: var(--ink); margin: 0 0 12px; }
.label-xs    { font-size: 10px; font-weight: 600; color: var(--muted-light); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }

/* ═══════════════════════════════════════════════════════════
   PAGE HEADER
═══════════════════════════════════════════════════════════ */
.page-header {
    margin-bottom: var(--space-8);
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--border);
}
.page-header h1 { color: var(--ink) !important; }
.page-header p  { color: var(--muted) !important; font-size: 14px !important; margin-top: 5px !important; max-width: 540px; }

/* ═══════════════════════════════════════════════════════════
   CARDS
═══════════════════════════════════════════════════════════ */
.card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    box-shadow: var(--shadow-card);
}
.stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-card);
    display: flex;
    align-items: center;
    gap: 20px;
}
.stat-card-inner { display: flex; align-items: center; gap: 20px; width: 100%; }
.stat-icon-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
}
.stat-icon-blue   { background: #eff6ff; color: #3b82f6; }
.stat-icon-green  { background: #ecfdf5; color: #10b981; }
.stat-icon-purple { background: #f3e8ff; color: #8b5cf6; }
.stat-icon-orange { background: #fff7ed; color: #f59e0b; }
.stat-text-col { display: flex; flex-direction: column; gap: 2px; }
.stat-number { font-size: 28px; font-weight: 700; color: var(--ink); line-height: 1; letter-spacing: -0.5px; }
.stat-label  { font-size: 14px; color: var(--ink-light); font-weight: 600; }
.stat-sub    { font-size: 13px; color: var(--muted); }
.stat-card-highlight { background: #FFFFFF; }

.set-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    box-shadow: var(--shadow-card);
}
.set-card-hdr {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted-light);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 16px;
}

/* ═══════════════════════════════════════════════════════════
   STATUS PILLS
═══════════════════════════════════════════════════════════ */
.status-pill { padding: 3px 9px; border-radius: 9999px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
.status-ready      { background: #F0F0F0; color: #333333; }
.status-processing { background: #F5F5F5; color: #555555; }
.status-failed     { background: var(--error-bg); color: var(--error); }

/* ═══════════════════════════════════════════════════════════
   BUTTONS
═══════════════════════════════════════════════════════════ */
.stButton > button,
.stFormSubmitButton > button,
.stDownloadButton > button {
    border-radius: var(--radius) !important;
    font-weight: 500 !important;
    font-size: 13px !important;
    font-family: 'Inter', -apple-system, sans-serif !important;
    transition: background-color 0.12s ease, border-color 0.12s ease !important;
    height: 38px !important;
    min-height: 38px !important;
    padding: 0 16px !important;
    border: 1px solid var(--border-strong) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    box-shadow: none !important;
    background-color: var(--surface) !important;
    color: var(--ink) !important;
    white-space: nowrap !important;
    line-height: 1 !important;
}
.stButton > button:hover,
.stDownloadButton > button:hover {
    background-color: #F0F0F0 !important;
    border-color: #BBBBBB !important;
    box-shadow: none !important;
}
.stButton > button[kind="primary"],
.stFormSubmitButton > button[kind="primary"],
.stDownloadButton > button[kind="primary"] {
    background-color: #111111 !important;
    color: #FFFFFF !important;
    border-color: #111111 !important;
    box-shadow: none !important;
}
.stButton > button[kind="primary"] *,
.stFormSubmitButton > button[kind="primary"] * { color: #FFFFFF !important; }
.stButton > button[kind="primary"]:hover,
.stDownloadButton > button[kind="primary"]:hover {
    background-color: #2A2A2A !important;
    border-color: #2A2A2A !important;
}
.stButton > button:active,
.stDownloadButton > button:active { transform: translateY(1px) !important; box-shadow: none !important; }
[data-testid="stFormSubmitButton"] > button { width: 100% !important; margin-top: 12px !important; }
.stDownloadButton > button { background-color: var(--surface) !important; color: var(--ink) !important; }

/* ── Sidebar nav — MUST come after global button rules ── */
/* Wrapper: each nav row is a position:relative container */
[data-testid="stSidebar"] div[data-testid="stVerticalBlock"]
    > div.element-container {
    margin: 0 !important;
    padding: 0 !important;
}
/* The markdown div that holds our HTML nav row */
[data-testid="stSidebar"] div[data-testid="stMarkdownContainer"] {
    margin: 0 !important;
    padding: 0 !important;
    line-height: 0 !important;
    font-size: 0 !important;
}
/* Collapse the stButton wrapper to zero height and pull it up by 36px */
[data-testid="stSidebar"] .stButton {
    height: 0 !important;
    min-height: 0 !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
}
/* The actual button: full 36px height, lifted 36px to sit over the HTML row */
[data-testid="stSidebar"] .stButton > button {
    width: 100% !important;
    height: 36px !important;
    min-height: 36px !important;
    max-height: 36px !important;
    position: relative !important;
    top: -36px !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 5px !important;
    background: transparent !important;
    background-color: transparent !important;
    color: transparent !important;
    font-size: 0 !important;
    box-shadow: none !important;
    cursor: pointer !important;
    opacity: 0 !important;
    z-index: 10 !important;
    transform: none !important;
    transition: none !important;
}
[data-testid="stSidebar"] .stButton > button:hover,
[data-testid="stSidebar"] .stButton > button:active,
[data-testid="stSidebar"] .stButton > button:focus,
[data-testid="stSidebar"] .stButton > button[kind="primary"],
[data-testid="stSidebar"] .stButton > button[kind="primary"]:hover {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: transparent !important;
    transform: none !important;
    outline: none !important;
    opacity: 0 !important;
}

/* ═══════════════════════════════════════════════════════════
   INPUTS & SELECTS
═══════════════════════════════════════════════════════════ */
.stTextInput input,
.stTextArea textarea,
.stNumberInput input,
.stPasswordInput input {
    border-radius: var(--radius) !important;
    border: 1px solid var(--border-strong) !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    color: var(--ink) !important;
    background: #FFFFFF !important;
    padding: 9px 12px !important;
    box-shadow: none !important;
    transition: border-color 0.12s ease !important;
    height: 38px !important;
}
.stTextArea textarea { height: auto !important; padding: 10px 12px !important; }
.stTextInput input:focus,
.stTextArea textarea:focus,
.stNumberInput input:focus,
.stPasswordInput input:focus {
    border-color: #111111 !important;
    box-shadow: 0 0 0 2px rgba(0,0,0,0.08) !important;
    outline: none !important;
}
.stSelectbox > div > div {
    border-radius: var(--radius) !important;
    border: 1px solid var(--border-strong) !important;
    font-size: 14px !important;
    color: var(--ink) !important;
    min-height: 38px !important;
    box-shadow: none !important;
}
.stTextInput label,
.stTextArea label,
.stSelectbox label,
.stNumberInput label,
.stFileUploader label {
    font-size: 12px !important;
    font-weight: 500 !important;
    color: var(--ink-light) !important;
    margin-bottom: 5px !important;
}

/* ═══════════════════════════════════════════════════════════
   PROFILE POPOVER
═══════════════════════════════════════════════════════════ */
.stPopover > button {
    height: 36px !important;
    border-radius: 9999px !important;
    padding: 0 14px !important;
    border: 1px solid var(--border-strong) !important;
    background-color: var(--surface) !important;
    font-weight: 500 !important;
    font-size: 13px !important;
    box-shadow: none !important;
    white-space: nowrap !important;
}
.stPopover > button p { color: var(--ink) !important; font-weight: 500 !important; margin: 0 !important; font-size: 13px !important; }
.stPopover > button:hover { background-color: #F0F0F0 !important; }

/* ═══════════════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════════════ */
.stTabs [data-baseweb="tab-list"] { gap: 0; border-bottom: 1px solid var(--border); background: transparent; }
.stTabs [data-baseweb="tab"] {
    height: 42px;
    background-color: transparent !important;
    border-radius: 0 !important;
    color: var(--muted) !important;
    font-weight: 500 !important;
    font-size: 13px !important;
    padding: 0 18px !important;
    border-bottom: 2px solid transparent !important;
    margin-bottom: -1px;
}
.stTabs [data-baseweb="tab"]:hover { color: var(--ink-light) !important; background-color: transparent !important; }
.stTabs [aria-selected="true"] {
    color: var(--ink) !important;
    border-bottom: 2px solid var(--ink) !important;
    font-weight: 600 !important;
    background-color: transparent !important;
}
.stTabs [data-baseweb="tab-highlight"] { display: none !important; }

/* ═══════════════════════════════════════════════════════════
   EXPANDER
═══════════════════════════════════════════════════════════ */
.stExpander { border: 1px solid var(--border) !important; border-radius: var(--radius-lg) !important; box-shadow: none !important; }
.stExpander summary { font-size: 13px !important; font-weight: 500 !important; color: var(--ink) !important; padding: 12px 18px !important; }

/* ALERTS */
.stAlert { border-radius: var(--radius-lg) !important; font-size: 13px !important; }

/* ═══════════════════════════════════════════════════════════
   LINKS
═══════════════════════════════════════════════════════════ */
a { text-decoration: none !important; color: var(--ink) !important; }
a:hover { text-decoration: underline !important; color: var(--ink-light) !important; }

/* ═══════════════════════════════════════════════════════════
   EMPTY STATES
═══════════════════════════════════════════════════════════ */
.empty-state {
    text-align: center;
    padding: var(--space-16) var(--space-6);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    background: #FAFAFA;
    margin: var(--space-6) 0;
}
.empty-state-icon  { font-size: 28px; color: #CCCCCC; display: block; margin-bottom: 12px; }
.empty-state-title { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 5px; }
.empty-state-desc  { font-size: 13px; color: var(--muted); }

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.section-title  { font-size: 14px; font-weight: 600; color: var(--ink); margin: 0; }
.section-link   { font-size: 12px; color: var(--ink-light); font-weight: 500; cursor: pointer; }
.divider        { height: 1px; background: var(--border); margin: var(--space-8) 0; }
.meta-text      { font-size: 13px; color: var(--muted); }
.meta-text strong { color: var(--ink); font-weight: 600; }

@media (max-width: 768px) {
    .stat-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .stat-grid-3 { grid-template-columns: repeat(1, 1fr) !important; }
}
</style>
    """, unsafe_allow_html=True
)



# ---------------------------------------------------------
# Authentication and project scope
# ---------------------------------------------------------

for key, default in {
    "current_user": None,
    "current_user_id": None,
    "current_project_id": None,
    "current_project_name": None,
    "current_role": None,
    "document_ready": False,
    "document_info": None,
    "last_answer": None,
    "comparison_result": None,
}.items():
    if key not in st.session_state:
        st.session_state[key] = default

# --- Ensure DB and workspace are initialized without login barrier ---
from database.access_control import bootstrap_admin, init_db, DATABASE_PATH, require_login
init_db()

import sqlite3 as _sqlite3
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
_conn = _sqlite3.connect(str(DATABASE_PATH))
_user_row = _conn.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1").fetchone()
_conn.close()

if not _user_row:
    res = bootstrap_admin("admin", "admin123456789", "AUTOSAR Demo")
    admin_user_id = res["user_id"]
else:
    admin_user_id = _user_row[0]

current_user = require_login(admin_user_id)
st.session_state.current_user_id = admin_user_id
st.session_state.current_user = current_user

projects = list_user_projects(current_user["id"])
if not projects:
    new_proj = create_project(current_user["id"], "AUTOSAR Demo")
    projects = [new_proj]

project_ids = [project["id"] for project in projects]
if st.session_state.current_project_id not in project_ids:
    st.session_state.current_project_id = project_ids[0]
if st.session_state.get("project_selector") not in project_ids:
    st.session_state.project_selector = st.session_state.current_project_id

project = require_project_access(current_user["id"], st.session_state.current_project_id)
st.session_state.current_project_id = project["id"]
st.session_state.current_project_name = project["name"]
st.session_state.current_role = project["role"]

project_documents = list_project_documents(current_user["id"], project["id"])
if project_documents:
    latest_document = project_documents[0]
    if (
        not st.session_state.document_info
        or st.session_state.document_info.get("project_id") != project["id"]
        or st.session_state.document_info.get("document_id") != latest_document["document_id"]
    ):
        latest_document = get_project_document(
            current_user["id"], project["id"], latest_document["document_id"]
        )
        artifact_dir = Path(latest_document["artifact_dir"]) if latest_document.get("artifact_dir") else None
        chunks_file = (artifact_dir / "chunks.json") if artifact_dir else None
        chunk_data = []
        if chunks_file and chunks_file.exists():
            with chunks_file.open("r", encoding="utf-8") as file:
                chunk_data = json.load(file)
        st.session_state.document_info = {
            "filename": latest_document["filename"],
            "document_id": latest_document["document_id"],
            "project_id": project["id"],
            "version": latest_document["version"],
            "pages": latest_document["page_count"],
            "chunks": latest_document["chunk_count"],
            "traceability_records": latest_document["traceability_count"],
            "relationship_records": 0,
            "collection_name": latest_document["collection_name"],
            "artifact_dir": str(artifact_dir) if artifact_dir else "",
            "traceability_path": str(artifact_dir / "traceability.json") if artifact_dir else "",
            "pages_path": str(artifact_dir / "pages.json") if artifact_dir else "",
            "relationship_path": str(artifact_dir / "relationships.json") if artifact_dir else "",
            "chunk_data": chunk_data,
        }
        if st.session_state.document_info["relationship_path"] and Path(st.session_state.document_info["relationship_path"]).exists():
            with open(st.session_state.document_info["relationship_path"], "r", encoding="utf-8") as file:
                st.session_state.document_info["relationship_records"] = len(json.load(file))
        st.session_state.document_ready = True
else:
    st.session_state.document_info = None
    st.session_state.document_ready = False


# ---------------------------------------------------------
# Navigation
# ---------------------------------------------------------
_nav_tabs = ["Dashboard", "Documents", "Ask AI", "Relationships", "Compare Versions", "Settings"]
_default_tab = "Dashboard"

if "selected_tab" not in st.session_state:
    st.session_state.selected_tab = _default_tab
elif st.session_state.selected_tab not in _nav_tabs:
    st.session_state.selected_tab = _default_tab

def _set_tab(t):
    st.session_state.selected_tab = t

selected_tab = st.session_state.selected_tab

# ---------------------------------------------------------
# Sidebar
# ---------------------------------------------------------
with st.sidebar:

    # ── Brand ─────────────────────────────────────────────
    st.markdown('''
    <div style="display:flex;align-items:center;gap:12px;padding:24px 20px 20px;border-bottom:1px solid #1e293b;margin-bottom:12px;">
        <div style="background:#FFFFFF;color:#0b1120;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0;font-family:'Inter',sans-serif;">A</div>
        <div style="display:flex; flex-direction:column; justify-content:center; gap:2px;">
            <div style="font-size:15px;font-weight:700;color:#f8fafc;line-height:1.2;font-family:'Inter',sans-serif;">Autovix</div>
            <div style="font-size:11px;color:#94a3b8;line-height:1.2;margin:0;font-family:'Inter',sans-serif;">AUTOSAR Intelligence</div>
        </div>
    </div>
    ''', unsafe_allow_html=True)

    # ── Nav items ─────────────────────────────────────────
    _nav_labels = ["Dashboard", "Documents", "Ask AI", "Relationships", "Compare Versions", "Settings"]
    _nav_icons = ["house", "file-earmark-text", "chat-dots", "share", "arrow-left-right", "gear"]

    new_tab = option_menu(
        menu_title=None,
        options=_nav_labels,
        icons=_nav_icons,
        default_index=_nav_labels.index(selected_tab),
        styles={
            "container": {
                "padding": "0 12px!important", 
                "background-color": "#0b1120!important",
                "border-radius": "0!important",
                "border": "none"
            },
            "icon": {
                "color": "#94a3b8", 
                "font-size": "16px"
            },
            "nav-link": {
                "font-size": "14px", 
                "text-align": "left", 
                "margin": "4px 0px", 
                "padding": "10px 16px",
                "color": "#cbd5e1", 
                "font-family": "'Inter',sans-serif",
                "border-radius": "8px",
                "border-left": "3px solid transparent",
            },
            "nav-link-selected": {
                "background-color": "#1e3a8a!important", 
                "color": "#FFFFFF", 
                "border-left": "3px solid #3b82f6", 
                "font-weight": "600"
            },
        }
    )

    if new_tab != selected_tab:
        st.session_state.selected_tab = new_tab
        st.rerun()




# ─────────────────────────────────────────────────────────
if selected_tab == 'Dashboard':
    st.markdown('''
    <div class="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your AUTOSAR documents and architecture analysis</p>
    </div>
    ''', unsafe_allow_html=True)


    # Data collection for stats
    info = st.session_state.document_info if st.session_state.document_ready else {}
    _project_docs = list_project_documents(current_user["id"], project["id"])
    _num_docs = len(_project_docs) if _project_docs else 0
    _entities_count = info.get("traceability_records", 0) if info else 0
    _relationships_count = info.get("relationship_records", 0) if info else 0
    _logs = read_logs(user_id=current_user["id"], project_id=project["id"], limit=100)
    _questions_count = len([l for l in _logs if l.get("event_type") == "QUESTION_ASKED"])

    # ── 4-column stat cards ──
    st.markdown(f'''
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-bottom:32px;" class="stat-grid-4">
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon-wrapper stat-icon-blue"><i class="bi bi-file-earmark-text-fill"></i></div>
                <div class="stat-text-col">
                    <div class="stat-number">{_num_docs}</div>
                    <div class="stat-label">Documents</div>
                    <div class="stat-sub">{_num_docs} processed</div>
                </div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon-wrapper stat-icon-purple"><i class="bi bi-box-seam-fill"></i></div>
                <div class="stat-text-col">
                    <div class="stat-number">{_entities_count:,}</div>
                    <div class="stat-label">Entities</div>
                    <div class="stat-sub">From active document</div>
                </div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon-wrapper stat-icon-green"><i class="bi bi-share-fill"></i></div>
                <div class="stat-text-col">
                    <div class="stat-number">{_relationships_count:,}</div>
                    <div class="stat-label">Relationships</div>
                    <div class="stat-sub">From active document</div>
                </div>
            </div>
        </div>
        <div class="stat-card stat-card-highlight">
            <div class="stat-card-inner">
                <div class="stat-icon-wrapper stat-icon-orange"><i class="bi bi-chat-dots-fill"></i></div>
                <div class="stat-text-col">
                    <div class="stat-number">{_questions_count}</div>
                    <div class="stat-label">Questions</div>
                    <div class="stat-sub">This session</div>
                </div>
            </div>
        </div>
    </div>
    ''', unsafe_allow_html=True)

    # ── Bottom row: Current Document + Recent Activity ──
    dash_col1, dash_col2 = st.columns([1.5, 1], gap="large")

    with dash_col1:
        st.markdown('<div class="sec-title" style="font-size:16px;">Current Document</div>', unsafe_allow_html=True)
        if st.session_state.document_ready:
            st.markdown(f'''
            <div class="card" style="padding:24px; padding-bottom:12px;">
                <div style="display:flex; align-items:flex-start; gap:20px; margin-bottom:20px;">
                    <div style="background:#f1f5f9; color:#475569; width:64px; height:80px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:32px; flex-shrink:0;">
                        <i class="bi bi-file-earmark-text-fill"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                            <span style="font-size:18px; font-weight:700; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:400px;">{info.get("filename", "Unknown Document")}</span>
                            <span style="background:#e2e8f0; color:#334155; padding:4px 10px; border-radius:6px; font-size:13px; font-weight:700; flex-shrink:0;">{info.get("version", "1")}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                            <span style="font-size:14px; color:var(--muted);">Status:</span>
                            <span style="background:#d1fae5; color:#059669; padding:4px 12px; border-radius:99px; font-size:13px; font-weight:600;">Processed</span>
                        </div>
                        <div style="font-size:14px; color:var(--muted);">
                            Pages: <span style="color:var(--ink); font-weight:600;">{info.get("pages", 0):,}</span>
                            &nbsp;&middot;&nbsp;
                            Chunks: <span style="color:var(--ink); font-weight:600;">{info.get("chunks", 0):,}</span>
                        </div>
                    </div>
                </div>
            ''', unsafe_allow_html=True)
            st.markdown('<style>div.stButton > button { height: 44px !important; font-size: 14px !important; font-weight: 600 !important; border-radius: 8px !important; background-color: #1e293b !important; border: none !important; }</style>', unsafe_allow_html=True)
            if st.button("View Document Details", type="primary", key="view_current_doc", use_container_width=True):
                st.session_state.selected_tab = 'Documents'
                st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)
        else:
            st.markdown('''
            <div class="empty-state" style="min-height:140px; padding:32px 16px; margin:0;">
                <i class="bi bi-file-earmark-plus empty-state-icon" style="font-size:24px;"></i>
                <div class="empty-state-title" style="font-size:13px;">No active document</div>
                <div class="empty-state-desc" style="font-size:12px;">Upload an AUTOSAR PDF to get started</div>
            </div>
            ''', unsafe_allow_html=True)

    with dash_col2:
        _top_c1, _top_c2 = st.columns([1.5, 1])
        with _top_c1:
            st.markdown('<div class="sec-title" style="margin:0; font-size:16px;">Recent Activity</div>', unsafe_allow_html=True)
        with _top_c2:
            _rc1, _rc2 = st.columns(2)
            with _rc1:
                if st.button("↻", key="dash_refresh_btn", help="Refresh activity logs"):
                    st.rerun()
            with _rc2:
                if st.button("All Logs", key="dash_view_all_btn", help="View all audit logs in Settings"):
                    st.session_state.selected_tab = "Settings"
                    st.rerun()

        def time_ago(ts):
            import datetime
            try:
                dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
                now = datetime.datetime.now(datetime.timezone.utc)
                diff = now - dt
                if diff.total_seconds() < 60: return "Just now"
                if diff.total_seconds() < 3600: return f"{int(diff.total_seconds()//60)} mins ago"
                if diff.total_seconds() < 86400: return f"{int(diff.total_seconds()//3600)} hours ago"
                return dt.strftime("%b %d")
            except:
                return "recently"

        _icon_map = {
            "DOCUMENT_PROCESSED": "bi-file-earmark-check-fill",
            "DOCUMENT_UPLOADED":  "bi-cloud-arrow-up-fill",
            "QUESTION_ASKED":     "bi-chat-dots-fill",
            "COMPARISON_RUN":     "bi-arrow-left-right",
            "LOGIN":              "bi-person-circle",
            "LOGOUT":             "bi-box-arrow-right",
            "SEARCH":             "bi-search",
            "PROJECT_CREATED":    "bi-folder-plus",
            "DOCUMENT_DELETED":   "bi-trash-fill",
        }

        activity_html = '<div class="card" style="padding:24px; display:flex; flex-direction:column; gap:20px;">'
        if _logs:
            for log in _logs[:6]:
                evt = log.get("event_type", "")
                icon = _icon_map.get(evt, "bi-circle-fill")
                
                title = ""
                subtitle = ""
                
                if evt == "QUESTION_ASKED" and log.get("question"):
                    q = log["question"]
                    title = f'Question: "{q[:35]}..."' if len(q) > 35 else f'Question: "{q}"'
                    subtitle = "Question Asked"
                elif evt in ("DOCUMENT_PROCESSED", "DOCUMENT_UPLOADED", "DOCUMENT_DELETED"):
                    doc_name = log.get("document_name") or "Unknown Document"
                    version = log.get("details", {}).get("version", "1")
                    title = f"{doc_name} [{version}]"
                    if evt == "DOCUMENT_PROCESSED": subtitle = "Document processed successfully"
                    elif evt == "DOCUMENT_UPLOADED": subtitle = "Document uploaded"
                    else: subtitle = "Document deleted"
                elif evt == "COMPARISON_RUN":
                    title = "Comparison completed"
                    subtitle = "Documents compared"
                elif evt == "LOGIN":
                    title = "System Session"
                    subtitle = "Session active"
                elif evt == "LOGOUT":
                    title = "System Session"
                    subtitle = "Session closed"
                elif evt == "SEARCH":
                    target = log.get("details", {}).get("target", "documents")
                    q = log.get("question") or log.get("details", {}).get("query", "query")
                    title = f'Search: "{q[:30]}..."' if len(q) > 30 else f'Search: "{q}"'
                    subtitle = f"Filtered {target}"
                elif evt == "PROJECT_CREATED":
                    title = "New Workspace"
                    subtitle = "Workspace created"
                else:
                    title = evt.replace("_", " ").title()
                    subtitle = "System event"

                activity_html += f'''
<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
    <div style="display:flex; align-items:flex-start; gap:16px;">
        <div style="width:32px; height:32px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="bi {icon}" style="color:#64748b; font-size:14px;"></i>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; padding-top:2px;">
            <span style="font-size:14px; color:var(--ink); font-weight:600; line-height:1.2; word-break:break-word;">{title}</span>
            <span style="font-size:13px; color:var(--muted); line-height:1.2;">{subtitle}</span>
        </div>
    </div>
    <span style="font-size:12px; color:var(--muted); white-space:nowrap; flex-shrink:0; padding-top:2px;">{time_ago(log["timestamp"])}</span>
</div>
'''
        else:
            activity_html += '<div style="text-align:center; padding:20px 0; color:var(--muted); font-size:14px;">No recent activity.</div>'
        activity_html += '</div>'
        st.markdown(activity_html, unsafe_allow_html=True)


elif selected_tab == 'Documents':
    _project_docs = list_project_documents(current_user["id"], project["id"])
    _num_docs = len(_project_docs) if _project_docs else 0

    # ── Page Header ────────────────────────────────────────
    st.markdown('''
    <div class="page-header">
        <h1>Documents</h1>
        <p>Upload, process and manage your AUTOSAR architecture documents</p>
    </div>
    ''', unsafe_allow_html=True)

    # ── Two-column layout: Upload on left, Info on right ───
    upload_col, info_col = st.columns([1.6, 1], gap="large")

    with upload_col:
        st.markdown('<div class="label-xs">Upload Document</div>', unsafe_allow_html=True)

        if can_upload(current_user["id"], project["id"]):
            # Always-visible upload zone
            with st.container(border=True):
                st.markdown('''
                <div style="text-align:center; padding:12px 0 8px;">
                    <div style="font-size:36px; color:#222222; margin-bottom:8px;">
                        <i class="bi bi-cloud-arrow-up-fill"></i>
                    </div>
                    <div style="font-size:14px; font-weight:600; color:var(--ink); margin-bottom:4px;">
                        Upload AUTOSAR PDF Document
                    </div>
                    <div style="font-size:12px; color:var(--muted);">
                        Drag and drop your PDF file here, or click to browse
                    </div>
                </div>
                ''', unsafe_allow_html=True)

                uploaded_file = st.file_uploader(
                    "Choose PDF",
                    type=["pdf"],
                    key=f"doc_uploader_{project['id']}",
                    label_visibility="collapsed",
                )

                if uploaded_file is not None:
                    st.markdown(f'''
                    <div style="background:#F2F2F2; border:1px solid #E0E0E0; border-radius:8px; padding:10px 14px; margin:8px 0; display:flex; align-items:center; gap:10px;">
                        <i class="bi bi-file-earmark-pdf-fill" style="color:#222222; font-size:18px;"></i>
                        <div>
                            <div style="font-size:13px; font-weight:600; color:#111111;">{uploaded_file.name}</div>
                            <div style="font-size:11px; color:#333333;">{round(uploaded_file.size/1024, 1)} KB</div>
                        </div>
                    </div>
                    ''', unsafe_allow_html=True)
                    if st.button("⚙ Process Document", type="primary", key="process_doc_btn", use_container_width=True):
                        with st.spinner("Processing AUTOSAR document… This may take a few minutes."):
                            try:
                                document_info = process_uploaded_pdf(
                                    uploaded_file,
                                    user_id=current_user["id"],
                                    project_id=project["id"],
                                )
                                st.session_state.document_ready = True
                                st.session_state.document_info = document_info
                                log_event(
                                    "DOCUMENT_UPLOADED",
                                    document_name=uploaded_file.name,
                                    status="success",
                                    details={"version": document_info.get("version"), "pages": document_info.get("pages")},
                                    user_id=current_user["id"],
                                    username=current_user["username"],
                                    project_id=project["id"],
                                    document_id=document_info.get("document_id"),
                                )
                                st.success(f"✅ '{uploaded_file.name}' processed successfully!")
                                st.rerun()
                            except Exception as e:
                                st.session_state.document_ready = False
                                log_event(
                                    "DOCUMENT_UPLOAD", document_name=getattr(uploaded_file, "name", "unknown"),
                                    status="error", details={"error": str(e)},
                                    user_id=current_user["id"], username=current_user["username"],
                                    project_id=project["id"],
                                )
                                import traceback; traceback.print_exc()
                                st.error(EMPTY_UPLOAD_MESSAGE if str(e) == EMPTY_UPLOAD_MESSAGE else f"❌ Processing failed: {e}")
        else:
            st.info("You don't have permission to upload documents in this project.")

    with info_col:
        _proc_steps = [
            ("#222222", "Upload PDF"),
            ("#444444", "Extract content from PDF"),
            ("#666666", "Generate embeddings"),
            ("#888888", "Extract architecture entities"),
            ("#AAAAAA", "Build knowledge base"),
        ]
        _rows = ""
        for _idx, (_col, _lbl) in enumerate(_proc_steps, 1):
            _bdr = "border-bottom:1px solid #EFEFEF;" if _idx < len(_proc_steps) else ""
            _rows += (
                f'<div style="display:flex;align-items:center;gap:12px;padding:9px 0;{_bdr}">'
                f'<div style="min-width:24px;height:24px;border-radius:50%;background:{_col};'
                f'color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;'
                f'justify-content:center;">{_idx}</div>'
                f'<span style="font-size:13px;color:#333333;">{_lbl}</span></div>'
            )
        st.markdown(
            f'<div class="card"><div class="label-xs" style="margin-bottom:12px;">Processing Steps</div>{_rows}</div>',
            unsafe_allow_html=True
        )

    # ── Uploaded Documents Table ──────────────────────────
    st.markdown('<div style="height:8px;"></div>', unsafe_allow_html=True)
    st.markdown('<div class="sec-title">Uploaded Documents</div>', unsafe_allow_html=True)

    # Search bar
    _search = st.text_input("Search documents", placeholder="Search by filename…", key="doc_search_query", label_visibility="collapsed")
    if _search and _search.strip():
        if _search.strip() != st.session_state.get("last_logged_doc_search"):
            st.session_state.last_logged_doc_search = _search.strip()
            log_event(
                "SEARCH",
                question=_search.strip(),
                status="success",
                user_id=current_user["id"],
                username=current_user["username"],
                project_id=project["id"],
                details={"target": "documents", "query": _search.strip()},
            )

    if _project_docs:
        # Deduplicate — keep latest version per filename
        _doc_map = {}
        for d in _project_docs:
            if d["filename"] not in _doc_map or d["version"] > _doc_map[d["filename"]]["version"]:
                _doc_map[d["filename"]] = d
        _unique_docs = list(_doc_map.values())

        # Filter by search
        if _search:
            _unique_docs = [d for d in _unique_docs if _search.lower() in d.get("filename", "").lower()]

        # ── Table header ──
        _h_info, _h_act = st.columns([5.0, 1.1])
        with _h_info:
            st.markdown('''
            <div style="display:grid; grid-template-columns:2fr 0.6fr 1fr 0.5fr 0.9fr;
                background:#F6F6F6; border:1px solid var(--border); border-radius:var(--radius-lg) var(--radius-lg) 0 0; 
                border-bottom:2px solid #E0E0E0; padding:0; box-shadow:var(--shadow-card);">
                <div style="padding:11px 16px; border-right:1px solid #E0E0E0; color:#555; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Document Name</div>
                <div style="padding:11px 8px; border-right:1px solid #E0E0E0; color:#555; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Version</div>
                <div style="padding:11px 8px; border-right:1px solid #E0E0E0; color:#555; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Upload Date</div>
                <div style="padding:11px 8px; border-right:1px solid #E0E0E0; color:#555; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Pages</div>
                <div style="padding:11px 8px; color:#555; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Status</div>
            </div>
            ''', unsafe_allow_html=True)
            
        with _h_act:
            st.markdown('''
            <div style="background:#F6F6F6; border:1px solid var(--border); border-radius:var(--radius-lg) var(--radius-lg) 0 0; 
                border-bottom:2px solid #E0E0E0; padding:11px 16px; color:#555; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; text-align:center; box-shadow:var(--shadow-card);">
                Actions
            </div>
            ''', unsafe_allow_html=True)

        # ── One row per document ──
        for _di, _d in enumerate(_unique_docs):
            _fname  = _d.get("filename", "Unknown")
            _doc_id = _d.get("document_id", "")
            _ver    = _d.get("version", "—")
            _ts     = str(_d.get("upload_timestamp", "—"))[:10]
            _pg     = _d.get("page_count", 0)
            _artifact_dir = _d.get("artifact_dir", "")
            _is_active = (
                st.session_state.document_ready and
                st.session_state.document_info and
                st.session_state.document_info.get("filename") == _fname
            )
            _active_badge = '<span style="background:#EBEBEB;color:#111;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px;">ACTIVE</span>' if _is_active else ""
            _status_label = "Processed" if (_pg and _pg > 0) else "Processing"
            _status_bg    = "#F0F0F0" if (_pg and _pg > 0) else "#F5F5F5"
            _status_col   = "#2A2A2A" if (_pg and _pg > 0) else "#555555"
            _row_bg = "#FAFAFA" if _di % 2 == 1 else "#FFFFFF"

            _info_col, _act_col = st.columns([5.0, 1.1])
            
            with _info_col:
                st.markdown(f'''
                <div style="display:grid; grid-template-columns:2fr 0.6fr 1fr 0.5fr 0.9fr;
                    background:{_row_bg}; border-left:1px solid var(--border); border-right:1px solid var(--border); border-bottom:1px solid #EFEFEF;
                    align-items:center; min-height:52px; width:100%;">
                    <div style="padding:12px 16px; border-right:1px solid #EFEFEF; display:flex; align-items:center; gap:10px; height:100%;">
                        <i class="bi bi-file-earmark-pdf-fill" style="color:#555;font-size:17px;flex-shrink:0;"></i>
                        <div style="min-width:0;">
                            <div style="font-size:13px;font-weight:600;color:#111;
                                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                                title="{_fname}">{_fname}{_active_badge}</div>
                            <div style="font-size:11px;color:#AAA;margin-top:2px;">PDF document</div>
                        </div>
                    </div>
                    <div style="padding:12px 8px; border-right:1px solid #EFEFEF; color:#555; font-size:13px; font-weight:500; height:100%; display:flex; align-items:center;">{_ver}</div>
                    <div style="padding:12px 8px; border-right:1px solid #EFEFEF; color:#555; font-size:13px; height:100%; display:flex; align-items:center;">{_ts}</div>
                    <div style="padding:12px 8px; border-right:1px solid #EFEFEF; color:#111; font-size:13px; font-weight:600; height:100%; display:flex; align-items:center;">{_pg if _pg else "—"}</div>
                    <div style="padding:12px 8px; height:100%; display:flex; align-items:center;">
                        <span style="background:{_status_bg};color:{_status_col};
                            padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">
                            {_status_label}
                        </span>
                    </div>
                </div>
                ''', unsafe_allow_html=True)

            with _act_col:
                # Absolute positioning layer to draw the background without disrupting Streamlit's flex flow
                st.markdown(f'''
                <div style="position:relative; height:0;">
                    <div style="background:{_row_bg}; border-left:1px solid var(--border); border-right:1px solid var(--border); border-bottom:1px solid #EFEFEF;
                        height:52px; position:absolute; width:100%; top:0; left:0; z-index:0;"></div>
                </div>
                <div style="height:4px; position:relative; z-index:1;"></div>
                ''', unsafe_allow_html=True)
                
                _b1, _b2, _b3 = st.columns(3)

                # ── VIEW ──
                with _b1:
                    if st.button("", icon=":material/visibility:", key=f"view_{_doc_id}_{_di}", help="View document details", type="tertiary", use_container_width=True):
                        st.session_state[f"view_open_{_doc_id}"] = not st.session_state.get(f"view_open_{_doc_id}", False)

                # ── DOWNLOAD ──
                with _b2:
                    _pages_path = Path(_artifact_dir) / "pages.json" if _artifact_dir else None
                    if _pages_path and _pages_path.exists():
                        with open(_pages_path, "r", encoding="utf-8") as _pf:
                            _pages_data = json.load(_pf)
                        # Build plain-text export from pages
                        _txt_lines = [f"Document: {_fname}", f"Version: {_ver}", f"Pages: {_pg}", f"Uploaded: {_ts}", "=" * 60, ""]
                        for _page in _pages_data:
                            _txt_lines.append(f"--- Page {_page.get('page_number', '?')} ---")
                            _txt_lines.append(_page.get("text", "").strip())
                            _txt_lines.append("")
                        _dl_bytes = "\n".join(_txt_lines).encode("utf-8")
                        st.download_button(
                            "",
                            icon=":material/download:",
                            data=_dl_bytes,
                            file_name=f"{Path(_fname).stem}_extracted.txt",
                            mime="text/plain",
                            key=f"dl_{_doc_id}_{_di}",
                            help="Download extracted text",
                            type="tertiary",
                            use_container_width=True,
                        )
                    else:
                        st.button("", icon=":material/download:", key=f"dl_{_doc_id}_{_di}", disabled=True, help="File not available", type="tertiary", use_container_width=True)

                # ── DELETE ──
                with _b3:
                    if st.button("", icon=":material/delete:", key=f"del_{_doc_id}_{_di}", help="Delete document", type="tertiary", use_container_width=True):
                        st.session_state[f"confirm_delete_{_doc_id}"] = True

            # ── View expander ──
            if st.session_state.get(f"view_open_{_doc_id}", False):
                _pages_path = Path(_artifact_dir) / "pages.json" if _artifact_dir else None
                _trace_path = Path(_artifact_dir) / "traceability.json" if _artifact_dir else None
                with st.expander(f"📄 {_fname} — Document Details", expanded=True):
                    _mi, _mc = st.columns([1, 2])
                    with _mi:
                        st.markdown(f'''
                        <div style="background:#F8F8F8;border:1px solid #E8E8E8;border-radius:8px;padding:16px;">
                            <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Document Info</div>
                            <div style="display:flex;flex-direction:column;gap:8px;">
                                <div><span style="font-size:12px;color:#888;">Filename</span><br><span style="font-size:13px;font-weight:600;color:#111;">{_fname}</span></div>
                                <div><span style="font-size:12px;color:#888;">Version</span><br><span style="font-size:13px;font-weight:600;color:#111;">{_ver}</span></div>
                                <div><span style="font-size:12px;color:#888;">Pages</span><br><span style="font-size:13px;font-weight:600;color:#111;">{_pg if _pg else "—"}</span></div>
                                <div><span style="font-size:12px;color:#888;">Uploaded</span><br><span style="font-size:13px;font-weight:600;color:#111;">{_ts}</span></div>
                                <div><span style="font-size:12px;color:#888;">Status</span><br><span style="font-size:13px;font-weight:600;color:#111;">{_status_label}</span></div>
                            </div>
                        </div>
                        ''', unsafe_allow_html=True)
                    with _mc:
                        if _pages_path and _pages_path.exists():
                            with open(_pages_path, "r", encoding="utf-8") as _pf:
                                _view_pages = json.load(_pf)
                            st.markdown('<div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Extracted Content</div>', unsafe_allow_html=True)
                            for _vp in _view_pages[:5]:
                                with st.expander(f"Page {_vp.get('page_number', '?')}", expanded=False):
                                    st.text(_vp.get("text", "").strip()[:2000])
                            if len(_view_pages) > 5:
                                st.caption(f"Showing first 5 of {len(_view_pages)} pages.")
                        else:
                            st.info("Page content not available.")
                    if st.button("Close", key=f"close_view_{_doc_id}_{_di}"):
                        st.session_state[f"view_open_{_doc_id}"] = False
                        st.rerun()

            # ── Delete confirmation ──
            if st.session_state.get(f"confirm_delete_{_doc_id}", False):
                st.warning(f"**Delete '{_fname}'?** This will permanently remove the document and all extracted data.")
                _dc1, _dc2, _dc3 = st.columns([1, 1, 4])
                with _dc1:
                    if st.button("✓ Confirm", type="primary", key=f"confirm_del_yes_{_doc_id}_{_di}"):
                        try:
                            delete_document(current_user["id"], project["id"], _doc_id)
                            log_event(
                                "DOCUMENT_DELETED",
                                document_name=_fname,
                                status="success",
                                user_id=current_user["id"],
                                username=current_user["username"],
                                project_id=project["id"],
                                document_id=_doc_id,
                            )
                            # Clear active document if it was the deleted one
                            if (st.session_state.document_info and
                                    st.session_state.document_info.get("filename") == _fname):
                                st.session_state.document_info = None
                                st.session_state.document_ready = False
                            st.session_state.pop(f"confirm_delete_{_doc_id}", None)
                            st.success(f"'{_fname}' deleted.")
                            st.rerun()
                        except Exception as _de:
                            st.error(f"Delete failed: {_de}")
                with _dc2:
                    if st.button("✗ Cancel", key=f"confirm_del_no_{_doc_id}_{_di}"):
                        st.session_state.pop(f"confirm_delete_{_doc_id}", None)
                        st.rerun()
    else:
        st.markdown('''
        <div class="empty-state">
            <i class="bi bi-file-earmark-x empty-state-icon"></i>
            <div class="empty-state-title">No documents yet</div>
            <div class="empty-state-desc">Upload an AUTOSAR PDF above to get started with your analysis.</div>
        </div>
        ''', unsafe_allow_html=True)


elif selected_tab == 'Ask AI':
    st.markdown('''
    <div class="page-header">
        <h1>Ask AI</h1>
        <p>Query your document using natural language to find architectural answers.</p>
    </div>
    ''', unsafe_allow_html=True)

    if not st.session_state.document_ready:
        st.markdown('''
        <div class="empty-state">
            <i class="bi bi-file-earmark-pdf empty-state-icon"></i>
            <div class="empty-state-title">No active document</div>
            <div class="empty-state-desc">Upload an AUTOSAR specification in the Documents tab first to start asking questions.</div>
        </div>
        ''', unsafe_allow_html=True)
    else:
        _doc_info = st.session_state.document_info
        st.markdown(f'''
        <div class="label-xs">Active Document</div>
        <div style="background:#FFFFFF; border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:14px;">
            <i class="bi bi-file-earmark-text" style="color:#111111; font-size:22px; flex-shrink:0;"></i>
            <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--ink); margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{_doc_info.get('filename', 'Unknown')}</div>
                <div style="font-size:12px; color:var(--muted); display:flex; gap:10px; align-items:center;">
                    <span>v{_doc_info.get('version', 1)}</span>
                    <span style="color:var(--border-strong);">•</span>
                    <span>{_doc_info.get('pages', 0)} pages</span>
                    <span style="color:var(--border-strong);">•</span>
                    <span style="color:#333333; font-weight:600;">Ready</span>
                </div>
            </div>
        </div>
        ''', unsafe_allow_html=True)

        with st.form("ask_ai_form", border=False):
            question = st.text_input(
                "Ask AI",
                placeholder="Ask about components, interfaces, signals, dependencies...",
                key="project_question_input",
                label_visibility="collapsed"
            )
            ask_pressed = st.form_submit_button("Ask AI", type="primary", use_container_width=True)

        st.markdown('<div style="height:4px;"></div>', unsafe_allow_html=True)
        st.markdown('<div class="sec-title" style="margin-top:20px; margin-bottom:12px;">Suggested questions</div>', unsafe_allow_html=True)
        _sug1, _sug2 = st.columns(2, gap="medium")
        clicked_sug = None
        with _sug1:
            if st.button("What are the main views of the Adaptive Platform?", key="sug_1", use_container_width=True):
                clicked_sug = "What are the main views of the Adaptive Platform?"
            if st.button("How are the components connected?", key="sug_2", use_container_width=True):
                clicked_sug = "How are the components connected?"
        with _sug2:
            if st.button("What interfaces are described in this document?", key="sug_3", use_container_width=True):
                clicked_sug = "What interfaces are described in this document?"
            if st.button("What dependencies are mentioned?", key="sug_4", use_container_width=True):
                clicked_sug = "What dependencies are mentioned?"

        active_query = clicked_sug or (question.strip() if (ask_pressed and question and question.strip()) else None)

        if active_query:
            with st.spinner("Analyzing document..."):
                try:
                    results = retrieve_context(
                        active_query,
                        top_k=5,
                        user_id=current_user["id"],
                        project_id=project["id"],
                    )
                    # Build context chunks list for prompt and display
                    context_chunks = [
                        {"document": doc, "metadata": meta}
                        for doc, meta in zip(
                            results["documents"][0],
                            results["metadatas"][0],
                        )
                    ]
                    from rag.rag_pipeline import build_prompt
                    prompt = build_prompt(active_query, context_chunks)
                    answer = generate_answer(prompt)
                    if not answer:
                        answer = "Context was retrieved from the document, but no response was generated by the LLM. Please check your GROQ_API_KEY."

                    grounding = check_grounding(answer, " ".join(c["document"] for c in context_chunks)) if answer else {}
                    st.session_state.last_answer = {
                        "question": active_query,
                        "answer": answer,
                        "context": context_chunks,
                        "results": results,
                        "is_grounded": grounding.get("supported", False),
                        "grounding_score": grounding.get("score", 0.0),
                        "confidence": results.get("confidence", {}),
                    }
                    log_event(
                        "QUESTION_ASKED",
                        question=active_query,
                        document_name=_doc_info.get("filename"),
                        document_id=_doc_info.get("document_id"),
                        status="success",
                        details={
                            "confidence": results.get("confidence", {}).get("level", "Unknown"),
                            "chunks_retrieved": len(context_chunks),
                        },
                        user_id=current_user["id"],
                        username=current_user["username"],
                        project_id=project["id"],
                    )
                except Exception as e:
                    log_event(
                        "QUESTION_ASKED",
                        question=active_query,
                        document_name=_doc_info.get("filename"),
                        document_id=_doc_info.get("document_id"),
                        status="error",
                        details={"error": str(e)},
                        user_id=current_user["id"],
                        username=current_user["username"],
                        project_id=project["id"],
                    )
                    st.error(f"Error generating answer: {e}")
                    import traceback; traceback.print_exc()

        if "last_answer" in st.session_state and st.session_state.last_answer:
            ans = st.session_state.last_answer
            st.markdown('<div style="height:1px; background:var(--border); margin:28px 0 24px;"></div>', unsafe_allow_html=True)
            st.markdown('<div class="label-xs">AI Answer</div>', unsafe_allow_html=True)

            # Grounding / confidence badge
            _conf = ans.get("confidence", {})
            _conf_level = _conf.get("level", "")
            _conf_color = {"High": "#333333", "Medium": "#666666", "Low": "#999999"}.get(_conf_level, "#777777")
            _conf_bg    = {"High": "#F4F4F4", "Medium": "#F4F4F4", "Low": "#F4F4F4"}.get(_conf_level, "#F5F5F5")
            _grounded_icon  = "bi-shield-check" if ans.get("is_grounded") else "bi-shield-exclamation"
            _grounded_color = "#333333" if ans.get("is_grounded") else "#777777"

            st.markdown(f'''
<div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
    <span style="background:{_conf_bg}; color:{_conf_color}; padding:3px 10px; border-radius:99px; font-size:12px; font-weight:600;">
        Confidence: {_conf_level or "N/A"}
    </span>
    <span style="background:#F5F5F5; color:{_grounded_color}; padding:3px 10px; border-radius:99px; font-size:12px; font-weight:600;">
        <i class="bi {_grounded_icon}"></i> {"Grounded" if ans.get("is_grounded") else "Partially grounded"}
    </span>
</div>
            ''', unsafe_allow_html=True)

            st.markdown(f'''
            <div style="background:#FFFFFF; border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px 24px; font-size:14px; color:var(--ink); line-height:1.7; border-left:3px solid #111111; margin-bottom:20px;">
                {ans["answer"]}
            </div>
            ''', unsafe_allow_html=True)

            st.markdown('<div class="label-xs">Sources</div>', unsafe_allow_html=True)
            
            _src_html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">'
            for chunk in ans.get("context", []):
                _pg = chunk.get("metadata", {}).get("page_number", "?")
                _src_html += f'<div style="background:#F6F6F6; border:1px solid #E8E8E8; padding:6px 12px; border-radius:6px; font-size:12px; color:var(--muted); font-weight:500;"><i class="bi bi-file-text" style="margin-right:6px;"></i>Page {_pg}</div>'
            _src_html += '</div>'
            st.markdown(_src_html, unsafe_allow_html=True)

            with st.expander("Show detailed context passages"):
                for i, chunk in enumerate(ans.get("context", []), 1):
                    _pg = chunk.get("metadata", {}).get("page_number", "?")
                    _doc_text = chunk.get("document", "")
                    st.markdown(f"**Source {i} — Page {_pg}**")
                    st.text(_doc_text[:600] + ("…" if len(_doc_text) > 600 else ""))

elif selected_tab == 'Relationships':
    st.markdown('''
    <div class="page-header">
        <h1>Relationship Explorer</h1>
        <p>Visualize software component interactions and service dependencies extracted from your document.</p>
    </div>
    ''', unsafe_allow_html=True)

    if not st.session_state.document_ready:
        st.markdown('''
        <div class="empty-state">
            <i class="bi bi-diagram-3 empty-state-icon"></i>
            <div class="empty-state-title">No document loaded</div>
            <div class="empty-state-desc">Upload an AUTOSAR document in the Documents tab first.</div>
        </div>
        ''', unsafe_allow_html=True)
    else:
        _rel_path = st.session_state.document_info.get("relationship_path", "")
        _relationships = []
        if _rel_path and Path(_rel_path).exists():
            with open(_rel_path, "r", encoding="utf-8") as _f:
                _relationships = json.load(_f)

        # Summary cards
        _rel_col1, _rel_col2, _rel_col3 = st.columns(3, gap="medium")
        with _rel_col1:
            st.markdown(f'''
<div class="stat-card">
<div class="stat-card-inner">
<div class="stat-icon-wrapper stat-icon-purple"><i class="bi bi-share-fill"></i></div>
<div><div class="stat-number">{len(_relationships)}</div><div class="stat-label">Relationships</div></div>
</div></div>''', unsafe_allow_html=True)
        _sources = {r.get("source") for r in _relationships if r.get("source")}
        _targets = {r.get("target") for r in _relationships if r.get("target")}
        _nodes = _sources | _targets
        with _rel_col2:
            st.markdown(f'''
<div class="stat-card">
<div class="stat-card-inner">
<div class="stat-icon-wrapper stat-icon-blue"><i class="bi bi-box-seam-fill"></i></div>
<div><div class="stat-number">{len(_nodes)}</div><div class="stat-label">Components</div></div>
</div></div>''', unsafe_allow_html=True)
        _rel_types = {r.get("relationship") for r in _relationships if r.get("relationship")}
        with _rel_col3:
            st.markdown(f'''
<div class="stat-card">
<div class="stat-card-inner">
<div class="stat-icon-wrapper stat-icon-green"><i class="bi bi-arrow-left-right"></i></div>
<div><div class="stat-number">{len(_rel_types)}</div><div class="stat-label">Relation Types</div></div>
</div></div>''', unsafe_allow_html=True)

        st.markdown('<div style="height:8px;"></div>', unsafe_allow_html=True)

        if _relationships:
            # Filter controls
            _fc1, _fc2 = st.columns([2, 1], gap="medium")
            with _fc1:
                _filter_text = st.text_input("Filter by component or relation", placeholder="e.g. PPort, provides…", label_visibility="collapsed")
            with _fc2:
                _rel_type_options = ["All types"] + sorted(_rel_types)
                _filter_type = st.selectbox("Relation type", _rel_type_options, label_visibility="collapsed")

            _filtered = _relationships
            if _filter_text:
                _ft = _filter_text.lower()
                _filtered = [r for r in _filtered if _ft in str(r.get("source","")).lower() or _ft in str(r.get("target","")).lower() or _ft in str(r.get("relationship","")).lower()]
            if _filter_type != "All types":
                _filtered = [r for r in _filtered if r.get("relationship") == _filter_type]

            st.markdown(f'<div style="font-size:13px; color:var(--muted); margin-bottom:12px;">Showing {len(_filtered)} of {len(_relationships)} relationships</div>', unsafe_allow_html=True)

            # Relationship table
            rel_table = '''
<div style="background:#FFFFFF; border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden;">
<table style="width:100%; border-collapse:collapse; font-size:13px;">
<thead><tr style="background:#F6F6F6;">
<th style="padding:11px 16px; text-align:left; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Source</th>
<th style="padding:11px 16px; text-align:center; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Relationship</th>
<th style="padding:11px 16px; text-align:left; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Target</th>
<th style="padding:11px 16px; text-align:center; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Page</th>
</tr></thead><tbody>'''
            _rel_colors = {"provides": "#333333", "consumes": "#555555", "typed_by": "#777777"}
            for r in _filtered[:100]:
                _rc = _rel_colors.get(r.get("relationship",""), "#444444")
                rel_table += f'''
<tr style="border-bottom:1px solid #EFEFEF;">
<td style="padding:12px 16px; font-weight:600; color:var(--ink);">{r.get("source","—")}</td>
<td style="padding:12px 16px; text-align:center;">
  <span style="background:{_rc}18; color:{_rc}; padding:3px 10px; border-radius:99px; font-size:12px; font-weight:600;">{r.get("relationship","—")}</span>
</td>
<td style="padding:12px 16px; color:var(--ink);">{r.get("target","—")}</td>
<td style="padding:12px 16px; text-align:center; color:var(--muted);">{r.get("page","—")}</td>
</tr>'''
            rel_table += "</tbody></table></div>"
            st.markdown(rel_table, unsafe_allow_html=True)

            # Traceability section
            st.markdown('<div style="height:16px;"></div>', unsafe_allow_html=True)
            st.markdown('<div class="sec-title">Architecture Entities (Traceability)</div>', unsafe_allow_html=True)
            _trace_path = st.session_state.document_info.get("traceability_path", "")
            if _trace_path and Path(_trace_path).exists():
                with open(_trace_path, "r", encoding="utf-8") as _f:
                    _trace = json.load(_f)
                if _trace:
                    _trace_search = st.text_input("Search entities", placeholder="Filter entities…", key="trace_search_input", label_visibility="collapsed")
                    if _trace_search and _trace_search.strip():
                        if _trace_search.strip() != st.session_state.get("last_logged_trace_search"):
                            st.session_state.last_logged_trace_search = _trace_search.strip()
                            log_event(
                                "SEARCH",
                                question=_trace_search.strip(),
                                document_name=st.session_state.document_info.get("filename"),
                                document_id=st.session_state.document_info.get("document_id"),
                                status="success",
                                user_id=current_user["id"],
                                username=current_user["username"],
                                project_id=project["id"],
                                details={"target": "entities", "query": _trace_search.strip()},
                            )
                    _disp_trace = [t for t in _trace if not _trace_search or _trace_search.lower() in str(t.get("entity","")).lower() or _trace_search.lower() in str(t.get("type","")).lower()]
                    _type_colors = {
                        "components": "#333333", "interfaces": "#555555",
                        "ports": "#666666", "services": "#444444", "architecture_views": "#777777"
                    }
                    trace_table = '''
<div style="background:#FFFFFF; border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; margin-top:8px;">
<table style="width:100%; border-collapse:collapse; font-size:13px;">
<thead><tr style="background:#F6F6F6;">
<th style="padding:11px 16px; text-align:left; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Entity</th>
<th style="padding:11px 16px; text-align:left; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Type</th>
<th style="padding:11px 16px; text-align:center; color:#555555; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E0E0E0;">Page</th>
</tr></thead><tbody>'''
                    for t in _disp_trace[:200]:
                        _tc = _type_colors.get(t.get("type",""), "#888888")
                        trace_table += f'''
<tr style="border-bottom:1px solid #EFEFEF;">
<td style="padding:11px 16px; font-weight:500; color:var(--ink);">{t.get("entity","—")}</td>
<td style="padding:11px 16px;"><span style="background:{_tc}18; color:{_tc}; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:600;">{t.get("type","—")}</span></td>
<td style="padding:11px 16px; text-align:center; color:var(--muted);">{t.get("page","—")}</td>
</tr>'''
                    trace_table += "</tbody></table></div>"
                    st.markdown(f'<div style="font-size:13px; color:var(--muted); margin-bottom:8px;">Showing {len(_disp_trace)} of {len(_trace)} entities</div>', unsafe_allow_html=True)
                    st.markdown(trace_table, unsafe_allow_html=True)
        else:
            st.markdown('''
            <div class="empty-state" style="margin-top:16px;">
                <i class="bi bi-diagram-3 empty-state-icon"></i>
                <div class="empty-state-title">No relationships found</div>
                <div class="empty-state-desc">The document did not contain detectable component relationships (PPort/RPort patterns).</div>
            </div>
            ''', unsafe_allow_html=True)

elif selected_tab == 'Compare Versions':
    st.markdown('''
    <div class="page-header">
        <h1>Compare Documents</h1>
        <p>Identify changes, inconsistencies, and new architecture elements between document versions.</p>
    </div>
    ''', unsafe_allow_html=True)

    if can_compare(current_user["id"], project["id"]):
        _col_base, _col_curr = st.columns(2, gap="medium")
        with _col_base:
            with st.container(border=True):
                st.markdown('<div class="label-xs">Baseline Document</div>', unsafe_allow_html=True)
                old_file = st.file_uploader("Baseline", type=["pdf"], key=f"comparison_old_{project['id']}", label_visibility="collapsed")

        with _col_curr:
            with st.container(border=True):
                st.markdown('<div class="label-xs">Current Document</div>', unsafe_allow_html=True)
                new_file = st.file_uploader("Current", type=["pdf"], key=f"comparison_new_{project['id']}", label_visibility="collapsed")
    else:
        old_file = new_file = None
        st.markdown('''
        <div class="empty-state">
            <i class="bi bi-shield-lock empty-state-icon"></i>
            <div class="empty-state-title">Access Restricted</div>
            <div class="empty-state-desc">Your project role does not allow document comparison.</div>
        </div>
        ''', unsafe_allow_html=True)

    if can_compare(current_user["id"], project["id"]) and old_file and new_file:
        st.markdown('<div style="height:8px;"></div>', unsafe_allow_html=True)
        compare_clicked = st.button("Run Comparison", type="primary", use_container_width=False)
        
        if compare_clicked:
            import tempfile
            from ingestion.pdf_parser import extract_text_from_pdf
            from extraction.traceability import extract_traceable_entities
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_old:
                temp_old.write(old_file.getbuffer())
                old_path = temp_old.name
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_new:
                temp_new.write(new_file.getbuffer())
                new_path = temp_new.name
                
            with st.spinner("Analyzing differences..."):
                old_pages = extract_text_from_pdf(old_path)
                new_pages = extract_text_from_pdf(new_path)
                old_records = extract_traceable_entities(old_pages)
                new_records = extract_traceable_entities(new_pages)
                
                from analysis.document_comparison import compare_entities
                comparison = compare_entities(old_records, new_records)
                st.session_state.comparison_result = comparison
                log_event(
                    "COMPARISON_RUN", document_name=f"{old_file.name} vs {new_file.name}", status="success",
                    details={"added": len(comparison["added"]), "removed": len(comparison["removed"]), "unchanged": len(comparison["unchanged"])},
                    user_id=current_user["id"], username=current_user["username"], project_id=project["id"]
                )

        if "comparison_result" in st.session_state and st.session_state.comparison_result:
            comparison = st.session_state.comparison_result
            _n_add  = len(comparison["added"])
            _n_rem  = len(comparison["removed"])
            _n_unch = len(comparison["unchanged"])

            st.markdown('<div style="height:24px;"></div>', unsafe_allow_html=True)
            st.markdown('<div class="sec-title">Comparison Summary</div>', unsafe_allow_html=True)

            st.markdown(f'''
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px;" class="stat-grid-3">
                <div style="background:#FFFFFF; border:1px solid var(--border); border-top:2px solid #111111; border-radius:var(--radius-lg); padding:20px 24px;">
                    <div style="font-size:28px; font-weight:700; color:#333333; line-height:1; margin-bottom:8px;">{_n_add}</div>
                    <div style="font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px;">Added Elements</div>
                </div>
                <div style="background:#FFFFFF; border:1px solid var(--border); border-top:2px solid #555555; border-radius:var(--radius-lg); padding:20px 24px;">
                    <div style="font-size:28px; font-weight:700; color:#555555; line-height:1; margin-bottom:6px;">{_n_rem}</div>
                    <div style="font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px;">Removed Elements</div>
                </div>
                <div style="background:#FFFFFF; border:1px solid var(--border); border-top:2px solid #CCCCCC; border-radius:var(--radius-lg); padding:20px 24px;">
                    <div style="font-size:28px; font-weight:700; color:var(--ink); line-height:1; margin-bottom:6px;">{_n_unch}</div>
                    <div style="font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px;">Unchanged Elements</div>
                </div>
            </div>
            ''', unsafe_allow_html=True)

            st.markdown('<div class="sec-title">Detailed Changes</div>', unsafe_allow_html=True)

            _add_html = ""
            for x in comparison["added"]:
                _add_html += f'<tr><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF;"><span style="color:#2A2A2A; background:#F0F0F0; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:600;"><i class="bi bi-plus-circle" style="margin-right:4px;"></i>Added</span></td><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF; font-weight:600; color:var(--ink);">{x["entity"]}</td><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF; color:var(--muted);">{x["type"]}</td><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF; color:var(--muted);">p.{x.get("new_page", "—")}</td></tr>'
            _rem_html = ""
            for x in comparison["removed"]:
                _rem_html += f'<tr><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF;"><span style="color:#777777; background:#F5F5F5; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:600;"><i class="bi bi-dash-circle" style="margin-right:4px;"></i>Removed</span></td><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF; font-weight:600; color:var(--ink);">{x["entity"]}</td><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF; color:var(--muted);">{x["type"]}</td><td style="padding:13px 16px; border-bottom:1px solid #EFEFEF; color:var(--muted);">p.{x.get("old_page", "—")}</td></tr>'

            if _add_html or _rem_html:
                st.markdown(f'''
                <div style="background:#FFFFFF; border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; margin-bottom:20px;">
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <thead>
                            <tr style="background:#F6F6F6;">
                                <th style="color:#555555; font-size:11px; font-weight:600; padding:11px 16px; text-align:left; border-bottom:2px solid var(--border); width:130px; text-transform:uppercase; letter-spacing:0.5px;">Status</th>
                                <th style="color:#555555; font-size:11px; font-weight:600; padding:11px 16px; text-align:left; border-bottom:2px solid var(--border); text-transform:uppercase; letter-spacing:0.5px;">Entity</th>
                                <th style="color:#555555; font-size:11px; font-weight:600; padding:11px 16px; text-align:left; border-bottom:2px solid var(--border); text-transform:uppercase; letter-spacing:0.5px;">Type</th>
                                <th style="color:#555555; font-size:11px; font-weight:600; padding:11px 16px; text-align:left; border-bottom:2px solid var(--border); text-transform:uppercase; letter-spacing:0.5px;">Page</th>
                            </tr>
                        </thead>
                        <tbody>{_add_html}{_rem_html}</tbody>
                    </table>
                </div>
                ''', unsafe_allow_html=True)
            else:
                st.markdown('''
                <div class="empty-state" style="margin-bottom:20px;">
                    <i class="bi bi-check2-circle empty-state-icon"></i>
                    <div class="empty-state-title">No differences found</div>
                    <div class="empty-state-desc">Both documents contain identical architecture entities.</div>
                </div>
                ''', unsafe_allow_html=True)

            import json as _json
            comp_json = _json.dumps(comparison, indent=2).encode("utf-8")
            st.download_button(
                label="⬇ Download Comparison JSON",
                data=comp_json,
                file_name="comparison.json",
                mime="application/json",
            )
elif selected_tab == 'Settings':
    st.markdown('''
    <div class="page-header">
        <h1>Settings</h1>
        <p>Manage your workspace, audit history, and system configuration.</p>
    </div>
    ''', unsafe_allow_html=True)

    t_ws, t_audit, t_sys = st.tabs(["Workspace", "Audit Logs", "System Info"])

    # ── Workspace ──────────────────────────────────────────────────────────────
    with t_ws:
        _col1, _col2 = st.columns(2, gap="medium")

        with _col1:
            # Current workspace card — fully self-contained HTML
            st.markdown(f'''
            <div class="set-card" style="margin-bottom:16px;">
                <div class="set-card-hdr">Current Workspace</div>
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:#F2F2F2;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="bi bi-briefcase-fill" style="color:#222222;font-size:18px;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:15px;font-weight:600;color:#111111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{project["name"]}</div>
                        <div style="font-size:13px;color:#777777;margin-top:2px;">Role: <strong style="color:#111111;">{project["role"].title()}</strong></div>
                    </div>
                    <span style="background:#F0F0F0;color:#2A2A2A;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;flex-shrink:0;">Active</span>
                </div>
            </div>
            ''', unsafe_allow_html=True)

            # Switch workspace — label outside card, selectbox is a native widget
            st.markdown('''
            <div class="set-card">
                <div class="set-card-hdr">Switch Workspace</div>
                <div style="font-size:13px;color:#777777;margin-bottom:10px;">Select the workspace you want to work in.</div>
            </div>
            ''', unsafe_allow_html=True)
            project_ids_ws  = [p["id"] for p in projects]
            project_names_ws = {p["id"]: p["name"] for p in projects}
            st.selectbox(
                "Workspace",
                options=project_ids_ws,
                format_func=lambda pid: project_names_ws[pid],
                key="settings_project_selector",
                label_visibility="collapsed",
            )
            if st.session_state.settings_project_selector != st.session_state.current_project_id:
                st.session_state.current_project_id = st.session_state.settings_project_selector
                st.session_state.document_info = None
                st.session_state.document_ready = False
                st.rerun()

        with _col2:
            if current_user["role"] == "admin":
                # Use st.container so Streamlit widgets (form) render inside a styled box
                with st.container(border=True):
                    st.markdown('<div class="set-card-hdr" style="margin-bottom:4px;">Create New Workspace</div>', unsafe_allow_html=True)
                    st.markdown('<div style="font-size:13px;color:#777777;margin-bottom:12px;">Create a separate workspace for another AUTOSAR project.</div>', unsafe_allow_html=True)
                    with st.form("create_project_form", border=False):
                        new_project_name = st.text_input("Workspace name", placeholder="Enter workspace name", label_visibility="collapsed")
                        if st.form_submit_button("Create Workspace", type="primary", use_container_width=True):
                            try:
                                new_project = create_project(current_user["id"], new_project_name)
                                log_event(
                                    "PROJECT_CREATED", status="success", user_id=current_user["id"],
                                    username=current_user["username"], project_id=new_project["id"],
                                )
                                st.session_state.current_project_id = new_project["id"]
                                st.session_state.current_project_name = new_project["name"]
                                st.success(f"Workspace '{new_project_name}' created.")
                                st.rerun()
                            except Exception as error:
                                st.error(str(error))
            else:
                st.markdown('''
                <div class="empty-state" style="margin:0;">
                    <i class="bi bi-shield-lock empty-state-icon"></i>
                    <div class="empty-state-title">Admin Required</div>
                    <div class="empty-state-desc">Administrator privileges are needed to create workspaces.</div>
                </div>
                ''', unsafe_allow_html=True)

    # ── Audit Logs ─────────────────────────────────────────────────────────────
    with t_audit:
        st.markdown('<div style="height:2px;"></div>', unsafe_allow_html=True)
        _ac1, _ac2, _ac3 = st.columns([2, 1, 1])
        with _ac1:
            st.markdown('<div style="font-size:14px; font-weight:600; color:#111; margin-top:8px;">Workspace Audit History</div>', unsafe_allow_html=True)
        with _ac2:
            _filter_type = st.selectbox(
                "Filter Event",
                options=["All Events", "QUESTION_ASKED", "SEARCH", "DOCUMENT_UPLOADED", "DOCUMENT_DELETED", "COMPARISON_RUN", "PROJECT_CREATED"],
                key="audit_event_filter",
                label_visibility="collapsed"
            )
        with _ac3:
            if st.button("↻ Refresh Logs", key="refresh_audit_logs_btn", use_container_width=True):
                st.rerun()

        try:
            logs = read_logs(user_id=current_user["id"], project_id=project["id"], limit=100)
            if _filter_type != "All Events":
                logs = [lg for lg in logs if lg.get("event_type") == _filter_type]

            if logs:
                # Build the COMPLETE table HTML in one string, then render once
                _audit_html = (
                    '<div style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:12px;overflow:hidden;margin-top:12px;">'
                    '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                    '<thead><tr style="background:#F6F6F6;">'
                    '<th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:600;color:#777777;border-bottom:2px solid #E0E0E0;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Timestamp</th>'
                    '<th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:600;color:#777777;border-bottom:2px solid #E0E0E0;text-transform:uppercase;letter-spacing:0.5px;">Action</th>'
                    '<th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:600;color:#777777;border-bottom:2px solid #E0E0E0;text-transform:uppercase;letter-spacing:0.5px;">Resource / Query</th>'
                    '<th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:600;color:#777777;border-bottom:2px solid #E0E0E0;text-transform:uppercase;letter-spacing:0.5px;">Status</th>'
                    '</tr></thead><tbody>'
                )
                for _lg in logs:
                    _status = _lg.get('status', 'success')
                    _evt_color = {"success": "#059669", "error": "#dc2626", "denied": "#dc2626"}.get(_status, "#64748b")
                    _evt_icon  = {"success": "bi-check-circle-fill", "error": "bi-x-circle-fill", "denied": "bi-shield-slash"}.get(_status, "bi-dash-circle")
                    _evt_label = _status.title()
                    _st_cell = f'<span style="color:{_evt_color};font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:4px;"><i class="bi {_evt_icon}"></i>{_evt_label}</span>'
                    
                    _res = "—"
                    if _lg.get("question"):
                        _q = _lg["question"]
                        _res = f'"{_q[:35]}..."' if len(_q) > 35 else f'"{_q}"'
                    elif _lg.get("document_name"):
                        _res = _lg["document_name"]
                    elif isinstance(_lg.get("details"), dict):
                        _det = _lg["details"]
                        if _det.get("query"):
                            _res = f'Query: "{_det["query"]}"'
                        elif _det.get("target"):
                            _res = f'Target: {_det["target"]}'
                        elif _det.get("document_id"):
                            _res = str(_det["document_id"])
                        elif _lg.get("event_type") in ("LOGIN", "LOGOUT"):
                            _res = "System"
                    
                    _ts  = _lg["timestamp"][:19].replace("T", " ")
                    _audit_html += (
                        '<tr style="border-bottom:1px solid #EFEFEF;">'
                        f'<td style="padding:12px 20px;color:#777777;white-space:nowrap;font-size:12px;">{_ts}</td>'
                        f'<td style="padding:12px 20px;color:#111111;font-weight:600;">{_lg["event_type"]}</td>'
                        f'<td style="padding:12px 20px;color:#475569;font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{_res}</td>'
                        f'<td style="padding:12px 20px;">{_st_cell}</td>'
                        '</tr>'
                    )
                _audit_html += '</tbody></table></div>'
                st.markdown(_audit_html, unsafe_allow_html=True)
            else:
                st.markdown('''
                <div class="empty-state">
                    <i class="bi bi-journal-text empty-state-icon"></i>
                    <div class="empty-state-title">No audit activity found</div>
                    <div class="empty-state-desc">Actions matching this filter will appear here.</div>
                </div>
                ''', unsafe_allow_html=True)
        except Exception as e:
            st.error(f"Failed to load audit logs: {e}")

    # ── System Info ────────────────────────────────────────────────────────────
    with t_sys:
        st.markdown('<div style="height:2px;"></div>', unsafe_allow_html=True)
        _s1, _s2, _s3 = st.columns(3, gap="medium")
        with _s1:
            st.markdown('''
            <div class="set-card">
                <div class="set-card-hdr">System Status</div>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:#F4F4F4;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="bi bi-server" style="color:#777777;font-size:18px;"></i>
                    </div>
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#111111;">Application</div>
                        <div style="font-size:12px;color:#777777;margin-top:2px;">v1.2.0-enterprise</div>
                    </div>
                </div>
                <span style="background:#F0F0F0;color:#2A2A2A;font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;">
                    <i class="bi bi-circle-fill" style="font-size:6px;"></i> Operational
                </span>
            </div>
            ''', unsafe_allow_html=True)
        with _s2:
            st.markdown('''
            <div class="set-card">
                <div class="set-card-hdr">Document Engine</div>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:#F4F4F4;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="bi bi-cpu" style="color:#777777;font-size:18px;"></i>
                    </div>
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#111111;">Processing Pipeline</div>
                        <div style="font-size:12px;color:#777777;margin-top:2px;">Chunk: 1000 · Overlap: 200</div>
                    </div>
                </div>
                <span style="background:#F0F0F0;color:#2A2A2A;font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;">
                    <i class="bi bi-circle-fill" style="font-size:6px;"></i> Ready
                </span>
            </div>
            ''', unsafe_allow_html=True)
        with _s3:
            st.markdown('''
            <div class="set-card">
                <div class="set-card-hdr">AI / RAG Model</div>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:#F4F4F4;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="bi bi-robot" style="color:#777777;font-size:18px;"></i>
                    </div>
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#111111;">llama-3.1-70b</div>
                        <div style="font-size:12px;color:#777777;margin-top:2px;">Provider: Groq</div>
                    </div>
                </div>
                <span style="background:#F0F0F0;color:#2A2A2A;font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;">
                    <i class="bi bi-circle-fill" style="font-size:6px;"></i> Connected
                </span>
            </div>
            ''', unsafe_allow_html=True)

