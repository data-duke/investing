import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { PrivacyProvider } from "./contexts/PrivacyContext";

createRoot(document.getElementById("root")!).render(
  <PrivacyProvider>
    <App />
  </PrivacyProvider>
);
