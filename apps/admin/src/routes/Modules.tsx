import { useEffect, useState } from "react";
import { portal, type PlatformFeatures, type PlatformState } from "../lib/portal";
import { Button } from "../components/ui/button";
import { useTranslation } from "react-i18next";
import { RefreshCw, Cpu } from "lucide-react";
import { cn } from "../lib/utils";

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

  if (!state) return <div className="text-muted-foreground animate-pulse">{t('common.loading')}</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Cpu className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">{t('modules.title')}</h1>
        </div>
        <Button 
          onClick={fetchState} 
          disabled={saving} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", saving && "animate-spin")} />
          {t('common.refresh')}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {Object.entries(state.features).map(([key, value]) => (
          <div 
            key={key} 
            className="flex justify-between items-center p-5 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold tracking-tight">{t(`features.${key}`, key)}</span>
              <span className="text-xs text-muted-foreground">
                {t('modules.toggle_desc', { module: t(`features.${key}`, key) })}
              </span>
            </div>
            <Button 
              variant={value ? "default" : "outline"}
              onClick={() => toggleFeature(key as keyof PlatformFeatures)}
              disabled={saving}
              className={cn("w-28 font-medium transition-all duration-200", value ? "bg-green-600 hover:bg-green-600/90 text-white shadow-sm" : "")}
            >
              {value ? t('common.enabled') : t('common.disabled')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
