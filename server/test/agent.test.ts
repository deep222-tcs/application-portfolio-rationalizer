import { describe, expect, it } from "vitest";
import { runPortfolioAgent } from "../src/agent.js";

describe("LangGraph portfolio agent", () => {
  it("calculates and classifies a migration candidate", async () => {
    const result = await runPortfolioAgent({
      clientName: "Northstar Bank", clientIndustry: "Banking",
      applicationName: "Payments Hub", owner: "Core Banking",
      scores: { business: [8,8,8,8,8], technology: [4,4,4,4,4], operations: [5,5,5,5,5] },
    });
    expect(result.weightedScore).toBe(5.85);
    expect(result.recommendation).toBe("Migrate");
    expect(result.completedNodes).toHaveLength(5);
  });
});
