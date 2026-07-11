"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface BulkTTLModalProps {
  count: number;
  onClose: () => void;
  onSubmit: (ttl: number) => Promise<void>;
}

export function BulkTTLModal({ count, onClose, onSubmit }: BulkTTLModalProps) {
  const [ttl, setTtl] = useState(300);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(ttl);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Change TTL for ${count} record${count === 1 ? "" : "s"}`}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Updating..." : "Update TTL"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-[var(--aws-text)] mb-1">
          New TTL (seconds)
        </label>
        <input
          type="number"
          min={0}
          value={ttl}
          onChange={(e) => setTtl(Number(e.target.value))}
          autoFocus
          className="w-full border border-[var(--aws-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--aws-blue)] focus:ring-1 focus:ring-[var(--aws-blue)]"
        />
      </form>
    </Modal>
  );
}
