import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { lineFromProduct, type CartLine, type NewCartLine, type OrderDetail, type Product, type ProductUnit } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { lookupBarcode } from '@/api/products';
import { useSettings } from '@/api/settings';
import { useConfirm, type ConfirmOptions } from '@/components/ConfirmDialog';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromOrder } from '@/components/receipt/receipt-data';
import { PageTitle } from '@/components/layout/PageTitle';
import { Kbd } from '@/components/ui/kbd';
import { useScanInput } from '@/hooks/useScanInput';
import { CartTable } from './CartTable';
import { CheckoutDialog } from './CheckoutDialog';
import { CheckoutPanel } from './CheckoutPanel';
import { CustomItemDialog } from './CustomItemDialog';
import { HeldCarts } from './HeldCarts';
import { ProductSearch } from '@/components/ProductSearch';
import { SaleResult } from './SaleResult';
import { useCart } from './useCart';
import { useHeldCarts } from './useHeldCarts';
import { WeighDialog, type WeighTarget } from './WeighDialog';

const noop = () => {};

const SHORTCUTS = [
  ['F2', 'Quét'],
  ['F4', 'Món ngoài'],
  ['F9', 'Thanh toán'],
  ['Esc', 'Đóng hộp thoại'],
] as const;

export function SellPage() {
  const { cart, dispatch, totals, shortages } = useCart();
  const heldCarts = useHeldCarts();
  const { data: settings } = useSettings();
  const print = usePrint();
  const confirm = useConfirm();
  const [weigh, setWeigh] = useState<WeighTarget | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderDetail | null>(null);
  const paused = weigh !== null || customOpen || checkoutOpen || confirming;
  // Chỉ dùng phần giữ focus của hook; phím Enter do ProductSearch xử lý (có gợi ý)
  const scan = useScanInput(noop, paused);

  const add = (line: NewCartLine) => {
    setLastOrder(null);
    dispatch({ type: 'add', line });
  };
  const addProduct = (p: Product, u: ProductUnit | null) => {
    if (!p.isActive) return void toast.error(`"${p.name}" đã ngừng bán`);
    const line = lineFromProduct(p, u);
    if (line.isWeighed) return setWeigh({ line });
    add(line);
  };
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      addProduct(r.product, r.unit);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có mã ${code}` : (e as Error).message);
    }
  };

  const onWeighed = (qty: number) => {
    if (!weigh) return;
    if (weigh.lineKey) dispatch({ type: 'update', key: weigh.lineKey, patch: { qty } });
    else add({ ...weigh.line, qty });
    setWeigh(null);
  };
  const editWeight = ({ key, ...line }: CartLine) => setWeigh({ line, lineKey: key });

  const hold = () => {
    if (!cart.lines.length || heldCarts.full) return;
    heldCarts.hold(cart);
    dispatch({ type: 'clear' });
    toast.success('Đã cất đơn chờ');
  };
  const openHeld = (id: string) => {
    const c = heldCarts.take(id);
    if (!c) return;
    if (cart.lines.length) heldCarts.hold(cart);
    dispatch({ type: 'replace', cart: c });
  };
  // Báo cho phím tắt biết hộp xác nhận đang mở
  const ask = async (opts: ConfirmOptions) => {
    setConfirming(true);
    try {
      return await confirm(opts);
    } finally {
      setConfirming(false);
    }
  };
  const dropHeld = async (id: string) => {
    if (await ask({ title: 'Bỏ đơn chờ này?', confirmText: 'Bỏ đơn', destructive: true })) heldCarts.drop(id);
  };
  const clearCart = async () => {
    if (await ask({ title: 'Xóa toàn bộ giỏ hàng?', confirmText: 'Xóa giỏ', destructive: true })) dispatch({ type: 'clear' });
  };

  const onPaid = (order: OrderDetail) => {
    setCheckoutOpen(false);
    dispatch({ type: 'clear' });
    setLastOrder(order);
    toast.success(`${order.debt ? 'Đã ghi nợ' : 'Đã thanh toán'} ${order.code}`);
    if (settings?.autoPrint ?? true) void print(receiptFromOrder(order));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.key === 'F2') {
        e.preventDefault();
        scan.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCustomOpen(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.lines.length && totals.payable >= 0) setCheckoutOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, cart.lines.length, totals.payable, scan.focus]);

  return (
    // Máy tính: hết chiều cao dưới topbar 3rem (+ đệm main 2rem); giỏ cuộn bên trong, cột phải cố định
    <div className="grid gap-3 pb-20 md:pb-0 lg:h-[calc(100dvh-5rem)] lg:grid-cols-[1fr_20rem]">
      <PageTitle title="Bán hàng" />
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={(p) => addProduct(p, null)} />
        <HeldCarts held={heldCarts.held} currentCount={cart.lines.length} onOpen={openHeld} onDrop={(id) => void dropHeld(id)} />
        {lastOrder && <SaleResult order={lastOrder} onReprint={() => void print(receiptFromOrder(lastOrder))} />}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card">
          <CartTable cart={cart} shortages={shortages} dispatch={dispatch} onEditWeight={editWeight} onDone={scan.focus} />
        </div>
        <div className="hidden flex-wrap gap-4 text-xs text-muted-foreground lg:flex">
          {SHORTCUTS.map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <Kbd>{k}</Kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
      <CheckoutPanel
        totals={totals}
        lineCount={cart.lines.length}
        empty={!cart.lines.length}
        canHold={!heldCarts.full}
        onDiscount={(d) => dispatch({ type: 'setDiscount', discount: d })}
        onCheckout={() => setCheckoutOpen(true)}
        onHold={hold}
        onCustom={() => setCustomOpen(true)}
        onClear={() => void clearCart()}
      />
      <WeighDialog target={weigh} onClose={() => setWeigh(null)} onConfirm={onWeighed} />
      <CustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onConfirm={(line) => {
          add(line);
          setCustomOpen(false);
        }}
      />
      <CheckoutDialog open={checkoutOpen} cart={cart} payable={totals.payable} onClose={() => setCheckoutOpen(false)} onDone={onPaid} />
    </div>
  );
}
