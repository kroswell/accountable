from datetime import date, datetime, timedelta


def test_resource_lists_and_relationships(client):
    organizations = client.get("/api/organizations").json()
    contacts = client.get("/api/contacts").json()
    deals = client.get("/api/deals").json()
    assert len(organizations) >= 6
    assert len(contacts) >= 12
    assert len(deals) >= 18
    detail = client.get(f"/api/organizations/{organizations[0]['id']}")
    assert detail.status_code == 200
    assert "contacts" in detail.json()
    assert "deals" in detail.json()


def test_organization_delete_is_blocked(client):
    response = client.delete("/api/organizations/org-1")
    assert response.status_code == 409
    assert response.json()["detail"]["linked"]["contacts"]
    assert response.json()["detail"]["linked"]["deals"]


def test_contact_delete_clears_links_but_keeps_deal_and_activity(client):
    response = client.delete("/api/contacts/contact-1")
    assert response.status_code == 204
    deal = client.get("/api/deals/deal-1").json()
    assert deal["main_contact_id"] is None
    activities = client.get("/api/activities?deal_id=deal-1").json()
    assert activities
    assert "contact-1" not in activities[0]["contact_ids"]


def test_probability_and_stage_move_rules(client):
    created = client.post("/api/deals", json={
        "name": "Derived deal", "organization_id": "org-1", "stage": "New", "value_usd": 1000,
    }).json()
    assert created["probability"] == 10
    assert created["probability_source"] == "derived"
    moved = client.post(f"/api/deals/{created['id']}/move", json={"stage": "Proposal", "position": 0})
    assert moved.status_code == 200
    assert moved.json()["probability"] == 50
    manual = client.post("/api/deals", json={
        "name": "Manual deal", "organization_id": "org-1", "stage": "New", "value_usd": 1000, "probability": 37,
    }).json()
    moved = client.post(f"/api/deals/{manual['id']}/move", json={"stage": "Won", "position": 0}).json()
    assert moved["probability"] == 37
    assert moved["probability_source"] == "manual"


def test_deal_edit_stage_change_updates_derived_probability_and_timeline(client):
    created = client.post("/api/deals", json={
        "name": "Editable stage", "organization_id": "org-1", "stage": "New", "value_usd": 1000,
    }).json()
    updated = client.put(f"/api/deals/{created['id']}", json={
        "name": "Editable stage", "organization_id": "org-1", "stage": "Proposal",
        "value_usd": 1000,
    })
    assert updated.status_code == 200
    assert updated.json()["probability"] == 50
    assert updated.json()["probability_source"] == "derived"
    timeline = client.get(f"/api/deals/{created['id']}").json()["timeline"]
    assert any(item["kind"] == "stage_change" and item["to_stage"] == "Proposal" for item in timeline)


def test_pipeline_reorder_persists_exact_slot(client):
    board = client.get("/api/pipeline").json()
    source = next(column for column in board["columns"] if column["stage"] == "New")
    if len(source["cards"]) < 3:
        for index in range(3 - len(source["cards"])):
            client.post("/api/deals", json={
                "name": f"Reorder {index}", "organization_id": "org-1", "stage": "New", "value_usd": 100,
            })
    board = client.get("/api/pipeline").json()
    cards = next(column for column in board["columns"] if column["stage"] == "New")["cards"]
    deal_id = cards[-1]["id"]
    moved = client.post(f"/api/deals/{deal_id}/move", json={"stage": "New", "position": 0})
    assert moved.status_code == 200
    cards = next(column for column in client.get("/api/pipeline").json()["columns"] if column["stage"] == "New")["cards"]
    assert cards[0]["id"] == deal_id
    assert [card["position"] for card in cards] == list(range(len(cards)))


def test_activity_requires_link_and_can_link_both(client):
    invalid = client.post("/api/activities", json={
        "type": "Note", "description": "Unlinked", "happened_at": datetime.now().isoformat(),
    })
    assert invalid.status_code == 422
    valid = client.post("/api/activities", json={
        "type": "Call", "description": "Both links", "happened_at": datetime.now().isoformat(),
        "contact_id": "contact-2", "deal_id": "deal-2",
    })
    assert valid.status_code == 201
    assert valid.json()["contact_ids"] == ["contact-2"]
    assert valid.json()["deal_ids"] == ["deal-2"]


def test_dashboard_and_pipeline_totals_are_present(client):
    moved = client.post("/api/deals/deal-1/move", json={"stage": "Qualified", "position": 0})
    assert moved.status_code == 200
    dashboard = client.get("/api/dashboard")
    pipeline = client.get("/api/pipeline")
    assert dashboard.status_code == 200
    assert dashboard.json()["open_pipeline"] > 0
    assert len(pipeline.json()["columns"]) == 6
    assert pipeline.json()["open_value_usd"] == dashboard.json()["open_pipeline"]
    recent = dashboard.json()["recent_activity"]
    assert len(recent) <= 10
    assert any(item.get("kind") == "stage_change" for item in recent)
