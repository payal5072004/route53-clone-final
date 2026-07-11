"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { DNSRecordForm } from "@/components/records/DNSRecordForm";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { HostedZone, RecordType } from "@/lib/types";

export default function CreateRecordPage() {
  const params = useParams<{ id: string }>();
  const zoneId = params.id;
  const router = useRouter();
  const { notify } = useToast();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchZone = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<HostedZone>(`/api/hosted-zones/${zoneId}`);
      setZone(res.data);
    } catch {
      notify("Failed to load hosted zone", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  useEffect(() => {
    fetchZone();
  }, [fetchZone]);

  const goBackToZone = () => router.push(`/hosted-zones/${zoneId}`);

  const handleCreate = async (form: {
    name: string;
    record_type: RecordType;
    value: string;
    ttl: number;
    routing_policy: string;
  }) => {
    await api.post(`/api/hosted-zones/${zoneId}/records`, form);
    notify(`Record "${form.name}" (${form.record_type}) created`);
    goBackToZone();
  };

  return (
    <AppShell>
      <PageHeader
        breadcrumbs={[
          { label: "Route 53" },
          { label: "Hosted zones", href: "/hosted-zones" },
          { label: zone?.domain_name ?? "...", href: `/hosted-zones/${zoneId}` },
          { label: "Create record" },
        ]}
        title="Create record"
      />

      <div className="p-6">
        {loading || !zone ? (
          <div className="py-16 text-center text-sm text-[var(--aws-text-secondary)]">
            Loading...
          </div>
        ) : (
          <DNSRecordForm domainSuffix={zone.domain_name} onCancel={goBackToZone} onSubmit={handleCreate} />
        )}
      </div>
    </AppShell>
  );
}
