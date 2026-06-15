"use client";

import * as React from "react";
import { CircleHelp, Plus, Settings2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NativeToolDefinition } from "@/shared/lib/model-option-policy";

export const MODEL_CAPABILITIES_PLACEHOLDER = `{
  "contextWindow": 1000000,
  "maxOutputTokens": 32000,
  "supportsSystemPrompt": true,
  "defaultOptions": {
    "reasoning": {
      "effort": "high"
    }
  },
  "optionControls": [
    {
      "path": "reasoning.effort",
      "label": "Reasoning effort",
      "type": "select",
      "options": ["low", "medium", "high"]
    }
  ],
  "nativeTools": [
    {
      "key": "openai.web_search_preview",
      "protocols": ["openai_chat_completions", "openai_responses"],
      "enabled": true,
      "defaultEnabled": false
    }
  ]
}`;

type Translate = (key: string, values?: Record<string, string | number>) => string;
type CapabilityControlType = "text" | "select" | "number" | "boolean";

type OptionControlRow = {
  id: string;
  path: string;
  label: string;
  description: string;
  type: CapabilityControlType;
  options: string;
  placeholder: string;
};

type NativeToolCatalogOption = {
  toolKey: string;
  provider: string;
  label: string;
  description: string;
  type: string;
  payload: Record<string, unknown>;
  protocols: string[];
};

type NativeToolSelection = {
  enabled: boolean;
  defaultEnabled: boolean;
};

type ModelCapabilitiesQuickConfigProps = {
  value: string;
  disabled?: boolean;
  nativeTools?: NativeToolDefinition[];
  routeProtocols?: string[];
  t: Translate;
  commonT: Translate;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerClassName?: string;
  triggerLabel?: string;
  onApply: (value: string) => void;
};

function createRowID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCapabilitiesObject(raw: string): Record<string, unknown> | null {
  const normalized = raw.trim();
  if (!normalized) {
    return {};
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function imageStreamEnabledFromCapabilities(raw: string): boolean {
  const payload = parseCapabilitiesObject(raw);
  if (!payload) {
    return true;
  }
  const image = payload.image;
  if (!isPlainObject(image)) {
    return true;
  }
  return image.stream !== false;
}

export function setImageStreamEnabledInCapabilities(raw: string, enabled: boolean): string | null {
  const payload = parseCapabilitiesObject(raw);
  if (!payload) {
    return null;
  }
  if (enabled) {
    const image = payload.image;
    if (isPlainObject(image)) {
      delete image.stream;
      if (Object.keys(image).length === 0) {
        delete payload.image;
      }
    }
  } else {
    payload.image = {
      ...(isPlainObject(payload.image) ? payload.image : {}),
      stream: false,
    };
  }
  return Object.keys(payload).length > 0 ? JSON.stringify(payload, null, 2) : "";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map(normalizeString).filter(Boolean)));
}

function optionControlRowsFromCapabilities(payload: Record<string, unknown>): OptionControlRow[] {
  const controls = payload.optionControls;
  if (!Array.isArray(controls)) {
    return [];
  }
  return controls.flatMap((item): OptionControlRow[] => {
    if (!isPlainObject(item)) {
      return [];
    }
    const path = normalizeString(item.path);
    if (!path) {
      return [];
    }
    const type = normalizeString(item.type);
    return [{
      id: createRowID(),
      path,
      label: normalizeString(item.label),
      description: normalizeString(item.description),
      type: type === "select" || type === "number" || type === "boolean" ? type : "text",
      options: normalizeStringArray(item.options).join(", "),
      placeholder: normalizeString(item.placeholder),
    }];
  });
}

function defaultOptionsDraftFromCapabilities(payload: Record<string, unknown>): string {
  const defaults = payload.defaultOptions;
  if (!isPlainObject(defaults) || Object.keys(defaults).length === 0) {
    return "";
  }
  return JSON.stringify(defaults, null, 2);
}

function nativeToolCatalogOptions(nativeTools: NativeToolDefinition[]): NativeToolCatalogOption[] {
  const byKey = new Map<string, NativeToolCatalogOption>();
  for (const tool of nativeTools) {
    const key = tool.toolKey.trim();
    if (!key) {
      continue;
    }
    const current = byKey.get(key);
    if (current) {
      current.protocols = Array.from(new Set([...current.protocols, tool.protocol].filter(Boolean)));
      continue;
    }
    byKey.set(key, {
      toolKey: key,
      provider: tool.provider,
      label: tool.label || key,
      description: tool.description,
      type: tool.type,
      payload: tool.payload ?? {},
      protocols: tool.protocol ? [tool.protocol] : [],
    });
  }
  return Array.from(byKey.values()).sort((left, right) =>
    `${left.provider}:${left.label}`.localeCompare(`${right.provider}:${right.label}`),
  );
}

function nativeToolSelectionsFromCapabilities(payload: Record<string, unknown>): Record<string, NativeToolSelection> {
  const result: Record<string, NativeToolSelection> = {};
  const tools = payload.nativeTools;
  if (Array.isArray(tools)) {
    for (const item of tools) {
      if (!isPlainObject(item)) {
        continue;
      }
      const key = normalizeString(item.key ?? item.toolKey);
      if (!key) {
        continue;
      }
      result[key] = {
        enabled: item.enabled !== false,
        defaultEnabled: item.defaultEnabled === true,
      };
    }
  }
  const keys = payload.nativeToolKeys;
  if (Array.isArray(keys)) {
    for (const rawKey of keys) {
      const key = normalizeString(rawKey);
      if (!key || result[key]) {
        continue;
      }
      result[key] = { enabled: true, defaultEnabled: false };
    }
  }
  return result;
}

function parseDefaultOptionsDraft(draft: string): { value: Record<string, unknown>; error: string } {
  const normalized = draft.trim();
  if (!normalized) {
    return { value: {}, error: "" };
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!isPlainObject(parsed)) {
      return { value: {}, error: "defaultOptions must be a JSON object" };
    }
    return { value: parsed, error: "" };
  } catch {
    return { value: {}, error: "Invalid JSON" };
  }
}

function buildOptionControls(rows: OptionControlRow[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  return rows.flatMap((row): Record<string, unknown>[] => {
    const path = row.path
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join(".");
    if (!path || seen.has(path)) {
      return [];
    }
    seen.add(path);
    const control: Record<string, unknown> = {
      path,
      type: row.type,
    };
    if (row.label.trim()) {
      control.label = row.label.trim();
    }
    if (row.description.trim()) {
      control.description = row.description.trim();
    }
    if (row.placeholder.trim()) {
      control.placeholder = row.placeholder.trim();
    }
    if (row.type === "select") {
      const options = row.options.split(",").map((item) => item.trim()).filter(Boolean);
      if (options.length > 0) {
        control.options = Array.from(new Set(options));
      }
    }
    return [control];
  });
}

function buildNativeTools(
  catalog: NativeToolCatalogOption[],
  selections: Record<string, NativeToolSelection>,
): Record<string, unknown>[] {
  return catalog.flatMap((tool): Record<string, unknown>[] => {
    const selection = selections[tool.toolKey];
    if (!selection?.enabled) {
      return [];
    }
    return [{
      key: tool.toolKey,
      protocols: tool.protocols,
      type: tool.type,
      label: tool.label,
      description: tool.description,
      enabled: true,
      defaultEnabled: selection.defaultEnabled === true,
      payload: tool.payload,
    }];
  });
}

export function normalizeModelCapabilitiesJSON(value: string, nativeTools: NativeToolDefinition[] = [], _routeProtocols: string[] = []): string {
  const payload = parseCapabilitiesObject(value);
  if (!payload) {
    return value.trim();
  }
  const catalog = nativeToolCatalogOptions(nativeTools);
  const selections = nativeToolSelectionsFromCapabilities(payload);
  const normalizedTools = buildNativeTools(catalog, selections);
  if (normalizedTools.length > 0) {
    payload.nativeTools = normalizedTools;
    delete payload.nativeToolKeys;
  }
  return Object.keys(payload).length > 0 ? JSON.stringify(payload, null, 2) : "";
}

export function ModelCapabilitiesGuideButton({ t }: { t: Translate }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs font-normal text-muted-foreground">
          <CircleHelp className="size-3.5" />
          {t("sheet.capabilitiesQuick.guide")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t("sheet.capabilitiesQuick.guideTitle")}</DialogTitle>
          <DialogDescription>{t("sheet.capabilitiesQuick.guideDescription")}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/50 p-3 text-xs text-foreground">
          {MODEL_CAPABILITIES_PLACEHOLDER}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

export function ModelCapabilitiesQuickConfig({
  value,
  disabled,
  nativeTools = [],
  routeProtocols = [],
  t,
  commonT,
  triggerVariant = "outline",
  triggerClassName,
  triggerLabel,
  onApply,
}: ModelCapabilitiesQuickConfigProps) {
  const [open, setOpen] = React.useState(false);
  const [defaultOptionsDraft, setDefaultOptionsDraft] = React.useState("");
  const [optionRows, setOptionRows] = React.useState<OptionControlRow[]>([]);
  const [nativeSelections, setNativeSelections] = React.useState<Record<string, NativeToolSelection>>({});
  const [jsonError, setJSONError] = React.useState("");
  const catalog = React.useMemo(() => nativeToolCatalogOptions(nativeTools), [nativeTools]);
  const routeProtocolSet = React.useMemo(
    () => new Set(routeProtocols.map((item) => item.trim()).filter(Boolean)),
    [routeProtocols],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const payload = parseCapabilitiesObject(value);
    if (!payload) {
      setJSONError(t("sheet.capabilitiesQuick.invalidJSON"));
      setDefaultOptionsDraft("");
      setOptionRows([]);
      setNativeSelections({});
      return;
    }
    setJSONError("");
    setDefaultOptionsDraft(defaultOptionsDraftFromCapabilities(payload));
    setOptionRows(optionControlRowsFromCapabilities(payload));
    setNativeSelections(nativeToolSelectionsFromCapabilities(payload));
  }, [open, t, value]);

  const updateNativeSelection = React.useCallback((key: string, patch: Partial<NativeToolSelection>) => {
    setNativeSelections((previous) => {
      const current = previous[key] ?? { enabled: false, defaultEnabled: false };
      return { ...previous, [key]: { ...current, ...patch } };
    });
  }, []);

  const applyConfig = React.useCallback(() => {
    const payload = parseCapabilitiesObject(value);
    if (!payload) {
      setJSONError(t("sheet.capabilitiesQuick.invalidJSON"));
      return;
    }
    const parsedDefaults = parseDefaultOptionsDraft(defaultOptionsDraft);
    if (parsedDefaults.error) {
      setJSONError(parsedDefaults.error);
      return;
    }
    setJSONError("");
    if (Object.keys(parsedDefaults.value).length > 0) {
      payload.defaultOptions = parsedDefaults.value;
    } else {
      delete payload.defaultOptions;
    }
    const controls = buildOptionControls(optionRows);
    if (controls.length > 0) {
      payload.optionControls = controls;
    } else {
      delete payload.optionControls;
    }
    const selectedTools = buildNativeTools(catalog, nativeSelections);
    if (selectedTools.length > 0) {
      payload.nativeTools = selectedTools;
      delete payload.nativeToolKeys;
    } else {
      delete payload.nativeTools;
      delete payload.nativeToolKeys;
    }
    onApply(Object.keys(payload).length > 0 ? JSON.stringify(payload, null, 2) : "");
    setOpen(false);
  }, [catalog, defaultOptionsDraft, nativeSelections, onApply, optionRows, t, value]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size="sm" className={triggerClassName} disabled={disabled}>
          <Settings2 className="size-3.5" />
          {triggerLabel ?? t("sheet.capabilitiesQuick.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t("sheet.capabilitiesQuick.title")}</DialogTitle>
          <DialogDescription>{t("sheet.capabilitiesQuick.description")}</DialogDescription>
        </DialogHeader>
        {jsonError ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{jsonError}</p> : null}
        <Tabs defaultValue="defaults" className="min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="defaults">{t("sheet.capabilitiesQuick.defaultsTab")}</TabsTrigger>
            <TabsTrigger value="controls">{t("sheet.capabilitiesQuick.controlsTab")}</TabsTrigger>
            <TabsTrigger value="tools">{t("sheet.capabilitiesQuick.toolsTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="defaults" className="mt-3 min-h-0">
            <Textarea
              value={defaultOptionsDraft}
              onChange={(event) => setDefaultOptionsDraft(event.target.value)}
              placeholder='{"reasoning":{"effort":"high"}}'
              className="h-[360px] resize-none font-mono text-xs"
              disabled={disabled}
            />
          </TabsContent>
          <TabsContent value="controls" className="mt-3 min-h-0">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t("sheet.capabilitiesQuick.controlsDescription")}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => setOptionRows((previous) => [...previous, {
                  id: createRowID(),
                  path: "",
                  label: "",
                  description: "",
                  type: "text",
                  options: "",
                  placeholder: "",
                }])}
              >
                <Plus className="size-3.5" />
                {commonT("actions.add")}
              </Button>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {optionRows.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("sheet.capabilitiesQuick.emptyControls")}
                </p>
              ) : optionRows.map((row) => (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_110px_32px]">
                    <Input
                      value={row.path}
                      placeholder="reasoning.effort"
                      disabled={disabled}
                      onChange={(event) => setOptionRows((previous) => previous.map((item) => item.id === row.id ? { ...item, path: event.target.value } : item))}
                    />
                    <Input
                      value={row.label}
                      placeholder={t("sheet.capabilitiesQuick.labelPlaceholder")}
                      disabled={disabled}
                      onChange={(event) => setOptionRows((previous) => previous.map((item) => item.id === row.id ? { ...item, label: event.target.value } : item))}
                    />
                    <Select
                      value={row.type}
                      disabled={disabled}
                      onValueChange={(nextValue) => setOptionRows((previous) => previous.map((item) => item.id === row.id ? { ...item, type: nextValue as CapabilityControlType } : item))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["text", "select", "number", "boolean"].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label={commonT("actions.delete")}
                      onClick={() => setOptionRows((previous) => previous.filter((item) => item.id !== row.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {row.type === "select" ? (
                    <Input
                      value={row.options}
                      placeholder={t("sheet.capabilitiesQuick.optionsPlaceholder")}
                      className="mt-2"
                      disabled={disabled}
                      onChange={(event) => setOptionRows((previous) => previous.map((item) => item.id === row.id ? { ...item, options: event.target.value } : item))}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="tools" className="mt-3 min-h-0">
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {catalog.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("sheet.capabilitiesQuick.emptyTools")}
                </p>
              ) : catalog.map((tool) => {
                const selection = nativeSelections[tool.toolKey] ?? { enabled: false, defaultEnabled: false };
                const matchedCurrentRoute = routeProtocolSet.size === 0 || tool.protocols.some((protocol) => routeProtocolSet.has(protocol));
                return (
                  <div key={tool.toolKey} className={cn("rounded-md border p-3", !matchedCurrentRoute && "opacity-70")}>
                    <div className="flex min-w-0 items-start gap-3">
                      <Checkbox
                        checked={selection.enabled}
                        disabled={disabled}
                        onCheckedChange={(checked) => updateNativeSelection(tool.toolKey, { enabled: checked === true })}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium">{tool.label}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{tool.provider}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tool.description || tool.type}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tool.protocols.map((protocol) => (
                            <code key={protocol} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {protocol}
                            </code>
                          ))}
                        </div>
                      </div>
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={selection.defaultEnabled}
                          disabled={disabled || !selection.enabled}
                          onCheckedChange={(checked) => updateNativeSelection(tool.toolKey, { defaultEnabled: checked === true })}
                        />
                        {t("sheet.capabilitiesQuick.defaultEnabled")}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={disabled}>
            {commonT("actions.cancel")}
          </Button>
          <Button type="button" onClick={applyConfig} disabled={disabled}>
            {commonT("actions.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
