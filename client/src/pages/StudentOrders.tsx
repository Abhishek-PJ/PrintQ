import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { myOrdersApi, markPaidApi } from "../api/orders";
import { useSocket } from "../context/SocketContext";
import { Order } from "../types";
import OrderDetailModal from "../components/OrderDetailModal";

/* ── helpers ── */
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pending:   { bg: "bg-slate-50",   text: "text-slate-500",  border: "border-slate-200", label: "Pending"   },
  called:    { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200", label: "Called"    },
  printing:  { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200",  label: "Printing"  },
  skipped:   { bg: "bg-red-50",     text: "text-red-600",    border: "border-red-200",   label: "Skipped"   },
  completed: { bg: "bg-green-50",   text: "text-green-700",  border: "border-green-200", label: "Completed" },
};

const STATUS_DOT: Record<string, string> = {
  pending:   "bg-slate-300",
  called:    "bg-amber-400 animate-pulse",
  printing:  "bg-blue-500 animate-pulse",
  skipped:   "bg-red-400",
  completed: "bg-green-500",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

const totalPageCount = (order: Order) =>
  order.printOptions.printRules.reduce((s, r) => s + (r.toPage - r.fromPage + 1), 0);

/* ── Spinner ── */
const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

/* ── Order card ── */
const OrderRow = ({
  order, onPay, loadingPay, onClick,
}: {
  order: Order;
  onPay: (id: string) => void;
  loadingPay: string | null;
  onClick: (order: Order) => void;
}) => {
  const isActive = order.status !== "completed" && order.status !== "skipped";
  const canPay   = order.paymentStatus === "unpaid" && isActive;
  const isPaying = loadingPay === order._id;
  const st = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(order)}
      onKeyDown={(e) => e.key === "Enter" && onClick(order)}
      className={`cursor-pointer rounded-2xl border bg-white p-4 sm:p-5 transition-shadow hover:shadow-md hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
        isActive ? "border-slate-200 shadow-sm" : "border-slate-100"
      }`}
    >
      {/* Token + file + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
              isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            #{order.token}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800" title={order.originalFileName}>
              {order.originalFileName}
            </p>
            {order.shop?.name && (
              <p className="mt-0.5 truncate text-xs text-slate-400">{order.shop.name}</p>
            )}
          </div>
        </div>
        {/* Status badge */}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.text} ${st.border}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[order.status]}`} />
          {st.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-50 px-1 py-2 text-center">
        {([
          { label: "Pages",   value: totalPageCount(order),                            color: "" },
          { label: "Copies",  value: order.printOptions.copies,                         color: "" },
          { label: "Total",   value: `\u20b9${order.totalPrice?.toFixed(0) ?? "0"}`,   color: "" },
          {
            label: "Payment",
            value: order.paymentStatus === "paid" ? "Paid" : "Unpaid",
            color: order.paymentStatus === "paid" ? "text-green-600" : "text-amber-600",
          },
        ] as { label: string; value: string | number; color: string }[]).map((s) => (
          <div key={s.label}>
            <p className="text-[10px] font-medium text-slate-400">{s.label}</p>
            <p className={`text-xs font-bold ${s.color || "text-slate-700"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Rule chips */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {order.printOptions.printRules.map((r, i) => (
          <span
            key={i}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
          >
            pp {r.fromPage}&ndash;{r.toPage} &middot; {r.colorMode === "bw" ? "B&W" : "Color"} &middot;{" "}
            {r.sided === "single" ? "1-side" : "2-side"}
          </span>
        ))}
        {order.printOptions.binding !== "none" && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 capitalize">
            {order.printOptions.binding} binding
          </span>
        )}
      </div>

      {/* Footer: date + pay */}
      <div className="mt-3 flex items-center justify-between">
        {order.createdAt && (
          <span className="text-[11px] text-slate-300">{formatDate(order.createdAt)}</span>
        )}
        {canPay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPay(order._id); }}
            disabled={isPaying}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-60"
          >
            {isPaying ? (
              <>
                <Spinner /> Processing&hellip;
              </>
            ) : (
              "Pay Now"
            )}
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Page ── */
const StudentOrders = () => {
  const { socket } = useSocket();
  const [orders, setOrders]         = useState<Order[]>([]);
  const [fetching, setFetching]     = useState(true);
  const [loadingPay, setLoadingPay] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      const data = await myOrdersApi();
      setOrders(data.orders);
    } finally {
      setFetching(false);
    }
  };

  // Initial fetch
  useEffect(() => { void fetchOrders(); }, []);

  // Refresh orders on any queue update broadcast
  useEffect(() => {
    if (!socket) return;
    const handler = () => { void fetchOrders(); };
    socket.on("queue:update", handler);
    return () => { socket.off("queue:update", handler); };
  }, [socket]);

  const handleMarkPaid = async (orderId: string) => {
    setLoadingPay(orderId);
    try {
      await markPaidApi(orderId);
      await fetchOrders();
      toast.success("Payment confirmed!");
    } catch {
      toast.error("Failed to mark as paid.");
    } finally {
      setLoadingPay(null);
    }
  };

  const handleOrderUpdated = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
    if (selectedOrder?._id === updated._id) setSelectedOrder(updated);
  };

  const handleOrderDeleted = (id: string) => {
    setOrders((prev) => prev.filter((o) => o._id !== id));
  };

  /* ── Loading ── */
  if (fetching) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-slate-400">
        <Spinner />
        Loading orders&hellip;
      </div>
    );
  }

  /* ── Empty ── */
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
          🎟️
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-800">No orders yet</h2>
        <p className="mt-1.5 max-w-xs text-sm text-slate-400">
          Submit your first print order and your tokens will appear here.
        </p>
        <Link
          to="/student"
          className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Place First Order
        </Link>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== "completed" && o.status !== "skipped");
  const pastOrders   = orders.filter((o) => o.status === "completed" || o.status === "skipped");

  return (
    <div className="mx-auto max-w-2xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Orders</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {orders.length} total &middot; {activeOrders.length} active
          </p>
        </div>
        <Link
          to="/student"
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          + New Order
        </Link>
      </div>

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Active</h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
              {activeOrders.length}
            </span>
          </div>
          <div className="space-y-3">
            {activeOrders.map((o) => (
              <OrderRow key={o._id} order={o} onPay={handleMarkPaid} loadingPay={loadingPay} onClick={setSelectedOrder} />
            ))}
          </div>
        </section>
      )}

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">History</h2>
          </div>
          <div className="space-y-3">
            {pastOrders.map((o) => (
              <OrderRow key={o._id} order={o} onPay={handleMarkPaid} loadingPay={loadingPay} onClick={setSelectedOrder} />
            ))}
          </div>
        </section>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={handleOrderUpdated}
          onOrderDeleted={handleOrderDeleted}
        />
      )}
    </div>
  );
};

export default StudentOrders;
