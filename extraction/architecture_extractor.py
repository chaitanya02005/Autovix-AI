import re


def unique_values(values):
    """Remove duplicates while preserving order."""
    result = []
    seen = set()

    for value in values:
        normalized = value.lower().strip()

        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(value.strip())

    return result


def extract_architecture_entities(text):
    """
    Extract explicitly mentioned architecture terminology.

    This version intentionally extracts only terminology
    that appears directly in the supplied document text.
    """

    entities = {
        "components": [],
        "interfaces": [],
        "ports": [],
        "services": [],
        "architecture_views": [],
        "architecture_concepts": [],
        "data_elements": [],
        "data_types": [],
        "operations": [],
        "events": [],
    }

    # ---------------------------------------------------------
    # Architecture views
    # ---------------------------------------------------------

    view_patterns = [
        r"\bstructural architecture views?\b",
        r"\bbehavioral architecture views?\b",
        r"\bstructural views?\b",
        r"\bbehavioral views?\b",
    ]

    for pattern in view_patterns:
        matches = re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        entities["architecture_views"].extend(matches)

    concept_patterns = [
        r"\bfunctional flows?\b",
        r"\barchitecture dependencies\b",
        r"\barchitecture behavior\b",
    ]
    for pattern in concept_patterns:
        entities["architecture_concepts"].extend(re.findall(pattern, text, flags=re.IGNORECASE))

    # ---------------------------------------------------------
    # Services
    # ---------------------------------------------------------

    service_patterns = [
        r"\bservice-oriented architecture\b",
        r"\bservice-oriented communication\b",
        r"\bservice-oriented services\b",
    ]

    for pattern in service_patterns:
        matches = re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        entities["services"].extend(matches)

    # ---------------------------------------------------------
    # Interfaces
    # ---------------------------------------------------------

    interface_patterns = [
        r"\b[A-Z][A-Za-z0-9_-]*Interface\b",
        r"\b[A-Z][A-Za-z0-9_-]*Interface[A-Za-z0-9_-]*\b",
    ]

    for pattern in interface_patterns:
        matches = re.findall(
            pattern,
            text
        )

        entities["interfaces"].extend(matches)

    # ---------------------------------------------------------
    # Ports
    # ---------------------------------------------------------

    port_patterns = [
        r"\bPPort\b",
        r"\bRPort\b",
        r"\bDelegatedPort\b",
        r"\bParameterPort\b",
        r"\bPPortPrototype\b",
        r"\bRPortPrototype\b",
        r"\bAbstractProvidedPortPrototype\b",
        r"\bAbstractRequiredPortPrototype\b",
        r"\bModePortAnnotation\b",
        r"\bNvDataPortAnnotation\b",
        r"\bTriggerPortAnnotation\b",
        r"\bPPorts\b",
        r"\bRPorts\b",
    ]

    for pattern in port_patterns:
        matches = re.findall(
            pattern,
            text
        )

        entities["ports"].extend(matches)

    # ---------------------------------------------------------
    # Components
    # ---------------------------------------------------------

    component_patterns = [
        r"\b[A-Z][A-Za-z0-9_-]*Component\b",
        r"\b[A-Z][A-Za-z0-9_-]*Manager\b",
        r"\b[A-Z][A-Za-z0-9_-]*(?:AdaptiveApplication|Application)\b",
    ]

    for pattern in component_patterns:
        matches = re.findall(
            pattern,
            text
        )

        entities["components"].extend(matches)

    # These suffix-based recognizers require an explicit AUTOSAR-style
    # identifier in the source. They intentionally do not infer relationships.
    named_patterns = {
        "services": r"\b[A-Z][A-Za-z0-9_-]*(?:ServiceInstance|ServiceReference|ServiceRef|Service)\b",
        "data_elements": r"\b[A-Z][A-Za-z0-9_-]*(?:DataElement|Signal)\b",
        "data_types": r"\b[A-Z][A-Za-z0-9_-]*DataType\b",
        "operations": r"\b[A-Z][A-Za-z0-9_-]*Operation\b",
        "events": r"\b[A-Z][A-Za-z0-9_-]*Event\b",
    }
    for category, pattern in named_patterns.items():
        entities[category].extend(re.findall(pattern, text))

    # ---------------------------------------------------------
    # Remove duplicates
    # ---------------------------------------------------------

    for category in entities:
        entities[category] = unique_values(
            entities[category]
        )

    return entities
