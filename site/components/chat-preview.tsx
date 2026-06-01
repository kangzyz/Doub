"use client";

import { ArrowUp, Paperclip, Plus, Sparkles } from "lucide-react";

type Locale = "en" | "zh";

const T: Record<
  Locale,
  {
    newChat: string;
    convos: string[];
    routed: string;
    user: string;
    assistant: string;
    placeholder: string;
    attach: string;
  }
> = {
  en: {
    newChat: "New chat",
    convos: ["Refactor auth flow", "Q3 launch plan", "Translate spec → zh"],
    routed: "Routed to Claude Opus 4.8",
    user: "Compare these two model outputs and keep the better one.",
    assistant:
      "Routing to the strongest model for the task. Option B is tighter and cheaper to run — keeping it.",
    placeholder: "Message every model…",
    attach: "spec.pdf",
  },
  zh: {
    newChat: "新对话",
    convos: ["重构鉴权流程", "Q3 发布计划", "翻译规格 → 英文"],
    routed: "已路由到 Claude Opus 4.8",
    user: "比较这两个模型的输出，保留更好的那个。",
    assistant: "正在路由到最合适的模型。方案 B 更精炼、运行更省，已保留。",
    placeholder: "向所有模型发消息…",
    attach: "spec.pdf",
  },
};

export function ChatPreview({ locale }: { locale: Locale }) {
  const t = T[locale];

  return (
    <div className="card-glow w-full overflow-hidden rounded-2xl border border-border-strong bg-card/80 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-3 rounded-full bg-foreground/15" />
          <span className="size-3 rounded-full bg-foreground/15" />
          <span className="size-3 rounded-full bg-foreground/15" />
        </div>
        <div className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-cyan" />
          </span>
          {t.routed}
        </div>
      </div>

      <div className="grid grid-cols-[0_1fr] sm:grid-cols-[180px_1fr]">
        {/* Sidebar */}
        <aside className="hidden flex-col gap-1 border-r border-border bg-background/40 p-3 sm:flex">
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground">
            <Plus className="size-3.5 text-primary" aria-hidden />
            {t.newChat}
          </div>
          {t.convos.map((c, i) => (
            <div
              key={c}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                i === 0
                  ? "bg-subtle text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  i === 0 ? "bg-primary" : "bg-foreground/20"
                }`}
              />
              <span className="truncate">{c}</span>
            </div>
          ))}
          <div className="mt-auto flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted-foreground">
            <span className="size-5 rounded-full bg-gradient-to-br from-primary to-violet" />
            you@doub.chat
          </div>
        </aside>

        {/* Conversation */}
        <div className="flex min-h-[300px] flex-col p-4 sm:min-h-[340px] sm:p-5">
          <div className="flex flex-1 flex-col gap-4">
            {/* User */}
            <div className="flex justify-end">
              <p className="max-w-[78%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-[13px] leading-relaxed text-background">
                {t.user}
              </p>
            </div>

            {/* Assistant */}
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet text-primary-foreground">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <div className="max-w-[82%] space-y-2.5">
                <p className="rounded-2xl rounded-tl-md border border-border bg-background/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground/90">
                  {t.assistant}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
                    <Paperclip className="size-3" aria-hidden />
                    {t.attach}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-[11px] text-cyan">
                    GPT-5
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                    Claude
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/60 p-1.5 pl-3">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 truncate text-[13px] text-muted-foreground">
              {t.placeholder}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
              auto
            </span>
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet text-primary-foreground">
              <ArrowUp className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
