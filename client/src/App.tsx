import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import AdminLayout from "./pages/AdminLayout";
import AdminQueue from "./pages/AdminQueue";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminHistory from "./pages/AdminHistory";
import AdminShopRegistration from "./pages/AdminShopRegistration";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentLayout from "./pages/StudentLayout";
import StudentOrders from "./pages/StudentOrders";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

const roleHome = (role: string) => {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  return "/student";
};

const App = () => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      {location.pathname !== "/" && !location.pathname.startsWith("/student") && !location.pathname.startsWith("/admin") && <Navbar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/student"
          element={
            <ProtectedRoute roles={["student"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="orders" element={<StudentOrders />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminQueue />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="history" element={<AdminHistory />} />
          <Route path="shop" element={<AdminShopRegistration />} />
        </Route>

        <Route
          path="/superadmin"
          element={
            <ProtectedRoute roles={["superadmin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to={user ? roleHome(user.role) : "/"} replace />}
        />
      </Routes>
    </div>
  );
};

export default App;
