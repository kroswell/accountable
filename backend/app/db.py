from pathlib import Path

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.engine import Engine

from .config import database_path


metadata = MetaData()

organizations = Table(
    "organizations",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("website", String(500)),
    Column("industry", String(100)),
    Column("notes", Text),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

contacts = Table(
    "contacts",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("email", String(320)),
    Column("phone", String(80)),
    Column("job_title", String(150)),
    Column("organization_id", String, ForeignKey("organizations.id", ondelete="RESTRICT")),
    Column("status", String(20), nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    CheckConstraint("status IN ('Lead', 'Qualified', 'Customer')", name="ck_contacts_status"),
)

deals = Table(
    "deals",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("organization_id", String, ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
    Column("main_contact_id", String, ForeignKey("contacts.id", ondelete="SET NULL")),
    Column("stage", String(20), nullable=False),
    Column("value_usd", Numeric(12, 2), nullable=False),
    Column("probability", Integer, nullable=False),
    Column("probability_source", String(10), nullable=False),
    Column("expected_close_date", Date),
    Column("actual_close_date", Date),
    Column("position", Integer, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    CheckConstraint(
        "stage IN ('New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')",
        name="ck_deals_stage",
    ),
    CheckConstraint("value_usd >= 0", name="ck_deals_value_nonnegative"),
    CheckConstraint("probability BETWEEN 0 AND 100", name="ck_deals_probability"),
    CheckConstraint("probability_source IN ('derived', 'manual')", name="ck_deals_probability_source"),
    CheckConstraint("position >= 0", name="ck_deals_position"),
    Index("ix_deals_stage_position", "stage", "position"),
)

activities = Table(
    "activities",
    metadata,
    Column("id", String, primary_key=True),
    Column("type", String(10), nullable=False),
    Column("description", Text, nullable=False),
    Column("happened_at", DateTime, nullable=False),
    Column("follow_up_date", Date),
    Column("done", Boolean, nullable=False, default=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    CheckConstraint("type IN ('Note', 'Call', 'Email')", name="ck_activities_type"),
)

activity_contacts = Table(
    "activity_contacts",
    metadata,
    Column("activity_id", String, ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True),
    Column("contact_id", String, ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
)

activity_deals = Table(
    "activity_deals",
    metadata,
    Column("activity_id", String, ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True),
    Column("deal_id", String, ForeignKey("deals.id", ondelete="CASCADE"), primary_key=True),
)

stage_changes = Table(
    "stage_changes",
    metadata,
    Column("id", String, primary_key=True),
    Column("deal_id", String, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
    Column("from_stage", String(20), nullable=False),
    Column("to_stage", String(20), nullable=False),
    Column("happened_at", DateTime, nullable=False),
    CheckConstraint(
        "from_stage IN ('New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')",
        name="ck_stage_changes_from_stage",
    ),
    CheckConstraint(
        "to_stage IN ('New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')",
        name="ck_stage_changes_to_stage",
    ),
)


def create_database_engine(path: str | Path | None = None) -> Engine:
    database = Path(path) if path is not None else database_path()
    database = database.expanduser().resolve()
    database.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{database}", future=True)

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine
