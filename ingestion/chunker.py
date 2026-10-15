"""Section-aware, sentence-preserving chunking for extracted PDF pages."""
import logging
import os
import re

logger = logging.getLogger(__name__)
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 120
NUMBERED_HEADING = re.compile(r"^\s*(\d+(?:\.\d+)*)(?:\s+|[.)])(.{2,160})\s*$")


def _limits(chunk_size, overlap):
    size = max(300, int(os.getenv("CHUNK_SIZE", chunk_size or DEFAULT_CHUNK_SIZE)))
    overlap_size = max(0, int(os.getenv("CHUNK_OVERLAP", overlap if overlap is not None else DEFAULT_CHUNK_OVERLAP)))
    return size, min(overlap_size, size // 3)


def _heading_candidates(page):
    if page.get("outline_headings"):
        lines = page.get("text", "").splitlines()
        candidates = []
        for item in page["outline_headings"]:
            raw_title = re.sub(r"\s+", " ", item.get("title", "")).strip()
            match = NUMBERED_HEADING.match(raw_title)
            number = match.group(1) if match else ""
            title = match.group(2).strip() if match else raw_title
            line_index = 0
            for index, line in enumerate(lines):
                normalized = re.sub(r"\s+", " ", line).strip()
                line_match = NUMBERED_HEADING.match(normalized)
                if line_match and number and line_match.group(1) == number:
                    line_index = index
                    break
                if number and normalized.rstrip(".)") == number and index + 1 < len(lines):
                    if re.sub(r"\s+", " ", lines[index + 1]).strip().casefold() == title.casefold():
                        line_index = index
                        break
                if normalized.casefold() == raw_title.casefold() or normalized.casefold() == title.casefold():
                    line_index = index
                    break
            candidates.append({"line_index": line_index, "number": number, "title": title, "level": item.get("level", 1)})
        return candidates
    text_lines = page.get("text", "").splitlines()
    numbered = []
    for index, line in enumerate(text_lines):
        match = NUMBERED_HEADING.match(line)
        if match:
            title = match.group(2).strip()
            if re.search(r"(?:\.{3,}|·{3,})", title) or re.fullmatch(r"of\s+\d+", title, re.IGNORECASE):
                continue
            numbered.append({"line_index": index, "number": match.group(1), "title": title, "level": match.group(1).count(".") + 1})
    if numbered:
        return numbered

    visual = page.get("visual_headings", [])
    if not visual:
        return []
    result = []
    used = set()
    for candidate in visual:
        title = re.sub(r"\s+", " ", candidate.get("title", "")).strip()
        if not title or "_" in title or re.match(r"^\[\d+\]", title):
            continue
        for index, line in enumerate(text_lines):
            if index not in used and re.sub(r"\s+", " ", line).strip() == title:
                result.append({"line_index": index, "number": "", "title": title, "level": 1})
                used.add(index)
                break
    return result


def build_section_tree(pages):
    """Return an ordered flat tree with parent links and page ranges."""
    sections = []
    stack = []
    outlined_pages = [int(page.get("page_number", 1)) for page in pages if page.get("outline_headings")]
    first_outline_page = min(outlined_pages) if outlined_pages else None
    for page in pages:
        page_number = int(page.get("page_number", 1))
        outline = page.get("outline_headings", [])
        candidates = []
        if outline:
            candidates = _heading_candidates(page)
        elif first_outline_page is None or page_number >= first_outline_page:
            candidates = _heading_candidates(page)
        for heading in candidates:
            title = heading["title"].strip()
            if not title:
                continue
            number = heading.get("number", "")
            numbered_title = NUMBERED_HEADING.match(title)
            if not number and numbered_title:
                number, title = numbered_title.group(1), numbered_title.group(2).strip()
            level = max(1, int(heading.get("level", 1)))
            while stack and stack[-1]["level"] >= level:
                stack.pop()
            parent = stack[-1] if stack else None
            section = {
                "section_number": number,
                "title": title,
                "level": level,
                "start_page": page_number,
                "end_page": page_number,
                "parent": parent["section_number"] if parent else None,
                "_start_line": heading.get("line_index", 0),
            }
            sections.append(section)
            stack.append(section)
        for section in stack:
            section["end_page"] = page_number

    final_page = max((int(page.get("page_number", 1)) for page in pages), default=1)
    for index, section in enumerate(sections):
        following = next((item for item in sections[index + 1:] if item["level"] <= section["level"]), None)
        section["end_page"] = max(section["start_page"], following["start_page"] - 1) if following else final_page
    for section in sections:
        section.pop("_start_line", None)
    return sections


def _section_path(section, sections):
    chain = [section]
    parent = section.get("parent")
    while parent:
        found = next((item for item in reversed(sections) if item.get("section_number") == parent), None)
        if not found:
            break
        chain.append(found)
        parent = found.get("parent")
    return " > ".join(
        f"{item['section_number']} {item['title']}".strip() if item.get("section_number") else item["title"]
        for item in reversed(chain)
    )


def _paragraphs(text):
    return [part.strip() for part in re.split(r"\n\s*\n+", text) if part.strip()]


def _sentences(paragraph):
    # Keep common technical abbreviations and decimal section numbers together.
    return re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(\[\"'])", paragraph)


def _split_long_paragraph(paragraph, limit):
    sentences = _sentences(paragraph)
    if len(sentences) == 1 and len(paragraph) > limit:
        # Last-resort fallback for exceptionally long unpunctuated content.
        pieces = []
        remaining = paragraph
        while len(remaining) > limit:
            cut = remaining.rfind(" ", 0, limit)
            if cut < limit // 2:
                cut = limit
            pieces.append(remaining[:cut].strip())
            remaining = remaining[cut:].strip()
        if remaining:
            pieces.append(remaining)
        return pieces
    pieces, current = [], ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and len(current) + len(sentence) + 1 > limit:
            pieces.append(current)
            current = sentence
        elif not current:
            current = sentence
        else:
            current += " " + sentence
    if current:
        pieces.append(current)
    return pieces


def _pack_text(text, limit, overlap):
    paragraphs = []
    for paragraph in _paragraphs(text):
        paragraphs.extend(_split_long_paragraph(paragraph, limit))
    chunks = []
    current = ""
    for paragraph in paragraphs:
        if current and len(current) + len(paragraph) + 2 > limit:
            chunks.append(current)
            tail = ""
            if overlap:
                tail_sentences = [sentence.strip() for sentence in _sentences(current) if sentence.strip()]
                selected = []
                total = 0
                for sentence in reversed(tail_sentences):
                    if total + len(sentence) + 1 > overlap:
                        break
                    selected.insert(0, sentence)
                    total += len(sentence) + 1
                tail = " ".join(selected)
            current = f"{tail}\n\n{paragraph}" if tail else paragraph
            if len(current) > limit:
                current = paragraph
        elif not current:
            current = paragraph
        else:
            current += "\n\n" + paragraph
    if current:
        chunks.append(current)
    return chunks


def create_chunks(pages, chunk_size=DEFAULT_CHUNK_SIZE, overlap=DEFAULT_CHUNK_OVERLAP, source_file=None):
    """Create section-scoped chunks, retaining the legacy list-of-dicts contract."""
    size, overlap_size = _limits(chunk_size, overlap)
    sections = build_section_tree(pages)
    if not sections:
        logger.warning("No document headings detected; using paragraph-based chunking")

    active_section = None
    page_content = []
    outlined_pages = [int(page.get("page_number", 1)) for page in pages if page.get("outline_headings")]
    first_outline_page = min(outlined_pages) if outlined_pages else None
    for page in pages:
        number = int(page.get("page_number", 1))
        headings = _heading_candidates(page) if first_outline_page is None or number >= first_outline_page else []
        if not headings and page.get("outline_headings"):
            headings = [{"line_index": 0, "number": "", "title": item.get("title", ""), "level": item.get("level", 1)} for item in page["outline_headings"]]
        candidates = [item for item in sections if item["start_page"] < number]
        if candidates:
            active_section = candidates[-1]
        lines = page.get("text", "").splitlines()
        starts = []
        for heading in headings:
            match = next((item for item in sections if item["start_page"] == number and item["title"] == heading["title"] and item.get("section_number", "") == heading.get("number", "")), None)
            if match:
                starts.append((min(max(0, heading.get("line_index", 0)), len(lines)), match))
        if starts:
            starts.sort(key=lambda item: item[0])
            if starts[0][0] > 0 and active_section:
                page_content.append((number, "\n".join(lines[:starts[0][0]]), page.get("extraction_method", "text"), active_section))
            for index, (line_start, section) in enumerate(starts):
                line_end = starts[index + 1][0] if index + 1 < len(starts) else len(lines)
                page_content.append((number, "\n".join(lines[line_start:line_end]), page.get("extraction_method", "text"), section))
            active_section = starts[-1][1]
        else:
            page_content.append((number, page.get("text", ""), page.get("extraction_method", "text"), active_section))

    grouped = {}
    for page_number, text, extraction_method, section in page_content:
        if section and section.get("parent") and len(text) < size * 0.75:
            parent = next((item for item in reversed(sections) if item.get("section_number") == section["parent"] and item["level"] == section["level"] - 1), None)
            if parent:
                section = parent
        key = id(section) if section else ("fallback", page_number)
        grouped.setdefault(key, {"section": section, "pages": []})["pages"].append((page_number, text, extraction_method))

    groups = list(grouped.values())
    # Join adjacent short sibling sections under their parent while preserving
    # top-level boundaries and assigning the merged text to that parent section.
    merged_groups = []
    for group in groups:
        section = group["section"]
        content_length = sum(len(item[1]) for item in group["pages"])
        if section and section.get("parent") and content_length < size * 0.75 and merged_groups:
            previous = merged_groups[-1]
            previous_section = previous["section"]
            previous_length = sum(len(item[1]) for item in previous["pages"])
            same_parent = previous.get("_merge_parent", previous_section.get("parent") if previous_section else None) == section.get("parent")
            if same_parent and previous_length + content_length <= size:
                parent = next((item for item in reversed(sections) if item.get("section_number") == section["parent"] and item["level"] == section["level"] - 1), None)
                if parent:
                    previous["section"] = parent
                    previous["_merge_parent"] = section.get("parent")
                    previous["pages"].extend(group["pages"])
                    continue
        merged_groups.append(group)

    chunks = []
    for group in merged_groups:
        section = group["section"]
        pages_in_group = group["pages"]
        combined_text = "\n\n".join(text for _number, text, _method in pages_in_group if text)
        if not combined_text.strip():
            continue
        section_path = _section_path(section, sections) if section else ""
        prefix = f"{section_path}\n\n" if section_path else ""
        packed = _pack_text(combined_text, size, overlap_size)

        def locate_page(sample, from_end=False):
            sample = re.sub(r"\s+", " ", sample).strip()
            if not sample:
                return None
            probe = sample[-60:] if from_end else sample[:60]
            for width in range(len(probe), min(11, len(probe)) - 1, -5):
                candidate = probe[-width:] if from_end else probe[:width]
                for page_number, page_text, _method in pages_in_group:
                    normalized = re.sub(r"\s+", " ", page_text).strip()
                    if candidate in normalized:
                        return page_number
            return None

        for text in packed:
            if not text.strip():
                continue
            start_page = locate_page(text) or pages_in_group[0][0]
            end_page = locate_page(text, from_end=True) or pages_in_group[-1][0]
            if end_page < start_page:
                end_page = start_page
            source = next((item[2] for item in pages_in_group if item[0] == start_page), pages_in_group[0][2])
            chunk = {
                "text": prefix + text,
                "page_number": start_page,
                "page_start": start_page,
                "page_end": end_page,
                "chunk_id": len(chunks),
                "chunk_type": "text",
                "extraction_method": source,
                "section_number": section.get("section_number", "") if section else "",
                "section_title": section.get("title", "") if section else "",
                "section_path": section_path,
            }
            chunk_source = next((page.get("source_file", source_file) for page in pages if page.get("page_number") == start_page), source_file)
            if chunk_source is not None:
                chunk["source_file"] = chunk_source
            chunks.append(chunk)
    return chunks
