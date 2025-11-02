from typing import List, Dict, Any
import random

try:
    # package import
    from .data.interview_questions import QUESTIONS_DB
except Exception:
    # module import when running from folder
    from data.interview_questions import QUESTIONS_DB


def _normalize_type(t: str) -> str:
    # Map UI types to dataset categories when needed
    mapping = {
        "behavioral": "Behavioral",
        "mcq": "MCQ",
        "technical": "Technical",
        "system design": "System Design",
        "system-design": "System Design",
        "situational": "Situational",
    }
    return mapping.get((t or "").strip().lower(), t)


def pick_questions(role: str, types: List[str], total: int) -> List[Dict[str, Any]]:
    """Strictly return MCQ first then Behavioral with a symmetrical split.
    - Keep only MCQ and Behavioral from the role bank
    - MCQ count = ceil(total/2); Behavioral count = total - MCQ count
    - Preserve original order from the bank; do not shuffle
    """
    role_bank: Dict[str, List[Dict[str, Any]]] = QUESTIONS_DB.get(role) or {}
    # Pull banks
    mcq_bank = [dict(q, type="MCQ") for q in (role_bank.get("MCQ", []) or [])]
    beh_bank = [dict(q, type="Behavioral") for q in (role_bank.get("Behavioral", []) or [])]

    if total <= 0:
        total = 1
    mcq_count = (total + 1) // 2  # ceil(total/2)
    beh_count = total - mcq_count

    # Slice available
    mcqs = mcq_bank[:mcq_count]
    behavs = beh_bank[:beh_count]

    # If banks are short, fill as much as possible of each block, but never pull other types
    return mcqs + behavs
