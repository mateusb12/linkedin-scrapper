# backend/models/email_models.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship

from models.base_model import Base


class Email(Base):
    __tablename__ = 'emails'

    id = Column(Integer, primary_key=True)

    # FIX: Changed 'profiles.id' to 'profile.id' (singular)
    profile_id = Column(Integer, ForeignKey('profile.id'))
    job_urn = Column(String, nullable=True, index=True)

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
            "job_urn": self.job_urn,
            "folder": self.folder,
            "category": self.category,
            "sender": self.sender,
            "sender_email": self.sender_email,
            "recipient": self.recipient,
            "subject": self.subject,
            "snippet": self.snippet,
            "body_text": self.body_text,
            "receivedAt": self.received_at.isoformat() if self.received_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "isRead": self.is_read,
        }
