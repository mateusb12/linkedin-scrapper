from sqlalchemy import Column, Integer, JSON, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from models import Base

class Resume(Base):
    __tablename__ = 'resume'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Resume')

    # New columns for the specific template overrides
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

    def __repr__(self):
        return (f"<Resume(id={self.id}, name='{self.name}'>")

    def to_dict(self):
        """
        Returns dictionary matching the JSON Template.
        PRIORITY: Resume Data > Profile Data > Default/Empty.
        """

        # 1. Resolve Contact Info
        # Default to Resume-specific contacts. If empty, build from Profile.
        contacts = self.contact_info
        profile_name = self.name # Default to resume internal name

        if not contacts and self.profile:
            profile_name = self.profile.name
            contacts = {
                "phone": self.profile.phone,
                "email": self.profile.email,
                "linkedin": self.profile.linkedin,
                "github": self.profile.github,
                "portfolio": self.profile.portfolio
            }

        # 2. Resolve Education
        # If Resume education is empty/null, use Profile education
        education_data = self.education
        if not education_data and self.profile and self.profile.education:
            education_data = self.profile.education

        # 3. Resolve Languages
        languages_data = self.languages
        if not languages_data and self.profile and self.profile.languages:
            # Profile languages might be simple strings, template expects objects.
            # We pass whatever is in Profile, frontend/template should handle normalization if needed.
            languages_data = self.profile.languages

        # 4. Resolve Skills
        # If hard_skills is empty, maybe grab positive_keywords from profile?
        skills_data = self.hard_skills
        if not skills_data and self.profile and self.profile.positive_keywords:
            # The template expects categorized skills (object), profile has a list.
            # We map the list to a "general" category to avoid breaking the UI.
            skills_data = {
                "general": self.profile.positive_keywords
            }

        return {
            "id": self.id,
            "internal_name": self.name,

            # Template Structure
            "meta": self.meta or {
                "language": "pt-BR",
                "page": {"size": "letter", "font_size": 11}
            },
            "profile": {
                "name": profile_name,
                "contacts": contacts or {}
            },
            "experience": self.professional_experience or [],
            "projects": self.projects or [],
            "education": education_data or [],
            "skills": skills_data or {},
            "languages": languages_data or []
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