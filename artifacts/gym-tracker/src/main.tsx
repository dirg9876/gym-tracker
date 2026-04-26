import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

if (import.meta.env.PROD) {
  if ("caches" in window) {
    window.caches.delete("api-cache").catch(() => {});
  }
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(<App />);
