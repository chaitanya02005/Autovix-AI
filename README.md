# Autovix

## Description
Autovix is an intelligent, multi-tenant workspace designed for analyzing and managing **AUTOSAR High-Level Design (HLD) documents**. It automatically ingests massive PDF specifications and extracts architecture entities (components, ports, services). Additionally, it features an interactive AI assistant powered by Retrieval-Augmented Generation (RAG) that answers architectural questions with guaranteed traceability back to the exact source pages.

**Key Features:**
- **Intelligent Parsing:** Reads text, tables, and scanned architecture diagrams using OCR.
- **Automated Extraction:** Extracts Components, PPorts, RPorts, and Service Instances.
- **Architecture Entity Recognition:** Select a project document version, recognize explicitly named components, ports, interfaces, services, data elements and types, operations, and events, then inspect page-level source evidence or export JSON/CSV. (Sample document provided [below](#sample-document--architecture-entity-recognition)).
- **Traceable AI Chat:** Natural language questions are strictly grounded in your documents.
- **Version Comparison:** Compare document versions to see added, removed, or modified components.

### Architecture Diagram
```text
┌──────────┐       ┌─────────────────┐       ┌───────────┐
│   User   │──────▶│ React (Vite UI) │──────▶│  FastAPI  │
└──────────┘       └─────────────────┘       └───────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼ (Upload)                                  ▼ (Query)
                 ┌───────────┐                               ┌───────────┐
                 │ Ingestion │                               │ RAG Embed │
                 │(Parse PDF)│                               │ (Query)   │
                 └───────────┘                               └───────────┘
                       │                                           │
         ┌─────────────┴─────────────┐                             │
         ▼                           ▼                             ▼
   ┌───────────┐               ┌───────────┐                 ┌───────────┐
   │Extraction │               │ ChromaDB  │◀────────────────│ Retrieve  │
   │(Entities) │               │(Vectors)  │                 └───────────┘
   └───────────┘               └───────────┘                       │
         │                                                         ▼
         ▼                                                   ┌───────────┐
   ┌───────────┐                                             │ Ollama LLM │
   │ SQLite DB │                                             │ (Answer)  │
   └───────────┘                                             └───────────┘
```

## Sample Document & Architecture Entity Recognition

To test and verify the **Architecture Entity Recognition** capabilities of Autovix, a complete benchmark AUTOSAR specification document is provided in this repository.

### 📥 Download the Sample PDF
Download the sample document using any of the following links:
- 🔗 **Direct Download (Repository File):** [Download `AUTOSAR_AP_EXP_SWArchitecture.pdf`](./sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf)
- 🌐 **GitHub Raw Download:** [Download from GitHub Raw](https://raw.githubusercontent.com/chaitanya02005/Autovix-AI/main/sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf)
- 📂 **View in Repository:** [Browse `sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf`](https://github.com/chaitanya02005/Autovix-AI/blob/main/sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf)

### 📄 Document Details
| Property | Value |
|---|---|
| **Document Name** | `AUTOSAR_AP_EXP_SWArchitecture.pdf` |
| **Title** | Explanation of Adaptive Platform Software Architecture |
| **Standard & Release** | AUTOSAR Adaptive Platform Release R25-11 (Document ID: 982) |
| **Repository Path** | [`sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf`](./sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf) |
| **Document Size** | 269 pages (~1.7 MB) |

### 🔍 How to Test Architecture Entity Recognition with this Document
1. **Download:** Click [Download `AUTOSAR_AP_EXP_SWArchitecture.pdf`](./sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf) to save the sample document locally.
2. **Upload to Autovix:** In the application (`http://localhost:5173`), navigate to the **Documents** tab and upload `AUTOSAR_AP_EXP_SWArchitecture.pdf`.
3. **Open Architecture Entity Recognition:** In the sidebar menu, select **Architecture Entity Recognition**.
4. **Select Document Version:** Choose `AUTOSAR_AP_EXP_SWArchitecture.pdf` from the document version selector.
5. **Inspect Recognized Entities:**
   - Explore extracted architecture entities across standard categories:
     - **Services:** e.g., `Service-Oriented Communication`, `DownloadService`, `StateMachineService`, `UpdateAllowedService`
     - **Software Components:** e.g., `SMControlApplication`, `ControlApplication`
     - **Interfaces:** e.g., `WatchdogInterface`, `StateClientInterface`, `OperatingSystemInterface`, `SuspendToRamHubInterface`
     - **Ports:** e.g., `PPortPrototype`, `RPortPrototype`
     - **Operations:** e.g., `ServiceOperation`
   - Click any entity row to inspect its exact **page-level source evidence excerpts** and section citations.
   - Filter entities by type, search by name, or export the full entity catalogue as **JSON** or **CSV**.

## Installation

### Prerequisites
1. **Python 3.10+**: Ensure Python and `pip` are installed.
2. **Tesseract OCR**: Required for parsing images in PDFs.
   - **macOS**: `brew install tesseract`
   - **Ubuntu/Linux**: `sudo apt-get install tesseract-ocr`
   - **Windows**: Download the installer from the [Tesseract GitHub](https://github.com/tesseract-ocr/tesseract).

### Steps
1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd Autovix
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   # On macOS/Linux
   source venv/bin/activate
   # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install Ollama and download the default local model:
   ```bash
   # Install Ollama from https://ollama.com/download
   ollama pull llama3.1:8b
   ```
   Configure the local model in `.env` as needed:
   ```env
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.1:8b
   LLM_TIMEOUT_SECONDS=120
   LLM_TEMPERATURE=0.1
   ```
   To use another model hosted by Ollama, pull it and change `OLLAMA_MODEL` (for example, to a Qwen or Mistral model).

## Usage
1. Start the server and application:
   ```bash
   ./run.sh
   ```
2. Visit `http://localhost:5173` in your browser.
3. **Upload:** Go to the "Documents" tab and upload an AUTOSAR PDF (you can use our [sample AUTOSAR PDF](./sample_documents/AUTOSAR_AP_EXP_SWArchitecture.pdf)).
4. **Chat:** Go to "Ask AI" to ask questions about your architecture.
5. **Compare:** Compare different document versions to track evolution.
6. **Recognize entities:** Open **Architecture Entity Recognition**, select an uploaded document version (such as `AUTOSAR_AP_EXP_SWArchitecture.pdf`), and run recognition. Results are built from stored PDF/OCR page text and extracted table chunks. Cache entries are scoped to the project, document ID, version, source content, and recognition schema. Use **Rebuild results** to explicitly rerun recognition from the stored source. Selecting an entity shows its source page excerpts; filters support name, type, and page.

Recognition is deterministic and evidence-backed. It scans stored page text directly (rather than relying on the separate traceability index), and uses stored table text when available. It does not use an external AI provider and does not interpret architecture diagram objects. The supported names are terminology explicitly matched in extracted source text; the current application has no interactive Architecture Explorer screen or relationship extraction source module. Relationship records are shown only when present in a document's existing `relationships.json` artifact. Entity review is presented as pending; approval/correction actions are not yet implemented for entities. Pages with no extracted text are reported as warnings; OCR depends on Tesseract being installed and configured.

