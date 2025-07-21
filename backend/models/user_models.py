from sqlalchemy import Column, Integer, JSON, String, ForeignKey
from sqlalchemy.orm import relationship

from database.extensions import db


class Resume(db.Model):
    __tablename__ = 'resume'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Resume')
    hard_skills = Column(JSON)
    professional_experience = Column(JSON)
    education = Column(JSON)
    profile_id = Column(Integer, ForeignKey('profile.id', name='fk_resume_profile_id'), nullable=True)
    profile = relationship("Profile", back_populates="resumes")

    def __repr__(self):
        return (f"<Resume(id={self.id}, hard_skills={self.hard_skills},"
                f" professional_experience={self.professional_experience}, education={self.education})>")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "hard_skills": self.hard_skills,
            "professional_experience": self.professional_experience,
            "education": self.education
        }


class Profile(db.Model):
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
            "resumes": [resume.name for resume in self.resumes]
        }
