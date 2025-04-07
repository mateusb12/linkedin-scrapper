from dataclasses import dataclass


@dataclass
class Recommendation:
    recommender_name: str
    recommender_job: str
    recommender_worked_with_date: str
    recommendation_description: str
