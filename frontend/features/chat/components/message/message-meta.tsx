"use client";

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Brain,
  ClockArrowUp,
  ClockCheck,
  DatabaseSearch,
  DatabaseZap,
  Cpu,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Brush } from "@/components/animate-ui/icons/brush";
import { ChevronLeft } from "@/components/animate-ui/icons/chevron-left";
import { ChevronRight } from "@/components/animate-ui/icons/chevron-right";
import { Copy } from "@/components/animate-ui/icons/copy";
import { Heart } from "@/components/animate-ui/icons/heart";
import { RotateCcw } from "@/components/animate-ui/icons/rotate-ccw";
import { ThumbsDown } from "@/components/animate-ui/icons/thumbs-down";
import { ThumbsUp } from "@/components/animate-ui/icons/thumbs-up";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resolveAccessToken } from "@/shared/auth/resolve-access-token";
import { upsertUserMemory } from "@/shared/api/memory";
import { useLocalizedErrorMessage } from "@/i18n/use-localized-error";
import type { ChatMessageBranchNavigator } from "@/features/chat/types/messages";
import { useAppLocale } from "@/i18n/app-i18n-provider";

export type ChatMetaMessage = {
  publicID: string;
  createdAt?: string;
  updatedAt?: string;
  isPending?: boolean;
  isStreaming?: boolean;
  branchNavigator?: ChatMessageBranchNavigator;
  platformModelName?: string;
  // Token usage for assistant messages.
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  latencyMS?: number;
};

export type AssistantReaction = "up" | "down" | null;

function formatMessageDate(value: string | undefined, locale: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      month: "numeric",
      day: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function BranchSwitcher({
  item,
  onCycle,
}: {
  item: ChatMetaMessage;
  onCycle: (parentPublicID: string | null, direction: "previous" | "next") => void;
}) {
  const t = useTranslations("chat.messages");
  if (!item.branchNavigator) {
    return null;
  }

  return (
    <div className="inline-flex items-center">
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35"
        aria-label={t("previousBranch")}
        disabled={!item.branchNavigator.canPrevious}
        onClick={() => onCycle(item.branchNavigator?.parentPublicID ?? null, "previous")}
      >
        <ChevronLeft size={14} strokeWidth={1.8} animateOnHover="default" />
      </button>
      <span className="min-w-7 text-center tabular-nums text-xs font-medium tracking-[0.01em] text-muted-foreground">
        {item.branchNavigator.index}/{item.branchNavigator.total}
      </span>
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35"
        aria-label={t("nextBranch")}
        disabled={!item.branchNavigator.canNext}
        onClick={() => onCycle(item.branchNavigator?.parentPublicID ?? null, "next")}
      >
        <ChevronRight size={14} strokeWidth={1.8} animateOnHover="default" />
      </button>
    </div>
  );
}

function MetaContainer({
  align,
  mobileStack = false,
  alwaysVisible = false,
  children,
}: React.PropsWithChildren<{
  align: "start" | "end";
  mobileStack?: boolean;
  alwaysVisible?: boolean;
}>) {
  return (
    <div
      className={[
        "mt-1.5 flex gap-1 text-xs text-muted-foreground opacity-100 transition-opacity duration-150",
        alwaysVisible ? "md:pointer-events-auto md:opacity-100" : "md:pointer-events-none md:opacity-0",
        mobileStack ? "flex-col items-start md:flex-row md:items-center" : "items-center",
        align === "end" ? "justify-end" : "justify-start",
        !alwaysVisible && align === "end"
          ? "md:group-hover/user-message:pointer-events-auto md:group-hover/user-message:opacity-100 md:group-focus-within/user-message:pointer-events-auto md:group-focus-within/user-message:opacity-100"
          : "",
        !alwaysVisible && align === "start"
          ? "md:group-hover/assistant-message:pointer-events-auto md:group-hover/assistant-message:opacity-100 md:group-focus-within/assistant-message:pointer-events-auto md:group-focus-within/assistant-message:opacity-100"
          : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function UserMessageMeta({
  item,
  busy,
  showRetry,
  onCycleBranch,
  onRetry,
  onEdit,
  onCopy,
  readOnly = false,
  alwaysVisible = false,
  showBranchNavigator = true,
}: {
  item: ChatMetaMessage;
  busy: boolean;
  showRetry: boolean;
  onCycleBranch: (parentPublicID: string | null, direction: "previous" | "next") => void;
  onRetry: () => void;
  onEdit: () => void;
  onCopy: () => void;
  readOnly?: boolean;
  alwaysVisible?: boolean;
  showBranchNavigator?: boolean;
}) {
  const t = useTranslations("chat.messages");
  const { locale } = useAppLocale();
  const dateLabel = formatMessageDate(item.createdAt, locale);
  const canShowBranchNavigator = Boolean(showBranchNavigator && item.branchNavigator && !busy && !item.isPending);

  return (
    <MetaContainer align="end" alwaysVisible={alwaysVisible}>
      {dateLabel ? <span className="mr-1 shrink-0 tabular-nums">{dateLabel}</span> : null}
      {!readOnly ? (
        <div className="flex items-center">
          {showRetry ? (
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label={t("retryMessage")}
              disabled={item.isPending}
              onClick={onRetry}
            >
              <RotateCcw size={14} strokeWidth={1.8} animateOnHover="default" />
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:opacity-40"
            aria-label={t("editMessage")}
            disabled={item.isPending}
            onClick={onEdit}
          >
            <Brush size={14} strokeWidth={1.8} animateOnHover="default" />
          </button>
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label={t("copyMessage")}
            disabled={item.isPending}
            onClick={onCopy}
          >
            <Copy size={14} strokeWidth={1.8} animateOnHover="default" />
          </button>
        </div>
      ) : null}
      {canShowBranchNavigator ? <BranchSwitcher item={item} onCycle={onCycleBranch} /> : null}
    </MetaContainer>
  );
}

function TokenBadge({
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheWriteTokens,
  reasoningTokens,
}: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}) {
  const t = useTranslations("chat.meta");
  const inputValue = inputTokens ?? 0;
  const outputValue = outputTokens ?? 0;
  const cacheReadValue = cacheReadTokens ?? 0;
  const cacheWriteValue = cacheWriteTokens ?? 0;
  const reasoningValue = reasoningTokens ?? 0;
  const hasUsage = inputValue > 0 || outputValue > 0 || cacheReadValue > 0 || cacheWriteValue > 0 || reasoningValue > 0;
  if (!hasUsage) {
    return null;
  }

  return (
    <span className="ml-0.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] leading-3.5 font-mono text-muted-foreground/70 bg-muted/30 select-none whitespace-nowrap">
      <TokenMetric label={t("inputTokens")} value={inputValue} icon={<ArrowUpFromLine className="size-3" strokeWidth={1.4} />} />
      <TokenMetric label={t("cacheReadTokens")} value={cacheReadValue} icon={<DatabaseSearch className="size-3" strokeWidth={1.4} />} />
      <TokenMetric label={t("reasoningTokens")} value={reasoningValue} icon={<Brain className="size-3" strokeWidth={1.4} />} />
      <TokenMetric label={t("outputTokens")} value={outputValue} icon={<ArrowDownToLine className="size-3" strokeWidth={1.4} />} />
      <TokenMetric label={t("cacheWriteTokens")} value={cacheWriteValue} icon={<DatabaseZap className="size-3" strokeWidth={1.4} />} />
    </span>
  );
}

function TokenMetric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5" aria-label={label}>
          {icon}
          {value.toLocaleString()}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "";
  }
  const wholeMS = Math.max(1, Math.floor(ms));
  if (wholeMS <= 9999) {
    return `${wholeMS}ms`;
  }
  return `${Math.floor(wholeMS / 1000)}s`;
}

function useLiveElapsedMS(enabled: boolean, createdAt?: string): number {
  const [elapsedMS, setElapsedMS] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setElapsedMS(0);
      return;
    }
    const startedAt = new Date(createdAt ?? "").getTime();
    if (Number.isNaN(startedAt)) {
      setElapsedMS(0);
      return;
    }

    let frameID: number | null = null;
    let timerID: number | null = null;

    const tick = () => {
      const nextElapsedMS = Math.max(0, Date.now() - startedAt);
      setElapsedMS(nextElapsedMS);

      if (nextElapsedMS < 9999) {
        frameID = window.requestAnimationFrame(tick);
        return;
      }

      const delayToNextSecond = Math.max(1, 1000 - (nextElapsedMS % 1000));
      timerID = window.setTimeout(tick, delayToNextSecond);
    };

    tick();

    return () => {
      if (frameID !== null) {
        window.cancelAnimationFrame(frameID);
      }
      if (timerID !== null) {
        window.clearTimeout(timerID);
      }
    };
  }, [createdAt, enabled]);

  return enabled ? elapsedMS : 0;
}

function calculateElapsedMS(startedAt?: string, endedAt?: string): number {
  if (!startedAt || !endedAt) {
    return 0;
  }
  const startMS = new Date(startedAt).getTime();
  const endMS = new Date(endedAt).getTime();
  if (Number.isNaN(startMS) || Number.isNaN(endMS)) {
    return 0;
  }
  return Math.max(0, endMS - startMS);
}

function LatencyBadge({ item }: { item: ChatMetaMessage }) {
  const t = useTranslations("chat.meta");
  const isLive = Boolean(item.isPending || item.isStreaming);
  const liveLatencyMS = useLiveElapsedMS(isLive, item.createdAt);
  const storedLatencyMS = item.latencyMS && item.latencyMS > 0 ? item.latencyMS : 0;
  const calculatedLatencyMS = calculateElapsedMS(item.createdAt, item.updatedAt);
  const latencyMS = isLive
    ? liveLatencyMS || calculatedLatencyMS || storedLatencyMS
    : storedLatencyMS || calculatedLatencyMS;
  const label = formatDuration(latencyMS);
  if (!label) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="ml-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-3.5 font-mono text-muted-foreground/70 bg-muted/30 select-none whitespace-nowrap"
          aria-label={isLive ? t("generationDuration") : t("totalDuration")}
        >
          {isLive ? (
            <ClockArrowUp className="size-3" strokeWidth={1.4} />
          ) : (
            <ClockCheck className="size-3" strokeWidth={1.4} />
          )}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{isLive ? t("generationDuration") : t("totalDuration")}</TooltipContent>
    </Tooltip>
  );
}

function ModelBadge({ label }: { label: string }) {
  const t = useTranslations("chat.meta");
  const normalized = label.trim();
  if (!normalized) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="ml-0.5 inline-flex max-w-48 items-center gap-1 rounded bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] leading-3.5 text-muted-foreground/70 select-none whitespace-nowrap"
          aria-label={t("model")}
        >
          <Cpu className="size-3 shrink-0" strokeWidth={1.4} />
          <span className="truncate">{normalized}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{normalized}</TooltipContent>
    </Tooltip>
  );
}

function QuickMemoryPin({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("chat.messages");
  const resolveErrorMessage = useLocalizedErrorMessage();
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSave = React.useCallback(async () => {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) return;
    setSaving(true);
    try {
      const token = await resolveAccessToken();
      if (!token) {
        toast.error(t("authTokenMissing"));
        return;
      }
      await upsertUserMemory(token, trimmedKey, trimmedValue, "preference");
      toast.success(t("memorySaved"), { description: t("memorySavedDescription") });
      setKey("");
      setValue("");
      setOpen(false);
    } catch (error) {
      toast.error(t("memorySaveFailed"), { description: resolveErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }, [key, resolveErrorMessage, t, value]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSave();
      }
    },
    [handleSave],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label={t("rememberPreference")}
          disabled={disabled}
        >
          <Heart size={14} strokeWidth={1.8} animateOnHover="default" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 text-[12px] font-medium text-foreground">{t("rememberPreference")}</p>
        <div className="space-y-2">
          <Input
            placeholder={t("memoryNamePlaceholder")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Input
            placeholder={t("memoryValuePlaceholder")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="sm"
            className="h-7 w-full text-[12px]"
            disabled={!key.trim() || !value.trim() || saving}
            onClick={() => void handleSave()}
          >
            {saving ? t("savingPreference") : t("savePreference")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AssistantMessageMeta({
  item,
  busy,
  reaction,
  onCycleBranch,
  onRetry,
  onCopy,
  onReact,
  showModelInfo = true,
  showLatency = true,
  showTokenUsage = true,
  readOnly = false,
  alwaysVisible = false,
  showBranchNavigator = true,
}: {
  item: ChatMetaMessage;
  busy: boolean;
  reaction: AssistantReaction;
  onCycleBranch: (parentPublicID: string | null, direction: "previous" | "next") => void;
  onRetry: () => void;
  onCopy: () => void;
  onReact: (value: AssistantReaction) => void;
  showModelInfo?: boolean;
  showLatency?: boolean;
  showTokenUsage?: boolean;
  readOnly?: boolean;
  alwaysVisible?: boolean;
  showBranchNavigator?: boolean;
}) {
  const t = useTranslations("chat.messages");
  const isLive = Boolean(item.isPending || item.isStreaming);
  const canRetry = !readOnly && !busy && !isLive;
  const canShowBranchNavigator = Boolean(showBranchNavigator && item.branchNavigator && !busy && !isLive);

  return (
    <MetaContainer align="start" mobileStack alwaysVisible={alwaysVisible}>
      {!readOnly ? (
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label={t("copyReply")}
            disabled={!item.publicID}
            onClick={onCopy}
          >
            <Copy size={14} strokeWidth={1.8} animateOnHover="default" />
          </button>
          <button
            type="button"
            className={[
              "inline-flex size-6 items-center justify-center rounded-md transition-colors disabled:opacity-40",
              reaction === "up" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            aria-label={t("likeReply")}
            disabled={isLive}
            onClick={() => onReact(reaction === "up" ? null : "up")}
          >
            <ThumbsUp size={14} strokeWidth={1.8} animateOnHover="default" />
          </button>
          <button
            type="button"
            className={[
              "inline-flex size-6 items-center justify-center rounded-md transition-colors disabled:opacity-40",
              reaction === "down" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            aria-label={t("dislikeReply")}
            disabled={isLive}
            onClick={() => onReact(reaction === "down" ? null : "down")}
          >
            <ThumbsDown size={14} strokeWidth={1.8} animateOnHover="default" />
          </button>
          {canRetry ? (
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label={t("retryReply")}
              onClick={onRetry}
            >
              <RotateCcw size={14} strokeWidth={1.8} animateOnHover="default" />
            </button>
          ) : null}
          <QuickMemoryPin disabled={isLive} />
        </div>
      ) : null}
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
        {showModelInfo ? <ModelBadge label={item.platformModelName?.trim() || ""} /> : null}
        {showTokenUsage ? (
          <TokenBadge
            inputTokens={item.inputTokens}
            outputTokens={item.outputTokens}
            cacheReadTokens={item.cacheReadTokens}
            cacheWriteTokens={item.cacheWriteTokens}
            reasoningTokens={item.reasoningTokens}
          />
        ) : null}
        {showLatency ? <LatencyBadge item={item} /> : null}
        {canShowBranchNavigator ? <BranchSwitcher item={item} onCycle={onCycleBranch} /> : null}
      </div>
    </MetaContainer>
  );
}
