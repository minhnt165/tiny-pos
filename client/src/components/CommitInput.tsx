import { useEffect, useState } from 'react';
import { formatQty, parseVnNumber } from '@tiny-pos/shared';
import { Input } from '@/components/ui/input';
import { groupThousands, moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  onCommit: (n: number) => void;
  /** Ô tiền: chia dấu chấm hàng nghìn, làm tròn đồng. */
  money?: boolean;
  disabled?: boolean;
  /** Gọi sau Enter (ví dụ trả focus về ô quét). */
  onEnter?: () => void;
  className?: string;
  'aria-label': string;
}

/** Ô số sửa nhanh: gõ nháp, blur/Enter mới ghi; rỗng hoặc sai thì trả lại giá trị cũ. */
export function CommitInput({ value, onCommit, money, disabled, onEnter, className, ...rest }: Props) {
  const shown = money ? groupThousands(String(value)) : formatQty(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const n = parseVnNumber(draft);
    if (!draft.trim() || !Number.isFinite(n) || n < 0) return setDraft(shown);
    onCommit(money ? Math.round(n) : n);
  };

  return (
    <Input
      value={draft}
      disabled={disabled}
      onChange={money ? moneyChange(setDraft) : (e) => setDraft(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
        e.preventDefault();
        commit();
        onEnter?.();
      }}
      inputMode={money ? 'numeric' : 'decimal'}
      className={cn('h-11 text-base tabular-nums', money && 'text-right', className)}
      aria-label={rest['aria-label']}
    />
  );
}
