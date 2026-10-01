/** Một dòng "nhãn – số tiền" trong hộp chi tiết chứng từ; `strong` là dòng tổng. */
export function MoneyLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between text-lg font-semibold' : 'flex justify-between text-muted-foreground'}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
