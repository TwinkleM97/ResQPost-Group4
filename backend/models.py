from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import uuid

db = SQLAlchemy()

def _iso_utc(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")

class Alert(db.Model):
    __tablename__ = 'alerts'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(20), nullable=False)  # 'person' or 'pet'
    location = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    contact_name = db.Column(db.String(100), nullable=True)
    contact_phone = db.Column(db.String(20), nullable=True)
    contact_email = db.Column(db.String(100), nullable=True)
    is_resolved = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
                           onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    messages = db.relationship(
        "ChatMessage",
        backref="alert",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'image_url': self.image_url,
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'is_resolved': self.is_resolved,
            'created_at': _iso_utc(self.created_at),
            'updated_at': _iso_utc(self.updated_at),
        }

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = db.Column(db.String(36), db.ForeignKey('alerts.id', ondelete="CASCADE"), nullable=False)
    sender_name = db.Column(db.String(80), nullable=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "sender_name": self.sender_name,
            "text": self.text,
            "created_at": self.created_at.isoformat() + "Z",
        }