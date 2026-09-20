from backend.agent import run_portfolio_agent
from backend.models import AssessmentInput


def test_weighted_score_and_time_classification():
    assessment = AssessmentInput.model_validate({
        "clientName": "Northstar Bank",
        "clientIndustry": "Financial Services",
        "applicationName": "Payments Hub",
        "owner": "Core Banking",
        "scores": {
            "business": [6, 7, 6, 5, 7],
            "technology": [4, 5, 4, 6, 5],
            "operations": [5, 4, 5, 4, 6],
        },
    })
    result = run_portfolio_agent(assessment)
    assert result.weighted_score == 5.36
    assert result.threshold_passed is True
    assert result.recommendation == "Migrate"
    assert result.completed_nodes[-1] == "generate-recommendation"
