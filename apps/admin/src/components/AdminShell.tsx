import { Outlet, NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { portal } from "../lib/portal";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { LogOut, Sun, Moon, Monitor, Languages } from "lucide-react";

export function AdminShell() {
  const [token, setToken] = useState(localStorage.getItem("partygame.portal.adminToken"));
  const { t, i18n } = useTranslation();

  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    (localStorage.getItem("partygame.theme") as "light" | "dark" | "system") || "system"
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

  if (!token) {
    return <LoginScreen onLogin={(t) => setToken(t)} />;
  }

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <nav className="w-64 bg-card border-r border-border p-4 flex flex-col gap-2 shrink-0">
        <div className="mb-8 pl-2 mt-2">
          <h2 className="text-xl font-bold tracking-tight text-primary">{t('app.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">Management Portal</p>
        </div>
        
        <div className="flex flex-col gap-1.5 flex-1">
          <NavLink 
            to="/" 
            end 
            className={({ isActive }) => cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t('nav.dashboard')}
          </NavLink>
          <NavLink 
            to="/modules" 
            className={({ isActive }) => cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t('nav.modules')}
          </NavLink>
          <NavLink 
            to="/operations" 
            className={({ isActive }) => cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t('nav.operations')}
          </NavLink>
          <NavLink 
            to="/players" 
            className={({ isActive }) => cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t('nav.players')}
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t('nav.settings')}
          </NavLink>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-border">
          {/* Language Selector */}
          <div className="relative flex items-center">
            <Languages className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select 
              value={i18n.language} 
              onChange={handleLangChange}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>

          {/* Theme Selector */}
          <div className="relative flex items-center">
            {theme === "system" && <Monitor className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />}
            {theme === "light" && <Sun className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />}
            {theme === "dark" && <Moon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />}
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              portal.logout();
              setToken(null);
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
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
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      <form onSubmit={handleLogin} className="bg-card border border-border p-8 rounded-lg shadow-lg flex flex-col gap-6 w-full max-w-sm">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-2xl font-bold tracking-tight">{t('login.title')}</h2>
          <p className="text-sm text-muted-foreground">Enter your portal secret key</p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground">{t('login.secret_label')}</label>
          <input 
            type="password" 
            value={secret} 
            onChange={(e) => setSecret(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full font-semibold">{t('login.button')}</Button>
      </form>
    </div>
  );
}
