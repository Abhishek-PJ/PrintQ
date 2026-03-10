import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleHome = (role: string) =>
  role === "admin" ? "/admin/shop" : "/student";

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const newUser = await register(name, email, password, role);
      navigate(roleHome(newUser.role), { replace: true });
    } catch {
      setError("Registration failed. This email may already be in use.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-white text-xl font-bold mb-3">P</div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Join PrintQ to submit and manage print orders</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
              type="text"
              placeholder="John Smith"
              autoComplete="name"
              required
            />
          </div>
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
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {/* Role selector as visual cards */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">I am a…</label>
            <div className="grid grid-cols-2 gap-3">
              {(["student", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                    role === r
                      ? "border-brand-700 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {r === "student" ? "🎓 Student" : "🏪 Shop Owner"}
                </button>
              ))}
            </div>
            {role === "admin" && (
              <p className="mt-2 text-xs text-slate-500">
                Shop owners must register their print shop separately after signing up.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
          )}
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60 transition-colors"
            type="submit"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
