import pytest
from pydantic import ValidationError

from app.rules import probability_for
from app.schemas import ActivityCreate, ContactCreate, DealCreate, OrganizationCreate, StageMove


def test_organization_and_contact_validation_strips_names_and_checks_email():
    assert OrganizationCreate(name="  Acme  ").name == "Acme"
    with pytest.raises(ValidationError):
        OrganizationCreate(name=" ")
    with pytest.raises(ValidationError):
        ContactCreate(name="Morgan", status="Lead", email="not-an-email")
    with pytest.raises(ValidationError):
        ContactCreate(name="Morgan", status="Prospect")


def test_deal_validation_limits_stage_value_probability_and_position():
    valid = DealCreate(
        name="Platform",
        organization_id="org-1",
        stage="New",
        value_usd=1000,
        probability=30,
    )
    assert valid.probability == 30
    with pytest.raises(ValidationError):
        DealCreate(name=" ", organization_id="org-1", stage="New", value_usd=100)
    with pytest.raises(ValidationError):
        DealCreate(name="Platform", organization_id="org-1", stage="New", value_usd=-1)
    with pytest.raises(ValidationError):
        DealCreate(name="Platform", organization_id="org-1", stage="New", value_usd=100, probability=101)
    with pytest.raises(ValidationError):
        StageMove(stage="Won", position=-1)


def test_activity_requires_a_valid_related_record_and_timestamp():
    with pytest.raises(ValidationError):
        ActivityCreate(type="Call", description="Call", happened_at="2026-11-24T10:00:00")
    valid = ActivityCreate(
        type="Call",
        description="  Reviewed next steps  ",
        happened_at="2026-11-24T10:00:00",
        deal_id="deal-1",
    )
    assert valid.description == "Reviewed next steps"
    with pytest.raises(ValidationError):
        ActivityCreate(
            type="Visit",
            description="Review",
            happened_at="2026-11-24T10:00:00",
            deal_id="deal-1",
        )


def test_stage_probabilities_distinguish_derived_and_manual_values():
    assert probability_for("Negotiation", None) == (75, "derived")
    assert probability_for("Won", 68) == (68, "manual")
    with pytest.raises(ValueError):
        probability_for("Unknown", None)
    with pytest.raises(ValueError):
        probability_for("New", 101)
