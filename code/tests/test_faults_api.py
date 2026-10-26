from datetime import date, timedelta

VALID = {
    "asset_tag": "ws-drill-04",
    "equipment_name": "Pillar drill",
    "location": "Metal bay",
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
    assert fault["asset_tag"] == "WS-DRILL-04"

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


def test_rejects_missing_location(client):
    response = client.post("/api/faults", json={**VALID, "location": " "})
    assert response.status_code == 422


def test_search_matches_tag_or_name(client):
    create(client, asset_tag="WS-SAW-02", equipment_name="Band saw")
    create(client, asset_tag="WS-LATHE-01", equipment_name="Wood lathe")

    by_name = client.get("/api/faults", params={"q": "lathe"}).json()
    by_tag = client.get("/api/faults", params={"q": "saw-0"}).json()
    assert [f["equipment_name"] for f in by_name] == ["Wood lathe"]
    assert [f["asset_tag"] for f in by_tag] == ["WS-SAW-02"]


def test_search_treats_wildcards_literally(client):
    create(client)
    assert client.get("/api/faults", params={"q": "%"}).json() == []


def test_filter_by_status(client):
    create(client, repair_status="Repaired")
    create(client, repair_status="Reported")

    repaired = client.get("/api/faults", params={"status": "Repaired"}).json()
    assert [f["repair_status"] for f in repaired] == ["Repaired"]
    assert client.get("/api/faults", params={"status": "Lost"}).status_code == 422


NOTE = {"note_date": "2026-10-21", "note": "Ordered a replacement chuck key"}


def test_note_crud(client):
    fault = create(client)
    url = f"/api/faults/{fault['id']}/notes"

    created = client.post(url, json=NOTE)
    assert created.status_code == 201
    note_id = created.json()["id"]

    changed = client.put(f"/api/notes/{note_id}", json={**NOTE, "note": "Chuck replaced"})
    assert changed.json()["note"] == "Chuck replaced"
    assert [n["note"] for n in client.get(url).json()] == ["Chuck replaced"]

    assert client.delete(f"/api/notes/{note_id}").status_code == 204
    assert client.get(url).json() == []


def test_notes_newest_first(client):
    fault = create(client)
    url = f"/api/faults/{fault['id']}/notes"
    client.post(url, json={**NOTE, "note_date": "2026-10-20", "note": "First look"})
    client.post(url, json={**NOTE, "note_date": "2026-10-22", "note": "Part fitted"})
    assert [n["note"] for n in client.get(url).json()] == ["Part fitted", "First look"]


def test_note_date_must_follow_report(client):
    fault = create(client, reported_date="2026-10-20")
    url = f"/api/faults/{fault['id']}/notes"

    before = client.post(url, json={**NOTE, "note_date": "2026-10-19"})
    assert before.status_code == 422
    assert before.json()["detail"][0]["loc"][-1] == "note_date"
    future = (date.today() + timedelta(days=1)).isoformat()
    assert client.post(url, json={**NOTE, "note_date": future}).status_code == 422


def test_note_for_missing_fault_or_note(client):
    assert client.post("/api/faults/999/notes", json=NOTE).status_code == 404
    assert client.put("/api/notes/999", json=NOTE).status_code == 404
    assert client.delete("/api/notes/999").status_code == 404


def test_deleting_fault_removes_its_notes(client):
    fault = create(client)
    note = client.post(f"/api/faults/{fault['id']}/notes", json=NOTE).json()
    client.delete(f"/api/faults/{fault['id']}")
    assert client.put(f"/api/notes/{note['id']}", json=NOTE).status_code == 404
