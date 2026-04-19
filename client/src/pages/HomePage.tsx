import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleHome = (role: string) =>
  role === "superadmin" ? "/superadmin" : role === "admin" ? "/admin" : "/student";

function StatCounter({ value, label, tone }: { value: number; label: string; tone: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        let current = 0;
        const increment = Math.ceil(value / 50);
        const timer = setInterval(() => {
          current += increment;
          if (current >= value) {
            setCount(value);
            clearInterval(timer);
          } else {
            setCount(current);
          }
        }, 30);
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-50 p-4 text-center shadow-sm sm:p-5">
      <span className={`mx-auto mb-2 inline-flex h-2 w-14 rounded-full ${tone}`} />
      <div className="text-3xl font-bold text-slate-900">
        <span ref={ref}>{count.toLocaleString()}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description, tone }: { icon: string; title: string; description: string; tone: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`group cursor-pointer rounded-2xl border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-50 p-5 text-center shadow-sm transition-all duration-300 md:hover:-translate-y-1 md:hover:border-slate-400 md:hover:shadow-lg ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
    >
      <span className={`mx-auto inline-flex rounded-xl p-2.5 text-2xl sm:text-3xl ${tone}`}>{icon}</span>
      <div className="mt-3">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{description}</p>
      </div>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`group flex gap-4 rounded-2xl border border-slate-300/80 bg-gradient-to-br from-slate-100 to-slate-200 p-4 shadow-sm transition-all duration-500 md:min-h-[170px] md:flex-col md:p-5 md:hover:-translate-y-1 md:hover:shadow-md ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-bold text-white md:h-12 md:w-12 md:text-base">{number}</div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed z-50 w-full transition-all duration-300 ${
        isScrolled ? "border-b border-slate-300/80 bg-slate-100/95 shadow-sm backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-3 md:px-12 md:py-4">
        <Link to="/" className="text-xl font-bold transition-transform duration-300 hover:scale-105">
          Print<span className="text-indigo-600">Q</span>
        </Link>
        <Link
          to="/register"
          className="rounded-lg border border-slate-400/70 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-200 hover:shadow-lg sm:px-4 sm:text-sm"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}

const HomePage = () => {
  const { user, loading } = useAuth();
  const [queuePosition, setQueuePosition] = useState(1);
  const [progressPercent, setProgressPercent] = useState(20);

  useEffect(() => {
    const progressSteps = [20, 40, 60, 80, 100];
    let currentStep = 0;

    const progressTimer = setInterval(() => {
      currentStep = (currentStep + 1) % progressSteps.length;
      setProgressPercent(progressSteps[currentStep]);

      if (progressSteps[currentStep] === 20 && currentStep === 0) {
        setQueuePosition((prev) => (prev % 5) + 1);
      }
    }, 1000);

    return () => clearInterval(progressTimer);
  }, []);

  if (!loading && user) return <Navigate to={roleHome(user.role)} replace />;

  return (
    <main className="overflow-hidden bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 text-slate-900">
      <Navigation />

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-300 to-slate-100 px-6 pb-16 pt-24 md:pt-20">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="animate-float absolute left-10 top-20 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
          <div
            className="animate-float absolute bottom-20 right-10 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="mx-auto w-full max-w-[1200px] text-center">
          <div className="animate-fade-in-up mb-6 inline-block rounded-full border border-slate-400/70 bg-slate-100 px-3 py-1">
            <p className="text-xs font-medium text-slate-700">Skip the Line. Print Smarter.</p>
          </div>

          <h1 className="animate-fade-in-up text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl" style={{ animationDelay: "0.1s" }}>
            Your Queue, Your Time
          </h1>

          <p
            className="animate-fade-in-up mx-auto mb-10 mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg"
            style={{ animationDelay: "0.2s" }}
          >
            Upload documents, get a live token, and track your order in real-time. No waiting. No guessing.
          </p>

          <div className="animate-fade-in-up flex flex-col justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.3s" }}>
            <Link
              to="/register"
              className="w-full rounded-lg bg-slate-800 px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-300 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-400/40 sm:w-auto md:hover:scale-105"
            >
              Upload Now
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-lg border border-slate-400/70 bg-slate-100 px-6 py-3 text-center text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-200 hover:shadow-lg sm:w-auto md:hover:scale-105"
            >
              Learn More
            </a>
          </div>

          <div className="animate-fade-in-up mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3 md:mt-16 md:gap-6" style={{ animationDelay: "0.4s" }}>
            <StatCounter value={2847} label="Orders Today" tone="bg-indigo-500" />
            <StatCounter value={12} label="Active Shops" tone="bg-cyan-500" />
            <StatCounter value={98} label="Uptime %" tone="bg-emerald-500" />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-gradient-to-b from-slate-100 to-slate-200 py-20 px-6">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">How It Works</h2>
            <p className="text-slate-500">Four simple steps to perfect prints</p>
          </div>

          <div className="grid gap-8 md:grid-cols-4">
            <StepCard number="01" title="Upload" description="Send your PDF or DOCX file securely" />
            <StepCard number="02" title="Configure" description="Choose colors, copies, and binding" />
            <StepCard number="03" title="Track" description="Get a token and monitor progress live" />
            <StepCard number="04" title="Collect" description="Pick up when your order is ready" />
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-slate-200 to-slate-100 py-20 px-6">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-12 space-y-2 text-center">
            <h2 className="mb-4 text-3xl font-bold animate-fade-in-up md:text-4xl">Real-Time Tracking</h2>
            <p className="animate-fade-in-up text-slate-500" style={{ animationDelay: "0.1s" }}>
              See exactly where you are in the queue
            </p>
          </div>

          <div className="group animate-scale-in mx-auto max-w-2xl space-y-6 rounded-2xl border border-slate-300/80 bg-gradient-to-br from-slate-100 to-slate-200 p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-xl border border-slate-300/70 bg-slate-50 p-3 sm:p-4">
                <p className="mb-1 text-xs text-slate-500">YOUR TOKEN</p>
                <p className="text-3xl font-bold text-indigo-600 transition-transform duration-300 sm:text-4xl md:group-hover:scale-110">
                  A{String(queuePosition).padStart(3, "0")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300/70 bg-slate-50 p-3 sm:p-4 sm:text-right">
                <p className="mb-1 text-xs text-slate-500">QUEUE POSITION</p>
                <p className="text-2xl font-bold transition-transform duration-300 sm:text-3xl md:group-hover:scale-110">{queuePosition}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Progress</span>
                <span className="animate-pulse-glow font-medium text-indigo-600">{progressPercent}%</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-300">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="animate-pulse text-center text-xs text-slate-500">Updates every 10 seconds</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-slate-100 to-slate-200 py-20 px-6">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Smart Features For Smarter Printing</h2>
            <p className="text-slate-500">Reduce delays, avoid confusion, and keep every order on track.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon="📡" title="Live Queue Updates" description="See order status change instantly for students and shop admins" tone="bg-slate-200" />
            <FeatureCard icon="🤖" title="One-Click Print Automation" description="When admin clicks print, the system handles the full print process automatically" tone="bg-slate-300/80" />
            <FeatureCard icon="📄" title="Page-Wise Print Settings" description="Choose different print options for different page ranges" tone="bg-zinc-200" />
            <FeatureCard icon="💰" title="Price Before You Submit" description="See total printing cost before placing your order" tone="bg-stone-200" />
            <FeatureCard icon="🗑️" title="Auto File Deletion" description="Your uploaded files are deleted after printing is completed" tone="bg-neutral-200" />
              <FeatureCard icon="👁️" title="File preview" description="Preview your files before printing for every rule" tone="bg-gray-200" />
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-slate-200 to-slate-100 py-20 px-6">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Why You Will Actually Enjoy This</h2>
            <p className="text-slate-500">Less queue chaos, fewer printer headaches, and smoother days for everyone.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-50 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="mb-4 inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                Students
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Spend less time standing in queues and more time on what matters
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Know exactly when your print is ready
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Your file is deleted after printing is complete
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Avoid surprise charges at checkout
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Upload PDF or Word files directly in a few clicks 
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-50 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="mb-4 inline-flex items-center rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                Shop Admins
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Less manual work at the counter
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Handle more orders during busy hours 
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Analyze order history and customer preferences with built-in analytics
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Reduce delays and queue confusions during peak times
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Focus on providing great service instead of managing queues
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-700 py-20 px-6 text-white">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="animate-float absolute right-20 top-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
          <div
            className="animate-float absolute bottom-0 left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl"
            style={{ animationDelay: "1.5s" }}
          />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <h2 className="animate-fade-in-up mb-6 text-3xl font-bold md:text-4xl">Ready to Print Smart?</h2>
          <p className="animate-fade-in-up mb-10 text-base opacity-90 md:text-lg" style={{ animationDelay: "0.1s" }}>
            Join thousands of students skipping the queue.
          </p>
          <Link
            to="/register"
            className="animate-fade-in-up inline-flex rounded-lg bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-800 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{ animationDelay: "0.2s" }}
          >
            Get Started Free
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-300/80 bg-gradient-to-b from-slate-200 to-slate-300 px-6 py-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <p className="text-sm font-semibold text-slate-900">
            Print<span className="text-indigo-600">Q</span>
          </p>
          <p className="text-xs text-slate-500">© 2026 PrintQ. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
};

export default HomePage;
