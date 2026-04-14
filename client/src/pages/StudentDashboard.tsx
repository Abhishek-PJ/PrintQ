import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { submitOrderApi, previewPriceApi, markPaidApi } from "../api/orders";
import { getApprovedShopsApi } from "../api/shops";
import { Shop, PrintRule, PriceBreakdownItem } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

const getPdfPageCount = async (f: File): Promise<number | null> => {
  try {
    const buffer = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    return pdf.numPages;
  } catch {
    return null;
  }
};

const getDocxPageCount = async (f: File): Promise<number | null> => {
  try {
    const buffer = await f.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const appXmlFile = zip.file("docProps/app.xml");
    if (!appXmlFile) return null;
    const xml = await appXmlFile.async("text");
    const match = xml.match(/<Pages>(\d+)<\/Pages>/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
};

const isDocxFile = (f: File) =>
  f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  f.name.toLowerCase().endsWith(".docx");

/* ── PDF Preview Modal ───────────────────────────────────── */
const PdfPreviewModal = ({ file, onClose }: { file: File; onClose: () => void }) => {
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [rendered, setRendered] = useState(0);
  const [total, setTotal] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const run = async () => {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      setTotal(pdf.numPages);
      const urls: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled.current) return;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
        urls.push(canvas.toDataURL("image/jpeg", 0.85));
        setRendered(i);
        setPageUrls([...urls]);
      }
    };
    void run();
    return () => { cancelled.current = true; };
  }, [file]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-400">
              {total > 0
                ? rendered < total
                  ? `Rendering ${rendered} / ${total} pages…`
                  : `${total} page${total !== 1 ? "s" : ""}`
                : "Loading…"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Pages */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-3 space-y-3">
          {pageUrls.length === 0 ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Rendering pages…
            </div>
          ) : (
            pageUrls.map((url, i) => (
              <div key={i} className="relative">
                <span className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
                  {i + 1}
                </span>
                <img src={url} alt={`Page ${i + 1}`} className="w-full rounded-lg shadow" />
              </div>
            ))
          )}
          {/* Rendering progress indicator */}
          {rendered > 0 && rendered < total && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading remaining pages…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const emptyRule = (): PrintRule => ({
  fromPage: 1,
  toPage: 1,
  colorMode: "bw",
  sided: "single",
});

type Step = 1 | 2;

const StudentDashboard = () => {
  const [successOrder, setSuccessOrder] = useState<{ token: string; paid: boolean } | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [pageCountLoading, setPageCountLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pageDrafts, setPageDrafts] = useState<Record<string, string>>({});

  // Print rules
  const [printRules, setPrintRules] = useState<PrintRule[]>([emptyRule()]);
  const [copies, setCopies] = useState(1);
  const [binding, setBinding] = useState<"none" | "spiral" | "staple">("none");

  // Price
  const [breakdown, setBreakdown] = useState<PriceBreakdownItem[]>([]);
  const [total, setTotal] = useState(0);
  const [payOnline, setPayOnline] = useState(false);

  // When totalPages becomes known, snap the first (sole) rule to cover the whole doc
  useEffect(() => {
    if (totalPages === null) return;
    setPrintRules((prev) => {
      if (prev.length !== 1) return prev;
      return [{ ...prev[0], fromPage: 1, toPage: totalPages }];
    });
  }, [totalPages]);

  const fetchShops = async () => {
    const data = await getApprovedShopsApi();
    setShops(data.shops);
  };

  useEffect(() => {
    void fetchShops();
  }, []);

  // Recalculate price whenever rules or copies change
  const recalcPrice = useCallback(async () => {
    const validRules = printRules.filter((r) => r.toPage >= r.fromPage && r.fromPage >= 1);
    if (validRules.length === 0 || !selectedShop) {
      setBreakdown([]);
      setTotal(0);
      return;
    }
    try {
      const data = await previewPriceApi(validRules, copies, selectedShop);
      setBreakdown(data.breakdown);
      setTotal(data.total);
    } catch {
      /* ignore */
    }
  }, [printRules, copies, selectedShop]);

  useEffect(() => {
    if (step === 2) void recalcPrice();
  }, [step, recalcPrice]);

  const updateRule = (idx: number, patch: Partial<PrintRule>) => {
    setPrintRules((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        if (totalPages !== null) {
          next.fromPage = Math.max(1, Math.min(next.fromPage, totalPages));
          next.toPage = Math.max(next.fromPage, Math.min(next.toPage, totalPages));
        }
        return next;
      })
    );
  };

  const pageDraftKey = (idx: number, field: "fromPage" | "toPage") => `${idx}:${field}`;

  const beginPageEdit = (idx: number, field: "fromPage" | "toPage", value: number) => {
    setPageDrafts((prev) => ({ ...prev, [pageDraftKey(idx, field)]: String(value) }));
  };

  const handlePageInput = (idx: number, field: "fromPage" | "toPage", raw: string) => {
    if (!/^\d*$/.test(raw)) return;
    setPageDrafts((prev) => ({ ...prev, [pageDraftKey(idx, field)]: raw }));
  };

  const commitPageInput = (idx: number, field: "fromPage" | "toPage", fallback: number) => {
    const key = pageDraftKey(idx, field);
    const raw = pageDrafts[key];
    const trimmed = (raw ?? "").trim();

    if (trimmed !== "") {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n >= 1) {
        updateRule(idx, { [field]: n } as Partial<PrintRule>);
        setPageDrafts((prev) => ({ ...prev, [key]: String(n) }));
        return;
      }
    }

    // If user leaves field empty/invalid, snap draft back to current visible value.
    setPageDrafts((prev) => ({ ...prev, [key]: String(fallback) }));
  };

  const getEffectiveRules = (): PrintRule[] => {
    return printRules.map((rule, idx) => {
      const fromDraft = pageDrafts[pageDraftKey(idx, "fromPage")];
      const toDraft = pageDrafts[pageDraftKey(idx, "toPage")];

      const fromCandidate = fromDraft !== undefined && /^\d+$/.test(fromDraft)
        ? Number(fromDraft)
        : rule.fromPage;
      const toCandidate = toDraft !== undefined && /^\d+$/.test(toDraft)
        ? Number(toDraft)
        : rule.toPage;

      return {
        ...rule,
        fromPage: fromCandidate,
        toPage: toCandidate,
      };
    });
  };

  const validateRulesWithinPages = (rules: PrintRule[]): string | null => {
    const seen = new Map<string, number>();

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (!Number.isInteger(r.fromPage) || !Number.isInteger(r.toPage) || r.fromPage < 1 || r.toPage < r.fromPage) {
        return `Rule ${i + 1} has an invalid page range.`;
      }
      if (totalPages !== null && (r.fromPage > totalPages || r.toPage > totalPages)) {
        return `Rule ${i + 1} exceeds document length (${totalPages} pages).`;
      }

      const signature = `${r.fromPage}-${r.toPage}-${r.colorMode}-${r.sided}`;
      const firstSeenAt = seen.get(signature);
      if (firstSeenAt !== undefined) {
        return `Rule ${i + 1} duplicates Rule ${firstSeenAt + 1}. Please merge or change duplicate rules.`;
      }
      seen.set(signature, i);
    }
    return null;
  };

  const addRule = () =>
    setPrintRules((prev) => {
      const last = prev[prev.length - 1];
      const nextFrom = last.toPage + 1;
      const nextTo = totalPages !== null ? totalPages : nextFrom;
      return [...prev, { fromPage: nextFrom, toPage: nextTo, colorMode: "bw", sided: "single" }];
    });

  const removeRule = (idx: number) => {
    if (printRules.length <= 1) return;
    setPrintRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const goToStep2 = () => {
    if (!file) {
      setMessage("Please select a document first.");
      return;
    }
    if (!selectedShop) {
      setMessage("Please select a print shop.");
      return;
    }
    const effectiveRules = getEffectiveRules();
    const validationError = validateRulesWithinPages(effectiveRules);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setMessage("");
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!file) {
      setMessage("Please select a document first.");
      return;
    }
    if (!selectedShop) {
      setMessage("Please select a print shop.");
      return;
    }

    const effectiveRules = getEffectiveRules();
    const validationError = validateRulesWithinPages(effectiveRules);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("shopId", selectedShop);
      formData.append("printRules", JSON.stringify(effectiveRules));
      formData.append("copies", String(copies));
      formData.append("paperSize", "A4");
      formData.append("binding", binding);
      formData.append("paymentStatus", payOnline ? "paid" : "unpaid");
      if (totalPages !== null) {
        formData.append("documentPageCount", String(totalPages));
      }

      const res = await submitOrderApi(formData);

      if (payOnline && res.order?.id) {
        await markPaidApi(res.order.id);
      }

      setSuccessOrder({ token: String(res.order.token), paid: payOnline });
      setFile(null);
      setStep(1);
      setPrintRules([emptyRule()]);
      setCopies(1);
      setPayOnline(false);
    } catch {
      setMessage("Failed to submit order.");
    } finally {
      setLoading(false);
    }
  };

  /* ── pill toggle helper ── */
  const PillToggle = <T extends string>({
    options, value, onChange,
  }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) => (
    <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            value === o.value
              ? "bg-violet-600 text-white"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

 

  return (
    <div className="mx-auto max-w-xl">
      {/* PDF Preview Modal */}
      {previewOpen && file && file.type === "application/pdf" && (
        <PdfPreviewModal file={file} onClose={() => setPreviewOpen(false)} />
      )}

      {/* ── Success state ── */}
      {successOrder ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">🎉</div>
          <h2 className="mt-4 text-xl font-bold text-slate-800">Order Submitted!</h2>
          <p className="mt-1 text-sm text-slate-500">
            {successOrder.paid ? "Payment recorded — pick up when called." : "Pay at the shop when your token is called."}
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-1 rounded-2xl bg-indigo-50 px-12 py-5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Your Token</span>
            <span className="text-5xl font-extrabold leading-none text-indigo-600">#{successOrder.token}</span>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/student/orders"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500"
            >
              View My Orders
            </Link>
            <button
              onClick={() => setSuccessOrder(null)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              New Order
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">

          {/* ── Step indicator ── */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === s ? "bg-violet-600 text-white" : step > s ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"
                }`}>
                  {step > s ? "✓" : s}
                </div>
                <span className={`text-xs font-medium ${step === s ? "text-slate-700" : "text-slate-400"}`}>
                  {s === 1 ? "Upload" : "Configure"}
                </span>
                {s < 2 && <div className="mx-1 h-px w-8 bg-slate-200" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="p-5 sm:p-6 space-y-4">
              {/* Shop selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Print Shop
                </label>
                <select
                  value={selectedShop}
                  onChange={(e) => setSelectedShop(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">— Select a print shop —</option>
                  {shops.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} — {s.address}</option>
                  ))}
                </select>
              </div>

              {/* File upload zone */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document
                </label>
                <label className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-colors ${
                  file ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50"
                }`}>
                  {file ? (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-lg">📄</div>
                      <div className="text-center">
                        <p className="max-w-[240px] truncate text-sm font-semibold text-slate-700">{file.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      {/* Page count / preview */}
                      <div className="flex items-center gap-2">
                        {(file.type === "application/pdf" || isDocxFile(file)) ? (
                          pageCountLoading ? (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                              </svg>
                              Counting pages…
                            </span>
                          ) : totalPages !== null ? (
                            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                              {totalPages} pages
                            </span>
                          ) : (
                            <span className="text-xs text-red-500">Could not read page count</span>
                          )
                        ) : null}
                        {file.type === "application/pdf" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreviewOpen(true);
                            }}
                            className="flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-xs font-medium text-violet-600 hover:bg-violet-50"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            Preview
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!fileInputRef.current) return;
                          // Allow selecting the same file again and still trigger onChange.
                          fileInputRef.current.value = "";
                          fileInputRef.current.click();
                        }}
                        className="text-xs text-violet-500 underline-offset-2 hover:underline"
                      >
                        Change file
                      </button>
                        
                    </>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-400 transition-colors group-hover:bg-violet-100 group-hover:text-violet-500">
                        ↑
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-600">Click to upload a document</p>
                        <p className="mt-0.5 text-xs text-slate-400">PDF, DOC, DOCX — up to 25 MB</p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="sr-only"
                    onChange={async (e) => {
                      const picked = e.target.files?.[0] || null;
                      setFile(picked);
                      setTotalPages(null);
                      if (!picked) return;
                      if (picked.type === "application/pdf") {
                        setPageCountLoading(true);
                        const count = await getPdfPageCount(picked);
                        setTotalPages(count);
                        setPageCountLoading(false);
                      } else if (isDocxFile(picked)) {
                        setPageCountLoading(true);
                        const count = await getDocxPageCount(picked);
                        setTotalPages(count);
                        setPageCountLoading(false);
                      }
                    }}
                  />
                </label>
              </div>

              {message && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>
              )}

              <button
                type="button"
                onClick={goToStep2}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 active:bg-violet-700"
              >
                Continue to Print Options →
              </button>
            </div>
          )}

          {/* ── Step 2: Configure ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">

              {/* File pill */}
              {file && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="shrink-0 rounded-lg bg-violet-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-violet-700">
                    {file.name.split(".").pop()?.toLowerCase()}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-slate-700">{file.name}</span>
                  {totalPages !== null && (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-violet-600">{totalPages}pp</span>
                  )}
                </div>
              )}

              {/* Print Rules */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Print Rules</h3>
                  {totalPages !== null && (
                    <span className="text-xs text-slate-400">{totalPages} pages total</span>
                  )}
                </div>

                <div className="space-y-3">
                  {printRules.map((rule, idx) => {
                    const fromErr = totalPages !== null && rule.fromPage > totalPages;
                    const toErr   = totalPages !== null && rule.toPage   > totalPages;
                    const hasError = fromErr || toErr;
                    return (
                      <div key={idx} className={`rounded-xl border p-4 ${hasError ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                        {/* Rule header */}
                        <div className="mb-3 flex items-center justify-between">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            disabled={printRules.length <= 1}
                            className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:pointer-events-none disabled:opacity-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>

                        {/* Page range */}
                        <div className="mb-3 flex items-end gap-3">
                          <div className="flex-1">
                            <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${fromErr ? "text-red-500" : "text-slate-400"}`}>
                              From page
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={1}
                              max={totalPages ?? undefined}
                              value={pageDrafts[pageDraftKey(idx, "fromPage")] ?? String(rule.fromPage)}
                              onFocus={(e) => {
                                beginPageEdit(idx, "fromPage", rule.fromPage);
                                const input = e.currentTarget;
                                setTimeout(() => input.select(), 0);
                              }}
                              onClick={(e) => e.currentTarget.select()}
                              onMouseUp={(e) => e.preventDefault()}
                              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              onChange={(e) => handlePageInput(idx, "fromPage", e.target.value)}
                              onBlur={() => commitPageInput(idx, "fromPage", rule.fromPage)}
                              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-violet-100 ${fromErr ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 focus:border-violet-400"}`}
                            />
                          </div>
                          <span className="mb-2.5 text-xs text-slate-300 font-medium">—</span>
                          <div className="flex-1">
                            <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${toErr ? "text-red-500" : "text-slate-400"}`}>
                              To page
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={rule.fromPage}
                              max={totalPages ?? undefined}
                              value={pageDrafts[pageDraftKey(idx, "toPage")] ?? String(rule.toPage)}
                              onFocus={(e) => {
                                beginPageEdit(idx, "toPage", rule.toPage);
                                const input = e.currentTarget;
                                setTimeout(() => input.select(), 0);
                              }}
                              onClick={(e) => e.currentTarget.select()}
                              onMouseUp={(e) => e.preventDefault()}
                              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              onChange={(e) => handlePageInput(idx, "toPage", e.target.value)}
                              onBlur={() => commitPageInput(idx, "toPage", rule.toPage)}
                              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-violet-100 ${toErr ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 focus:border-violet-400"}`}
                            />
                          </div>
                        </div>

                        {/* Color + Sided toggles */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Color</p>
                            <PillToggle
                              options={[{ label: "B&W", value: "bw" }, { label: "Color", value: "color" }]}
                              value={rule.colorMode}
                              onChange={(v) => updateRule(idx, { colorMode: v as "bw" | "color" })}
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sides</p>
                            <PillToggle
                              options={[{ label: "Single", value: "single" }, { label: "Double", value: "double" }]}
                              value={rule.sided}
                              onChange={(v) => updateRule(idx, { sided: v as "single" | "double" })}
                            />
                          </div>
                        </div>

                        {hasError && totalPages !== null && (
                          <p className="mt-2 text-xs text-red-500">
                            ⚠ Pages {rule.fromPage}–{rule.toPage} exceed the document ({totalPages} pages).
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addRule}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-violet-300 hover:text-violet-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Another Rule
                </button>
              </div>

              {/* Copies + Binding */}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Options</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Copies</label>
                    <div className="flex items-center overflow-hidden rounded-xl border border-slate-200">
                      <button type="button" onClick={() => setCopies((c) => Math.max(1, c - 1))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">−</button>
                      <span className="flex-1 text-center text-sm font-semibold text-slate-700">{copies}</span>
                      <button type="button" onClick={() => setCopies((c) => c + 1)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Binding</label>
                    <select
                      value={binding}
                      onChange={(e) => setBinding(e.target.value as "none" | "spiral" | "staple")}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    >
                      <option value="none">No binding</option>
                      <option value="spiral">Spiral</option>
                      <option value="staple">Staple</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              {breakdown.length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-violet-600">Price Breakdown</h3>
                  <ul className="mt-2 space-y-1.5">
                    {breakdown.map((item, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="font-semibold text-slate-700">₹{item.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-violet-200 pt-3">
                    <span className="font-bold text-slate-800">Total</span>
                    <span className="text-lg font-extrabold text-violet-700">₹{total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Pay toggle */}
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${payOnline ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}>
                <input
                  type="checkbox"
                  checked={payOnline}
                  onChange={() => setPayOnline(!payOnline)}
                  className="mt-0.5 h-4 w-4 accent-green-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Pay online now</p>
                  <p className="mt-0.5 text-xs text-slate-400">No payment needed at the shop — just pick up your order.</p>
                </div>
              </label>

              {message && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
                >
                  {loading ? "Submitting…" : "Confirm Order"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;