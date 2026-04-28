from sqlalchemy import Column, Integer, JSON, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from models import Base


class Resume(Base):
    __tablename__ = 'resume'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Resume')

    resume_language = Column(String, nullable=True, default="pt-BR")

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
        """

        final_contacts = self.contact_info or {}
        profile_name = self.name

        if not final_contacts and self.profile:
            profile_name = self.profile.name
            final_contacts = {
                "phone": self.profile.phone,
                "email": self.profile.email,
                "linkedin": self.profile.linkedin,
                "github": self.profile.github,
                "portfolio": self.profile.portfolio
            }

        final_education = self.education
        if not final_education and self.profile and self.profile.education:
            final_education = self.profile.education

        final_languages = self.languages
        if not final_languages and self.profile and self.profile.languages:
            final_languages = [
                {"name": lang, "level": "Proficient"}
                for lang in self.profile.languages
            ]

        lang = (self.resume_language or "PT").upper()

        if lang in ["PT", "PTBR", "PT-BR"]:
            final_language = "pt-BR"
        elif lang in ["EN", "ENG", "EN-US"]:
            final_language = "en-US"
        else:
            final_language = "pt-BR"

        merged_meta = self.meta.copy() if self.meta else {}
        merged_meta["language"] = final_language

        merged_meta.setdefault("page", {"size": "letter", "font_size": 11})

        return {
            "id": self.id,
            "internal_name": self.name,
            "resume_language": self.resume_language,
            "summary": self.summary or "",
            "profile_id": self.profile_id,
            "meta": merged_meta,
            "profile": {
                "name": profile_name,
                "contacts": final_contacts
            },
            "contacts": final_contacts,
            "experience": self.professional_experience or [],
            "projects": self.projects or [],
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
