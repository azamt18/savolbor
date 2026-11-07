import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../tokens.css";
import "../base.css";
import "./host.css";
import { HostApp } from "./HostApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HostApp />
  </StrictMode>,
);
