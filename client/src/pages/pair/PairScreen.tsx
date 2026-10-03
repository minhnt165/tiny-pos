import { useEffect, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { usePair } from '@/api/device';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';

const SIX_DIGITS = /^\d{6}$/;
const slot = 'size-12 text-xl';

/**
 * Thay cả app khi máy trong LAN chưa ghép. `autoCode` = mã từ link QR (/pair?code=…): hợp lệ thì gửi ngay.
 * Ghép xong DeviceGate tự render app (và chuyển /pair về /).
 */
export function PairScreen({ autoCode }: { autoCode: string | null }) {
  const pair = usePair();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  // StrictMode chạy effect hai lần: chỉ gửi mã từ link một lần
  const sentAuto = useRef(false);

  const submit = (c: string) => {
    setError(undefined);
    pair.mutate(c, {
      onError: (e) => {
        setError(e.message);
        setCode('');
      },
    });
  };

  useEffect(() => {
    if (sentAuto.current || !autoCode || !SIX_DIGITS.test(autoCode)) return;
    sentAuto.current = true;
    submit(autoCode);
  }, [autoCode]);

  return (
    <div className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Smartphone className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-xl font-semibold">Điện thoại này chưa được ghép</h1>
            <p className="text-sm text-muted-foreground">
              Trên máy quầy mở <span className="font-medium text-foreground">Cài đặt → Thiết bị → Ghép điện thoại</span>, rồi quét mã QR bằng camera
              hoặc gõ mã 6 số vào đây.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              pasteTransformer={(t) => t.replace(/\D/g, '')}
              inputMode="numeric"
              autoFocus
              value={code}
              disabled={pair.isPending}
              aria-invalid={!!error}
              onChange={(v) => {
                setCode(v);
                setError(undefined);
              }}
              onComplete={submit}
            >
              <InputOTPGroup>
                {[0, 1, 2].map((i) => (
                  <InputOTPSlot key={i} index={i} className={slot} />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                {[3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className={slot} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="h-11 w-full text-base" disabled={code.length !== 6 || pair.isPending} onClick={() => submit(code)}>
              {pair.isPending ? 'Đang ghép…' : 'Ghép'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
