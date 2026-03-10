import { useEffect, useState } from "react";
import {
  saGetAllShopsApi,
  saUpdateShopStatusApi,
  saUpdateShopApi,
  saDeleteShopApi,
  saGetAllUsersApi,
  saSetUserRoleApi,
  saUpdateUserApi,
  saDeleteUserApi,
  saGetAllOrdersApi,
} from "../api/superadmin";
import { Shop, UserInfo, Order, UserRole } from "../types";

type Tab = "shops" | "users" | "orders";
type EditUserState = { _id: string; name: string; email: string } | null;
type EditShopState = { _id: string; name: string; address: string; phone: string; services: string } | null;

/* ── shared styles ── */
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100";
const labelCls = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";

const SHOP_STATUS: Record<string, { bg: string; text: string; border: string }> = {
  pending:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
  approved: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200"  },
  rejected: { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200"    },
};

const ORDER_STATUS: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  called:    "bg-sky-50 text-sky-700 border-sky-200",
  printing:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  skipped:   "bg-red-50 text-red-600 border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SuperAdminDashboard = () => {
  const [tab, setTab]     = useState<Tab>("shops");
  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  const [editingUser, setEditingUser] = useState<EditUserState>(null);
  const [editingShop, setEditingShop] = useState<EditShopState>(null);

  const fetchShops  = async () => { const d = await saGetAllShopsApi();  setShops(d.shops);   };
  const fetchUsers  = async () => { const d = await saGetAllUsersApi();  setUsers(d.users);   };
  const fetchOrders = async () => { const d = await saGetAllOrdersApi(); setOrders(d.orders); };

  useEffect(() => {
    void fetchShops();
    void fetchUsers();
    void fetchOrders();
  }, []);

  const handleShopStatus = async (id: string, status: "approved" | "rejected") => {
    try { await saUpdateShopStatusApi(id, status); setMessage(`Shop ${status}.`); await fetchShops(); }
    catch { setMessage("Failed to update shop status."); }
  };

  const handleSetRole = async (id: string, role: UserRole) => {
    try { await saSetUserRoleApi(id, role); setMessage("User role updated."); await fetchUsers(); }
    catch { setMessage("Failed to update role."); }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try { await saDeleteUserApi(id); setMessage("User deleted."); await fetchUsers(); }
    catch { setMessage("Failed to delete user."); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try { await saUpdateUserApi(editingUser._id, { name: editingUser.name, email: editingUser.email }); setMessage("User updated."); setEditingUser(null); await fetchUsers(); }
    catch { setMessage("Failed to update user."); }
  };

  const handleDeleteShop = async (id: string, name: string) => {
    if (!window.confirm(`Delete shop "${name}"? This cannot be undone.`)) return;
    try { await saDeleteShopApi(id); setMessage("Shop deleted."); await fetchShops(); }
    catch { setMessage("Failed to delete shop."); }
  };

  const handleUpdateShop = async () => {
    if (!editingShop) return;
    try {
      const services = editingShop.services.split(",").map((s) => s.trim()).filter(Boolean);
      await saUpdateShopApi(editingShop._id, { name: editingShop.name, address: editingShop.address, phone: editingShop.phone, services });
      setMessage("Shop updated."); setEditingShop(null); await fetchShops();
    } catch { setMessage("Failed to update shop."); }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "shops",  label: "Shops",      count: shops.length  },
    { key: "users",  label: "Users",       count: users.length  },
    { key: "orders", label: "All Orders",  count: orders.length },
  ];

  return (
    <>
      <div className="min-h-screen bg-slate-50">

        {/* ── Header ── */}
        <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Super Admin</h1>
            <p className="mt-0.5 text-sm text-slate-400">Manage shops, users, and all orders</p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">

          {/* Feedback banner */}
          {message && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
              {message}
              <button onClick={() => setMessage("")} className="ml-3 text-slate-400 hover:text-slate-600">&times;</button>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── SHOPS TAB ── */}
          {tab === "shops" && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {shops.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="mb-2 text-4xl">🏪</span>
                  <p className="text-sm">No shops registered yet.</p>
                </div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="divide-y divide-slate-100 sm:hidden">
                    {shops.map((shop) => {
                      const sc = SHOP_STATUS[shop.status] ?? SHOP_STATUS.pending;
                      return (
                        <div key={shop._id} className="space-y-3 p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-800">{shop.name}</p>
                              <p className="text-xs text-slate-400">{shop.address}</p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${sc.bg} ${sc.text} ${sc.border}`}>
                              {shop.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{shop.owner?.name} &middot; {shop.owner?.email}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {shop.services.map((s) => (
                              <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{s}</span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {shop.status === "pending" && (
                              <>
                                <button onClick={() => void handleShopStatus(shop._id, "approved")}
                                  className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500">Approve</button>
                                <button onClick={() => void handleShopStatus(shop._id, "rejected")}
                                  className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400">Reject</button>
                              </>
                            )}
                            <button onClick={() => setEditingShop({ _id: shop._id, name: shop.name, address: shop.address, phone: shop.phone, services: shop.services.join(", ") })}
                              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit</button>
                            <button onClick={() => void handleDeleteShop(shop._id, shop.name)}
                              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50">Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3 text-left font-bold">Shop</th>
                          <th className="px-5 py-3 text-left font-bold">Owner</th>
                          <th className="px-5 py-3 text-left font-bold">Phone</th>
                          <th className="px-5 py-3 text-left font-bold">Services</th>
                          <th className="px-5 py-3 text-left font-bold">Status</th>
                          <th className="px-5 py-3 text-left font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shops.map((shop) => {
                          const sc = SHOP_STATUS[shop.status] ?? SHOP_STATUS.pending;
                          return (
                            <tr key={shop._id} className="transition-colors hover:bg-slate-50">
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-slate-800">{shop.name}</p>
                                <p className="text-xs text-slate-400">{shop.address}</p>
                              </td>
                              <td className="px-5 py-3.5">
                                <p className="text-slate-700">{shop.owner?.name || "N/A"}</p>
                                <p className="text-xs text-slate-400">{shop.owner?.email}</p>
                              </td>
                              <td className="px-5 py-3.5 text-slate-600">{shop.phone}</td>
                              <td className="px-5 py-3.5 max-w-[180px]">
                                <div className="flex flex-wrap gap-1">
                                  {shop.services.map((s) => (
                                    <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{s}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${sc.bg} ${sc.text} ${sc.border}`}>
                                  {shop.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {shop.status === "pending" && (
                                    <>
                                      <button onClick={() => void handleShopStatus(shop._id, "approved")}
                                        className="rounded-xl bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-500">Approve</button>
                                      <button onClick={() => void handleShopStatus(shop._id, "rejected")}
                                        className="rounded-xl bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-400">Reject</button>
                                    </>
                                  )}
                                  <button onClick={() => setEditingShop({ _id: shop._id, name: shop.name, address: shop.address, phone: shop.phone, services: shop.services.join(", ") })}
                                    className="rounded-xl border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit</button>
                                  <button onClick={() => void handleDeleteShop(shop._id, shop.name)}
                                    className="rounded-xl border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50">Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── USERS TAB ── */}
          {tab === "users" && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="mb-2 text-4xl">👤</span>
                  <p className="text-sm">No users found.</p>
                </div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="divide-y divide-slate-100 sm:hidden">
                    {users.map((u) => (
                      <div key={u._id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-600">{u.role}</span>
                        </div>
                        <p className="text-xs text-slate-400">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                        <div className="flex items-center gap-2">
                          <select value={u.role} onChange={(e) => void handleSetRole(u._id, e.target.value as UserRole)}
                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-violet-400 focus:outline-none">
                            <option value="student">Student</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Super Admin</option>
                          </select>
                          <button onClick={() => setEditingUser({ _id: u._id, name: u.name, email: u.email })}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit</button>
                          <button onClick={() => void handleDeleteUser(u._id, u.name)}
                            className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3 text-left font-bold">Name</th>
                          <th className="px-5 py-3 text-left font-bold">Email</th>
                          <th className="px-5 py-3 text-left font-bold">Role</th>
                          <th className="px-5 py-3 text-left font-bold">Joined</th>
                          <th className="px-5 py-3 text-left font-bold">Change Role</th>
                          <th className="px-5 py-3 text-left font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((u) => (
                          <tr key={u._id} className="transition-colors hover:bg-slate-50">
                            <td className="px-5 py-3.5 font-semibold text-slate-800">{u.name}</td>
                            <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                            <td className="px-5 py-3.5 capitalize text-slate-600">{u.role}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td className="px-5 py-3.5">
                              <select value={u.role} onChange={(e) => void handleSetRole(u._id, e.target.value as UserRole)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100">
                                <option value="student">Student</option>
                                <option value="admin">Admin</option>
                                <option value="superadmin">Super Admin</option>
                              </select>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex gap-1.5">
                                <button onClick={() => setEditingUser({ _id: u._id, name: u.name, email: u.email })}
                                  className="rounded-xl border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit</button>
                                <button onClick={() => void handleDeleteUser(u._id, u.name)}
                                  className="rounded-xl border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50">Delete</button>
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
          )}

          {/* ── ORDERS TAB ── */}
          {tab === "orders" && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="mb-2 text-4xl">📭</span>
                  <p className="text-sm">No orders yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 text-left font-bold">Date</th>
                        <th className="px-5 py-3 text-left font-bold">Token</th>
                        <th className="px-5 py-3 text-left font-bold">Student</th>
                        <th className="px-5 py-3 text-left font-bold">Shop</th>
                        <th className="px-5 py-3 text-left font-bold">Document</th>
                        <th className="px-5 py-3 text-left font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => (
                        <tr key={order._id} className="transition-colors hover:bg-slate-50">
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                              #{order.token}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-700">{order.student?.name || "N/A"}</td>
                          <td className="px-5 py-3.5 text-slate-700">{order.shop?.name || "N/A"}</td>
                          <td className="max-w-[160px] px-5 py-3.5">
                            <p className="truncate text-slate-700">{order.originalFileName}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${ORDER_STATUS[order.status] ?? ""}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-bold text-slate-800">Edit User</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Name</label>
                <input type="text" value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className={inputCls} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => void handleUpdateUser()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Shop Modal ── */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-bold text-slate-800">Edit Shop</h3>
            <div className="space-y-3">
              {[
                { label: "Shop Name", key: "name" as const,    type: "text" },
                { label: "Address",   key: "address" as const, type: "text" },
                { label: "Phone",     key: "phone" as const,   type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input type={type} value={editingShop[key]}
                    onChange={(e) => setEditingShop({ ...editingShop, [key]: e.target.value })}
                    className={inputCls} />
                </div>
              ))}
              <div>
                <label className={labelCls}>Services <span className="font-normal text-slate-400">(comma-separated)</span></label>
                <input type="text" value={editingShop.services}
                  onChange={(e) => setEditingShop({ ...editingShop, services: e.target.value })}
                  className={inputCls} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditingShop(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => void handleUpdateShop()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SuperAdminDashboard;
