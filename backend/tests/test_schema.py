import pytest
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError

from app.db import activity_contacts, organizations


def test_schema_has_core_tables_and_foreign_key_enforcement(engine):
    table_names = set(inspect(engine).get_table_names())
    assert {
        "organizations",
        "contacts",
        "deals",
        "activities",
        "activity_contacts",
        "activity_deals",
        "stage_changes",
    } <= table_names

    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1


def test_invalid_relationship_is_rejected_by_sqlite(engine, fixed_today):
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                activity_contacts.insert().values(activity_id="missing", contact_id="missing")
            )


def test_existing_database_initialization_preserves_records(engine):
    with engine.connect() as connection:
        assert connection.scalar(select(organizations.c.name).where(organizations.c.id == "org-1")) == (
            "Northstar Analytics"
        )
