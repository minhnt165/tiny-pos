import { useEffect, useMemo, useReducer } from 'react';
import { draftTotals, importDraftReducer, parseImportDraft } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.import-draft';

/** Phiếu nhập đang soạn; tự lưu nháp để rời trang/F5 không mất. */
export function useImportDraft() {
  const [draft, dispatch] = useReducer(importDraftReducer, undefined, () => parseImportDraft(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(draft)), [draft]);
  const totals = useMemo(() => draftTotals(draft), [draft]);
  return { draft, dispatch, totals };
}
