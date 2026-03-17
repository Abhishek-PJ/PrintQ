import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { actionOrderApi, historyApi, queueApi, downloadFileApi, setPriorityApi } from "../api/orders";
import { Order } from "../types";
import { useSocket } from "../context/SocketContext";

const ACTION_CONFIG = {
  call:     { label: "Call",     cls: "rounded-xl bg-sky-500 hover:bg-sky-400 text-white" },
  print:    { label: "Print",    cls: "rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white" },
  skip:     { label: "Skip",     cls: "rounded-xl border border-amber-300 text-amber-600 hover:bg-amber-50" },
  complete: { label: "Complete", cls: "rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white" },
} as const;

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  called:    "bg-sky-50 text-sky-700 border border-sky-200",
  printing:  "bg-indigo-50 text-indigo-700 border border-indigo-200",
  skipped:   "bg-red-50 text-red-600 border border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const STATUS_BAR: Record<string, string> = {
  pending:   "bg-amber-400",
  called:    "bg-sky-500",
  printing:  "bg-indigo-500",
  skipped:   "bg-red-400",
  completed: "bg-emerald-500",
};

const AdminDashboard = () => {
  const { socket } = useSocket();
  const [queue, setQueue] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "called" | "printing" | "skipped" | "completed">("all");
  const [colorFilter, setColorFilter] = useState<"all" | "bw" | "color">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  const fetchQueue = async () => {
    const data = await queueApi();
    setQueue(data.queue);
  };

  const fetchHistory = async () => {
    const data = await historyApi({
      status: statusFilter,
      colorMode: colorFilter,
      from: fromDate || undefined,
      to: toDate || undefined,
      search: search || undefined,
    });
    setHistory(data.orders);
  };

  // Keep a ref to the latest fetchHistory so the socket handler never captures stale filter state
  const fetchHistoryRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { fetchHistoryRef.current = fetchHistory; });

  // Initial data load
  useEffect(() => {
    void fetchQueue();
    void fetchHistory();
  }, []);

  // Re-subscribe whenever the shared socket instance changes
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      void fetchQueue();
      void fetchHistoryRef.current();
    };
    socket.on("queue:update", handler);
    return () => { socket.off("queue:update", handler); };
  }, [socket]);

  useEffect(() => { void fetchHistory(); }, [statusFilter, colorFilter, fromDate, toDate, search]);

  const takeAction = async (id: string, action: "call" | "print" | "skip" | "complete") => {
    try {
      await actionOrderApi(id, action);
      toast.success(`Order ${action}ed successfully`);
      await fetchQueue();
      await fetchHistory();
    } catch {
      toast.error(`Failed to apply action: ${action}`);
    }
  };

  const togglePriority = async (id: string, current: boolean) => {
    try {
      await setPriorityApi(id, !current);
      toast.success(!current ? "⚡ Marked as urgent" : "Priority removed");
      await fetchQueue();
    } catch {
      toast.error("Failed to update priority.");
    }
  };

  const downloadFile = async (id: string) => {
    const tid = toast.loading("Generating download link\u2026");
    try {
      const { url } = await downloadFileApi(id);
      toast.dismiss(tid);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.dismiss(tid);
      toast.error("Failed to get download link");
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, called: 0, printing: 0, skipped: 0, completed: 0 };
    history.forEach((o) => { counts[o.status] += 1; });
    return counts;
  }, [history]);

  const colorCounts = useMemo(() =>
    history.reduce((acc, order) => {
      (order.printOptions.printRules || []).forEach((r) => { acc[r.colorMode] += 1; });
      return acc;
    }, { bw: 0, color: 0 }),
  [history]);

  const maxStatusValue = Math.max(1, ...Object.values(statusCounts));
  const maxColorValue  = Math.max(1, colorCounts.bw, colorCounts.color);
  const totalCopies    = useMemo(() => history.reduce((a, o) => a + (o.printOptions.copies || 0), 0), [history]);
  const totalRevenue   = useMemo(() => history.reduce((a, o) => a + (o.totalPrice || 0), 0), [history]);

  const statCards = [
    { label: "Orders in history", value: history.length, icon: "📋", accent: "border-l-indigo-500" },
    { label: "Total copies",      value: totalCopies,    icon: "🖨️",  accent: "border-l-sky-500"    },
    { label: "Revenue (filtered)", value: `\u20b9${totalRevenue.toFixed(2)}`, icon: "\u20b9", accent: "border-l-emerald-500" },
    { label: "Live queue",        value: queue.length,   icon: "🔴",  accent: "border-l-rose-500"   },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" toastOptions={{ className: "text-sm font-medium" }} />

      {/* ── Header ── */}
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Admin Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-400">Manage print queue &amp; orders</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className={`rounded-2xl border border-slate-100 bg-white border-l-4 ${s.accent} p-4 shadow-sm`}>
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 leading-snug">{s.label}</p>
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-800">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Analytics ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Status Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(statusCounts).map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[label] ?? ""}`}>
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${STATUS_BAR[label] ?? "bg-slate-400"}`}
                      style={{ width: `${(value / maxStatusValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Color Mode</h2>
            <div className="space-y-3">
              {([["Black & White", colorCounts.bw, "bg-slate-600"], ["Color", colorCounts.color, "bg-rose-500"]] as [string, number, string][]).map(
                ([label, value, barColor]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-600">{label}</span>
                      <span className="text-xs font-semibold text-slate-600">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${(value / maxColorValue) * 100}%` }} />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ── Live Queue ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              <h2 className="text-sm font-bold text-slate-800">Live Queue</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {queue.length} orders
            </span>
          </div>

          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="mb-3 text-4xl">🗂️</span>
              <p className="text-sm font-medium">Queue is empty</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {queue.map((order) => (
                  <div key={order._id} className={`space-y-3 p-4 ${order.priority ? "bg-orange-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {order.priority && (
                          <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                            ⚡ Urgent
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          #{order.token}
                        </span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[order.status] ?? ""}`}>
                        {order.status}
                      </span>
                    </div>
                    <div>
                      <p className="truncate text-sm font-semibold text-slate-800">{order.originalFileName}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{order.student?.name || "N/A"} &middot; {order.student?.email || ""}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-800">&#8377;{order.totalPrice?.toFixed(2) ?? "0.00"}</span>
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${order.paymentStatus === "paid" ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                        {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(ACTION_CONFIG) as Array<keyof typeof ACTION_CONFIG>).map((key) => (
                        <button key={key} onClick={() => void takeAction(order._id, key)}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${ACTION_CONFIG[key].cls}`}>
                          {ACTION_CONFIG[key].label}
                        </button>
                      ))}
                      <button
                        onClick={() => void togglePriority(order._id, order.priority ?? false)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          order.priority
                            ? "border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {order.priority ? "Remove Priority" : "⚡ Urgent"}
                      </button>
                      {!order.fileDeleted && (
                        <button onClick={() => void downloadFile(order._id)}
                          className="rounded-xl border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50">
                          &#8595; Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 text-left font-bold">Token</th>
                      <th className="px-5 py-3 text-left font-bold">Student</th>
                      <th className="px-5 py-3 text-left font-bold">Document</th>
                      <th className="px-5 py-3 text-left font-bold">Total</th>
                      <th className="px-5 py-3 text-left font-bold">Payment</th>
                      <th className="px-5 py-3 text-left font-bold">Status</th>
                      <th className="px-5 py-3 text-left font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.map((order) => (
                      <tr key={order._id} className={`transition-colors hover:bg-slate-50 ${order.priority ? "bg-orange-50 hover:bg-orange-100" : ""}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {order.priority && (
                              <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                                ⚡
                              </span>
                            )}
                            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                              #{order.token}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{order.student?.name || "N/A"}</p>
                          <p className="text-xs text-slate-400">{order.student?.email || ""}</p>
                        </td>
                        <td className="max-w-[160px] px-5 py-3.5">
                          <p className="truncate text-slate-700">{order.originalFileName}</p>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800">&#8377;{order.totalPrice?.toFixed(2) ?? "0.00"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${order.paymentStatus === "paid" ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                            {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[order.status] ?? ""}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(ACTION_CONFIG) as Array<keyof typeof ACTION_CONFIG>).map((key) => (
                              <button key={key} onClick={() => void takeAction(order._id, key)}
                                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${ACTION_CONFIG[key].cls}`}>
                                {ACTION_CONFIG[key].label}
                              </button>
                            ))}
                            <button
                              onClick={() => void togglePriority(order._id, order.priority ?? false)}
                              className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                order.priority
                                  ? "border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-200"
                                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {order.priority ? "Remove Priority" : "⚡ Urgent"}
                            </button>
                            {!order.fileDeleted && (
                              <button onClick={() => void downloadFile(order._id)}
                                className="rounded-xl border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50">
                                &#8595; Download
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── History ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">Order History</h2>
            <p className="mt-0.5 text-xs text-slate-400">Filter and review past orders</p>
          </div>

          {/* Filters */}
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100">
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="called">Called</option>
                <option value="printing">Printing</option>
                <option value="skipped">Skipped</option>
                <option value="completed">Completed</option>
              </select>
              <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value as typeof colorFilter)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100">
                <option value="all">All color modes</option>
                <option value="bw">Black &amp; White</option>
                <option value="color">Color</option>
              </select>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">From</span>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-12 pr-3 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">To</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />
              </div>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filename\u2026"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />
            </div>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="mb-3 text-4xl">📭</span>
              <p className="text-sm font-medium">No orders match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 text-left font-bold">Date</th>
                    <th className="px-5 py-3 text-left font-bold">Token</th>
                    <th className="px-5 py-3 text-left font-bold">Student</th>
                    <th className="px-5 py-3 text-left font-bold">Document</th>
                    <th className="px-5 py-3 text-left font-bold">Total</th>
                    <th className="px-5 py-3 text-left font-bold">Payment</th>
                    <th className="px-5 py-3 text-left font-bold">Copies</th>
                    <th className="px-5 py-3 text-left font-bold">Status</th>
                    <th className="px-5 py-3 text-left font-bold">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((order) => (
                    <tr key={`history-${order._id}`} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          #{order.token}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{order.student?.name || "N/A"}</td>
                      <td className="max-w-[150px] px-5 py-3.5">
                        <p className="truncate text-slate-700">{order.originalFileName}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-bold text-slate-800">&#8377;{order.totalPrice?.toFixed(2) ?? "0.00"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${order.paymentStatus === "paid" ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                          {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{order.printOptions.copies}</td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[order.status] ?? ""}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {order.fileDeleted ? (
                          <span className="text-xs italic text-slate-400">Deleted</span>
                        ) : (
                          <button onClick={() => void downloadFile(order._id)}
                            className="rounded-xl border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50">
                            &#8595; Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
