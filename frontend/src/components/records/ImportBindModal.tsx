"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

interface ImportSummary {
  created: number;
  skipped: number;
  errors: string[];
}

interface ImportBindModalProps {
  zoneId: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportBindModal({ zoneId, onClose, onImported }: ImportBindModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    setError(null);
    setSummary(null);
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<ImportSummary>(
        `/api/hosted-zones/${zoneId}/records/import`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setSummary(res.data);
      onImported();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to import the zone file. Please check the file format.";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="Import DNS records from BIND zone file"
      onClose={onClose}
      footer={
        summary ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Importing..." : "Import records"}
            </Button>
          </>
        )
      }
    >
      {summary ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[var(--aws-green)] bg-[var(--aws-green-bg)] rounded px-3 py-2 text-sm">
            <CheckCircle2 size={16} />
            Imported {summary.created} record{summary.created === 1 ? "" : "s"}
            {summary.skipped > 0 && `, skipped ${summary.skipped}`}.
          </div>
          {summary.errors.length > 0 && (
            <div className="text-sm">
              <div className="flex items-center gap-1.5 text-[var(--aws-red)] mb-1">
                <AlertTriangle size={14} /> {summary.errors.length} issue
                {summary.errors.length === 1 ? "" : "s"}
              </div>
              <ul className="list-disc list-inside text-xs text-[var(--aws-text-secondary)] max-h-32 overflow-y-auto">
                {summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--aws-text-secondary)]">
            Upload a standard BIND zone file (<span className="font-mono">.zone</span> or{" "}
            <span className="font-mono">.txt</span>). Records will be added to this hosted zone.
            Supported types: A, AAAA, CNAME, MX, TXT, NS, PTR, SRV, CAA.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded py-8 px-4 cursor-pointer transition-colors ${
              dragOver
                ? "border-[var(--aws-blue)] bg-[#f0f7ff]"
                : "border-[var(--aws-border)] hover:bg-[var(--aws-surface-alt)]"
            }`}
          >
            {file ? (
              <>
                <FileText size={28} className="text-[var(--aws-blue)]" />
                <span className="text-sm font-medium text-[var(--aws-text)]">{file.name}</span>
                <span className="text-xs text-[var(--aws-text-secondary)]">
                  Click or drop to replace
                </span>
              </>
            ) : (
              <>
                <UploadCloud size={28} className="text-[var(--aws-text-secondary)]" />
                <span className="text-sm text-[var(--aws-text)]">
                  Drop a .zone or .txt file here, or click to browse
                </span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".zone,.txt,.bind,.db"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--aws-red)] bg-[var(--aws-red-bg)] border border-[var(--aws-red)]/30 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
