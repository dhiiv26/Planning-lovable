import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";
import UpdateDialog from "@/components/UpdateDialog";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { APP_VERSION } from "@/config/version";
import LoginPage from "@/pages/LoginPage";
import PlanningPage from "@/pages/PlanningPage";
import SaisiePage from "@/pages/SaisiePage";
import UsersPage from "@/pages/UsersPage";
import MaintenancePage from "@/pages/MaintenancePage";
import DiagnosticPage from "@/pages/DiagnosticPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AppShell = () => {
  const { needsUpdate, latestVersion, apkUrl } = useVersionCheck();
  return (
    <>
      <UpdateDialog
        open={needsUpdate}
        currentVersion={APP_VERSION}
        latestVersion={latestVersion}
        apkUrl={apkUrl}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/saisie" element={<SaisiePage />} />
          <Route path="/utilisateurs" element={<UsersPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/diagnostic" element={<DiagnosticPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/planning" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {showSplash && <SplashScreen />}
        <BrowserRouter>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
