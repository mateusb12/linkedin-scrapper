from sqlalchemy import Column, Integer, JSON, String

from database.extensions import db


class Resume(db.Model):
    __tablename__ = 'resume'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default='Unnamed Resume')
    hard_skills = Column(JSON)
    professional_experience = Column(JSON)
    education = Column(JSON)

    def __repr__(self):
        return f"<Resume(id={self.id}, hard_skills={self.hard_skills}, professional_experience={self.professional_experience}, education={self.education})>"

    def to_dict(self):
        return {
            "id": self.id,
            "hard_skills": self.hard_skills,
            "professional_experience": self.professional_experience,
            "education": self.education
        }
