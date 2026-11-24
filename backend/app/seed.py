import argparse
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.engine import Engine

from . import clock
from .db import (
    activities,
    activity_contacts,
    activity_deals,
    contacts,
    create_database_engine,
    deals,
    metadata,
    organizations,
    stage_changes,
)


ORGANIZATION_DATA = (
    ("org-1", "Northstar Analytics", "northstar.example", "Technology"),
    ("org-2", "Harbor Health", "harborhealth.example", "Healthcare"),
    ("org-3", "Juniper Financial", "juniperfin.example", "Finance"),
    ("org-4", "Summit Learning", "summitlearning.example", "Education"),
    ("org-5", "Cedar & Stone", "cedarstone.example", "Manufacturing"),
    ("org-6", "Brightside Retail", "brightside.example", "Retail"),
)

CONTACT_DATA = (
    ("contact-1", "Avery Chen", "avery@northstar.example", "555-0101", "VP Operations", "org-1", "Lead"),
    ("contact-2", "Jordan Rivera", "jordan@northstar.example", "555-0102", "Director of Data", "org-1", "Qualified"),
    ("contact-3", "Morgan Patel", "morgan@harborhealth.example", "555-0103", "CIO", "org-2", "Customer"),
    ("contact-4", "Taylor Kim", "taylor@harborhealth.example", "555-0104", "Clinical Programs Lead", "org-2", "Lead"),
    ("contact-5", "Riley Brooks", "riley@juniperfin.example", "555-0105", "Managing Director", "org-3", "Qualified"),
    ("contact-6", "Casey Morgan", "casey@juniperfin.example", "555-0106", "Finance Systems Lead", "org-3", "Customer"),
    ("contact-7", "Quinn Davis", "quinn@summitlearning.example", "555-0107", "Superintendent", "org-4", "Lead"),
    ("contact-8", "Reese Taylor", "reese@summitlearning.example", "555-0108", "Procurement Manager", "org-4", "Qualified"),
    ("contact-9", "Jamie Lee", "jamie@cedarstone.example", "555-0109", "VP Sales", "org-5", "Customer"),
    ("contact-10", "Cameron Wright", "cameron@cedarstone.example", "555-0110", "Plant Manager", "org-5", "Lead"),
    ("contact-11", "Drew Evans", "drew@brightside.example", "555-0111", "Chief Digital Officer", "org-6", "Qualified"),
    ("contact-12", "Skyler James", "skyler@brightside.example", "555-0112", "Retail Operations Lead", "org-6", "Customer"),
)

DEAL_DATA = (
    ("deal-1", "Northstar data platform", "org-1", "contact-1", "New", 28000, None, -5, None),
    ("deal-2", "Northstar forecasting", "org-1", "contact-2", "New", 42000, 18, 3, None),
    ("deal-3", "Northstar expansion", "org-1", "contact-1", "New", 18000, None, 2, None),
    ("deal-4", "Harbor patient insights", "org-2", "contact-3", "Qualified", 65000, None, -12, None),
    ("deal-5", "Harbor care coordination", "org-2", "contact-4", "Qualified", 35000, 40, 4, None),
    ("deal-6", "Harbor analytics renewal", "org-2", "contact-3", "Qualified", 48000, None, 6, None),
    ("deal-7", "Juniper risk modernization", "org-3", "contact-5", "Proposal", 125000, None, -20, None),
    ("deal-8", "Juniper reporting suite", "org-3", "contact-6", "Proposal", 54000, 61, 1, None),
    ("deal-9", "Juniper data migration", "org-3", "contact-5", "Proposal", 73000, None, 5, None),
    ("deal-10", "Summit student success", "org-4", "contact-7", "Negotiation", 82000, None, -3, None),
    ("deal-11", "Summit district rollout", "org-4", "contact-8", "Negotiation", 44000, 82, 2, None),
    ("deal-12", "Summit enrollment tools", "org-4", "contact-7", "Negotiation", 27000, None, 7, None),
    ("deal-13", "Cedar supply planning", "org-5", "contact-9", "Won", 96000, None, -1, -11),
    ("deal-14", "Cedar sales enablement", "org-5", "contact-10", "Won", 46000, None, -1, -6),
    ("deal-15", "Brightside store insights", "org-6", "contact-11", "Won", 68000, 100, -1, -2),
    ("deal-16", "Brightside loyalty pilot", "org-6", "contact-12", "Lost", 38000, None, -1, -9),
    ("deal-17", "Cedar operations review", "org-5", "contact-9", "Lost", 57000, 12, -1, -4),
    ("deal-18", "Juniper compliance project", "org-3", "contact-6", "Lost", 31000, None, -1, -1),
)


def _month_offset(day: date, months: int) -> date:
    absolute_month = day.year * 12 + day.month - 1 + months
    year, month_index = divmod(absolute_month, 12)
    month = month_index + 1
    return date(year, month, min(day.day, 28))


def _at_local_time(day: date, hour: int = 10) -> datetime:
    return datetime.combine(day, time(hour=hour))


def _seed_rows(connection, seed_today: date) -> None:
    now = _at_local_time(seed_today, 9)

    connection.execute(
        organizations.insert(),
        [
            {
                "id": org_id,
                "name": name,
                "website": website,
                "industry": industry,
                "notes": None,
                "created_at": now,
                "updated_at": now,
            }
            for org_id, name, website, industry in ORGANIZATION_DATA
        ],
    )
    connection.execute(
        contacts.insert(),
        [
            {
                "id": contact_id,
                "name": name,
                "email": email,
                "phone": phone,
                "job_title": title,
                "organization_id": organization_id,
                "status": status,
                "created_at": now,
                "updated_at": now,
            }
            for contact_id, name, email, phone, title, organization_id, status in CONTACT_DATA
        ],
    )

    stage_positions: dict[str, int] = {}
    deal_rows = []
    stage_change_rows = []
    for (deal_id, name, organization_id, contact_id, stage, value, manual_probability,
         expected_offset, closed_offset) in DEAL_DATA:
        position = stage_positions.get(stage, 0)
        stage_positions[stage] = position + 1
        probability = manual_probability
        source = "manual" if probability is not None else "derived"
        if probability is None:
            from .rules import STAGE_PROBABILITIES

            probability = STAGE_PROBABILITIES[stage]
        actual_close = _month_offset(seed_today, closed_offset) if closed_offset is not None else None
        expected_close = (
            _month_offset(seed_today, expected_offset)
            if expected_offset >= 0
            else seed_today + timedelta(days=expected_offset)
        )
        deal_rows.append(
            {
                "id": deal_id,
                "name": name,
                "organization_id": organization_id,
                "main_contact_id": contact_id,
                "stage": stage,
                "value_usd": Decimal(value),
                "probability": probability,
                "probability_source": source,
                "expected_close_date": expected_close,
                "actual_close_date": actual_close,
                "position": position,
                "created_at": now,
                "updated_at": now,
            }
        )
        if stage in ("Won", "Lost"):
            stage_change_rows.append(
                {
                    "id": f"stage-change-{deal_id}",
                    "deal_id": deal_id,
                    "from_stage": "Negotiation",
                    "to_stage": stage,
                    "happened_at": _at_local_time(actual_close, 15),
                }
            )
    connection.execute(deals.insert(), deal_rows)

    activity_specs = (
        ("activity-1", "Call", "Discussed analytics priorities and decision process.", -12, None, False, "contact-1", "deal-1"),
        ("activity-2", "Email", "Shared the implementation outline for review.", -8, -4, False, "contact-3", "deal-4"),
        ("activity-3", "Note", "Asked for a revised pricing option.", -5, 0, False, "contact-5", "deal-7"),
        ("activity-4", "Call", "Confirmed stakeholder review for next week.", -2, 3, False, "contact-7", "deal-10"),
        ("activity-5", "Email", "Sent onboarding information.", -20, None, True, "contact-9", "deal-13"),
        ("activity-6", "Note", "Preparing a short discovery agenda.", -1, 1, False, "contact-2", "deal-2"),
        ("activity-7", "Call", "Reviewed the current reporting workflow.", -3, -1, False, "contact-4", "deal-5"),
        ("activity-8", "Email", "Shared the revised proposal.", -14, 5, False, "contact-6", "deal-8"),
        ("activity-9", "Note", "Follow-up completed; customer confirmed next steps.", -7, -2, True, "contact-11", "deal-15"),
        ("activity-10", "Call", "Introductory call and qualification.", -4, 6, False, "contact-12", "deal-3"),
    )
    activity_rows = []
    contact_links = []
    deal_links = []
    for activity_id, kind, description, happened_offset, followup_offset, done, contact_id, deal_id in activity_specs:
        happened_date = seed_today + timedelta(days=happened_offset)
        activity_rows.append(
            {
                "id": activity_id,
                "type": kind,
                "description": description,
                "happened_at": _at_local_time(happened_date, 11),
                "follow_up_date": (
                    seed_today + timedelta(days=followup_offset)
                    if followup_offset is not None
                    else None
                ),
                "done": done,
                "created_at": now,
                "updated_at": now,
            }
        )
        contact_links.append({"activity_id": activity_id, "contact_id": contact_id})
        deal_links.append({"activity_id": activity_id, "deal_id": deal_id})

    connection.execute(activities.insert(), activity_rows)
    connection.execute(activity_contacts.insert(), contact_links)
    connection.execute(activity_deals.insert(), deal_links)
    connection.execute(stage_changes.insert(), stage_change_rows)


def seed_database(engine: Engine, seed_today: date | None = None) -> None:
    metadata.create_all(engine)
    with engine.begin() as connection:
        _seed_rows(connection, seed_today or clock.today())


def initialize_database(engine: Engine, seed_today: date | None = None) -> None:
    metadata.create_all(engine)
    with engine.begin() as connection:
        organization_count = connection.scalar(select(func.count()).select_from(organizations))
    if organization_count == 0:
        seed_database(engine, seed_today)


def reset_database(engine: Engine, seed_today: date | None = None) -> None:
    metadata.create_all(engine)
    with engine.begin() as connection:
        for table in (
            stage_changes,
            activity_contacts,
            activity_deals,
            activities,
            deals,
            contacts,
            organizations,
        ):
            connection.execute(delete(table))
        _seed_rows(connection, seed_today or clock.today())


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace the local Accountable database with sample data.")
    parser.parse_args()
    engine = create_database_engine()
    try:
        reset_database(engine)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
