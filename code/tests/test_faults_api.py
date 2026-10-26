"""API tests for the fault register CRUD routes and validation rules."""

from datetime import date, timedelta

VALID = {
    "asset_tag": "ws-drill-04",
    "equipment_name": "Pillar drill",
    "fault_description": "Chuck wobbles at high speed",
    "reported_date": "2026-10-20",
    "repair_status": "Reported",
}


def create(client, **changes):
    response = client.post("/api/faults", json={**VALID, **changes})
    assert response.status_code == 201, response.text
    return response.json()


def test_health_reports_database_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_then_read_back(client):
    fault = create(client)
    assert fault["asset_tag"] == "WS-DRILL-04"  # tags are stored in capitals

    response = client.get(f"/api/faults/{fault['id']}")
    assert response.status_code == 200
    assert response.json()["equipment_name"] == "Pillar drill"


def test_list_is_newest_first(client):
    create(client, equipment_name="Old saw", reported_date="2026-01-05")
    create(client, equipment_name="New lathe", reported_date="2026-10-01")

    names = [f["equipment_name"] for f in client.get("/api/faults").json()]
    assert names == ["New lathe", "Old saw"]


def test_update_changes_only_sent_values(client):
    fault = create(client)
    changed = {**VALID, "repair_status": "In repair"}

    response = client.put(f"/api/faults/{fault['id']}", json=changed)
    assert response.status_code == 200
    body = response.json()
    assert body["repair_status"] == "In repair"
    assert body["fault_description"] == VALID["fault_description"]


def test_delete_removes_record(client):
    fault = create(client)
    assert client.delete(f"/api/faults/{fault['id']}").status_code == 204
    assert client.get(f"/api/faults/{fault['id']}").status_code == 404


def test_missing_record_returns_404(client):
    assert client.get("/api/faults/999").status_code == 404
    assert client.put("/api/faults/999", json=VALID).status_code == 404
    assert client.delete("/api/faults/999").status_code == 404


def test_rejects_blank_required_text(client):
    response = client.post("/api/faults", json={**VALID, "equipment_name": "   "})
    assert response.status_code == 422


def test_rejects_unknown_status(client):
    response = client.post("/api/faults", json={**VALID, "repair_status": "Lost"})
    assert response.status_code == 422


def test_rejects_future_date(client):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/api/faults", json={**VALID, "reported_date": tomorrow})
    assert response.status_code == 422


def test_rejects_bad_asset_tag(client):
    response = client.post("/api/faults", json={**VALID, "asset_tag": "WS 04!"})
    assert response.status_code == 422


def test_rejects_too_long_description(client):
    response = client.post("/api/faults", json={**VALID, "fault_description": "x" * 1001})
    assert response.status_code == 422
