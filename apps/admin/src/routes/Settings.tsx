import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal, type PlatformState } from "../lib/portal";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { useState, useEffect } from "react";
import { Settings as SettingsIcon, AlertCircle } from "lucide-react";

export function Settings() {
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery({
    queryKey: ['platformState'],
    queryFn: () => portal.getPlatformState()
  });

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");

  useEffect(() => {
    if (state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMaintenance(state.maintenance?.enabled || false);
      setMaintenanceMsg(state.maintenance?.message || "");
    }
  }, [state]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<PlatformState>) => portal.updatePlatformStateFull(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platformState'] })
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    
    updateMutation.mutate({
      ...state,
      maintenance: {
        enabled: maintenance,
        message: maintenanceMsg
      }
    });
  };

  if (isLoading) return <div className="text-muted-foreground animate-pulse">Loading...</div>;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
      </div>

      <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-semibold tracking-tight mb-1">Maintenance Mode</h3>
          <p className="text-sm text-muted-foreground">
            Enable maintenance mode to prevent new player logins. Existing active connections will not be dropped immediately.
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <Checkbox 
              checked={maintenance}
              onCheckedChange={(checked) => setMaintenance(checked as boolean)}
            />
            <span className="text-sm font-semibold text-foreground">Enable Maintenance Mode</span>
          </label>

          {maintenance && (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                Downtime Message
              </label>
              <textarea 
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="Server is undergoing scheduled maintenance..."
                className="w-full min-h-[100px] p-3 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-sans"
              />
            </div>
          )}

          <div className="pt-2 border-t border-border flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
