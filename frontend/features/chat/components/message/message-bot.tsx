"use client";

import * as React from "react";
import { ArrowUpRight, ChevronDown, CircleAlert, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { AssistantMessageMeta } from "@/features/chat/components/message/message-meta";
import { MessageAttachmentRow } from "@/features/chat/components/message/message-attachment";
import {
  extractImageGenerationTraceImageSources,
  hasActiveImageGenerationTraceTool,
  MessageProcessTrace,
  MessageTraceEventBlocks,
  MessageToolTrace,
  MessageUpstreamThink,
} from "@/features/chat/components/message/message-process-trace";
import { GrainientBackground } from "@/components/reactbits/backgrounds/grainient";
import type { AssistantReaction } from "@/features/chat/components/message/message-meta";
import type {
  ChatAreaMessage,
  ChatInlineAlert,
  MessageAttachment,
} from "@/features/chat/types/messages";
import {
  MarkdownImage,
  MarkdownImageActionsContext,
  type MarkdownArtifactActions,
  type MarkdownImageActions,
} from "@/features/chat/components/markdown/streamdown-components";
import { StreamdownRender } from "@/features/chat/components/markdown/streamdown-render";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { summarizeUpstreamError } from "@/features/chat/utils/chat-runtime";
import { fetchFileContent, type FileContentResult } from "@/shared/api/file";
import { resolveAccessToken } from "@/shared/auth/resolve-access-token";
import type { PreviewDialogFile } from "@/features/files/components/preview/file-preview-dialog";

const EMPTY_TRACE_EVENTS: NonNullable<ChatAreaMessage["processTrace"]>["events"] = [];

function isEditableImageAttachment(attachment: MessageAttachment): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  const detectedMime = attachment.detectedMime?.toLowerCase() || "";
  return (
    attachment.kind === "image" ||
    attachment.fileCategory === "image" ||
    mimeType.startsWith("image/") ||
    detectedMime.startsWith("image/")
  );
}

function resolveFileIDFromFileContentSrc(src: string): string | null {
  const fallbackBase = "http://doub.local";
  try {
    const url = new URL(src, fallbackBase);
    const match = url.pathname.match(/\/api\/v1\/files\/([^/]+)\/content$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    const match = src.match(/(?:^|\/)api\/v1\/files\/([^/?#]+)\/content(?:[?#].*)?$/);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return null;
  }
}

function resolveFileIDFromImageSrc(src: string): string | null {
  return resolveFileIDFromFileContentSrc(src);
}

function resolveEditableImageAttachment(
  src: string,
  attachments: MessageAttachment[],
  contentType: string | undefined,
): MessageAttachment | null {
  if (attachments.length === 0) {
    return null;
  }

  const fileID = resolveFileIDFromImageSrc(src);
  if (fileID) {
    return attachments.find((attachment) => attachment.fileID === fileID) ?? null;
  }

  if (contentType === "image" && attachments.length === 1) {
    return attachments[0];
  }

  return null;
}

function isVideoAttachment(attachment: MessageAttachment): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  const detectedMime = attachment.detectedMime?.toLowerCase() || "";
  return (
    attachment.kind === "video" ||
    attachment.fileCategory === "video" ||
    mimeType.startsWith("video/") ||
    detectedMime.startsWith("video/")
  );
}

function resolveInlineVideoAttachment(
  attachments: MessageAttachment[] | undefined,
  contentType: string | undefined,
): MessageAttachment | null {
  if (contentType !== "video" || !attachments?.length) {
    return null;
  }
  return attachments.find(isVideoAttachment) ?? null;
}

function extractSingleMarkdownLinkHref(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^!?\[[^\]]*]\((<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\)$/);
  if (!match?.[1]) {
    return null;
  }
  const rawHref = match[1].trim();
  return rawHref.startsWith("<") && rawHref.endsWith(">") ? rawHref.slice(1, -1).trim() : rawHref;
}

function isOnlyGeneratedVideoFileLink(content: string, attachment: MessageAttachment | null): boolean {
  if (!attachment) {
    return false;
  }
  const href = extractSingleMarkdownLinkHref(content);
  if (!href) {
    return false;
  }
  return resolveFileIDFromFileContentSrc(href) === attachment.fileID;
}

type ChatMessageBotProps = {
  item: ChatAreaMessage;
  busy: boolean;
  reaction: AssistantReaction;
  onRetryAssistantMessage: (message: ChatAreaMessage) => Promise<void> | void;
  onCycleMessageBranch: (parentPublicID: string | null, direction: "previous" | "next") => void;
  onReactAssistantMessage: (publicID: string, reaction: AssistantReaction) => void;
  onCopy: () => void;
  onSendSuggestion?: (prompt: string) => void | Promise<void>;
  markdownRender?: boolean;
  showModelInfo?: boolean;
  showLatency?: boolean;
  showTokenUsage?: boolean;
  readOnly?: boolean;
  attachmentContentLoader?: (file: PreviewDialogFile) => Promise<FileContentResult>;
  onEditImageAttachment?: (attachment: MessageAttachment, sourceModelName?: string) => void;
  artifactActions?: MarkdownArtifactActions;
  showBranchNavigator?: boolean;
  showFollowUps?: boolean;
};

function AssistantGeneratedImageList({
  sources,
  imageActions,
}: {
  sources: string[];
  imageActions?: MarkdownImageActions;
}) {
  const t = useTranslations("chat.processTrace.tool.detail");
  const uniqueSources = React.useMemo(
    () => Array.from(new Set(sources.map((item) => item.trim()).filter(Boolean))).slice(0, 4),
    [sources],
  );

  if (uniqueSources.length === 0) {
    return null;
  }

  const content = (
    <div className="mt-4 flex w-full max-w-[34rem] flex-col items-start gap-3">
      {uniqueSources.map((src, index) => (
        <MarkdownImage
          key={`${src.slice(0, 80)}-${index}`}
          alt={t("generatedImageAlt", { index: index + 1 })}
          className="my-0"
          src={src}
        />
      ))}
    </div>
  );

  return (
    <MarkdownImageActionsContext.Provider value={imageActions ?? null}>
      {content}
    </MarkdownImageActionsContext.Provider>
  );
}

function AssistantInlineVideo({
  attachment,
  loadContent,
  aspectRatio = "wide",
}: {
  attachment: MessageAttachment;
  loadContent?: (file: PreviewDialogFile) => Promise<FileContentResult>;
  aspectRatio?: ChatAreaMessage["imageAspectRatio"];
}) {
  const t = useTranslations("chat.messages");
  const [state, setState] = React.useState<
    | { status: "loading" }
    | { status: "ready"; objectURL: string; contentType: string }
    | { status: "error"; message: string }
  >({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    let objectURL = "";
    setState({ status: "loading" });

    void (async () => {
      try {
        const result = loadContent
          ? await loadContent(attachment)
          : await (async () => {
              const token = await resolveAccessToken();
              if (!token) {
                throw new Error("Missing access token");
              }
              return fetchFileContent(token, attachment.fileID);
            })();
        objectURL = URL.createObjectURL(result.blob);
        if (cancelled) {
          URL.revokeObjectURL(objectURL);
          return;
        }
        setState({ status: "ready", objectURL, contentType: result.contentType || attachment.mimeType || "video/mp4" });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: t("videoLoadFailed") });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
      }
    };
  }, [attachment, loadContent, t]);

  const frameClassName =
    aspectRatio === "portrait" ? "max-w-[18rem]" : aspectRatio === "square" ? "max-w-[24rem]" : "max-w-[32rem]";

  return (
    <div className={cn("my-4 w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20", frameClassName)}>
      {state.status === "ready" ? (
        <video
          aria-label={attachment.fileName || t("generatedVideo")}
          className="block max-h-[min(68vh,720px)] w-full bg-black object-contain"
          controls
          playsInline
          preload="metadata"
        >
          <source src={state.objectURL} type={state.contentType} />
        </video>
      ) : state.status === "error" ? (
        <div className="flex min-h-36 items-center gap-2 px-4 py-3 text-[13px] text-muted-foreground">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{state.message}</span>
        </div>
      ) : (
        <div className="flex min-h-36 items-center gap-2 px-4 py-3 text-[13px] text-muted-foreground">
          <span className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted border-t-foreground/50" />
          <span className="min-w-0 truncate">{t("videoLoading")}</span>
        </div>
      )}
    </div>
  );
}

export function ChatMessageBot({
  item,
  busy,
  reaction,
  onRetryAssistantMessage,
  onCycleMessageBranch,
  onReactAssistantMessage,
  onCopy,
  onSendSuggestion,
  markdownRender = true,
  showModelInfo = true,
  showLatency = true,
  showTokenUsage = true,
  readOnly = false,
  attachmentContentLoader,
  onEditImageAttachment,
  artifactActions,
  showBranchNavigator = true,
  showFollowUps = false,
}: ChatMessageBotProps) {
  const onRetry = React.useCallback(() => {
    void onRetryAssistantMessage(item);
  }, [item, onRetryAssistantMessage]);
  const upstreamThink = item.processTrace?.upstreamThink;
  const toolTrace = item.processTrace?.tools;
  const traceEvents = item.processTrace?.events ?? EMPTY_TRACE_EVENTS;
  const messageStreaming = Boolean(item.isStreaming);
  const upstreamThinkStreaming = messageStreaming && upstreamThink?.status === "streaming";
  const toolTraceStreaming = messageStreaming && toolTrace?.status === "streaming";
  const inlineVideoAttachment = React.useMemo(
    () => resolveInlineVideoAttachment(item.attachments, item.contentType),
    [item.attachments, item.contentType],
  );
  const renderContent = React.useMemo(
    () => (isOnlyGeneratedVideoFileLink(item.content, inlineVideoAttachment) ? "" : item.content),
    [inlineVideoAttachment, item.content],
  );
  const hasStreamdownContent = renderContent.trim().length > 0;
  const postProcessEvents = React.useMemo(
    () =>
      traceEvents.filter(
        (event) =>
          event.phase === "tools" ||
          event.phase === "upstream_think" ||
          event.eventType === "tool" ||
          event.eventType === "think",
      ),
    [traceEvents],
  );
  const hasTraceEvents = postProcessEvents.length > 0;
  const nativeImageGenerationLoading = messageStreaming && !hasStreamdownContent && hasActiveImageGenerationTraceTool(toolTrace);
  const isImageGenerationLoading = messageStreaming && !hasStreamdownContent && (item.contentType === "image" || nativeImageGenerationLoading);
  const isVideoGenerationLoading = messageStreaming && !hasStreamdownContent && item.contentType === "video";
  const nativeImageGenerationSources = React.useMemo(() => extractImageGenerationTraceImageSources(toolTrace), [toolTrace]);
  const editableImageAttachments = React.useMemo(
    () => (item.attachments ?? []).filter(isEditableImageAttachment),
    [item.attachments],
  );
  const getEditableImageAttachment = React.useCallback(
    (src: string) => resolveEditableImageAttachment(src, editableImageAttachments, item.contentType),
    [editableImageAttachments, item.contentType],
  );
  const markdownImageActions = React.useMemo(() => {
    if (readOnly || !onEditImageAttachment || editableImageAttachments.length === 0) {
      return undefined;
    }
    return {
      canEditImage: (src: string) => Boolean(getEditableImageAttachment(src)),
      onEditImage: (src: string) => {
        const attachment = getEditableImageAttachment(src);
        if (attachment) {
          onEditImageAttachment(attachment, item.platformModelName);
        }
      },
    };
  }, [
    editableImageAttachments.length,
    getEditableImageAttachment,
    item.platformModelName,
    onEditImageAttachment,
    readOnly,
  ]);
  const activeThinkBlock = hasTraceEvents && upstreamThink?.status === "streaming" ? upstreamThink : undefined;
  const activeToolBlock = hasTraceEvents && toolTrace?.status === "streaming" && !nativeImageGenerationLoading ? toolTrace : undefined;
  const showNativeImageGenerationImages = !isImageGenerationLoading && !item.inlineAlert && nativeImageGenerationSources.length > 0;
  const hasInlineVideo = Boolean(inlineVideoAttachment);
  const processAutoCollapseReady = Boolean(hasTraceEvents || upstreamThink || toolTrace || hasStreamdownContent || hasInlineVideo || item.inlineAlert || isImageGenerationLoading || isVideoGenerationLoading);
  const toolAutoCollapseReady = Boolean(upstreamThink || hasStreamdownContent || hasInlineVideo || item.inlineAlert || isImageGenerationLoading || isVideoGenerationLoading);

  return (
    <div className="group/assistant-message flex w-full flex-col items-start">
      {hasTraceEvents ? (
        <>
          <MessageProcessTrace
            trace={item.processTrace}
            active={messageStreaming}
            autoCollapseReady={processAutoCollapseReady}
          />
          <MessageTraceEventBlocks
            events={postProcessEvents}
            activeToolBlock={activeToolBlock}
            activeThinkBlock={activeThinkBlock}
            messageStreaming={messageStreaming}
            autoCollapseReady={hasStreamdownContent || Boolean(item.inlineAlert)}
            hideImageGenerationImages={showNativeImageGenerationImages}
          />
        </>
      ) : (
        <>
          <MessageProcessTrace
            trace={item.processTrace}
            active={messageStreaming}
            autoCollapseReady={processAutoCollapseReady}
          />

          <MessageToolTrace
            block={nativeImageGenerationLoading ? undefined : toolTrace}
            streaming={toolTraceStreaming}
            autoCollapseReady={toolAutoCollapseReady}
            hideImageGenerationImages={showNativeImageGenerationImages}
          />

          <MessageUpstreamThink block={upstreamThink} streaming={upstreamThinkStreaming} />
        </>
      )}

      <div
        className="w-full min-w-0 max-w-none overflow-hidden text-[15px] leading-8 text-foreground [overflow-wrap:anywhere]"
        style={{ fontFamily: "var(--font-chat)", fontWeight: "var(--font-chat-weight)" }}
      >
        {inlineVideoAttachment && !item.inlineAlert ? (
          <AssistantInlineVideo
            attachment={inlineVideoAttachment}
            loadContent={attachmentContentLoader}
            aspectRatio={item.imageAspectRatio}
          />
        ) : isVideoGenerationLoading && !item.inlineAlert ? (
          <AssistantVideoGenerationSkeleton label={item.activityLabel} aspectRatio={item.imageAspectRatio} />
        ) : isImageGenerationLoading && !item.inlineAlert ? (
          <AssistantImageGenerationSkeleton label={item.activityLabel} aspectRatio={item.imageAspectRatio} />
        ) : item.isStreaming && !hasStreamdownContent && !item.inlineAlert ? (
          <AssistantMessageSkeleton fileProc={item.isFileProc} label={item.activityLabel} />
        ) : hasStreamdownContent && markdownRender ? (
          <StreamdownRender
            content={renderContent}
            streaming={Boolean(item.isStreaming)}
            imageActions={markdownImageActions}
            artifactActions={artifactActions}
          />
        ) : hasStreamdownContent ? (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{renderContent}</p>
        ) : null}
        {showNativeImageGenerationImages ? (
          <AssistantGeneratedImageList sources={nativeImageGenerationSources} imageActions={markdownImageActions} />
        ) : null}
      </div>

      {item.inlineAlert ? (
        <ChatInlineAlertCard alert={item.inlineAlert} className={hasStreamdownContent ? "my-4" : "mb-4"} />
      ) : null}

      {item.attachments && item.attachments.length > 0 ? (
        <div className="mt-2 flex w-full justify-start">
          <MessageAttachmentRow
            attachments={item.attachments}
            loadContent={attachmentContentLoader}
            allowDownload={!readOnly}
            align="start"
          />
        </div>
      ) : null}

      {showFollowUps && item.followUps && item.followUps.length > 0 && onSendSuggestion ? (
        <AssistantFollowUpSuggestions items={item.followUps} onSelect={onSendSuggestion} />
      ) : null}

      <AssistantMessageMeta
        item={item}
        busy={busy}
        reaction={reaction}
        onCycleBranch={onCycleMessageBranch}
        onRetry={onRetry}
        onCopy={onCopy}
        onReact={(value) => onReactAssistantMessage(item.publicID, value)}
        showModelInfo={showModelInfo}
        showLatency={showLatency}
        showTokenUsage={showTokenUsage}
        readOnly={readOnly}
        alwaysVisible={readOnly}
        showBranchNavigator={showBranchNavigator}
      />
    </div>
  );
}

function AssistantFollowUpSuggestions({
  items,
  onSelect,
}: {
  items: string[];
  onSelect: (prompt: string) => void | Promise<void>;
}) {
  return (
    <div className="mt-3 flex max-w-full flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className="group inline-flex max-w-full items-start gap-2 rounded-lg border border-border/65 bg-muted/25 px-3 py-2 text-left text-[13px] leading-5 text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => onSelect(item)}
        >
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item}</span>
          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 transition-colors group-hover:text-foreground" />
        </button>
      ))}
    </div>
  );
}

export function ChatInlineAlertCard({
  alert,
  className,
}: {
  alert: ChatInlineAlert;
  className?: string;
}) {
  const t = useTranslations("chat.composer");
  const details = alert.details;
  const message = alert.message.trim();
  const summary = summarizeUpstreamError(message, details, t("retryLater"));
  const hasDetails = Boolean(details?.request || details?.response);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const summaryText = [summary.statusCode ? `HTTP ${summary.statusCode}` : "", summary.reason].filter(Boolean).join(", ");
  return (
    <Alert className={cn("min-w-0 max-w-full overflow-hidden", className)} variant="destructive">
      <CircleAlert className="size-4" />
      <button
        type="button"
        disabled={!hasDetails}
        aria-expanded={hasDetails ? detailsOpen : undefined}
        className={cn(
          "col-start-2 flex w-full min-w-0 max-w-full items-start gap-3 text-left",
          "rounded-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/35",
          hasDetails ? "cursor-pointer hover:text-destructive" : "cursor-default",
        )}
        onClick={() => {
          if (hasDetails) {
            setDetailsOpen((open) => !open);
          }
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block min-h-4 truncate font-medium tracking-tight">{alert.title}</span>
          <span className="mt-0.5 block whitespace-normal break-words text-sm leading-relaxed text-destructive/90 [overflow-wrap:anywhere]">
            {summaryText}
          </span>
        </span>
        {hasDetails ? (
          <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-destructive/70 transition-transform", detailsOpen && "rotate-180")} />
        ) : null}
      </button>
      {hasDetails ? (
        <AlertDescription className="w-full min-w-0 max-w-full justify-self-stretch justify-items-stretch break-words [overflow-wrap:anywhere]">
          <UpstreamExchangeDetails details={details} open={detailsOpen} onOpenChange={setDetailsOpen} />
        </AlertDescription>
      ) : null}
    </Alert>
  );
}

function UpstreamExchangeDetails({
  details,
  open,
  onOpenChange,
}: {
  details?: ChatInlineAlert["details"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("chat.messages");

  return (
    <Accordion
      type="single"
      collapsible
      value={open ? "upstream-debug" : ""}
      onValueChange={(value) => onOpenChange(value === "upstream-debug")}
      className="w-full min-w-0 max-w-full text-xs text-foreground"
    >
      <AccordionItem value="upstream-debug" className="w-full min-w-0 max-w-full border-b-0">
        <AccordionContent className="w-full min-w-0 max-w-full pb-0 pt-3">
          <Tabs defaultValue="request" className="min-w-0 w-full max-w-full overflow-hidden">
            <TabsList className="h-7 gap-1">
              <TabsTrigger value="request">{t("debugRequest")}</TabsTrigger>
              <TabsTrigger value="response">{t("debugResponse")}</TabsTrigger>
            </TabsList>
            <TabsContent value="request" className="min-w-0 w-full max-w-full overflow-hidden">
              <DebugCodeBlock value={rawRequestBody(details)} />
            </TabsContent>
            <TabsContent value="response" className="min-w-0 w-full max-w-full overflow-hidden">
              <DebugCodeBlock value={rawResponseBody(details)} />
            </TabsContent>
          </Tabs>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function rawRequestBody(details?: ChatInlineAlert["details"]): string {
  return details?.request?.body ?? "";
}

function rawResponseBody(details?: ChatInlineAlert["details"]): string {
  return details?.response?.body ?? "";
}

function DebugCodeBlock({ value }: { value: string }) {
  return (
    <pre className="block max-h-96 min-w-0 w-full max-w-full justify-self-stretch overflow-y-auto overflow-x-hidden rounded-md bg-muted/45 px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
      <code>{formatDebugValue(value)}</code>
    </pre>
  );
}

function formatDebugValue(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  const parsedSSE = formatSSEData(raw);
  if (parsedSSE) {
    return parsedSSE;
  }
  return formatJSON(raw);
}

function formatSSEData(value: string): string {
  if (!/(^|\n)data:\s*/.test(value)) {
    return "";
  }
  const payloads = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]");
  if (payloads.length === 0) {
    return value;
  }
  return payloads.map(formatJSON).join("\n\n");
}

function formatJSON(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function AssistantMessageSkeleton({ fileProc, label }: { fileProc?: boolean; label?: string } = {}) {
  const t = useTranslations("chat.messages");
  const resolvedLabel = label?.trim() || (fileProc ? t("processing") : t("waitingResponse.title"));
  if (fileProc) {
    return (
      <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/55 bg-muted/25 px-3 py-2 text-[13px] text-muted-foreground">
        <span className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted border-t-foreground/60" />
        <span className="min-w-0 truncate">{resolvedLabel}</span>
      </div>
    );
  }
  return (
    <div className="w-full max-w-[560px] pt-1" role="status" aria-live="polite">
      <div className="rounded-lg border border-border/55 bg-muted/20 px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="relative mt-1 flex size-4 shrink-0 items-center justify-center">
            <span className="absolute inline-flex size-4 animate-ping rounded-full bg-primary/25" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <p className="min-w-0 text-[13px] font-medium leading-5 text-foreground">{resolvedLabel}</p>
              <span className="rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[11px] font-medium leading-4 text-primary">
                {t("waitingResponse.live")}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
              {t("waitingResponse.subtitle")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] leading-4 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t("waitingResponse.contextReady")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                {t("waitingResponse.modelWorking")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/35" />
                {t("waitingResponse.streamSoon")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssistantImageGenerationSkeleton({
  label,
  aspectRatio = "wide",
}: {
  label?: string;
  aspectRatio?: ChatAreaMessage["imageAspectRatio"];
}) {
  const t = useTranslations("chat.messages");
  const frameClassName =
    aspectRatio === "portrait" ? "max-w-[18rem]" : aspectRatio === "square" ? "max-w-[24rem]" : "max-w-[32rem]";
  const aspectClassName =
    aspectRatio === "portrait" ? "aspect-[9/16]" : aspectRatio === "square" ? "aspect-square" : "aspect-video";
  return (
    <div className={cn("my-4 w-full space-y-2.5", frameClassName)}>
      <div className="flex items-center gap-2 pt-1 text-[13px] text-muted-foreground">
        <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-muted border-t-foreground/50" />
        {label?.trim() || t("processing")}
      </div>
      <div className={cn("relative w-full overflow-hidden rounded-xl bg-muted/20 text-primary", aspectClassName)}>
        <GrainientBackground
          className="absolute inset-0 text-primary/75"
          color1="#BAE6FD"
          color2="#60A5FA"
          color3="#A78BFA"
          contrast={1.48}
          saturation={1.0}
          timeSpeed={2.6}
          warpAmplitude={72}
          warpSpeed={2.1}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="select-none text-[clamp(1.75rem,7vw,4rem)] font-semibold tracking-[0.18em] text-white/30 mix-blend-overlay drop-shadow-sm">
            DOUB
          </span>
        </div>
      </div>
    </div>
  );
}

export function AssistantVideoGenerationSkeleton({
  label,
  aspectRatio = "wide",
}: {
  label?: string;
  aspectRatio?: ChatAreaMessage["imageAspectRatio"];
}) {
  const t = useTranslations("chat.messages");
  const frameClassName =
    aspectRatio === "portrait" ? "max-w-[18rem]" : aspectRatio === "square" ? "max-w-[24rem]" : "max-w-[32rem]";
  const aspectClassName =
    aspectRatio === "portrait" ? "aspect-[9/16]" : aspectRatio === "square" ? "aspect-square" : "aspect-video";
  return (
    <div className={cn("my-4 w-full space-y-2.5", frameClassName)}>
      <div className="flex items-center gap-2 pt-1 text-[13px] text-muted-foreground">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Video className="size-3.5" strokeWidth={1.8} />
        </span>
        {label?.trim() || t("videoRunning")}
      </div>
      <div className={cn("relative w-full overflow-hidden rounded-xl bg-muted/20 text-primary", aspectClassName)}>
        <GrainientBackground
          className="absolute inset-0 text-primary/75"
          color1="#CFFAFE"
          color2="#38BDF8"
          color3="#22C55E"
          contrast={1.42}
          saturation={1.0}
          timeSpeed={2.2}
          warpAmplitude={68}
          warpSpeed={1.8}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-full bg-background/20 px-4 py-2 text-white/45 shadow-sm backdrop-blur-sm">
            <Video className="size-6" strokeWidth={1.5} />
            <span className="select-none text-[clamp(1rem,4vw,2.5rem)] font-semibold tracking-[0.14em] mix-blend-overlay">
              DOUB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
