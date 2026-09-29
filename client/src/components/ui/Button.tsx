import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const styles: Record<Variant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700',
  secondary: 'bg-white border border-gray-300 hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'hover:bg-gray-100',
};

/** Nút cao tối thiểu 44px để dễ bấm trên màn cảm ứng. */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      {...props}
      className={`min-h-11 rounded-lg px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}
