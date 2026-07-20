import { useQuery } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { useTranslation } from "react-i18next";
import { Badge, Loader } from "../components/ui";
import { ChartBar } from "@phosphor-icons/react";

export function Dashboard() {
  const {
    data: state,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["platformState"],
    queryFn: () => portal.getPlatformState(),
  });
  const { t } = useTranslation();

  if (error)
    return (
      <div className="text-kumo-danger font-semibold">
        {t("common.error")}: {(error as Error).message}
      </div>
    );
  if (isLoading || !state) return <Loader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ChartBar className="h-8 w-8 text-kumo-brand" />
        <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
          {t("dashboard.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(state.features).map(([key, value]) => (
          <div
            key={key}
            className="bg-kumo-elevated border border-kumo-line p-5 rounded-xl flex flex-col justify-between min-h-[110px] transition-shadow hover:shadow-md"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-kumo-subtle tracking-wider uppercase">
                {t(`features.${key}`, key.replace(/([A-Z])/g, " $1").trim())}
              </span>
              <Badge
                variant={value ? "success" : "neutral"}
                appearance="dot"
              >
                {value ? t("common.enabled") : t("common.disabled")}
              </Badge>
            </div>
            <div className="mt-3">
              <span
                className={`text-xl font-bold ${
                  value ? "text-kumo-success" : "text-kumo-subtle"
                }`}
              >
                {value ? t("common.enabled") : t("common.disabled")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
