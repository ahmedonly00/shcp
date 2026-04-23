import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import "./i18n";
import { registerSW } from 'virtual:pwa-register';

// Auto-update service worker — silently refreshes when a new version is deployed
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
