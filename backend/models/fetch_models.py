from sqlalchemy import Column, String, Integer, CheckConstraint

from backend.models.base_model import Base


class FetchCurls(Base):
    __tablename__ = 'fetch_curls'

    id = Column(Integer, primary_key=True, default=1, server_default="1")

    pagination_curl = Column(String, nullable=False)
    individual_job_curl = Column(String, nullable=False)

    __table_args__ = (
        CheckConstraint("id = 1", name="fetch_curls_singleton_chk"),
    )

    def __repr__(self):
        return (f"<FetchCurls(pagination_curl='{self.pagination_curl}',"
                f" individual_job_curl='{self.individual_job_curl}')>")
