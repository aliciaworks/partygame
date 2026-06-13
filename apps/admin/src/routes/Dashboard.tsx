import { useQuery } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { useTranslation } from "react-i18next";
import { Activity, ToggleLeft, ToggleRight } from "lucide-react";

export function Dashboard() {
  const { data: state, error, isLoading } = useQuery({
    queryKey: ['platformState'],
    queryFn: () => portal.getPlatformState()
  });

  const { t } = useTranslation();

  if (error) return <div className="text-red-500 font-semibold">{t('common.error')}: {(error as Error).message}</div>;
  if (isLoading || !state) return <div className="text-muted-foreground animate-pulse">{t('common.loading')}</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Object.entries(state.features).map(([key, value]) => (
          <div 
            key={key} 
            className="bg-card text-card-foreground border border-border p-6 rounded-xl shadow-sm flex flex-col justify-between min-h-[120px] transition-all hover:shadow-md"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                {t(`features.${key}`, key.replace(/([A-Z])/g, ' $1').trim())}
              </span>
              {value ? (
                <ToggleRight className="h-5 w-5 text-green-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="mt-4">
              <span className={`text-xl font-bold tracking-tight ${value ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {value ? t('common.enabled') : t('common.disabled')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
