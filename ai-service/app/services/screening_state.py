"""Graph state definition for the screening LangGraph workflow."""

from typing import TypedDict, Optional

from app.schemas.screening import (
    JobInput,
    CandidateInput,
    ScreeningConfigInput,
    RankedCandidate,
)


class ScreeningGraphState(TypedDict):
    """State passed between screening workflow nodes."""

    # Inputs (set once at invocation)
    job: JobInput
    candidates: list[CandidateInput]
    config: ScreeningConfigInput
    candidates_map: dict[str, CandidateInput]

    # Intermediate
    evaluations: list[dict]
    shortlisted: list[dict]

    # Control flow
    current_batch_index: int
    all_batches_done: bool
    skip_reasoning: bool

    # Outputs
    results: list[RankedCandidate]
    error: Optional[str]
