import os
import io
import uuid
import mimetypes
from typing import Optional
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, send_file, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename
from sqlalchemy import func

from models import db, Alert

# -----------------------------
# App init
# -----------------------------
app = Flask(__name__)
CORS(app)

# Normalize DATABASE_URL (supports sqlite and postgres)
def _compute_database_url() -> str:
    default_sqlite = f"sqlite:////{os.path.abspath(os.path.join(os.path.dirname(__file__), 'resqpost.db'))}"
    url = os.environ.get("DATABASE_URL", default_sqlite)

    # normalize postgres prefixes for SQLAlchemy+psycopg2
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url

app.config["SQLALCHEMY_DATABASE_URI"] = _compute_database_url()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config.setdefault("SQLALCHEMY_ENGINE_OPTIONS", {"pool_pre_ping": True})

# Uploads (local for now)
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# DB init
db.init_app(app)

# Make sure newer mimetypes exist
mimetypes.add_type("image/avif", ".avif", strict=False)
mimetypes.add_type("image/webp", ".webp", strict=False)

# -----------------------------
# Helpers
# -----------------------------
def _normalize_image_url(url: Optional[str]) -> Optional[str]:
    """
    Return an absolute URL for local uploads, leave http(s) untouched.
    Example: http://127.0.0.1:5000/uploads/abc.jpg
    """
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = request.host_url.rstrip("/")  # e.g. http://127.0.0.1:5000
    path = url if url.startswith("/") else f"/{url}"
    return f"{base}{path}"
# def _normalize_image_url(url: Optional[str]) -> Optional[str]:
#     """Ensure local paths are absolute (/uploads/...). Leave http(s) untouched."""
#     if not url:
#         return url
#     if url.startswith("http://") or url.startswith("https://"):
#         return url
#     return url if url.startswith("/") else f"/{url}"

def _save_local_bytes(raw_bytes: bytes, original_filename: Optional[str]) -> str:
    """Write bytes to local uploads dir; return /uploads/... URL path."""
    fn = secure_filename(original_filename or "upload")
    unique = f"{uuid.uuid4()}_{fn}"
    path = os.path.join(app.config["UPLOAD_FOLDER"], unique)
    with open(path, "wb") as out:
        out.write(raw_bytes)
    return f"/uploads/{unique}"

def upload_image(file_storage) -> Optional[str]:
    """
    Read upload once and save locally (for now).
    If you later enable S3/Wasabi, wrap a BytesIO(raw_bytes) for that upload.
    """
    if not file_storage or not file_storage.filename:
        return None
    raw_bytes = file_storage.read()
    if not raw_bytes:
        return None
    return _save_local_bytes(raw_bytes, file_storage.filename)

# -----------------------------
# API routes
# -----------------------------
@app.get("/api/alerts")
def get_alerts():
    try:
        query = Alert.query

        category = request.args.get("category")
        if category in ("person", "pet"):
            query = query.filter(Alert.category == category)

        location = request.args.get("location")
        if location:
            query = query.filter(func.lower(Alert.location).like(f"%{location.lower()}%"))

        resolved = request.args.get("resolved")
        if resolved is not None:
            query = query.filter(Alert.is_resolved == (resolved.lower() == "true"))

        days = request.args.get("days", 30)
        try:
            days = int(days)
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            # DB stores naive UTC; compare with naive
            query = query.filter(Alert.created_at >= cutoff.replace(tzinfo=None))
        except Exception:
            pass

        alerts = query.order_by(Alert.created_at.desc()).all()
        payload = []
        for a in alerts:
            d = a.to_dict()
            d["image_url"] = _normalize_image_url(d.get("image_url"))
            payload.append(d)

        return jsonify({"success": True, "alerts": payload, "count": len(payload)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.post("/api/alerts")
def create_alert():
    try:
        data = request.form.to_dict()

        # required fields
        for field in ("title", "description", "category", "location"):
            if not data.get(field):
                return jsonify({"success": False, "error": f"{field} is required"}), 400

        # image upload (local for now)
        image_url = None
        if "image" in request.files:
            image_url = upload_image(request.files["image"])
        image_url = _normalize_image_url(image_url)

        alert = Alert(
            title=data["title"],
            description=data["description"],
            category=data["category"],
            location=data["location"],
            latitude=float(data["latitude"]) if data.get("latitude") else None,
            longitude=float(data["longitude"]) if data.get("longitude") else None,
            image_url=image_url,
            contact_name=data.get("contact_name"),
            contact_phone=data.get("contact_phone"),
            contact_email=data.get("contact_email"),
        )

        db.session.add(alert)
        db.session.commit()

        d = alert.to_dict()
        d["image_url"] = _normalize_image_url(d.get("image_url"))

        return jsonify({"success": True, "alert": d, "message": "Alert created successfully"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.get("/api/alerts/<alert_id>")
def get_alert(alert_id):
    try:
        a = Alert.query.get_or_404(alert_id)
        d = a.to_dict()
        d["image_url"] = _normalize_image_url(d.get("image_url"))
        return jsonify({"success": True, "alert": d})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.patch("/api/alerts/<alert_id>/resolve")
def resolve_alert(alert_id):
    try:
        a = Alert.query.get_or_404(alert_id)
        a.is_resolved = True
        a.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        d = a.to_dict()
        d["image_url"] = _normalize_image_url(d.get("image_url"))
        return jsonify({"success": True, "alert": d, "message": "Alert marked as resolved"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.get("/api/alerts/nearby")
def get_nearby_alerts():
    try:
        lat = request.args.get("latitude", type=float)
        lon = request.args.get("longitude", type=float)
        radius = request.args.get("radius", 10, type=float)  # km
        if lat is None or lon is None:
            return jsonify({"success": False, "error": "Latitude and longitude are required"}), 400

        alerts = Alert.query.filter(
            Alert.latitude.isnot(None),
            Alert.longitude.isnot(None),
            Alert.is_resolved == False,
        ).all()

        nearby = []
        for a in alerts:
            lat_diff = abs(a.latitude - lat)
            lon_diff = abs(a.longitude - lon)
            distance = ((lat_diff ** 2) + (lon_diff ** 2)) ** 0.5 * 111  # km
            if distance <= radius:
                d = a.to_dict()
                d["image_url"] = _normalize_image_url(d.get("image_url"))
                d["distance"] = round(distance, 2)
                nearby.append(d)

        return jsonify({"success": True, "alerts": nearby, "count": len(nearby)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.get("/api/health")
def health_check():
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return jsonify({"status": "healthy", "timestamp": ts, "version": "1.0.0"})

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    safe = os.path.normpath(filename).lstrip(os.sep)
    full_path = os.path.join(app.config["UPLOAD_FOLDER"], safe)
    if not os.path.isfile(full_path):
        app.logger.warning("Upload not found: %s", full_path)
        abort(404)
    resp = send_file(full_path, conditional=True)
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp

# -----------------------------
# Boot
# -----------------------------
with app.app_context():
    # Ensure the 'alerts' table exists in the *current* database (Postgres or SQLite)
    db.create_all()
with app.app_context():
    db.create_all()
    print("[DB] Using:", app.config["SQLALCHEMY_DATABASE_URI"])


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
