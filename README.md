# Autovix

Autovix is a local-first workspace for processing AUTOSAR architecture PDFs. It extracts searchable page text, tables, and explicitly named architecture entities; answers questions with a local retrieval-augmented generation (RAG) pipeline; compares stored document versions; and provides review and sign-off controls for exports.

Autovix is a development application, not a certified engineering or safety-analysis tool. Answers and extracted records need engineering review before they are used in a design decision.

## Features

- **Project workspaces and access control:** Projects are scoped to authenticated users. Project roles are `admin`, `architect`, and `viewer`; upload, review, and export actions are role-controlled in the API.
- **PDF ingestion and version history:** Upload PDFs, retain successive versions by project and filename, extract page text and detected tables, and store page-aware artifacts. New text chunks include detected section paths and page ranges.
- **Ask AI:** Retrieve passages from the latest document version in the selected project and generate answers with a local `sentence-transformers/all-MiniLM-L6-v2` embedding model and Ollama. Answers include source pages, retrieved passages, a retrieval-confidence indicator, and a grounding status. The assistant can return a “not enough information” answer when the context does not support the question.
- **Architecture Entity Recognition:** Find explicitly named software components, interfaces, ports, services, architecture concepts, data elements, data types, operations, and events in extracted page text and table text. Entity records include page excerpts and section evidence. Recognition is deterministic; it does not interpret diagram geometry or infer an architecture graph.
- **Review Queue:** Review entity findings and submitted AI answers. Authorized reviewers can approve, reject, or correct findings; rejection and correction actions require comments. Entity items can be bulk-approved.
- **Version comparison:** Compare entities and traceability records from two stored versions, or run an ad-hoc analysis on two uploaded PDFs. These comparisons report added, removed, and unchanged records.
- **Governed exports:** Export entity, traceability, and stored-version comparison results as JSON or CSV. A valid sign-off is required for each stored document version involved; at least one finding must be approved or corrected. Exporting unapproved draft findings is restricted to admins and marks the output as a draft. Ad-hoc PDF comparison results cannot be exported.
- **Dashboard, audit, and system status:** View project counts, recent activity, audit events, and local engine health.

## How it works

```text
Browser (React + Vite)
        │ HTTP / JSON
        ▼
FastAPI backend ─────────────── Local Ollama chat model
        │                        (answer generation)
        ├── PDF text: PyMuPDF
        ├── PDF tables: pdfplumber
        ├── OCR fallback: Tesseract (optional)
        ├── Local embeddings: Sentence Transformers
        ├── Vector search: ChromaDB
        └── Workspace data: SQLite + local JSON artifacts
```

PDFs are processed in the backend. Page text, table text, section metadata, traceability records, and entity cache files are stored locally under `data/processed/`; vectors are stored under `data/chroma/`. Project, account, review, and sign-off data are stored in local SQLite databases. Ask AI sends prompts to the configured Ollama service; it does not use a cloud LLM provider by default. The embedding model must already be cached locally before the API can load it.

## Requirements

- Python 3.10 or later with `pip`
- Node.js 18 or later and npm (Vite 6 supports Node 18, 20, or 22+)
- [Ollama](https://ollama.com/download) and a local chat model, default `llama3.1:8b`
- Tesseract OCR only if uploaded PDFs contain scanned pages that need OCR

The bundled sample PDF is [`sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf`](sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf) (269 pages, AUTOSAR Adaptive Platform R25-11).

## Setup

From the repository root:

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
npm ci --prefix frontend
```

On Windows, activate the virtual environment with `venv\Scripts\activate`. `run.sh` is a Bash script for macOS/Linux; on Windows, start the backend and frontend separately using the commands in [Running the application](#running-the-application).

### Configure local models

Start Ollama and download the default chat model:

```bash
ollama pull llama3.1:8b
```

If Ollama is not already running as a background service, start it in a separate terminal with `ollama serve`.

The embedding model runs in local-only mode. Download and cache it once while internet access is available:

```bash
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

After it is cached, document retrieval does not need to download the embedding model. If the model is missing, Ask AI returns a setup error rather than retrying a network download.

### Optional OCR setup

Install Tesseract and make sure `tesseract` is on `PATH`. On macOS, use `brew install tesseract`; on Debian or Ubuntu, use `sudo apt install tesseract-ocr`. On Windows, install Tesseract and set `TESSERACT_CMD` in `.env` to the executable path if it is not on `PATH`. OCR is only used for pages with very little extractable text.

### Environment variables

The defaults are listed in [`.env.example`](.env.example). Copy it if you want to customize them:

```bash
cp .env.example .env
```

`run.sh` does not automatically read `.env`. Load it into the shell before starting the app:

```bash
set -a
source .env
set +a
```

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | Local answer provider; Ollama is the supported provider. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API address. |
| `OLLAMA_MODEL` | `llama3.1:8b` | Model name used for answers. Pull the model before selecting it. |
| `LLM_TIMEOUT_SECONDS` | `120` | Timeout for local model requests. |
| `LLM_TEMPERATURE` | `0.1` | Ollama generation temperature. |
| `CHUNK_SIZE` | `1000` | Target text chunk size in characters. |
| `CHUNK_OVERLAP` | `120` | Sentence-boundary overlap between text chunks. |
| `TESSERACT_CMD` | system default | Optional path to the Tesseract executable, useful on Windows. |
| `AUTOVIX_API_SECRET` | development fallback | Optional API token-signing secret; if set, it must be at least 32 bytes. |

## Running the application

On macOS/Linux, from the repository root:

```bash
./run.sh
```

The script starts FastAPI with reload enabled at `http://127.0.0.1:8000` and Vite at `http://127.0.0.1:5173`. Open [http://localhost:5173](http://localhost:5173). Use `Ctrl+C` in the terminal to stop the services.

To start the services separately (including on Windows), activate the virtual environment, then run:

```bash
# Terminal 1, from the repository root
uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2, from the repository root
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

The API includes interactive documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Health is available at `/api/health`; it reports HTTP 503 when the configured local Ollama model is unavailable.

### First local session

When the local account database has no users, `GET /api/auth/session` creates a development admin account (`admin` / `admin123456789`) and a `Main Workspace` project. The frontend requests this local session automatically when it has no saved token. These bootstrap credentials are for local development only; do not expose the development server to an untrusted network.

## Typical workflow

1. Open **Documents & Specifications** and upload a PDF. Uploading another PDF with the same filename in the same project creates the next version.
2. Ask questions in **Ask AI**. Retrieval uses the latest indexed document version in the active project. Review the answer, confidence indicator, citations, and retrieved passages together; low-confidence answers may be incomplete.
3. Run **Architecture Entity Recognition** for a selected document version. Inspect evidence, filter by name/type/page, or use **Rebuild results** to rerun recognition from the stored page and table text.
4. Use **Review Queue** to review extracted entities or submit an AI answer for review. Review status changes after sign-off invalidate that version's prior sign-off.
5. Use **Compare Versions** to inspect a stored-version comparison or analyze two PDFs directly. Direct uploads are for analysis only.
6. Export approved findings, traceability, or a stored-version comparison as JSON or CSV after the relevant document versions have current sign-offs.

## Re-index an existing document

Section-aware chunking is applied to new uploads. To rebuild the vector chunks for an already processed document, run:

```bash
python -m ingestion.reindex_document \
  --user-id USER_ID \
  --project-id PROJECT_ID \
  --document-id DOCUMENT_ID
```

The command checks project access and uses the saved extraction artifacts for that document. It replaces only that document's vectors in its project collection. Existing documents without section metadata remain searchable until re-indexed.

## API overview

Routes are available under `/api` (and also at the root path for backwards compatibility). Authenticated endpoints use a bearer token.

| Area | Routes |
|---|---|
| Health and session | `GET /api/health`, `GET /api/auth/session`, `POST /api/auth/token`, `GET /api/auth/me` |
| Projects | `GET /api/projects`, `POST /api/projects`, `GET /api/projects/{project_id}/stats` |
| Documents | `POST` and `GET /api/projects/{project_id}/documents`; document detail, extracted text download, and delete routes are nested under a document ID. |
| Ask AI | `POST /api/projects/{project_id}/query` |
| Entity recognition | `/api/projects/{project_id}/documents/{document_id}/entities` including recognize, detail, and JSON/CSV export routes. |
| Review and sign-off | `/api/projects/{project_id}/documents/{document_id}/reviews` including review actions, summary, and sign-off routes. |
| Traceability and comparison | `/api/projects/{project_id}/traceability`, `/api/projects/{project_id}/compare`, and `/api/projects/{project_id}/compare/files` |
| Governed exports and audit | `/api/projects/{project_id}/exports/{traceability|comparison}` and `/api/projects/{project_id}/audit` |

See `/docs` for request schemas and complete route details.

## Data layout

| Path | Contents |
|---|---|
| `data/processed/access_control.sqlite3` | Local accounts, projects, memberships, and document records. |
| `data/processed/audit_log.sqlite3` | Audit events. |
| `data/processed/document_versions.json` | Per-project filename version history. |
| `data/processed/projects/{project_id}/{document_id}/` | Extracted page text, chunks, tables, sections, traceability, and cached entity results for one document version. |
| `data/chroma/` | Persistent Chroma vector collections. |

These paths can contain uploaded documents and workspace records. Keep user data and generated local databases out of source-control commits and back them up before manual cleanup.

## Current limitations

- Input processing supports PDF files. OCR runs only on pages with very little extractable text and requires the Tesseract executable; OCR failure can leave a page without text and recognition warnings.
- Table extraction is based on PDF table detection and may not preserve every complex layout. Section detection also depends on readable headings or PDF outlines.
- Entity recognition is text-based and deterministic. It does not interpret diagram geometry, infer relationships, or replace an engineering review.
- Ask AI is retrieval-based and can miss relevant passages. Its confidence score describes retrieval relevance, not the probability that an answer is correct. Check the cited source pages and passages.
- Comparison is based on extracted traceability/entity records, not a visual or semantic diff of every sentence in two PDFs.
- Ad-hoc PDF comparison has no stored document IDs, review state, or version sign-off; its results are not exportable. Export requires stored versions with current sign-offs.
- The repository targets local development. Configure a strong `AUTOVIX_API_SECRET` and restrict CORS/network access before adapting it for a shared or production deployment.

## Development and verification

The backend tests are under `tests/`. The frontend is a Vite React app in `frontend/`. To build the frontend:

```bash
npm --prefix frontend run build
```
