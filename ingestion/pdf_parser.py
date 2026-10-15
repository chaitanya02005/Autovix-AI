import logging
import os
import re
from pathlib import Path

import pymupdf


logger = logging.getLogger(__name__)
MIN_MEANINGFUL_TEXT_CHARS = 20


def _has_meaningful_text(text):
    return sum(character.isalnum() for character in text) >= MIN_MEANINGFUL_TEXT_CHARS


def _ocr_page(page):
    """OCR one PyMuPDF page. Set TESSERACT_CMD to the executable path on Windows."""
    from io import BytesIO

    import pytesseract
    from PIL import Image

    # Example on Windows: set TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
    tesseract_cmd = os.environ.get("TESSERACT_CMD")
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    rendered_page = page.get_pixmap(dpi=300)
    with Image.open(BytesIO(rendered_page.tobytes("png"))) as image:
        return pytesseract.image_to_string(image).strip()


def _page_headings(page, body_font_size):
    """Return likely headings from visually prominent PDF text spans."""
    try:
        blocks = page.get_text("dict").get("blocks", [])
    except Exception:
        return []
    candidates = []
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = "".join(span.get("text", "") for span in spans).strip()
            if not text or len(text) > 180 or len(text.split()) > 24:
                continue
            size = max((float(span.get("size", 0)) for span in spans), default=0)
            bold = any(int(span.get("flags", 0)) & 16 for span in spans)
            if size >= body_font_size * 1.18 or (bold and size >= body_font_size * 0.95):
                candidates.append({"title": text, "font_size": round(size, 1), "bold": bold})
    return candidates


def _outline_by_page(document):
    try:
        toc = document.get_toc() or []
    except Exception:
        return {}
    headings = {}
    for item in toc:
        if len(item) >= 3:
            level, title, page_number = item[:3]
            headings.setdefault(int(page_number), []).append({
                "title": str(title).strip(), "level": max(1, int(level)), "source": "outline"
            })
    return headings


def extract_text_from_pdf(pdf_path):
    """
    Extract text from a PDF while preserving page numbers.

    Pages with fewer than 20 alphanumeric text characters use OCR. OCR requires
    pytesseract, Pillow, and the Tesseract executable. On Windows, configure the
    executable with the TESSERACT_CMD environment variable.
    """

    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    document = pymupdf.open(pdf_path)

    pages = []
    outline_by_page = _outline_by_page(document)
    font_sizes = []
    for page in document:
        try:
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        if span.get("text", "").strip():
                            font_sizes.append(float(span.get("size", 0)))
        except Exception:
            continue
    body_font_size = sorted(font_sizes)[len(font_sizes) // 2] if font_sizes else 10.0

    try:
        for page_number, page in enumerate(document, start=1):
            try:
                text = (page.get_text("text") or "").strip()
            except Exception as error:
                logger.warning("Text extraction failed on page %d: %s", page_number, error)
                text = ""

            extraction_method = "text"
            if not _has_meaningful_text(text):
                extraction_method = "ocr"
                try:
                    text = (_ocr_page(page) or "").strip()
                except Exception as error:
                    logger.warning("OCR failed on page %d: %s", page_number, error)
                    text = ""

            pages.append({
                "page_number": page_number,
                "text": text,
                "extraction_method": extraction_method,
                "outline_headings": outline_by_page.get(page_number, []),
                "visual_headings": _page_headings(page, body_font_size) if extraction_method == "text" else [],
            })
    finally:
        document.close()

    return pages


