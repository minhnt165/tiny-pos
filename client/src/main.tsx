import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter } from 'react-router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { DEVICE_KEY } from '@/api/device';
import { DeviceGate } from '@/components/DeviceGate';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { PrintProvider } from '@/components/receipt/PrintProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { applyUiPrefs, readUiPrefs } from '@/lib/ui-prefs';
import App from './App';
import './index.css';

// Chuẩn hóa data-* (script trong index.html chỉ chép thô từ localStorage)
applyUiPrefs(readUiPrefs());

/** 401 ở bất kỳ lời gọi nào = thiết bị bị gỡ / chưa ghép → DeviceGate hiện màn ghép ngay. */
const onApiError = (e: Error) => {
  if (e instanceof ApiError && e.status === 401) queryClient.setQueryData(DEVICE_KEY, { kind: 'unpaired' });
};
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <PrintProvider>
                <DeviceGate>
                  <App />
                </DeviceGate>
              </PrintProvider>
            </BrowserRouter>
          </ConfirmProvider>
        </TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
