import type { ComponentProps, ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

interface Props extends ComponentProps<'input'> {
  id: string;
  label: string;
  hint?: string;
  /** Chữ nhỏ bên phải ô, ví dụ "đ" hoặc "kg". */
  suffix?: string;
  leading?: ReactNode;
  /** Thông báo lỗi validate; có lỗi thì viền đỏ và hiện chữ đỏ dưới ô. */
  error?: string;
}

/** Nhãn + ô nhập cỡ lớn (44px) cho người lớn tuổi; có thể thêm icon đầu, đơn vị cuối, lỗi. */
export function TextField({ id, label, hint, suffix, leading, error, className, ...props }: Props) {
  const invalid = !!error;
  const inputClass = cn('h-11 text-base', className);
  const control =
    suffix || leading ? (
      <InputGroup className="h-11">
        {leading && <InputGroupAddon>{leading}</InputGroupAddon>}
        <InputGroupInput id={id} aria-invalid={invalid} className={inputClass} {...props} />
        {suffix && (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        )}
      </InputGroup>
    ) : (
      <Input id={id} aria-invalid={invalid} className={inputClass} {...props} />
    );
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {control}
      {error ? <FieldError>{error}</FieldError> : hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

/** Tiêu đề nhóm trường trong form. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>;
}
