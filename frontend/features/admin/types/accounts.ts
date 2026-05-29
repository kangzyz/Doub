import type { AdminUserRole, AdminUserStatus } from "@/features/admin/api/admin.types";
import type { UserDTO } from "@/shared/api/auth.types";

export const USER_STATUS_OPTIONS: AdminUserStatus[] = [
  "pending_activation",
  "active",
  "locked",
  "suspended",
  "deactivated",
];

export const USER_ROLE_OPTIONS: AdminUserRole[] = ["user", "admin", "superadmin"];

export const USER_SORT_OPTIONS = [
  { labelKey: "sort.idDesc", value: "id_desc" },
  { labelKey: "sort.idAsc", value: "id_asc" },
  { labelKey: "sort.lastLoginDesc", value: "last_login_desc" },
  { labelKey: "sort.updatedDesc", value: "updated_desc" },
  { labelKey: "sort.displayNameAsc", value: "display_name_asc" },
] as const;

export const COMPACT_COMBOBOX_CLASSNAME =
  "rounded-sm [&_[data-slot=input-group-control]]:px-2 [&_[data-slot=input-group-addon]]:pr-1.5 [&_[data-slot=input-group-button]]:size-4.5 [&_[data-slot=combobox-trigger-icon]]:size-3.5";

export type UserSortValue = (typeof USER_SORT_OPTIONS)[number]["value"];

export type PendingAction =
  | ""
  | "create"
  | "edit"
  | "avatar"
  | "bulk-role"
  | "bulk-status"
  | "bulk-delete"
  | "bulk-timezone"
  | "reset-password"
  | "reset-2fa"
  | "revoke-sessions"
  | "delete"
  | "refresh";

export type InlineEditableField = "role" | "status";

export type AvatarDialogState =
  | { mode: "closed" }
  | { mode: "create"; value: string }
  | { mode: "edit"; target: UserDTO; value: string };

export type CreateUserPayload = {
  avatarURL: string;
  username: string;
  displayName: string;
  password: string;
  email: string;
  timezone: string;
  locale: string;
};

export type EditUserPayload = {
  avatarURL: string;
  displayName: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  timezone: string;
  locale: string;
  profilePreferences: string;
  reason: string;
};

export const DEFAULT_CREATE_USER_PAYLOAD: CreateUserPayload = {
  avatarURL: "",
  username: "",
  displayName: "",
  password: "",
  email: "",
  timezone: "Etc/UTC",
  locale: "en-US",
};
