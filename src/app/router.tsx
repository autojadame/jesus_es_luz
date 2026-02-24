import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/ui/AppShell/AppShell";
import { DashboardPage } from "@/pages/Dashboard/DashboardPage";
import { SettingsPage } from "@/pages/Settings/SettingsPage";
import { ProcessPage } from "@/pages/Process/ProcessPage";
import { HistoryPage } from "@/pages/History/HistoryPage";

export function AppRouter() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/history" element={<HistoryPage />} />

          {/* ✅ existe, pero no es clicable desde menú */}
          <Route path="/process" element={<ProcessPage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
}