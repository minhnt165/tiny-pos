import { describe, expect, it } from 'vitest';
import { createLabelOpener, findBrowser } from './label-window.js';

const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', LocalAppData: 'C:\\Users\\a\\AppData\\Local' };

describe('findBrowser', () => {
  it('cùng thứ tự với open.vbs: Chrome (Program Files, x86, LocalAppData) rồi Edge', () => {
    const has = (...paths: string[]) => (p: string) => paths.includes(p);
    const chromeLocal = 'C:\\Users\\a\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
    const edge86 = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    expect(findBrowser(env, has(chromeLocal, edge86))).toBe(chromeLocal);
    expect(findBrowser(env, has(edge86))).toBe(edge86);
    expect(findBrowser(env, has())).toBeNull();
    expect(findBrowser({}, () => true)).toBeNull();
  });

  it('không có trình duyệt thì opener trả false, không spawn', () => {
    expect(createLabelOpener('C:\\data\\label-browser', null)('http://localhost:3000/labels/print?sample=1')).toBe(false);
  });
});
