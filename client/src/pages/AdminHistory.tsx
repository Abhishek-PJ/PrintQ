import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { historyApi, downloadFileApi } from "../api/orders";
import { Order } from "../types";
import { useSocket } from "../context/SocketContext";

type StatusFilter = "all" | "pending" | "called" | "printing" | "skipped" | "completed";
type ColorFilter  = "all" | "bw" | "color";

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  called:    "bg-sky-50 text-sky-700 border border-sky-200",
  printing:  "bg-indigo-50 text-indigo-700 border border-indigo-200",
  skipped:   "bg-red-50 text-red-600 border border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const AdminHistory = () => {
  const { socket } = useSocket();
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [colorFilter, setColorFilter]   = useState<ColorFilter>("all");
  const [fromDate, setFromDate]         = useState("");
  const [toDate, setToDate]             = useState("");
  const [search, setSearch]             = useState("");

  const fetchHistory = async () => {
    const data = await historyApi({
      status:    statusFilter,
      colorMode: colorFilter,
      from:      fromDate || undefined,
      to:        toDate   || undefined,
      search:    search   || undefined,
    });
    setOrders(data.orders);
    setLoading(false);
  };

  const fetchRef = useRef(fetchHistory);
  useEffect(() => { fetchRef.current = fetchHistory; });

  useEffect(() => { void fetchHistory(); }, [statusFilter, colorFilter, fromDate, toDate, search]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => { void fetchRef.current(); };
    socket.on("queue:update", handler);
    return () => { socket.off("queue:update", handler); };
  }, [socket]);

  const handleDownload = async (id: string) => {
    const tid = toast.loading("Generating link…");
    try {
      const { url } = await downloadFileApi(id);
      toast.dismiss(tid);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.dismiss(tid);
      toast.error("Failed to get download link.");
    }
  };

  const selectCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Order History</h1>
        <p className="mt-0.5 text-sm text-slate-400">Filter and review all past orders</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectCls}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="called">Called</option>
            <option value="printing">Printing</option>
            <option value="skipped">Skipped</option>
            <option value="completed">Completed</option>
          </select>

          <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value as ColorFilter)} className={selectCls}>
            <option value="all">All color modes</option>
            <option value="bw">Black &amp; White</option>
            <option value="color">Color</option>
          </select>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className={`w-full pl-12 pr-3 py-2 ${selectCls}`} />
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 ${selectCls}`} />
          </div>

          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename…"
            className={`${selectCls} placeholder:text-slate-400`} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading&hellip;
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <span className="mb-3 text-5xl">📭</span>
            <p className="text-sm font-medium">No orders match your filters</p>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-5 py-3">
              <span className="text-xs font-semibold text-slate-500">{orders.length} result{orders.length !== 1 ? "s" : ""}</span>
            </div>
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
                  {orders.map((order) => (
                    <tr key={order._id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          #{order.token}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{order.student?.name || "N/A"}</td>
                      <td className="max-w-[150px] px-5 py-3.5">
                        <p className="truncate text-slate-700">{order.originalFileName}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{order.printOptions.paperSize}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-bold text-slate-800">
                        &#8377;{order.totalPrice?.toFixed(2) ?? "0.00"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          order.paymentStatus === "paid"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-yellow-200 bg-yellow-50 text-yellow-700"
                        }`}>
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
                          <button
                            onClick={() => void handleDownload(order._id)}
                            className="rounded-xl border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50"
                          >
                            ↓ Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminHistory;
