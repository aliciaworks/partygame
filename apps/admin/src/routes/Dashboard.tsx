import { useEffect, useState } from "react";
import { portal, type PlatformState } from "../lib/portal";
import { useTranslation } from "react-i18next";

export function Dashboard() {
  const [state, setState] = useState<PlatformState | null>(null);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    portal.getPlatformState()
      .then(setState)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "red" }}>{t('common.error')}: {error}</div>;
  if (!state) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: "1rem",
        marginTop: "2rem"
      }}>
        {Object.entries(state.features).map(([key, value]) => (
          <div key={key} style={{ 
            backgroundColor: "white", 
            padding: "1.5rem", 
            borderRadius: "8px", 
            border: "1px solid var(--kumo-colors-gray-4)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}>
            <span style={{ color: "var(--kumo-colors-gray-11)", fontSize: "0.875rem", textTransform: "uppercase" }}>
              {t(`features.${key}`, key.replace(/([A-Z])/g, ' $1').trim())}
            </span>
            <span style={{ fontSize: "1.25rem", fontWeight: 600, color: value ? "var(--kumo-colors-green-9)" : "var(--kumo-colors-red-9)" }}>
              {value ? t('common.enabled') : t('common.disabled')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
