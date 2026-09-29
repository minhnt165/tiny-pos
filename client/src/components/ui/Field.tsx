import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const base =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-gray-500">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref,
) {
  return <input ref={ref} {...props} className={`${base} ${className}`} />;
});

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${className}`} />;
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" {...props} className="h-5 w-5 accent-green-600" />
      <span>{label}</span>
    </label>
  );
}
