# backend/models/email_models.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from models.base_model import Base

class Email(Base):
    __tablename__ = 'emails'

    id = Column(Integer, primary_key=True)

    # FIX: Changed 'profiles.id' to 'profile.id' (singular)
    profile_id = Column(Integer, ForeignKey('profile.id'))

    # --- Gmail Identifiers ---
    message_id = Column(String, unique=True, index=True)
    thread_id = Column(String, index=True, nullable=True)

    # --- Classification ---
    folder = Column(String, index=True)
    category = Column(String, index=True, nullable=True)

    # --- Content ---
    subject = Column(String)
    sender = Column(String)
    sender_email = Column(String)
    recipient = Column(String)

    snippet = Column(String)
    body_text = Column(Text)

    # --- Metadata ---
    received_at = Column(DateTime, index=True)
    created_at = Column(DateTime)
    is_read = Column(Boolean, default=False)

    headers_json = Column(JSON)

    def to_dict(self):
        return {
            "id": self.id,
            "thread_id": self.thread_id,
            "folder": self.folder,
            "sender": self.sender,
            "sender_email": self.sender_email,
            "subject": self.subject,
            "snippet": self.snippet,
            "receivedAt": self.received_at.isoformat() if self.received_at else None,
            "isRead": self.is_read
        }