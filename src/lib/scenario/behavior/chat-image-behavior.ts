import type { ScenarioGenerationResult } from "@/lib/scenario/types";

/**
 * ChatImageBehavior
 *
 * Formats generation results for seamless AI Chat and LLM integration.
 * Produces standard Markdown image syntax: ![](PUBLIC_URL)
 * Never returns localhost in production or file:/// URLs.
 */
export class ChatImageBehavior {
  /**
   * Generates the Markdown image snippet for a public URL.
   */
  static formatMarkdown(url: string, altText = "Blue Archive Scenario"): string {
    return `![${altText}](${url})`;
  }

  /**
   * Applies the chat behavior to a generation result.
   */
  static apply(result: ScenarioGenerationResult, altText?: string): ScenarioGenerationResult {
    const markdown = ChatImageBehavior.formatMarkdown(result.url, altText ?? result.id);
    return {
      ...result,
      markdown,
    };
  }

  /**
   * Generates a complete AI Chat compatible response payload.
   */
  static createChatResponse(params: {
    id: string;
    type: "image" | "animation";
    url: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
    durationMs?: number;
  }): ScenarioGenerationResult {
    const markdown = ChatImageBehavior.formatMarkdown(params.url, params.id);
    return {
      success: true,
      type: params.type,
      id: params.id,
      url: params.url,
      markdown,
      width: params.width ?? 1920,
      height: params.height ?? 1080,
      sizeBytes: params.sizeBytes,
      durationMs: params.durationMs,
    };
  }
}
