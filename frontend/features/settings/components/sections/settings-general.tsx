"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SpinnerLabel } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { dispatchUserProfileUpdated } from "@/features/settings/events/user-profile-events";
import { useTheme } from "@/shared/components/theme-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  readLocalAppearancePreferences,
  serializeAppearancePreferences,
  type AppearancePreferencePatch,
} from "@/features/settings/utils/appearance-preferences";
import {
  type ChatFontOption,
  type ChatFontWeightOption,
  useChatFontPreference,
  useChatFontWeightPreference,
  writeChatFontPreference,
  writeChatFontWeightPreference,
} from "@/features/settings/utils/chat-font";
import type {
  ChatFontPreview,
  ChatFontWeightPreview,
  ProfileDraft,
  ThemeMode,
  ThemePresetPreview,
  ThemePreviewPalette,
} from "@/features/settings/types/settings";
import {
  createDraftFromUser,
  isProfileDraftEqual,
  resolveSettingsErrorMessage,
} from "@/features/settings/utils/profile-settings";
import { createGeneratedGithubAvatarRef, generateAvatarVariant, resolveAvatarImageSrc } from "@/shared/lib/avatar";
import { useAuthSession } from "@/shared/auth/auth-session-context";
import {
  disableResponseCompletionNotifications,
  enableResponseCompletionNotifications,
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  readResponseCompletionNotificationsEnabled,
} from "@/shared/lib/browser-notifications";
import { patchMe, patchUsername } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/http-client";
import {
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  isDisplayNameLengthValid,
  isUsernamePolicyValid,
} from "@/shared/auth/account-policy";
import { cn } from "@/lib/utils";
import type { UserDTO } from "@/shared/api/auth.types";
import {
  SettingsFieldRow,
  SettingsPage,
  SettingsSection,
  SettingsSectionSeparator,
} from "@/shared/components/settings-layout";
import { TimeZoneSelect } from "@/shared/components/time-zone-select";

const THEME_PREVIEW_PALETTES: Record<"light" | "dark", ThemePreviewPalette> = {
  light: {
    background: "oklch(0.972 0.008 75)",
    sidebar: "oklch(0.966 0.008 75)",
    sidebarBorder: "oklch(0.9 0.008 75)",
    surface: "oklch(0.982 0.008 75)",
    surfaceBorder: "oklch(0.892 0.008 75)",
    textStrong: "oklch(0.265 0.012 70)",
    textSoft: "oklch(0.505 0.012 75)",
    accent: "oklch(0.56 0.155 40)",
  },
  dark: {
    background: "oklch(0.205 0.007 70)",
    sidebar: "oklch(0.195 0.007 70)",
    sidebarBorder: "oklch(0.305 0.007 70)",
    surface: "oklch(0.235 0.007 70)",
    surfaceBorder: "oklch(0.32 0.007 70)",
    textStrong: "oklch(0.915 0.012 80)",
    textSoft: "oklch(0.735 0.012 70)",
    accent: "oklch(0.665 0.135 43)",
  },
};

const THEME_PRESET_PREVIEWS: ThemePresetPreview[] = [
  {
    label: "Warm Sand",
    tone: "warm",
    value: "default",
    light: THEME_PREVIEW_PALETTES.light,
    dark: THEME_PREVIEW_PALETTES.dark,
  },
  {
    label: "Claude",
    tone: "warm",
    value: "claude",
    light: {
      background: "oklch(0.965 0.01 70)",
      sidebar: "oklch(0.956 0.012 70)",
      sidebarBorder: "oklch(0.884 0.012 70)",
      surface: "oklch(0.988 0.006 70)",
      surfaceBorder: "oklch(0.876 0.012 70)",
      textStrong: "oklch(0.245 0.012 65)",
      textSoft: "oklch(0.505 0.014 65)",
      accent: "oklch(0.64 0.115 28)",
    },
    dark: {
      background: "oklch(0.19 0.008 70)",
      sidebar: "oklch(0.18 0.008 70)",
      sidebarBorder: "oklch(0.292 0.01 70)",
      surface: "oklch(0.225 0.008 70)",
      surfaceBorder: "oklch(0.312 0.01 70)",
      textStrong: "oklch(0.91 0.012 78)",
      textSoft: "oklch(0.72 0.012 70)",
      accent: "oklch(0.72 0.108 28)",
    },
  },
  {
    label: "Yan-yu",
    tone: "cool",
    value: "yan-yu",
    light: {
      background: "oklch(0.957 0.018 215)",
      sidebar: "oklch(0.944 0.02 215)",
      sidebarBorder: "oklch(0.872 0.02 215)",
      surface: "oklch(0.982 0.01 210)",
      surfaceBorder: "oklch(0.862 0.018 215)",
      textStrong: "oklch(0.27 0.026 220)",
      textSoft: "oklch(0.51 0.024 215)",
      accent: "oklch(0.56 0.082 198)",
    },
    dark: {
      background: "oklch(0.198 0.02 218)",
      sidebar: "oklch(0.185 0.02 218)",
      sidebarBorder: "oklch(0.298 0.024 218)",
      surface: "oklch(0.232 0.02 218)",
      surfaceBorder: "oklch(0.32 0.024 218)",
      textStrong: "oklch(0.9 0.018 205)",
      textSoft: "oklch(0.72 0.018 210)",
      accent: "oklch(0.72 0.082 198)",
    },
  },
  {
    label: "Azure",
    tone: "cool",
    value: "azure",
    light: {
      background: "oklch(0.99 0 0)",
      sidebar: "oklch(0.984 0.004 240)",
      sidebarBorder: "oklch(0.918 0.004 240)",
      surface: "oklch(1.0 0 0)",
      surfaceBorder: "oklch(0.91 0.004 240)",
      textStrong: "oklch(0.23 0.015 245)",
      textSoft: "oklch(0.5 0.015 240)",
      accent: "oklch(0.55 0.125 242)",
    },
    dark: {
      background: "oklch(0.2 0.012 245)",
      sidebar: "oklch(0.19 0.012 245)",
      sidebarBorder: "oklch(0.3 0.012 245)",
      surface: "oklch(0.23 0.012 245)",
      surfaceBorder: "oklch(0.315 0.012 245)",
      textStrong: "oklch(0.93 0.01 240)",
      textSoft: "oklch(0.73 0.01 245)",
      accent: "oklch(0.7 0.125 242)",
    },
  },
  {
    label: "Midnight",
    tone: "cool",
    value: "cobalt",
    light: {
      background: "oklch(0.99 0 0)",
      sidebar: "oklch(0.984 0.005 255)",
      sidebarBorder: "oklch(0.918 0.005 255)",
      surface: "oklch(1.0 0 0)",
      surfaceBorder: "oklch(0.91 0.005 255)",
      textStrong: "oklch(0.22 0.02 265)",
      textSoft: "oklch(0.5 0.02 255)",
      accent: "oklch(0.535 0.17 268)",
    },
    dark: {
      background: "oklch(0.17 0.018 265)",
      sidebar: "oklch(0.16 0.018 265)",
      sidebarBorder: "oklch(0.27 0.018 265)",
      surface: "oklch(0.2 0.018 265)",
      surfaceBorder: "oklch(0.285 0.018 265)",
      textStrong: "oklch(0.93 0.012 250)",
      textSoft: "oklch(0.74 0.012 265)",
      accent: "oklch(0.66 0.155 268)",
    },
  },
  {
    label: "Graphite",
    tone: "neutral",
    value: "graphite",
    light: {
      background: "oklch(0.99 0 0)",
      sidebar: "oklch(0.984 0 0)",
      sidebarBorder: "oklch(0.918 0 0)",
      surface: "oklch(1.0 0 0)",
      surfaceBorder: "oklch(0.91 0 0)",
      textStrong: "oklch(0.18 0 0)",
      textSoft: "oklch(0.46 0 0)",
      accent: "oklch(0.2 0 0)",
    },
    dark: {
      background: "oklch(0.16 0 0)",
      sidebar: "oklch(0.15 0 0)",
      sidebarBorder: "oklch(0.26 0 0)",
      surface: "oklch(0.19 0 0)",
      surfaceBorder: "oklch(0.275 0 0)",
      textStrong: "oklch(0.96 0 0)",
      textSoft: "oklch(0.72 0 0)",
      accent: "oklch(0.95 0 0)",
    },
  },
  {
    label: "Aurora",
    tone: "cool",
    value: "lagoon",
    light: {
      background: "oklch(0.985 0 0)",
      sidebar: "oklch(0.979 0.005 280)",
      sidebarBorder: "oklch(0.913 0.005 280)",
      surface: "oklch(0.995 0 0)",
      surfaceBorder: "oklch(0.905 0.005 280)",
      textStrong: "oklch(0.24 0.02 290)",
      textSoft: "oklch(0.5 0.02 280)",
      accent: "oklch(0.555 0.17 292)",
    },
    dark: {
      background: "oklch(0.165 0.016 270)",
      sidebar: "oklch(0.155 0.016 270)",
      sidebarBorder: "oklch(0.265 0.016 270)",
      surface: "oklch(0.195 0.016 270)",
      surfaceBorder: "oklch(0.28 0.016 270)",
      textStrong: "oklch(0.94 0.012 280)",
      textSoft: "oklch(0.74 0.012 270)",
      accent: "oklch(0.7 0.155 292)",
    },
  },
  {
    label: "Ink",
    tone: "cool",
    value: "ink",
    light: {
      background: "oklch(0.985 0 0)",
      sidebar: "oklch(0.979 0.004 230)",
      sidebarBorder: "oklch(0.913 0.004 230)",
      surface: "oklch(0.995 0 0)",
      surfaceBorder: "oklch(0.905 0.004 230)",
      textStrong: "oklch(0.22 0.012 235)",
      textSoft: "oklch(0.49 0.012 230)",
      accent: "oklch(0.5 0.1 165)",
    },
    dark: {
      background: "oklch(0.16 0.006 230)",
      sidebar: "oklch(0.15 0.006 230)",
      sidebarBorder: "oklch(0.26 0.006 230)",
      surface: "oklch(0.19 0.006 230)",
      surfaceBorder: "oklch(0.275 0.006 230)",
      textStrong: "oklch(0.9 0.008 230)",
      textSoft: "oklch(0.72 0.008 230)",
      accent: "oklch(0.74 0.105 165)",
    },
  },
  {
    label: "Vivid",
    tone: "warm",
    value: "ochre",
    light: {
      background: "oklch(0.98 0.006 60)",
      sidebar: "oklch(0.974 0.006 60)",
      sidebarBorder: "oklch(0.908 0.006 60)",
      surface: "oklch(0.99 0 0)",
      surfaceBorder: "oklch(0.9 0.006 60)",
      textStrong: "oklch(0.25 0.01 60)",
      textSoft: "oklch(0.5 0.01 60)",
      accent: "oklch(0.605 0.17 32)",
    },
    dark: {
      background: "oklch(0.18 0.006 55)",
      sidebar: "oklch(0.17 0.006 55)",
      sidebarBorder: "oklch(0.28 0.006 55)",
      surface: "oklch(0.21 0.006 55)",
      surfaceBorder: "oklch(0.295 0.006 55)",
      textStrong: "oklch(0.92 0.008 80)",
      textSoft: "oklch(0.73 0.008 55)",
      accent: "oklch(0.68 0.16 32)",
    },
  },
  {
    label: "Dusk",
    tone: "warm",
    value: "sepia",
    light: {
      background: "oklch(0.975 0.007 20)",
      sidebar: "oklch(0.969 0.007 20)",
      sidebarBorder: "oklch(0.903 0.007 20)",
      surface: "oklch(0.985 0 0)",
      surfaceBorder: "oklch(0.895 0.007 20)",
      textStrong: "oklch(0.27 0.012 15)",
      textSoft: "oklch(0.51 0.012 20)",
      accent: "oklch(0.515 0.085 12)",
    },
    dark: {
      background: "oklch(0.195 0.008 345)",
      sidebar: "oklch(0.185 0.008 345)",
      sidebarBorder: "oklch(0.295 0.008 345)",
      surface: "oklch(0.225 0.008 345)",
      surfaceBorder: "oklch(0.31 0.008 345)",
      textStrong: "oklch(0.915 0.01 340)",
      textSoft: "oklch(0.735 0.01 345)",
      accent: "oklch(0.72 0.075 16)",
    },
  },
];

const CHAT_FONT_OPTIONS: ChatFontPreview[] = [
  { label: "Default", value: "default", fontFamily: "var(--font-sans)", sampleText: "Aa" },
  { label: "Serif", value: "songti", fontFamily: "var(--font-songti)", sampleText: "Aa" },
  { label: "Sans", value: "heiti", fontFamily: "var(--font-heiti)", sampleText: "Aa" },
  { label: "Mono", value: "mono", fontFamily: "var(--font-mono)", sampleText: "Aa" },
];

const CHAT_FONT_WEIGHT_OPTIONS: ChatFontWeightPreview[] = [
  { label: "Regular", value: "regular", fontWeight: 400, sampleText: "Aa" },
  { label: "Medium", value: "medium", fontWeight: 500, sampleText: "Aa" },
  { label: "Semibold", value: "semibold", fontWeight: 600, sampleText: "Aa" },
  { label: "Bold", value: "bold", fontWeight: 700, sampleText: "Aa" },
];

function ThemePreviewCanvas({ palette }: { palette: ThemePreviewPalette }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[9px]" style={{ backgroundColor: palette.background }}>
      <div
        className="absolute inset-y-0 left-0 w-[26%] border-r"
        style={{ backgroundColor: palette.sidebar, borderColor: palette.sidebarBorder }}
      >
        <div className="space-y-1 px-1.5 pt-2">
          <div className="h-px w-4 rounded-full" style={{ backgroundColor: palette.textStrong, opacity: 0.42 }} />
          <div className="h-px w-3 rounded-full" style={{ backgroundColor: palette.textSoft, opacity: 0.7 }} />
        </div>

        <div className="space-y-1.5 px-1.5 pt-4">
          <div className="h-px w-3 rounded-full" style={{ backgroundColor: palette.textSoft, opacity: 0.55 }} />
          <div className="h-px w-2.5 rounded-full" style={{ backgroundColor: palette.textSoft, opacity: 0.4 }} />
          <div className="h-px w-3.5 rounded-full" style={{ backgroundColor: palette.textSoft, opacity: 0.3 }} />
        </div>
      </div>

      <div className="absolute inset-y-0 right-0 left-[26%]">
        <div className="flex items-center justify-between px-2.5 pt-2">
          <div className="space-y-1">
            <div className="h-px w-5 rounded-full" style={{ backgroundColor: palette.textStrong, opacity: 0.45 }} />
            <div className="h-px w-7 rounded-full" style={{ backgroundColor: palette.textSoft, opacity: 0.45 }} />
          </div>
          <div
            className="h-2.5 w-6 rounded-full"
            style={{ backgroundColor: palette.surface, border: `1px solid ${palette.surfaceBorder}` }}
          />
        </div>

        <div
          className="absolute inset-x-2.5 top-8 rounded-[8px] border"
          style={{ height: "24px", backgroundColor: palette.surface, borderColor: palette.surfaceBorder }}
        >
          <div className="space-y-1 px-2 pt-2">
            <div className="h-px w-6 rounded-full" style={{ backgroundColor: palette.textStrong, opacity: 0.4 }} />
            <div className="h-px w-8 rounded-full" style={{ backgroundColor: palette.textSoft, opacity: 0.32 }} />
          </div>
        </div>

        <div
          className="absolute inset-x-2.5 bottom-2.5 rounded-[8px] border"
          style={{ height: "20px", backgroundColor: palette.surface, borderColor: palette.surfaceBorder }}
        >
          <div className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-[3px]" style={{ backgroundColor: palette.accent }} />
        </div>
      </div>
    </div>
  );
}

function ThemePresetPreviewCard({
  item,
  resolvedMode,
  active,
  onSelect,
}: {
  item: ThemePresetPreview;
  resolvedMode: "light" | "dark";
  active: boolean;
  onSelect: (preset: ThemePresetPreview["value"]) => void;
}) {
  const palette = resolvedMode === "dark" ? item.dark : item.light;
  const swatches = [
    palette.accent,
    palette.textStrong,
    palette.sidebar,
    palette.surface,
    palette.background,
  ];

  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className="group min-w-0 text-left"
      aria-pressed={active}
    >
      <div
        className={cn(
          "relative h-24 w-full overflow-hidden rounded-xl border transition-all duration-200 hover:scale-102 hover:border-primary/60",
          active ? "border-primary/60" : "border-border/50",
        )}
        style={{ backgroundColor: palette.background }}
      >
        <div
          className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
          style={{
            backgroundColor: palette.surface,
            color: palette.textStrong,
          }}
        >
          {item.tone}
        </div>

        <div className="absolute right-2.5 top-2.5 flex items-start gap-1.5">
          {swatches.map((color, index) => (
            <span
              key={`${item.value}-${index}`}
              className="h-9 w-2.5 rounded-full border-[0.5px]"
              style={{ backgroundColor: color, borderColor: palette.surfaceBorder }}
            />
          ))}
        </div>

        <div
          className="absolute inset-x-0 bottom-0 h-14"
          style={{
            background: `linear-gradient(to top, ${palette.background} 42%, transparent)`,
          }}
        />
        <span
          className="absolute bottom-3 left-3 right-3 truncate text-lg font-semibold leading-none tracking-normal"
          style={{ color: palette.textStrong }}
        >
          {item.label.toLowerCase()}
        </span>
      </div>
    </button>
  );
}

function ThemePreviewCard({
  label,
  mode,
  lightPalette,
  darkPalette,
  active,
  onSelect,
}: {
  label: string;
  mode: ThemeMode;
  lightPalette: ThemePreviewPalette;
  darkPalette: ThemePreviewPalette;
  active: boolean;
  onSelect: (mode: ThemeMode) => void;
}) {
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const previewPalette = mode === "dark" ? darkPalette : lightPalette;
  const foregroundPalette = mode === "dark" ? darkPalette : lightPalette;
  const lightClipPath = "polygon(0 0, 72% 0, 28% 100%, 0 100%)";
  const darkClipPath = "polygon(72% 0, 100% 0, 100% 100%, 28% 100%)";
  const content = (
    <span className="flex max-w-[calc(100%-1.5rem)] items-center gap-2">
      <Icon className="size-4 shrink-0" />
      <span className="truncate text-sm font-medium">{label}</span>
    </span>
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className="group text-left"
      aria-pressed={active}
    >
      <div
        className={cn(
          "relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border transition-all duration-200 hover:scale-102 hover:border-primary/60",
          active ? "border-primary/60" : "border-border/50",
        )}
        style={{ backgroundColor: previewPalette.background }}
      >
        {mode === "system" ? (
          <>
            <span
              className="absolute inset-0"
              style={{
                backgroundColor: lightPalette.background,
                clipPath: lightClipPath,
              }}
              aria-hidden="true"
            />
            <span
              className="absolute inset-0"
              style={{
                backgroundColor: darkPalette.background,
                clipPath: darkClipPath,
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ color: lightPalette.textStrong, clipPath: lightClipPath }}
              aria-hidden="true"
            >
              {content}
            </span>
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ color: darkPalette.textStrong, clipPath: darkClipPath }}
            >
              {content}
            </span>
          </>
        ) : (
          <span className="relative flex max-w-[calc(100%-1.5rem)] items-center gap-2" style={{ color: foregroundPalette.textStrong }}>
            <Icon className="size-4 shrink-0" />
            <span className="truncate text-sm font-medium">{label}</span>
          </span>
        )}
      </div>
    </button>
  );
}
function ChatFontPreviewCard({
  item,
  active,
  onSelect,
}: {
  item: ChatFontPreview;
  active: boolean;
  onSelect: (value: ChatFontOption) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className="group text-left"
      aria-pressed={active}
    >
      <div
        className={cn(
          "flex h-24 w-full items-center justify-center rounded-xl border bg-background px-1 transition-all duration-200 hover:scale-102 hover:border-primary/60",
          active ? "border-primary/60" : "border-border/50",
        )}
      >
        <span
          className="truncate text-center text-[clamp(0.9rem,2.8vw,1.125rem)] leading-none text-foreground/90"
          style={{ fontFamily: item.fontFamily }}
        >
          {item.label} {item.sampleText}
        </span>
      </div>
    </button>
  );
}

function ChatFontWeightPreviewCard({
  item,
  active,
  onSelect,
}: {
  item: ChatFontWeightPreview;
  active: boolean;
  onSelect: (value: ChatFontWeightOption) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className="group text-left"
      aria-pressed={active}
    >
      <div
        className={cn(
          "flex h-24 w-full items-center justify-center rounded-xl border bg-background px-1 transition-all duration-200 hover:scale-102 hover:border-primary/60",
          active ? "border-primary/60" : "border-border/50",
        )}
      >
        <span
          className="truncate text-center text-[clamp(0.9rem,2.8vw,1.125rem)] leading-none text-foreground/90"
          style={{ fontFamily: "var(--font-chat)", fontWeight: item.fontWeight }}
        >
          {item.label} {item.sampleText}
        </span>
      </div>
    </button>
  );
}

function resolveUsernameErrorMessage(
  error: unknown,
  labels: { invalid: string; alreadyChanged: string; taken: string },
): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return labels.invalid;
    }
    if (error.status === 409) {
      return error.message.includes("already used") ? labels.alreadyChanged : labels.taken;
    }
  }
  return resolveSettingsErrorMessage(error);
}

export function SettingsGeneral() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const { accessToken, user, userStatus } = useAuthSession();
  const { preset, resolvedTheme, setPreset, setTheme, theme } = useTheme();
  const [viewer, setViewer] = React.useState<UserDTO | null>(null);
  const [draft, setDraft] = React.useState<ProfileDraft>(() => createDraftFromUser());
  const [initialDraft, setInitialDraft] = React.useState<ProfileDraft>(() => createDraftFromUser());
  const [avatarDialogOpen, setAvatarDialogOpen] = React.useState(false);
  const [avatarDialogValue, setAvatarDialogValue] = React.useState("");
  const [themeRuntimeReady, setThemeRuntimeReady] = React.useState(false);
  const chatFont = useChatFontPreference();
  const chatFontWeight = useChatFontWeightPreference();
  const [notificationRuntimeReady, setNotificationRuntimeReady] = React.useState(false);
  const [notificationSupported, setNotificationSupported] = React.useState(false);
  const [responseCompletionNotificationsEnabled, setResponseCompletionNotificationsEnabled] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | "unsupported">("unsupported");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [usernameDraft, setUsernameDraft] = React.useState("");
  const initialUsernameToastShownRef = React.useRef(false);
  const appearanceSaveTimerRef = React.useRef<number | null>(null);
  const pendingAppearancePatchRef = React.useRef<AppearancePreferencePatch>({});

  React.useEffect(() => {
    if (userStatus === "loading") {
      setLoading(true);
      return;
    }

    if (!user) {
      setViewer(null);
      setLoading(false);
      return;
    }

    const nextDraft = createDraftFromUser(user);
    setViewer(user);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setUsernameDraft(user.username);
    setLoading(false);
  }, [user, userStatus]);

  React.useEffect(() => {
    setThemeRuntimeReady(true);
    setNotificationRuntimeReady(true);
    setNotificationSupported(isBrowserNotificationSupported());
    setResponseCompletionNotificationsEnabled(readResponseCompletionNotificationsEnabled());
    setNotificationPermission(getBrowserNotificationPermission());
  }, []);

  React.useEffect(() => {
    return () => {
      if (appearanceSaveTimerRef.current !== null) {
        window.clearTimeout(appearanceSaveTimerRef.current);
      }
    };
  }, []);

  const viewerInitial = React.useMemo(() => {
    const source = draft.displayName || viewer?.username || "?";
    return source.trim().charAt(0).toUpperCase() || "?";
  }, [draft.displayName, viewer?.username]);

  const avatarSource = React.useMemo(
    () => ({
      publicID: viewer?.publicID,
      username: viewer?.username,
      displayName: draft.displayName || viewer?.displayName,
    }),
    [draft.displayName, viewer?.displayName, viewer?.publicID, viewer?.username],
  );
  const draftAvatarSrc = React.useMemo(
    () => resolveAvatarImageSrc(draft.avatarUrl, avatarSource),
    [avatarSource, draft.avatarUrl],
  );
  const avatarDialogPreviewSrc = React.useMemo(
    () => resolveAvatarImageSrc(avatarDialogValue, avatarSource),
    [avatarDialogValue, avatarSource],
  );
  const hasProfileEdits = !isProfileDraftEqual(draft, initialDraft);
  const canEditUsername = Boolean(viewer && !viewer.usernameChangedAt);
  const normalizedUsernameDraft = usernameDraft.trim().toLowerCase();
  const hasUsernameEdit = canEditUsername && normalizedUsernameDraft !== "" && normalizedUsernameDraft !== viewer?.username;
  const hasEdits = hasProfileEdits || hasUsernameEdit;
  const activeThemeMode = themeRuntimeReady
    ? ((theme as ThemeMode | undefined) ?? "system")
    : "system";
  const activeThemePreset = themeRuntimeReady ? preset : "default";
  const activeThemePresetPreview = React.useMemo(
    () => THEME_PRESET_PREVIEWS.find((item) => item.value === activeThemePreset) ?? THEME_PRESET_PREVIEWS[0],
    [activeThemePreset],
  );

  React.useEffect(() => {
    if (viewer?.initialUsernameRequired && !initialUsernameToastShownRef.current) {
      initialUsernameToastShownRef.current = true;
      toast.info(t("generalPage.toast.initialUsernameRequired"));
    }
  }, [t, viewer?.initialUsernameRequired]);

  const handleSave = React.useCallback(async () => {
    if (saving || !hasEdits) {
      return;
    }

    try {
      if (hasUsernameEdit && !isUsernamePolicyValid(normalizedUsernameDraft)) {
        toast.error(t("generalPage.toast.setUsernameFailed"), {
          description: t("generalPage.username.invalid"),
        });
        return;
      }
      if (hasProfileEdits && !isDisplayNameLengthValid(draft.displayName)) {
        toast.error(t("generalPage.toast.saveProfileFailed"), {
          description: t("generalPage.profile.displayNameInvalid"),
        });
        return;
      }

      setSaving(true);

      let nextViewer = viewer;
      if (hasUsernameEdit) {
        try {
          nextViewer = await patchUsername(accessToken, { username: normalizedUsernameDraft });
        } catch (error) {
          toast.error(t("generalPage.toast.setUsernameFailed"), {
            description: resolveUsernameErrorMessage(error, {
              invalid: t("generalPage.username.invalid"),
              alreadyChanged: t("generalPage.username.alreadyChanged"),
              taken: t("generalPage.username.taken"),
            }),
          });
          return;
        }
      }

      if (hasProfileEdits) {
        nextViewer = await patchMe(accessToken, {
          avatarURL: draft.avatarUrl,
          displayName: draft.displayName,
          timezone: draft.timezone,
          locale: draft.locale,
          profilePreferences: draft.profilePreferences,
        });
      }

      if (!nextViewer) {
        return;
      }

      const nextDraft = createDraftFromUser(nextViewer);
      setViewer(nextViewer);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setUsernameDraft(nextViewer.username);
      dispatchUserProfileUpdated(nextViewer);
      toast.success(
        hasUsernameEdit && !hasProfileEdits
          ? t("generalPage.toast.usernameUpdated")
          : t("generalPage.toast.profileUpdated"),
      );
    } catch (error) {
      toast.error(t("generalPage.toast.saveProfileFailed"), {
        description: resolveSettingsErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }, [accessToken, draft, hasEdits, hasProfileEdits, hasUsernameEdit, normalizedUsernameDraft, saving, t, viewer]);

  const handleDiscard = React.useCallback(() => {
    setDraft(initialDraft);
    setUsernameDraft(viewer?.username ?? "");
  }, [initialDraft, viewer?.username]);

  const handleOpenAvatarDialog = React.useCallback(() => {
    setAvatarDialogValue(draft.avatarUrl.trim());
    setAvatarDialogOpen(true);
  }, [draft.avatarUrl]);

  const handleSaveAvatarDialog = React.useCallback(() => {
    setDraft((current) => ({ ...current, avatarUrl: avatarDialogValue.trim() }));
    setAvatarDialogOpen(false);
  }, [avatarDialogValue]);

  const handleCycleGeneratedAvatar = React.useCallback(() => {
    setAvatarDialogValue(createGeneratedGithubAvatarRef(generateAvatarVariant()));
  }, []);

  const handleResponseCompletionNotificationsChange = React.useCallback((checked: boolean) => {
    if (!notificationSupported) {
      return;
    }

    if (!checked) {
      disableResponseCompletionNotifications();
      setResponseCompletionNotificationsEnabled(false);
      setNotificationPermission(getBrowserNotificationPermission());
      return;
    }

    void (async () => {
      const result = await enableResponseCompletionNotifications();
      setResponseCompletionNotificationsEnabled(result.enabled);
      setNotificationPermission(result.permission);

      if (result.permission === "unsupported") {
        toast.error(t("generalPage.notifications.unsupportedTitle"), {
          description: t("generalPage.notifications.unsupportedDescription"),
        });
        return;
      }

      if (result.permission === "denied") {
        toast.error(t("generalPage.notifications.deniedTitle"), {
          description: t("generalPage.notifications.deniedDescription"),
        });
        return;
      }

      if (result.enabled) {
        toast.success(t("generalPage.notifications.enabledTitle"), {
          description: t("generalPage.notifications.enabledDescription"),
        });
      }
    })();
  }, [notificationSupported, t]);

  const persistAppearancePreferences = React.useCallback(
    (patch: AppearancePreferencePatch) => {
      if (!accessToken) {
        return;
      }

      pendingAppearancePatchRef.current = {
        ...pendingAppearancePatchRef.current,
        ...patch,
      };
      if (appearanceSaveTimerRef.current !== null) {
        window.clearTimeout(appearanceSaveTimerRef.current);
      }

      appearanceSaveTimerRef.current = window.setTimeout(() => {
        void (async () => {
          const pendingPatch = pendingAppearancePatchRef.current;
          pendingAppearancePatchRef.current = {};
          appearanceSaveTimerRef.current = null;
          const appearancePreferences = serializeAppearancePreferences({
            ...readLocalAppearancePreferences(),
            ...pendingPatch,
          });
          try {
            const nextViewer = await patchMe(accessToken, { appearancePreferences });
            setViewer((current) =>
              current ? { ...current, appearancePreferences: nextViewer.appearancePreferences } : nextViewer,
            );
          } catch (error) {
            toast.error(t("generalPage.toast.saveProfileFailed"), {
              description: resolveSettingsErrorMessage(error),
            });
          }
        })();
      }, 300);
    },
    [accessToken, t],
  );

  const notificationHelpText = React.useMemo(() => {
    if (!notificationRuntimeReady) {
      return t("generalPage.notifications.defaultHelp");
    }
    if (!notificationSupported) {
      return t("generalPage.notifications.unsupportedHelp");
    }
    if (notificationPermission === "denied") {
      return t("generalPage.notifications.deniedHelp");
    }
    if (notificationPermission === "granted") {
      return t("generalPage.notifications.grantedHelp");
    }
    return t("generalPage.notifications.defaultHelp");
  }, [notificationPermission, notificationRuntimeReady, notificationSupported, t]);

  const handleThemeModeChange = React.useCallback(
    (mode: ThemeMode) => {
      setTheme(mode);
      persistAppearancePreferences({ theme: mode });
    },
    [persistAppearancePreferences, setTheme],
  );

  const handleThemePresetChange = React.useCallback(
    (nextPreset: ThemePresetPreview["value"]) => {
      setPreset(nextPreset);
      persistAppearancePreferences({ preset: nextPreset });
    },
    [persistAppearancePreferences, setPreset],
  );

  const handleChatFontChange = React.useCallback((value: ChatFontOption) => {
    writeChatFontPreference(value);
    persistAppearancePreferences({ chatFont: value });
  }, [persistAppearancePreferences]);

  const handleChatFontWeightChange = React.useCallback((value: ChatFontWeightOption) => {
    writeChatFontWeightPreference(value);
    persistAppearancePreferences({ chatFontWeight: value });
  }, [persistAppearancePreferences]);

  return (
    <SettingsPage>
      <SettingsSection
        title={t("profile")}
        actions={
          hasEdits ? (
            <>
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={handleDiscard}>
                {common("actions.reset")}
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <SpinnerLabel>{common("actions.saving")}</SpinnerLabel> : common("actions.save")}
              </Button>
            </>
          ) : null
        }
      >
        <FieldGroup className="gap-3 md:gap-4">
          <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,132px)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field>
              <FieldLabel>{t("generalPage.profile.avatar")}</FieldLabel>
              <div className="flex items-center">
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={handleOpenAvatarDialog}
                  disabled={loading || saving}
                >
                  <Avatar className="size-9 bg-muted">
                    <AvatarImage src={draftAvatarSrc || undefined} alt={draft.displayName || viewer?.username || t("generalPage.profile.avatarAlt")} />
                    <AvatarFallback className="bg-foreground text-sm font-medium text-background">
                      {viewerInitial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </div>
            </Field>

            <Field>
              <FieldLabel>{t("generalPage.profile.username")}</FieldLabel>
              <div className="space-y-1.5">
                <Input
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value.toLowerCase())}
                  readOnly={!canEditUsername}
                  disabled={loading || saving || !canEditUsername}
                  maxLength={USERNAME_MAX_LENGTH}
                  placeholder={t("generalPage.profile.usernamePlaceholder")}
                />
              </div>
            </Field>

            <Field>
              <FieldLabel>{t("generalPage.profile.displayName")}</FieldLabel>
              <Input
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={t("generalPage.profile.displayNamePlaceholder")}
                disabled={loading || saving}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>{t("generalPage.profile.timezone")}</FieldLabel>
            <TimeZoneSelect
              id="settings-timezone"
              value={draft.timezone}
              disabled={loading || saving}
              onChange={(value) => setDraft((current) => ({ ...current, timezone: value }))}
            />
          </Field>

          <Field>
            <FieldLabel>{t("generalPage.profile.conversationPreferences")}</FieldLabel>
            <Textarea
              maxLength={1024}
              value={draft.profilePreferences}
              onChange={(event) =>
                setDraft((current) => ({ ...current, profilePreferences: event.target.value }))
              }
              placeholder={t("generalPage.profile.conversationPreferencesPlaceholder")}
              className="h-24 resize-none overflow-y-auto [field-sizing:fixed]"
              disabled={loading || saving}
            />
          </Field>
        </FieldGroup>
      </SettingsSection>

      <SettingsSectionSeparator />

      <SettingsSection title={t("notifications")}>
        <SettingsFieldRow
          title={t("generalPage.notifications.responseCompletionTitle")}
          description={
            <>
              {t("generalPage.notifications.responseCompletionDescription")}
              <br />
              {notificationHelpText}
            </>
          }
          controlClassName="sm:w-auto md:w-auto"
        >
          <Switch
            checked={responseCompletionNotificationsEnabled}
            onCheckedChange={handleResponseCompletionNotificationsChange}
            aria-label={t("generalPage.notifications.toggleResponseCompletion")}
            disabled={!notificationRuntimeReady || !notificationSupported}
            className="shrink-0"
          />
        </SettingsFieldRow>
      </SettingsSection>

      <SettingsSectionSeparator />

      <SettingsSection title={t("appearance")}>
        <FieldGroup className="gap-3 md:gap-4">
          <Field>
            <FieldLabel>{t("generalPage.appearance.themePreset")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3 xl:gap-4">
              {THEME_PRESET_PREVIEWS.map((item) => (
                <ThemePresetPreviewCard
                  key={item.value}
                  item={{ ...item, label: t(`generalPage.appearance.preset.${item.value}`) }}
                  resolvedMode={resolvedTheme}
                  active={activeThemePreset === item.value}
                  onSelect={handleThemePresetChange}
                />
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>{t("generalPage.appearance.colorMode")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3 xl:gap-4">
              <ThemePreviewCard
                label={t("generalPage.appearance.theme.light")}
                mode="light"
                lightPalette={activeThemePresetPreview.light}
                darkPalette={activeThemePresetPreview.dark}
                active={activeThemeMode === "light"}
                onSelect={handleThemeModeChange}
              />
              <ThemePreviewCard
                label={t("generalPage.appearance.theme.system")}
                mode="system"
                lightPalette={activeThemePresetPreview.light}
                darkPalette={activeThemePresetPreview.dark}
                active={activeThemeMode === "system"}
                onSelect={handleThemeModeChange}
              />
              <ThemePreviewCard
                label={t("generalPage.appearance.theme.dark")}
                mode="dark"
                lightPalette={activeThemePresetPreview.light}
                darkPalette={activeThemePresetPreview.dark}
                active={activeThemeMode === "dark"}
                onSelect={handleThemeModeChange}
              />
            </div>
          </Field>

          <Field>
            <FieldLabel>{t("generalPage.appearance.chatFont")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3 xl:gap-4">
              {CHAT_FONT_OPTIONS.map((item) => (
                <ChatFontPreviewCard
                  key={item.value}
                  item={{ ...item, label: t(`generalPage.appearance.font.${item.value}`) }}
                  active={chatFont === item.value}
                  onSelect={handleChatFontChange}
                />
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>{t("generalPage.appearance.chatFontWeight")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3 xl:gap-4">
              {CHAT_FONT_WEIGHT_OPTIONS.map((item) => (
                <ChatFontWeightPreviewCard
                  key={item.value}
                  item={{ ...item, label: t(`generalPage.appearance.fontWeight.${item.value}`) }}
                  active={chatFontWeight === item.value}
                  onSelect={handleChatFontWeightChange}
                />
              ))}
            </div>
          </Field>
        </FieldGroup>
      </SettingsSection>

      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("generalPage.avatarDialog.title")}</DialogTitle>
            <DialogDescription>{t("generalPage.avatarDialog.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-center">
              <button
                type="button"
                className="rounded-2xl transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handleCycleGeneratedAvatar}
              >
                <Avatar className="size-16 bg-pure">
                  <AvatarImage src={avatarDialogPreviewSrc || undefined} alt={draft.displayName || viewer?.username || t("generalPage.profile.avatarAlt")} />
                  <AvatarFallback className="bg-foreground text-3xl font-medium text-background">
                    {viewerInitial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>

            <Field>
              <FieldLabel>{t("generalPage.avatarDialog.avatarURL")}</FieldLabel>
              <Input
                value={avatarDialogValue}
                onChange={(event) => setAvatarDialogValue(event.target.value)}
                placeholder="https://example.com/avatar.png"
                disabled={saving}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAvatarDialogOpen(false)}>
              {common("actions.cancel")}
            </Button>
            <Button type="button" onClick={handleSaveAvatarDialog}>
              {t("generalPage.avatarDialog.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
