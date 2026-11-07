import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../tokens.css";
import "../base.css";
import { useT } from "../i18n";

function Placeholder() {
  const { t } = useT();
  return <h1 style={{ fontWeight: 600, padding: 16 }}>{t("title")}</h1>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);
