import { Outlet, NavLink } from "react-router-dom";
import { portal } from "../lib/portal";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui";
import { cn } from "../lib/utils";
import {
  Layout,
  PuzzlePiece,
  Terminal,
  Users,
  Gear,
  SignOut,
  Sun,
  Moon,
  Monitor,
  Translate,
  Package,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

// ── Navigation items ─────────────────────────────────────────────────────────

type NavItem = {
  to: string;
  end?: boolean;
  labelKey: string;
  icon: Icon;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", end: true, labelKey: "nav.dashboard", icon: Layout },
  { to: "/modules", labelKey: "nav.modules", icon: PuzzlePiece },
  { to: "/assets", labelKey: "nav.assets", icon: Package },
  { to: "/operations", labelKey: "nav.operations", icon: Terminal },
  { to: "/players", labelKey: "nav.players", icon: Users },
  { to: "/settings", labelKey: "nav.settings", icon: Gear },
];

// ── Theme & language types ───────────────────────────────────────────────────

type Theme = "light" | "dark" | "system";
type Lang = "en" | "zh" | "ja" | "ko";

const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

// ── Shell ────────────────────────────────────────────────────────────────────

export function AdminShell() {
  const [token, setToken] = useState(
    localStorage.getItem("partygame.portal.adminToken"),
  );
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("partygame.theme") as Theme) || "system",
  );

  // Apply theme
  useEffect(() => {
    localStorage.setItem("partygame.theme", theme);
    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.mode;
      root.style.colorScheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
    } else {
      root.dataset.mode = theme;
      root.style.colorScheme = theme;
    }
  }, [theme]);

  if (!token) return <LoginScreen onLogin={(t) => setToken(t)} />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-kumo-base text-kumo-default">
      {/* Sidebar */}
      <nav className="w-64 shrink-0 border-r border-kumo-line bg-kumo-elevated p-4 flex flex-col gap-1">
        <div className="mb-6 pl-2 mt-2">
          <h2 className="text-lg font-bold tracking-tight text-kumo-brand">
            {t("app.title")}
          </h2>
          <p className="text-xs text-kumo-subtle mt-0.5">Management Portal</p>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-kumo-brand text-white"
                    : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default",
                )
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-kumo-line">
          {/* Language */}
          <div className="relative">
            <Translate className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-kumo-subtle pointer-events-none" />
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-kumo-recessed border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand cursor-pointer"
            >
              {(Object.keys(LANG_LABELS) as Lang[]).map((lang) => (
                <option key={lang} value={lang}>
                  {LANG_LABELS[lang]}
                </option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div className="relative">
            {theme === "system" && (
              <Monitor className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-kumo-subtle pointer-events-none" />
            )}
            {theme === "light" && (
              <Sun className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-kumo-subtle pointer-events-none" />
            )}
            {theme === "dark" && (
              <Moon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-kumo-subtle pointer-events-none" />
            )}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-kumo-recessed border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand cursor-pointer"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2"
            onClick={() => {
              portal.logout();
              setToken(null);
            }}
          >
            <SignOut className="h-4 w-4" />
            {t("nav.logout")}
          </Button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto bg-kumo-recessed">
        <Outlet />
      </main>
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (t: string) => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [methods, setMethods] = useState<{ password: boolean; google: any } | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // Fetch available login methods
    fetch(portal.baseUrl + "admin/auth/methods")
      .then(r => r.json())
      .then(d => setMethods(d))
      .catch(() => setMethods({ password: true, google: false }));

    // Check if returning from Google OAuth callback
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get("token");
    if (authToken) {
      localStorage.setItem("partygame.portal.adminToken", authToken);
      window.history.replaceState({}, "", window.location.pathname);
      onLogin(authToken);
    }
  }, []);

  const handleGoogleLogin = () => {
    const callbackUrl = window.location.origin + window.location.pathname;
    window.location.href = portal.baseUrl + "admin/auth/sign-in/google?callbackUrl=" + encodeURIComponent(callbackUrl);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-kumo-base">
      <div className="bg-kumo-elevated border border-kumo-line p-8 rounded-xl flex flex-col gap-6 w-full max-w-sm">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-kumo-default">
            {t("login.title")}
          </h2>
          <p className="text-sm text-kumo-subtle">
            {t("login.secret_label")}
          </p>
        </div>

        {error && (
          <div className="text-sm text-kumo-danger bg-kumo-danger-tint border border-kumo-danger/30 p-3 rounded-md">
            {error}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              const r = await fetch(new URL("/admin/platform", portal.baseUrl), {
                headers: { Authorization: `Bearer ${secret}` },
              });
              if (r.ok) {
                localStorage.setItem("partygame.portal.adminToken", secret);
                onLogin(secret);
              } else {
                const b = await r.json().catch(() => ({}));
                setError(b.message || "Login failed");
              }
            } catch {
              setError("Cannot reach server");
            }
          }}
          className="flex flex-col gap-4"
        >
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand"
            placeholder="••••••••"
          />
          <Button type="submit" variant="primary" className="w-full font-semibold">
            {t("login.button")}
          </Button>
        </form>

        {methods?.google && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-kumo-line" />
              <span className="text-xs text-kumo-subtle">or</span>
              <div className="flex-1 h-px bg-kumo-line" />
            </div>
            <Button
              variant="secondary"
              className="w-full font-semibold justify-center gap-2"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Login with Google
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
