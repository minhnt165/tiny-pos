import { NavLink } from 'react-router';
import { AppRoutes, NAV } from './router';

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-4 py-3 font-medium ${isActive ? 'bg-green-600 text-white' : 'hover:bg-gray-200'}`;

const bottomLink = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center py-2 text-sm ${isActive ? 'font-semibold text-green-700' : 'text-gray-500'}`;

/** Bố cục: menu trái trên máy tính, thanh dưới trên điện thoại. */
export default function App() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-white p-3 md:flex">
        <div className="mb-3 px-2 text-2xl font-bold text-green-700">Tạp hóa</div>
        {NAV.map((n) =>
          n.disabled ? (
            <span key={n.to} className="flex items-center gap-3 px-4 py-3 text-gray-400">
              {n.icon} {n.label}
            </span>
          ) : (
            <NavLink key={n.to} to={n.to} className={sideLink}>
              {n.icon} {n.label}
            </NavLink>
          ),
        )}
      </nav>
      <main className="min-w-0 flex-1 p-4 pb-24 md:pb-4">
        <AppRoutes />
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-white md:hidden">
        {NAV.filter((n) => !n.disabled).map((n) => (
          <NavLink key={n.to} to={n.to} className={bottomLink}>
            <span className="text-2xl">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
