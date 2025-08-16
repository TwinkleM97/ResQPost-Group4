# backend/app.py
import os
import uuid
from typing import Optional
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, abort, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from sqlalchemy import text, create_engine
from werkzeug.exceptions import RequestEntityTooLarge
import mimetypes

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from models import db, Alert, ChatMessage
from flask_socketio import SocketIO, emit, join_room, leave_room

# -----------------------------
# App / DB / CORS configuration
# -----------------------------
app = Flask(__name__)

# Socket.IO (works with gunicorn -k eventlet)
ASYNC_MODE = os.environ.get("SOCKETIO_ASYNC_MODE", "eventlet")

@app.after_request
def no_cache_for_api(resp):
    if request.path.startswith('/api/'):
        resp.headers['Cache-Control'] = 'no-store'
    return resp

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    'postgresql://postgres:password@localhost:5432/resqpost'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Local upload settings (still supported for dev/fallback)
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads')
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_MB * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.errorhandler(RequestEntityTooLarge)
def too_big(e):
    return jsonify(success=False, error=f"Image too large. Max {MAX_UPLOAD_MB} MB."), 413

CORS(app)
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=ASYNC_MODE)

# -----------------------------
# S3 config
# -----------------------------
S3_BUCKET       = os.getenv("S3_BUCKET") or ""           # bucket name
AWS_REGION      = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or ""
S3_PUBLIC_READ  = (os.getenv("S3_PUBLIC_READ", "true").lower() == "true")
S3_SIGN_EXPIRES = int(os.getenv("S3_SIGN_EXPIRES", "300"))  # seconds

_s3 = None
def _s3_client():
    """Lazily construct a boto3 S3 client using instance role or env creds."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=(AWS_REGION or None))
    return _s3

def _s3_key_for(filename: str) -> str:
    safe = secure_filename(filename or "upload")
    return f"uploads/{uuid.uuid4()}_{safe}"

def _s3_public_url(key: str) -> str:
    """Build the virtual-hosted–style URL."""
    if not AWS_REGION or AWS_REGION == "us-east-1":
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

def _s3_signed_url(key: str) -> Optional[str]:
    try:
        return _s3_client().generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=S3_SIGN_EXPIRES,
        )
    except Exception:
        return None

def _normalize_image_for_response(stored: Optional[str]) -> Optional[str]:
    """
    We store either:
      - local path like '/uploads/abc.jpg'
      - bare S3 key like 'uploads/abc.jpg'
      - absolute http(s) URL (leave as-is)

    Convert to a client-usable URL.
    """
    if not stored:
        return stored

    u = stored.strip()
    if u.startswith("http://") or u.startswith("https://"):
        return u

    # Local file path
    if u.startswith("/uploads/"):
        return u

    # Bare S3 key
    if S3_BUCKET and u.startswith("uploads/"):
        return _s3_public_url(u) if S3_PUBLIC_READ else (_s3_signed_url(u) or _s3_public_url(u))

    return u

def _save_local(file_storage) -> str:
    safe = secure_filename(file_storage.filename or 'upload')
    unique = f"{uuid.uuid4()}_{safe}"
    path = os.path.join(app.config['UPLOAD_FOLDER'], unique)
    file_storage.save(path)
    return f"/uploads/{unique}"

def _save_s3(file_storage) -> str:
    """
    Upload to S3 and return the *key* we store in DB (e.g. 'uploads/<uuid>_file.ext').
    Frontend URL is resolved via _normalize_image_for_response().
    """
    key = _s3_key_for(file_storage.filename)
    content_type = file_storage.mimetype or "application/octet-stream"
    extra = {"ContentType": content_type}

    # Do NOT set ACLs; bucket should be configured via policy (public) or we sign URLs.
    try:
        _s3_client().upload_fileobj(file_storage.stream, S3_BUCKET, key, ExtraArgs=extra)
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"S3 upload failed: {e}")
    return key

def upload_image(file_storage) -> Optional[str]:
    """
    Store image in S3 if bucket configured, else locally.
    Returns value to store in DB.
    - S3 path: 'uploads/....'
    - Local: '/uploads/....'
    """
    if not file_storage or not file_storage.filename:
        return None
    if S3_BUCKET:
        return _save_s3(file_storage)
    return _save_local(file_storage)

# -----------------------------
# Alerts API
# -----------------------------
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        query = Alert.query

        cat = request.args.get('category')
        if cat in ('person', 'pet'):
            query = query.filter(Alert.category == cat)

        loc = request.args.get('location')
        if loc:
            query = query.filter(Alert.location.ilike(f'%{loc}%'))

        resolved = request.args.get('resolved')
        if resolved is not None:
            query = query.filter(Alert.is_resolved == (resolved.lower() == 'true'))

        days = request.args.get('days', 30)
        try:
            days = int(days)
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            query = query.filter(Alert.created_at >= cutoff)
        except Exception:
            pass

        alerts = query.order_by(Alert.created_at.desc()).all()

        payload = []
        for a in alerts:
            d = a.to_dict()
            d['image_url'] = _normalize_image_for_response(d.get('image_url'))
            payload.append(d)

        return jsonify({'success': True, 'alerts': payload, 'count': len(payload)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route("/health")
def health():
    return {"status": "ok"}, 200
@app.route('/api/alerts', methods=['POST'])

def create_alert():
    try:
        data = request.form.to_dict()

        for field in ('title', 'description', 'category', 'location'):
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400

        img_val = None
        if 'image' in request.files:
            img_val = upload_image(request.files['image'])

        alert = Alert(
            title=data['title'],
            description=data['description'],
            category=data['category'],
            location=data['location'],
            latitude=float(data['latitude']) if data.get('latitude') else None,
            longitude=float(data['longitude']) if data.get('longitude') else None,
            image_url=img_val,  # store S3 key or local path
            contact_name=data.get('contact_name'),
            contact_phone=data.get('contact_phone'),
            contact_email=data.get('contact_email')
        )
        db.session.add(alert)
        db.session.commit()

        d = alert.to_dict()
        d['image_url'] = _normalize_image_for_response(d.get('image_url'))
        return jsonify({'success': True, 'alert': d, 'message': 'Alert created successfully'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/alerts/<alert_id>', methods=['GET'])
def get_alert(alert_id):
    try:
        alert = Alert.query.get_or_404(alert_id)
        d = alert.to_dict()
        d['image_url'] = _normalize_image_for_response(d.get('image_url'))
        return jsonify({'success': True, 'alert': d})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/alerts/<alert_id>/resolve', methods=['PATCH'])
def resolve_alert(alert_id):
    try:
        alert = Alert.query.get_or_404(alert_id)
        alert.is_resolved = True
        alert.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        d = alert.to_dict()
        d['image_url'] = _normalize_image_for_response(d.get('image_url'))
        return jsonify({'success': True, 'alert': d, 'message': 'Alert marked as resolved'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/alerts/nearby', methods=['GET'])
def get_nearby_alerts():
    try:
        lat = request.args.get('latitude', type=float)
        lon = request.args.get('longitude', type=float)
        radius = request.args.get('radius', 10, type=float)

        if lat is None or lon is None:
            return jsonify({'success': False, 'error': 'Latitude and longitude are required'}), 400

        alerts = Alert.query.filter(
            Alert.latitude.isnot(None),
            Alert.longitude.isnot(None),
            Alert.is_resolved == False
        ).all()

        nearby = []
        for a in alerts:
            lat_diff = abs(a.latitude - lat)
            lon_diff = abs(a.longitude - lon)
            distance = ((lat_diff ** 2) + (lon_diff ** 2)) ** 0.5 * 111
            if distance <= radius:
                d = a.to_dict()
                d['image_url'] = _normalize_image_for_response(d.get('image_url'))
                d['distance'] = round(distance, 2)
                nearby.append(d)

        return jsonify({'success': True, 'alerts': nearby, 'count': len(nearby)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# -----------------------------
# Chat API (REST) + WebSockets
# -----------------------------
@app.route('/api/alerts/<alert_id>/messages', methods=['GET'])
def list_messages(alert_id):
    Alert.query.get_or_404(alert_id)
    msgs = ChatMessage.query.filter_by(alert_id=alert_id).order_by(ChatMessage.created_at.asc()).all()
    return jsonify({"success": True, "messages": [m.to_dict() for m in msgs]})

@app.route('/api/alerts/<alert_id>/messages', methods=['POST'])
def create_message(alert_id):
    Alert.query.get_or_404(alert_id)
    data = request.get_json(force=True, silent=True) or {}
    text_body = (data.get("text") or "").strip()
    if not text_body:
        return jsonify({"success": False, "error": "text is required"}), 400

    msg = ChatMessage(
        alert_id=alert_id,
        sender_name=(data.get("sender_name") or "").strip() or None,
        text=text_body
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"success": True, "message": msg.to_dict()}), 201

@socketio.on('join_alert')
def on_join_alert(data):
    alert_id = str((data or {}).get('alert_id') or '')
    if not alert_id:
        return
    join_room(f"alert:{alert_id}")
    emit('joined', {"room": f"alert:{alert_id}"})

@socketio.on('leave_alert')
def on_leave_alert(data):
    alert_id = str((data or {}).get('alert_id') or '')
    if not alert_id:
        return
    leave_room(f"alert:{alert_id}")
    emit('left', {"room": f"alert:{alert_id}"})

@socketio.on('send_message')
def on_send_message(data):
    data = data or {}
    alert_id = str(data.get('alert_id') or '')
    text = (data.get('text') or '').strip()
    sender = (data.get('sender_name') or '').strip() or None
    if not alert_id or not text:
        return
    if not Alert.query.get(alert_id):
        return
    msg = ChatMessage(alert_id=alert_id, sender_name=sender, text=text)
    db.session.add(msg)
    db.session.commit()
    emit('new_message', msg.to_dict(), to=f"alert:{alert_id}")

# -----------------------------
# Health
# -----------------------------
# -----------------------------
# Root (simple OK for tests/healthchecks)
# -----------------------------
@app.route('/', methods=['GET'])
def root_ok():
    # keep it lightweight and cacheable by default
    return jsonify({"ok": True, "service": "resqpost-backend"}), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    ts = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    return jsonify({
        'status': 'healthy',
        'timestamp': ts,
        'version': '1.0.0',
        's3_bucket': S3_BUCKET,
        'aws_region': AWS_REGION,
        's3_public_read': S3_PUBLIC_READ,
        's3_sign_expires': S3_SIGN_EXPIRES
    })

# -----------------------------
# Serve local uploads (dev)
# -----------------------------
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    safe = os.path.normpath(filename).lstrip(os.sep)
    full_path = os.path.join(app.config['UPLOAD_FOLDER'], safe)
    if not os.path.isfile(full_path):
        app.logger.warning("Upload not found: %s", full_path)
        abort(404)
    resp = send_file(full_path, conditional=True)
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp

# -----------------------------
# Admin helper: delete all alerts
# -----------------------------
@app.route('/api/alerts', methods=['DELETE'])
def delete_all_alerts():
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM alerts"))
        conn.execute(text("DELETE FROM chat_messages"))
    return jsonify({"message": "All alerts and messages deleted successfully"}), 200

# Some Python builds don’t know these yet
mimetypes.add_type('image/avif', '.avif', strict=False)
mimetypes.add_type('image/webp', '.webp', strict=False)

# -----------------------------
# Boot (gunicorn runs this)
# -----------------------------
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    # For local dev only; prod uses gunicorn
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
