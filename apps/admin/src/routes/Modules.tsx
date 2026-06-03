import { useEffect, useState } from "react";
import { portal, type PlatformFeatures, type PlatformState } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";
import { useTranslation } from "react-i18next";

export function Modules() {
  const [state, setState] = useState<PlatformState | null>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  const fetchState = () => {
    portal.getPlatformState().then(setState);
  };

  useEffect(() => {
    fetchState();
  }, []);

  const toggleFeature = async (key: keyof PlatformFeatures) => {
    if (!state) return;
    setSaving(true);
    const newValue = !state.features[key];
    
    // Optimistic update
    setState({ ...state, features: { ...state.features, [key]: newValue } });
    
    try {
      await portal.updatePlatformState({ [key]: newValue });
    } catch (e) {
      console.error(e);
      // Revert on error
      fetchState();
    } finally {
      setSaving(false);
    }
  };

  if (!state) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>{t('modules.title')}</h1>
        <Button onClick={fetchState} disabled={saving} variant="secondary">
          {t('common.refresh')}
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {Object.entries(state.features).map(([key, value]) => (
          <div key={key} style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            padding: "1rem",
            backgroundColor: "white",
            border: "1px solid var(--kumo-colors-gray-4)",
            borderRadius: "8px"
          }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 500 }}>{t(`features.${key}`, key)}</span>
              <span style={{ fontSize: "0.875rem", color: "var(--kumo-colors-gray-11)" }}>
                {t('modules.toggle_desc', { module: t(`features.${key}`, key) })}
              </span>
            </div>
            <Button 
              variant={value ? "primary" : "secondary"}
              onClick={() => toggleFeature(key as keyof PlatformFeatures)}
              disabled={saving}
            >
              {value ? t('common.enabled') : t('common.disabled')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
