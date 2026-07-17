"use client";

import type { DashboardCompany } from "@/app/(dashboard)/dashboard/page";
import { sanitizeEnvFromUserFacingText } from "@/lib/monitor-error-format";
import {
  ManualBadge,
  LinesStatusBadge,
  ReviewedBadge,
} from "@/components/status-badge";
import { ReviewScreenshotLightbox } from "@/components/review-screenshot-lightbox";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CircleAlert,
  Columns2,
  ExternalLink,
  ListFilter,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type VerificationStatus = "yes" | "in-review" | "pending" | "no";

type FlatRow = {
  num: number;
  companyId: string;
  companyName: string;
  enabled: boolean;
  linkId: string;
  url: string;
  verificationStatus: VerificationStatus;
  hasActiveLines: boolean | null;
  isReviewed: boolean;
  isManualReview: boolean;
  lastReviewedAt: string | null;
  reviewScreenshotAt: string | null;
  lastMonitorErrorAt: string | null;
  lastMonitorErrorMessage: string | null;
  lastMonitorErrorDetail: string | null;
};

type SortKey =
  | "default"
  | "company"
  | "auto"
  | "lines"
  | "reviewed"
  | "manual"
  | "reviewedAt"
  | "verifyErr";

type SortDir = "asc" | "desc";

type AutoFilter = "all" | "yes" | "in-review" | "pending" | "no";
type LinesFilter = "all" | "yes" | "no" | "unknown";
type TriFilter = "all" | "yes" | "no";

type BulkMonitorSseEvent =
  | { type: "start"; total: number }
  | { type: "item_start"; index: number; linkId: string; companyName: string }
  | {
      type: "item";
      index: number;
      linkId: string;
      companyName: string;
      ok: boolean;
      error?: string;
      patternId?: string;
    }
  | { type: "done"; ok: number; fail: number; cancelled?: boolean }
  | { type: "fatal"; error: string };

/** Parte el buffer SSE en eventos `data: …` completos (terminados en `\n\n`). */
function shiftCompleteBulkSseEvents(buffer: string): {
  events: BulkMonitorSseEvent[];
  rest: string;
} {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: BulkMonitorSseEvent[] = [];
  for (const block of parts) {
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) {
        continue;
      }
      const json = t.slice(5).trim();
      if (!json) {
        continue;
      }
      try {
        events.push(JSON.parse(json) as BulkMonitorSseEvent);
      } catch {
        // ignorar línea malformada
      }
    }
  }
  return { events, rest };
}

/** Lee un cuerpo SSE de monitor y entrega cada evento parseado a `onEvent`. */
async function consumeMonitorSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: BulkMonitorSseEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let incomplete = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    incomplete += decoder.decode(value, { stream: true });
    const { events, rest } = shiftCompleteBulkSseEvents(incomplete);
    incomplete = rest;
    for (const ev of events) {
      onEvent(ev);
    }
  }
}

/** Columnas de datos (sin la casilla de selección masiva). */
type DataColumnId =
  | "num"
  | "company"
  | "enabled"
  | "auto"
  | "site"
  | "url"
  | "lines"
  | "reviewed"
  | "manual"
  | "reviewedAt"
  | "screenshot"
  | "actions"
  | "verifyErr";

const ALL_DATA_COLUMNS: DataColumnId[] = [
  "num",
  "company",
  "enabled",
  "auto",
  "site",
  "url",
  "lines",
  "reviewed",
  "manual",
  "reviewedAt",
  "screenshot",
  "actions",
  "verifyErr",
];

const DEFAULT_COLUMN_VISIBILITY: Record<DataColumnId, boolean> = {
  num: true,
  company: true,
  enabled: true,
  auto: true,
  site: true,
  url: false,
  lines: true,
  reviewed: true,
  manual: true,
  reviewedAt: true,
  screenshot: true,
  actions: true,
  verifyErr: true,
};

const COLUMN_LABEL: Record<DataColumnId, string> = {
  num: "#",
  company: "Compañía",
  enabled: "Visible",
  auto: "Auto",
  site: "Sitio",
  url: "URL",
  lines: "Líneas",
  reviewed: "Revisado",
  manual: "Manual",
  reviewedAt: "Última revisión",
  screenshot: "Captura",
  actions: "Acciones",
  verifyErr: "Error",
};

/** Pesos relativos para repartir el ancho cuando cambian columnas visibles. */
const COLUMN_WEIGHT: Record<DataColumnId, number> = {
  num: 2,
  company: 13,
  enabled: 4,
  auto: 3.75,
  site: 2.5,
  url: 26,
  lines: 11,
  reviewed: 4.75,
  manual: 3.5,
  reviewedAt: 9.5,
  screenshot: 5,
  actions: 9,
  verifyErr: 2.5,
};

const SELECT_COL_WEIGHT = 3.5;

function linesRank(v: boolean | null): number {
  if (v === true) return 2;
  if (v === false) return 1;
  return 0;
}

function hasVerifyError(r: FlatRow): boolean {
  return (
    r.lastMonitorErrorMessage != null && r.lastMonitorErrorMessage.trim() !== ""
  );
}

function compareRows(
  a: FlatRow,
  b: FlatRow,
  key: SortKey,
  dir: SortDir,
): number {
  const dirSign = dir === "asc" ? 1 : -1;
  switch (key) {
    case "default":
      return a.num - b.num;
    case "company":
      return (
        dirSign *
        a.companyName.localeCompare(b.companyName, "es", {
          sensitivity: "base",
        })
      );
    case "auto": {
      const rank: Record<VerificationStatus, number> = {
        yes: 3,
        "in-review": 2,
        pending: 1,
        no: 0,
      };
      const cmp = rank[a.verificationStatus] - rank[b.verificationStatus];
      return dirSign * cmp;
    }
    case "lines": {
      const cmp = linesRank(a.hasActiveLines) - linesRank(b.hasActiveLines);
      return dirSign * cmp;
    }
    case "reviewed": {
      const cmp = Number(a.isReviewed) - Number(b.isReviewed);
      return dirSign * cmp;
    }
    case "manual": {
      const cmp = Number(a.isManualReview) - Number(b.isManualReview);
      return dirSign * cmp;
    }
    case "reviewedAt": {
      const ta = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : null;
      const tb = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : null;
      if (ta === null && tb === null) return 0;
      if (ta === null) return dirSign;
      if (tb === null) return -dirSign;
      return dirSign * (ta - tb);
    }
    case "verifyErr": {
      const cmp = Number(hasVerifyError(a)) - Number(hasVerifyError(b));
      return dirSign * cmp;
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function rowMatchesFilters(
  r: FlatRow,
  q: string,
  auto: AutoFilter,
  lines: LinesFilter,
  reviewed: TriFilter,
  manual: TriFilter,
  verifyErr: TriFilter,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle) {
    const hay = `${r.companyName} ${r.url}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  if (auto !== "all" && r.verificationStatus !== auto) return false;
  if (lines === "yes" && r.hasActiveLines !== true) return false;
  if (lines === "no" && r.hasActiveLines !== false) return false;
  if (lines === "unknown" && r.hasActiveLines !== null) return false;
  if (reviewed === "yes" && !r.isReviewed) return false;
  if (reviewed === "no" && r.isReviewed) return false;
  if (manual === "yes" && !r.isManualReview) return false;
  if (manual === "no" && r.isManualReview) return false;
  if (verifyErr === "yes" && !hasVerifyError(r)) return false;
  if (verifyErr === "no" && hasVerifyError(r)) return false;
  return true;
}

function formatReviewedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SortableColumnKey = Exclude<SortKey, "default">;

function getSortTooltip(key: SortableColumnKey, dir: SortDir): string {
  const asc = dir === "asc";
  switch (key) {
    case "company":
      return asc ? "Orden: A → Z" : "Orden: Z → A";
    case "auto":
      return asc
        ? "Orden: sin verificación auto primero"
        : "Orden: con verificación auto primero";
    case "lines":
      return asc
        ? "Orden: desconocido, sin líneas, con líneas"
        : "Orden: con líneas, sin líneas, desconocido";
    case "reviewed":
      return asc ? "Orden: no revisado primero" : "Orden: revisado primero";
    case "manual":
      return asc ? "Orden: no manual primero" : "Orden: manual primero";
    case "reviewedAt":
      return asc
        ? "Orden: más antiguo primero (cronológico)"
        : "Orden: más reciente primero";
    case "verifyErr":
      return asc ? "Orden: sin error primero" : "Orden: con error primero";
    default: {
      const _never: never = key;
      return _never;
    }
  }
}

function getSortShortLabel(
  key: SortableColumnKey,
  dir: SortDir,
): string | null {
  switch (key) {
    case "company":
      return dir === "asc" ? "A–Z" : "Z–A";
    case "reviewedAt":
      return dir === "asc" ? "Antig." : "Reciente";
    case "auto":
    case "lines":
    case "reviewed":
    case "manual":
    case "verifyErr":
      return null;
    default: {
      const _never: never = key;
      return _never;
    }
  }
}

function sortableHeaderLabelFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  return "";
}

function SortableTableHead({
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className,
  title,
  align = "left",
  children,
}: {
  columnKey: SortableColumnKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
  title?: string;
  align?: "left" | "center";
  children: ReactNode;
}) {
  const active = sortKey === columnKey;
  const sortTip = getSortTooltip(columnKey, sortDir);
  const headerLabel = sortableHeaderLabelFromChildren(children);
  const supplementaryTitle =
    title && title.trim() !== headerLabel.trim() ? title : undefined;
  const sortHelp = active
    ? sortTip
    : "Pulsa para ordenar · repite el mismo criterio para invertir (↑/↓)";
  const combinedTitle = [headerLabel || undefined, supplementaryTitle, sortHelp]
    .filter(Boolean)
    .join(" · ");
  const short = active ? getSortShortLabel(columnKey, sortDir) : null;
  return (
    <TableHead
      className={cn(className, "p-0")}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : undefined
      }
    >
      <button
        type="button"
        className={cn(
          "flex w-full min-h-9 items-center gap-0.5 px-1 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
          align === "center" && "justify-center text-center",
          align === "left" && "text-left",
        )}
        title={combinedTitle}
        onClick={() => {
          onSort(columnKey);
        }}
      >
        <span
          className={cn(
            align === "center"
              ? "shrink-0 whitespace-nowrap text-center"
              : "min-w-0 flex-1 truncate",
          )}
        >
          {children}
        </span>
        {active ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-primary">
            {short ? (
              <span className="max-w-[3.25rem] truncate text-[10px] font-semibold leading-none">
                {short}
              </span>
            ) : null}
            {sortDir === "asc" ? (
              <ArrowUp className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="size-3.5 shrink-0" aria-hidden />
            )}
          </span>
        ) : (
          <ArrowUpDown
            className="size-3 shrink-0 text-muted-foreground/50"
            aria-hidden
          />
        )}
      </button>
    </TableHead>
  );
}

export function CompaniesTable({
  companies,
  isAdmin,
}: {
  companies: DashboardCompany[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pendingIngest, startIngest] = useTransition();
  const [pendingCheck, setPendingCheck] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [previewLinkId, setPreviewLinkId] = useState<string | null>(null);
  const [previewScreenshotCacheKey, setPreviewScreenshotCacheKey] = useState<
    string | null
  >(null);
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [verificationErrorModal, setVerificationErrorModal] = useState<{
    title: string;
    userMessage: string;
    technicalDetail: string;
  } | null>(null);

  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoFilter, setAutoFilter] = useState<AutoFilter>("all");
  const [linesFilter, setLinesFilter] = useState<LinesFilter>("all");
  const [reviewedFilter, setReviewedFilter] = useState<TriFilter>("all");
  const [manualFilter, setManualFilter] = useState<TriFilter>("all");
  const [errorFilter, setErrorFilter] = useState<TriFilter>("all");
  const [columnVisibility, setColumnVisibility] = useState<
    Record<DataColumnId, boolean>
  >(() => ({ ...DEFAULT_COLUMN_VISIBILITY }));
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkChecking, setBulkChecking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCompleted, setBulkCompleted] = useState(0);
  const [activeBulkLinkId, setActiveBulkLinkId] = useState<string | null>(null);
  const bulkAbortRef = useRef<AbortController | null>(null);

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    let n = 0;
    for (const c of companies) {
      for (const l of c.links) {
        n += 1;
        out.push({
          num: n,
          companyId: c.id,
          companyName: c.name,
          enabled: c.enabled,
          linkId: l.id,
          url: l.url,
          verificationStatus: l.verificationStatus,
          hasActiveLines: l.hasActiveLines,
          isReviewed: l.isReviewed,
          isManualReview: l.isManualReview,
          lastReviewedAt: l.lastReviewedAt,
          reviewScreenshotAt: l.reviewScreenshotAt,
          lastMonitorErrorAt: l.lastMonitorErrorAt,
          lastMonitorErrorMessage: l.lastMonitorErrorMessage,
          lastMonitorErrorDetail: l.lastMonitorErrorDetail,
        });
      }
    }
    return out;
  }, [companies]);

  const enabledByCompany = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of companies) {
      m.set(c.id, c.enabled);
    }
    return m;
  }, [companies]);

  const displayRows = useMemo(() => {
    const filtered = rows.filter((r) =>
      rowMatchesFilters(
        r,
        searchQuery,
        autoFilter,
        linesFilter,
        reviewedFilter,
        manualFilter,
        errorFilter,
      ),
    );
    return [...filtered].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey, sortDir);
      if (cmp !== 0) return cmp;
      return a.linkId.localeCompare(b.linkId);
    });
  }, [
    rows,
    searchQuery,
    autoFilter,
    linesFilter,
    reviewedFilter,
    manualFilter,
    errorFilter,
    sortKey,
    sortDir,
  ]);

  const selectableDisplayRows = useMemo(
    () =>
      displayRows.filter((r) => r.enabled && r.verificationStatus === "yes"),
    [displayRows],
  );

  const allSelectableVisibleSelected = useMemo(() => {
    if (selectableDisplayRows.length === 0) return false;
    return selectableDisplayRows.every((r) => selectedLinkIds.has(r.linkId));
  }, [selectableDisplayRows, selectedLinkIds]);

  const someSelectableVisibleSelected = useMemo(() => {
    return selectableDisplayRows.some((r) => selectedLinkIds.has(r.linkId));
  }, [selectableDisplayRows, selectedLinkIds]);

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el) return;
    el.indeterminate =
      someSelectableVisibleSelected && !allSelectableVisibleSelected;
  }, [someSelectableVisibleSelected, allSelectableVisibleSelected]);

  useEffect(() => {
    if (!verificationErrorModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVerificationErrorModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [verificationErrorModal]);

  const selectedVerifiableCount = useMemo(() => {
    let n = 0;
    for (const id of selectedLinkIds) {
      const row = rows.find((r) => r.linkId === id);
      if (row?.enabled && row.verificationStatus === "yes") n += 1;
    }
    return n;
  }, [selectedLinkIds, rows]);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      const visibleIds = selectableDisplayRows.map((r) => r.linkId);
      if (allSelectableVisibleSelected) {
        for (const id of visibleIds) {
          next.delete(id);
        }
      } else {
        for (const id of visibleIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, [selectableDisplayRows, allSelectableVisibleSelected]);

  const toggleRowSelected = useCallback(
    (linkId: string, canSelect: boolean) => {
      if (!canSelect) return;
      setSelectedLinkIds((prev) => {
        const next = new Set(prev);
        if (next.has(linkId)) {
          next.delete(linkId);
        } else {
          next.add(linkId);
        }
        return next;
      });
    },
    [],
  );

  const columnPresetDeltaCount = useMemo(() => {
    let n = 0;
    for (const id of ALL_DATA_COLUMNS) {
      if (id === "enabled" && !isAdmin) continue;
      if (columnVisibility[id] !== DEFAULT_COLUMN_VISIBILITY[id]) n += 1;
    }
    return n;
  }, [columnVisibility, isAdmin]);

  const activeChipsCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) n += 1;
    if (autoFilter !== "all") n += 1;
    if (linesFilter !== "all") n += 1;
    if (reviewedFilter !== "all") n += 1;
    if (manualFilter !== "all") n += 1;
    if (errorFilter !== "all") n += 1;
    if (sortKey !== "default") n += 1;
    n += columnPresetDeltaCount;
    return n;
  }, [
    searchQuery,
    autoFilter,
    linesFilter,
    reviewedFilter,
    manualFilter,
    errorFilter,
    sortKey,
    columnPresetDeltaCount,
  ]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = filtersPanelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [filtersOpen]);

  function applySearch() {
    setSearchQuery(searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft("");
    setSearchQuery("");
  }

  function clearFiltersAndSort() {
    clearSearch();
    setAutoFilter("all");
    setLinesFilter("all");
    setReviewedFilter("all");
    setManualFilter("all");
    setErrorFilter("all");
    setSortKey("default");
    setSortDir("asc");
    setFiltersOpen(false);
  }

  function onSortClick(next: SortKey) {
    if (next === "default") {
      setSortKey("default");
      setSortDir("asc");
      return;
    }
    if (sortKey === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      setSortDir("asc");
    }
  }

  const filterChip = (active: boolean) =>
    cn(
      "h-8 shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors",
      active
        ? "border border-primary/30 bg-primary/15 text-foreground shadow-sm"
        : "border border-border bg-background text-muted-foreground hover:bg-muted/60",
    );

  /** `top-0` = sticky respecto al contenedor con `overflow-auto` + `max-h` (no al viewport). Una clase por `th` porque `thead { position: sticky }` falla en varios navegadores. */
  const stickyHeadCell =
    "sticky top-0 z-10 border-b border-border bg-white text-xs font-medium text-muted-foreground shadow-sm dark:bg-zinc-900";

  const colWidths = useMemo(() => {
    const weights: number[] = [SELECT_COL_WEIGHT];
    for (const id of ALL_DATA_COLUMNS) {
      if (id === "enabled" && !isAdmin) continue;
      if (!columnVisibility[id]) continue;
      weights.push(COLUMN_WEIGHT[id]);
    }
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => `${((w / total) * 100).toFixed(2)}%`);
  }, [columnVisibility, isAdmin]);

  const showCol = useCallback(
    (id: DataColumnId) => {
      if (id === "enabled" && !isAdmin) return false;
      return columnVisibility[id];
    },
    [columnVisibility, isAdmin],
  );

  async function runIngest() {
    setBanner(null);
    startIngest(async () => {
      try {
        const res = await fetch("/api/ingest", { method: "POST" });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setBanner({
            type: "err",
            text: data.error ?? "Error al sincronizar",
          });
          return;
        }
        setBanner({
          type: "ok",
          text: "Sincronización con el CRT encolada. Corre en segundo plano en el worker; la lista se actualizará al terminar.",
        });
      } catch {
        setBanner({ type: "err", text: "Fallo de red al sincronizar." });
      }
    });
  }

  async function toggleCompany(companyId: string, enabled: boolean) {
    setBanner(null);
    setPendingToggle(companyId);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setBanner({
          type: "err",
          text: data.error ?? "No se pudo actualizar la compañía",
        });
        return;
      }
      router.refresh();
    } catch {
      setBanner({ type: "err", text: "Fallo de red." });
    } finally {
      setPendingToggle(null);
    }
  }

  async function runBulkCheck() {
    const verifiableRows = [...selectedLinkIds]
      .map((id) => rows.find((r) => r.linkId === id))
      .filter(
        (r): r is FlatRow =>
          r !== undefined && r.enabled && r.verificationStatus === "yes",
      );
    if (verifiableRows.length === 0) return;

    const linkIds = verifiableRows.map((r) => r.linkId);
    const ac = new AbortController();
    bulkAbortRef.current = ac;

    let cancelledByUser = false;

    setBanner(null);
    setBulkTotal(0);
    setBulkCompleted(0);
    setActiveBulkLinkId(null);
    setBulkProgress("Iniciando verificación masiva…");
    setBulkChecking(true);

    let finalOk = 0;
    let finalFail = 0;
    let sawDone = false;
    let fatalMessage: string | null = null;

    const resetBulkUi = () => {
      setBulkChecking(false);
      setBulkProgress(null);
      setBulkTotal(0);
      setBulkCompleted(0);
      setActiveBulkLinkId(null);
      bulkAbortRef.current = null;
    };

    try {
      const res = await fetch("/api/monitor/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ linkIds }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const raw = await res.text();
        let detail: string | null = null;
        let code: string | undefined;
        try {
          const data = JSON.parse(raw) as { error?: string; code?: string };
          code = data.code;
          detail =
            typeof data.error === "string" && data.error.trim() !== ""
              ? data.error.trim()
              : null;
        } catch {
          const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 220);
          detail = snippet !== "" ? snippet : null;
        }
        if (res.status === 428 || code === "VERIFICATION_PROFILE_INCOMPLETE") {
          router.push("/dashboard/setup");
          return;
        }
        setBanner({
          type: "err",
          text:
            detail ??
            `No se pudo iniciar la verificación masiva (${res.status} ${res.statusText}).`,
        });
        return;
      }

      if (!res.body) {
        setBanner({
          type: "err",
          text: "El navegador no permitió leer el progreso de la verificación masiva.",
        });
        return;
      }

      let total = 0;
      let itemsReceived = 0;

      await consumeMonitorSse(res.body, (ev) => {
        if (ev.type === "start") {
          total = ev.total;
          setBulkTotal(total);
          setBulkProgress(`Procesando 0 de ${total}…`);
        }
        if (ev.type === "item_start") {
          setActiveBulkLinkId(ev.linkId);
          setBulkProgress(
            total > 0
              ? `Verificando «${ev.companyName}» (${ev.index}/${total})…`
              : `Verificando «${ev.companyName}»…`,
          );
        }
        if (ev.type === "item") {
          itemsReceived += 1;
          setBulkCompleted(itemsReceived);
          setActiveBulkLinkId(null);
          if (total > 0) {
            setBulkProgress(`Completados ${itemsReceived} de ${total}…`);
          }
          startTransition(() => {
            router.refresh();
          });
        }
        if (ev.type === "done") {
          finalOk = ev.ok;
          finalFail = ev.fail;
          sawDone = true;
          setActiveBulkLinkId(null);
          if (ev.cancelled) {
            cancelledByUser = true;
          }
        }
        if (ev.type === "fatal") {
          fatalMessage = ev.error;
          setActiveBulkLinkId(null);
        }
      });

      if (!sawDone && !fatalMessage && !cancelledByUser) {
        fatalMessage = "La conexión terminó antes de recibir el resumen final.";
      }

      if (fatalMessage) {
        setBanner({ type: "err", text: fatalMessage });
        return;
      }

      if (cancelledByUser) {
        setBanner({
          type: "ok",
          text: `Verificación masiva detenida. Completados ${finalOk} correcto(s), ${finalFail} error(es) u omitidos.${
            finalFail > 0 ? " Revise la columna «Error» en la tabla." : ""
          }`,
        });
        return;
      }

      if (finalFail === 0) {
        setBanner({
          type: "ok",
          text:
            finalOk === 1
              ? "Verificación masiva: 1 enlace completado."
              : `Verificación masiva: ${finalOk} enlaces completados.`,
        });
      } else {
        setBanner({
          type: "err",
          text:
            finalFail === 1
              ? `Verificación masiva: ${finalOk} correcto(s) y 1 error. Revise la columna «Error» en la fila correspondiente para el mensaje y el detalle técnico.`
              : `Verificación masiva: ${finalOk} correcto(s) y ${finalFail} errores. Revise la columna «Error» en la tabla para el detalle de cada enlace.`,
        });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        cancelledByUser = true;
        setBanner({
          type: "ok",
          text: "Verificación masiva cancelada. Los enlaces ya procesados quedaron actualizados.",
        });
        startTransition(() => {
          void router.refresh();
        });
      } else {
        setBanner({
          type: "err",
          text: "Fallo de red en la verificación masiva.",
        });
      }
    } finally {
      resetBulkUi();
    }
  }

  async function runCheck(linkId: string, companyName: string) {
    setBanner(null);
    setPendingCheck(linkId);
    setActiveBulkLinkId(linkId);
    try {
      const res = await fetch(`/api/monitor/${linkId}`, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
      });

      if (!res.ok) {
        const raw = await res.text();
        let detail: string | null = null;
        let code: string | undefined;
        try {
          const data = JSON.parse(raw) as { error?: string; code?: string };
          code = data.code;
          detail =
            typeof data.error === "string" && data.error.trim() !== ""
              ? data.error.trim()
              : null;
        } catch {
          detail = raw.replace(/\s+/g, " ").trim().slice(0, 220) || null;
        }
        if (res.status === 428 || code === "VERIFICATION_PROFILE_INCOMPLETE") {
          router.push("/dashboard/setup");
          return;
        }
        setBanner({
          type: "err",
          text:
            detail != null
              ? `«${companyName}»: ${detail}`
              : `Error en la verificación de «${companyName}».`,
        });
        startTransition(() => {
          void router.refresh();
        });
        return;
      }

      if (!res.body) {
        setBanner({
          type: "err",
          text: `El navegador no permitió leer el progreso de la verificación de «${companyName}».`,
        });
        return;
      }

      let ok = 0;
      let fail = 0;
      let itemError: string | null = null;
      let fatalMessage: string | null = null;

      // La verificación corre en el worker (asíncrona): mostramos el spinner en
      // la fila mientras el job progresa y refrescamos al recibir el resultado.
      await consumeMonitorSse(res.body, (ev) => {
        if (ev.type === "item") {
          if (ev.ok) {
            ok += 1;
          } else {
            fail += 1;
            itemError = ev.error ?? null;
          }
          startTransition(() => {
            router.refresh();
          });
        }
        if (ev.type === "done") {
          ok = ev.ok;
          fail = ev.fail;
        }
        if (ev.type === "fatal") {
          fatalMessage = ev.error;
        }
      });

      if (fatalMessage) {
        setBanner({ type: "err", text: `«${companyName}»: ${fatalMessage}` });
      } else if (fail > 0) {
        setBanner({
          type: "err",
          text:
            itemError != null
              ? `«${companyName}»: ${itemError}`
              : `Error en la verificación de «${companyName}». Revise la columna «Error».`,
        });
      } else if (ok > 0) {
        setBanner({
          type: "ok",
          text: `Verificación finalizada para «${companyName}». Revise el resultado en la tabla.`,
        });
      } else {
        setBanner({
          type: "err",
          text: `La verificación de «${companyName}» terminó sin resultado. Intente de nuevo.`,
        });
      }
      router.refresh();
    } catch {
      setBanner({
        type: "err",
        text: `Fallo de red al verificar «${companyName}».`,
      });
    } finally {
      setPendingCheck(null);
      setActiveBulkLinkId(null);
    }
  }

  async function patchLineStatus(
    linkId: string,
    hasActiveLines: boolean | null,
    isManualReview: boolean,
  ) {
    setBanner(null);
    try {
      const res = await fetch(`/api/company-links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasActiveLines,
          isManualReview,
          isReviewed: true,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setBanner({
          type: "err",
          text: data.error ?? "No se pudo guardar",
        });
        return;
      }
      router.refresh();
    } catch {
      setBanner({ type: "err", text: "Fallo de red." });
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              void runIngest();
            }}
            disabled={pendingIngest}
          >
            {pendingIngest ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sincronizar desde CRT
          </Button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Solo administradores. Puede tardar varios minutos.
          </p>
        </div>
      ) : null}

      {bulkProgress !== null ? (
        <div
          className={cn(
            "space-y-2 rounded-md border border-bulk/35 bg-bulk/12 p-3 text-foreground",
            "dark:border-bulk/40 dark:bg-bulk/15",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
              {bulkProgress}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={!bulkChecking}
              title="Detiene la cola tras el enlace actual (o entre enlaces)"
              onClick={() => {
                bulkAbortRef.current?.abort();
              }}
            >
              Cancelar
            </Button>
          </div>
          {bulkTotal > 0 ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-bulk transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, Math.round((bulkCompleted / bulkTotal) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {bulkCompleted}/{bulkTotal} pasos completados
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {banner ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2",
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
          )}
          role="status"
        >
          <p className="min-w-0 flex-1 leading-snug">{banner.text}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-8 shrink-0 text-current hover:bg-black/10 dark:hover:bg-white/10",
              banner.type === "ok" &&
                "hover:text-emerald-950 dark:hover:text-emerald-50",
              banner.type === "err" &&
                "hover:text-red-950 dark:hover:text-red-50",
            )}
            aria-label="Cerrar mensaje"
            onClick={() => {
              setBanner(null);
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {isAdmin
            ? "Aún no hay datos. Use “Sincronizar desde CRT” para poblar la lista."
            : "No hay compañías habilitadas para monitoreo."}
        </p>
      ) : (
        <div className="space-y-4" inert={bulkChecking ? true : undefined}>
          <div
            ref={filtersPanelRef}
            className="relative flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <label htmlFor="company-search" className="sr-only">
                Buscar por compañía o URL
              </label>
              <input
                id="company-search"
                type="search"
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applySearch();
                  }
                }}
                placeholder="Buscar compañía o URL…"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xl dark:bg-zinc-950"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => {
                  applySearch();
                }}
              >
                <Search className="mr-1.5 size-4" aria-hidden />
                Buscar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={clearSearch}
                disabled={searchDraft === "" && searchQuery === ""}
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only sm:ms-1.5">
                  Limpiar
                </span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
              <Button
                type="button"
                variant="bulk"
                size="sm"
                className="h-9 shrink-0 gap-1.5 font-semibold"
                disabled={
                  bulkChecking ||
                  pendingCheck !== null ||
                  selectedVerifiableCount === 0
                }
                title={
                  selectedVerifiableCount === 0
                    ? "Seleccione enlaces con verificación automática y compañía visible"
                    : "Ejecuta la verificación automática en cada enlace seleccionado, uno tras otro"
                }
                onClick={() => {
                  void runBulkCheck();
                }}
              >
                {bulkChecking ? (
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : null}
                Verificar seleccionadas
                {selectedVerifiableCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="h-5 min-w-5 justify-center border-bulk-foreground/35 bg-bulk-foreground/15 px-1.5 text-[10px] text-bulk-foreground"
                  >
                    {selectedVerifiableCount}
                  </Badge>
                ) : null}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {displayRows.length}/{rows.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                title="Filtros, columnas visibles y orden (también puede pulsar los títulos de la tabla)"
                aria-expanded={filtersOpen}
                aria-controls="companies-filters-panel"
                onClick={() => {
                  setFiltersOpen((o) => !o);
                }}
              >
                <ListFilter className="size-4 shrink-0" aria-hidden />
                Filtros / columnas / orden
                {activeChipsCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                  >
                    {activeChipsCount}
                  </Badge>
                ) : null}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform",
                    filtersOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </Button>
            </div>

            {filtersOpen ? (
              <div
                id="companies-filters-panel"
                className="absolute end-0 top-full z-30 mt-1 w-full max-w-md rounded-lg border border-border bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:w-80"
                role="region"
                aria-label="Filtros, columnas y orden de la tabla"
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">
                    Ordenar:
                  </strong>{" "}
                  use los botones de «Ordenar por columna» abajo o pulse
                  directamente el encabezado de la columna en la tabla (icono{" "}
                  <ArrowUpDown
                    className="inline size-3 align-text-bottom opacity-60"
                    aria-hidden
                  />
                  ). Dos clics seguidos en el mismo criterio invierten el orden.
                </p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Filtros
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        Auto
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={filterChip(autoFilter === "all")}
                          onClick={() => {
                            setAutoFilter("all");
                          }}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className={filterChip(autoFilter === "yes")}
                          onClick={() => {
                            setAutoFilter("yes");
                          }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className={filterChip(autoFilter === "in-review")}
                          onClick={() => {
                            setAutoFilter("in-review");
                          }}
                        >
                          En revisión
                        </button>
                        <button
                          type="button"
                          className={filterChip(autoFilter === "pending")}
                          onClick={() => {
                            setAutoFilter("pending");
                          }}
                        >
                          Pendiente
                        </button>
                        <button
                          type="button"
                          className={filterChip(autoFilter === "no")}
                          onClick={() => {
                            setAutoFilter("no");
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        Líneas
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={filterChip(linesFilter === "all")}
                          onClick={() => {
                            setLinesFilter("all");
                          }}
                        >
                          Todas
                        </button>
                        <button
                          type="button"
                          className={filterChip(linesFilter === "yes")}
                          onClick={() => {
                            setLinesFilter("yes");
                          }}
                        >
                          Con
                        </button>
                        <button
                          type="button"
                          className={filterChip(linesFilter === "no")}
                          onClick={() => {
                            setLinesFilter("no");
                          }}
                        >
                          Sin
                        </button>
                        <button
                          type="button"
                          className={filterChip(linesFilter === "unknown")}
                          onClick={() => {
                            setLinesFilter("unknown");
                          }}
                        >
                          ?
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        Revisado
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={filterChip(reviewedFilter === "all")}
                          onClick={() => {
                            setReviewedFilter("all");
                          }}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className={filterChip(reviewedFilter === "yes")}
                          onClick={() => {
                            setReviewedFilter("yes");
                          }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className={filterChip(reviewedFilter === "no")}
                          onClick={() => {
                            setReviewedFilter("no");
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        Manual
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={filterChip(manualFilter === "all")}
                          onClick={() => {
                            setManualFilter("all");
                          }}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className={filterChip(manualFilter === "yes")}
                          onClick={() => {
                            setManualFilter("yes");
                          }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className={filterChip(manualFilter === "no")}
                          onClick={() => {
                            setManualFilter("no");
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        Error
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={filterChip(errorFilter === "all")}
                          onClick={() => {
                            setErrorFilter("all");
                          }}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className={filterChip(errorFilter === "yes")}
                          onClick={() => {
                            setErrorFilter("yes");
                          }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className={filterChip(errorFilter === "no")}
                          onClick={() => {
                            setErrorFilter("no");
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <span className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Columns2 className="size-3.5 shrink-0" aria-hidden />
                      Columnas
                    </span>
                    <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                      La columna URL está oculta por defecto; actívela aquí si
                      necesita copiar o revisar la dirección completa.
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3">
                      {ALL_DATA_COLUMNS.filter(
                        (id) => !(id === "enabled" && !isAdmin),
                      ).map((id) => {
                        const locked = id === "company";
                        const checked = columnVisibility[id];
                        return (
                          <label
                            key={id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-1 py-0.5 text-xs hover:bg-muted/50",
                              locked && "cursor-not-allowed opacity-80",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 shrink-0 rounded border border-input accent-primary disabled:opacity-50"
                              checked={checked}
                              disabled={locked}
                              onChange={() => {
                                if (locked) return;
                                setColumnVisibility((prev) => ({
                                  ...prev,
                                  [id]: !prev[id],
                                }));
                              }}
                              aria-label={
                                locked
                                  ? `${COLUMN_LABEL[id]} (columna fija, siempre visible)`
                                  : `Mostrar columna ${COLUMN_LABEL[id]}`
                              }
                            />
                            <span className="min-w-0 truncate">
                              {COLUMN_LABEL[id]}
                            </span>
                            {locked ? (
                              <span className="sr-only">Columna fija</span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 w-full text-xs"
                      onClick={() => {
                        setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY });
                      }}
                    >
                      Restablecer columnas (predeterminado)
                    </Button>
                  </div>

                  <div className="border-t border-border pt-3">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ordenar por columna
                    </span>
                    <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                      Equivale a pulsar el título de la columna en la tabla.
                      Mismo botón otra vez: invierte ↑/↓.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: "company" as const, label: "Compañía" },
                          { key: "auto" as const, label: "Auto" },
                          { key: "lines" as const, label: "Líneas" },
                          { key: "reviewed" as const, label: "Revisado" },
                          { key: "manual" as const, label: "Manual" },
                          {
                            key: "reviewedAt" as const,
                            label: "Última revisión",
                          },
                          { key: "verifyErr" as const, label: "Error" },
                        ] as const
                      ).map(({ key, label }) => (
                        <Button
                          key={key}
                          type="button"
                          variant={sortKey === key ? "secondary" : "outline"}
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          title={
                            sortKey === key
                              ? getSortTooltip(key, sortDir)
                              : `Ordenar por ${label} (primer clic: ascendente)`
                          }
                          onClick={() => {
                            onSortClick(key);
                          }}
                        >
                          {label}
                          {sortKey === key ? (
                            sortDir === "asc" ? (
                              <ArrowUp
                                className="size-3.5 shrink-0 opacity-90"
                                aria-hidden
                              />
                            ) : (
                              <ArrowDown
                                className="size-3.5 shrink-0 opacity-90"
                                aria-hidden
                              />
                            )
                          ) : null}
                        </Button>
                      ))}
                    </div>
                    <span className="mb-2 mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Orden original
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant={
                          sortKey === "default" ? "secondary" : "outline"
                        }
                        size="sm"
                        className="h-8 text-xs"
                        title="Volver al orden en que llegó la lista desde el CRT"
                        onClick={() => {
                          onSortClick("default");
                        }}
                      >
                        Orden lista (CRT)
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      clearFiltersAndSort();
                    }}
                  >
                    Restablecer todo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => {
                      setFiltersOpen(false);
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {displayRows.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Ningún enlace coincide con los filtros o la búsqueda. Ajuste los
              criterios o pulse «Restablecer todo» en el panel de filtros.
            </p>
          ) : (
            <div
              className={cn(
                "max-h-[min(75vh,56rem)] w-full overflow-auto rounded-lg border border-zinc-200 bg-white",
                "dark:border-zinc-800 dark:bg-zinc-900",
              )}
            >
              <Table className="w-full table-fixed border-collapse text-xs">
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className={cn(stickyHeadCell, "text-center align-middle")}
                    >
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        className="size-4 cursor-pointer rounded border border-input bg-background accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                        checked={
                          allSelectableVisibleSelected &&
                          selectableDisplayRows.length > 0
                        }
                        disabled={
                          bulkChecking ||
                          pendingCheck !== null ||
                          selectableDisplayRows.length === 0
                        }
                        onChange={() => {
                          toggleSelectAllVisible();
                        }}
                        aria-label="Seleccionar o quitar todos los enlaces verificables visibles en la tabla"
                        title="Solo enlaces con verificación automática y compañía habilitada"
                      />
                    </TableHead>
                    {showCol("num") ? (
                      <TableHead className={cn(stickyHeadCell)}>#</TableHead>
                    ) : null}
                    {showCol("company") ? (
                      <SortableTableHead
                        columnKey="company"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                      >
                        Compañía
                      </SortableTableHead>
                    ) : null}
                    {isAdmin && showCol("enabled") ? (
                      <TableHead className={cn(stickyHeadCell)}>
                        Visible
                      </TableHead>
                    ) : null}
                    {showCol("auto") ? (
                      <SortableTableHead
                        columnKey="auto"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                        title="Este enlace admite verificación automatizada"
                        align="center"
                      >
                        Auto
                      </SortableTableHead>
                    ) : null}
                    {showCol("site") ? (
                      <TableHead className={cn(stickyHeadCell)}>
                        Sitio
                      </TableHead>
                    ) : null}
                    {showCol("url") ? (
                      <TableHead className={cn(stickyHeadCell)}>URL</TableHead>
                    ) : null}
                    {showCol("lines") ? (
                      <SortableTableHead
                        columnKey="lines"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                        align="center"
                      >
                        Líneas
                      </SortableTableHead>
                    ) : null}
                    {showCol("reviewed") ? (
                      <SortableTableHead
                        columnKey="reviewed"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                        align="center"
                      >
                        Revisado
                      </SortableTableHead>
                    ) : null}
                    {showCol("manual") ? (
                      <SortableTableHead
                        columnKey="manual"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                        align="center"
                      >
                        Manual
                      </SortableTableHead>
                    ) : null}
                    {showCol("reviewedAt") ? (
                      <SortableTableHead
                        columnKey="reviewedAt"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                      >
                        Última revisión
                      </SortableTableHead>
                    ) : null}
                    {showCol("screenshot") ? (
                      <TableHead className={cn(stickyHeadCell)}>
                        Captura
                      </TableHead>
                    ) : null}
                    {showCol("actions") ? (
                      <TableHead className={cn(stickyHeadCell)}>
                        Acciones
                      </TableHead>
                    ) : null}
                    {showCol("verifyErr") ? (
                      <SortableTableHead
                        columnKey="verifyErr"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSortClick}
                        className={stickyHeadCell}
                        align="center"
                        title="Último fallo de verificación automática (individual o masiva)"
                      >
                        Error
                      </SortableTableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((r, rowIdx) => {
                    const canSelect =
                      r.enabled && r.verificationStatus === "yes";
                    const isSelected = selectedLinkIds.has(r.linkId);
                    return (
                      <TableRow key={r.linkId}>
                        <TableCell className="text-center align-middle">
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer rounded border border-input bg-background accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                            checked={isSelected}
                            disabled={
                              bulkChecking ||
                              pendingCheck !== null ||
                              !canSelect
                            }
                            onChange={() => {
                              toggleRowSelected(r.linkId, canSelect);
                            }}
                            aria-label={`Seleccionar ${r.companyName} (${r.url}) para verificación masiva`}
                            title={
                              !r.enabled
                                ? "Compañía deshabilitada"
                                : r.verificationStatus !== "yes"
                                  ? "Sin verificación automática en este enlace"
                                  : undefined
                            }
                          />
                        </TableCell>
                        {showCol("num") ? (
                          <TableCell className="font-mono text-muted-foreground">
                            {rowIdx + 1}
                          </TableCell>
                        ) : null}
                        {showCol("company") ? (
                          <TableCell
                            className="truncate font-medium"
                            title={r.companyName}
                          >
                            {r.companyName}
                          </TableCell>
                        ) : null}
                        {isAdmin && showCol("enabled") ? (
                          <TableCell>
                            <div className="flex justify-center">
                              <Switch
                                checked={
                                  enabledByCompany.get(r.companyId) ?? r.enabled
                                }
                                disabled={
                                  bulkChecking || pendingToggle === r.companyId
                                }
                                onCheckedChange={(checked) => {
                                  void toggleCompany(r.companyId, checked);
                                }}
                                aria-label={`Mostrar ${r.companyName} en monitoreo`}
                              />
                            </div>
                          </TableCell>
                        ) : null}
                        {showCol("auto") ? (
                          <TableCell className="whitespace-nowrap text-center align-middle">
                            {r.verificationStatus === "yes" ? (
                              <span
                                className="inline-flex h-5 items-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-medium leading-none text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                                title="Hay verificación automatizada; «Verificar» consulta el portal"
                              >
                                Sí
                              </span>
                            ) : r.verificationStatus === "in-review" ? (
                              <span
                                className="inline-flex h-5 items-center rounded-full bg-blue-100 px-1.5 text-[11px] font-medium leading-none text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                title="Protocolo escrito, en revisión y pruebas"
                              >
                                En revisión
                              </span>
                            ) : r.verificationStatus === "pending" ? (
                              <span
                                className="inline-flex h-5 items-center rounded-full bg-amber-100 px-1.5 text-[11px] font-medium leading-none text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                title="El portal aún no cuenta con un flujo de verificación automatizable"
                              >
                                Pendiente
                              </span>
                            ) : (
                              <span
                                className="inline-flex h-5 items-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                title="Sin protocolo automatizado; use el ajuste manual de líneas"
                              >
                                No
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                        {showCol("site") ? (
                          <TableCell className="text-center">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              title={r.url}
                              aria-label={`Abrir en nueva pestaña: ${r.url}`}
                              className={buttonVariants({
                                variant: "outline",
                                size: "icon",
                                className: "size-8",
                              })}
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                            </a>
                          </TableCell>
                        ) : null}
                        {showCol("url") ? (
                          <TableCell className="min-w-0 overflow-hidden">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              title={r.url}
                              className="block truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
                            >
                              {r.url}
                            </a>
                          </TableCell>
                        ) : null}
                        {showCol("lines") ? (
                          <TableCell className="whitespace-normal align-top">
                            <div className="flex min-w-0 flex-col gap-1">
                              <LinesStatusBadge
                                hasActiveLines={r.hasActiveLines}
                                className="max-w-full justify-center"
                              />
                              <select
                                disabled={bulkChecking}
                                className="h-8 w-full min-w-0 rounded-md border border-border bg-background px-1.5 text-xs dark:bg-zinc-950"
                                value={
                                  r.hasActiveLines === null
                                    ? "unknown"
                                    : r.hasActiveLines
                                      ? "yes"
                                      : "no"
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const next =
                                    v === "unknown"
                                      ? null
                                      : v === "yes"
                                        ? true
                                        : false;
                                  void patchLineStatus(r.linkId, next, true);
                                }}
                              >
                                <option value="unknown">
                                  Ajustar: desconocido
                                </option>
                                <option value="yes">Ajustar: con líneas</option>
                                <option value="no">Ajustar: sin líneas</option>
                              </select>
                            </div>
                          </TableCell>
                        ) : null}
                        {showCol("reviewed") ? (
                          <TableCell className="whitespace-nowrap text-center">
                            <ReviewedBadge
                              reviewed={r.isReviewed}
                              className="justify-center"
                            />
                          </TableCell>
                        ) : null}
                        {showCol("manual") ? (
                          <TableCell className="text-center">
                            <ManualBadge
                              manual={r.isManualReview}
                              className="justify-center"
                            />
                          </TableCell>
                        ) : null}
                        {showCol("reviewedAt") ? (
                          <TableCell
                            className="whitespace-normal font-medium text-foreground tabular-nums"
                            title={
                              r.lastReviewedAt
                                ? new Date(r.lastReviewedAt).toLocaleString(
                                    "es-MX",
                                  )
                                : undefined
                            }
                          >
                            <span suppressHydrationWarning>
                              {r.lastReviewedAt
                                ? formatReviewedAt(r.lastReviewedAt)
                                : "—"}
                            </span>
                          </TableCell>
                        ) : null}
                        {showCol("screenshot") ? (
                          <TableCell className="p-1 align-middle">
                            {r.reviewScreenshotAt ? (
                              <button
                                type="button"
                                title="Ver captura de verificación en grande"
                                aria-label="Ver captura de verificación en grande"
                                className="group relative block w-full cursor-pointer overflow-hidden rounded-sm border border-border bg-muted/40 transition hover:border-primary hover:ring-1 hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                onClick={() => {
                                  setPreviewLinkId(r.linkId);
                                  setPreviewScreenshotCacheKey(
                                    r.reviewScreenshotAt ?? "",
                                  );
                                }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin API + cookies */}
                                <img
                                  src={`/api/company-links/${r.linkId}/screenshot?v=${encodeURIComponent(r.reviewScreenshotAt ?? "")}`}
                                  alt="Captura de verificación"
                                  width={80}
                                  height={48}
                                  className="block h-9 w-full object-cover object-top transition group-hover:opacity-60"
                                  loading="lazy"
                                />
                                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                    Ver
                                  </span>
                                </span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ) : null}
                        {showCol("actions") ? (
                          <TableCell>
                            <Button
                              className="h-8 shrink-0 px-2.5 text-xs"
                              size="sm"
                              disabled={
                                bulkChecking ||
                                pendingCheck === r.linkId ||
                                !r.enabled ||
                                r.verificationStatus !== "yes"
                              }
                              title={
                                !r.enabled
                                  ? "Compañía deshabilitada para usuarios."
                                  : r.verificationStatus === "in-review"
                                    ? "Protocolo en revisión; aún no habilitado para ejecución automática. Ajuste el estado con el desplegable de líneas activas."
                                    : r.verificationStatus === "pending"
                                      ? "El portal aún no cuenta con un flujo de verificación automatizable. Ajuste el estado con el desplegable de líneas activas."
                                      : r.verificationStatus === "no"
                                        ? "Este portal no tiene protocolo de verificación automatizado. Ajuste el estado con el desplegable de líneas activas."
                                        : undefined
                              }
                              onClick={() => {
                                void runCheck(r.linkId, r.companyName);
                              }}
                            >
                              {pendingCheck === r.linkId ||
                              activeBulkLinkId === r.linkId ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                "Verificar"
                              )}
                            </Button>
                          </TableCell>
                        ) : null}
                        {showCol("verifyErr") ? (
                          <TableCell className="text-center align-middle">
                            {r.lastMonitorErrorMessage ? (
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/45 text-destructive transition hover:bg-destructive/10"
                                title={sanitizeEnvFromUserFacingText(
                                  r.lastMonitorErrorMessage ?? "",
                                )}
                                aria-label="Ver error de la última verificación"
                                onClick={() => {
                                  const msg = sanitizeEnvFromUserFacingText(
                                    r.lastMonitorErrorMessage ?? "",
                                  );
                                  setVerificationErrorModal({
                                    title: `${r.companyName} — error de verificación`,
                                    userMessage: msg,
                                    technicalDetail:
                                      sanitizeEnvFromUserFacingText(
                                        r.lastMonitorErrorDetail ?? "",
                                      ),
                                  });
                                }}
                              >
                                <CircleAlert
                                  className="size-4 shrink-0"
                                  aria-hidden
                                />
                              </button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
      <ReviewScreenshotLightbox
        linkId={previewLinkId}
        cacheKey={previewScreenshotCacheKey ?? undefined}
        open={previewLinkId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewLinkId(null);
            setPreviewScreenshotCacheKey(null);
          }
        }}
      />

      {verificationErrorModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-error-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar"
            onClick={() => {
              setVerificationErrorModal(null);
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-background p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="verify-error-title"
                className="text-base font-semibold leading-snug text-foreground"
              >
                {verificationErrorModal.title}
              </h2>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
                onClick={() => {
                  setVerificationErrorModal(null);
                }}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {sanitizeEnvFromUserFacingText(
                verificationErrorModal.userMessage,
              )}
            </p>
            <details className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">
                Detalle técnico (para soporte)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                {(() => {
                  const detail = sanitizeEnvFromUserFacingText(
                    verificationErrorModal.technicalDetail,
                  );
                  return detail.trim() !== ""
                    ? detail
                    : "Sin detalle técnico adicional registrado.";
                })()}
              </pre>
            </details>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setVerificationErrorModal(null);
                }}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
