import type { ConversationOptions } from "@/shared/api/conversation.types";
import type { ModelOptionPolicy } from "@/shared/lib/model-option-policy";
import { isModelOptionPathFiltered } from "@/shared/lib/model-option-policy";
import { resolveModelIdentity } from "@/shared/lib/model-identity";

export const REASONING_MODE_ORDER = ["default", "off", "float", "consider", "deep", "exhaustive"] as const;

export type ReasoningMode = (typeof REASONING_MODE_ORDER)[number];

export type ReasoningModeContext = {
  protocol?: string | null;
  vendor?: string | null;
  modelName?: string | null;
  modelOptionPolicy?: ModelOptionPolicy | null;
  isMediaMode?: boolean;
};

type ReasoningProvider =
  | "openai_responses"
  | "openai_chat_completions"
  | "anthropic_default_adaptive"
  | "anthropic_adaptive"
  | "anthropic_budget"
  | "gemini_budget"
  | "gemini_level"
  | "xai_responses"
  | "xai_multi_agent"
  | "openrouter";

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeProtocol(value: string | null | undefined): string {
  switch (normalizeText(value)) {
    case "google_generate_content":
    case "gemini_generate_content":
      return "gemini_generate_content";
    case "openai_chat_completions":
      return "openai_chat_completions";
    case "openai_responses":
      return "openai_responses";
    case "anthropic_messages":
      return "anthropic_messages";
    case "xai_responses":
      return "xai_responses";
    default:
      return normalizeText(value);
  }
}

function isOpenAICompatibleProtocol(protocol: string): boolean {
  return protocol === "openai_chat_completions" || protocol === "openai_responses";
}

function resolveFamily(ctx: ReasoningModeContext): {
  declaredVendor: string;
  family: string;
  model: string;
  protocol: string;
  isOpenRouter: boolean;
} {
  const declaredVendor = normalizeText(ctx.vendor);
  const model = normalizeText(ctx.modelName);
  const protocol = normalizeProtocol(ctx.protocol);
  const identity = resolveModelIdentity({
    code: ctx.modelName,
    vendor: ctx.vendor,
  });
  const family = normalizeText(identity.vendorKey);
  const isOpenRouter =
    declaredVendor === "openrouter" ||
    declaredVendor.includes("openrouter") ||
    /\bopenrouter\b/i.test(model);

  return { declaredVendor, family, model, protocol, isOpenRouter };
}

function isOpenAIContext(family: string, declaredVendor: string, model: string): boolean {
  return family === "openai" || declaredVendor === "openai" || /\b(?:gpt|chatgpt|o[134])\b/i.test(model);
}

function isAnthropicContext(family: string, declaredVendor: string, model: string): boolean {
  return family === "anthropic" || declaredVendor === "anthropic" || /\bclaude\b/i.test(model);
}

function isGoogleContext(family: string, declaredVendor: string, model: string): boolean {
  return family === "google" || declaredVendor === "google" || /\bgemini\b/i.test(model);
}

function isXAIContext(family: string, declaredVendor: string, model: string): boolean {
  return family === "xai" || declaredVendor === "xai" || /\bgrok\b/i.test(model);
}

function isKnownOpenRouterReasoningModel(family: string, model: string): boolean {
  if (["openai", "anthropic", "google", "xai", "deepseek", "alibaba"].includes(family)) {
    return true;
  }
  return /\b(?:gpt|chatgpt|o[134]|claude|gemini|grok|deepseek-r1|qwq|qwen3)\b/i.test(model);
}

function openAIGPT5MinorVersion(model: string): number | null {
  const match = /\bgpt[-_/ ]?5\.(\d+)\b/i.exec(model);
  if (!match) {
    return null;
  }
  const minor = Number(match[1]);
  return Number.isFinite(minor) ? minor : null;
}

function isOpenAIReasoningNoneModel(model: string): boolean {
  const gpt5MinorVersion = openAIGPT5MinorVersion(model);
  return gpt5MinorVersion !== null && gpt5MinorVersion >= 1;
}

function isOpenAIReasoningXHighModel(model: string): boolean {
  const gpt5MinorVersion = openAIGPT5MinorVersion(model);
  return gpt5MinorVersion !== null && gpt5MinorVersion >= 2;
}

function isOpenAIReasoningHighOnlyModel(model: string): boolean {
  return /\bgpt[-_/ ]?5(?:\.\d+)?[-_/ ]?pro\b/i.test(model);
}

function isClaudeDefaultAdaptiveThinkingModel(model: string): boolean {
  return /\bclaude[-_/ ]mythos\b/i.test(model);
}

function isClaudeAdaptiveThinkingModel(model: string): boolean {
  return (
    /\bclaude[-_/ ]opus[-_/ ]4[-_.]?[6-9]\b/i.test(model) ||
    /\bclaude[-_/ ]sonnet[-_/ ]4[-_.]?[6-9]\b/i.test(model)
  );
}

function isClaudeBudgetThinkingModel(model: string): boolean {
  return (
    /\bclaude[-_/ ](?:3[-_.]?7|4)\b/i.test(model) ||
    /\bclaude[-_/ ](?:opus|sonnet|haiku)[-_/ ]4\b/i.test(model)
  );
}

function isGeminiBudgetModel(model: string): boolean {
  return /\bgemini[-_/ ]?2\.5\b/i.test(model);
}

function isGeminiLevelModel(model: string): boolean {
  return /\bgemini[-_/ ]?3\b/i.test(model);
}

function isGeminiProBudgetModel(model: string): boolean {
  return /\bgemini[-_/ ]?2\.5[-_/ ].*pro\b/i.test(model) || /\bpro[-_/ ]?preview\b/i.test(model);
}

function isXAIMultiAgentModel(model: string): boolean {
  return /\bmulti[-_/ ]?agent\b/i.test(model) || /\bgrok[-_/ ]?4\.20\b/i.test(model);
}

function resolveReasoningProvider(ctx: ReasoningModeContext): ReasoningProvider | null {
  if (ctx.isMediaMode) {
    return null;
  }

  const { declaredVendor, family, model, protocol, isOpenRouter } = resolveFamily(ctx);

  if (isOpenRouter && isOpenAICompatibleProtocol(protocol)) {
    return isKnownOpenRouterReasoningModel(family, model) ? "openrouter" : null;
  }

  if (protocol === "openai_responses" && isOpenAIContext(family, declaredVendor, model)) {
    return "openai_responses";
  }
  if (protocol === "openai_chat_completions" && isOpenAIContext(family, declaredVendor, model)) {
    return "openai_chat_completions";
  }
  if (protocol === "anthropic_messages" && isAnthropicContext(family, declaredVendor, model)) {
    if (isClaudeDefaultAdaptiveThinkingModel(model)) {
      return "anthropic_default_adaptive";
    }
    if (isClaudeAdaptiveThinkingModel(model)) {
      return "anthropic_adaptive";
    }
    if (isClaudeBudgetThinkingModel(model)) {
      return "anthropic_budget";
    }
    return null;
  }
  if (protocol === "gemini_generate_content" && isGoogleContext(family, declaredVendor, model)) {
    if (isGeminiLevelModel(model)) {
      return "gemini_level";
    }
    if (isGeminiBudgetModel(model)) {
      return "gemini_budget";
    }
    return null;
  }
  if (protocol === "xai_responses" && isXAIContext(family, declaredVendor, model)) {
    return isXAIMultiAgentModel(model) ? "xai_multi_agent" : "xai_responses";
  }

  return null;
}

function reasoningEffortOptions(effort: string): ConversationOptions {
  return { reasoning: { effort } };
}

function anthropicAdaptiveOptions(effort: string): ConversationOptions {
  return {
    thinking: { type: "adaptive" },
    output_config: { effort },
  };
}

function anthropicBudgetOptions(budgetTokens: number): ConversationOptions {
  return {
    thinking: {
      type: "enabled",
      budget_tokens: budgetTokens,
    },
  };
}

function geminiBudgetOptions(thinkingBudget: number): ConversationOptions {
  return {
    generationConfig: {
      thinkingConfig: { thinkingBudget },
    },
  };
}

function geminiLevelOptions(thinkingLevel: "LOW" | "HIGH"): ConversationOptions {
  return {
    generationConfig: {
      thinkingConfig: { thinkingLevel },
    },
  };
}

export function reasoningOptionsForMode(
  ctx: ReasoningModeContext,
  mode: ReasoningMode,
): ConversationOptions | null {
  if (mode === "default") {
    return {};
  }

  const provider = resolveReasoningProvider(ctx);
  if (!provider) {
    return null;
  }

  switch (provider) {
    case "openrouter":
      switch (mode) {
        case "off":
          return reasoningEffortOptions("none");
        case "float":
          return reasoningEffortOptions("low");
        case "consider":
          return reasoningEffortOptions("medium");
        case "deep":
          return reasoningEffortOptions("high");
        case "exhaustive":
          return reasoningEffortOptions("xhigh");
        default:
          return null;
      }

    case "openai_responses":
      switch (mode) {
        case "off":
          return isOpenAIReasoningNoneModel(normalizeText(ctx.modelName)) &&
            !isOpenAIReasoningHighOnlyModel(normalizeText(ctx.modelName))
            ? reasoningEffortOptions("none")
            : null;
        case "float":
          return isOpenAIReasoningHighOnlyModel(normalizeText(ctx.modelName)) ? null : reasoningEffortOptions("low");
        case "consider":
          return isOpenAIReasoningHighOnlyModel(normalizeText(ctx.modelName)) ? null : reasoningEffortOptions("medium");
        case "deep":
          return reasoningEffortOptions("high");
        case "exhaustive":
          return isOpenAIReasoningXHighModel(normalizeText(ctx.modelName)) &&
            !isOpenAIReasoningHighOnlyModel(normalizeText(ctx.modelName))
            ? reasoningEffortOptions("xhigh")
            : null;
        default:
          return null;
      }

    case "openai_chat_completions":
      switch (mode) {
        case "float":
          return { reasoning_effort: "low" };
        case "consider":
          return { reasoning_effort: "medium" };
        case "deep":
          return { reasoning_effort: "high" };
        default:
          return null;
      }

    case "anthropic_default_adaptive":
      switch (mode) {
        case "float":
          return { output_config: { effort: "low" } };
        case "consider":
          return { output_config: { effort: "medium" } };
        case "deep":
          return { output_config: { effort: "high" } };
        case "exhaustive":
          return { output_config: { effort: "max" } };
        default:
          return null;
      }

    case "anthropic_adaptive":
      switch (mode) {
        case "off":
          return { thinking: { type: "disabled" } };
        case "float":
          return anthropicAdaptiveOptions("low");
        case "consider":
          return anthropicAdaptiveOptions("medium");
        case "deep":
          return anthropicAdaptiveOptions("high");
        case "exhaustive":
          return anthropicAdaptiveOptions("max");
        default:
          return null;
      }

    case "anthropic_budget":
      switch (mode) {
        case "off":
          return { thinking: { type: "disabled" } };
        case "float":
          return anthropicBudgetOptions(1024);
        case "consider":
          return anthropicBudgetOptions(4096);
        case "deep":
          return anthropicBudgetOptions(8192);
        case "exhaustive":
          return anthropicBudgetOptions(16384);
        default:
          return null;
      }

    case "gemini_budget":
      switch (mode) {
        case "off":
          if (isGeminiProBudgetModel(normalizeText(ctx.modelName))) {
            return null;
          }
          return geminiBudgetOptions(0);
        case "float":
          return geminiBudgetOptions(1024);
        case "consider":
          return geminiBudgetOptions(4096);
        case "deep":
          return geminiBudgetOptions(8192);
        case "exhaustive":
          return isGeminiProBudgetModel(normalizeText(ctx.modelName))
            ? geminiBudgetOptions(32768)
            : geminiBudgetOptions(24576);
        default:
          return null;
      }

    case "gemini_level":
      switch (mode) {
        case "float":
          return geminiLevelOptions("LOW");
        case "deep":
          return geminiLevelOptions("HIGH");
        default:
          return null;
      }

    case "xai_responses":
    case "xai_multi_agent":
      switch (mode) {
        case "off":
          return reasoningEffortOptions("none");
        case "float":
          return reasoningEffortOptions("low");
        case "consider":
          return reasoningEffortOptions("medium");
        case "deep":
          return reasoningEffortOptions("high");
        case "exhaustive":
          return provider === "xai_multi_agent" ? reasoningEffortOptions("xhigh") : null;
        default:
          return null;
      }

    default:
      return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const REASONING_MANAGED_OPTION_PATHS = [
  ["reasoning", "effort"],
  ["reasoning_effort"],
  ["thinking", "type"],
  ["thinking", "budget_tokens"],
  ["output_config", "effort"],
  ["generationConfig", "thinkingConfig", "thinkingBudget"],
  ["generationConfig", "thinkingConfig", "thinkingLevel"],
];

function cloneOptionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneOptionValue);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneOptionValue(child)]),
    );
  }
  return value;
}

function deleteOptionAtPath(options: ConversationOptions, path: string[]): void {
  if (path.length === 0) {
    return;
  }

  const stack: Array<{ object: Record<string, unknown>; key: string }> = [];
  let current = options as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    const child = current[segment];
    if (!isPlainObject(child)) {
      return;
    }
    stack.push({ object: current, key: segment });
    current = child;
  }

  delete current[path[path.length - 1]];

  for (let index = stack.length - 1; index >= 0; index--) {
    const { object, key } = stack[index];
    const child = object[key];
    if (isPlainObject(child) && Object.keys(child).length === 0) {
      delete object[key];
    }
  }
}

function stripReasoningManagedOptions(options: ConversationOptions): ConversationOptions {
  const next = cloneOptionValue(options) as ConversationOptions;
  for (const path of REASONING_MANAGED_OPTION_PATHS) {
    deleteOptionAtPath(next, path);
  }
  return next;
}

function mergeOptionMaps(base: ConversationOptions, override: ConversationOptions): ConversationOptions {
  const next = cloneOptionValue(base) as ConversationOptions;
  for (const [key, value] of Object.entries(override)) {
    const current = next[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      next[key] = mergeOptionMaps(current, value);
      continue;
    }
    next[key] = cloneOptionValue(value);
  }
  return next;
}

function optionPaths(value: unknown, prefix: string[] = []): string[] {
  if (!isPlainObject(value)) {
    return prefix.length > 0 ? [prefix.join(".")] : [];
  }

  const paths = Object.entries(value).flatMap(([key, nested]) => {
    if (!key.trim()) {
      return [];
    }
    return optionPaths(nested, [...prefix, key]);
  });

  return paths.length > 0 ? paths : prefix.length > 0 ? [prefix.join(".")] : [];
}

function isPayloadAllowed(ctx: ReasoningModeContext, payload: ConversationOptions): boolean {
  const policy = ctx.modelOptionPolicy;
  if (!policy) {
    return true;
  }
  return optionPaths(payload).every(
    (path) => !isModelOptionPathFiltered({ policy, protocol: ctx.protocol ?? "", path }),
  );
}

export function availableReasoningModes(ctx: ReasoningModeContext): ReasoningMode[] {
  const available = REASONING_MODE_ORDER.filter((mode) => {
    const payload = reasoningOptionsForMode(ctx, mode);
    return payload !== null && isPayloadAllowed(ctx, payload);
  });

  return available.length > 0 ? available : ["default"];
}

function stringAtPath(options: ConversationOptions, path: string[]): string {
  let current: unknown = options;
  for (const segment of path) {
    if (!isPlainObject(current)) {
      return "";
    }
    current = current[segment];
  }
  return typeof current === "string" ? current.trim().toLowerCase() : "";
}

function numberAtPath(options: ConversationOptions, path: string[]): number | null {
  let current: unknown = options;
  for (const segment of path) {
    if (!isPlainObject(current)) {
      return null;
    }
    current = current[segment];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function modeFromEffort(value: string): ReasoningMode {
  switch (value.trim().toLowerCase()) {
    case "none":
    case "off":
    case "disabled":
      return "off";
    case "minimal":
    case "low":
      return "float";
    case "medium":
      return "consider";
    case "high":
      return "deep";
    case "xhigh":
    case "max":
      return "exhaustive";
    default:
      return "default";
  }
}

function modeFromAnthropicBudget(value: number | null): ReasoningMode {
  if (value === null) {
    return "default";
  }
  if (value < 1024) {
    return "default";
  }
  if (value < 4096) {
    return "float";
  }
  if (value < 8192) {
    return "consider";
  }
  if (value < 16384) {
    return "deep";
  }
  return "exhaustive";
}

function modeFromGeminiBudget(value: number | null): ReasoningMode {
  if (value === null) {
    return "default";
  }
  if (value === 0) {
    return "off";
  }
  if (value < 4096) {
    return "float";
  }
  if (value < 8192) {
    return "consider";
  }
  if (value < 24576) {
    return "deep";
  }
  return "exhaustive";
}

export function detectReasoningMode(ctx: ReasoningModeContext, options: ConversationOptions): ReasoningMode {
  const provider = resolveReasoningProvider(ctx);
  if (!provider) {
    return "default";
  }

  const reasoningEffort = stringAtPath(options, ["reasoning", "effort"]);
  const topLevelReasoningEffort = stringAtPath(options, ["reasoning_effort"]);
  const thinkingType = stringAtPath(options, ["thinking", "type"]);
  const outputConfigEffort = stringAtPath(options, ["output_config", "effort"]);
  const geminiLevel = stringAtPath(options, ["generationConfig", "thinkingConfig", "thinkingLevel"]);
  const geminiBudget = numberAtPath(options, ["generationConfig", "thinkingConfig", "thinkingBudget"]);

  switch (provider) {
    case "openrouter":
    case "openai_responses":
    case "xai_responses":
    case "xai_multi_agent":
      return modeFromEffort(reasoningEffort);
    case "openai_chat_completions":
      return modeFromEffort(topLevelReasoningEffort);
    case "anthropic_default_adaptive":
      return modeFromEffort(outputConfigEffort);
    case "anthropic_adaptive":
      if (thinkingType === "disabled") {
        return "off";
      }
      return modeFromEffort(outputConfigEffort);
    case "anthropic_budget":
      if (thinkingType === "disabled") {
        return "off";
      }
      return modeFromAnthropicBudget(numberAtPath(options, ["thinking", "budget_tokens"]));
    case "gemini_budget":
      return modeFromGeminiBudget(geminiBudget);
    case "gemini_level":
      if (geminiLevel === "low") {
        return "float";
      }
      if (geminiLevel === "high") {
        return "deep";
      }
      return "default";
    default:
      return "default";
  }
}

function optionsEqual(left: ConversationOptions, right: ConversationOptions): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function normalizeReasoningOptionsForContext(
  ctx: ReasoningModeContext,
  options: ConversationOptions | null | undefined,
): ConversationOptions {
  const source = isPlainObject(options) ? (options as ConversationOptions) : {};
  const detected = detectReasoningMode(ctx, source);
  const available = availableReasoningModes(ctx);
  const mode = available.includes(detected) ? detected : "default";
  const reasoningOptions = reasoningOptionsForMode(ctx, mode) ?? {};
  return mergeOptionMaps(stripReasoningManagedOptions(source), reasoningOptions);
}

export function isReasoningOptionsNormalized(
  ctx: ReasoningModeContext,
  options: ConversationOptions | null | undefined,
): boolean {
  const source = isPlainObject(options) ? (options as ConversationOptions) : {};
  return optionsEqual(source, normalizeReasoningOptionsForContext(ctx, source));
}
