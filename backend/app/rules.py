from datetime import date
from decimal import Decimal


STAGES = ("New", "Qualified", "Proposal", "Negotiation", "Won", "Lost")
OPEN_STAGES = STAGES[:4]
STAGE_PROBABILITIES = {
    "New": 10,
    "Qualified": 25,
    "Proposal": 50,
    "Negotiation": 75,
    "Won": 100,
    "Lost": 0,
}


def probability_for(stage: str, supplied_probability: int | None) -> tuple[int, str]:
    if stage not in STAGE_PROBABILITIES:
        raise ValueError(f"Unknown deal stage: {stage}")
    if supplied_probability is None:
        return STAGE_PROBABILITIES[stage], "derived"
    if not 0 <= supplied_probability <= 100:
        raise ValueError("Probability must be between 0 and 100")
    return supplied_probability, "manual"


def is_late(stage: str, expected_close_date: date | None, today: date) -> bool:
    return stage in OPEN_STAGES and expected_close_date is not None and expected_close_date < today


def expected_revenue(value_usd: Decimal | int | float, probability: int) -> Decimal:
    return Decimal(str(value_usd)) * Decimal(probability) / Decimal(100)
