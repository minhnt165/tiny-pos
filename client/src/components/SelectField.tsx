import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Nhãn cho lựa chọn rỗng (value = ''); bỏ qua nếu không cho phép rỗng. */
  emptyLabel?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
}

/** Radix không cho SelectItem value rỗng, nên dùng giá trị thay thế. */
const NONE = '__none__';

/** Ô chọn cùng cỡ/viền với TextField; danh sách xổ xuống ngay dưới ô, rộng bằng ô. */
export function SelectField({ id, label, value, onChange, options, emptyLabel, placeholder, hint, error }: Props) {
  const invalid = !!error;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {/* Select ẩn của Radix bắn change '' khi value đổi lúc option chưa đăng ký (vào lại trang, dữ liệu có sẵn
          trong cache); không SelectItem nào có value '' nên bỏ qua, tránh xóa lựa chọn đã lưu */}
      <Select value={value || (emptyLabel ? NONE : '')} onValueChange={(v) => v !== '' && onChange(v === NONE ? '' : v)}>
        <SelectTrigger id={id} aria-invalid={invalid} className="h-11 w-full bg-card text-base data-[size=default]:h-11">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4} className="w-(--radix-select-trigger-width)">
          {emptyLabel && (
            <SelectItem value={NONE} className="py-2 text-base">
              {emptyLabel}
            </SelectItem>
          )}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-2 text-base">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <FieldError>{error}</FieldError> : hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

interface ToolbarSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Nhãn khi không lọc (value = ''), ví dụ "Tất cả danh mục". */
  emptyLabel: string;
  'aria-label': string;
  className?: string;
}

/** Ô chọn gọn trong thanh công cụ danh sách (không có nhãn phía trên). */
export function ToolbarSelect({ value, onChange, options, emptyLabel, className, 'aria-label': ariaLabel }: ToolbarSelectProps) {
  return (
    <Select value={value || NONE} onValueChange={(v) => v !== '' && onChange(v === NONE ? '' : v)}>
      <SelectTrigger aria-label={ariaLabel} className={cn('h-11 min-w-44 bg-card text-base data-[size=default]:h-11 md:h-10 md:data-[size=default]:h-10', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4}>
        <SelectItem value={NONE} className="py-2 text-base">
          {emptyLabel}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-2 text-base">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
