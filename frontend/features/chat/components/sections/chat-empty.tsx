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
      {children ? (
        <div className="mt-5 w-full max-w-[800px] space-y-3 md:mt-6">
          {suggestions.length > 0 ? (
            <div className="flex w-full flex-wrap justify-center gap-2 px-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="group inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-background/75 px-3 text-[12px] font-medium leading-none text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={suggestionsDisabled}
                  aria-label={`${suggestion.title}: ${suggestion.subtitle}`}
                  title={suggestion.subtitle}
                  onClick={() => onSelectSuggestion?.(suggestion.prompt)}
                >
                  <span className="min-w-0 truncate">{suggestion.title}</span>
                  <ArrowUpRight className="size-3 shrink-0 transition-colors group-hover:text-foreground" />
                </button>
              ))}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
