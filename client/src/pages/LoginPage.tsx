import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleHome = (role: string) =>
  role === "superadmin" ? "/superadmin" : role === "admin" ? "/admin" : "/student";

/* ── validation ── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLogin(email: string, password: string) {
  const errs: { email?: string; password?: string } = {};
  if (!email)                      errs.email    = "Email is required.";
  else if (!EMAIL_RE.test(email))  errs.email    = "Enter a valid email address.";
  if (!password)                   errs.password = "Password is required.";
  return errs;
}

/* ── shared input class helpers ── */
const inputCls = (hasError: boolean) =>
  `w-full rounded-lg border p-2.5 text-sm focus:outline-none focus:ring-1 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
      : "border-slate-300 focus:border-brand-700 focus:ring-brand-700"
  }`;

const LoginPage = () => {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [touched, setTouched]     = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const errs = validateLogin(email, password);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(errs).length) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const loggedUser = await login(email.trim(), password);
      navigate(roleHome(loggedUser.role), { replace: true });
    } catch {
      setSubmitError("Invalid email or password. Please try again.");
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
          noValidate
        >
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => touch("email")}
              className={inputCls(!!(touched.email && errs.email))}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
            {touched.email && errs.email && (
              <p className="mt-1 text-xs text-red-600">{errs.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => touch("password")}
              className={inputCls(!!(touched.password && errs.password))}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {touched.password && errs.password && (
              <p className="mt-1 text-xs text-red-600">{errs.password}</p>
            )}
          </div>

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{submitError}</p>
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
