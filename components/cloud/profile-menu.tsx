"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { api, cloud, isCloud } from "@/lib/cloud/client";

export function ProfileMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const employee = cloud.session.role === "employee";
  const name = cloud.session.name?.trim().split(/\s+/)[0] || (employee ? "Colaborador" : "Administrador");
  const role = employee ? cloud.session.jobTitle || "Colaborador" : cloud.session.role === "viewer" ? "Consulta" : cloud.session.role === "manager" ? "Gerente" : "Administrador";

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const identity = <><span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span><span className="profile-text"><strong>{role}</strong><span>{name}</span></span></>;
  if (!isCloud()) return <div className="profile">{identity}</div>;

  async function logout() {
    setBusy(true);
    setError("");
    try {
      if (cloud.session.login === "site") {
        await api("auth/logout", { method: "POST" });
        location.reload();
      } else location.assign(new URL("/cdn-cgi/access/logout", location.origin).href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sair. Tente novamente.");
      setBusy(false);
    }
  }

  return <details className="profile-menu" ref={menu}>
    <summary className="profile" aria-label={`Abrir opções de ${name}`}>{identity}<ChevronDown size={16} aria-hidden="true"/></summary>
    <div className="profile-dropdown">
      {employee && <div className="profile-account"><strong>{name}</strong><span>{role}</span></div>}
      <button type="button" className="profile-logout" disabled={busy} onClick={logout}><LogOut size={18} aria-hidden="true"/>{busy ? "Saindo…" : "Sair da sessão"}</button>
      {error && <p className="profile-error" role="alert">{error}</p>}
    </div>
  </details>;
}
