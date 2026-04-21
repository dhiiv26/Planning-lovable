import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Masquer le splash natif Android dès que l'app React est prête
// (no-op sur le web, actif uniquement dans le build Capacitor)
const hideNativeSplash = async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      // petit délai pour laisser le premier paint se faire → transition fluide
      setTimeout(() => {
        SplashScreen.hide({ fadeOutDuration: 300 });
      }, 100);
    }
  } catch {
    // ignoré sur web
  }
};
hideNativeSplash();
