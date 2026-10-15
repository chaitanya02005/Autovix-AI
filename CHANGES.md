# Implementation changes

Changes were delivered in the requested order. The commits are on the current `main` branch.

## Change 1 — Local Ollama answers

**Commit:** `c47f99a` — `feat: use local Ollama for grounded answers`

**Files:** created `rag/llm_client.py` and `tests/test_llm_client.py`; modified `.env.example`, `README.md`, `backend/api.py`, `backend/routes/query.py`, `backend/schemas.py`, `database/audit_log.py`, `frontend/src/pages/PrivacyPolicy.jsx`, `frontend/src/pages/Settings.jsx`, `rag/rag_answer.py`, and `requirements.txt`; deleted `rag/groq_client.py`.

**Configuration:** `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=llama3.1:8b`, `LLM_TIMEOUT_SECONDS=120`, and `LLM_TEMPERATURE=0.1`.

**API:** existing answer and health URLs remain. Health reports degraded service with HTTP 503 when the local model is unavailable; query errors explain how to start Ollama or pull the configured model. The answer response adds the model name.

**Database:** no migration.

**Rollback:** `git revert c47f99a`. Restore a supported local provider before restarting the application; this change removes the Groq client and dependency.

## Change 2 — Persistent review queue

**Commit:** `2506938` — `feat: add persistent entity and answer review queue`

**Files:** modified `backend/api.py`, `backend/routes/entities.py`, `backend/routes/review.py`, `backend/schemas.py`, `database/access_control.py`, `database/review_store.py`, `extraction/entity_recognition.py`, `frontend/src/App.jsx`, `frontend/src/api.js`, `frontend/src/components/Sidebar.jsx`, `frontend/src/pages/ArchitectureEntityRecognition.jsx`, and `frontend/src/pages/AskAI.jsx`; created `frontend/src/pages/ReviewQueue.jsx` and `tests/test_reviews.py`.

**Configuration:** no new environment variables.

**API:** adds document-scoped review list and summary, answer submission, approve/reject/correct, and bulk-approve routes under `/api/projects/{project_id}/documents/{document_id}/reviews`. Existing project review routes remain available. Admin and architect roles perform review actions; viewers can read.

**Database migration:** SQLite startup creates `reviews` and `review_migrations`. Legacy `review_log.json` data is imported once; that source file is preserved as a backup. New items start pending.

**Rollback:** `git revert 2506938` after reverting dependent Change 3 commits. SQLite tables and imported data are additive and may be retained; the old JSON file remains untouched.

## Change 3 — Export approval and sign-off gate

**Commit:** `64593ef` — `feat: require signoff before exporting findings`

**Files:** modified `backend/export_utils.py`, `backend/routes/entities.py`, `backend/routes/exports.py`, `backend/routes/review.py`, `database/access_control.py`, `database/review_store.py`, `frontend/src/api.js`, `frontend/src/pages/ArchitectureEntityRecognition.jsx`, `frontend/src/pages/CompareVersions.jsx`, `frontend/src/pages/ReviewQueue.jsx`, `tests/test_entity_api.py`, and `tests/test_reviews.py`.

**Configuration:** no new environment variables.

**API:** adds `GET` and `POST /api/projects/{project_id}/documents/{document_id}/reviews/signoff`. Project traceability and comparison exports accept `include_unapproved=true`; comparison exports require stored `baseline_document_id` and `current_document_id`. Ad-hoc PDF comparison downloads are blocked, as clarified by the user.

**Database migration:** SQLite startup creates a `signoffs` table. Sign-offs bind to document version and review digest; review changes invalidate the current sign-off.

**Rollback:** `git revert 64593ef` after the later Change 4 commits have been reverted. The additive sign-off table can remain. Reverting restores prior export behavior, so do not use that state for governed exports.

## Change 4 — Section-aware chunking

**Commits:** `7f57320` — `feat: add section-aware document chunking`; `c944be8` — `fix: filter repeated and reference headings`.

**Files:** created `ingestion/reindex_document.py` and `tests/test_chunker.py`; modified `.env.example`, `README.md`, `frontend/src/pages/AskAI.jsx`, `ingestion/chunker.py`, `ingestion/document_processor.py`, `ingestion/pdf_parser.py`, `rag/citation.py`, and `rag/uploaded_document_db.py`.

**Configuration:** `CHUNK_SIZE=1000` and `CHUNK_OVERLAP=120`; overlap is applied at sentence boundaries when possible.

**API:** document processing responses add `sections` and `sections_path`; source references add section details. Existing page citations and old vector records remain supported.

**Database/storage:** no relational migration. New ingestion writes `sections.json` beside document artifacts and stores page range and section metadata in Chroma. To rebuild a stored document, run `python -m ingestion.reindex_document --user-id USER_ID --project-id PROJECT_ID --document-id DOCUMENT_ID`. The script checks project access and replaces vectors filtered to that document inside its project collection.

**Rollback:** `git revert c944be8` and `git revert 7f57320`. Existing vector records remain searchable; section metadata is ignored by reverted code. If a document was re-indexed, its embedded text retains section prefixes, which older code can still search.

## Verification and regression checklist

Baseline: the requested `./venv/bin/pytest -v` could not start because its interpreter link was stale in this checkout. Running the same test suite with `/usr/local/bin/python3.14` and the repository venv site-packages produced **14 passed** before edits.

Final command: `PYTHONPATH="$PWD/venv/lib/python3.14/site-packages" /usr/local/bin/python3.14 -m pytest -v` — **29 passed** (six third-party deprecation warnings). `npm run build`, `python3 -m compileall -q ingestion rag backend database`, and `git diff --check` also passed.

| # | Check | Result |
|---|---|---|
| 1 | Pytest | **Pass:** 29 passed, including local LLM, review/sign-off/export, chunking, citation, table, and egress-guard tests. |
| 2 | Login, project list, full admin/architect/viewer RBAC matrix | **Partial:** authenticated route and role-guard behavior is covered by backend tests; no live UI role matrix was run. |
| 3 | Upload a text PDF and inspect section metadata | **Partial:** extracted the repository AUTOSAR PDF and ran the parser/chunker benchmark; no authenticated end-to-end upload was run. |
| 4 | Upload a scanned PDF and verify OCR | **Not run:** no scanned-PDF upload session was run. Existing OCR/entity API tests pass. |
| 5 | Entity recognition count (135 on benchmark) | **Not run:** the live benchmark recognizer was not run. Existing recognition behavior/cache tests pass. |
| 6 | Live Ask AI questions against Ollama with citations | **Not run:** Ollama was mocked in tests; no live local model answer was generated. |
| 7 | Live out-of-scope refusal | **Not run:** requires a live local model; grounding and mocked-client tests passed. |
| 8 | Revision comparison v1 vs v2 | **Not run:** no real two-version benchmark comparison was run. Comparison export now requires stored, signed-off versions. |
| 9 | Review Queue approve/reject/correct/sign-off UI | **Partial:** backend persistence, action validation, and sign-off invalidation tests pass; no manual browser session was run. |
| 10 | Export blocked/allowed with review metadata | **Pass in backend tests:** zero-approval 409, draft restrictions, sign-off, metadata, and invalidation are covered. No manual browser download was run. |
| 11 | Cross-project vector and review isolation | **Partial:** access checks and document-scoped re-index deletion are implemented; no multi-project live integration run was performed. |
| 12 | Network-disconnected behavior and provider egress scan | **Partial:** source/requirements egress-guard test passes; network-disconnected live operation was not tested. |

### Sample PDF chunk comparison

Measured on `sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf` (269 pages). The old result was simulated with 1,000-character windows and 150-character overlap; the new result used default section-aware chunking. The start-mid-sentence percentage is a simple heuristic based on whether the first content character looks like a sentence start; it is useful for comparing the two chunkers but is not a linguistic parser.

| Metric | Fixed windows | Section-aware |
|---|---:|---:|
| Chunk count | 711 | 841 |
| Average content characters | 782.7 | 600.0 |
| Chunks heuristically starting mid-sentence | 53.2% | 11.3% |
| Detected sections | — | 547 |

The section-aware average remains below the 800–1,200-character target because many sections are shorter than the target and are kept within their section boundaries. Tables remain complete Markdown chunks. This benchmark checked extraction and chunk structure, not retrieval answer quality or entity-recognition counts.

## Assumptions and remaining checks

- Export sign-off validity is tied to the stored document version and a digest of the current review set. Changing a finding after sign-off invalidates it.
- Directly uploaded, ad-hoc PDF comparisons are blocked; only stored document versions with current sign-offs can be exported.
- Live Ollama answers, scanned-PDF ingestion, the 135-entity benchmark, the live revision comparison, and manual browser flows remain to be checked in an environment with the application services and model available.
