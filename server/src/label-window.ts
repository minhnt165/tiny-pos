import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { LabelOpener } from './services/labels.js';

const CHROME = ['Google', 'Chrome', 'Application', 'chrome.exe'];
const EDGE = ['Microsoft', 'Edge', 'Application', 'msedge.exe'];

/** Cùng thứ tự với scripts/open.vbs: Chrome (Program Files, x86, LocalAppData) rồi Edge. */
export function findBrowser(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = fs.existsSync): string | null {
  const pf = env['ProgramFiles'];
  const pf86 = env['ProgramFiles(x86)'];
  const local = env['LocalAppData'] ?? env['LOCALAPPDATA'];
  const candidates = [
    pf && path.win32.join(pf, ...CHROME),
    pf86 && path.win32.join(pf86, ...CHROME),
    local && path.win32.join(local, ...CHROME),
    pf86 && path.win32.join(pf86, ...EDGE),
    pf && path.win32.join(pf, ...EDGE),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => exists(p)) ?? null;
}

/**
 * Cửa sổ trình duyệt thứ hai với hồ sơ riêng, KHÔNG --kiosk-printing: hộp in hiện ra và Chrome nhớ máy in tem đã chọn,
 * còn cửa sổ bán hàng vẫn in hóa đơn thẳng ra máy mặc định.
 */
export function createLabelOpener(profileDir: string, browser: string | null = findBrowser()): LabelOpener {
  return (url) => {
    if (!browser) return false;
    try {
      const child = spawn(browser, [`--app=${url}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check'], {
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => {}); // lỗi spawn đến sau (mất file, thiếu quyền) không được làm sập server
      child.unref();
      return true;
    } catch {
      return false;
    }
  };
}
