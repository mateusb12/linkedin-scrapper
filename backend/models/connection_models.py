# backend/models/connection_models.py

from sqlalchemy import Column, Integer, String, Text, JSON, Boolean
from models.base_model import Base


class LinkedInConnection(Base):
    __tablename__ = 'linkedin_connections'

    id = Column(Integer, primary_key=True)

    # Core Scraped Data
    profile_url = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    headline = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    connected_time = Column(String, nullable=True)

    # Deep Profile Data (Para popular depois com o Fetch Experience/About)
    vanity_name = Column(String, nullable=True)
    about = Column(Text, nullable=True)
    experiences = Column(JSON, nullable=True)
    education = Column(JSON, nullable=True)
    certifications = Column(JSON, nullable=True)
    skills = Column(JSON, nullable=True)

    # Flag de controle: define se a ficha está completa ou se é só a "casca" inicial
    is_fully_scraped = Column(Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "profile_url": self.profile_url,
            "name": self.name,
            "headline": self.headline,
            "image": self.image_url,
            "connected_time": self.connected_time,
            "vanity_name": self.vanity_name,
            "about": self.about,
            "experiences": self.experiences or [],
            "education": self.education or [],
            "certifications": self.certifications or [],
            "skills": self.skills or [],
            "is_fully_scraped": self.is_fully_scraped
        }
