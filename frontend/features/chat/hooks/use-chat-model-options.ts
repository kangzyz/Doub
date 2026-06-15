"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type {
  ChatModelOption,
  ModelOptionControl,
  ModelOptionControlType,
} from "@/features/chat/types/chat-runtime";
import { resolveAccessToken } from "@/shared/auth/resolve-access-token";
import { parseProtocolsJSON } from "@/features/chat/model/chat-adapter-options";
import { sanitizeConversationOptions } from "@/features/chat/model/conversation-options";
import { listConversationRuns } from "@/shared/api/conversation";
import { listPublicModels } from "@/shared/api/model";
import { getMCPPolicy, getModelOptionPolicy } from "@/shared/api/settings";
import { getUserSettings } from "@/shared/api/user-settings";
import type { PublicModelDTO } from "@/shared/api/model.types";
import {
  resolveModelOptionPolicyProtocol,
  type ModelNativeToolConfig,
  type ModelOptionPolicy,
} from "@/shared/lib/model-option-policy";
import { parseKindsJSON } from "@/shared/model/llm-schema";
import type { ConversationOptions } from "@/shared/api/conversation.types";
import type { SendShortcut } from "@/features/settings/types/settings";
import { parseSendShortcut } from "@/features/settings/utils/chat-settings";

function parseJSONObject(raw: string): Record<string, unknown> | null {
  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeNativeToolPayload(value: unknown): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeNativeToolString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNativeToolStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => normalizeNativeToolString(item))
        .filter(Boolean),
    ),
  );
}

function nativeToolID({
  key,
  protocol,
  type,
  index,
}: {
  key: string;
  protocol: string;
  type: string;
  index: number;
}): string {
  return [key, protocol, type].map((item) => item.trim()).filter(Boolean).join(":") || `native-tool-${index}`;
}

function resolveNativeTools(raw: string): ModelNativeToolConfig[] {
  const parsed = parseJSONObject(raw);
  if (!parsed) {
    return [];
  }
  const rawTools = parsed.nativeTools;
  if (Array.isArray(rawTools)) {
    return rawTools.flatMap((item, index): ModelNativeToolConfig[] => {
      if (item === null || Array.isArray(item) || typeof item !== "object") {
        return [];
      }
      const source = item as Record<string, unknown>;
      const key = normalizeNativeToolString(source.key ?? source.toolKey);
      const payload = normalizeNativeToolPayload(source.payload);
      const type = normalizeNativeToolString(source.type) || normalizeNativeToolString(payload.type);
      const protocol = normalizeNativeToolString(source.protocol);
      const protocols = normalizeNativeToolStrings(source.protocols);
      if (!key && !type && Object.keys(payload).length === 0) {
        return [];
      }
      return [{
        id: normalizeNativeToolString(source.id) || nativeToolID({ key, protocol, type, index }),
        key,
        protocol,
        protocols: protocols.length > 0 ? protocols : (protocol ? [protocol] : []),
        provider: normalizeNativeToolString(source.provider) || undefined,
        type,
        label: normalizeNativeToolString(source.label) || type || key,
        description: normalizeNativeToolString(source.description) || undefined,
        enabled: source.enabled !== false,
        defaultEnabled: source.defaultEnabled === true,
        payload,
      }];
    }).filter((item) => item.enabled);
  }
  return resolveNativeToolKeys(raw).map((key, index) => ({
    id: nativeToolID({ key, protocol: "", type: "", index }),
    key,
    protocol: "",
    protocols: [],
    type: "",
    label: key,
    enabled: true,
    defaultEnabled: false,
    payload: {},
  }));
}

const DAILY_CHAT_NATIVE_TOOL_PAYLOADS: Partial<Record<string, Array<Record<string, unknown>>>> = {
  openai_chat_completions: [
    { type: "web_search" },
  ],
  openai_responses: [
    { type: "web_search" },
    { type: "image_generation" },
    { type: "code_interpreter", container: { type: "auto" } },
  ],
  gemini_generate_content: [
    { google_search: {} },
    { url_context: {} },
    { code_execution: {} },
  ],
};

function nativeToolPayloadIdentity(payload: Record<string, unknown>, index: number): string {
  const type = normalizeNativeToolString(payload.type);
  if (type) {
    return `type:${type}`;
  }
  if ("google_search" in payload || "googleSearch" in payload) {
    return "type:google_search";
  }
  if ("url_context" in payload || "urlContext" in payload) {
    return "type:url_context";
  }
  if ("code_execution" in payload || "codeExecution" in payload) {
    return "type:code_execution";
  }
  return `json:${index}:${JSON.stringify(payload)}`;
}

function dailyChatNativeToolPayloads(protocols: string[]): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const payloads: Array<Record<string, unknown>> = [];
  for (const protocol of protocols) {
    const policyProtocol = resolveModelOptionPolicyProtocol(protocol);
    for (const payload of DAILY_CHAT_NATIVE_TOOL_PAYLOADS[policyProtocol] ?? []) {
      const identity = nativeToolPayloadIdentity(payload, payloads.length);
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);
      payloads.push({ ...payload });
    }
  }
  return payloads;
}

function mergeDefaultNativeToolPayloads(defaultOptions: ConversationOptions, defaultToolPayloads: Array<Record<string, unknown>>): ConversationOptions {
  if (defaultToolPayloads.length === 0) {
    return defaultOptions;
  }
  const currentTools = Array.isArray(defaultOptions.tools)
    ? defaultOptions.tools.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item))
    : [];
  const seen = new Set<string>();
  const tools = [...currentTools, ...defaultToolPayloads]
    .map((item) => item as Record<string, unknown>)
    .filter((item, index) => {
      const identity = nativeToolPayloadIdentity(item, index);
      if (seen.has(identity)) {
        return false;
      }
      seen.add(identity);
      return true;
    });
  return sanitizeConversationOptions({
    ...defaultOptions,
    tools,
  });
}

function resolveDefaultOptions(raw: string, protocols: string[]): ConversationOptions {
  const parsed = parseJSONObject(raw);
  if (!parsed) {
    return mergeDefaultNativeToolPayloads({}, dailyChatNativeToolPayloads(protocols));
  }
  const defaults = parsed.defaultOptions;
  if (defaults === null || Array.isArray(defaults) || typeof defaults !== "object") {
    return mergeDefaultNativeToolPayloads({}, dailyChatNativeToolPayloads(protocols));
  }
  const defaultOptions = sanitizeConversationOptions(defaults as ConversationOptions);
  return mergeDefaultNativeToolPayloads(defaultOptions, dailyChatNativeToolPayloads(protocols));
}

const MODEL_OPTION_CONTROL_TYPES = new Set<ModelOptionControlType>(["boolean", "number", "select", "text"]);

function normalizeOptionControlPath(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(".");
}

function normalizeOptionControlType(value: unknown): ModelOptionControlType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!MODEL_OPTION_CONTROL_TYPES.has(normalized as ModelOptionControlType)) {
    return undefined;
  }
  return normalized as ModelOptionControlType;
}

function normalizeOptionControlString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeOptionControlOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const options = Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
  return options.length > 0 ? options : undefined;
}

function resolveOptionControls(raw: string): ModelOptionControl[] {
  const parsed = parseJSONObject(raw);
  const rawControls = parsed?.optionControls;
  if (!Array.isArray(rawControls)) {
    return [];
  }

  const controls = rawControls.flatMap((item): ModelOptionControl[] => {
    if (item === null || Array.isArray(item) || typeof item !== "object") {
      return [];
    }
    const source = item as Record<string, unknown>;
    const path = normalizeOptionControlPath(source.path);
    if (!path) {
      return [];
    }
    const control: ModelOptionControl = { path };
    const type = normalizeOptionControlType(source.type);
    const label = normalizeOptionControlString(source.label);
    const description = normalizeOptionControlString(source.description);
    const placeholder = normalizeOptionControlString(source.placeholder);
    const options = normalizeOptionControlOptions(source.options);
    if (type) {
      control.type = type;
    }
    if (label) {
      control.label = label;
    }
    if (description) {
      control.description = description;
    }
    if (placeholder) {
      control.placeholder = placeholder;
    }
    if (options) {
      control.options = options;
    }
    return [control];
  });

  return controls.filter((item, index) => controls.findIndex((candidate) => candidate.path === item.path) === index);
}

function resolveNativeToolKeys(raw: string): string[] {
  const parsed = parseJSONObject(raw);
  const rawKeys = parsed?.nativeToolKeys;
  if (!Array.isArray(rawKeys)) {
    return [];
  }
  return Array.from(
    new Set(
      rawKeys
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function resolveMCPMaxSelectedTools(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 32;
  }
  return Math.min(Math.floor(numeric), 128);
}

function toChatModelOption(item: PublicModelDTO): ChatModelOption {
  const protocols = parseProtocolsJSON(item.protocolsJSON);
  return {
    platformModelName: item.platformModelName,
    icon: item.icon,
    vendor: item.vendor,
    kinds: parseKindsJSON(item.kindsJSON),
    protocols,
    referenceModelName: item.referenceModelName?.trim() ?? "",
    defaultOptions: resolveDefaultOptions(item.capabilitiesJSON, protocols),
    optionControls: resolveOptionControls(item.capabilitiesJSON),
    nativeToolKeys: resolveNativeToolKeys(item.capabilitiesJSON),
    nativeTools: resolveNativeTools(item.capabilitiesJSON),
  };
}

export function useChatModelOptions({
  conversationPublicID,
  conversationModel,
}: {
  conversationPublicID: string | null;
  conversationModel?: string | null;
}) {
  const t = useTranslations("chat.models");
  const [availableModels, setAvailableModels] = React.useState<PublicModelDTO[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(true);
  const [modelsErrorMsg, setModelsErrorMsg] = React.useState("");
  const [selectedPlatformModelName, setSelectedPlatformModelName] = React.useState("");
  const [userDefaultModel, setUserDefaultModel] = React.useState("");
  const [sendShortcut, setSendShortcut] = React.useState<SendShortcut>("enter");
  const [restoreDraftOnFailure, setRestoreDraftOnFailure] = React.useState(true);
  const [preserveConversationDrafts, setPreserveConversationDrafts] = React.useState(true);
  const [inputHeight, setInputHeight] = React.useState<"compact" | "standard" | "loose">("standard");
  const [markdownRender, setMarkdownRender] = React.useState(true);
  const [showModelInfo, setShowModelInfo] = React.useState(true);
  const [showLatency, setShowLatency] = React.useState(true);
  const [showTokenUsage, setShowTokenUsage] = React.useState(true);
  const [modelOptionPolicy, setModelOptionPolicy] = React.useState<ModelOptionPolicy | null>(null);
  const [mcpMaxSelectedTools, setMCPMaxSelectedTools] = React.useState(32);
  const activeConversationRef = React.useRef<string | null>(null);
  const userSelectedModelRef = React.useRef(false);
  const runModelRequestRef = React.useRef(0);

  const selectPlatformModelName = React.useCallback((platformModelName: string) => {
    userSelectedModelRef.current = true;
    setSelectedPlatformModelName(platformModelName);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setModelsLoading(true);
      setModelsErrorMsg("");
      try {
        const token = await resolveAccessToken();
        if (!token) {
          setModelsErrorMsg(t("signInRequired"));
          return;
        }
        const [nextModels, settings, nextModelOptionPolicy, nextMCPPolicy] = await Promise.all([
          listPublicModels(token),
          getUserSettings(token).catch(() => ({} as Record<string, string>)),
          getModelOptionPolicy(token).catch(() => null),
          getMCPPolicy(token).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setAvailableModels(nextModels);
        setModelOptionPolicy(nextModelOptionPolicy);
        setMCPMaxSelectedTools(resolveMCPMaxSelectedTools(nextMCPPolicy?.maxSelectedToolsPerMessage));
        setUserDefaultModel(settings["chat.default_model"]?.trim() ?? "");
        setSendShortcut(parseSendShortcut(settings["chat.send_on_enter"]));
        setRestoreDraftOnFailure(settings["chat.restore_draft_on_failure"] !== "false");
        setPreserveConversationDrafts(settings["chat.preserve_conversation_drafts"] !== "false");
        setMarkdownRender(settings["chat.markdown_render"] !== "false");
        setShowModelInfo(settings["chat.show_model_info"] !== "false");
        setShowLatency(settings["chat.show_latency"] !== "false");
        setShowTokenUsage(settings["chat.show_token_usage"] !== "false");
        setInputHeight(
          settings["chat.input_height"] === "compact" || settings["chat.input_height"] === "loose"
            ? settings["chat.input_height"]
            : "standard",
        );
      } catch {
        if (!cancelled) {
          setModelsErrorMsg(t("loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [t]);

  React.useEffect(() => {
    const normalizedConversationID = conversationPublicID?.trim() || null;
    if (!normalizedConversationID) {
      activeConversationRef.current = null;
      return;
    }

    const conversationChanged = activeConversationRef.current !== normalizedConversationID;
    if (conversationChanged) {
      activeConversationRef.current = normalizedConversationID;
      userSelectedModelRef.current = false;
    }

    const fallbackModel = conversationModel?.trim() || "";
    if (!userSelectedModelRef.current) {
      setSelectedPlatformModelName(fallbackModel);
    }

    let cancelled = false;
    const requestID = runModelRequestRef.current + 1;
    runModelRequestRef.current = requestID;

    async function loadLatestRunModel() {
      const token = await resolveAccessToken();
      if (!token) {
        return;
      }

      const runs = await listConversationRuns(token, normalizedConversationID, { page: 1, pageSize: 1 });
      if (cancelled || requestID !== runModelRequestRef.current || userSelectedModelRef.current) {
        return;
      }

      const latestRunModel = runs.results[0]?.platformModelName?.trim() || "";
      setSelectedPlatformModelName(latestRunModel || fallbackModel);
    }

    void loadLatestRunModel().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [conversationModel, conversationPublicID]);

  React.useEffect(() => {
    if (availableModels.length === 0) {
      return;
    }
    if (conversationPublicID?.trim()) {
      return;
    }

    setSelectedPlatformModelName((current) => {
      const normalizedCurrent = current.trim();
      if (normalizedCurrent && availableModels.some((item) => item.platformModelName === normalizedCurrent)) {
        return normalizedCurrent;
      }

      // User default model for new conversations.
      if (userDefaultModel && availableModels.some((item) => item.platformModelName === userDefaultModel)) {
        return userDefaultModel;
      }

      return availableModels[0].platformModelName;
    });
  }, [availableModels, conversationPublicID, userDefaultModel]);

  const modelOptions = React.useMemo<ChatModelOption[]>(
    () =>
      availableModels.map(toChatModelOption),
    [availableModels],
  );

  return {
    modelOptions,
    modelsLoading,
    modelsErrorMsg,
    sendShortcut,
    restoreDraftOnFailure,
    preserveConversationDrafts,
    inputHeight,
    markdownRender,
    showModelInfo,
    showLatency,
    showTokenUsage,
    modelOptionPolicy,
    mcpMaxSelectedTools,
    selectedPlatformModelName,
    setSelectedPlatformModelName: selectPlatformModelName,
  };
}
