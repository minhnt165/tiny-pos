import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Theo chế độ sáng/tối của máy, kể cả khi đổi lúc đang mở
const dark = matchMedia('(prefers-color-scheme: dark)');
dark.addEventListener('change', (e) => document.documentElement.classList.toggle('dark', e.matches));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
