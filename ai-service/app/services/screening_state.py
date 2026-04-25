from typing import Any, Callable, TypedDict, Optional

from app.schemas.screening import (
    JobInput,
    CandidateInput,
    ScreeningConfigInput,
    RankedCandidate,
)


class ScreeningGraphState(TypedDict, total=False):
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

    progress_cb: Optional[Callable[[int, int, int], Any]]
