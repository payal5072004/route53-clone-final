"use client";

import { InputHTMLAttributes } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className = "", ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border-[var(--aws-border)] accent-[var(--aws-blue)] cursor-pointer ${className}`}
      {...props}
    />
  );
}
