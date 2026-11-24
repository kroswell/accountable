from sqlalchemy import func, select

from app.db import (
    activities,
    activity_contacts,
    activity_deals,
    contacts,
    deals,
    organizations,
    stage_changes,
)
from app.seed import initialize_database, reset_database


def test_seed_populates_every_stage_status_and_follow_up_state(engine, fixed_today):
    with engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(organizations)) >= 6
        assert connection.scalar(select(func.count()).select_from(contacts)) >= 12
        assert connection.scalar(select(func.count()).select_from(deals)) >= 18
        assert connection.scalar(select(func.count()).select_from(activities)) >= 10
        assert connection.scalar(select(func.count()).select_from(stage_changes)) >= 6
        assert connection.scalar(select(func.count()).select_from(activity_contacts)) >= 10
        assert connection.scalar(select(func.count()).select_from(activity_deals)) >= 10

        assert set(connection.scalars(select(contacts.c.status))) == {"Lead", "Qualified", "Customer"}
        assert set(connection.scalars(select(deals.c.stage))) == {
            "New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"
        }
        followups = connection.execute(
            select(activities.c.follow_up_date, activities.c.done)
            .where(activities.c.follow_up_date.is_not(None))
        ).all()
        assert any(day < fixed_today and not done for day, done in followups)
        assert any(day == fixed_today and not done for day, done in followups)
        assert any(day > fixed_today and not done for day, done in followups)
        assert any(done for _, done in followups)


def test_reset_replaces_changes_and_initialization_does_not_reseed(engine, fixed_today):
    with engine.begin() as connection:
        connection.execute(
            organizations.update()
            .where(organizations.c.id == "org-1")
            .values(name="Locally changed")
        )
        connection.execute(
            organizations.insert().values(
                id="extra-org",
                name="Temporary",
                website=None,
                industry=None,
                notes=None,
                created_at=fixed_today,
                updated_at=fixed_today,
            )
        )

    initialize_database(engine, seed_today=fixed_today)
    with engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(organizations)) == 7
        assert connection.scalar(
            select(func.count()).select_from(organizations).where(organizations.c.id == "extra-org")
        ) == 1
        assert connection.scalar(
            select(organizations.c.name).where(organizations.c.id == "org-1")
        ) == "Locally changed"

    reset_database(engine, seed_today=fixed_today)
    with engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(organizations)) == 6
        assert connection.scalar(
            select(func.count()).select_from(organizations).where(organizations.c.id == "extra-org")
        ) == 0
        assert connection.scalar(select(func.count()).select_from(deals)) == 18


def test_seed_dates_cover_recent_closed_months_and_late_deals(engine, fixed_today):
    with engine.connect() as connection:
        close_dates = connection.scalars(
            select(deals.c.actual_close_date).where(deals.c.actual_close_date.is_not(None))
        ).all()
        expected_dates = connection.scalars(
            select(deals.c.expected_close_date)
            .where(deals.c.stage.in_(("New", "Qualified", "Proposal", "Negotiation")))
        ).all()
    assert len({(day.year, day.month) for day in close_dates}) >= 4
    assert sum(day < fixed_today for day in expected_dates) >= 3
