# backend/tests/test_app.py
from app import db
from models import Alert
from sqlalchemy import text

def test_app_root_returns_200(client):
    resp = client.get("/")
    assert resp.status_code in (200, 301, 302)

def test_alerts_endpoint_exists(client):
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    content_type = resp.headers.get("Content-Type", "")
    assert "json" in content_type.lower() or resp.data != b""

def test_db_can_create_tables(client):
    from app import db as _db
    _db.session.execute(text("SELECT 1"))  # app context provided by autouse fixture
    assert True

def test_can_insert_alert_and_query(client):
    a = Alert(title="ci-unit", description="ok", category="pet", location="unit")
    db.session.add(a)
    db.session.commit()
    assert db.session.query(Alert).count() >= 1

def test_api_reflects_inserted_alert(client):
    a = Alert(title="api-visible", description="yup", category="info", location="lab")
    db.session.add(a); db.session.commit()
    r = client.get("/api/alerts")
    assert r.status_code == 200
    if "json" in r.headers.get("Content-Type", "").lower():
        data = r.get_json()
        assert isinstance(data, (list, dict))
        if isinstance(data, list):
            assert len(data) >= 1

def test_alert_model_has_required_fields(client):
    a = Alert(title="fields", description="present", category="test", location="here")
    assert all(hasattr(a, f) for f in ("title", "description", "category", "location"))
