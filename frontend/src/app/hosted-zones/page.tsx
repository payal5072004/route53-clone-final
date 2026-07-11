"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Globe, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ZoneTypeBadge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { HostedZoneFormModal } from "@/components/zones/HostedZoneFormModal";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { useCreateShortcut } from "@/lib/shortcuts-context";
import { downloadBlob } from "@/lib/download";
import { HostedZone, Paginated } from "@/lib/types";

const PAGE_SIZE = 10;

export default function HostedZonesPage() {
  const { notify } = useToast();
  const [data, setData] = useState<Paginated<HostedZone> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editZone, setEditZone] = useState<HostedZone | null>(null);
  const [deleteZone, setDeleteZone] = useState<HostedZone | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useCreateShortcut(useCallback(() => setShowCreate(true), []));

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<HostedZone>>("/api/hosted-zones", {
        params: { search: search || undefined, page, page_size: PAGE_SIZE },
      });
      setData(res.data);
    } catch {
      notify("Failed to load hosted zones", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchZones, 250);
    return () => clearTimeout(t);
  }, [fetchZones]);

  useEffect(() => {
    setSelected(new Set());
  }, [data?.page, search]);

  const allOnPageSelected = useMemo(
    () => !!data && data.items.length > 0 && data.items.every((z) => selected.has(z.id)),
    [data, selected]
  );

  const toggleAll = () => {
    if (!data) return;
    setSelected((prev) => {
      if (allOnPageSelected) return new Set();
      return new Set(data.items.map((z) => z.id));
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (form: { domain_name: string; comment: string; zone_type: "Public" | "Private" }) => {
    await api.post("/api/hosted-zones", form);
    setShowCreate(false);
    notify(`Hosted zone "${form.domain_name}" created`);
    fetchZones();
  };

  const handleEdit = async (form: { domain_name: string; comment: string; zone_type: "Public" | "Private" }) => {
    if (!editZone) return;
    await api.put(`/api/hosted-zones/${editZone.id}`, {
      comment: form.comment,
      zone_type: form.zone_type,
    });
    setEditZone(null);
    notify(`Hosted zone "${editZone.domain_name}" updated`);
    fetchZones();
  };

  const handleDelete = async () => {
    if (!deleteZone) return;
    try {
      await api.delete(`/api/hosted-zones/${deleteZone.id}`);
      notify(`Hosted zone "${deleteZone.domain_name}" deleted`);
      setDeleteZone(null);
      fetchZones();
    } catch {
      notify("Failed to delete hosted zone", "error");
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await api.post("/api/hosted-zones/bulk-delete", { ids: Array.from(selected) });
      notify(`Deleted ${res.data.deleted} hosted zone(s)`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      fetchZones();
    } catch {
      notify("Bulk delete failed", "error");
    }
  };

  const exportZone = async (zone: HostedZone, format: "json" | "bind") => {
    try {
      const res = await api.get(`/api/hosted-zones/${zone.id}/export`, {
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
    if (!data) return;
    const zonesToExport = data.items.filter((z) => selected.has(z.id));
    try {
      if (format === "bind") {
        const parts = await Promise.all(
          zonesToExport.map((z) =>
            api
              .get(`/api/hosted-zones/${z.id}/export`, { params: { format: "bind" } })
              .then((r) => r.data as string)
          )
        );
        downloadBlob(parts.join("\n\n"), "hosted-zones-export.zone", "text/dns");
      } else {
        const parts = await Promise.all(
          zonesToExport.map((z) =>
            api.get(`/api/hosted-zones/${z.id}/export`, { params: { format: "json" } }).then((r) => r.data)
          )
        );
        downloadBlob(JSON.stringify(parts, null, 2), "hosted-zones-export.json", "application/json");
      }
      notify(`Exported ${zonesToExport.length} hosted zone(s)`);
    } catch {
      notify("Bulk export failed", "error");
    }
  };

  return (
    <AppShell>
      <PageHeader
        breadcrumbs={[{ label: "Route 53" }, { label: "Hosted zones" }]}
        title="Hosted zones"
        description="A hosted zone is a container for records, which include information about how you want to route traffic for a domain."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={fetchZones}>
              <RefreshCw size={14} />
            </Button>
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> Create hosted zone
            </Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-[var(--aws-surface)] border border-[var(--aws-border)] rounded">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--aws-border)]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search hosted zones by domain name"
            />
            <span className="text-sm text-[var(--aws-text-secondary)]">
              {data ? `${data.total} hosted zone${data.total === 1 ? "" : "s"}` : ""}
            </span>
          </div>

          <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <ExportMenu label="Export selected" size="sm" onExport={exportSelected} />
            <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 size={13} /> Delete selected
            </Button>
          </BulkActionBar>

          {loading ? (
            <div className="py-16 text-center text-sm text-[var(--aws-text-secondary)]">
              Loading hosted zones...
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="No hosted zones"
              description={
                search
                  ? `No hosted zones match "${search}".`
                  : "You don't have any hosted zones yet. Create one to start managing DNS records."
              }
              action={
                !search && (
                  <Button variant="primary" onClick={() => setShowCreate(true)}>
                    <Plus size={15} /> Create hosted zone
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
                    <th className="px-4 py-2.5 font-medium">Domain name</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Record count</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((zone) => (
                    <tr
                      key={zone.id}
                      className="border-b border-[var(--aws-border)] last:border-0 hover:bg-[var(--aws-surface-alt)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Checkbox checked={selected.has(zone.id)} onChange={() => toggleOne(zone.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/hosted-zones/${zone.id}`}
                          className="flex items-center gap-2 text-[var(--aws-blue)] hover:underline font-medium"
                        >
                          <Globe size={14} className="shrink-0" />
                          {zone.domain_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <ZoneTypeBadge type={zone.zone_type as "Public" | "Private"} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">{zone.record_count}</td>
                      <td className="px-4 py-3 text-[var(--aws-text-secondary)] max-w-xs truncate">
                        {zone.comment || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-1">
                          <ExportMenu size="sm" onExport={(fmt) => exportZone(zone, fmt)} />
                          <button
                            onClick={() => setEditZone(zone)}
                            aria-label="Edit"
                            className="p-1.5 rounded hover:bg-[var(--aws-surface-alt)] text-[var(--aws-text-secondary)] hover:text-[var(--aws-blue)]"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteZone(zone)}
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

      {showCreate && (
        <HostedZoneFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
      {editZone && (
        <HostedZoneFormModal
          zone={editZone}
          onClose={() => setEditZone(null)}
          onSubmit={handleEdit}
        />
      )}
      {deleteZone && (
        <ConfirmDialog
          title="Delete hosted zone"
          message={
            <>
              Are you sure you want to delete{" "}
              <span className="font-mono font-semibold">{deleteZone.domain_name}</span>? This
              will permanently delete the hosted zone and all {deleteZone.record_count} record
              {deleteZone.record_count === 1 ? "" : "s"} inside it. This action cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteZone(null)}
        />
      )}
      {bulkDeleteOpen && (
        <ConfirmDialog
          title="Delete hosted zones"
          message={
            <>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selected.size}</span> hosted zone
              {selected.size === 1 ? "" : "s"}? This will permanently delete each zone and all of
              its records. This action cannot be undone.
            </>
          }
          confirmLabel="Delete all"
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}
    </AppShell>
  );
}
