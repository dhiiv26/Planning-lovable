import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import PlanningPage from "@/pages/PlanningPage";
import SaisiePage from "@/pages/SaisiePage";
import UsersPage from "@/pages/UsersPage";
import DiagnosticPage from "@/pages/DiagnosticPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/saisie" element={<SaisiePage />} />
              <Route path="/utilisateurs" element={<UsersPage />} />
              <Route path="/diagnostic" element={<DiagnosticPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/planning" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
