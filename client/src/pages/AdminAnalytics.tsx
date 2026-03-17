import { useEffect, useMemo, useRef, useState } from "react";
import { historyApi, queueApi } from "../api/orders";
import { Order } from "../types";
import { useSocket } from "../context/SocketContext";

// ─── Chart primitives ─────────────────────────────────────────────────────────

type BarDatum = { label: string; value: number };

const BarChart = ({
  data,
  barClass = "fill-indigo-500",
  height = 100,
}: {
  data: BarDatum[];
  barClass?: string;
  height?: number;
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const W = 400;
  const bw = Math.max(1, W / n - 2);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 4);
        return (
          <rect
            key={i}
            x={i * (W / n) + 1}
            y={height - barH}
            width={bw}
            height={barH}
            className={barClass}
            rx="2"
          >
            <title>{d.label}: {d.value}</title>
          </rect>
        );
      })}
    </svg>
  );
};

const AreaChart = ({
  data,
  lineColor = "#10b981",
  height = 100,
}: {
  data: BarDatum[];
  lineColor?: string;
  height?: number;
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 400;
  if (data.length < 2) {
    return <div className="flex items-center justify-center text-xs text-slate-300" style={{ height }}>No data</div>;
  }
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * W,
    (height - 8) - (d.value / max) * (height - 20),
  ]);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${W},${height} L0,${height} Z`;
  const gradId = `ag${lineColor.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={lineColor}>
          <title>{data[i].label}</title>
        </circle>
      ))}
    </svg>
  );
};

type DonutSegment = { label: string; value: number; color: string };

const DonutChart = ({ segments }: { segments: DonutSegment[] }) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const cx = 50, cy = 50, r = 32;
  const circ = 2 * Math.PI * r;
  let cumAngle = -90;
  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const startAngle = cumAngle;
    cumAngle += frac * 360;
    return { ...seg, frac, startAngle, dash: frac * circ };
  });
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="15" />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="15"
          strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
          style={{ transform: `rotate(${arc.startAngle}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        >
          <title>{arc.label}: {arc.value} ({(arc.frac * 100).toFixed(1)}%)</title>
        </circle>
      ))}
      <circle cx={cx} cy={cy} r="20" fill="white" />
    </svg>
  );
};

const StackedBar = ({ items }: { items: { label: string; value: number; color: string }[] }) => {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.color} transition-all duration-500`}
            style={{ width: `${(item.value / total) * 100}%` }}
            title={`${item.label}: ${item.value}`}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className={`inline-block h-2 w-2 rounded-full ${item.color}`} />
              {item.label}
            </span>
            <span className="font-semibold text-slate-700">
              {item.value}
              <span className="ml-1 font-normal text-slate-400">({Math.round((item.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const KpiCard = ({
  label, value, sub, accent, dot, ring,
}: {
  label: string; value: string | number; sub: string; accent: string; dot: string; ring?: number;
}) => (
  <div className={`rounded-2xl border border-slate-100 bg-white border-l-4 ${accent} p-4 shadow-sm`}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 leading-snug">{label}</p>
      {ring !== undefined ? (
        <div className="relative h-7 w-7 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="-rotate-90 h-7 w-7">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#0ea5e9" strokeWidth="4"
              strokeDasharray={`${(ring / 100) * 94.2} 94.2`} strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
      )}
    </div>
    <p className="mt-1.5 text-2xl font-bold text-slate-800 leading-none">{value}</p>
    <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
  </div>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "7 days",   value: 7  },
  { label: "30 days",  value: 30 },
  { label: "90 days",  value: 90 },
  { label: "All time", value: 0  },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending:   "#f59e0b",
  called:    "#0ea5e9",
  printing:  "#6366f1",
  skipped:   "#f87171",
  completed: "#10b981",
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

// ─── Main component ───────────────────────────────────────────────────────────

const AdminAnalytics = () => {
  const { socket } = useSocket();
  const [history, setHistory]         = useState<Order[]>([]);
  const [queueOrders, setQueueOrders] = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [range, setRange]             = useState(30);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    const [histData, queueData] = await Promise.all([historyApi({}), queueApi()]);
    setHistory(histData.orders);
    setQueueOrders(queueData.queue);
    setLoading(false);
    setLastRefresh(new Date());
  };

  const fetchRef = useRef(fetchAll);
  useEffect(() => { fetchRef.current = fetchAll; });
  useEffect(() => { void fetchAll(); }, []);
  useEffect(() => {
    if (!socket) return;
    const h = () => { void fetchRef.current(); };
    socket.on("queue:update", h);
    return () => { socket.off("queue:update", h); };
  }, [socket]);

  // ── Filtered slice based on range ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!range) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return history.filter((o) => new Date(o.createdAt) >= cutoff);
  }, [history, range]);

  // ── KPI derivations ───────────────────────────────────────────────────────
  const totalRevenue   = useMemo(() => filtered.reduce((a, o) => a + (o.totalPrice ?? 0), 0), [filtered]);
  const paidRevenue    = useMemo(() => filtered.filter((o) => o.paymentStatus === "paid").reduce((a, o) => a + o.totalPrice, 0), [filtered]);
  const paidCount      = useMemo(() => filtered.filter((o) => o.paymentStatus === "paid").length, [filtered]);
  const completedCount = useMemo(() => filtered.filter((o) => o.status === "completed").length, [filtered]);
  const skippedCount   = useMemo(() => filtered.filter((o) => o.status === "skipped").length, [filtered]);
  const priorityCount  = useMemo(() => filtered.filter((o) => o.priority).length, [filtered]);
  const completionRate = useMemo(() => {
    const base = completedCount + skippedCount;
    return base ? Math.round((completedCount / base) * 100) : 0;
  }, [completedCount, skippedCount]);
  const avgOrderValue  = useMemo(() => (filtered.length ? totalRevenue / filtered.length : 0), [totalRevenue, filtered]);
  const uniqueStudents = useMemo(() => new Set(filtered.map((o) => o.student?.email).filter(Boolean)).size, [filtered]);
  const totalPages     = useMemo(() =>
    filtered.reduce((acc, o) => {
      const pages = o.printOptions.printRules.reduce((s, r) => s + (r.toPage - r.fromPage + 1), 0);
      return acc + pages * (o.printOptions.copies ?? 1);
    }, 0),
  [filtered]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartDays = range || 30;

  const dailyStats = useMemo(() => {
    return Array.from({ length: chartDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (chartDays - 1 - i));
      const key   = d.toISOString().slice(0, 10);
      const slice = filtered.filter((o) => o.createdAt.slice(0, 10) === key);
      return {
        label:   fmtDate(d.toISOString()),
        orders:  slice.length,
        revenue: slice.filter((o) => o.paymentStatus === "paid").reduce((a, o) => a + o.totalPrice, 0),
      };
    });
  }, [filtered, chartDays]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, called: 0, printing: 0, skipped: 0, completed: 0 };
    filtered.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [filtered]);

  const colorCounts = useMemo(() =>
    filtered.reduce((acc, o) => {
      o.printOptions.printRules.forEach((r) => { acc[r.colorMode] += 1; });
      return acc;
    }, { bw: 0, color: 0 }),
  [filtered]);

  const peakHours = useMemo(() => {
    const hours = Array<number>(24).fill(0);
    filtered.forEach((o) => { hours[new Date(o.createdAt).getHours()] += 1; });
    return hours;
  }, [filtered]);

  const paperCounts = useMemo(() => ({
    A4: filtered.filter((o) => o.printOptions.paperSize === "A4").length,
    A3: filtered.filter((o) => o.printOptions.paperSize === "A3").length,
  }), [filtered]);

  const bindingCounts = useMemo(() =>
    filtered.reduce((acc, o) => {
      const b = o.printOptions.binding ?? "none";
      acc[b] = (acc[b] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  [filtered]);

  const peakHourMax = Math.max(1, ...peakHours);

  const donutStatus: DonutSegment[] = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: k, value: v, color: STATUS_COLORS[k] ?? "#94a3b8" }));

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 gap-2">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Refreshed at {lastRefresh.toLocaleTimeString()} · {filtered.length} orders in view
          </p>
        </div>
        {/* Range pills */}
        <div className="flex gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                range === opt.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Revenue"     value={`₹${totalRevenue.toFixed(0)}`}
          sub={`₹${paidRevenue.toFixed(0)} collected`}
          accent="border-l-emerald-500" dot="bg-emerald-500"
        />
        <KpiCard
          label="Orders"            value={filtered.length}
          sub={`${completedCount} completed`}
          accent="border-l-indigo-500"  dot="bg-indigo-500"
        />
        <KpiCard
          label="Completion Rate"   value={`${completionRate}%`}
          sub={`${skippedCount} skipped`}
          accent="border-l-sky-500"     dot="bg-sky-500"    ring={completionRate}
        />
        <KpiCard
          label="Live Queue"        value={queueOrders.length}
          sub={`${priorityCount} urgent`}
          accent="border-l-rose-500"    dot="bg-rose-500"
        />
        <KpiCard
          label="Avg Order Value"   value={`₹${avgOrderValue.toFixed(0)}`}
          sub={`${paidCount} paid`}
          accent="border-l-violet-500"  dot="bg-violet-500"
        />
        <KpiCard
          label="Pages Printed"     value={totalPages.toLocaleString()}
          sub={`${colorCounts.color} color pages`}
          accent="border-l-amber-400"   dot="bg-amber-400"
        />
        <KpiCard
          label="Unique Students"   value={uniqueStudents}
          sub="in this period"
          accent="border-l-teal-500"    dot="bg-teal-500"
        />
        <KpiCard
          label="Priority Orders"   value={priorityCount}
          sub={`of ${filtered.length} total`}
          accent="border-l-orange-500"  dot="bg-orange-500"
        />
      </div>

      {/* ── Daily bar + Area chart ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Daily Orders</h2>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">{chartDays}d</span>
          </div>
          <BarChart
            data={dailyStats.map((d) => ({ label: d.label, value: d.orders }))}
            barClass="fill-indigo-500"
            height={96}
          />
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{dailyStats[0]?.label}</span>
            <span>{dailyStats[Math.floor(dailyStats.length / 2)]?.label}</span>
            <span>{dailyStats[dailyStats.length - 1]?.label}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Daily Revenue (Paid)</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">₹</span>
          </div>
          <AreaChart
            data={dailyStats.map((d) => ({ label: `${d.label} — ₹${d.revenue.toFixed(0)}`, value: d.revenue }))}
            lineColor="#10b981"
            height={96}
          />
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{dailyStats[0]?.label}</span>
            <span>{dailyStats[Math.floor(dailyStats.length / 2)]?.label}</span>
            <span>{dailyStats[dailyStats.length - 1]?.label}</span>
          </div>
        </div>
      </div>

      {/* ── Peak Hours heatmap ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Peak Hours</h2>
          <span className="text-[10px] text-slate-400">
            Busiest: {HOUR_LABELS[peakHours.indexOf(peakHourMax)]} ({peakHourMax} orders)
          </span>
        </div>
        <div className="flex items-end gap-0.5" style={{ height: 64 }}>
          {peakHours.map((count, h) => {
            const pct = (count / peakHourMax) * 100;
            return (
              <div key={h} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: 64 }}>
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${Math.max(3, pct)}%`,
                    backgroundColor: pct > 65 ? "#4f46e5" : pct > 35 ? "#818cf8" : "#e0e7ff",
                  }}
                >
                  <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {HOUR_LABELS[h]}: {count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between px-1 text-[10px] text-slate-400">
          <span>12a</span><span>3a</span><span>6a</span><span>9a</span>
          <span>12p</span><span>3p</span><span>6p</span><span>9p</span><span>11p</span>
        </div>
      </div>

      {/* ── Donut row ── */}
      <div className="grid gap-4 sm:grid-cols-3">

        {/* Status donut */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Order Status</h2>
          {donutStatus.length ? (
            <>
              <DonutChart segments={donutStatus} />
              <div className="mt-4 space-y-1.5">
                {donutStatus.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 capitalize text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {s.value}
                      <span className="ml-1 font-normal text-slate-400">
                        ({((s.value / filtered.length) * 100).toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="py-8 text-center text-xs text-slate-300">No data</div>}
        </div>

        {/* Color mode donut */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Color Mode</h2>
          <DonutChart segments={[
            { label: "Black & White", value: colorCounts.bw,    color: "#475569" },
            { label: "Color",         value: colorCounts.color, color: "#f43f5e" },
          ]} />
          <div className="mt-4 space-y-1.5">
            {([
              { label: "Black & White", value: colorCounts.bw,    color: "#475569" },
              { label: "Color",         value: colorCounts.color, color: "#f43f5e" },
            ] as DonutSegment[]).map((s) => {
              const total = colorCounts.bw + colorCounts.color || 1;
              return (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {s.value}
                    <span className="ml-1 font-normal text-slate-400">({Math.round((s.value / total) * 100)}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment donut */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Payment</h2>
          <DonutChart segments={[
            { label: "Paid",   value: paidCount,                   color: "#10b981" },
            { label: "Unpaid", value: filtered.length - paidCount, color: "#f59e0b" },
          ]} />
          <div className="mt-4 space-y-1.5">
            {[
              { label: "Paid",   value: paidCount,                   amount: paidRevenue,                  color: "#10b981" },
              { label: "Unpaid", value: filtered.length - paidCount, amount: totalRevenue - paidRevenue,   color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold text-slate-700">
                  {s.value}
                  <span className="ml-1 font-normal text-slate-400">₹{s.amount.toFixed(0)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Paper size + Binding ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Paper Size</h2>
          <StackedBar items={[
            { label: "A4", value: paperCounts.A4, color: "bg-violet-500"  },
            { label: "A3", value: paperCounts.A3, color: "bg-fuchsia-400" },
          ]} />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Binding Type</h2>
          <StackedBar items={[
            { label: "None",   value: bindingCounts["none"]   ?? 0, color: "bg-slate-400" },
            { label: "Staple", value: bindingCounts["staple"] ?? 0, color: "bg-sky-500"   },
            { label: "Spiral", value: bindingCounts["spiral"] ?? 0, color: "bg-teal-500"  },
          ]} />
        </div>
      </div>

    </div>
  );
};

export default AdminAnalytics;
