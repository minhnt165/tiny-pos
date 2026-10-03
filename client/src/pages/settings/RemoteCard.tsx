import { useState, type KeyboardEvent } from 'react';
import { ExternalLink, Plus, Send, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { REMOTE_MAX_EMAILS, type RemoteStatus } from '@tiny-pos/shared';
import { usePushRemote, useRemoteStatus, useSaveRemote } from '@/api/remote';
import { SectionTitle, TextField } from '@/components/TextField';
import { UrlQr } from '@/components/UrlQr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const KEY_PATH = 'data\\remote\\service-account.json';
const when = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const emailSchema = z.email();

/** Dòng trạng thái gửi: lỗi đỏ (kèm nhắc tự thử lại), chưa gửi, hoặc giờ gửi gần nhất. */
function PushStatus({ s }: { s: RemoteStatus }) {
  if (s.lastError) return <p className="text-sm text-destructive">{s.lastError}. Sẽ tự thử lại mỗi phút.</p>;
  if (!s.enabled) return <p className="text-sm text-muted-foreground">Đang tắt: điện thoại không xem được.</p>;
  if (!s.lastPushAt) return <p className="text-sm text-muted-foreground">Chưa gửi lần nào.</p>;
  return (
    <p className="text-sm">
      Gửi lần cuối: <span className="font-medium">{when(s.lastPushAt)}</span>
    </p>
  );
}

/**
 * Thẻ Xem từ xa trong Cài đặt. Nằm trong form cài đặt chung nên mọi nút là type="button" và Enter ở ô email chỉ thêm email.
 * Bật/tắt và thêm/xóa email đều gọi PUT ngay, không có nút Lưu riêng.
 */
export function RemoteCard() {
  const { data } = useRemoteStatus();
  const save = useSaveRemote();
  const push = usePushRemote();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const fail = (e: Error) => toast.error(e.message);

  if (!data) return null;
  const emails = data.emails;
  const full = emails.length >= REMOTE_MAX_EMAILS;

  const put = (next: { enabled: boolean; emails: string[] }, done?: string) =>
    save.mutate(next, { onSuccess: () => done && toast.success(done), onError: fail });
  const addEmail = () => {
    const v = email.trim().toLowerCase();
    if (!emailSchema.safeParse(v).success) return setEmailError('Email không hợp lệ');
    if (emails.includes(v)) return setEmailError('Email này đã có');
    setEmailError(undefined);
    setEmail('');
    put({ enabled: data.enabled, emails: [...emails, v] });
  };
  const onEmailKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addEmail();
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <SectionTitle>Xem từ xa</SectionTitle>
          <p className="text-sm text-muted-foreground">
            Gửi trang Tổng quan lên Firebase mỗi phút để chủ tiệm mở điện thoại xem được khi không ở tiệm. Chỉ xem, không bán hàng; chỉ email trong danh
            sách mới xem được.
          </p>
        </div>
        {!data.configured ? (
          <div className="space-y-1 text-sm">
            <p>
              Chưa cài đặt Firebase cho tiệm này. Cần file <span className="font-mono">{KEY_PATH}</span> trên máy quầy – xem mục <em>Xem từ xa</em> trong README.
            </p>
            {data.lastError && <p className="text-destructive">{data.lastError}</p>}
          </div>
        ) : (
          <fieldset disabled={save.isPending} className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Bật xem từ xa</span>
                <span className="text-sm text-muted-foreground">Project Firebase: {data.projectId}</span>
              </span>
              <Switch checked={data.enabled} onCheckedChange={(v) => put({ enabled: v, emails }, v ? 'Đã bật xem từ xa' : 'Đã tắt xem từ xa')} />
            </label>
            <div className="space-y-2">
              <p className="font-medium">Email được xem</p>
              {emails.length === 0 ? (
                <p className={`text-sm ${data.enabled ? 'text-warning' : 'text-muted-foreground'}`}>
                  Chưa có email nào được xem{data.enabled ? ': điện thoại đăng nhập sẽ bị từ chối' : ''}.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {emails.map((e) => (
                    <li key={e} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate">{e}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa ${e}`} onClick={() => put({ enabled: data.enabled, emails: emails.filter((x) => x !== e) })}>
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                <TextField
                  id="st-remote-email"
                  label="Thêm email Google"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="chutiem@gmail.com"
                  value={email}
                  error={emailError}
                  disabled={full}
                  hint={full ? `Tối đa ${REMOTE_MAX_EMAILS} email` : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(undefined);
                  }}
                  onKeyDown={onEmailKey}
                />
                </div>
                <Button type="button" variant="outline" className="h-11" disabled={full || !email.trim()} onClick={addEmail}>
                  <Plus data-icon="inline-start" />
                  Thêm
                </Button>
              </div>
            </div>
            {data.url && (
              <div className="flex flex-wrap items-start gap-4">
                <UrlQr url={data.url} alt="Mã QR địa chỉ trang xem" />
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <Smartphone className="size-4" />
                    Quét mã bằng điện thoại để mở trang xem
                  </p>
                  <a href={data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline">
                    {data.url}
                    <ExternalLink className="size-3.5" />
                  </a>
                  <p className="text-muted-foreground">Trên điện thoại chọn "Thêm vào màn hình chính" để mở như một ứng dụng.</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base"
                disabled={!data.enabled || push.isPending}
                onClick={() => push.mutate(undefined, { onSuccess: () => toast.success('Đã gửi'), onError: fail })}
              >
                <Send data-icon="inline-start" />
                {push.isPending ? 'Đang gửi…' : 'Gửi ngay'}
              </Button>
              <PushStatus s={data} />
            </div>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
