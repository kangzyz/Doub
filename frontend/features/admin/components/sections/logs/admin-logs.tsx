"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from "@/components/ui/table";
import { AdminDateRangeFilter, ADMIN_DATE_PICKER_TRIGGER_CLASSNAME } from "@/features/admin/components/admin-date-range-filter";
import { TablePagination, TableToolbar } from "@/components/ui/table-tools";
import type { AdminAuditLogDTO, AdminSystemEventDTO, AdminUserAuthEventDTO } from "@/features/admin/api/admin.types";
import {
  AUDIT_LOG_SORT_OPTIONS,
  SECURITY_LOG_SORT_OPTIONS,
  SYSTEM_EVENT_SORT_OPTIONS,
  useAdminLogs,
  useAdminSecurityLogs,
  useAdminSystemEvents,
  type AuditLogSortValue,
  type SecurityLogSortValue,
  type SystemEventSortValue,
} from "@/features/admin/hooks/use-admin-logs";
import { cn } from "@/lib/utils";

type LogDetail =
  | { kind: "audit"; item: AdminAuditLogDTO }
  | { kind: "auth"; item: AdminUserAuthEventDTO }
  | { kind: "system"; item: AdminSystemEventDTO };

const ALL_MODELS_VALUE = "__all__";

function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveUserDisplayName(label: string, username: string, fallbackID: number): string {
  const name = label.trim() || username.trim();
  return name || String(fallbackID);
}

function formatJSON(raw: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) {
    return "{}";
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatCount(value: number | null | undefined, locale: string): string {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

async function copyText(value: string, label: string, copiedMessage: (label: string) => string, failedMessage: string) {
  if (!value.trim()) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast.success(copiedMessage(label));
  } catch {
    toast.error(failedMessage);
  }
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-border/50 py-2.5 last:border-b-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={cn("min-w-0 break-words text-xs leading-5 text-foreground/86", mono && "font-mono")}>{value ?? "-"}</div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="px-1 text-xs font-medium text-foreground/88">{title}</h4>
      <div className="rounded-lg border border-border/60 bg-background px-3">{children}</div>
    </section>
  );
}

function LogDetailSheet({ detail, onClose }: { detail: LogDetail | null; onClose: () => void }) {
  const locale = useLocale();
  const t = useTranslations("adminLogs.detail");
  const resultLabel = React.useCallback(
    (value: string) => {
      switch (value) {
        case "success":
          return t("result.success");
        case "failure":
          return t("result.failure");
        case "blocked":
          return t("result.blocked");
        default:
          return value || "-";
      }
    },
    [t],
  );
  const title =
    detail?.kind === "auth"
      ? t("titles.auth")
      : detail?.kind === "system"
        ? t("titles.system")
        : t("titles.audit");
  const description =
    detail?.kind === "auth"
      ? `${detail.item.eventType || t("fallbacks.authEvent")} · ${formatDateTime(detail.item.occurredAt, locale)}`
      : detail?.kind === "system"
        ? `${detail.item.event || t("fallbacks.systemEvent")} · ${formatDateTime(detail.item.createdAt, locale)}`
        : `${detail?.item.action || t("fallbacks.auditEvent")} · ${formatDateTime(detail?.item.createdAt, locale)}`;
  const requestID = detail ? detail.item.requestID : "";
  const detailJSON = detail?.item.detailJSON;
  const formattedJSON = formatJSON(detailJSON);

  return (
    <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[720px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {detail?.kind === "audit" ? (
            <>
              <DetailBlock title={t("blocks.event")}>
                <DetailRow label="ID" value={detail.item.id} mono />
                <DetailRow label={t("fields.action")} value={detail.item.action} />
                <DetailRow label={t("fields.resource")} value={detail.item.resource} />
                <DetailRow label={t("fields.resourceID")} value={detail.item.resourceID} mono />
                <DetailRow label={t("fields.createdAt")} value={formatDateTime(detail.item.createdAt, locale)} />
              </DetailBlock>
              <DetailBlock title={t("blocks.actor")}>
                <DetailRow label={t("fields.user")} value={resolveUserDisplayName(detail.item.actorLabel, detail.item.actorUsername, detail.item.actorUserID)} />
                <DetailRow label={t("fields.userID")} value={detail.item.actorUserID} mono />
              </DetailBlock>
              <DetailBlock title={t("blocks.request")}>
                <DetailRow label={t("fields.requestID")} value={detail.item.requestID} mono />
                <DetailRow label="IP" value={detail.item.ip} mono />
                <DetailRow label="User Agent" value={detail.item.userAgent} />
              </DetailBlock>
            </>
          ) : null}

          {detail?.kind === "auth" ? (
            <>
              <DetailBlock title={t("blocks.event")}>
                <DetailRow label="ID" value={detail.item.id} mono />
                <DetailRow label={t("fields.event")} value={detail.item.eventType} />
                <DetailRow label={t("fields.result")} value={resultLabel(detail.item.result)} />
                <DetailRow label={t("fields.reason")} value={detail.item.reason} />
                <DetailRow label={t("fields.occurredAt")} value={formatDateTime(detail.item.occurredAt, locale)} />
              </DetailBlock>
              <DetailBlock title={t("blocks.user")}>
                <DetailRow label={t("fields.user")} value={resolveUserDisplayName(detail.item.userLabel, detail.item.username, detail.item.userID)} />
                <DetailRow label={t("fields.userID")} value={detail.item.userID} mono />
              </DetailBlock>
              <DetailBlock title={t("blocks.request")}>
                <DetailRow label={t("fields.requestID")} value={detail.item.requestID} mono />
                <DetailRow label="IP" value={detail.item.clientIP} mono />
                <DetailRow label="User Agent" value={detail.item.userAgent} />
              </DetailBlock>
            </>
          ) : null}

          {detail?.kind === "system" ? (
            <>
              <DetailBlock title={t("blocks.event")}>
                <DetailRow label="ID" value={detail.item.id} mono />
                <DetailRow label={t("fields.level")} value={detail.item.level} />
                <DetailRow label={t("fields.source")} value={detail.item.source} />
                <DetailRow label={t("fields.event")} value={detail.item.event} />
                <DetailRow label={t("fields.message")} value={detail.item.message} />
                <DetailRow label={t("fields.createdAt")} value={formatDateTime(detail.item.createdAt, locale)} />
              </DetailBlock>
              <DetailBlock title={t("blocks.resource")}>
                <DetailRow label={t("fields.resource")} value={detail.item.resource} />
                <DetailRow label={t("fields.resourceID")} value={detail.item.resourceID} mono />
              </DetailBlock>
              <DetailBlock title={t("blocks.request")}>
                <DetailRow label={t("fields.requestID")} value={detail.item.requestID} mono />
                <DetailRow label="Trace ID" value={detail.item.traceID} mono />
              </DetailBlock>
            </>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <h4 className="text-xs font-medium text-foreground/88">{t("jsonTitle")}</h4>
              <div className="flex items-center gap-1">
                {requestID ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs shadow-none" onClick={() => void copyText(requestID, t("fields.requestID"), (label) => t("copied", { label }), t("copyFailed"))}>
                    <Copy className="size-3.5" />
                    {t("fields.requestID")}
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs shadow-none" onClick={() => void copyText(formattedJSON, t("jsonTitle"), (label) => t("copied", { label }), t("copyFailed"))}>
                  <Copy className="size-3.5" />
                  JSON
                </Button>
              </div>
            </div>
            <pre className="max-h-[320px] overflow-auto rounded-lg border border-border/60 bg-muted/35 p-3 text-xs leading-5 text-foreground/86">
              <code>{formattedJSON}</code>
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AuditLogTable({ onOpenDetail }: { onOpenDetail: (item: AdminAuditLogDTO) => void }) {
  const locale = useLocale();
  const t = useTranslations("adminLogs");
  const logs = useAdminLogs();

  return (
    <div className="space-y-3">
      <TableToolbar
        query={logs.query}
        onQueryChange={logs.setQuery}
        queryPlaceholder={t("audit.searchPlaceholder")}
        filters={[
          {
            key: "resource",
            label: t("columns.resource"),
            value: logs.resourceFilter,
            onValueChange: logs.setResourceFilter,
            options: logs.resourceOptions,
          },
          {
            key: "action",
            label: t("columns.action"),
            value: logs.actionFilter,
            onValueChange: logs.setActionFilter,
            options: logs.actionOptions,
          },
          {
            key: "created_range",
            label: t("filters.timeRange"),
            active: Boolean(logs.createdFromFilter || logs.createdToFilter),
            content: (
              <AdminDateRangeFilter
                fromValue={logs.createdFromFilter}
                toValue={logs.createdToFilter}
                onFromChange={logs.setCreatedFromFilter}
                onToChange={logs.setCreatedToFilter}
                disabled={logs.loading}
              />
            ),
          },
        ]}
        sort={{
          value: logs.sortValue,
          onValueChange: (value) => logs.setSortValue(value as AuditLogSortValue),
          options: AUDIT_LOG_SORT_OPTIONS.map((item) => ({ label: t(item.labelKey), value: item.value })),
        }}
        loading={logs.loading}
        onRefresh={() => void logs.loadAuditLogs(logs.page, logs.pageSize)}
      />

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[72px]">ID</TableHead>
            <TableHead>{t("columns.actor")}</TableHead>
            <TableHead>{t("columns.action")}</TableHead>
            <TableHead>{t("columns.resource")}</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>{t("columns.time")}</TableHead>
            <TableHead>{t("columns.requestID")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.loading && logs.auditLogs.length === 0 ? <TableSkeletonRows colSpan={7} rowCount={10} /> : null}
          {logs.auditLogs.map((item) => (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpenDetail(item)}>
              <TableCell className="font-mono text-xs text-foreground">{item.id}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {resolveUserDisplayName(item.actorLabel, item.actorUsername, item.actorUserID)}
              </TableCell>
              <TableCell>
                <div className="max-w-[12rem] truncate" title={item.action || "-"}>{item.action || "-"}</div>
              </TableCell>
              <TableCell>
                <div className="max-w-[14rem] truncate" title={item.resource || "-"}>{item.resource || "-"}</div>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{item.ip || "-"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.createdAt, locale)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                <div className="max-w-[14rem] truncate" title={item.requestID || "-"}>{item.requestID || "-"}</div>
              </TableCell>
            </TableRow>
          ))}
          {!logs.loading && logs.auditLogs.length === 0 ? <TableEmptyRow colSpan={7}>{t("audit.empty")}</TableEmptyRow> : null}
        </TableBody>
      </Table>

      <TablePagination
        loading={logs.loading}
        page={logs.page}
        pageCount={logs.pageCount}
        pageSize={logs.pageSize}
        total={logs.total}
        onPageChange={(nextPage) => void logs.loadAuditLogs(nextPage, logs.pageSize)}
        onPageSizeChange={(nextPageSize) => void logs.loadAuditLogs(1, nextPageSize)}
      />
    </div>
  );
}

function AuthLogTable({ onOpenDetail }: { onOpenDetail: (item: AdminUserAuthEventDTO) => void }) {
  const locale = useLocale();
  const t = useTranslations("adminLogs");
  const logs = useAdminSecurityLogs();
  const resultLabel = React.useCallback(
    (value: string) => {
      switch (value) {
        case "success":
          return t("detail.result.success");
        case "failure":
          return t("detail.result.failure");
        case "blocked":
          return t("detail.result.blocked");
        default:
          return value || "-";
      }
    },
    [t],
  );

  return (
    <div className="space-y-3">
      <TableToolbar
        query={logs.query}
        onQueryChange={logs.setQuery}
        queryPlaceholder={t("auth.searchPlaceholder")}
        filters={[
          {
            key: "result",
            label: t("columns.result"),
            value: logs.resultFilter,
            onValueChange: logs.setResultFilter,
            options: [
              { label: t("filters.allResults"), value: "" },
              { label: t("detail.result.success"), value: "success" },
              { label: t("detail.result.failure"), value: "failure" },
              { label: t("detail.result.blocked"), value: "blocked" },
            ],
          },
        ]}
        sort={{
          value: logs.sortValue,
          onValueChange: (value) => logs.setSortValue(value as SecurityLogSortValue),
          options: SECURITY_LOG_SORT_OPTIONS.map((item) => ({ label: t(item.labelKey), value: item.value })),
        }}
        loading={logs.loading}
        onRefresh={() => void logs.loadSecurityLogs(logs.page, logs.pageSize)}
      />

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[72px]">ID</TableHead>
            <TableHead>{t("columns.user")}</TableHead>
            <TableHead>{t("columns.event")}</TableHead>
            <TableHead>{t("columns.result")}</TableHead>
            <TableHead>{t("columns.reason")}</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>{t("columns.time")}</TableHead>
            <TableHead>{t("columns.requestID")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.loading && logs.sortedEvents.length === 0 ? <TableSkeletonRows colSpan={8} rowCount={10} /> : null}
          {logs.sortedEvents.map((item) => (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpenDetail(item)}>
              <TableCell className="font-mono text-xs text-foreground">{item.id}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {resolveUserDisplayName(item.userLabel, item.username, item.userID)}
              </TableCell>
              <TableCell>
                <div className="max-w-[14rem] truncate" title={item.eventType}>{item.eventType || "-"}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{resultLabel(item.result)}</TableCell>
              <TableCell className="text-muted-foreground">
                <div className="max-w-[14rem] truncate" title={item.reason || "-"}>{item.reason || "-"}</div>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{item.clientIP || "-"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.occurredAt, locale)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                <div className="max-w-[14rem] truncate" title={item.requestID || "-"}>{item.requestID || "-"}</div>
              </TableCell>
            </TableRow>
          ))}
          {!logs.loading && logs.sortedEvents.length === 0 ? <TableEmptyRow colSpan={8}>{t("auth.empty")}</TableEmptyRow> : null}
        </TableBody>
      </Table>

      <TablePagination
        loading={logs.loading}
        page={logs.page}
        pageCount={logs.pageCount}
        pageSize={logs.pageSize}
        total={logs.total}
        onPageChange={(nextPage) => void logs.loadSecurityLogs(nextPage, logs.pageSize)}
        onPageSizeChange={(nextPageSize) => void logs.loadSecurityLogs(1, nextPageSize)}
      />
    </div>
  );
}

function SystemEventTable({ onOpenDetail }: { onOpenDetail: (item: AdminSystemEventDTO) => void }) {
  const locale = useLocale();
  const t = useTranslations("adminLogs");
  const logs = useAdminSystemEvents();

  return (
    <div className="space-y-3">
      <TableToolbar
        query={logs.query}
        onQueryChange={logs.setQuery}
        queryPlaceholder={t("system.searchPlaceholder")}
        filters={[
          {
            key: "level",
            label: t("columns.level"),
            value: logs.levelFilter,
            onValueChange: logs.setLevelFilter,
            options: [
              { label: t("filters.allLevels"), value: "" },
              { label: t("filters.levels.info"), value: "info" },
              { label: t("filters.levels.warn"), value: "warn" },
              { label: t("filters.levels.error"), value: "error" },
            ],
          },
          {
            key: "source",
            label: t("columns.source"),
            value: logs.sourceFilter,
            onValueChange: logs.setSourceFilter,
            options: logs.sourceOptions,
          },
          {
            key: "event",
            label: t("columns.event"),
            value: logs.eventFilter,
            onValueChange: logs.setEventFilter,
            options: logs.eventOptions,
          },
          {
            key: "created_range",
            label: t("filters.timeRange"),
            active: Boolean(logs.createdFromFilter || logs.createdToFilter),
            content: (
              <AdminDateRangeFilter
                fromValue={logs.createdFromFilter}
                toValue={logs.createdToFilter}
                onFromChange={logs.setCreatedFromFilter}
                onToChange={logs.setCreatedToFilter}
                disabled={logs.loading}
              />
            ),
          },
        ]}
        sort={{
          value: logs.sortValue,
          onValueChange: (value) => logs.setSortValue(value as SystemEventSortValue),
          options: SYSTEM_EVENT_SORT_OPTIONS.map((item) => ({ label: t(item.labelKey), value: item.value })),
        }}
        loading={logs.loading}
        onRefresh={() => void logs.loadSystemEvents(logs.page, logs.pageSize)}
      />

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[72px]">ID</TableHead>
            <TableHead>{t("columns.level")}</TableHead>
            <TableHead>{t("columns.source")}</TableHead>
            <TableHead>{t("columns.event")}</TableHead>
            <TableHead>{t("columns.message")}</TableHead>
            <TableHead>{t("columns.resource")}</TableHead>
            <TableHead>{t("columns.time")}</TableHead>
            <TableHead>{t("columns.requestID")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.loading && logs.events.length === 0 ? <TableSkeletonRows colSpan={8} rowCount={10} /> : null}
          {logs.events.map((item) => (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpenDetail(item)}>
              <TableCell className="font-mono text-xs text-foreground">{item.id}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{item.level || "-"}</TableCell>
              <TableCell>
                <div className="max-w-[8rem] truncate" title={item.source || "-"}>{item.source || "-"}</div>
              </TableCell>
              <TableCell>
                <div className="max-w-[12rem] truncate" title={item.event || "-"}>{item.event || "-"}</div>
              </TableCell>
              <TableCell>
                <div className="max-w-[18rem] truncate text-muted-foreground" title={item.message || "-"}>{item.message || "-"}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="max-w-[10rem] truncate" title={item.resourceID ? `${item.resource}:${item.resourceID}` : item.resource || "-"}>
                  {item.resourceID ? `${item.resource}:${item.resourceID}` : item.resource || "-"}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.createdAt, locale)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                <div className="max-w-[14rem] truncate" title={item.requestID || "-"}>{item.requestID || "-"}</div>
              </TableCell>
            </TableRow>
          ))}
          {!logs.loading && logs.events.length === 0 ? <TableEmptyRow colSpan={8}>{t("system.empty")}</TableEmptyRow> : null}
        </TableBody>
      </Table>

      <TablePagination
        loading={logs.loading}
        page={logs.page}
        pageCount={logs.pageCount}
        pageSize={logs.pageSize}
        total={logs.total}
        onPageChange={(nextPage) => void logs.loadSystemEvents(nextPage, logs.pageSize)}
        onPageSizeChange={(nextPageSize) => void logs.loadSystemEvents(1, nextPageSize)}
      />
    </div>
  );
}

export function AdminLogsPage() {
  const t = useTranslations("adminLogs");
  const [detail, setDetail] = React.useState<LogDetail | null>(null);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex h-10 items-center justify-between gap-4 px-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("centerTitle")}</h3>
        </div>
      </div>

      <Tabs defaultValue="audit" className="space-y-3">
        <TabsList variant="line">
          <TabsTrigger value="audit">{t("tabs.audit")}</TabsTrigger>
          <TabsTrigger value="auth">{t("tabs.auth")}</TabsTrigger>
          <TabsTrigger value="system">{t("tabs.system")}</TabsTrigger>
        </TabsList>
        <TabsContent value="audit">
          <AuditLogTable onOpenDetail={(item) => setDetail({ kind: "audit", item })} />
        </TabsContent>
        <TabsContent value="auth">
          <AuthLogTable onOpenDetail={(item) => setDetail({ kind: "auth", item })} />
        </TabsContent>
        <TabsContent value="system">
          <SystemEventTable onOpenDetail={(item) => setDetail({ kind: "system", item })} />
        </TabsContent>
      </Tabs>

      <LogDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
