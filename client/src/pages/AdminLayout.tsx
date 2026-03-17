import { NavLink, Outlet, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const AdminLayout = () => {
  const { user, logout } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-50 text-indigo-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" toastOptions={{ className: "text-sm font-medium" }} />

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

          {/* Logo + nav */}
          <div className="flex items-center gap-2 sm:gap-8 min-w-0">
            <Link to="/" className="shrink-0 text-xl font-bold tracking-widest text-indigo-700">
              PrintQ
            </Link>

            <nav className="flex items-center gap-1 overflow-x-auto">
              {/* Queue */}
              <NavLink to="/admin" end className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 6h16M4 10h16M4 14h10M4 18h6" />
                </svg>
                <span className="hidden sm:inline">Queue</span>
              </NavLink>

              {/* Analytics */}
              <NavLink to="/admin/analytics" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14" />
                </svg>
                <span className="hidden sm:inline">Analytics</span>
              </NavLink>

              {/* History */}
              <NavLink to="/admin/history" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="hidden sm:inline">History</span>
              </NavLink>

              {/* Shop registration */}
              <NavLink to="/admin/shop" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline strokeLinecap="round" strokeLinejoin="round" points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="hidden sm:inline">Shop</span>
              </NavLink>
            </nav>
          </div>

          {/* Right: user + logout */}
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-700 sm:block">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
