import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  registerShopApi,
  getMyShopApi,
  rotateMyAgentSecretApi,
  updateMyShopDetailsApi,
  updateShopPricingApi,
} from "../api/shops";
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

const SectionCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <div className="mb-4">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
    </div>
    {children}
  </section>
);

const ServicesEditor = ({
  value,
  services,
  onChangeValue,
  onAdd,
  onRemove,
}: {
  value: string;
  services: string[];
  onChangeValue: (next: string) => void;
  onAdd: () => void;
  onRemove: (service: string) => void;
}) => (
  <div>
    <label className={labelCls}>Services Offered</label>
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        className={inputCls}
        type="text"
        placeholder="e.g. Color Printing"
      />
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
      >
        Add
      </button>
    </div>
    {services.length > 0 ? (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {services.map((s) => (
          <span key={s} className="flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
            {s}
            <button
              type="button"
              onClick={() => onRemove(s)}
              className="ml-0.5 text-violet-400 hover:text-violet-700"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

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
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editServiceInput, setEditServiceInput] = useState("");
  const [editServices, setEditServices] = useState<string[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState("");
  const [pricingMsg, setPricingMsg]     = useState("");
  const [savingPricing, setSavingPricing] = useState(false);
  const [agentSecret, setAgentSecret] = useState("");
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [secretMsg, setSecretMsg] = useState("");
  const [shopIdMsg, setShopIdMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyShopApi();
        setShop(data.shop);
        if (data.shop) {
          setEditName(data.shop.name);
          setEditAddress(data.shop.address);
          setEditPhone(data.shop.phone);
          setEditServices(data.shop.services || []);
          if (data.shop.pricing) setEditPricing(data.shop.pricing);
        }
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
      if (data.shop) {
        setEditName(data.shop.name);
        setEditAddress(data.shop.address);
        setEditPhone(data.shop.phone);
        setEditServices(data.shop.services || []);
        if (data.shop.pricing) setEditPricing(data.shop.pricing);
      }
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
    const addEditService = () => {
      const trimmed = editServiceInput.trim();
      if (trimmed && !editServices.includes(trimmed)) {
        setEditServices([...editServices, trimmed]);
        setEditServiceInput("");
      }
    };

    const handleSaveDetails = async (e: FormEvent) => {
      e.preventDefault();
      setSavingDetails(true);
      setDetailsMsg("");
      try {
        if (!editServices.length) {
          setDetailsMsg("Add at least one service.");
          return;
        }
        const data = await updateMyShopDetailsApi({
          name: editName,
          address: editAddress,
          phone: editPhone,
          services: editServices,
        });
        setShop(data.shop);
        setDetailsMsg("Shop details updated successfully.");
      } catch {
        setDetailsMsg("Failed to update shop details.");
      } finally {
        setSavingDetails(false);
      }
    };

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

    const copyShopId = async () => {
      try {
        await navigator.clipboard.writeText(shop._id);
        setShopIdMsg("Shop ID copied to clipboard.");
      } catch {
        setShopIdMsg("Could not copy automatically. Please copy it manually.");
      }
    };

    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Shop Settings</h1>
          <p className="mt-0.5 text-sm text-slate-400">Manage your shop profile, pricing, and local print-agent access</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard title="Shop Details" subtitle="Update your profile details shown to students">
              <form onSubmit={handleSaveDetails} className="space-y-4">
                <div>
                  <label className={labelCls}>Shop Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                <ServicesEditor
                  value={editServiceInput}
                  services={editServices}
                  onChangeValue={setEditServiceInput}
                  onAdd={addEditService}
                  onRemove={(service) => setEditServices(editServices.filter((x) => x !== service))}
                />

                {detailsMsg ? (
                  <p className={`text-xs font-medium ${detailsMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                    {detailsMsg}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={savingDetails}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
                >
                  {savingDetails ? "Saving..." : "Save Shop Details"}
                </button>
              </form>
            </SectionCard>

            <SectionCard title="Print Pricing" subtitle="Per-page rates charged to students">
              <form onSubmit={handleSavePricing} className="space-y-4">
                <PricingGrid pricing={editPricing} onChange={setEditPricing} />
                {pricingMsg ? (
                  <p className={`text-xs font-medium ${pricingMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                    {pricingMsg}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={savingPricing}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
                >
                  {savingPricing ? "Saving\u2026" : "Save Pricing"}
                </button>
              </form>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Shop Summary" subtitle="Current registration details and approval status">
              <div className="space-y-4">
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

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shop ID</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-white px-2 py-1 text-[11px] text-slate-700">{shop._id}</code>
                    <button
                      type="button"
                      onClick={() => void copyShopId()}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Copy
                    </button>
                  </div>
                  {shopIdMsg ? <p className="mt-1 text-[11px] text-slate-500">{shopIdMsg}</p> : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {shop.services.map((s) => (
                    <span key={s} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                      {s}
                    </span>
                  ))}
                </div>

                {shop.status === "pending" ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Your registration is under review. You&rsquo;ll be notified once approved.
                  </p>
                ) : null}
                {shop.status === "rejected" ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    Your registration was rejected. Contact the super admin for details.
                  </p>
                ) : null}
                {shop.status === "approved" ? (
                  <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
                    Your shop is live! Students can now send print orders.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            {shop.status === "approved" ? (
              <SectionCard
                title="Print Agent Secret"
                subtitle="Rotate when onboarding a new device or after suspected credential leak"
              >
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <button
                    type="button"
                    onClick={() => void rotateMySecret()}
                    disabled={rotatingSecret}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-60"
                  >
                    {rotatingSecret ? "Rotating..." : "Rotate Agent Secret"}
                  </button>

                  {agentSecret ? (
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
                  ) : null}

                  {secretMsg ? (
                    <p className={`text-xs font-medium ${secretMsg.toLowerCase().includes("failed") ? "text-red-500" : "text-amber-700"}`}>
                      {secretMsg}
                    </p>
                  ) : null}

                  <p className="text-[11px] text-amber-700">
                    This secret is shown once. Save it as AGENT_SECRET in your print-agent .env with your SHOP_ID.
                  </p>
                </div>
              </SectionCard>
            ) : null}
          </div>
        </div>
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

        <ServicesEditor
          value={serviceInput}
          services={services}
          onChangeValue={setServiceInput}
          onAdd={addService}
          onRemove={(service) => setServices(services.filter((x) => x !== service))}
        />

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
