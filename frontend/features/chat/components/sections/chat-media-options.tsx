"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatSubmitTask } from "@/features/chat/model/chat-task";
import type { ConversationOptions } from "@/shared/api/conversation.types";

type ChatMediaOptionsProps = {
  disabled: boolean;
  options: ConversationOptions;
  selectedProtocol: string;
  selectedVendor: string;
  selectedModelName: string;
  mediaTask: ChatSubmitTask;
  isVideoExtension: boolean;
  onOptionsChange: React.Dispatch<React.SetStateAction<ConversationOptions>>;
};

type MediaOptionControl = {
  path: string;
  label: string;
  description: string;
  values: string[];
};

const XAI_IMAGE_ASPECT_RATIOS = ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20"];
const XAI_VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"];
const MEDIA_OPTION_UNSET_VALUE = "__doub_media_option_unset__";

function optionPathSegments(path: string): string[] {
  return path.split(".").map((item) => item.trim()).filter(Boolean);
}

function readOptionAtPath(options: ConversationOptions, path: string[]): unknown {
  let current: unknown = options;
  for (const segment of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function cloneOptionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneOptionValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, cloneOptionValue(child)]),
    );
  }
  return value;
}

function setOptionAtPath(options: ConversationOptions, path: string[], value: unknown): ConversationOptions {
  if (path.length === 0) {
    return options;
  }
  const next: ConversationOptions = { ...options };
  let current = next as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    const child = current[segment];
    if (child === null || typeof child !== "object" || Array.isArray(child)) {
      current[segment] = {};
    } else {
      current[segment] = { ...(child as Record<string, unknown>) };
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = cloneOptionValue(value);
  return next;
}

function deleteOptionAtPath(options: ConversationOptions, path: string[]): ConversationOptions {
  if (path.length === 0) {
    return options;
  }
  const next: ConversationOptions = { ...options };
  const stack: Array<{ object: Record<string, unknown>; key: string }> = [];
  let current = next as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    const child = current[segment];
    if (child === null || typeof child !== "object" || Array.isArray(child)) {
      return next;
    }
    const cloned = { ...(child as Record<string, unknown>) };
    current[segment] = cloned;
    stack.push({ object: current, key: segment });
    current = cloned;
  }
  delete current[path[path.length - 1]];
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const { object, key } = stack[index];
    const child = object[key];
    if (child !== null && typeof child === "object" && !Array.isArray(child) && Object.keys(child).length === 0) {
      delete object[key];
    }
  }
  return next;
}

function modelSignal(vendor: string, modelName: string): string {
  return `${vendor} ${modelName}`.trim().toLowerCase();
}

function isXAIImageModel(protocol: string, vendor: string, modelName: string): boolean {
  if (protocol.trim() === "xai_image") {
    return true;
  }
  if (protocol.trim() === "xai_image_edits") {
    return true;
  }
  if (protocol.trim() === "openai_image_generations" || protocol.trim() === "openai_image_edits") {
    return false;
  }
  const value = modelSignal(vendor, modelName);
  return value.includes("xai") || value.includes("grok-imagine-image") || value.includes("grok-image");
}

function isXAIVideoModel(vendor: string, modelName: string): boolean {
  const value = modelSignal(vendor, modelName);
  return value.includes("xai") || value.includes("grok-imagine-video");
}

function buildImageOptionControls({
  selectedProtocol,
  selectedVendor,
  selectedModelName,
  t,
}: {
  selectedProtocol: string;
  selectedVendor: string;
  selectedModelName: string;
  t: (key: string) => string;
}): MediaOptionControl[] {
  const protocol = selectedProtocol.trim();
  if (isXAIImageModel(protocol, selectedVendor, selectedModelName)) {
    return [
      {
        path: "aspect_ratio",
        label: t("imageOptions.aspectRatio"),
        description: t("imageOptions.aspectRatioDescription"),
        values: XAI_IMAGE_ASPECT_RATIOS,
      },
      {
        path: "resolution",
        label: t("imageOptions.resolution"),
        description: t("imageOptions.resolutionDescription"),
        values: ["1k", "2k"],
      },
    ];
  }
  if (protocol === "openai_image_generations" || protocol === "openai_image_edits") {
    return [
      {
        path: "size",
        label: t("imageOptions.size"),
        description: t("imageOptions.sizeDescription"),
        values: ["auto", "1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"],
      },
    ];
  }
  return [];
}

function buildVideoOptionControls({
  selectedProtocol,
  selectedVendor,
  selectedModelName,
  isExtension,
  t,
}: {
  selectedProtocol: string;
  selectedVendor: string;
  selectedModelName: string;
  isExtension: boolean;
  t: (key: string) => string;
}): MediaOptionControl[] {
  if (selectedProtocol.trim() !== "openai_video_generations") {
    return [];
  }
  if (isXAIVideoModel(selectedVendor, selectedModelName)) {
    const durationValues = isExtension ? ["2", "4", "6", "8", "10"] : ["4", "6", "8", "10", "12", "15"];
    const controls: MediaOptionControl[] = [
      {
        path: "duration",
        label: t("videoOptions.duration"),
        description: t("videoOptions.durationDescription"),
        values: durationValues,
      },
    ];
    if (!isExtension) {
      controls.push(
        {
          path: "aspect_ratio",
          label: t("videoOptions.aspectRatio"),
          description: t("videoOptions.aspectRatioDescription"),
          values: XAI_VIDEO_ASPECT_RATIOS,
        },
        {
          path: "resolution",
          label: t("videoOptions.resolution"),
          description: t("videoOptions.resolutionDescription"),
          values: ["480p", "720p", "1080p"],
        },
      );
    }
    return controls;
  }
  return [
    {
      path: "seconds",
      label: t("videoOptions.seconds"),
      description: t("videoOptions.secondsDescription"),
      values: ["4", "8", "12"],
    },
    {
      path: "size",
      label: t("videoOptions.size"),
      description: t("videoOptions.sizeDescription"),
      values: ["1280x720", "720x1280", "1792x1024", "1024x1792"],
    },
  ];
}

export function ChatMediaOptions({
  disabled,
  options,
  selectedProtocol,
  selectedVendor,
  selectedModelName,
  mediaTask,
  isVideoExtension,
  onOptionsChange,
}: ChatMediaOptionsProps) {
  const tComposer = useTranslations("chat.composer");
  const controls = React.useMemo(() => {
    if (mediaTask === "image_generation" || mediaTask === "image_edit") {
      return buildImageOptionControls({
        selectedProtocol,
        selectedVendor,
        selectedModelName,
        t: tComposer,
      });
    }
    if (mediaTask === "video_generation") {
      return buildVideoOptionControls({
        selectedProtocol,
        selectedVendor,
        selectedModelName,
        isExtension: isVideoExtension,
        t: tComposer,
      });
    }
    return [];
  }, [isVideoExtension, mediaTask, selectedModelName, selectedProtocol, selectedVendor, tComposer]);

  if (controls.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto px-0.5" aria-label={tComposer("mediaOptions.title")}>
      {controls.map((control) => {
        const path = optionPathSegments(control.path);
        const value = readOptionAtPath(options, path);
        const selectedValue = value === undefined || value === null || value === "" ? MEDIA_OPTION_UNSET_VALUE : String(value);
        return (
          <Select
            key={control.path}
            value={selectedValue}
            disabled={disabled}
            onValueChange={(nextValue) => {
              if (nextValue === MEDIA_OPTION_UNSET_VALUE) {
                onOptionsChange((previous) => deleteOptionAtPath(previous, path));
                return;
              }
              onOptionsChange((previous) => setOptionAtPath(previous, path, nextValue));
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-[86px] shrink-0 rounded-md px-2 text-[11px] sm:w-[96px]"
              aria-label={control.label}
              title={control.description}
            >
              <SelectValue placeholder={control.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MEDIA_OPTION_UNSET_VALUE}>
                {control.label}
              </SelectItem>
              {control.values.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}
