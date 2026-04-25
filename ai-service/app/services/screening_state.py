from typing import TypedDict, Optional

from app.schemas.screening import (
    JobInput,
    CandidateInput,
    ScreeningConfigInput,
    RankedCandidate,
)


class ScreeningGraphState(TypedDict):
    job: JobInput
    candidates: list[CandidateInput]
    config: ScreeningConfigInput
    candidates_map: dict[str, CandidateInput]

    evaluations: list[dict]
    shortlisted: list[dict]

    current_batch_index: int
    all_batches_done: bool
    skip_reasoning: bool

    results: list[RankedCandidate]
    error: Optional[str]
