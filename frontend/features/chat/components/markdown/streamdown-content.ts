export type RenderSegment =
  | {
      type: "markdown";
      content: string;
    }
  | {
      type: "thinking";
      content: string;
      incomplete: boolean;
    };

export function normalizeContent(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return String(input);
  }

  if (input == null) {
    return "";
  }

  if (Array.isArray(input)) {
    return input.map((item) => normalizeContent(item)).filter(Boolean).join("\n");
  }

  if (typeof input === "object") {
    const maybeRecord = input as Record<string, unknown>;
    const textValue = maybeRecord.content ?? maybeRecord.text ?? maybeRecord.message;
    if (typeof textValue === "string") {
      return textValue;
    }

    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return "";
    }
  }

  return "";
}

const MARKDOWN_LITERAL_FRAGMENT_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
const INLINE_DOLLAR_MATH_RE = /(^|[^\\$])\$([^$\n]{1,800})\$/g;
const ESCAPED_INLINE_DOLLAR_MATH_RE = /\\\$([^$\n]{1,400})\\\$/g;
const DISPLAY_DOLLAR_MATH_RE = /(\${2,})([\s\S]*?)(\1)/g;
const SEMANTIC_HTML_FENCE_RE = /(^|\n)([ \t]*)(```|~~~)([^\n]*)\n([\s\S]*?)\n[ \t]*\3[ \t]*(?=\n|$)/g;
const SEMANTIC_HTML_TAG_RE = /<\s*(?:a|abbr|article|aside|blockquote|cite|code|dd|del|details|div|dl|dt|em|figure|figcaption|h[1-6]|hr|ins|kbd|li|mark|ol|p|pre|section|small|span|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/i;
const UNSAFE_SEMANTIC_HTML_TAG_RE = /<\/?\s*(?:body|button|embed|form|head|html|iframe|input|link|meta|object|script|select|style|textarea)\b/i;
const SEMANTIC_HTML_FENCE_LANGUAGES: ReadonlySet<string> = new Set([
  "",
  "htm",
  "html",
  "markdown",
  "md",
  "plain",
  "text",
]);
const SEMANTIC_HTML_CLASS_NAMES: ReadonlySet<string> = new Set([
  "badge",
  "badge-b",
  "badge-g",
  "badge-o",
  "badge-r",
  "card",
  "card-b",
  "card-g",
  "card-o",
  "card-p",
  "card-r",
  "card-x",
  "checklist",
  "cmd",
  "col",
  "comment",
  "cons",
  "danger",
  "dialog",
  "dialog-avatar",
  "dialog-bubble",
  "dialog-msg",
  "dialog-name",
  "dir",
  "done",
  "error",
  "file",
  "filetree",
  "flow",
  "fn-ref",
  "footnotes",
  "formula",
  "grid",
  "grid-2",
  "grid-3",
  "hint",
  "label",
  "note",
  "ok",
  "output",
  "pending",
  "progress",
  "progress-bar",
  "prompt",
  "pros",
  "pros-cons",
  "pullquote",
  "reply",
  "right",
  "row",
  "stat",
  "stats",
  "tag",
  "tag-g",
  "tag-o",
  "tag-p",
  "tag-r",
  "tags",
  "terminal",
  "terminal-body",
  "terminal-header",
  "timeline",
  "timeline-item",
  "tip",
  "tldr",
  "warn",
]);

function isMarkdownLiteralFragment(fragment: string): boolean {
  return fragment.startsWith("```") || fragment.startsWith("~~~") || fragment.startsWith("`");
}

function mapMarkdownTextFragments(source: string, transform: (fragment: string) => string): string {
  return source
    .split(MARKDOWN_LITERAL_FRAGMENT_RE)
    .map((fragment) => {
      if (!fragment || isMarkdownLiteralFragment(fragment)) {
        return fragment;
      }
      return transform(fragment);
    })
    .join("");
}

function isSemanticHtmlFenceLanguage(info: string): boolean {
  const language = info.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  return SEMANTIC_HTML_FENCE_LANGUAGES.has(language);
}

function hasSemanticHtmlClass(source: string): boolean {
  const classAttributeRe = /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match: RegExpExecArray | null;
  while ((match = classAttributeRe.exec(source)) !== null) {
    const classValue = match[1] ?? match[2] ?? "";
    if (
      classValue
        .trim()
        .split(/\s+/)
        .some((className) => SEMANTIC_HTML_CLASS_NAMES.has(className))
    ) {
      return true;
    }
  }
  return false;
}

function looksLikeSemanticHtmlFragment(source: string): boolean {
  const trimmedSource = source.trim();
  return (
    trimmedSource.includes("<") &&
    SEMANTIC_HTML_TAG_RE.test(trimmedSource) &&
    !UNSAFE_SEMANTIC_HTML_TAG_RE.test(trimmedSource) &&
    hasSemanticHtmlClass(trimmedSource)
  );
}

function countLeadingIndent(source: string): number {
  return source.match(/^[ \t]*/)?.[0].length ?? 0;
}

function dedentSemanticHtmlFragment(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  const nonBlankLines = lines.filter((line) => line.trim());
  if (nonBlankLines.length === 0) {
    return "";
  }

  const minIndent = Math.min(...nonBlankLines.map(countLeadingIndent));
  if (minIndent <= 0) {
    return lines.join("\n");
  }
  return lines.map((line) => (line.trim() ? line.slice(minIndent) : line)).join("\n");
}

function compactSemanticHtmlBlockSpacing(source: string): string {
  if (!source.includes("\n") || /<\s*pre\b/i.test(source)) {
    return source;
  }

  return source.replace(/\n[ \t]*\n(?=[ \t]{4,}<\/?[a-z][\w:-]*\b[^>\n]*>)/gi, "\n");
}

function normalizeSemanticHtmlTagIndentation(source: string): string {
  if (!source.includes("\n") || /<\s*pre\b/i.test(source)) {
    return source;
  }

  return source.replace(/^[ \t]{4,}(?=<\/?[a-z][\w:-]*\b[^>\n]*>)/gim, "  ");
}

function normalizeSemanticHtmlFragmentBody(source: string): string {
  return normalizeSemanticHtmlTagIndentation(compactSemanticHtmlBlockSpacing(dedentSemanticHtmlFragment(source)));
}

function normalizeSemanticHtmlCodeFences(source: string): string {
  if (!source.includes("```") && !source.includes("~~~")) {
    return source;
  }

  return source.replace(
    SEMANTIC_HTML_FENCE_RE,
    (match: string, prefix: string, _indent: string, _fence: string, info: string, body: string) => {
      if (!isSemanticHtmlFenceLanguage(info) || !looksLikeSemanticHtmlFragment(body)) {
        return match;
      }
      return `${prefix}${normalizeSemanticHtmlFragmentBody(body)}`;
    },
  );
}

function normalizeSemanticHtmlIndentedBlocks(source: string): string {
  if (!looksLikeSemanticHtmlFragment(source)) {
    return source;
  }

  return mapMarkdownTextFragments(source, (fragment) =>
    looksLikeSemanticHtmlFragment(fragment)
      ? normalizeSemanticHtmlTagIndentation(compactSemanticHtmlBlockSpacing(fragment))
      : fragment,
  );
}

export function normalizeSemanticHtmlFragments(source: string): string {
  if (!source || !source.includes("class")) {
    return source;
  }

  return normalizeSemanticHtmlIndentedBlocks(normalizeSemanticHtmlCodeFences(source));
}

function looksLikeLatexMathContent(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue || /^\d+(?:[.,]\d+)?$/.test(trimmedValue)) {
    return false;
  }

  return (
    /\\[A-Za-z]+/.test(trimmedValue) ||
    /[\^_{}=<>+\-*/]/.test(trimmedValue) ||
    (trimmedValue.includes("|") && /[A-Za-z\\Α-ω]|[\^_{}=<>+\-*/]/.test(trimmedValue)) ||
    /^[A-Za-z]$/.test(trimmedValue) ||
    /[Α-ω]/.test(trimmedValue)
  );
}

function normalizeLatexPipes(mathContent: string): string {
  return mathContent.replace(/(^|[^\\])\|/g, "$1\\vert{}");
}

function isEscapedCharacter(source: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function getDollarMathDelimiterLength(source: string, index: number): number {
  if (source[index] !== "$" || isEscapedCharacter(source, index) || source[index - 1] === "$") {
    return 0;
  }

  if (source[index + 1] === "$" && source[index + 2] !== "$") {
    return 2;
  }

  return source[index + 1] === "$" ? 0 : 1;
}

function normalizeDollarMathContent(mathContent: string, inline: boolean): string {
  const normalizedContent = inline ? mathContent.replace(/\s*\n\s*/g, " ") : mathContent;
  return normalizeLatexPipes(normalizedContent);
}

function normalizeDollarMathSegments(source: string): string {
  if (!source.includes("$")) {
    return source;
  }

  let normalizedSource = "";
  let consumedUntil = 0;

  for (let index = 0; index < source.length; index += 1) {
    const delimiterLength = getDollarMathDelimiterLength(source, index);
    if (!delimiterLength) {
      continue;
    }

    const openingDelimiterIndex = index;
    let closingDelimiterIndex = -1;
    for (let cursor = openingDelimiterIndex + delimiterLength; cursor < source.length; cursor += 1) {
      if (getDollarMathDelimiterLength(source, cursor) === delimiterLength) {
        closingDelimiterIndex = cursor;
        break;
      }
    }

    if (closingDelimiterIndex < 0) {
      break;
    }

    const mathContent = source.slice(openingDelimiterIndex + delimiterLength, closingDelimiterIndex);
    const inline = delimiterLength === 1;

    // 行内数学（单 $）不跨越空行：真正的行内公式不会跨段落。跨空行的配对几乎都是货币 $
    // （如 “$200/月 …（空行、标题、HTML 表格）… $0.25”）的误配对；若按行内数学归一化，
    // normalizeDollarMathContent 会把中间内容的换行压平成空格，从而摧毁后续的标题与
    // 块级 HTML（表格/卡片）结构。放弃此开定界符，让后面的 $ 重新尝试配对。
    if (inline && /\n[^\S\n]*\n/.test(mathContent)) {
      continue;
    }

    const shouldNormalize =
      (mathContent.includes("|") || (inline && mathContent.includes("\n"))) &&
      looksLikeLatexMathContent(mathContent);

    if (shouldNormalize) {
      normalizedSource += source.slice(consumedUntil, openingDelimiterIndex + delimiterLength);
      normalizedSource += normalizeDollarMathContent(mathContent, inline);
      normalizedSource += source.slice(closingDelimiterIndex, closingDelimiterIndex + delimiterLength);
      consumedUntil = closingDelimiterIndex + delimiterLength;
    }

    index = closingDelimiterIndex + delimiterLength - 1;
  }

  if (!consumedUntil) {
    return source;
  }

  return normalizedSource + source.slice(consumedUntil);
}

function normalizeLatexDelimitersInText(source: string): string {
  return source
    .replace(/\\\[\s*\n?([\s\S]*?)\n?\s*\\\]/g, (_, mathContent: string) => `$$\n${mathContent.trim()}\n$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, mathContent: string) => `$${mathContent.trim()}$`)
    .replace(ESCAPED_INLINE_DOLLAR_MATH_RE, (match: string, mathContent: string) => {
      const trimmedMathContent = mathContent.trim();
      return looksLikeLatexMathContent(trimmedMathContent) ? `$${trimmedMathContent}$` : match;
    });
}

export function normalizeMathDelimiters(source: string): string {
  if (!source) {
    return source;
  }

  const shouldNormalizeDelimiters = source.includes("\\(") || source.includes("\\[") || source.includes("\\$");
  const hasDollarMath = source.includes("$");
  if (!shouldNormalizeDelimiters && !hasDollarMath) {
    return source;
  }

  return mapMarkdownTextFragments(source, (fragment) => {
    const normalizedFragment = shouldNormalizeDelimiters ? normalizeLatexDelimitersInText(fragment) : fragment;
    return normalizedFragment.includes("$") ? normalizeDollarMathSegments(normalizedFragment) : normalizedFragment;
  });
}

// 货币美元符号：$ 紧跟数字，且既不是块级 $$ 的一部分，也不是已转义的 \$。
const CURRENCY_DOLLAR_RE = /(?<![\\$\d])\$(?=\d)/g;

// protectCurrencyDollars 把货币美元符号（如 $20、$0.25、$200/月）转成 HTML 实体 &#36;，
// 避免 singleDollarTextMath 把价格误当成行内公式（导致 $ 丢失、加粗失效、内容被 KaTeX 吞掉）。
// &#36; 在普通段落和原始 HTML 块中都会被解码回 $ 正常显示，且不再触发数学解析。
// 字母/LaTeX 开头的行内公式（$x^2$、$\alpha$）的 $ 后不是数字，因此不受影响；
// 代码块/行内代码由 mapMarkdownTextFragments 跳过，其中的 $ 保持原样。
export function protectCurrencyDollars(source: string): string {
  if (!source.includes("$")) {
    return source;
  }

  return mapMarkdownTextFragments(source, (fragment) =>
    fragment.includes("$") ? fragment.replace(CURRENCY_DOLLAR_RE, "&#36;") : fragment,
  );
}

const LATEX_UNICODE_SYMBOLS: Array<[RegExp, string]> = [
  [/→/g, " \\to "],
  [/←/g, " \\leftarrow "],
  [/⇒/g, " \\Rightarrow "],
  [/⇐/g, " \\Leftarrow "],
  [/↔/g, " \\leftrightarrow "],
  [/⇔/g, " \\Leftrightarrow "],
];

const THINKING_LIKE_HTML_TAG_RE = /<\/?\s*think[\w-]*\b[^>]*>/gi;

function escapeHtmlTag(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeThinkingLikeHtmlTags(source: string): string {
  if (!source || !/<\/?\s*think/i.test(source)) {
    return source;
  }

  return mapMarkdownTextFragments(source, (fragment) => fragment.replace(THINKING_LIKE_HTML_TAG_RE, escapeHtmlTag));
}

function normalizeLatexSymbols(mathContent: string): string {
  return LATEX_UNICODE_SYMBOLS.reduce(
    (normalizedContent, [pattern, replacement]) => normalizedContent.replace(pattern, replacement),
    mathContent,
  );
}

export function normalizeLatexUnicodeSymbols(source: string): string {
  if (!source || !/[→←⇒⇐↔⇔]/.test(source)) {
    return source;
  }

  return mapMarkdownTextFragments(source, (fragment) =>
    fragment
      .replace(DISPLAY_DOLLAR_MATH_RE, (match, openingDelimiter: string, mathContent: string, closingDelimiter: string) => {
        if (!mathContent) {
          return match;
        }

        return `${openingDelimiter}${normalizeLatexSymbols(mathContent)}${closingDelimiter}`;
      })
      .replace(INLINE_DOLLAR_MATH_RE, (match: string, prefix: string, mathContent: string) => {
        if (!mathContent) {
          return match;
        }

        return `${prefix}$${normalizeLatexSymbols(mathContent)}$`;
      }),
  );
}

export function normalizeMermaidBlocks(source: string): string {
  if (!source.includes("```mermaid")) {
    return source;
  }

  return source.replace(/```mermaid([\s\S]*?)```/gi, (block) =>
    block.replace(/<br\s*>/gi, "<br/>").replace(/<br\s*\/\s*>/gi, "<br/>"),
  );
}

export function parseStreamdownSegments(source: string): RenderSegment[] {
  if (!source) {
    return [];
  }

  const segments: RenderSegment[] = [];

  const thinkingBlock = parseLeadingThinkingBlock(source);
  if (!thinkingBlock) {
    if (source.trim()) {
      segments.push({
        type: "markdown",
        content: escapeThinkingLikeHtmlTags(source),
      });
    }
    return segments;
  }

  segments.push({
    type: "thinking",
    content: thinkingBlock.content,
    incomplete: false,
  });

  const tail = source.slice(thinkingBlock.end);
  if (tail.trim()) {
    segments.push({
      type: "markdown",
      content: escapeThinkingLikeHtmlTags(tail),
    });
  }

  return segments;
}

function parseLeadingThinkingBlock(source: string): { content: string; end: number } | null {
  const firstContentIndex = source.search(/\S/);
  if (firstContentIndex < 0) {
    return null;
  }

  const openingSource = source.slice(firstContentIndex);
  const openingMatch = /^<(think|thinking)\b[^>]*>/i.exec(openingSource);
  if (!openingMatch) {
    return null;
  }
  if (openingMatch[0].slice(0, -1).trimEnd().endsWith("/")) {
    return null;
  }

  const tagName = openingMatch[1].toLowerCase();
  const contentStart = firstContentIndex + openingMatch[0].length;
  const closingMatch = new RegExp(`</${tagName}\\s*>`, "i").exec(source.slice(contentStart));
  if (!closingMatch) {
    return null;
  }

  const closeStart = contentStart + closingMatch.index;
  const closeEnd = closeStart + closingMatch[0].length;
  return {
    content: source.slice(contentStart, closeStart),
    end: closeEnd,
  };
}
