"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { DNSRecordForm } from "@/components/records/DNSRecordForm";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DNSRecord, HostedZone, RecordType } from "@/lib/types";

export default function EditRecordPage() {
  const params = useParams<{ id: string; recordId: string }>();
  const zoneId = params.id;
  const recordId = params.recordId;
  const router = useRouter();
  const { notify } = useToast();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [record, setRecord] = useState<DNSRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [zoneRes, recordRes] = await Promise.all([
        api.get<HostedZone>(`/api/hosted-zones/${zoneId}`),
        api.get<DNSRecord>(`/api/hosted-zones/${zoneId}/records/${recordId}`),
      ]);
      setZone(zoneRes.data);
      setRecord(recordRes.data);
    } catch {
      notify("Failed to load record", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, recordId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goBackToZone = () => router.push(`/hosted-zones/${zoneId}`);

  const handleEdit = async (form: {
    name: string;
    record_type: RecordType;
    value: string;
    ttl: number;
    routing_policy: string;
  }) => {
    await api.put(`/api/hosted-zones/${zoneId}/records/${recordId}`, form);
    notify(`Record "${form.name}" updated`);
    goBackToZone();
  };

  return (
    <AppShell>
      <PageHeader
        breadcrumbs={[
          { label: "Route 53" },
          { label: "Hosted zones", href: "/hosted-zones" },
          { label: zone?.domain_name ?? "...", href: `/hosted-zones/${zoneId}` },
          { label: "Edit record" },
        ]}
        title="Edit record"
      />

      <div className="p-6">
        {loading || !zone || !record ? (
          <div className="py-16 text-center text-sm text-[var(--aws-text-secondary)]">
            Loading...
          </div>
        ) : (
          <DNSRecordForm
            domainSuffix={zone.domain_name}
            record={record}
            onCancel={goBackToZone}
            onSubmit={handleEdit}
          />
        )}
      </div>
    </AppShell>
  );
}
