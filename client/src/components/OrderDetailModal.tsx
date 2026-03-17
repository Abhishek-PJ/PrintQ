import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Order, PrintRule, PriceBreakdownItem } from "../types";
import {
  getOrderQueueStatusApi,
  editOrderApi,
  deleteOrderApi,
  previewPriceApi,
} from "../api/orders";

/* ── Types ── */
interface QueueStatus {
  inQueue: boolean;
  position: number;
  ordersAhead: number;
  estimatedMinutes: number;
  totalInQueue: number;
}

interface Props {
  order: Order;
  onClose: () => void;
  onOrderUpdated: (updated: Order) => void;
  onOrderDeleted: (id: string) => void;
}

/* ── Helpers ── */
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pending:   { bg: "bg-slate-50",  text: "text-slate-500",  border: "border-slate-200", label: "Pending"   },
  called:    { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", label: "Called"    },
  printing:  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",  label: "Printing"  },
  skipped:   { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200",   label: "Skipped"   },
  completed: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200", label: "Completed" },
};

const formatEta = (mins: number) => {
  if (mins === 0) return "You're next!";
  if (mins < 5)  return "< 5 min";
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

/* ── Component ── */
const OrderDetailModal = ({ order: initialOrder, onClose, onOrderUpdated, onOrderDeleted }: Props) => {
  const [order, setOrder]               = useState<Order>(initialOrder);
  const [queueStatus, setQueueStatus]   = useState<QueueStatus | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [isEditing, setIsEditing]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [saving, setSaving]             = useState(false);

  /* edit form state */
  const [editRules, setEditRules] = useState<PrintRule[]>(order.printOptions.printRules);
  const [copies, setCopies]       = useState(order.printOptions.copies);
  const [paperSize, setPaperSize] = useState<"A4" | "A3">(order.printOptions.paperSize);
  const [binding, setBinding]     = useState<"none" | "spiral" | "staple">(order.printOptions.binding);
  const [pricePreview, setPricePreview]   = useState<{ breakdown: PriceBreakdownItem[]; total: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isActive = order.status !== "completed" && order.status !== "skipped";
  const canEdit  = order.status === "pending";
  const st       = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;

  /* fetch queue position on mount (active orders only) */
  useEffect(() => {
    if (!isActive) return;
    setQueueLoading(true);
    getOrderQueueStatusApi(order._id)
      .then(setQueueStatus)
      .catch(() => {})
      .finally(() => setQueueLoading(false));
  }, [order._id, isActive]);

  /* live price preview while editing (debounced 500 ms) */
  useEffect(() => {
    if (!isEditing || !order.shop?._id) return;
    const tid = window.setTimeout(async () => {
      if (editRules.length === 0) return;
      setPreviewLoading(true);
      try {
        const preview = await previewPriceApi(editRules, copies, order.shop!._id);
        setPricePreview(preview);
      } catch { /* ignore */ } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => clearTimeout(tid);
  }, [isEditing, editRules, copies, order.shop?._id]);

  /* ESC to close */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* ── Handlers ── */
  const handleSave = async () => {
    for (const r of editRules) {
      if (r.fromPage < 1 || r.toPage < r.fromPage) {
        toast.error("Each rule must have a valid page range (From ≤ To).");
        return;
      }
    }
    setSaving(true);
    try {
      const { order: updated } = await editOrderApi(order._id, { printRules: editRules, copies, paperSize, binding });
      const merged = { ...order, ...updated } as Order;
      setOrder(merged);
      setIsEditing(false);
      setPricePreview(null);
      toast.success("Order updated!");
      onOrderUpdated(merged);
    } catch {
      toast.error("Failed to update order.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditRules(order.printOptions.printRules);
    setCopies(order.printOptions.copies);
    setPaperSize(order.printOptions.paperSize);
    setBinding(order.printOptions.binding);
    setPricePreview(null);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOrderApi(order._id);
      toast.success("Order deleted.");
      onOrderDeleted(order._id);
      onClose();
    } catch {
      toast.error("Failed to delete order.");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Rule edit helpers ── */
  const updateRule = (idx: number, field: keyof PrintRule, value: string | number) => {
    setEditRules((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: typeof value === "string" ? value : Number(value) } : r
      )
    );
  };

  const addRule = () => {
    const last = editRules[editRules.length - 1];
    const nextFrom = last ? last.toPage + 1 : 1;
    setEditRules((prev) => [
      ...prev,
      { fromPage: nextFrom, toPage: nextFrom + 4, colorMode: "bw", sided: "single" },
    ]);
  };

  const removeRule = (idx: number) => {
    if (editRules.length <= 1) return;
    setEditRules((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── CSS shorthands ── */
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";
  const selectCls =
    "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
              isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            #{order.token}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800" title={order.originalFileName}>
              {order.originalFileName}
            </p>
            {order.shop?.name && (
              <p className="text-xs text-slate-400">{order.shop.name}</p>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.text} ${st.border}`}
          >
            {st.label}
          </span>
          <button
            onClick={onClose}
            className="ml-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">

          {/* ── Queue status ── */}
          {isActive && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                Queue Position
              </p>
              {queueLoading ? (
                <div className="flex items-center gap-2 text-sm text-indigo-400">
                  <Spinner /> Fetching position&hellip;
                </div>
              ) : queueStatus ? (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-3xl font-extrabold leading-none text-indigo-700">
                        #{queueStatus.position}
                        <span className="ml-1.5 text-sm font-medium text-indigo-400">
                          of {queueStatus.totalInQueue}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-indigo-500">
                        {queueStatus.ordersAhead === 0
                          ? "🎉 You're next in line!"
                          : queueStatus.ordersAhead === 1
                          ? "1 order ahead of you"
                          : `${queueStatus.ordersAhead} orders ahead of you`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-indigo-700">
                        {formatEta(queueStatus.estimatedMinutes)}
                      </p>
                      <p className="text-[10px] text-indigo-400">est. wait time</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 transition-all duration-700"
                      style={{
                        width:
                          queueStatus.totalInQueue > 0
                            ? `${Math.round(((queueStatus.totalInQueue - queueStatus.ordersAhead) / queueStatus.totalInQueue) * 100)}%`
                            : "100%",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-indigo-400">Queue info unavailable.</p>
              )}
            </div>
          )}

          {/* ── Edit form ── */}
          {isEditing ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                Edit Print Configuration
              </p>

              {/* Print rules */}
              <div className="space-y-2">
                {editRules.map((rule, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500">Rule {idx + 1}</p>
                      {editRules.length > 1 && (
                        <button
                          onClick={() => removeRule(idx)}
                          className="rounded p-0.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">From Page</label>
                        <input
                          type="number" min={1} value={rule.fromPage}
                          onChange={(e) => updateRule(idx, "fromPage", parseInt(e.target.value) || 1)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">To Page</label>
                        <input
                          type="number" min={rule.fromPage} value={rule.toPage}
                          onChange={(e) => updateRule(idx, "toPage", parseInt(e.target.value) || rule.fromPage)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Color Mode</label>
                        <select value={rule.colorMode} onChange={(e) => updateRule(idx, "colorMode", e.target.value)} className={selectCls}>
                          <option value="bw">Black &amp; White</option>
                          <option value="color">Color</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Sided</label>
                        <select value={rule.sided} onChange={(e) => updateRule(idx, "sided", e.target.value)} className={selectCls}>
                          <option value="single">Single Side</option>
                          <option value="double">Double Side</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addRule}
                  className="w-full rounded-lg border-2 border-dashed border-violet-300 py-2 text-xs font-semibold text-violet-500 transition-colors hover:bg-violet-100"
                >
                  + Add Rule
                </button>
              </div>

              {/* Global options */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Copies</label>
                  <input
                    type="number" min={1} value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Paper</label>
                  <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as "A4" | "A3")} className={selectCls}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Binding</label>
                  <select value={binding} onChange={(e) => setBinding(e.target.value as "none" | "spiral" | "staple")} className={selectCls}>
                    <option value="none">None</option>
                    <option value="spiral">Spiral</option>
                    <option value="staple">Staple</option>
                  </select>
                </div>
              </div>

              {/* Live price preview */}
              {(pricePreview || previewLoading) && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Price Preview</p>
                  {previewLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Calculating&hellip;</div>
                  ) : pricePreview && (
                    <>
                      {pricePreview.breakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-xs text-slate-600">
                          <span>{item.label}</span>
                          <span>&#8377;{item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-sm font-bold text-slate-800">
                        <span>Total</span>
                        <span>&#8377;{pricePreview.total.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Edit actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
                >
                  {saving ? <><Spinner /> Saving&hellip;</> : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            /* ── View: print config ── */
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Print Configuration</p>
              <div className="flex flex-wrap gap-1.5">
                {order.printOptions.printRules.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm"
                  >
                    pp&nbsp;{r.fromPage}&ndash;{r.toPage}&nbsp;&middot;&nbsp;
                    {r.colorMode === "bw" ? "B&W" : "Color"}&nbsp;&middot;&nbsp;
                    {r.sided === "single" ? "1-side" : "2-side"}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <span>
                  <span className="font-semibold text-slate-700">{order.printOptions.copies}</span>{" "}
                  {order.printOptions.copies === 1 ? "copy" : "copies"}
                </span>
                <span className="font-semibold text-slate-700">{order.printOptions.paperSize}</span>
                {order.printOptions.binding !== "none" && (
                  <span className="capitalize">
                    <span className="font-semibold text-slate-700">{order.printOptions.binding}</span> binding
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Price breakdown (view mode only) ── */}
          {!isEditing && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-1.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Price Breakdown</p>
              {order.priceBreakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-slate-600">
                  <span>{item.label}</span>
                  <span>&#8377;{item.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-800">
                <span>Total</span>
                <span>&#8377;{order.totalPrice.toFixed(2)}</span>
              </div>
              <span
                className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  order.paymentStatus === "paid"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {order.paymentStatus === "paid" ? "✓ Paid" : "Unpaid"}
              </span>
            </div>
          )}

          {/* ── Timestamps ── */}
          <div className="flex flex-wrap justify-between gap-1 text-[11px] text-slate-400">
            <span>Placed: {fmtDate(order.createdAt)}</span>
            {order.updatedAt && order.updatedAt !== order.createdAt && (
              <span>Updated: {fmtDate(order.updatedAt)}</span>
            )}
          </div>

          {/* ── Student actions (pending only) ── */}
          {canEdit && !isEditing && (
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
              >
                ✏️ Edit Print Configuration
              </button>

              {confirmDelete ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-red-700">Delete this order?</p>
                  <p className="text-xs text-red-500">
                    This cannot be undone. The uploaded file will also be removed.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                    >
                      {deleting ? <><Spinner /> Deleting&hellip;</> : "Yes, delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  🗑️ Delete Order
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
