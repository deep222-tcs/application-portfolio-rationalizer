from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Domain = Literal["business", "technology", "operations"]
Recommendation = Literal["Tolerate", "Invest", "Migrate", "Eliminate"]


class Scores(BaseModel):
    business: list[int] = Field(min_length=5, max_length=5)
    technology: list[int] = Field(min_length=5, max_length=5)
    operations: list[int] = Field(min_length=5, max_length=5)

    def model_post_init(self, __context: object) -> None:
        for values in (self.business, self.technology, self.operations):
            if any(value < 1 or value > 10 for value in values):
                raise ValueError("Scores must be between 1 and 10")


class AssessmentInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    client_name: str = Field(alias="clientName", min_length=1)
    client_industry: str = Field(alias="clientIndustry", default="")
    application_name: str = Field(alias="applicationName", min_length=1)
    owner: str = ""
    scores: Scores


class AgentResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    averages: dict[Domain, float]
    weighted_score: float = Field(alias="weightedScore")
    threshold_passed: bool = Field(alias="thresholdPassed")
    recommendation: Recommendation
    rationale: str
    modernization_actions: list[str] = Field(alias="modernizationActions")
    completed_nodes: list[str] = Field(alias="completedNodes")
