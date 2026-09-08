import { scenarioPlanner } from "@/lib/agents/scenario-planner";
import { assetAgent } from "@/lib/agents/asset-agent";
import { configAgent } from "@/lib/agents/config-agent";
import { compositionAgent } from "@/lib/agents/composition-agent";
import { animationAgent } from "@/lib/agents/animation-agent";
import { qaAgent } from "@/lib/agents/qa-agent";
import { scenarioEngine } from "@/lib/scenario/engine";
import type { ScenarioConfig, ScenarioGenerationResult } from "@/lib/scenario/types";

export type OrchestrationRequest = {
  prompt?: string;
  config?: ScenarioConfig;
  outputType?: "image" | "animation";
  baseUrl?: string;
};

export class ScenarioOrchestrator {
  /**
   * Plans and prepares a validated ScenarioConfig from natural language or partial config.
   */
  prepareConfig(request: OrchestrationRequest): {
    config: ScenarioConfig;
    qa: ReturnType<typeof qaAgent.validate>;
  } {
    let finalConfig: ScenarioConfig;

    if (request.prompt) {
      // 1. Plan Intent
      const intent = scenarioPlanner.plan(request.prompt);
      if (request.outputType) {
        intent.isAnimation = request.outputType === "animation";
      }

      // 2. Match Assets
      const matchedAssets = assetAgent.match(intent.characterName, intent.sceneDescription);

      // 3. Assemble Config
      finalConfig = configAgent.createConfig(intent, matchedAssets, request.config);
    } else if (request.config) {
      finalConfig = { ...request.config };
    } else {
      throw new Error("Either prompt or config must be provided.");
    }

    // 4. Compose Characters
    finalConfig = compositionAgent.compose(finalConfig);

    // 5. Animation Agent
    if (request.outputType === "animation" || finalConfig.output?.type === "animation") {
      finalConfig = animationAgent.configureAnimation(finalConfig);
    }

    // 6. QA Agent Verification
    const qa = qaAgent.validate(finalConfig);
    if (!qa.valid) {
      const err: any = new Error(`QA validation failed: ${qa.errors.join(", ")}`);
      err.code = "INVALID_CONFIGURATION";
      err.errors = qa.errors;
      throw err;
    }

    return { config: finalConfig, qa };
  }

  /**
   * Orchestrates the entire pipeline from natural language to finished image / GIF.
   */
  async execute(request: OrchestrationRequest): Promise<ScenarioGenerationResult> {
    const { config } = this.prepareConfig(request);

    if (config.output?.type === "animation") {
      return scenarioEngine.animate(config, request.baseUrl);
    } else {
      return scenarioEngine.generate(config, request.baseUrl);
    }
  }
}

export const scenarioOrchestrator = new ScenarioOrchestrator();
