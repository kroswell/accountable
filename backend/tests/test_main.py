def test_root_redirects_to_frontend(client, monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_WEB_PORT", "5174")
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://127.0.0.1:5174/"


def test_health_route(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
