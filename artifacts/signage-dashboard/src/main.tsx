import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Block mouse-wheel scrolling on all time/date inputs globally (non-passive required)
document.addEventListener("wheel", (e) => {
  const el = e.target as HTMLElement;
  if (el.tagName === "INPUT") {
    const t = (el as HTMLInputElement).type;
    if (t === "time" || t === "date") {
      e.preventDefault();
    }
  }
}, { passive: false });

createRoot(document.getElementById("root")!).render(<App />);
