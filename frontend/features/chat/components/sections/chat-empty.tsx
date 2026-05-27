"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

export type EmptyChatSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
};

type ChatEmptyStateProps = {
  greetingTitle: string;
  suggestions?: EmptyChatSuggestion[];
  suggestionsDisabled?: boolean;
  onSelectSuggestion?: (prompt: string) => void;
  children?: React.ReactNode;
};

export function ChatEmptyState({
  greetingTitle,
  suggestions = [],
  suggestionsDisabled = false,
  onSelectSuggestion,
  children,
}: ChatEmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-3 py-10 text-center md:px-6 md:py-16">
      <h1 className="text-balance text-[22px] font-medium leading-[1.12] tracking-[-0.005em] text-foreground [font-family:var(--font-economist)] md:text-[32px]">
        {greetingTitle}
      </h1>
      {suggestions.length > 0 ? (
        <div className="mt-6 grid w-full max-w-[800px] grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="group min-h-[74px] rounded-lg border border-border/65 bg-background/70 px-3.5 py-3 text-left shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={suggestionsDisabled}
              onClick={() => onSelectSuggestion?.(suggestion.prompt)}
            >
              <span className="flex min-w-0 items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium leading-5 text-foreground">
                    {suggestion.title}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                    {suggestion.subtitle}
                  </span>
                </span>
                <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {children ? <div className="mt-5 w-full max-w-[800px] md:mt-6">{children}</div> : null}
    </div>
  );
}
