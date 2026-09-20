from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .models import AgentResult, AssessmentInput, Recommendation


class AgentState(TypedDict, total=False):
    assessment: AssessmentInput
    averages: dict[str, float]
    weighted_score: float
    threshold_passed: bool
    recommendation: Recommendation
    rationale: str
    modernization_actions: list[str]
    completed_nodes: list[str]


def _append_node(state: AgentState, node: str) -> list[str]:
    return [*state.get("completed_nodes", []), node]


def validate_input(state: AgentState) -> AgentState:
    validated = AssessmentInput.model_validate(state["assessment"])
    return {"assessment": validated, "completed_nodes": _append_node(state, "validate")}


def calculate_averages(state: AgentState) -> AgentState:
    scores = state["assessment"].scores
    averages = {
        "business": sum(scores.business) / len(scores.business),
        "technology": sum(scores.technology) / len(scores.technology),
        "operations": sum(scores.operations) / len(scores.operations),
    }
    return {"averages": averages, "completed_nodes": _append_node(state, "calculate-averages")}


def calculate_weighted_score(state: AgentState) -> AgentState:
    averages = state["averages"]
    score = averages["business"] * 0.40 + averages["technology"] * 0.35 + averages["operations"] * 0.25
    return {
        "weighted_score": round(score, 2),
        "threshold_passed": score > 5,
        "completed_nodes": _append_node(state, "calculate-weighted-score"),
    }


def classify_time(state: AgentState) -> AgentState:
    averages = state["averages"]
    health = (averages["technology"] + averages["operations"]) / 2
    if averages["business"] >= 6 and health >= 6:
        recommendation: Recommendation = "Invest"
    elif averages["business"] >= 6:
        recommendation = "Migrate"
    elif health >= 6:
        recommendation = "Tolerate"
    else:
        recommendation = "Eliminate"
    return {"recommendation": recommendation, "completed_nodes": _append_node(state, "classify-time")}


def explain_recommendation(state: AgentState) -> AgentState:
    explanations = {
        "Invest": "High business value and healthy technology and operations support further investment.",
        "Migrate": "High business value with technology or operational constraints supports modernization.",
        "Tolerate": "Lower business value with acceptable platform health supports controlled continuation.",
        "Eliminate": "Lower business value and weak platform health support consolidation or retirement.",
    }
    actions = {
        "Invest": ["Fund product enhancements", "Increase automation", "Protect reliability objectives"],
        "Migrate": ["Define target architecture", "Plan phased migration", "Address resilience gaps"],
        "Tolerate": ["Control operating cost", "Limit discretionary change", "Monitor lifecycle risk"],
        "Eliminate": ["Confirm business dependencies", "Archive required data", "Execute retirement plan"],
    }
    recommendation = state["recommendation"]
    return {
        "rationale": explanations[recommendation],
        "modernization_actions": actions[recommendation],
        "completed_nodes": _append_node(state, "generate-recommendation"),
    }


builder = StateGraph(AgentState)
builder.add_node("validate_input", validate_input)
builder.add_node("domain_averages", calculate_averages)
builder.add_node("weighted_calculation", calculate_weighted_score)
builder.add_node("time_classification", classify_time)
builder.add_node("recommendation_explanation", explain_recommendation)
builder.add_edge(START, "validate_input")
builder.add_edge("validate_input", "domain_averages")
builder.add_edge("domain_averages", "weighted_calculation")
builder.add_edge("weighted_calculation", "time_classification")
builder.add_edge("time_classification", "recommendation_explanation")
builder.add_edge("recommendation_explanation", END)
portfolio_graph = builder.compile()


def run_portfolio_agent(assessment: AssessmentInput) -> AgentResult:
    result = portfolio_graph.invoke({"assessment": assessment, "completed_nodes": []})
    return AgentResult(
        averages=result["averages"],
        weightedScore=result["weighted_score"],
        thresholdPassed=result["threshold_passed"],
        recommendation=result["recommendation"],
        rationale=result["rationale"],
        modernizationActions=result["modernization_actions"],
        completedNodes=result["completed_nodes"],
    )
