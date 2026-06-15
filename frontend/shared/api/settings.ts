import { authedRequest } from "@/shared/api/authed-client";
import type { ModelOptionPolicy, NativeToolDefinition } from "@/shared/lib/model-option-policy";

type ModelOptionPolicyResponse = {
  mode: string;
  allowedPathsJSON: string;
  deniedPathsJSON: string;
  nativeToolAllowedTypesJSON: string;
  nativeTools?: NativeToolDefinition[];
};

export type ChatContextPolicy = {
  contextCompactEnabled: boolean;
};

export type MCPPolicy = {
  maxSelectedToolsPerMessage: number;
};

export async function getModelOptionPolicy(accessToken: string): Promise<ModelOptionPolicy> {
  const data = await authedRequest<ModelOptionPolicyResponse>(
    "/api/v1/settings/model-option-policy",
    { accessToken },
    true,
  );
  return {
    mode: data.mode,
    allowedPathsJSON: data.allowedPathsJSON,
    deniedPathsJSON: data.deniedPathsJSON,
    nativeToolAllowedTypesJSON: data.nativeToolAllowedTypesJSON,
    nativeTools: data.nativeTools ?? [],
  };
}

export async function getMCPPolicy(accessToken: string): Promise<MCPPolicy> {
  const data = await authedRequest<MCPPolicy>(
    "/api/v1/settings/mcp-policy",
    { accessToken },
    true,
  );
  return {
    maxSelectedToolsPerMessage: data.maxSelectedToolsPerMessage,
  };
}

export async function getChatContextPolicy(accessToken: string): Promise<ChatContextPolicy> {
  const data = await authedRequest<ChatContextPolicy>(
    "/api/v1/settings/chat-context-policy",
    { accessToken },
    true,
  );
  return {
    contextCompactEnabled: data.contextCompactEnabled === true,
  };
}
