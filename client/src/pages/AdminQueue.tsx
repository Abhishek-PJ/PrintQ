import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { actionOrderApi, queueApi, downloadFileApi, setPriorityApi } from "../api/orders";
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

type PrintStep = "queued" | "downloading" | "converting" | "splitting" | "printing" | "done" | "error";

interface PrintProgress {
  orderId: string;
  step: PrintStep;
  current?: number;
  total?: number;
  message?: string;
}

const STEP_LABEL: Record<PrintStep, string> = {
  queued:      "Queued…",
  downloading: "Downloading…",
  converting:  "Converting…",
  splitting:   "Preparing pages…",
  printing:    "Printing…",
  done:        "Done",
  error:       "Error",
};

const STEP_COLOR: Record<PrintStep, string> = {
  queued:      "bg-slate-400",
  downloading: "bg-sky-500",
  converting:  "bg-amber-500",
  splitting:   "bg-violet-500",
  printing:    "bg-indigo-500",
  done:        "bg-emerald-500",
  error:       "bg-red-500",
};

// ─── Print progress bar widget ────────────────────────────────────────────────

const PrintProgressBar = ({ prog }: { prog: PrintProgress }) => {
  const steps: PrintStep[] = ["queued", "downloading", "converting", "splitting", "printing", "done"];
  const idx = steps.indexOf(prog.step);
  const pct = prog.step === "error" ? 100
    : prog.step === "printing" && prog.current !== undefined && prog.total
    ? Math.round(((idx - 1 + prog.current / prog.total) / (steps.length - 1)) * 100)
    : Math.round((idx / (steps.length - 1)) * 100);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] font-semibold">
        <span className={prog.step === "error" ? "text-red-600" : "text-indigo-600"}>
          {STEP_LABEL[prog.step]}
          {prog.step === "printing" && prog.current !== undefined && prog.total
            ? ` (${prog.current}/${prog.total})`
            : ""}
        </span>
        {prog.message && (
          <span className="max-w-[200px] truncate text-slate-400">{prog.message}</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            prog.step === "error" ? "bg-red-400" : STEP_COLOR[prog.step]
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const AdminQueue = () => {
  const { socket } = useSocket();
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentOnline, setAgentOnline] = useState(false);
  const [agentPrinters, setAgentPrinters] = useState<string[]>([]);
  const [printProgress, setPrintProgress] = useState<Record<string, PrintProgress>>({});
  const [printWarnings, setPrintWarnings] = useState<Record<string, string[]>>({});

  const fetchQueue = async () => {
    const data = await queueApi();
    setQueue(data.queue);
    setLoading(false);
  };

  const fetchRef = useRef(fetchQueue);
  useEffect(() => { fetchRef.current = fetchQueue; });

  useEffect(() => { void fetchQueue(); }, []);

  useEffect(() => {
    if (!socket) return;

    const onQueueUpdate = () => { void fetchRef.current(); };
    const onAgentStatus = ({ online, printers }: { online: boolean; printers: string[] }) => {
      setAgentOnline(online);
      setAgentPrinters(printers ?? []);
      toast(online ? "🖨️ Print agent connected" : "⚠️ Print agent disconnected", {
        icon: online ? "✅" : "⚠️",
      });
    };
    const onPrintProgress = (data: PrintProgress) => {
      setPrintProgress((prev) => ({ ...prev, [data.orderId]: data }));
    };
    const onPrintDone = ({ orderId }: { orderId: string }) => {
      setPrintProgress((prev) => ({ ...prev, [orderId]: { orderId, step: "done", message: "Sent to printer" } }));
      toast.success("Print job completed");
      void fetchRef.current();
    };
    const onPrintError = ({ orderId, message }: { orderId: string; message: string }) => {
      setPrintProgress((prev) => ({ ...prev, [orderId]: { orderId, step: "error", message } }));
      toast.error(`Print error: ${message}`);
    };
    const onPrintWarning = ({ orderId, warning }: { orderId: string; warning: string }) => {
      setPrintWarnings((prev) => ({
        ...prev,
        [orderId]: [...(prev[orderId] ?? []), warning],
      }));
      toast(`⚠️ ${warning}`, { duration: 6000 });
    };

    socket.on("queue:update", onQueueUpdate);
    socket.on("agent:status", onAgentStatus);
    socket.on("print:progress", onPrintProgress);
    socket.on("print:done", onPrintDone);
    socket.on("print:error", onPrintError);
    socket.on("print:warning", onPrintWarning);

    return () => {
      socket.off("queue:update", onQueueUpdate);
      socket.off("agent:status", onAgentStatus);
      socket.off("print:progress", onPrintProgress);
      socket.off("print:done", onPrintDone);
      socket.off("print:error", onPrintError);
      socket.off("print:warning", onPrintWarning);
    };
  }, [socket]);

  const takeAction = async (id: string, action: "call" | "print" | "skip" | "complete") => {
    try {
      await actionOrderApi(id, action);
      if (action !== "print") toast.success(`Order ${action}ed`);
      void fetchQueue();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        `Failed to ${action} order.`;
      toast.error(msg);
    }
  };

  const togglePriority = async (id: string, current: boolean) => {
    try {
      await setPriorityApi(id, !current);
      toast.success(!current ? "⚡ Marked as urgent" : "Priority removed");
      void fetchQueue();
    } catch {
      toast.error("Failed to update priority.");
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 gap-2">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading queue&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Live Queue</h1>
          <p className="mt-0.5 text-sm text-slate-400">Manage incoming print orders in real time</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent status badge */}
          <div
            className={`relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              agentOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-600"
            }`}
            title={agentOnline ? `Printers: ${agentPrinters.join(", ") || "default"}` : "Start the PrintQ Agent on the shop computer"}
          >
            <span
              className={`h-2 w-2 rounded-full ${agentOnline ? "animate-pulse bg-emerald-500" : "bg-rose-400"}`}
            />
            {agentOnline ? "Agent Online" : "Agent Offline"}
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {queue.length} {queue.length === 1 ? "order" : "orders"}
          </span>
        </div>
      </div>

      {/* Agent offline warning */}
      {!agentOnline && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 text-base">⚠️</span>
          <div>
            <p className="font-semibold">Print Agent is not running</p>
            <p className="mt-0.5 text-xs text-amber-700">
              The Print button requires the PrintQ Agent to be running on this shop computer.
              Run <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">npm start</code> inside
              the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">print-agent/</code> folder.
            </p>
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <span className="mb-3 text-5xl">🗂️</span>
            <p className="text-sm font-medium">Queue is empty</p>
            <p className="mt-1 text-xs">New orders will appear here automatically.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {queue.map((order) => (
                <div
                  key={order._id}
                  className={`space-y-3 p-4 ${order.priority ? "bg-orange-50" : ""}`}
                >
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
                    <p className="mt-0.5 text-xs text-slate-400">
                      {order.student?.name || "N/A"} &middot; {order.student?.email || ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-800">&#8377;{order.totalPrice?.toFixed(2) ?? "0.00"}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${order.paymentStatus === "paid" ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                      {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                    </span>
                  </div>

                  {/* Print progress bar (mobile) */}
                  {printProgress[order._id] && (
                    <PrintProgressBar prog={printProgress[order._id]} />
                  )}

                  {/* Capability adjustment warnings (mobile) */}
                  {(printWarnings[order._id] ?? []).map((w, i) => (
                    <div key={i} className="mt-1 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                      <span className="mt-px shrink-0">⚠️</span>
                      <span>{w}</span>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ACTION_CONFIG) as Array<keyof typeof ACTION_CONFIG>).map((key) => {
                      const isPrinting = order.status === "printing" && !printProgress[order._id] || (printProgress[order._id]?.step === "printing");
                      const disabled = key === "print" && (!agentOnline || isPrinting);
                      return (
                        <button key={key}
                          disabled={disabled}
                          onClick={() => void takeAction(order._id, key)}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${ACTION_CONFIG[key].cls} disabled:opacity-40 disabled:cursor-not-allowed`}>
                          {ACTION_CONFIG[key].label}
                        </button>
                      );
                    })}
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
                      <button onClick={() => void handleDownload(order._id)}
                        className="rounded-xl border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50">
                        ↓ Download
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
                    <tr key={order._id}
                      className={`transition-colors hover:bg-slate-50 ${order.priority ? "bg-orange-50 hover:bg-orange-100" : ""}`}>
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
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {order.printOptions.printRules.map((r, i) => (
                            <span key={i} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              pp{r.fromPage}–{r.toPage} {r.colorMode === "bw" ? "B&W" : "Color"} {r.sided === "single" ? "1s" : "2s"}
                            </span>
                          ))}
                        </div>
                        {/* Print progress bar (desktop) */}
                        {printProgress[order._id] && (
                          <div className="mt-1.5 w-40">
                            <PrintProgressBar prog={printProgress[order._id]} />
                          </div>
                        )}
                        {/* Capability adjustment warnings (desktop) */}
                        {(printWarnings[order._id] ?? []).map((w, i) => (
                          <div key={i} className="mt-1 flex items-start gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                            <span className="shrink-0">⚠️</span>
                            <span>{w}</span>
                          </div>
                        ))}
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
                          {(Object.keys(ACTION_CONFIG) as Array<keyof typeof ACTION_CONFIG>).map((key) => {
                            const isPrinting = printProgress[order._id]?.step === "printing";
                            const disabled = key === "print" && (!agentOnline || isPrinting);
                            return (
                              <button key={key}
                                disabled={disabled}
                                onClick={() => void takeAction(order._id, key)}
                                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${ACTION_CONFIG[key].cls} disabled:opacity-40 disabled:cursor-not-allowed`}>
                                {ACTION_CONFIG[key].label}
                              </button>
                            );
                          })}
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
                            <button onClick={() => void handleDownload(order._id)}
                              className="rounded-xl border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-50">
                              ↓ Download
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
    </div>
  );
};

export default AdminQueue;
