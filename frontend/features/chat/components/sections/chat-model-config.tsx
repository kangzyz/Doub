"use client";

import * as React from "react";
import { Check, Lightbulb, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroupButton } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  availableReasoningModes,
  detectReasoningMode,
  reasoningOptionsForMode,
  type ReasoningMode,
  type ReasoningModeContext,
} from "@/features/chat/model/reasoning-options";
import { cn } from "@/lib/utils";
import type { ModelOptionPolicy } from "@/shared/lib/model-option-policy";
import { isModelOptionPathFiltered } from "@/shared/lib/model-option-policy";
import type { ConversationOptions } from "@/shared/api/conversation.types";
import type { ModelOptionControl } from "@/features/chat/types/chat-runtime";

type ChatModelConfigProps = {
  disabled: boolean;
  options: ConversationOptions;
  optionControls?: ModelOptionControl[];
  modelOptionPolicy: ModelOptionPolicy | null;
  selectedProtocol: string;
  selectedVendor: string;
  selectedModelName: string;
  isMediaMode: boolean;
  onOptionsChange: React.Dispatch<React.SetStateAction<ConversationOptions>>;
  onOptionsReset: () => void;
};

function hasOptions(options: ConversationOptions): boolean {
  return Object.keys(options).length > 0;
}

function optionPathSegments(path: string): string[] {
  return path.split(".").map((item) => item.trim()).filter(Boolean);
}

function readOptionAtPath(options: ConversationOptions, path: string[]): unknown {
  let current: unknown = options;
  for (const segment of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function cloneOptionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneOptionValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, cloneOptionValue(child)]),
    );
  }
  return value;
}

function setOptionAtPath(options: ConversationOptions, path: string[], value: unknown): ConversationOptions {
  if (path.length === 0) {
    return options;
  }
  const next: ConversationOptions = { ...options };
  let current = next as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    const child = current[segment];
    if (child === null || typeof child !== "object" || Array.isArray(child)) {
      current[segment] = {};
    } else {
      current[segment] = { ...(child as Record<string, unknown>) };
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = cloneOptionValue(value);
  return next;
}

function deleteOptionAtPath(options: ConversationOptions, path: string[]): ConversationOptions {
  if (path.length === 0) {
    return options;
  }
  const next: ConversationOptions = { ...options };
  const stack: Array<{ object: Record<string, unknown>; key: string }> = [];
  let current = next as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    const child = current[segment];
    if (child === null || typeof child !== "object" || Array.isArray(child)) {
      return next;
    }
    current[segment] = { ...(child as Record<string, unknown>) };
    stack.push({ object: current, key: segment });
    current = current[segment] as Record<string, unknown>;
  }
  delete current[path[path.length - 1]];
  for (let index = stack.length - 1; index >= 0; index--) {
    const { object, key } = stack[index];
    const child = object[key];
    if (child && typeof child === "object" && !Array.isArray(child) && Object.keys(child as Record<string, unknown>).length === 0) {
      delete object[key];
    }
  }
  return next;
}

function parseNumberInput(value: string): number | string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : value;
}

export function ChatModelConfig({
  disabled,
  options,
  optionControls = [],
  modelOptionPolicy,
  selectedProtocol,
  selectedVendor,
  selectedModelName,
  isMediaMode,
  onOptionsChange,
  onOptionsReset,
}: ChatModelConfigProps) {
  const tComposer = useTranslations("chat.composer");

  const context = React.useMemo<ReasoningModeContext>(
    () => ({
      protocol: selectedProtocol,
      vendor: selectedVendor,
      modelName: selectedModelName,
      modelOptionPolicy,
      isMediaMode,
    }),
    [isMediaMode, modelOptionPolicy, selectedModelName, selectedProtocol, selectedVendor],
  );

  const modes = React.useMemo(() => availableReasoningModes(context), [context]);
  const detectedMode = React.useMemo(() => detectReasoningMode(context, options), [context, options]);
  const selectedMode: ReasoningMode = modes.includes(detectedMode) ? detectedMode : "default";
  const selectedIsDefault = selectedMode === "default";
  const selectedLabel = tComposer(`thinkingModes.${selectedMode}`);
  const selectedDescription = tComposer(`thinkingModeDescriptions.${selectedMode}`);
  const hasCustomConfig = optionControls.length > 0;

  const selectMode = React.useCallback(
    (mode: ReasoningMode) => {
      const nextOptions = reasoningOptionsForMode(context, mode);
      if (!nextOptions || !hasOptions(nextOptions)) {
        onOptionsReset();
        return;
      }
      onOptionsChange(nextOptions);
    },
    [context, onOptionsChange, onOptionsReset],
  );

  if (isMediaMode) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <DropdownMenuTrigger asChild>
          <TooltipTrigger asChild>
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "rounded-md text-muted-foreground hover:text-foreground",
                !selectedIsDefault && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
              )}
              disabled={disabled}
              aria-label={tComposer("thinkingMode")}
              aria-pressed={!selectedIsDefault}
              title={tComposer("thinkingModeSelected", { mode: selectedLabel })}
            >
              <Lightbulb className="size-5" strokeWidth={1.45} />
            </InputGroupButton>
          </TooltipTrigger>
        </DropdownMenuTrigger>
        <TooltipContent side="top" className="max-w-72 text-xs leading-5">
          {hasCustomConfig
            ? tComposer("modelOptions")
            : `${tComposer("thinkingModeSelected", { mode: selectedLabel })} - ${selectedDescription}`}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="w-[320px] max-w-[calc(100vw-1rem)] p-1.5">
        <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">
          {tComposer("thinkingMode")}
        </DropdownMenuLabel>
        {modes.map((mode) => {
          const selected = mode === selectedMode;
          return (
            <DropdownMenuItem
              key={mode}
              className={cn(
                "min-h-10 cursor-pointer items-center gap-2 whitespace-normal rounded-md px-2 py-2",
                selected && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary",
              )}
              onSelect={(event) => {
                event.preventDefault();
                selectMode(mode);
              }}
            >
              <Lightbulb
                className={cn("size-3.5 text-muted-foreground", selected && "text-primary")}
                strokeWidth={1.55}
              />
              <span className="grid min-w-0 flex-1 grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
                <span className="truncate text-sm font-medium">{tComposer(`thinkingModes.${mode}`)}</span>
                <span className={cn("truncate text-[11px] text-muted-foreground", selected && "text-primary/70")}>
                  {tComposer(`thinkingModeDescriptions.${mode}`)}
                </span>
              </span>
              {selected ? <Check className="size-3.5 text-primary" strokeWidth={1.8} /> : null}
            </DropdownMenuItem>
          );
        })}
        {hasCustomConfig ? (
          <>
            {optionControls.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">
                  <SlidersHorizontal className="size-3.5" />
                  {tComposer("optionControls")}
                </DropdownMenuLabel>
                <div className="space-y-2 px-2 pb-2">
                  {optionControls.map((control) => {
                    const path = optionPathSegments(control.path);
                    const value = readOptionAtPath(options, path);
                    const filtered = modelOptionPolicy
                      ? isModelOptionPathFiltered({ policy: modelOptionPolicy, protocol: selectedProtocol, path: control.path })
                      : false;
                    const label = control.label?.trim() || control.path;
                    const description = control.description?.trim();
                    const updateValue = (nextValue: unknown) => {
                      onOptionsChange((previous) => nextValue === ""
                        ? deleteOptionAtPath(previous, path)
                        : setOptionAtPath(previous, path, nextValue));
                    };
                    return (
                      <div key={control.path} className="grid gap-1.5">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn("truncate text-xs font-medium", filtered && "text-muted-foreground line-through")}>{label}</p>
                            {description ? <p className="truncate text-[11px] text-muted-foreground">{description}</p> : null}
                          </div>
                          {filtered ? <span className="shrink-0 text-[10px] text-muted-foreground">{tComposer("ignored")}</span> : null}
                        </div>
                        {control.type === "boolean" ? (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={value === true}
                              disabled={disabled || filtered}
                              onCheckedChange={(checked) => updateValue(checked === true)}
                            />
                            {value === true ? tComposer("booleanOn") : tComposer("booleanOff")}
                          </label>
                        ) : control.type === "select" && control.options && control.options.length > 0 ? (
                          <Select
                            value={typeof value === "string" && value.trim() ? value : undefined}
                            disabled={disabled || filtered}
                            onValueChange={(nextValue) => updateValue(nextValue)}
                          >
                            <SelectTrigger size="sm" className="h-8">
                              <SelectValue placeholder={control.placeholder || control.path} />
                            </SelectTrigger>
                            <SelectContent>
                              {control.options.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {item}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={value === undefined || value === null ? "" : String(value)}
                            disabled={disabled || filtered}
                            inputMode={control.type === "number" ? "decimal" : undefined}
                            placeholder={control.placeholder || control.path}
                            className="h-8"
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              updateValue(control.type === "number" ? parseNumberInput(nextValue) : nextValue);
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
