from sqlalchemy import Column, Integer, JSON, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from models import Base

class Resume(Base):
    __tablename__ = 'resume'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Resume')

    meta = Column(JSON, nullable=True)
    contact_info = Column(JSON, nullable=True)
    languages = Column(JSON, nullable=True)

    summary = Column(Text, nullable=True)
    hard_skills = Column(JSON)
    professional_experience = Column(JSON)
    education = Column(JSON)
    projects = Column(JSON, nullable=True)

    profile_id = Column(Integer, ForeignKey('profile.id', name='fk_resume_profile_id'), nullable=True)
    profile = relationship("Profile", back_populates="resumes")

    def to_dict(self):
        """
        Constructs the JSON payload.
        Logic: Use Resume field -> If missing, use Profile field -> If missing, use default.
        """

        # 1. Profile / Contacts Logic
        # We default to the stored resume contact_info.
        # If null, we build it from the linked Profile object.
        final_contacts = self.contact_info or {}
        profile_name = self.name # Default to resume name

        if not final_contacts and self.profile:
            profile_name = self.profile.name
            final_contacts = {
                "phone": self.profile.phone,
                "email": self.profile.email,
                "linkedin": self.profile.linkedin,
                "github": self.profile.github,
                "portfolio": self.profile.portfolio
            }

        # 2. Education Logic
        final_education = self.education
        if not final_education and self.profile and self.profile.education:
            final_education = self.profile.education

        # 3. Languages Logic
        # Profile has ["English", "Portuguese"] (Strings)
        # Resume needs [{"name": "English", "level": "Fluent"}] (Objects)
        final_languages = self.languages
        if not final_languages and self.profile and self.profile.languages:
            # Quick conversion from String Array -> Object Array
            final_languages = [
                {"name": lang, "level": "Proficient"}
                for lang in self.profile.languages
            ]

        return {
            "id": self.id,
            "internal_name": self.name,

            # --- JSON STRUCTURE TARGET ---
            "meta": self.meta or {
                "language": "pt-BR",
                "page": {"size": "letter", "font_size": 11}
            },
            "profile": {
                "name": profile_name,
                "contacts": final_contacts
            },
            "experience": self.professional_experience or [],
            "projects": self.projects or [], # Links are handled inside the JSON data here
            "education": final_education or [],
            "skills": self.hard_skills or {},
            "languages": final_languages or []
        }


class Profile(Base):
    __tablename__ = 'profile'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Profile')
    email = Column(String, nullable=False, unique=True)
    phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    linkedin = Column(String, nullable=True)
    github = Column(String, nullable=True)
    portfolio = Column(String, nullable=True)

    languages = Column(JSON, nullable=True)
    positive_keywords = Column(JSON, nullable=True)
    negative_keywords = Column(JSON, nullable=True)
    education = Column(JSON, nullable=True)

    resumes = relationship("Resume", back_populates="profile", cascade="all, delete-orphan")
    email_app_password = Column(String, nullable=True)

    def __repr__(self):
        return f"<Profile(id={self.id}, name={self.name}, email={self.email})>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "location": self.location,
            "linkedin": self.linkedin,
            "github": self.github,
            "portfolio": self.portfolio,
            "languages": self.languages,
            "positive_keywords": self.positive_keywords,
            "negative_keywords": self.negative_keywords,
            "education": self.education,
            "resumes": [resume.name for resume in self.resumes],
            "email_app_password": self.email_app_password
        }