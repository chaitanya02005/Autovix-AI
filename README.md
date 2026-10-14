# Autovix

## Description
Autovix is an intelligent, multi-tenant workspace designed for analyzing and managing **AUTOSAR High-Level Design (HLD) documents**. It automatically ingests massive PDF specifications and extracts architecture entities (components, ports, services). Additionally, it features an interactive AI assistant powered by Retrieval-Augmented Generation (RAG) that answers architectural questions with guaranteed traceability back to the exact source pages.

**Key Features:**
- **Intelligent Parsing:** Reads text, tables, and scanned architecture diagrams using OCR.
- **Automated Extraction:** Extracts Components, PPorts, RPorts, and Service Instances.
- **Architecture Entity Recognition:** Select a project document version, recognize explicitly named components, ports, interfaces, services, data elements and types, operations, and events, then inspect page-level source evidence or export JSON/CSV.
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
   ┌───────────┐                                             │ Groq LLM  │
   │ SQLite DB │                                             │ (Answer)  │
   └───────────┘                                             └───────────┘
```

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
4. Set your Groq API Key for the AI assistant:
   ```bash
   export GROQ_API_KEY="your_api_key_here"
   ```

## Usage
1. Start the server and application:
   ```bash
   ./run.sh
   ```
2. Visit `http://localhost:5173` in your browser.
3. **Upload:** Go to the "Documents" tab and upload an AUTOSAR PDF.
4. **Chat:** Go to "Ask AI" to ask questions about your architecture.
5. **Compare:** Compare different document versions to track evolution.
6. **Recognize entities:** Open **Architecture Entity Recognition**, select an uploaded document version, and run recognition. Results are built from stored PDF/OCR page text and extracted table chunks. Cache entries are scoped to the project, document ID, version, source content, and recognition schema. Use **Rebuild results** to explicitly rerun recognition from the stored source. Selecting an entity shows its source page excerpts; filters support name, type, and page.

Recognition is deterministic and evidence-backed. It scans stored page text directly (rather than relying on the separate traceability index), and uses stored table text when available. It does not use an external AI provider and does not interpret architecture diagram objects. The supported names are terminology explicitly matched in extracted source text; the current application has no interactive Architecture Explorer screen or relationship extraction source module. Relationship records are shown only when present in a document's existing `relationships.json` artifact. Entity review is presented as pending; approval/correction actions are not yet implemented for entities. Pages with no extracted text are reported as warnings; OCR depends on Tesseract being installed and configured.

## Contributing
We welcome contributions! To contribute:
1. Fork the repository.
2. Create a new branch for your feature (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m "Add new feature"`).
4. Push to the branch (`git push origin feature-name`).
5. Open a Pull Request.

## License
MIT License

## Contact
Maintainer: Autovix Team  
Email: support@autovix.example.com
