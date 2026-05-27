"use client";

import * as React from "react";

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
        <div className="mt-5 w-full max-w-[800px] space-y-2.5 md:mt-6">
          {children}
          {suggestions.length > 0 ? (
            <div className="w-full px-2 text-left md:px-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="group grid w-full grid-cols-1 gap-0.5 border-b border-border/55 py-2 text-left transition-colors last:border-b-0 hover:border-foreground/35 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-baseline sm:gap-2.5"
                  disabled={suggestionsDisabled}
                  aria-label={`${suggestion.title}: ${suggestion.subtitle}`}
                  title={suggestion.subtitle}
                  onClick={() => onSelectSuggestion?.(suggestion.prompt)}
                >
                  <span className="w-fit border-b border-muted-foreground/35 pb-px text-[12px] font-medium leading-5 text-foreground transition-colors group-hover:border-foreground">
                    {suggestion.title}
                  </span>
                  <span className="min-w-0 text-[12px] leading-5 text-muted-foreground">
                    {suggestion.subtitle}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
