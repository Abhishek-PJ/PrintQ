import { NavLink, Outlet, Link } from "react-router-dom";
import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const StudentLayout = () => {
  const { user, logout } = useAuth();

  // Socket lives here so toast notifications fire on every student page
  useEffect(() => {
    if (!user?.id) return;
    const socket: Socket = io(SOCKET_URL);
    socket.emit("join:user", user.id);

    socket.on("order:notification", (payload: { message: string; status: string }) => {
      const { message: msg, status } = payload;
      if (status === "completed") {
        toast.success(msg, { duration: 8000, icon: "✅" });
      } else if (status === "called") {
        toast(msg, { duration: 8000, icon: "📢", style: { background: "#fffbeb", border: "1px solid #f59e0b" } });
      } else if (status === "printing") {
        toast(msg, { duration: 6000, icon: "🖨️" });
      } else if (status === "skipped") {
        toast(msg, { duration: 6000, icon: "⏭️", style: { background: "#fef2f2", border: "1px solid #fca5a5" } });
      } else {
        toast(msg, { duration: 5000 });
      }
    });

    return () => { socket.disconnect(); };
  }, [user?.id]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-violet-50 text-violet-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top navigation bar ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

          {/* Left: logo + nav links */}
          <div className="flex items-center gap-2 sm:gap-8">
            <Link to="/" className="text-xl font-bold tracking-widest text-violet-700">
              PrintQ
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink to="/student" end className={navLinkClass}>
                {/* printer icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>New Order</span>
              </NavLink>

              <NavLink to="/student/orders" className={navLinkClass}>
                {/* list icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="9" y1="6" x2="20" y2="6" />
                  <line x1="9" y1="12" x2="20" y2="12" />
                  <line x1="9" y1="18" x2="20" y2="18" />
                  <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
                  <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>My Orders</span>
              </NavLink>
            </nav>
          </div>

          {/* Right: user name + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-medium text-slate-800">{user?.name}</span>
              <span className="text-xs text-slate-400">Student</span>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* ── Page content (nested route fills here) ── */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;
