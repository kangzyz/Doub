"use client";

import * as React from "react";
import { cjk } from "@streamdown/cjk";
import { createMathPlugin } from "@streamdown/math";
import { type AllowedTags, type Components, type PluginConfig, Streamdown } from "streamdown";
import { useTranslations } from "next-intl";

import { ChevronDown } from "@/components/animate-ui/icons/chevron-down";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { cn } from "@/lib/utils";
import { useLatexCopy } from "@/features/chat/hooks/use-latex-copy";

import {
  CollapsibleCodePre,
  MarkdownImageActionsContext,
  MarkdownImage,
  MarkdownLink,
  MarkdownParagraph,
  MarkdownArtifactActionsContext,
  ThinkingHeading,
  type MarkdownArtifactActions,
  type MarkdownImageActions,
} from "./streamdown-components";
import {
  normalizeContent,
  normalizeLatexUnicodeSymbols,
  normalizeMathDelimiters,
  normalizeMermaidBlocks,
  normalizeSemanticHtmlFragments,
  parseStreamdownSegments,
  protectCurrencyDollars,
  type RenderSegment,
} from "./streamdown-content";

type StreamdownRenderProps = {
  content: unknown;
  className?: string;
  streaming?: boolean;
  variant?: "default" | "thinking";
  imageActions?: MarkdownImageActions;
  artifactActions?: MarkdownArtifactActions;
};

type StreamdownFeatureFlags = {
  code: boolean;
  math: boolean;
  mermaid: boolean;
};

type ParsedNeutralColor = {
  alpha: number;
  luminance: number;
  neutral: boolean;
};

type HtmlVisualStyleNormalization = {
  darkSurfaceNormalized: boolean;
  style?: React.CSSProperties;
};

type HtmlVisualComponentProps = Record<string, unknown> & {
  className?: unknown;
  color?: unknown;
  fill?: unknown;
  node?: unknown;
  stopColor?: unknown;
  stroke?: unknown;
  style?: React.CSSProperties | string;
};

const BASE_STREAMDOWN_PLUGINS: PluginConfig = {
  cjk,
};
const STREAMDOWN_MATH_PLUGIN = createMathPlugin({
  singleDollarTextMath: true,
});
const STREAMDOWN_MATH_BASE_PLUGINS: PluginConfig = {
  ...BASE_STREAMDOWN_PLUGINS,
  math: STREAMDOWN_MATH_PLUGIN,
};

const HtmlVisualToneContext = React.createContext(false);
const STREAMDOWN_PLUGIN_CACHE = new Map<string, PluginConfig>();
const STREAMDOWN_PLUGIN_PROMISE_CACHE = new Map<string, Promise<PluginConfig>>();

const STREAMDOWN_CONTROLS = {
  code: {
    copy: false,
    download: false,
  },
  mermaid: {
    copy: true,
    download: false,
    fullscreen: true,
    panZoom: true,
  },
  table: false,
} as const;

const STREAMDOWN_REMEND = {
  linkMode: "text-only",
} as const;

const STREAMDOWN_CARET = "circle" as const;
const STREAMDOWN_LINK_SAFETY = { enabled: false } as const;
const HTML_VISUAL_COLOR_TOKEN_RE = /#[\da-f]{3,8}\b|rgba?\([^)]*\)|\b(?:black|white)\b/gi;
const HTML_VISUAL_STYLE_ATTRIBUTES = ["style", "title", "className"] as const;
const HTML_VISUAL_BOX_ATTRIBUTES = [...HTML_VISUAL_STYLE_ATTRIBUTES, "align", "height", "width"];
const HTML_VISUAL_LINK_ATTRIBUTES = [
  ...HTML_VISUAL_STYLE_ATTRIBUTES,
  "ariaDescribedBy",
  "ariaLabel",
  "ariaLabelledBy",
  "dataFootnoteBackref",
  "dataFootnoteRef",
  "href",
];
const HTML_VISUAL_IMAGE_ATTRIBUTES = [
  ...HTML_VISUAL_BOX_ATTRIBUTES,
  "ariaDescribedBy",
  "ariaLabel",
  "ariaLabelledBy",
  "alt",
  "longDesc",
  "src",
];
const HTML_VISUAL_CODE_ATTRIBUTES = [...HTML_VISUAL_STYLE_ATTRIBUTES, "className", "metastring"];
const HTML_VISUAL_SECTION_ATTRIBUTES = [...HTML_VISUAL_BOX_ATTRIBUTES, "className", "dataFootnotes"];
const HTML_VISUAL_TABLE_CELL_ATTRIBUTES = [
  ...HTML_VISUAL_STYLE_ATTRIBUTES,
  "align",
  "colSpan",
  "height",
  "rowSpan",
  "width",
];
const HTML_VISUAL_SVG_ATTRIBUTES = [
  ...HTML_VISUAL_STYLE_ATTRIBUTES,
  "clipPath",
  "cx",
  "cy",
  "d",
  "dominantBaseline",
  "fill",
  "fillOpacity",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "height",
  "markerEnd",
  "markerStart",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "offset",
  "opacity",
  "orient",
  "points",
  "preserveAspectRatio",
  "r",
  "refX",
  "refY",
  "rx",
  "ry",
  "stopColor",
  "stopOpacity",
  "stroke",
  "strokeDasharray",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeOpacity",
  "strokeWidth",
  "textAnchor",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
];
const STREAMDOWN_HTML_VISUAL_ALLOWED_TAGS: AllowedTags = {
  a: [...HTML_VISUAL_LINK_ATTRIBUTES],
  abbr: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  article: [...HTML_VISUAL_BOX_ATTRIBUTES],
  aside: [...HTML_VISUAL_BOX_ATTRIBUTES],
  blockquote: [...HTML_VISUAL_BOX_ATTRIBUTES],
  br: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  caption: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  circle: [...HTML_VISUAL_SVG_ATTRIBUTES],
  cite: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  code: [...HTML_VISUAL_CODE_ATTRIBUTES],
  col: [...HTML_VISUAL_BOX_ATTRIBUTES, "span"],
  colgroup: [...HTML_VISUAL_BOX_ATTRIBUTES, "span"],
  dd: [...HTML_VISUAL_BOX_ATTRIBUTES],
  defs: [...HTML_VISUAL_SVG_ATTRIBUTES],
  del: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  details: [...HTML_VISUAL_BOX_ATTRIBUTES, "open"],
  div: [...HTML_VISUAL_BOX_ATTRIBUTES],
  dl: [...HTML_VISUAL_BOX_ATTRIBUTES],
  dt: [...HTML_VISUAL_BOX_ATTRIBUTES],
  ellipse: [...HTML_VISUAL_SVG_ATTRIBUTES],
  em: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  figcaption: [...HTML_VISUAL_BOX_ATTRIBUTES],
  figure: [...HTML_VISUAL_BOX_ATTRIBUTES],
  g: [...HTML_VISUAL_SVG_ATTRIBUTES],
  h1: [...HTML_VISUAL_BOX_ATTRIBUTES],
  h2: [...HTML_VISUAL_BOX_ATTRIBUTES],
  h3: [...HTML_VISUAL_BOX_ATTRIBUTES],
  h4: [...HTML_VISUAL_BOX_ATTRIBUTES],
  h5: [...HTML_VISUAL_BOX_ATTRIBUTES],
  h6: [...HTML_VISUAL_BOX_ATTRIBUTES],
  hr: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  img: [...HTML_VISUAL_IMAGE_ATTRIBUTES],
  ins: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  kbd: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  li: [...HTML_VISUAL_BOX_ATTRIBUTES],
  line: [...HTML_VISUAL_SVG_ATTRIBUTES],
  linearGradient: [...HTML_VISUAL_SVG_ATTRIBUTES, "gradientTransform", "gradientUnits", "id"],
  marker: [...HTML_VISUAL_SVG_ATTRIBUTES, "id"],
  mark: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  ol: [...HTML_VISUAL_BOX_ATTRIBUTES, "start", "type"],
  p: [...HTML_VISUAL_BOX_ATTRIBUTES],
  path: [...HTML_VISUAL_SVG_ATTRIBUTES],
  polygon: [...HTML_VISUAL_SVG_ATTRIBUTES],
  polyline: [...HTML_VISUAL_SVG_ATTRIBUTES],
  pre: [...HTML_VISUAL_BOX_ATTRIBUTES],
  rect: [...HTML_VISUAL_SVG_ATTRIBUTES],
  section: [...HTML_VISUAL_SECTION_ATTRIBUTES],
  small: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  span: [...HTML_VISUAL_BOX_ATTRIBUTES],
  stop: [...HTML_VISUAL_SVG_ATTRIBUTES],
  strong: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  sub: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  summary: [...HTML_VISUAL_BOX_ATTRIBUTES],
  sup: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  svg: [...HTML_VISUAL_SVG_ATTRIBUTES, "aria-label", "role"],
  table: [...HTML_VISUAL_BOX_ATTRIBUTES],
  tbody: [...HTML_VISUAL_BOX_ATTRIBUTES],
  td: [...HTML_VISUAL_TABLE_CELL_ATTRIBUTES],
  text: [...HTML_VISUAL_SVG_ATTRIBUTES],
  tfoot: [...HTML_VISUAL_BOX_ATTRIBUTES],
  th: [...HTML_VISUAL_TABLE_CELL_ATTRIBUTES, "scope"],
  thead: [...HTML_VISUAL_BOX_ATTRIBUTES],
  tr: [...HTML_VISUAL_BOX_ATTRIBUTES],
  tspan: [...HTML_VISUAL_SVG_ATTRIBUTES],
  u: [...HTML_VISUAL_STYLE_ATTRIBUTES],
  ul: [...HTML_VISUAL_BOX_ATTRIBUTES],
};
const HTML_VISUAL_COMPONENT_TAGS: string[] = [
  "abbr",
  "article",
  "aside",
  "blockquote",
  "caption",
  "circle",
  "cite",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "ellipse",
  "em",
  "figcaption",
  "figure",
  "g",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "ins",
  "kbd",
  "li",
  "line",
  "linearGradient",
  "marker",
  "mark",
  "ol",
  "path",
  "polygon",
  "polyline",
  "rect",
  "section",
  "small",
  "span",
  "stop",
  "strong",
  "sub",
  "summary",
  "sup",
  "svg",
  "table",
  "tbody",
  "td",
  "text",
  "tfoot",
  "th",
  "thead",
  "tr",
  "tspan",
  "u",
  "ul",
];
const HTML_VISUAL_SURFACE_STYLE_KEYS = ["background", "backgroundColor"] as const;
const HTML_VISUAL_TEXT_STYLE_KEYS = ["color", "textDecorationColor"] as const;
const HTML_VISUAL_BORDER_COLOR_STYLE_KEYS = [
  "borderBlockColor",
  "borderBottomColor",
  "borderColor",
  "borderInlineColor",
  "borderLeftColor",
  "borderRightColor",
  "borderTopColor",
  "columnRuleColor",
  "outlineColor",
] as const;
const HTML_VISUAL_BORDER_STYLE_KEYS = [
  "border",
  "borderBlock",
  "borderBlockEnd",
  "borderBlockStart",
  "borderBottom",
  "borderInline",
  "borderInlineEnd",
  "borderInlineStart",
  "borderLeft",
  "borderRight",
  "borderTop",
  "columnRule",
  "outline",
] as const;
// SAFE_HTML_STYLE_PROPERTIES 限定内联样式允许出现的属性，基于上游布局/盒模型白名单，
// 并补充 SVG 与主题归一化管线实际写入/读取的属性，避免裁剪掉我们更完整的渲染能力。
const SAFE_HTML_STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  "--pct",
  "alignContent",
  "alignItems",
  "alignSelf",
  "background",
  "backgroundColor",
  "border",
  "borderBlock",
  "borderBlockColor",
  "borderBlockEnd",
  "borderBlockStart",
  "borderBottom",
  "borderBottomColor",
  "borderColor",
  "borderInline",
  "borderInlineColor",
  "borderInlineEnd",
  "borderInlineStart",
  "borderLeft",
  "borderLeftColor",
  "borderRadius",
  "borderRight",
  "borderRightColor",
  "borderStyle",
  "borderTop",
  "borderTopColor",
  "borderWidth",
  "boxShadow",
  "boxSizing",
  "color",
  "columnGap",
  "columnRule",
  "columnRuleColor",
  "display",
  "fill",
  "fillOpacity",
  "flex",
  "flexBasis",
  "flexDirection",
  "flexGrow",
  "flexShrink",
  "flexWrap",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "gap",
  "gridAutoColumns",
  "gridAutoFlow",
  "gridAutoRows",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowStart",
  "gridTemplateColumns",
  "gridTemplateRows",
  "height",
  "justifyContent",
  "justifyItems",
  "justifySelf",
  "letterSpacing",
  "lineHeight",
  "margin",
  "marginBlock",
  "marginBlockEnd",
  "marginBlockStart",
  "marginBottom",
  "marginInline",
  "marginInlineEnd",
  "marginInlineStart",
  "marginLeft",
  "marginRight",
  "marginTop",
  "maxHeight",
  "maxWidth",
  "minHeight",
  "minWidth",
  "opacity",
  "order",
  "outline",
  "outlineColor",
  "overflow",
  "overflowX",
  "overflowY",
  "padding",
  "paddingBlock",
  "paddingBlockEnd",
  "paddingBlockStart",
  "paddingBottom",
  "paddingInline",
  "paddingInlineEnd",
  "paddingInlineStart",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "placeContent",
  "placeItems",
  "placeSelf",
  "rowGap",
  "stroke",
  "strokeDasharray",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeOpacity",
  "strokeWidth",
  "textAlign",
  "textDecoration",
  "textDecorationColor",
  "transform",
  "transformOrigin",
  "verticalAlign",
  "whiteSpace",
  "width",
]);
const KATEX_SPAN_CLASS_NAMES = [
  "katex",
  "katex-html",
  "katex-mathml",
  "base",
  "strut",
  "mord",
  "mop",
  "mbin",
  "mrel",
  "mopen",
  "mclose",
  "mpunct",
  "minner",
  "msupsub",
  "vlist",
  "vlist-t",
  "vlist-r",
  "vlist-s",
  "pstrut",
  "sizing",
  "mtight",
  "mspace",
  "mfrac",
  "mathrm",
  "mathnormal",
  "mathit",
  "mathbf",
  "textbf",
  "textrm",
  "mainrm",
] as const;
const KATEX_SAFE_HTML_STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  ...SAFE_HTML_STYLE_PROPERTIES,
  "top",
]);
const UNSAFE_STYLE_VALUE_RE = /(?:url\s*\(|expression\s*\(|javascript:|@import|[<>{}])/i;

function isSafeHTMLStyleValue(value: string | number): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  const normalizedValue = value.trim();
  return Boolean(normalizedValue) && normalizedValue.length <= 120 && !UNSAFE_STYLE_VALUE_RE.test(normalizedValue);
}

// 把 CSS 自定义属性名 (`--x`) 之外的连字符属性名转换为 React 识别的 camelCase。
function cssPropertyToCamelCase(property: string): string {
  if (property.startsWith("--")) {
    return property;
  }
  return property.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}

// parseInlineStyleString 把原始 `style="..."` 字符串解析为对象，以便复用对象路径的
// 白名单与取值校验。无法安全解析的声明会被忽略，最终仍由 SAFE_HTML_STYLE_PROPERTIES 兜底。
function parseInlineStyleString(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const rawProperty = declaration.slice(0, separatorIndex).trim();
    const rawValue = declaration.slice(separatorIndex + 1).trim();
    if (!rawProperty || !rawValue) {
      continue;
    }
    result[cssPropertyToCamelCase(rawProperty)] = rawValue;
  }
  return result;
}

function hasInlineStyleProperty(style: React.CSSProperties | string | undefined, property: string): boolean {
  if (!style) {
    return false;
  }
  if (typeof style === "string") {
    return Object.prototype.hasOwnProperty.call(parseInlineStyleString(style), property);
  }
  return Object.prototype.hasOwnProperty.call(style, property);
}

function isKatexSpan(className: unknown, style: React.CSSProperties | string | undefined): boolean {
  if (hasInlineStyleProperty(style, "top")) {
    return true;
  }
  if (typeof className !== "string") {
    return false;
  }
  return className
    .trim()
    .split(/\s+/)
    .some(
      (item) =>
        KATEX_SPAN_CLASS_NAMES.includes(item as (typeof KATEX_SPAN_CLASS_NAMES)[number]) ||
        /^reset-size\d+$/.test(item) ||
        /^size\d+$/.test(item),
    );
}

const HTML_VISUAL_SEMANTIC_CLASS_NAMES: ReadonlySet<string> = new Set([
  "reply",
  "grid",
  "grid-2",
  "grid-3",
  "row",
  "col",
  "card",
  "card-b",
  "card-g",
  "card-o",
  "card-r",
  "card-p",
  "card-x",
  "pros-cons",
  "pros",
  "cons",
  "stats",
  "stat",
  "timeline",
  "timeline-item",
  "badge",
  "badge-b",
  "badge-g",
  "badge-o",
  "badge-r",
  "tags",
  "tag",
  "tag-g",
  "tag-o",
  "tag-p",
  "tag-r",
  "checklist",
  "done",
  "pending",
  "note",
  "warn",
  "tip",
  "tldr",
  "pullquote",
  "formula",
  "label",
  "filetree",
  "dir",
  "file",
  "hint",
  "terminal",
  "terminal-header",
  "terminal-body",
  "prompt",
  "cmd",
  "output",
  "comment",
  "error",
  "dialog",
  "dialog-msg",
  "right",
  "dialog-avatar",
  "dialog-bubble",
  "dialog-name",
  "flow",
  "progress",
  "progress-bar",
  "ok",
  "danger",
  "fn-ref",
  "footnotes",
]);

function normalizeHtmlVisualClassName(
  tag: string,
  className: unknown,
  style: React.CSSProperties | string | undefined,
): string | undefined {
  if (typeof className !== "string") {
    return undefined;
  }
  if (tag === "span" && isKatexSpan(className, style)) {
    return className;
  }

  const semanticClassNames = className
    .trim()
    .split(/\s+/)
    .filter((item, index, items) => HTML_VISUAL_SEMANTIC_CLASS_NAMES.has(item) && items.indexOf(item) === index);
  return semanticClassNames.length > 0 ? semanticClassNames.join(" ") : undefined;
}
const FENCED_CODE_BLOCK_RE = /(?:^|\n)[ \t]*(?:```|~~~)(?!\s*(?:mermaid|mmd)\b)[^\n]*(?:\n|$)/i;
const MERMAID_CODE_BLOCK_RE = /(?:^|\n)[ \t]*(?:```|~~~)\s*(?:mermaid|mmd)\b/i;
const DISPLAY_MATH_RE = /(?:^|\n)\s*\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\begin\{[a-z*]+\}/i;
const INLINE_MATH_RE = /(^|[^\\$])\$[^$\n]{1,400}\$/;

function parseColorChannel(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? Math.round((Math.max(0, Math.min(percent, 100)) / 100) * 255) : null;
  }

  const channel = Number.parseFloat(trimmed);
  return Number.isFinite(channel) ? Math.round(Math.max(0, Math.min(channel, 255))) : null;
}

function parseAlphaChannel(value: string | undefined): number {
  if (!value) {
    return 1;
  }

  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? Math.max(0, Math.min(percent, 100)) / 100 : 1;
  }

  const alpha = Number.parseFloat(trimmed);
  return Number.isFinite(alpha) ? Math.max(0, Math.min(alpha, 1)) : 1;
}

function parseHexColor(value: string): [number, number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  if (![3, 4, 6, 8].includes(hex.length)) {
    return null;
  }

  const expanded =
    hex.length <= 4
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;

  return [red, green, blue, alpha].every(Number.isFinite) ? [red, green, blue, alpha] : null;
}

function parseRgbColor(value: string): [number, number, number, number] | null {
  const match = value.trim().match(/^rgba?\((.+)\)$/i);
  if (!match) {
    return null;
  }

  const parts = match[1].replace(/\//g, " ").split(/[,\s]+/).filter(Boolean);
  const red = parseColorChannel(parts[0] ?? "");
  const green = parseColorChannel(parts[1] ?? "");
  const blue = parseColorChannel(parts[2] ?? "");
  if (red == null || green == null || blue == null) {
    return null;
  }

  return [red, green, blue, parseAlphaChannel(parts[3])];
}

function getRelativeLuminance(red: number, green: number, blue: number): number {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function parseNeutralColor(value: string): ParsedNeutralColor | null {
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized === "currentcolor" ||
    normalized === "none" ||
    normalized === "transparent" ||
    normalized.startsWith("var(") ||
    normalized.startsWith("url(") ||
    normalized.includes("gradient(")
  ) {
    return null;
  }

  const channels =
    normalized === "white"
      ? [255, 255, 255, 1]
      : normalized === "black"
        ? [0, 0, 0, 1]
        : normalized.startsWith("#")
          ? parseHexColor(normalized)
          : parseRgbColor(normalized);

  if (!channels) {
    return null;
  }

  const [red, green, blue, alpha] = channels;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return {
    alpha,
    luminance: getRelativeLuminance(red, green, blue),
    neutral: spread <= 32,
  };
}

function normalizeHtmlVisualSurfaceColor(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const color = parseNeutralColor(value);
  if (!color?.neutral || color.alpha < 0.5) {
    return value;
  }
  if (color.luminance >= 0.72) {
    return "var(--card)";
  }
  if (color.luminance <= 0.18) {
    return "var(--muted)";
  }
  return value;
}

function normalizeHtmlVisualTextColor(value: unknown, darkSurfaceNormalized = false): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const color = parseNeutralColor(value);
  if (!color?.neutral || color.alpha < 0.5) {
    return value;
  }

  if (darkSurfaceNormalized && color.luminance >= 0.72) {
    return "var(--foreground)";
  }
  if (color.luminance <= 0.45) {
    return "var(--foreground)";
  }
  if (color.luminance <= 0.72) {
    return "var(--muted-foreground)";
  }
  return value;
}

function normalizeHtmlVisualBorderColor(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const color = parseNeutralColor(value);
  return color?.neutral && color.alpha >= 0.08 ? "var(--border)" : value;
}

function replaceNeutralBorderTokens(value: string): string {
  return value.replace(HTML_VISUAL_COLOR_TOKEN_RE, (token) =>
    normalizeHtmlVisualBorderColor(token) === "var(--border)" ? "var(--border)" : token,
  );
}

function normalizeHtmlVisualStyle(
  style: React.CSSProperties | string | undefined,
  inheritedDarkSurfaceNormalized = false,
  safeProperties: ReadonlySet<string> = SAFE_HTML_STYLE_PROPERTIES,
): React.CSSProperties | undefined {
  return normalizeHtmlVisualStyleWithTone(style, inheritedDarkSurfaceNormalized, safeProperties).style;
}

function normalizeHtmlVisualStyleWithTone(
  style: React.CSSProperties | string | undefined,
  inheritedDarkSurfaceNormalized = false,
  safeProperties: ReadonlySet<string> = SAFE_HTML_STYLE_PROPERTIES,
): HtmlVisualStyleNormalization {
  if (!style) {
    return { darkSurfaceNormalized: false };
  }

  // 原始字符串样式 (`style="..."`) 必须先解析成对象再走白名单校验，
  // 否则会绕过 SAFE_HTML_STYLE_PROPERTIES 与取值清洗。无法解析则丢弃整段样式。
  const styleObject: React.CSSProperties | Record<string, string> =
    typeof style === "string" ? parseInlineStyleString(style) : style;
  if (typeof styleObject !== "object") {
    return { darkSurfaceNormalized: false };
  }
  // 字符串解析后若声明全部无效，则视为无样式直接丢弃。
  if (typeof style === "string" && Object.keys(styleObject).length === 0) {
    return { darkSurfaceNormalized: false };
  }

  let changed = typeof style === "string";
  let darkSurfaceNormalized = false;
  const next: Record<string, unknown> = { ...styleObject };

  for (const key of HTML_VISUAL_SURFACE_STYLE_KEYS) {
    const value = normalizeHtmlVisualSurfaceColor(next[key]);
    if (value !== next[key]) {
      next[key] = value;
      changed = true;
    }
    if (value === "var(--muted)") {
      darkSurfaceNormalized = true;
    }
  }

  const normalizeLightText = inheritedDarkSurfaceNormalized || darkSurfaceNormalized;
  for (const key of HTML_VISUAL_TEXT_STYLE_KEYS) {
    const value = normalizeHtmlVisualTextColor(next[key], normalizeLightText);
    if (value !== next[key]) {
      next[key] = value;
      changed = true;
    }
  }

  for (const key of HTML_VISUAL_BORDER_COLOR_STYLE_KEYS) {
    const value = normalizeHtmlVisualBorderColor(next[key]);
    if (value !== next[key]) {
      next[key] = value;
      changed = true;
    }
  }

  for (const key of HTML_VISUAL_BORDER_STYLE_KEYS) {
    const value = next[key];
    if (typeof value !== "string") {
      continue;
    }
    const normalizedValue = replaceNeutralBorderTokens(value);
    if (normalizedValue !== value) {
      next[key] = normalizedValue;
      changed = true;
    }
  }

  // 折叠上游的属性白名单与取值校验：丢弃未列入白名单的属性，以及含 url()/expression()/javascript:/@import
  // 或尖括号花括号、超长的取值。CSS var(--token) 是主题归一化的产物，必须放行。
  const sanitized: Record<string, unknown> = {};
  let sanitizedChanged = false;
  for (const [key, value] of Object.entries(next)) {
    if (value == null) {
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number") {
      sanitized[key] = value;
      continue;
    }
    if (!safeProperties.has(key)) {
      sanitizedChanged = true;
      continue;
    }
    if (typeof value === "string" && value.startsWith("var(")) {
      sanitized[key] = value;
      continue;
    }
    if (!isSafeHTMLStyleValue(value)) {
      sanitizedChanged = true;
      continue;
    }
    sanitized[key] = value;
  }

  if (sanitizedChanged) {
    return {
      darkSurfaceNormalized,
      style: Object.keys(sanitized).length > 0 ? (sanitized as React.CSSProperties) : undefined,
    };
  }

  // changed 在字符串入参时恒为 true，因此回退分支只会命中对象入参。
  return {
    darkSurfaceNormalized,
    style: changed ? (next as React.CSSProperties) : (styleObject as React.CSSProperties),
  };
}

function normalizeHtmlVisualPaint(
  tag: string,
  role: "fill" | "stopColor" | "stroke",
  value: unknown,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const color = parseNeutralColor(value);
  if (!color?.neutral || color.alpha < 0.5) {
    return value;
  }

  if (role === "stroke") {
    return "var(--border)";
  }
  if (tag === "text" || tag === "tspan") {
    return color.luminance <= 0.72 ? "var(--foreground)" : value;
  }
  if (color.luminance >= 0.72) {
    return "var(--card)";
  }

  return value;
}

function createHtmlVisualComponent(tag: string) {
  function HtmlVisualComponent({
    color,
    fill,
    node: _node,
    stopColor,
    stroke,
    style,
    ...props
  }: HtmlVisualComponentProps) {
    const inheritedDarkSurfaceNormalized = React.useContext(HtmlVisualToneContext);
    const normalizedProps: Record<string, unknown> = { ...props };
    const safeProperties =
      tag === "span" && isKatexSpan(props.className, style)
        ? KATEX_SAFE_HTML_STYLE_PROPERTIES
        : SAFE_HTML_STYLE_PROPERTIES;
    const { darkSurfaceNormalized, style: normalizedStyle } = normalizeHtmlVisualStyleWithTone(
      style,
      inheritedDarkSurfaceNormalized,
      safeProperties,
    );
    const normalizeLightText = inheritedDarkSurfaceNormalized || darkSurfaceNormalized;
    const normalizedColor = normalizeHtmlVisualTextColor(color, normalizeLightText);
    const normalizedFill = normalizeHtmlVisualPaint(tag, "fill", fill);
    const normalizedStopColor = normalizeHtmlVisualPaint(tag, "stopColor", stopColor);
    const normalizedStroke = normalizeHtmlVisualPaint(tag, "stroke", stroke);
    const normalizedClassName = normalizeHtmlVisualClassName(tag, props.className, style);

    if (normalizedClassName) {
      normalizedProps.className = normalizedClassName;
    } else {
      delete normalizedProps.className;
    }
    if (normalizedStyle) normalizedProps.style = normalizedStyle;
    if (normalizedColor !== undefined) normalizedProps.color = normalizedColor;
    if (normalizedFill !== undefined) normalizedProps.fill = normalizedFill;
    if (normalizedStopColor !== undefined) normalizedProps.stopColor = normalizedStopColor;
    if (normalizedStroke !== undefined) normalizedProps.stroke = normalizedStroke;

    const element = React.createElement(tag, normalizedProps);
    return darkSurfaceNormalized ? (
      <HtmlVisualToneContext.Provider value={true}>{element}</HtmlVisualToneContext.Provider>
    ) : (
      element
    );
  }

  HtmlVisualComponent.displayName = `HtmlVisual${tag}`;
  return HtmlVisualComponent;
}

function MarkdownVisualLink({
  style,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string; style?: React.CSSProperties | string }) {
  const inheritedDarkSurfaceNormalized = React.useContext(HtmlVisualToneContext);
  const { darkSurfaceNormalized, style: normalizedStyle } = normalizeHtmlVisualStyleWithTone(
    style,
    inheritedDarkSurfaceNormalized,
  );
  const element = (
    <MarkdownLink
      {...props}
      className={normalizeHtmlVisualClassName("a", props.className, style)}
      style={normalizedStyle}
    />
  );
  return darkSurfaceNormalized ? (
    <HtmlVisualToneContext.Provider value={true}>{element}</HtmlVisualToneContext.Provider>
  ) : (
    element
  );
}

function MarkdownVisualImage({
  style,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { alt?: string; src?: string; style?: React.CSSProperties | string }) {
  const inheritedDarkSurfaceNormalized = React.useContext(HtmlVisualToneContext);
  return (
    <MarkdownImage
      {...props}
      className={normalizeHtmlVisualClassName("img", props.className, style)}
      style={normalizeHtmlVisualStyle(style, inheritedDarkSurfaceNormalized)}
    />
  );
}

function MarkdownVisualParagraph({
  style,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { style?: React.CSSProperties | string }) {
  const inheritedDarkSurfaceNormalized = React.useContext(HtmlVisualToneContext);
  const { darkSurfaceNormalized, style: normalizedStyle } = normalizeHtmlVisualStyleWithTone(
    style,
    inheritedDarkSurfaceNormalized,
  );
  const element = (
    <MarkdownParagraph
      {...props}
      className={normalizeHtmlVisualClassName("p", props.className, style)}
      style={normalizedStyle}
    />
  );
  return darkSurfaceNormalized ? (
    <HtmlVisualToneContext.Provider value={true}>{element}</HtmlVisualToneContext.Provider>
  ) : (
    element
  );
}

const HTML_VISUAL_COMPONENTS = HTML_VISUAL_COMPONENT_TAGS.reduce<Components>((components, tag) => {
  components[tag] = createHtmlVisualComponent(tag);
  return components;
}, {});

const BASE_MARKDOWN_CLASSNAME = cn(
  "chat-font-content min-w-0 max-w-full overflow-hidden leading-6 text-foreground [overflow-wrap:anywhere]",
  "[&>*:last-child]:after:text-muted-foreground/55",
  "[&_*]:min-w-0",
  "[&_p]:max-w-full [&_p]:break-words [&_p]:[overflow-wrap:anywhere]",
  "[&_li]:max-w-full [&_li]:break-words [&_li]:[overflow-wrap:anywhere]",
  "[&_blockquote]:max-w-full [&_blockquote]:break-words [&_blockquote]:[overflow-wrap:anywhere]",
  "[&_span]:max-w-full [&_span]:[overflow-wrap:anywhere]",
  "[&_[data-streamdown='mermaid-block']]:my-4 [&_[data-streamdown='mermaid-block']]:flex [&_[data-streamdown='mermaid-block']]:!w-full [&_[data-streamdown='mermaid-block']]:min-w-0 [&_[data-streamdown='mermaid-block']]:gap-2 [&_[data-streamdown='mermaid-block']]:rounded-none [&_[data-streamdown='mermaid-block']]:border-0 [&_[data-streamdown='mermaid-block']]:bg-transparent [&_[data-streamdown='mermaid-block']]:p-0 [&_[data-streamdown='mermaid-block']]:shadow-none",
  "[&_[data-streamdown='mermaid-block']>div:last-child]:!w-full [&_[data-streamdown='mermaid-block']>div:last-child]:min-w-0 [&_[data-streamdown='mermaid-block']>div:last-child]:rounded-none [&_[data-streamdown='mermaid-block']>div:last-child]:border-0 [&_[data-streamdown='mermaid-block']>div:last-child]:bg-transparent [&_[data-streamdown='mermaid-block']>div:last-child]:p-0 [&_[data-streamdown='mermaid-block']>div:last-child]:shadow-none",
  "[&_[data-streamdown='mermaid']]:my-0 [&_[data-streamdown='mermaid']]:block [&_[data-streamdown='mermaid']]:!w-full [&_[data-streamdown='mermaid']]:max-h-[280px] [&_[data-streamdown='mermaid']]:min-w-0 [&_[data-streamdown='mermaid']]:overflow-hidden [&_[data-streamdown='mermaid']]:rounded-none [&_[data-streamdown='mermaid']]:border-0 [&_[data-streamdown='mermaid']]:bg-transparent [&_[data-streamdown='mermaid']]:shadow-none",
  "[&_[data-streamdown='mermaid']>div]:!w-full [&_[data-streamdown='mermaid']>div]:max-w-none [&_[data-streamdown='mermaid']>div]:min-w-0",
  "[&_[data-streamdown='mermaid']_svg]:mx-auto [&_[data-streamdown='mermaid']_svg]:block [&_[data-streamdown='mermaid']_svg]:h-auto [&_[data-streamdown='mermaid']_svg]:max-h-[280px] [&_[data-streamdown='mermaid']_svg]:max-w-full [&_[data-streamdown='mermaid']_svg]:bg-transparent",
  "[&_[data-streamdown='mermaid']>div>div:first-child]:!left-0 [&_[data-streamdown='mermaid']>div>div:first-child]:rounded-none [&_[data-streamdown='mermaid']>div>div:first-child]:border-0 [&_[data-streamdown='mermaid']>div>div:first-child]:bg-transparent [&_[data-streamdown='mermaid']>div>div:first-child]:p-0 [&_[data-streamdown='mermaid']>div>div:first-child]:shadow-none [&_[data-streamdown='mermaid']>div>div:first-child]:backdrop-blur-none",
  "[&_[data-streamdown='mermaid-block-actions']]:gap-2 [&_[data-streamdown='mermaid-block-actions']]:border-0 [&_[data-streamdown='mermaid-block-actions']]:rounded-none [&_[data-streamdown='mermaid-block-actions']]:bg-transparent [&_[data-streamdown='mermaid-block-actions']]:p-0 [&_[data-streamdown='mermaid-block-actions']]:shadow-none [&_[data-streamdown='mermaid-block-actions']]:backdrop-blur-none",
  "[&_[data-streamdown='mermaid-block-actions']_svg]:size-3",
  "[&_[data-streamdown='mermaid-block']_button>svg]:size-3",
  "[&_[data-streamdown='table-wrapper']]:my-4 [&_[data-streamdown='table-wrapper']]:!w-full [&_[data-streamdown='table-wrapper']]:min-w-0 [&_[data-streamdown='table-wrapper']]:gap-0 [&_[data-streamdown='table-wrapper']]:border-0 [&_[data-streamdown='table-wrapper']]:rounded-none [&_[data-streamdown='table-wrapper']]:bg-transparent [&_[data-streamdown='table-wrapper']]:p-0 [&_[data-streamdown='table-wrapper']]:shadow-none [&_[data-streamdown='table-wrapper']]:outline-none [&_[data-streamdown='table-wrapper']]:ring-0",
  "[&_[data-streamdown='table-wrapper']>div:last-child]:!w-full [&_[data-streamdown='table-wrapper']>div:last-child]:min-w-0 [&_[data-streamdown='table-wrapper']>div:last-child]:overflow-x-auto [&_[data-streamdown='table-wrapper']>div:last-child]:overflow-y-hidden [&_[data-streamdown='table-wrapper']>div:last-child]:border-0 [&_[data-streamdown='table-wrapper']>div:last-child]:rounded-none [&_[data-streamdown='table-wrapper']>div:last-child]:bg-transparent [&_[data-streamdown='table-wrapper']>div:last-child]:p-0 [&_[data-streamdown='table-wrapper']>div:last-child]:shadow-none [&_[data-streamdown='table-wrapper']>div:last-child]:outline-none [&_[data-streamdown='table-wrapper']>div:last-child]:ring-0",
  "[&_table]:my-2 [&_table]:!min-w-full [&_table]:!w-full [&_table]:border-collapse [&_table]:table-auto [&_table]:border-0 [&_table]:outline-none [&_table]:shadow-none [&_table]:ring-0 [&_table]:bg-transparent",
  "[&_table]:max-w-none [&_table]:rounded-none",
  "[&_thead]:border-table-border [&_tbody]:border-table-border [&_tfoot]:border-table-border",
  "[&_tr]:border-table-border/50 [&_thead_tr]:border-table-border/50 [&_tbody_tr]:border-table-border/50",
  "[&_th]:px-0 [&_th]:py-2 [&_th]:pr-8 [&_th]:text-left [&_th]:align-bottom [&_th]:font-semibold [&_th]:tracking-[-0.01em] [&_th]:text-foreground",
  "[&_td]:px-0 [&_td]:py-1 [&_td]:pr-8 [&_td]:align-middle [&_td]:leading-8 [&_td]:text-foreground/90",
  "[&_th]:border-0 [&_td]:border-0",
  "[&_th:last-child]:pr-0 [&_td:last-child]:pr-0",
  "[&_thead]:bg-transparent [&_tbody]:bg-transparent [&_tr]:bg-transparent",
  "[&_div:has(>table)]:border-0 [&_div:has(>table)]:outline-none [&_div:has(>table)]:ring-0 [&_div:has(>table)]:rounded-none [&_div:has(>table)]:bg-transparent [&_div:has(>table)]:shadow-none",
  "[&_table_*]:outline-none [&_table_*]:ring-0",
  "[&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:bg-foreground/[0.05] [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[0.92em] [&_code:not(pre_code)]:text-foreground [&_code:not(pre_code)]:whitespace-pre-wrap [&_code:not(pre_code)]:break-words [&_code:not(pre_code)]:[overflow-wrap:anywhere]",
  "[&_[data-streamdown='code-block']]:my-4 [&_[data-streamdown='code-block']]:!w-full [&_[data-streamdown='code-block']]:min-w-0 [&_[data-streamdown='code-block']]:gap-0 [&_[data-streamdown='code-block']]:border-0 [&_[data-streamdown='code-block']]:rounded-none [&_[data-streamdown='code-block']]:bg-transparent [&_[data-streamdown='code-block']]:p-0 [&_[data-streamdown='code-block']]:shadow-none [&_[data-streamdown='code-block']]:outline-none [&_[data-streamdown='code-block']]:ring-0",
  "[&_[data-streamdown='code-block']>div:first-child]:min-h-0 [&_[data-streamdown='code-block']>div:first-child]:justify-between [&_[data-streamdown='code-block']>div:first-child]:gap-2 [&_[data-streamdown='code-block']>div:first-child]:border-0 [&_[data-streamdown='code-block']>div:first-child]:bg-transparent [&_[data-streamdown='code-block']>div:first-child]:mt-2 [&_[data-streamdown='code-block']>div:first-child]:pb-6 [&_[data-streamdown='code-block']>div:first-child]:text-[11px] [&_[data-streamdown='code-block']>div:first-child]:font-medium [&_[data-streamdown='code-block']>div:first-child]:tracking-[0.06em] [&_[data-streamdown='code-block']>div:first-child]:text-muted-foreground/85 [&_[data-streamdown='code-block']>div:first-child]:shadow-none",
  "[&_[data-streamdown='code-block']>div:last-child]:!w-full [&_[data-streamdown='code-block']>div:last-child]:min-w-0 [&_[data-streamdown='code-block']>div:last-child]:border-0 [&_[data-streamdown='code-block']>div:last-child]:rounded-none [&_[data-streamdown='code-block']>div:last-child]:bg-transparent [&_[data-streamdown='code-block']>div:last-child]:p-0 [&_[data-streamdown='code-block']>div:last-child]:shadow-none",
  "[&_[data-streamdown='code-block-body']]:!bg-muted/40 [&_[data-streamdown='code-block-body']]:!rounded-xl",
  "[&_pre]:group [&_pre]:my-0 [&_pre]:block [&_pre]:!w-full [&_pre]:!min-w-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:overflow-y-hidden [&_pre]:border-0 [&_pre]:bg-transparent [&_pre]:px-0 [&_pre]:pt-0 [&_pre]:pb-2 [&_pre]:shadow-none [&_pre]:outline-none [&_pre]:ring-0",
  "[&_pre>code]:block [&_pre>code]:w-max [&_pre>code]:min-w-full [&_pre>code]:max-w-none [&_pre>code]:border-0 [&_pre>code]:bg-transparent [&_pre>code]:py-4 [&_pre>code]:font-mono [&_pre>code]:text-[13px] [&_pre>code]:leading-5 [&_pre>code]:text-foreground/92 [&_pre>code]:shadow-none [&_pre>code]:outline-none [&_pre>code]:ring-0",
  "[&_[data-streamdown='code-block-actions']]:gap-2 [&_[data-streamdown='code-block-actions']]:!opacity-100 [&_[data-streamdown='code-block-actions']]:border-0 [&_[data-streamdown='code-block-actions']]:rounded-none [&_[data-streamdown='code-block-actions']]:bg-transparent [&_[data-streamdown='code-block-actions']]:p-0 [&_[data-streamdown='code-block-actions']]:shadow-none [&_[data-streamdown='code-block-actions']]:backdrop-blur-none",
  "[&_[data-streamdown='code-block-actions']_button]:inline-flex [&_[data-streamdown='code-block-actions']_button]:items-center [&_[data-streamdown='code-block-actions']_button]:justify-center [&_[data-streamdown='code-block-actions']_button]:rounded-md [&_[data-streamdown='code-block-actions']_button]:border-0 [&_[data-streamdown='code-block-actions']_button]:bg-transparent [&_[data-streamdown='code-block-actions']_button]:p-1 [&_[data-streamdown='code-block-actions']_button]:text-muted-foreground [&_[data-streamdown='code-block-actions']_button]:shadow-none [&_[data-streamdown='code-block-actions']_button:hover]:bg-foreground/[0.04] [&_[data-streamdown='code-block-actions']_button:hover]:text-foreground",
  "[&_[data-streamdown='code-block-actions']_svg]:size-3",
  "[&_[data-footnotes]]:mt-8 [&_[data-footnotes]]:border-t [&_[data-footnotes]]:border-border/45 [&_[data-footnotes]]:pt-3 [&_[data-footnotes]]:text-[13px] [&_[data-footnotes]]:leading-6 [&_[data-footnotes]]:text-muted-foreground/82",
  "[&_[data-footnotes]_h2]:sr-only",
  "[&_[data-footnotes]_ol]:my-0 [&_[data-footnotes]_ol]:pl-4",
  "[&_[data-footnotes]_li]:my-1 [&_[data-footnotes]_li]:pl-1 [&_[data-footnotes]_li]:text-muted-foreground/82",
  "[&_[data-footnotes]_p]:my-0 [&_[data-footnotes]_p]:text-[13px] [&_[data-footnotes]_p]:leading-6 [&_[data-footnotes]_p]:text-muted-foreground/82",
  "[&_.katex]:text-[1.04em] [&_.katex]:leading-[1.35]",
  "[&_.katex-display]:my-3 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:px-1 [&_.katex-display]:py-1",
  "[&_.katex-display>.katex]:min-w-fit [&_.katex-display>.katex]:max-w-none",
  "[&_[data-latex-copyable='true']]:cursor-copy [&_[data-latex-copyable='true']]:rounded-sm [&_[data-latex-copyable='true']]:outline-none [&_[data-latex-copyable='true']]:transition-colors",
  "[&_[data-latex-copyable='true']:hover]:bg-foreground/[0.035] [&_[data-latex-copyable='true']:focus-visible]:bg-foreground/[0.045] [&_[data-latex-copyable='true']:focus-visible]:ring-2 [&_[data-latex-copyable='true']:focus-visible]:ring-ring/25",
  "[&_strong]:font-semibold",
);

const THINKING_MARKDOWN_CLASSNAME = cn(
  BASE_MARKDOWN_CLASSNAME,
  "leading-6 text-muted-foreground/84",
  "[&_p]:my-0.25 [&_p]:text-[12px] [&_p]:leading-5 [&_p]:text-muted-foreground/84",
  "[&_li]:text-[12px] [&_li]:leading-5 [&_li]:text-muted-foreground/84",
  "[&_ul]:my-0.5 [&_ul]:pl-4",
  "[&_ol]:my-0.5 [&_ol]:pl-4",
  "[&_h1]:mt-0.5 [&_h1]:mb-0 [&_h1]:text-[12px] [&_h1]:font-medium [&_h1]:leading-5 [&_h1]:text-muted-foreground/88",
  "[&_h2]:mt-0.5 [&_h2]:mb-0 [&_h2]:text-[12px] [&_h2]:font-medium [&_h2]:leading-5 [&_h2]:text-muted-foreground/88",
  "[&_h3]:mt-0.5 [&_h3]:mb-0 [&_h3]:text-[12px] [&_h3]:font-medium [&_h3]:leading-5 [&_h3]:text-muted-foreground/88",
  "[&_h4]:mt-0.5 [&_h4]:mb-0 [&_h4]:text-[12px] [&_h4]:font-medium [&_h4]:leading-5 [&_h4]:text-muted-foreground/88",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic [&_em]:text-foreground/92",
  "[&_blockquote]:my-0.5 [&_blockquote]:border-l-0 [&_blockquote]:pl-0 [&_blockquote]:text-[12px] [&_blockquote]:text-muted-foreground/78",
  "[&_code:not(pre_code)]:bg-foreground/[0.03] [&_code:not(pre_code)]:text-[11px] [&_code:not(pre_code)]:text-muted-foreground/88",
  "[&_[data-streamdown='code-block-body']]:!bg-muted/20",
  "[&_pre]:pb-0",
  "[&_pre>code]:py-2 [&_pre>code]:text-[11px] [&_pre>code]:leading-5 [&_pre>code]:text-muted-foreground/82",
  "[&_th]:py-0.5 [&_th]:text-[11px] [&_th]:text-muted-foreground/86",
  "[&_td]:py-0.5 [&_td]:text-[11px] [&_td]:text-muted-foreground/78",
);

const DEFAULT_STREAMDOWN_COMPONENTS = {
  ...HTML_VISUAL_COMPONENTS,
  a: MarkdownVisualLink,
  img: MarkdownVisualImage,
  p: MarkdownVisualParagraph,
  pre: CollapsibleCodePre,
} as const;

const THINKING_STREAMDOWN_COMPONENTS = {
  ...DEFAULT_STREAMDOWN_COMPONENTS,
  h1: ThinkingHeading,
  h2: ThinkingHeading,
  h3: ThinkingHeading,
  h4: ThinkingHeading,
  h5: ThinkingHeading,
  h6: ThinkingHeading,
} as const;

function normalizeStreamdownContent(content: unknown): string {
  return normalizeMermaidBlocks(
    normalizeLatexUnicodeSymbols(
      normalizeMathDelimiters(protectCurrencyDollars(normalizeSemanticHtmlFragments(normalizeContent(content)))),
    ),
  );
}

function detectStreamdownFeatures(content: string): StreamdownFeatureFlags {
  return {
    code: FENCED_CODE_BLOCK_RE.test(content),
    math: DISPLAY_MATH_RE.test(content) || INLINE_MATH_RE.test(content),
    mermaid: MERMAID_CODE_BLOCK_RE.test(content),
  };
}

function getStreamdownPluginKey(features: StreamdownFeatureFlags): string {
  return [features.code ? "code" : "", features.math ? "math" : "", features.mermaid ? "mermaid" : ""]
    .filter(Boolean)
    .join(":");
}

function getInitialStreamdownPlugins(features: StreamdownFeatureFlags): PluginConfig {
  if (!features.math) {
    return BASE_STREAMDOWN_PLUGINS;
  }

  return STREAMDOWN_MATH_BASE_PLUGINS;
}

async function loadStreamdownPlugins(features: StreamdownFeatureFlags): Promise<PluginConfig> {
  const key = getStreamdownPluginKey(features);

  if (!key) {
    return BASE_STREAMDOWN_PLUGINS;
  }

  const cachedPlugins = STREAMDOWN_PLUGIN_CACHE.get(key);
  if (cachedPlugins) {
    return cachedPlugins;
  }

  const cachedPromise = STREAMDOWN_PLUGIN_PROMISE_CACHE.get(key);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = (async () => {
    const plugins: PluginConfig = { ...BASE_STREAMDOWN_PLUGINS };

    if (features.code) {
      const { code } = await import("@streamdown/code");
      plugins.code = code;
    }

    if (features.math) {
      plugins.math = STREAMDOWN_MATH_PLUGIN;
    }

    if (features.mermaid) {
      const { createMermaidPlugin } = await import("@streamdown/mermaid");
      plugins.mermaid = createMermaidPlugin({
        config: {
          flowchart: {
            htmlLabels: false,
          },
        },
      });
    }

    STREAMDOWN_PLUGIN_CACHE.set(key, plugins);
    STREAMDOWN_PLUGIN_PROMISE_CACHE.delete(key);

    return plugins;
  })();

  STREAMDOWN_PLUGIN_PROMISE_CACHE.set(key, promise);
  void promise.catch(() => {
    STREAMDOWN_PLUGIN_PROMISE_CACHE.delete(key);
  });

  return promise;
}

function useStreamdownPlugins(content: string): PluginConfig {
  const features = React.useMemo(() => detectStreamdownFeatures(content), [content]);
  const pluginKey = React.useMemo(() => getStreamdownPluginKey(features), [features]);
  const [plugins, setPlugins] = React.useState<PluginConfig>(() => STREAMDOWN_PLUGIN_CACHE.get(pluginKey) ?? getInitialStreamdownPlugins(features));

  React.useEffect(() => {
    let cancelled = false;
    const cachedPlugins = STREAMDOWN_PLUGIN_CACHE.get(pluginKey);

    if (cachedPlugins) {
      setPlugins(cachedPlugins);
      return;
    }

    setPlugins(getInitialStreamdownPlugins(features));

    void loadStreamdownPlugins(features)
      .then((loadedPlugins) => {
        if (!cancelled) {
          setPlugins(loadedPlugins);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlugins(getInitialStreamdownPlugins(features));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [features, pluginKey]);

  return plugins;
}

function ThinkingSegmentBlock({
  content,
  incomplete,
  plugins,
  streaming,
}: {
  content: string;
  incomplete: boolean;
  plugins: PluginConfig;
  streaming: boolean;
}) {
  const t = useTranslations("chat.markdown.thinking");
  const active = streaming || incomplete;
  const [accordionValue, setAccordionValue] = React.useState(() => (active ? "thinking" : ""));
  const wasActiveRef = React.useRef(active);

  React.useEffect(() => {
    if (active) {
      setAccordionValue("thinking");
      wasActiveRef.current = true;
      return;
    }

    if (wasActiveRef.current) {
      setAccordionValue("");
    }
    wasActiveRef.current = false;
  }, [active]);

  const isActive = active;
  const open = accordionValue === "thinking";

  return (
    <Accordion
      type="single"
      collapsible
      value={accordionValue}
      onValueChange={(value) => setAccordionValue(value || "")}
      className="w-full"
    >
      <AccordionItem value="thinking" className="border-b-0">
        <AccordionTrigger
          showArrow={false}
          className="group items-start gap-1.5 py-0 text-left no-underline hover:no-underline"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  isActive ? "thinking-shimmer" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {isActive ? t("active") : t("done")}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
              open && "rotate-180",
            )}
          />
        </AccordionTrigger>
        <AccordionContent className="pb-0 pt-1.5">
          <Streamdown
            className={cn(THINKING_MARKDOWN_CLASSNAME, "text-[12px] leading-6 text-muted-foreground/84")}
            components={THINKING_STREAMDOWN_COMPONENTS}
            controls={STREAMDOWN_CONTROLS}
            plugins={plugins}
            remend={STREAMDOWN_REMEND}
            allowedTags={STREAMDOWN_HTML_VISUAL_ALLOWED_TAGS}
            mode={streaming ? "streaming" : "static"}
            parseIncompleteMarkdown={streaming || incomplete}
            shikiTheme={["github-light", "github-dark"]}
            animated={false}
            isAnimating={false}
          >
            {content}
          </Streamdown>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export const StreamdownRender = React.memo(function StreamdownRender({
  content,
  className,
  streaming = false,
  variant = "default",
  imageActions,
  artifactActions,
}: StreamdownRenderProps) {
  const normalizedContent = React.useMemo(() => normalizeStreamdownContent(content), [content]);
  const plugins = useStreamdownPlugins(normalizedContent);
  const segments = React.useMemo(() => parseStreamdownSegments(normalizedContent), [normalizedContent]);
  const {
    rootRef: latexRootRef,
    onClickCapture: handleLatexClickCapture,
    onKeyDownCapture: handleLatexKeyDownCapture,
    onPointerDownCapture: handleLatexPointerDownCapture,
  } = useLatexCopy({
    contentVersion: normalizedContent,
    renderVersion: plugins,
  });
  const thinkingSegments = React.useMemo(
    () => segments.filter((segment): segment is Extract<RenderSegment, { type: "thinking" }> => segment.type === "thinking"),
    [segments],
  );
  const markdownSegments = React.useMemo(
    () => segments.filter((segment): segment is Extract<RenderSegment, { type: "markdown" }> => segment.type === "markdown"),
    [segments],
  );
  const mergedThinkingContent = React.useMemo(
    () => thinkingSegments.map((segment) => segment.content.trim()).filter(Boolean).join("\n\n"),
    [thinkingSegments],
  );
  const hasIncompleteThinking = React.useMemo(
    () => thinkingSegments.some((segment) => segment.incomplete),
    [thinkingSegments],
  );
  const contentSpacingClassName = variant === "thinking" ? "space-y-1.5 leading-6" : "space-y-3 leading-8";
  const activeMarkdownClassName = variant === "thinking" ? THINKING_MARKDOWN_CLASSNAME : BASE_MARKDOWN_CLASSNAME;
  const components = variant === "thinking" ? THINKING_STREAMDOWN_COMPONENTS : DEFAULT_STREAMDOWN_COMPONENTS;

  if (segments.length === 0) {
    return null;
  }

  return (
    <div
      ref={latexRootRef}
      className={cn("chat-font-content min-w-0 max-w-full overflow-hidden text-foreground [overflow-wrap:anywhere]", contentSpacingClassName, className)}
      data-chat-markdown-scope=""
      onClickCapture={handleLatexClickCapture}
      onKeyDownCapture={handleLatexKeyDownCapture}
      onPointerDownCapture={handleLatexPointerDownCapture}
    >
      {mergedThinkingContent ? (
        <ThinkingSegmentBlock
          content={mergedThinkingContent}
          incomplete={hasIncompleteThinking}
          plugins={plugins}
          streaming={streaming}
        />
      ) : null}
      {markdownSegments.map((segment, index) => (
        <MarkdownArtifactActionsContext.Provider key={`markdown-${index}`} value={artifactActions ?? null}>
          <MarkdownImageActionsContext.Provider value={imageActions ?? null}>
            <Streamdown
              className={activeMarkdownClassName}
              components={components}
              controls={STREAMDOWN_CONTROLS}
              plugins={plugins}
              remend={STREAMDOWN_REMEND}
              linkSafety={STREAMDOWN_LINK_SAFETY}
              allowedTags={STREAMDOWN_HTML_VISUAL_ALLOWED_TAGS}
              caret={streaming ? STREAMDOWN_CARET : undefined}
              mode={streaming ? "streaming" : "static"}
              parseIncompleteMarkdown={streaming}
              shikiTheme={["github-light", "github-dark"]}
              animated={false}
              isAnimating={streaming}
            >
              {segment.content}
            </Streamdown>
          </MarkdownImageActionsContext.Provider>
        </MarkdownArtifactActionsContext.Provider>
      ))}
    </div>
  );
});
