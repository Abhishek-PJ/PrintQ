import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();

  const dashLink = user
    ? user.role === "superadmin"
      ? "/superadmin"
      : user.role === "admin"
        ? "/admin"
        : "/student"
    : "/";

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-brand-700">
          PrintQ
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to={dashLink} className="text-brand-700 hover:underline">
                Dashboard
              </Link>
              {user.role === "admin" && (
                <Link to="/admin/shop" className="text-brand-700 hover:underline">
                  My Shop
                </Link>
              )}
              <span className="text-slate-600">{user.name} ({user.role})</span>
              <button
                onClick={logout}
                className="rounded bg-brand-700 px-3 py-1.5 text-white hover:bg-brand-900"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-brand-700 hover:underline">
                Login
              </Link>
              <Link to="/register" className="text-brand-700 hover:underline">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
