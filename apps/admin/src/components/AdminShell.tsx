import { Outlet, NavLink } from "react-router-dom";
import { portal } from "../lib/portal";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Sidebar } from "./ui";
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
  Fingerprint,
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
      <Sidebar className="w-64 shrink-0 border-r border-kumo-line p-4 flex flex-col gap-1">
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
      </Sidebar>

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
  const { t } = useTranslation();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-kumo-base">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          localStorage.setItem("partygame.portal.adminToken", secret);
          onLogin(secret);
        }}
        className="bg-kumo-elevated border border-kumo-line p-8 rounded-xl flex flex-col gap-6 w-full max-w-sm"
      >
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-kumo-default">
            {t("login.title")}
          </h2>
          <p className="text-sm text-kumo-subtle">
            Enter your portal secret key
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-kumo-default">
            {t("login.secret_label")}
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand"
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" variant="primary" className="w-full font-semibold">
          {t("login.button")}
        </Button>
      </form>
    </div>
  );
}
