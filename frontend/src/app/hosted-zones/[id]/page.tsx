"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RefreshCw, Copy, Upload, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RecordTypeBadge, ZoneTypeBadge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ImportBindModal } from "@/components/records/ImportBindModal";
import { BulkTTLModal } from "@/components/records/BulkTTLModal";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { useCreateShortcut } from "@/lib/shortcuts-context";
import { downloadBlob } from "@/lib/download";
import { DNSRecord, HostedZone, Paginated, RECORD_TYPES, RecordType } from "@/lib/types";

const PAGE_SIZE = 10;

export default function HostedZoneDetailPage() {
  const params = useParams<{ id: string }>();
  const zoneId = params.id;
  const router = useRouter();
  const { notify } = useToast();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [data, setData] = useState<Paginated<DNSRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RecordType | "">("");
  const [page, setPage] = useState(1);

  const [deleteRecord, setDeleteRecord] = useState<DNSRecord | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkTTLOpen, setBulkTTLOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const goToCreateRecord = useCallback(() => {
    router.push(`/hosted-zones/${zoneId}/records/create`);
  }, [router, zoneId]);

  useCreateShortcut(goToCreateRecord);

  const fetchZone = useCallback(async () => {
    try {
      const res = await api.get<HostedZone>(`/api/hosted-zones/${zoneId}`);
      setZone(res.data);
    } catch {
      notify("Failed to load hosted zone", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<DNSRecord>>(`/api/hosted-zones/${zoneId}/records`, {
        params: {
          search: search || undefined,
          record_type: typeFilter || undefined,
          page,
          page_size: PAGE_SIZE,
        },
      });
      setData(res.data);
    } catch {
      notify("Failed to load records", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, search, typeFilter, page]);

  useEffect(() => {
    fetchZone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchRecords, 250);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  useEffect(() => {
    setSelected(new Set());
  }, [data?.page, search, typeFilter]);

  const refreshAll = () => {
    fetchZone();
    fetchRecords();
  };

  const allOnPageSelected = useMemo(
    () => !!data && data.items.length > 0 && data.items.every((r) => selected.has(r.id)),
    [data, selected]
  );

  const toggleAll = () => {
    if (!data) return;
    setSelected(allOnPageSelected ? new Set() : new Set(data.items.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;
    try {
      await api.delete(`/api/hosted-zones/${zoneId}/records/${deleteRecord.id}`);
      notify(`Record "${deleteRecord.name}" deleted`);
      setDeleteRecord(null);
      refreshAll();
    } catch {
      notify("Failed to delete record", "error");
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await api.post(`/api/hosted-zones/${zoneId}/records/bulk-delete`, {
        ids: Array.from(selected),
      });
      notify(`Deleted ${res.data.deleted} record(s)`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      refreshAll();
    } catch {
      notify("Bulk delete failed", "error");
    }
  };

  const handleBulkTTL = async (ttl: number) => {
    try {
      const res = await api.post(`/api/hosted-zones/${zoneId}/records/bulk-update-ttl`, {
        ids: Array.from(selected),
        ttl,
      });
      notify(`Updated TTL for ${res.data.updated} record(s)`);
      setBulkTTLOpen(false);
      setSelected(new Set());
      refreshAll();
    } catch {
      notify("Bulk TTL update failed", "error");
    }
  };

  const exportZone = async (format: "json" | "bind") => {
    if (!zone) return;
    try {
      const res = await api.get(`/api/hosted-zones/${zoneId}/export`, {
        params: { format },
        responseType: "blob",
      });
      const ext = format === "json" ? "json" : "zone";
      downloadBlob(
        res.data,
        `${zone.domain_name}.${ext}`,
        format === "json" ? "application/json" : "text/dns"
      );
      notify(`Exported "${zone.domain_name}" as ${format.toUpperCase()}`);
    } catch {
      notify("Export failed", "error");
    }
  };

  const exportSelected = async (format: "json" | "bind") => {
    try {
      const res = await api.get(`/api/hosted-zones/${zoneId}/records/export`, {
        params: { format, ids: Array.from(selected).join(",") },
        responseType: "blob",
      });
      const ext = format === "json" ? "json" : "zone";
      downloadBlob(
        res.data,
        `${zone?.domain_name ?? "records"}-selected.${ext}`,
        format === "json" ? "application/json" : "text/dns"
      );
      notify(`Exported ${selected.size} record(s)`);
    } catch {
      notify("Export failed", "error");
    }
  };

  return (
    <AppShell>
      <PageHeader
        breadcrumbs={[
          { label: "Route 53" },
          { label: "Hosted zones", href: "/hosted-zones" },
          { label: zone?.domain_name ?? "..." },
        ]}
        title={zone?.domain_name ?? "Loading..."}
        description={zone?.comment || undefined}
        actions={
          zone && (
            <>
              <ZoneTypeBadge type={zone.zone_type as "Public" | "Private"} />
              <Button variant="secondary" size="sm" onClick={refreshAll}>
                <RefreshCw size={14} />
              </Button>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <Upload size={15} /> Import
              </Button>
              <ExportMenu label="Export zone" onExport={exportZone} />
              <Button variant="primary" onClick={goToCreateRecord}>
                <Plus size={15} /> Create record
              </Button>
            </>
          )
        }
      />

      <div className="p-6">
        <div className="bg-[var(--aws-surface)] border border-[var(--aws-border)] rounded">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--aws-border)] gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <SearchInput value={search} onChange={setSearch} placeholder="Search records by name or value" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as RecordType | "")}
                className="border border-[var(--aws-border)] rounded px-2.5 py-1.5 text-sm bg-[var(--aws-surface)] outline-none focus:border-[var(--aws-blue)]"
              >
                <option value="">All types</option>
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-sm text-[var(--aws-text-secondary)]">
              {data ? `${data.total} record${data.total === 1 ? "" : "s"}` : ""}
            </span>
          </div>

          <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="secondary" size="sm" onClick={() => setBulkTTLOpen(true)}>
              <Clock size={13} /> Change TTL
            </Button>
            <ExportMenu label="Export selected" size="sm" onExport={exportSelected} />
            <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 size={13} /> Delete selected
            </Button>
          </BulkActionBar>

          {loading ? (
            <div className="py-16 text-center text-sm text-[var(--aws-text-secondary)]">
              Loading records...
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="No records"
              description={
                search || typeFilter
                  ? "No records match your search or filter."
                  : "This hosted zone doesn't have any custom records yet."
              }
              action={
                !search && !typeFilter && (
                  <Button variant="primary" onClick={goToCreateRecord}>
                    <Plus size={15} /> Create record
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--aws-text-secondary)] border-b border-[var(--aws-border)] bg-[var(--aws-surface-alt)]">
                    <th className="px-4 py-2.5 w-10">
                      <Checkbox checked={allOnPageSelected} onChange={toggleAll} />
                    </th>
                    <th className="px-4 py-2.5 font-medium">Record name</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Value</th>
                    <th className="px-4 py-2.5 font-medium">TTL</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((rec) => (
                    <tr
                      key={rec.id}
                      className="border-b border-[var(--aws-border)] last:border-0 hover:bg-[var(--aws-surface-alt)] align-top transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Checkbox checked={selected.has(rec.id)} onChange={() => toggleOne(rec.id)} />
                      </td>
                      <td className="px-4 py-3 font-mono">{rec.name}</td>
                      <td className="px-4 py-3">
                        <RecordTypeBadge type={rec.record_type} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-pre-wrap max-w-md text-[var(--aws-text)]">
                        {rec.value}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{rec.ttl}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => navigator.clipboard.writeText(rec.value)}
                            aria-label="Copy value"
                            className="p-1.5 rounded hover:bg-[var(--aws-surface-alt)] text-[var(--aws-text-secondary)] hover:text-[var(--aws-blue)]"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={() => router.push(`/hosted-zones/${zoneId}/records/${rec.id}/edit`)}
                            aria-label="Edit"
                            className="p-1.5 rounded hover:bg-[var(--aws-surface-alt)] text-[var(--aws-text-secondary)] hover:text-[var(--aws-blue)]"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteRecord(rec)}
                            aria-label="Delete"
                            className="p-1.5 rounded hover:bg-[var(--aws-surface-alt)] text-[var(--aws-text-secondary)] hover:text-[var(--aws-red)]"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > 0 && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          )}
        </div>
      </div>

      {deleteRecord && (
        <ConfirmDialog
          title="Delete record"
          message={
            <>
              Are you sure you want to delete the{" "}
              <span className="font-mono font-semibold">{deleteRecord.record_type}</span> record{" "}
              <span className="font-mono font-semibold">{deleteRecord.name}</span>? This action
              cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteRecord(null)}
        />
      )}
      {bulkDeleteOpen && (
        <ConfirmDialog
          title="Delete records"
          message={
            <>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selected.size}</span> record
              {selected.size === 1 ? "" : "s"}? This action cannot be undone.
            </>
          }
          confirmLabel="Delete all"
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}
      {bulkTTLOpen && (
        <BulkTTLModal count={selected.size} onClose={() => setBulkTTLOpen(false)} onSubmit={handleBulkTTL} />
      )}
      {showImport && (
        <ImportBindModal
          zoneId={zoneId}
          onClose={() => setShowImport(false)}
          onImported={refreshAll}
        />
      )}
    </AppShell>
  );
}
