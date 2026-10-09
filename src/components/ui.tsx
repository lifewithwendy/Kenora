import clsx from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-indigo-700 text-white hover:bg-indigo-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-slate-500">{hint}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(inputCls, p.className)} />;

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-lg border px-4 py-3 text-base",
        kind === "error" && "border-red-200 bg-red-50 text-red-800",
        kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        kind === "info" && "border-sky-200 bg-sky-50 text-sky-800",
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "amber" | "red" | "slate" | "blue"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "amber" && "bg-amber-100 text-amber-900",
        tone === "red" && "bg-red-100 text-red-800",
        tone === "slate" && "bg-slate-200 text-slate-700",
        tone === "blue" && "bg-sky-100 text-sky-800",
      )}
    >
      {children}
    </span>
  );
}
