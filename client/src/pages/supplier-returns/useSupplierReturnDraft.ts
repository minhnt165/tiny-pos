import { useEffect, useReducer } from 'react';
import { parseSupplierReturnDraft, supplierReturnDraftReducer } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.supplier-return-draft';

/** Phiếu trả NCC đang soạn; tự lưu nháp để rời trang/F5 không mất. */
export function useSupplierReturnDraft() {
  const [draft, dispatch] = useReducer(supplierReturnDraftReducer, undefined, () => parseSupplierReturnDraft(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(draft)), [draft]);
  return { draft, dispatch };
}
