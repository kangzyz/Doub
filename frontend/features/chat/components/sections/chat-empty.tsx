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
            <div className="flex w-full flex-wrap justify-start gap-x-4 gap-y-1.5 px-2 text-left md:px-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="inline-flex max-w-full border-b border-muted-foreground/35 pb-0.5 text-[12px] font-medium leading-5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={suggestionsDisabled}
                  aria-label={`${suggestion.title}: ${suggestion.subtitle}`}
                  title={suggestion.subtitle}
                  onClick={() => onSelectSuggestion?.(suggestion.prompt)}
                >
                  <span className="truncate">{suggestion.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
