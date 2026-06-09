"use client";

import * as React from "react";
import { Check, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  availableReasoningModes,
  detectReasoningMode,
  reasoningOptionsForMode,
  type ReasoningMode,
  type ReasoningModeContext,
} from "@/features/chat/model/reasoning-options";
import { cn } from "@/lib/utils";
import type { ConversationOptions } from "@/shared/api/conversation.types";
import type { ModelOptionPolicy } from "@/shared/lib/model-option-policy";

type ChatModelConfigProps = {
  disabled: boolean;
  options: ConversationOptions;
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

export function ChatModelConfig({
  disabled,
  options,
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
          {tComposer("thinkingModeSelected", { mode: selectedLabel })} - {selectedDescription}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
