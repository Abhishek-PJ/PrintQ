import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleHome = (role: string) =>
  role === "admin" ? "/admin/shop" : "/student";

/* ── validation rules ── */
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const NAME_RE   = /^[a-zA-Z\s]{2,60}$/;

interface RegisterErrors {
  name?: string;
  email?: string;
  mobile?: string;
  password?: string;
  confirm?: string;
}

function validateRegister(
  name: string,
  email: string,
  mobile: string,
  password: string,
  confirm: string,
): RegisterErrors {
  const e: RegisterErrors = {};
  if (!name)                     e.name    = "Full name is required.";
  else if (!NAME_RE.test(name))  e.name    = "Name may only contain letters and spaces (2–60 chars).";

  if (!email)                      e.email = "Email is required.";
  else if (!EMAIL_RE.test(email))  e.email = "Enter a valid email address.";

  if (!mobile)                       e.mobile = "Mobile number is required.";
  else if (!MOBILE_RE.test(mobile))  e.mobile = "Enter a valid 10-digit Indian mobile number (starts with 6–9).";

  if (!password)                          e.password = "Password is required.";
  else if (password.length < 8)           e.password = "Password must be at least 8 characters.";
  else if (!/[A-Z]/.test(password))       e.password = "Password must contain at least one uppercase letter.";
  else if (!/[a-z]/.test(password))       e.password = "Password must contain at least one lowercase letter.";
  else if (!/\d/.test(password))          e.password = "Password must contain at least one number.";

  if (!confirm)                     e.confirm = "Please confirm your password.";
  else if (confirm !== password)    e.confirm = "Passwords do not match.";

  return e;
}

const inputCls = (hasError: boolean) =>
  `w-full rounded-lg border p-2.5 text-sm focus:outline-none focus:ring-1 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
      : "border-slate-300 focus:border-brand-700 focus:ring-brand-700"
  }`;

/* ── Password strength indicator ── */
const PasswordStrength = ({ password }: { password: string }) => {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className={`mt-0.5 text-xs font-medium ${score <= 1 ? "text-red-500" : score === 2 ? "text-amber-500" : score === 3 ? "text-yellow-600" : "text-emerald-600"}`}>
        {labels[score]}
      </p>
    </div>
  );
};

const RegisterPage = () => {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [mobile, setMobile]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [role, setRole]         = useState<"student" | "admin">("student");
  const [touched, setTouched]   = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const errs = validateRegister(name, email, mobile, password, confirm);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, mobile: true, password: true, confirm: true });
    if (Object.keys(errs).length) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const newUser = await register(name.trim(), email.trim(), password, role, mobile.trim());
      navigate(roleHome(newUser.role), { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg ?? "Registration failed. This email may already be in use.");
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
          noValidate
        >
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => touch("name")}
              className={inputCls(!!(touched.name && errs.name))}
              type="text"
              placeholder="John Smith"
              autoComplete="name"
            />
            {touched.name && errs.name && (
              <p className="mt-1 text-xs text-red-600">{errs.name}</p>
            )}
          </div>

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

          {/* Mobile */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile number</label>
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 select-none">
                +91
              </span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onBlur={() => touch("mobile")}
                className={inputCls(!!(touched.mobile && errs.mobile))}
                type="tel"
                placeholder="9876543210"
                autoComplete="tel-national"
                maxLength={10}
              />
            </div>
            {touched.mobile && errs.mobile && (
              <p className="mt-1 text-xs text-red-600">{errs.mobile}</p>
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
              autoComplete="new-password"
            />
            <PasswordStrength password={password} />
            {touched.password && errs.password && (
              <p className="mt-1 text-xs text-red-600">{errs.password}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => touch("confirm")}
              className={inputCls(!!(touched.confirm && errs.confirm))}
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {touched.confirm && errs.confirm && (
              <p className="mt-1 text-xs text-red-600">{errs.confirm}</p>
            )}
          </div>

          {/* Role selector */}
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

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{submitError}</p>
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
