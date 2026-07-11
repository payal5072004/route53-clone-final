"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DNSRecord, RECORD_TYPES, RecordType } from "@/lib/types";

interface DNSRecordFormProps {
  domainSuffix: string; // the zone's domain name, appended for display help
  record?: DNSRecord | null;
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    record_type: RecordType;
    value: string;
    ttl: number;
    routing_policy: string;
  }) => Promise<void>;
}

const VALUE_HELP: Partial<Record<RecordType, string>> = {
  A: "One IPv4 address per line, e.g. 192.0.2.1",
  AAAA: "One IPv6 address per line, e.g. 2001:db8::1",
  CNAME: "A single hostname, e.g. target.example.com",
  TXT: "One quoted string per line, e.g. \"v=spf1 -all\"",
  MX: "Priority and mail server, e.g. 10 mail.example.com",
  NS: "One name server per line",
  PTR: "The domain name this pointer resolves to",
  SRV: "Priority, weight, port, target, e.g. 10 5 5060 sipserver.example.com",
  CAA: "Flags, tag and value, e.g. 0 issue \"letsencrypt.org\"",
};

const ROUTING_POLICIES = [
  "Simple",
  "Weighted",
  "Latency",
  "Failover",
  "Multivalue answer",
  "Geolocation",
];

// Record types that AWS allows to be created as Alias records.
const ALIAS_ELIGIBLE: RecordType[] = ["A", "AAAA", "CNAME"];

const TTL_PRESETS: { label: string; seconds: number }[] = [
  { label: "1m", seconds: 60 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86400 },
];

// Derive just the subdomain part from a full record name + the zone suffix,
// e.g. ("www.example.com", "example.com") -> "www"; ("example.com", "example.com") -> "".
function subdomainFromFullName(fullName: string, domainSuffix: string): string {
  if (fullName === domainSuffix) return "";
  if (fullName.endsWith(`.${domainSuffix}`)) {
    return fullName.slice(0, -(domainSuffix.length + 1));
  }
  return fullName;
}

/**
 * The DNS record create/edit form. Rendered as a plain panel (no modal
 * chrome) so it can be dropped straight into a full page, matching how AWS
 * Route53 dedicates a whole page to "Create record" / "Edit record" rather
 * than showing a popup.
 */
export function DNSRecordForm({ domainSuffix, record, onCancel, onSubmit }: DNSRecordFormProps) {
  const isEdit = !!record;
  const [subdomain, setSubdomain] = useState(
    record ? subdomainFromFullName(record.name, domainSuffix) : ""
  );
  const [recordType, setRecordType] = useState<RecordType>(record?.record_type ?? "A");
  const [alias, setAlias] = useState(false);
  const [value, setValue] = useState(record?.value ?? "");
  const [ttl, setTtl] = useState(record?.ttl ?? 300);
  const [routingPolicy, setRoutingPolicy] = useState(record?.routing_policy ?? "Simple");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = subdomain.trim() ? `${subdomain.trim()}.${domainSuffix}` : domainSuffix;

  const handleRecordTypeChange = (t: RecordType) => {
    setRecordType(t);
    if (!ALIAS_ELIGIBLE.includes(t)) setAlias(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: fullName,
        record_type: recordType,
        value: value.trim(),
        ttl: Number(ttl),
        routing_policy: routingPolicy,
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[var(--aws-surface)] border border-[var(--aws-border)] rounded">
      <form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--aws-text)] mb-1">
              Record name
            </label>
            <div className="flex items-stretch">
              <input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                disabled={isEdit}
                placeholder="www"
                className="min-w-0 flex-1 border border-[var(--aws-border)] rounded-l px-3 py-2 text-sm outline-none focus:border-[var(--aws-blue)] focus:ring-1 focus:ring-[var(--aws-blue)] disabled:bg-[var(--aws-surface-alt)] font-mono"
              />
              <span className="flex items-center whitespace-nowrap rounded-r border border-l-0 border-[var(--aws-border)] bg-[var(--aws-surface-alt)] px-3 text-sm text-[var(--aws-text-secondary)] font-mono">
                .{domainSuffix}
              </span>
            </div>
            <p className="text-xs text-[var(--aws-text-secondary)] mt-1">
              Keep blank to create a record for the root domain.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--aws-text)] mb-1">
              Record type
            </label>
            <select
              value={recordType}
              onChange={(e) => handleRecordTypeChange(e.target.value as RecordType)}
              disabled={isEdit}
              className="w-full border border-[var(--aws-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--aws-blue)] focus:ring-1 focus:ring-[var(--aws-blue)] bg-[var(--aws-surface)] disabled:bg-[var(--aws-surface-alt)]"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={alias}
              disabled={!ALIAS_ELIGIBLE.includes(recordType)}
              onClick={() => setAlias((a) => !a)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                alias ? "bg-[var(--aws-blue)]" : "bg-[var(--aws-border)]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  alias ? "translate-x-[18px]" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-[var(--aws-text)]">Alias</span>
          </div>
          {!ALIAS_ELIGIBLE.includes(recordType) && (
            <p className="text-xs text-[var(--aws-text-secondary)] mt-1">
              Alias is only available for A, AAAA and CNAME records.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--aws-text)] mb-1">Value</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            placeholder={alias ? "Choose an AWS resource or enter a target, e.g. d123.cloudfront.net" : VALUE_HELP[recordType]}
            className="w-full border border-[var(--aws-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--aws-blue)] focus:ring-1 focus:ring-[var(--aws-blue)] font-mono"
            required
          />
          <p className="text-xs text-[var(--aws-text-secondary)] mt-1">
            {alias ? "Enter the target resource for this alias." : "Enter multiple values on separate lines."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--aws-text)] mb-1">
              TTL (seconds)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={ttl}
                disabled={alias}
                onChange={(e) => setTtl(Number(e.target.value))}
                className="w-28 border border-[var(--aws-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--aws-blue)] focus:ring-1 focus:ring-[var(--aws-blue)] disabled:bg-[var(--aws-surface-alt)]"
              />
              {TTL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={alias}
                  onClick={() => setTtl(p.seconds)}
                  className="px-3 py-2 text-sm border border-[var(--aws-border)] rounded hover:bg-[var(--aws-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--aws-text-secondary)] mt-1">
              {alias ? "Alias records use a fixed TTL." : "Recommended values: 60 to 172800 (two days)."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--aws-text)] mb-1">
              Routing policy
            </label>
            <select
              value={routingPolicy}
              onChange={(e) => setRoutingPolicy(e.target.value)}
              className="w-full border border-[var(--aws-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--aws-blue)] focus:ring-1 focus:ring-[var(--aws-blue)] bg-[var(--aws-surface)]"
            >
              {ROUTING_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {p} routing
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="text-sm text-[var(--aws-red)] bg-[var(--aws-red-bg)] border border-[var(--aws-red)]/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--aws-border)] pt-4 -mx-6 px-6">
          <Button variant="secondary" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting || !value.trim()}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create record"}
          </Button>
        </div>
      </form>
    </div>
  );
}
