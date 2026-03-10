import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleHome = (role: string) =>
  role === "superadmin" ? "/superadmin" : role === "admin" ? "/admin" : "/student";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      navigate(roleHome(loggedUser.role), { replace: true });
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-white text-xl font-bold mb-3">P</div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your PrintQ account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
          )}
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60 transition-colors"
            type="submit"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
