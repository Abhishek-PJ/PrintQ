import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./styles/index.css";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: "0.875rem" },
            success: { iconTheme: { primary: "#15803d", secondary: "#fff" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
