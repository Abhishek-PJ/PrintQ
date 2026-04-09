import { FormEvent, useEffect, useState } from "react";
import { registerShopApi, getMyShopApi, rotateMyAgentSecretApi, updateShopPricingApi } from "../api/shops";
import { Shop, ShopPricing } from "../types";

const DEFAULT_PRICING: ShopPricing = { bwSingle: 2.0, bwDouble: 1.5, colorSingle: 5.0, colorDouble: 4.0 };

/* ── shared input style ── */
const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100";
const labelCls = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";

/* ── PricingGrid: reused in both register & edit views ── */
const PricingGrid = ({
  pricing,
  onChange,
}: {
  pricing: ShopPricing;
  onChange: (p: ShopPricing) => void;
}) => {
  const fields: { key: keyof ShopPricing; label: string }[] = [
    { key: "bwSingle",    label: "B&W Single-side (\u20b9)" },
    { key: "bwDouble",    label: "B&W Double-side (\u20b9)" },
    { key: "colorSingle", label: "Color Single-side (\u20b9)" },
    { key: "colorDouble", label: "Color Double-side (\u20b9)" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className={labelCls}>{label}</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={pricing[key]}
            onChange={(e) => onChange({ ...pricing, [key]: Number(e.target.value) })}
            className={inputCls}
            required
          />
        </div>
      ))}
    </div>
  );
};

const AdminShopRegistration = () => {
  const [shop, setShop]       = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName]             = useState("");
  const [address, setAddress]       = useState("");
  const [phone, setPhone]           = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [services, setServices]     = useState<string[]>([]);
  const [pricing, setPricing]       = useState<ShopPricing>(DEFAULT_PRICING);

  const [editPricing, setEditPricing]   = useState<ShopPricing>(DEFAULT_PRICING);
  const [pricingMsg, setPricingMsg]     = useState("");
  const [savingPricing, setSavingPricing] = useState(false);
  const [agentSecret, setAgentSecret] = useState("");
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [secretMsg, setSecretMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyShopApi();
        setShop(data.shop);
        if (data.shop?.pricing) setEditPricing(data.shop.pricing);
      } catch { /* no shop yet */ }
      finally { setLoading(false); }
    };
    void load();
  }, []);

  const addService = () => {
    const trimmed = serviceInput.trim();
    if (trimmed && !services.includes(trimmed)) {
      setServices([...services, trimmed]);
      setServiceInput("");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (services.length === 0) { setMessage("Add at least one service."); return; }
    setSubmitting(true);
    setMessage("");
    try {
      await registerShopApi({ name, address, phone, services, pricing });
      setMessage("Shop registered! Awaiting SuperAdmin approval.");
      const data = await getMyShopApi();
      setShop(data.shop);
      if (data.shop?.pricing) setEditPricing(data.shop.pricing);
    } catch {
      setMessage("Registration failed. You may already have a shop.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400">
        <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading&hellip;
      </div>
    );
  }

  /* ── STATUS COLORS ── */
  const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    pending:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
    approved: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200"  },
    rejected: { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200"    },
  };

  /* ── SHOP EXISTS view ── */
  if (shop) {
    const handleSavePricing = async (e: FormEvent) => {
      e.preventDefault();
      setSavingPricing(true);
      setPricingMsg("");
      try {
        await updateShopPricingApi(editPricing);
        setPricingMsg("Pricing updated successfully.");
        setShop((prev) => prev ? { ...prev, pricing: editPricing } : prev);
      } catch {
        setPricingMsg("Failed to update pricing.");
      } finally {
        setSavingPricing(false);
      }
    };

    const sc = STATUS_COLORS[shop.status] ?? STATUS_COLORS.pending;

    const rotateMySecret = async () => {
      setRotatingSecret(true);
      setSecretMsg("");
      try {
        const data = await rotateMyAgentSecretApi();
        setAgentSecret(data.agentSecret);
        setSecretMsg("Agent secret rotated. Copy and paste it into your print-agent .env");
      } catch {
        setSecretMsg("Failed to rotate agent secret.");
      } finally {
        setRotatingSecret(false);
      }
    };

    const copySecret = async () => {
      if (!agentSecret) return;
      try {
        await navigator.clipboard.writeText(agentSecret);
        setSecretMsg("Secret copied to clipboard.");
      } catch {
        setSecretMsg("Could not copy automatically. Please copy it manually.");
      }
    };

    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">

        {/* Shop card */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Your Shop</h1>
          <p className="mt-0.5 text-sm text-slate-400">Registration details and current status</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-slate-800">{shop.name}</p>
              <p className="mt-0.5 text-sm text-slate-400">{shop.address}</p>
              <p className="mt-0.5 text-xs text-slate-400">Phone: {shop.phone}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${sc.bg} ${sc.text} ${sc.border}`}>
              {shop.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {shop.services.map((s) => (
              <span key={s} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                {s}
              </span>
            ))}
          </div>

          {shop.status === "pending" && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Your registration is under review. You&rsquo;ll be notified once approved.
            </p>
          )}
          {shop.status === "rejected" && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
              Your registration was rejected. Contact the super admin for details.
            </p>
          )}
          {shop.status === "approved" && (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
              Your shop is live! Students can now send print orders.
            </p>
          )}
        </div>

        {/* Pricing editor */}
        <div>
          <h2 className="text-sm font-bold text-slate-800">Print Pricing</h2>
          <p className="mt-0.5 text-xs text-slate-400 mb-4">Per-page rates charged to students</p>
          <form onSubmit={handleSavePricing} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
            <PricingGrid pricing={editPricing} onChange={setEditPricing} />
            {pricingMsg && (
              <p className={`text-xs font-medium ${pricingMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                {pricingMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPricing}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
            >
              {savingPricing ? "Saving\u2026" : "Save Pricing"}
            </button>
          </form>
        </div>

        {shop.status === "approved" && (
          <div>
            <h2 className="text-sm font-bold text-slate-800">Print Agent Secret</h2>
            <p className="mt-0.5 mb-4 text-xs text-slate-400">Rotate when onboarding a new agent device or after suspected credential leak.</p>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <button
                type="button"
                onClick={() => void rotateMySecret()}
                disabled={rotatingSecret}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-60"
              >
                {rotatingSecret ? "Rotating..." : "Rotate Agent Secret"}
              </button>

              {agentSecret && (
                <div className="space-y-2">
                  <input
                    readOnly
                    value={agentSecret}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => void copySecret()}
                    className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Copy Secret
                  </button>
                </div>
              )}

              {secretMsg && (
                <p className={`text-xs font-medium ${secretMsg.toLowerCase().includes("failed") ? "text-red-500" : "text-amber-700"}`}>
                  {secretMsg}
                </p>
              )}

              <p className="text-[11px] text-amber-700">
                This secret is shown once. Save it as AGENT_SECRET in your print-agent .env with your SHOP_ID.
              </p>
            </div>
          </div>
        )}

      </div>
    );
  }

  /* ── REGISTER view ── */
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-bold text-slate-800">Register Your Print Shop</h1>
      <p className="mt-0.5 mb-6 text-sm text-slate-400">
        Enter your shop details. A super admin will review before approval.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">

        <div>
          <label className={labelCls}>Shop Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} type="text" placeholder="e.g. Campus Print Hub" required />
        </div>

        <div>
          <label className={labelCls}>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} type="text" placeholder="Shop address" required />
        </div>

        <div>
          <label className={labelCls}>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} type="tel" placeholder="Phone number" required />
        </div>

        {/* Services */}
        <div>
          <label className={labelCls}>Services Offered</label>
          <div className="flex gap-2">
            <input
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(); } }}
              className={inputCls}
              type="text"
              placeholder="e.g. Color Printing"
            />
            <button type="button" onClick={addService}
              className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Add
            </button>
          </div>
          {services.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span key={s} className="flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                  {s}
                  <button type="button" onClick={() => setServices(services.filter((x) => x !== s))}
                    className="ml-0.5 text-violet-400 hover:text-violet-700">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="border-t border-slate-100 pt-4">
          <label className={labelCls}>Print Pricing (&#8377; per page)</label>
          <div className="mt-2">
            <PricingGrid pricing={pricing} onChange={setPricing} />
          </div>
        </div>

        {message && (
          <p className={`text-xs font-medium ${message.includes("failed") || message.includes("already") ? "text-red-500" : "text-slate-600"}`}>
            {message}
          </p>
        )}

        <button
          disabled={submitting}
          className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
          type="submit"
        >
          {submitting ? "Submitting\u2026" : "Register Shop"}
        </button>
      </form>
    </div>
  );
};

export default AdminShopRegistration;
