from sqlalchemy import Column, Integer, JSON, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from models import Base


class Resume(Base):
    __tablename__ = 'resume'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Resume')
    summary = Column(Text, nullable=True)  # Added summary field
    hard_skills = Column(JSON)
    professional_experience = Column(JSON)
    education = Column(JSON)
    projects = Column(JSON, nullable=True)  # Added projects field
    profile_id = Column(Integer, ForeignKey('profile.id', name='fk_resume_profile_id'), nullable=True)
    profile = relationship("Profile", back_populates="resumes")

    def __repr__(self):
        return (f"<Resume(id={self.id}, name='{self.name}', summary='{self.summary[:50]}...', "
                f"projects={self.projects}, hard_skills={self.hard_skills},"
                f" professional_experience={self.professional_experience}, education={self.education})>")

    def to_dict(self):
        hard_skills = self.hard_skills
        if self.profile and self.profile.positive_keywords:
            hard_skills = self.profile.positive_keywords
        return {
            "id": self.id,
            "name": self.name,
            "summary": self.summary,
            "hard_skills": hard_skills,
            "professional_experience": self.professional_experience,
            "education": self.education,
            "projects": self.projects
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
    resumes = relationship("Resume", back_populates="profile", cascade="all, delete-orphan")

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
            "resumes": [resume.name for resume in self.resumes]
        }