import { Outlet, NavLink } from "react-router-dom";
import { Button } from "@cloudflare/kumo/components/button";
import { portal } from "../lib/portal";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export function AdminShell() {
  const [token, setToken] = useState(localStorage.getItem("partygame.portal.adminToken"));
  const { t, i18n } = useTranslation();

  if (!token) {
    return <LoginScreen onLogin={(t) => setToken(t)} />;
  }

  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    (localStorage.getItem("partygame.theme") as any) || "system"
  );

  useEffect(() => {
    localStorage.setItem("partygame.theme", theme);
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.style.colorScheme = "dark";
      } else {
        document.documentElement.style.colorScheme = "light";
      }
    } else {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }
  }, [theme]);

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "var(--kumo-colors-gray-2)" }}>
      {/* Sidebar */}
      <nav style={{ 
        width: "250px", 
        backgroundColor: "var(--kumo-colors-gray-1)", 
        borderRight: "1px solid var(--kumo-colors-gray-4)",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      }}>
        <div style={{ marginBottom: "2rem", paddingLeft: "1rem" }}>
          <h2>{t('app.title')}</h2>
        </div>
        
        <NavLink to="/" end style={navLinkStyle}>{t('nav.dashboard')}</NavLink>
        <NavLink to="/modules" style={navLinkStyle}>{t('nav.modules')}</NavLink>
        <NavLink to="/operations" style={navLinkStyle}>{t('nav.operations')}</NavLink>
        <NavLink to="/players" style={navLinkStyle}>{t('nav.players')}</NavLink>
        <NavLink to="/settings" style={navLinkStyle}>{t('nav.settings')}</NavLink>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <select 
            value={i18n.language} 
            onChange={handleLangChange}
            style={{ 
              padding: "0.5rem", 
              borderRadius: "4px", 
              border: "1px solid var(--kumo-colors-gray-6)",
              backgroundColor: "white"
            }}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value as any)}
            style={{ 
              padding: "0.5rem", 
              borderRadius: "4px", 
              border: "1px solid var(--kumo-colors-gray-6)",
              backgroundColor: "white",
              color: "black"
            }}
          >
            <option value="system">🖥️ System</option>
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
          </select>
          <Button variant="secondary" onClick={() => {
            portal.logout();
            setToken(null);
          }}>
            {t('nav.logout')}
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

function navLinkStyle({ isActive }: { isActive: boolean }) {
  return {
    padding: "0.5rem 1rem",
    textDecoration: "none",
    color: isActive ? "var(--kumo-colors-blue-9)" : "var(--kumo-colors-gray-11)",
    backgroundColor: isActive ? "var(--kumo-colors-blue-3)" : "transparent",
    borderRadius: "6px",
    fontWeight: isActive ? 600 : 400,
  };
}

function LoginScreen({ onLogin }: { onLogin: (t: string) => void }) {
  const [secret, setSecret] = useState("");
  const { t } = useTranslation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("partygame.portal.adminToken", secret);
    onLogin(secret);
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "var(--kumo-colors-gray-2)" }}>
      <form onSubmit={handleLogin} style={{ 
        backgroundColor: "var(--kumo-colors-gray-1)", 
        padding: "2rem", 
        borderRadius: "8px", 
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        minWidth: "300px"
      }}>
        <h2>{t('login.title')}</h2>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>{t('login.secret_label')}</label>
          <input 
            type="password" 
            value={secret} 
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--kumo-colors-gray-6)" }}
          />
        </div>
        <Button type="submit">{t('login.button')}</Button>
      </form>
    </div>
  );
}
