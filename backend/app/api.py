from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.engine import Engine

from . import clock
from .db import activities, activity_contacts, activity_deals, contacts, deals, organizations, stage_changes
from .rules import OPEN_STAGES, STAGE_PROBABILITIES, expected_revenue, is_late, probability_for
from .schemas import ActivityCreate, ContactCreate, DealCreate, OrganizationCreate, StageMove


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


def _date(value):
    return value.isoformat() if value else None


def _dt(value):
    return value.isoformat() if value else None


def _row(row):
    return dict(row)


def router_for(engine: Engine) -> APIRouter:
    router = APIRouter(prefix="/api")

    def org_payload(connection, row):
        item = _row(row)
        item["contact_count"] = connection.scalar(select(func.count()).select_from(contacts).where(contacts.c.organization_id == item["id"]))
        item["deal_count"] = connection.scalar(select(func.count()).select_from(deals).where(deals.c.organization_id == item["id"]))
        return item

    def contact_payload(connection, row):
        item = _row(row)
        item["organization_name"] = connection.scalar(select(organizations.c.name).where(organizations.c.id == item["organization_id"])) if item["organization_id"] else None
        item["created_at"] = _dt(item["created_at"]); item["updated_at"] = _dt(item["updated_at"])
        return item

    def deal_payload(connection, row):
        item = _row(row)
        item["value_usd"] = float(item["value_usd"])
        item["expected_close_date"] = _date(item["expected_close_date"]); item["actual_close_date"] = _date(item["actual_close_date"])
        item["created_at"] = _dt(item["created_at"]); item["updated_at"] = _dt(item["updated_at"])
        item["organization_name"] = connection.scalar(select(organizations.c.name).where(organizations.c.id == item["organization_id"]))
        item["main_contact_name"] = connection.scalar(select(contacts.c.name).where(contacts.c.id == item["main_contact_id"])) if item["main_contact_id"] else None
        item["late"] = is_late(item["stage"], date.fromisoformat(item["expected_close_date"]) if item["expected_close_date"] else None, clock.today())
        return item

    def activity_payload(connection, row):
        item = _row(row)
        item["happened_at"] = _dt(item["happened_at"]); item["follow_up_date"] = _date(item["follow_up_date"])
        item["contact_ids"] = list(connection.scalars(select(activity_contacts.c.contact_id).where(activity_contacts.c.activity_id == item["id"])))
        item["deal_ids"] = list(connection.scalars(select(activity_deals.c.deal_id).where(activity_deals.c.activity_id == item["id"])))
        return item

    def timeline(connection, deal_id=None, contact_id=None):
        rows = []
        if deal_id:
            activity_ids = select(activity_deals.c.activity_id).where(activity_deals.c.deal_id == deal_id)
            for row in connection.execute(select(activities).where(activities.c.id.in_(activity_ids))).mappings():
                rows.append({**activity_payload(connection, row), "kind": "activity"})
            for row in connection.execute(select(stage_changes).where(stage_changes.c.deal_id == deal_id)).mappings():
                rows.append({"id": row["id"], "kind": "stage_change", "from_stage": row["from_stage"], "to_stage": row["to_stage"], "happened_at": _dt(row["happened_at"]), "deal_id": deal_id})
        if contact_id:
            activity_ids = select(activity_contacts.c.activity_id).where(activity_contacts.c.contact_id == contact_id)
            for row in connection.execute(select(activities).where(activities.c.id.in_(activity_ids))).mappings():
                rows.append({**activity_payload(connection, row), "kind": "activity"})
        return sorted(rows, key=lambda item: item["happened_at"] or "", reverse=True)

    @router.get("/organizations")
    def list_organizations(q: str = "", sort: str = "name", direction: str = "asc"):
        if sort not in {"name", "industry", "created_at"} or direction not in {"asc", "desc"}:
            raise HTTPException(422, "Unknown sort or direction")
        with engine.connect() as connection:
            query = select(organizations)
            if q:
                term = f"%{q.lower()}%"
                query = query.where(or_(func.lower(organizations.c.name).like(term), func.lower(organizations.c.website).like(term), func.lower(organizations.c.industry).like(term)))
            column = getattr(organizations.c, sort)
            query = query.order_by(column.asc() if direction == "asc" else column.desc())
            return [org_payload(connection, row) for row in connection.execute(query).mappings()]

    @router.post("/organizations", status_code=201)
    def create_organization(payload: OrganizationCreate):
        now = clock.now()
        item = {"id": _id("org"), **payload.model_dump(), "created_at": now, "updated_at": now}
        with engine.begin() as connection:
            connection.execute(organizations.insert().values(item))
            return org_payload(connection, connection.execute(select(organizations).where(organizations.c.id == item["id"])).mappings().one())

    @router.get("/organizations/{record_id}")
    def get_organization(record_id: str):
        with engine.connect() as connection:
            row = connection.execute(select(organizations).where(organizations.c.id == record_id)).mappings().first()
            if not row: raise HTTPException(404, "Organization not found")
            item = org_payload(connection, row)
            item["contacts"] = [contact_payload(connection, r) for r in connection.execute(select(contacts).where(contacts.c.organization_id == record_id)).mappings()]
            item["deals"] = [deal_payload(connection, r) for r in connection.execute(select(deals).where(deals.c.organization_id == record_id)).mappings()]
            return item

    @router.put("/organizations/{record_id}")
    def update_organization(record_id: str, payload: OrganizationCreate):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(organizations).where(organizations.c.id == record_id)): raise HTTPException(404, "Organization not found")
            connection.execute(update(organizations).where(organizations.c.id == record_id).values(**payload.model_dump(), updated_at=clock.now()))
            return org_payload(connection, connection.execute(select(organizations).where(organizations.c.id == record_id)).mappings().one())

    @router.delete("/organizations/{record_id}", status_code=204)
    def delete_organization(record_id: str):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(organizations).where(organizations.c.id == record_id)): raise HTTPException(404, "Organization not found")
            linked = {"contacts": [r.id for r in connection.execute(select(contacts.c.id).where(contacts.c.organization_id == record_id))], "deals": [r.id for r in connection.execute(select(deals.c.id).where(deals.c.organization_id == record_id))]}
            if linked["contacts"] or linked["deals"]: raise HTTPException(409, detail={"linked": linked})
            connection.execute(delete(organizations).where(organizations.c.id == record_id))

    @router.get("/contacts")
    def list_contacts(q: str = "", status: str = "all", sort: str = "name", direction: str = "asc"):
        if status not in {"all", "Lead", "Qualified", "Customer"} or sort not in {"name", "status", "email"} or direction not in {"asc", "desc"}: raise HTTPException(422, "Invalid filter")
        with engine.connect() as connection:
            query = select(contacts)
            if status != "all": query = query.where(contacts.c.status == status)
            if q:
                term = f"%{q.lower()}%"
                query = query.join(organizations, isouter=True).where(or_(func.lower(contacts.c.name).like(term), func.lower(contacts.c.email).like(term), func.lower(contacts.c.phone).like(term), func.lower(organizations.c.name).like(term)))
            column = getattr(contacts.c, sort)
            query = query.order_by(column.asc() if direction == "asc" else column.desc())
            return [contact_payload(connection, r) for r in connection.execute(query).mappings()]

    @router.post("/contacts", status_code=201)
    def create_contact(payload: ContactCreate):
        now = clock.now(); item = {"id": _id("contact"), **payload.model_dump(), "email": str(payload.email) if payload.email else None, "created_at": now, "updated_at": now}
        with engine.begin() as connection:
            if item["organization_id"] and not connection.scalar(select(func.count()).select_from(organizations).where(organizations.c.id == item["organization_id"])): raise HTTPException(422, "Organization not found")
            connection.execute(contacts.insert().values(item))
            return contact_payload(connection, connection.execute(select(contacts).where(contacts.c.id == item["id"])).mappings().one())

    @router.get("/contacts/{record_id}")
    def get_contact(record_id: str):
        with engine.connect() as connection:
            row = connection.execute(select(contacts).where(contacts.c.id == record_id)).mappings().first()
            if not row: raise HTTPException(404, "Contact not found")
            item = contact_payload(connection, row); item["deals"] = [deal_payload(connection, r) for r in connection.execute(select(deals).where(deals.c.main_contact_id == record_id)).mappings()]; item["timeline"] = timeline(connection, contact_id=record_id); return item

    @router.put("/contacts/{record_id}")
    def update_contact(record_id: str, payload: ContactCreate):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(contacts).where(contacts.c.id == record_id)): raise HTTPException(404, "Contact not found")
            values = payload.model_dump(); values["email"] = str(payload.email) if payload.email else None; values["updated_at"] = clock.now()
            connection.execute(update(contacts).where(contacts.c.id == record_id).values(**values))
            return contact_payload(connection, connection.execute(select(contacts).where(contacts.c.id == record_id)).mappings().one())

    @router.delete("/contacts/{record_id}", status_code=204)
    def delete_contact(record_id: str):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(contacts).where(contacts.c.id == record_id)): raise HTTPException(404, "Contact not found")
            connection.execute(update(deals).where(deals.c.main_contact_id == record_id).values(main_contact_id=None))
            connection.execute(delete(activity_contacts).where(activity_contacts.c.contact_id == record_id))
            connection.execute(delete(contacts).where(contacts.c.id == record_id))

    @router.get("/deals")
    def list_deals(q: str = "", stage: str = "all", sort: str = "name", direction: str = "asc"):
        if stage != "all" and stage not in STAGE_PROBABILITIES or sort not in {"name", "stage", "value_usd", "expected_close_date"} or direction not in {"asc", "desc"}: raise HTTPException(422, "Invalid filter")
        with engine.connect() as connection:
            query = select(deals)
            if stage != "all": query = query.where(deals.c.stage == stage)
            if q:
                term = f"%{q.lower()}%"; query = query.join(organizations).join(contacts, deals.c.main_contact_id == contacts.c.id, isouter=True).where(or_(func.lower(deals.c.name).like(term), func.lower(organizations.c.name).like(term), func.lower(contacts.c.name).like(term)))
            column = getattr(deals.c, sort); query = query.order_by(column.asc() if direction == "asc" else column.desc())
            return [deal_payload(connection, r) for r in connection.execute(query).mappings()]

    @router.post("/deals", status_code=201)
    def create_deal(payload: DealCreate):
        now = clock.now(); probability, source = probability_for(payload.stage, payload.probability)
        item = {"id": _id("deal"), **payload.model_dump(exclude={"probability"}), "value_usd": Decimal(str(payload.value_usd)), "probability": probability, "probability_source": source, "position": 0, "created_at": now, "updated_at": now}
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(organizations).where(organizations.c.id == item["organization_id"])): raise HTTPException(422, "Organization not found")
            item["position"] = connection.scalar(select(func.count()).select_from(deals).where(deals.c.stage == item["stage"]))
            connection.execute(deals.insert().values(item))
            return deal_payload(connection, connection.execute(select(deals).where(deals.c.id == item["id"])).mappings().one())

    @router.get("/deals/{record_id}")
    def get_deal(record_id: str):
        with engine.connect() as connection:
            row = connection.execute(select(deals).where(deals.c.id == record_id)).mappings().first()
            if not row: raise HTTPException(404, "Deal not found")
            item = deal_payload(connection, row); item["timeline"] = timeline(connection, deal_id=record_id); return item

    @router.put("/deals/{record_id}")
    def update_deal(record_id: str, payload: DealCreate):
        with engine.begin() as connection:
            old = connection.execute(select(deals).where(deals.c.id == record_id)).mappings().first()
            if not old: raise HTTPException(404, "Deal not found")
            values = payload.model_dump(exclude={"probability"}); values["value_usd"] = Decimal(str(payload.value_usd)); values["updated_at"] = clock.now()
            if payload.probability is not None: values.update(probability=payload.probability, probability_source="manual")
            connection.execute(update(deals).where(deals.c.id == record_id).values(**values))
            return deal_payload(connection, connection.execute(select(deals).where(deals.c.id == record_id)).mappings().one())

    @router.delete("/deals/{record_id}", status_code=204)
    def delete_deal(record_id: str):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(deals).where(deals.c.id == record_id)): raise HTTPException(404, "Deal not found")
            ids = select(activity_deals.c.activity_id).where(activity_deals.c.deal_id == record_id)
            connection.execute(delete(activities).where(activities.c.id.in_(ids)))
            connection.execute(delete(deals).where(deals.c.id == record_id))

    @router.get("/activities")
    def list_activities(contact_id: str | None = None, deal_id: str | None = None):
        with engine.connect() as connection:
            query = select(activities).order_by(activities.c.happened_at.desc())
            rows = list(connection.execute(query).mappings())
            return [activity_payload(connection, r) for r in rows if (not contact_id or contact_id in activity_payload(connection, r)["contact_ids"]) and (not deal_id or deal_id in activity_payload(connection, r)["deal_ids"])]

    @router.post("/activities", status_code=201)
    def create_activity(payload: ActivityCreate):
        now = clock.now(); item = {"id": _id("activity"), **payload.model_dump(exclude={"contact_id", "deal_id"}), "created_at": now, "updated_at": now}
        with engine.begin() as connection:
            if payload.contact_id and not connection.scalar(select(func.count()).select_from(contacts).where(contacts.c.id == payload.contact_id)): raise HTTPException(422, "Contact not found")
            if payload.deal_id and not connection.scalar(select(func.count()).select_from(deals).where(deals.c.id == payload.deal_id)): raise HTTPException(422, "Deal not found")
            connection.execute(activities.insert().values(item))
            if payload.contact_id: connection.execute(activity_contacts.insert().values(activity_id=item["id"], contact_id=payload.contact_id))
            if payload.deal_id: connection.execute(activity_deals.insert().values(activity_id=item["id"], deal_id=payload.deal_id))
            return activity_payload(connection, connection.execute(select(activities).where(activities.c.id == item["id"])).mappings().one())

    @router.put("/activities/{record_id}")
    def update_activity(record_id: str, payload: ActivityCreate):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(activities).where(activities.c.id == record_id)):
                raise HTTPException(404, "Activity not found")
            if payload.contact_id and not connection.scalar(select(func.count()).select_from(contacts).where(contacts.c.id == payload.contact_id)):
                raise HTTPException(422, "Contact not found")
            if payload.deal_id and not connection.scalar(select(func.count()).select_from(deals).where(deals.c.id == payload.deal_id)):
                raise HTTPException(422, "Deal not found")
            connection.execute(update(activities).where(activities.c.id == record_id).values(
                **payload.model_dump(exclude={"contact_id", "deal_id"}), updated_at=clock.now(),
            ))
            connection.execute(delete(activity_contacts).where(activity_contacts.c.activity_id == record_id))
            connection.execute(delete(activity_deals).where(activity_deals.c.activity_id == record_id))
            if payload.contact_id:
                connection.execute(activity_contacts.insert().values(activity_id=record_id, contact_id=payload.contact_id))
            if payload.deal_id:
                connection.execute(activity_deals.insert().values(activity_id=record_id, deal_id=payload.deal_id))
            return activity_payload(connection, connection.execute(select(activities).where(activities.c.id == record_id)).mappings().one())

    @router.delete("/activities/{record_id}", status_code=204)
    def delete_activity(record_id: str):
        with engine.begin() as connection:
            if not connection.scalar(select(func.count()).select_from(activities).where(activities.c.id == record_id)):
                raise HTTPException(404, "Activity not found")
            connection.execute(delete(activities).where(activities.c.id == record_id))

    @router.get("/pipeline")
    def pipeline():
        with engine.connect() as connection:
            columns = []
            for stage in STAGE_PROBABILITIES:
                cards = [deal_payload(connection, r) for r in connection.execute(select(deals).where(deals.c.stage == stage).order_by(deals.c.position)).mappings()]
                columns.append({"stage": stage, "cards": cards, "count": len(cards), "value_usd": sum(c["value_usd"] for c in cards), "expected_revenue": sum(float(expected_revenue(c["value_usd"], c["probability"])) for c in cards)})
            open_cards = [c for col in columns[:4] for c in col["cards"]]
            return {"columns": columns, "open_value_usd": sum(c["value_usd"] for c in open_cards), "open_expected_revenue": sum(float(expected_revenue(c["value_usd"], c["probability"])) for c in open_cards)}

    @router.post("/deals/{record_id}/move")
    def move_deal(record_id: str, payload: StageMove):
        with engine.begin() as connection:
            old = connection.execute(select(deals).where(deals.c.id == record_id)).mappings().first()
            if not old: raise HTTPException(404, "Deal not found")
            target_count = connection.scalar(select(func.count()).select_from(deals).where(deals.c.stage == payload.stage, deals.c.id != record_id))
            position = min(payload.position, target_count)
            connection.execute(update(deals).where(deals.c.id == record_id).values(stage=payload.stage, position=position, probability=(old["probability"] if old["probability_source"] == "manual" else STAGE_PROBABILITIES[payload.stage]), updated_at=clock.now()))
            if old["stage"] != payload.stage:
                connection.execute(stage_changes.insert().values(id=_id("stage-change"), deal_id=record_id, from_stage=old["stage"], to_stage=payload.stage, happened_at=clock.now()))
            for stage in {old["stage"], payload.stage}:
                for index, deal_id in enumerate(connection.scalars(select(deals.c.id).where(deals.c.stage == stage).order_by(deals.c.position, deals.c.name))):
                    connection.execute(update(deals).where(deals.c.id == deal_id).values(position=index))
            return deal_payload(connection, connection.execute(select(deals).where(deals.c.id == record_id)).mappings().one())

    @router.get("/dashboard")
    def dashboard():
        with engine.connect() as connection:
            all_deals = [deal_payload(connection, r) for r in connection.execute(select(deals)).mappings()]
            open_deals = [d for d in all_deals if d["stage"] in OPEN_STAGES]
            month_start = clock.today().replace(day=1)
            won = [d for d in all_deals if d["stage"] == "Won" and d["actual_close_date"] and d["actual_close_date"][:7] == month_start.isoformat()[:7]]
            activity_rows = list(connection.execute(select(activities).order_by(activities.c.happened_at.desc()).limit(10)).mappings())
            pending = [activity_payload(connection, r) for r in connection.execute(select(activities).where(activities.c.follow_up_date.is_not(None), activities.c.done == False).order_by(activities.c.follow_up_date)).mappings()]
            return {"open_pipeline": sum(d["value_usd"] for d in open_deals), "open_expected_revenue": sum(float(expected_revenue(d["value_usd"], d["probability"])) for d in open_deals), "won_this_month": sum(d["value_usd"] for d in won), "deals_won": len(won), "late_deals": sum(is_late(d["stage"], date.fromisoformat(d["expected_close_date"]) if d["expected_close_date"] else None, clock.today()) for d in open_deals), "pending_follow_ups": pending, "recent_activity": [activity_payload(connection, r) for r in activity_rows]}

    return router
