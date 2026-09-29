import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Hành động nguy hiểm (xóa, ngừng bán): nút xác nhận màu đỏ. */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn>(() => Promise.resolve(false));

/** Thay window.confirm bằng hộp thoại đẹp: `const ok = await confirm({ title, ... })`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOpts(o);
        setOpen(true);
      }),
    [],
  );

  const finish = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpen(false);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => !o && finish(false)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">{opts?.title}</AlertDialogTitle>
            {opts?.description && <AlertDialogDescription className="text-base">{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 px-4 text-base">{opts?.cancelText ?? 'Hủy'}</AlertDialogCancel>
            <AlertDialogAction
              variant={opts?.destructive ? 'destructive' : 'default'}
              // Slot nối class thay vì merge, nên phải dùng "!" để thắng màu nhạt của biến thể destructive
              className={cn('h-10 px-4 text-base', opts?.destructive && 'bg-destructive! text-white! hover:bg-destructive/90!')}
              onClick={() => finish(true)}
            >
              {opts?.confirmText ?? 'Đồng ý'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
