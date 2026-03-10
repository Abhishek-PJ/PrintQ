import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ── Homepage Navbar ─────────────────────────────────────── */
const HomeNav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-900/95 backdrop-blur shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        {/* Logo */}
        <Link to="/" className="text-3xl font-serif font-extrabold text-white tracking-widest">
          Print<span className="text-violet-400">Q</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
          <button onClick={() => scrollTo("how-it-works")} className="hover:text-white transition-colors">
            How it works
          </button>
          <button onClick={() => scrollTo("features")} className="hover:text-white transition-colors">
            Features
          </button>
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/30 transition hover:bg-violet-500 hover:-translate-y-0.5"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex flex-col justify-center items-center gap-1.5 p-2 md:hidden"
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-6 bg-white transition-all duration-300 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block h-0.5 w-6 bg-white transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-6 bg-white transition-all duration-300 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="bg-slate-900/98 backdrop-blur px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-4 pt-2 text-sm font-medium text-slate-300">
            <button onClick={() => scrollTo("how-it-works")} className="text-left hover:text-white">
              How it works
            </button>
            <button onClick={() => scrollTo("features")} className="text-left hover:text-white">
              Features
            </button>
            <hr className="border-white/10" />
            <Link to="/login" onClick={() => setMenuOpen(false)} className="hover:text-white">Sign in</Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-center font-semibold text-white"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

const roleHome = (role: string) =>
  role === "superadmin" ? "/superadmin" : role === "admin" ? "/admin" : "/student";

/* ── Scroll-reveal hook ───────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ── Animated counter ────────────────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = Math.ceil(to / 60);
      const id = setInterval(() => {
        start = Math.min(start + step, to);
        setVal(start);
        if (start >= to) clearInterval(id);
      }, 20);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ── Features data ───────────────────────────────────────── */
const features = [
  {
    icon: "📄",
    title: "Smart Upload",
    desc: "Upload any PDF document, set page-by-page print rules - color, B&W, single or double-sided - all in one form.",
    color: "from-violet-50 to-purple-50 border-violet-200",
    iconBg: "bg-violet-100",
  },
  {
    icon: "🎟️",
    title: "Instant Queue Token",
    desc: "Get a unique queue token the moment you submit. Watch your position update live - no refreshing needed.",
    color: "from-indigo-50 to-blue-50 border-indigo-200",
    iconBg: "bg-indigo-100",
  },
  {
    icon: "🔔",
    title: "Real-Time Notifications",
    desc: "Receive instant in-app alerts when called, printing, or ready for pickup. Never miss your turn.",
    color: "from-emerald-50 to-teal-50 border-emerald-200",
    iconBg: "bg-emerald-100",
  },
  {
    icon: "🖨️",
    title: "Shop Control Panel",
    desc: "Admins manage the full queue - call, print, skip, or complete orders with one click and track revenue.",
    color: "from-amber-50 to-orange-50 border-amber-200",
    iconBg: "bg-amber-100",
  },
  {
    icon: "💰",
    title: "Transparent Pricing",
    desc: "Preview the exact cost before submitting. Per-page pricing auto-calculated by color mode and paper size.",
    color: "from-rose-50 to-pink-50 border-rose-200",
    iconBg: "bg-rose-100",
  },
  {
    icon: "☁️",
    title: "Secure Cloud Storage",
    desc: "Files are stored on CloudFront-backed S3 and automatically deleted after printing - keeping your data safe.",
    color: "from-slate-50 to-zinc-50 border-slate-200",
    iconBg: "bg-slate-100",
  },
];

const steps = [
  { num: "01", title: "Register & Choose a Shop", desc: "Create a free account and select your nearest approved print shop." },
  { num: "02", title: "Upload Your Document",     desc: "Configure print rules page-by-page. Preview the price before you confirm." },
  { num: "03", title: "Get Your Token",           desc: "Receive a live queue token. Track your order status in real time." },
  { num: "04", title: "Pick Up When Ready",       desc: "Walk in when notified. Your perfectly printed document will be waiting." },
];

/* ── Page ────────────────────────────────────────────────── */
const HomePage = () => {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={roleHome(user.role)} replace />;

  const featRef   = useReveal();
  const stepsRef  = useReveal();
  const statsRef  = useReveal();
  const ctaRef    = useReveal();

  return (
    <div className="overflow-x-hidden">
      <HomeNav />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#1e1048] to-[#2d1b69]">

        {/* Animated blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-blob absolute -top-24 -left-24 h-[480px] w-[480px] rounded-full bg-violet-600/25 blur-3xl" />
          <div className="animate-blob delay-400 absolute top-1/3 -right-32 h-[380px] w-[380px] rounded-full bg-purple-600/20 blur-3xl" />
          <div className="animate-blob delay-800 absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-indigo-400/15 blur-3xl" />
        </div>

        {/* Spinning ring decoration */}
        <div className="pointer-events-none absolute right-[5%] top-[10%] hidden lg:block opacity-20">
          <svg className="animate-spin-slow h-72 w-72" viewBox="0 0 288 288" fill="none">
            <circle cx="144" cy="144" r="130" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="8 6"/>
            <circle cx="144" cy="144" r="100" stroke="#c084fc" strokeWidth="1" strokeDasharray="4 8"/>
          </svg>
        </div>

        {/* Floating icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block">
          <span className="animate-float-a absolute left-[12%] top-[20%] text-4xl opacity-25 delay-200">🖨️</span>
          <span className="animate-float-b absolute left-[8%] bottom-[22%] text-3xl opacity-20 delay-500">📄</span>
          <span className="animate-float-c absolute right-[18%] top-[35%] text-3xl opacity-20 delay-300">🎟️</span>
          <span className="animate-float-a absolute right-[8%] bottom-[28%] text-2xl opacity-15 delay-700">📦</span>
          <span className="animate-float-b absolute left-[45%] top-[12%] text-2xl opacity-15 delay-900">✅</span>
        </div>

        {/* Hero content */}
        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="max-w-3xl">
            <h1 className="animate-fade-up delay-100 text-5xl font-extrabold leading-tight text-white sm:text-6xl lg:text-7xl">
              Print Smarter <br />
              <span className=" text-gradient">Not Harder</span>
            </h1>

            <p className="animate-fade-up delay-300 mt-6 text-lg text-slate-300 leading-relaxed max-w-xl">
              Upload your documents, get an instant queue token, and track your print
              order in real time. No waiting lines, just seamless printing.
            </p>

            <div className="animate-fade-up delay-500 mt-10 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:bg-violet-500 hover:shadow-violet-400/40 hover:-translate-y-0.5"
              >
                Get started free
                <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5"
              >
                Sign in
              </Link>
            </div>

            {/* Quick trust indicators */}
            <div className="animate-fade-up delay-700 mt-12 flex flex-wrap items-center gap-6 text-xs text-slate-400">
              {["Free to join", "Real-time queue", "Secure cloud files", "Works on mobile"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg className="text-violet-400" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none" className="w-full h-12 sm:h-16">
            <path d="M0 80V40C240 80 480 0 720 40s480 40 720 0V80H0Z" fill="#ffffff" />
          </svg>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────── */}
      <section className="bg-white py-12 sm:py-16">
        <div ref={statsRef} className="reveal mx-auto max-w-5xl px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: 500,  suffix: "+", label: "Orders Processed", color: "text-violet-600"  },
              { value: 50,   suffix: "+", label: "Print Shops",       color: "text-purple-600"  },
              { value: 1200, suffix: "+", label: "Happy Students",    color: "text-emerald-600" },
              { value: 99,   suffix: "%", label: "Uptime",            color: "text-amber-500"   },
            ].map(({ value, suffix, label, color }) => (
              <div key={label} className="rounded-2xl bg-white border border-slate-200 p-6 text-center shadow-sm card-hover">
                <p className={`text-3xl font-extrabold ${color} animate-count-up`}>
                  <Counter to={value} suffix={suffix} />
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#f5f3ff]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div ref={stepsRef} className="reveal text-center mb-14">
            <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 border border-violet-200 mb-3">
              How it works
            </span>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Ready in 4 simple steps</h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto">From signup to pickup - the whole process takes minutes, not hours.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ num, title, desc }, i) => {
              const ref = useReveal();
              return (
                <div
                  key={num}
                  ref={ref}
                  className={`reveal card-hover relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm delay-${(i + 1) * 100}`}
                >
                  {/* Connector line (not on last) */}
                  {i < steps.length - 1 && (
                    <div className="absolute right-0 top-8 hidden translate-x-1/2 lg:block">
                      <svg width="48" height="2"><line x1="0" y1="1" x2="48" y2="1" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="4 3"/></svg>
                    </div>
                  )}
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white text-sm font-bold shadow-md shadow-violet-500/25">
                    {num}
                  </div>
                  <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-24 bg-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div ref={featRef} className="reveal text-center mb-14">
            <span className="inline-block rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600 border border-violet-100 mb-3">
              Features
            </span>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Everything you need</h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto">A complete print workflow - from submission to pickup - in one platform.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon, title, desc, color, iconBg }, i) => {
              const ref = useReveal();
              return (
                <div
                  key={title}
                  ref={ref}
                  className={`reveal card-hover rounded-2xl border bg-gradient-to-br p-6 ${color} delay-${(i + 1) * 100}`}
                >
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${iconBg}`}>
                    {icon}
                  </div>
                  <h3 className="font-semibold text-slate-800">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-[#f5f3ff]">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div ref={ctaRef} className="reveal rounded-3xl bg-gradient-to-br from-[#0f0c29] via-[#1e1048] to-[#2d1b69] p-10 text-center shadow-2xl relative overflow-hidden">
            {/* Mini blobs inside CTA */}
            <div className="pointer-events-none absolute -top-12 -left-12 h-48 w-48 rounded-full bg-violet-600/25 blur-2xl animate-blob" />
            <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-purple-600/20 blur-2xl animate-blob delay-500" />

            <div className="relative">
              <span className="inline-block rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-300 mb-4">
                Start today - it's free
              </span>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Ready to ditch the queue?</h2>
              <p className="mt-4 text-slate-300 max-w-md mx-auto text-sm leading-relaxed">
                Join students and shop owners already using PrintQ to make printing effortless.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:bg-violet-500 hover:-translate-y-0.5"
                >
                  Create free account
                  <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 hover:-translate-y-0.5 transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-violet-100 bg-[#f5f3ff] py-8">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-semibold text-slate-700">PrintQ</p>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} PrintQ. Intelligent print queue management.</p>
        </div>
      </footer>

    </div>
  );
};

export default HomePage;
