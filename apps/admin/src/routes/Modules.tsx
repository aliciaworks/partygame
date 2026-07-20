import { useEffect, useState } from "react";
import { portal, type PlatformFeatures, type PlatformState } from "../lib/portal";
import { Button, Switch, Loader } from "./ui";
import { useTranslation } from "react-i18next";
import { Cpu, ArrowsClockwise } from "@phosphor-icons/react";

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
    setState({ ...state, features: { ...state.features, [key]: newValue } });
    try {
      await portal.updatePlatformState({ [key]: newValue });
    } catch (e) {
      console.error(e);
      fetchState();
    } finally {
      setSaving(false);
    }
  };

  if (!state) return <Loader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Cpu className="h-8 w-8 text-kumo-brand" />
          <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
            {t("modules.title")}
          </h1>
        </div>
        <Button
          onClick={fetchState}
          disabled={saving}
          variant="secondary"
          size="sm"
          icon={ArrowsClockwise}
        >
          {t("common.refresh")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(state.features).map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between items-center p-4 bg-kumo-elevated border border-kumo-line rounded-xl"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-kumo-default">
                {t(`features.${key}`, key)}
              </span>
              <span className="text-xs text-kumo-subtle">
                {t("modules.toggle_desc", {
                  module: t(`features.${key}`, key),
                })}
              </span>
            </div>
            <Switch
              checked={value}
              onCheckedChange={() =>
                toggleFeature(key as keyof PlatformFeatures)
              }
              disabled={saving}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
