import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal, type PlatformState } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";
import { useState, useEffect } from "react";

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

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Platform Settings</h1>

      <div style={{ marginTop: "2rem", backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--kumo-colors-gray-4)", maxWidth: "600px" }}>
        <h3>Maintenance Mode</h3>
        <p style={{ color: "var(--kumo-colors-gray-11)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          Enable maintenance mode to prevent new player logins. Existing active connections will not be dropped immediately.
        </p>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
            <input 
              type="checkbox" 
              checked={maintenance}
              onChange={(e) => setMaintenance(e.target.checked)}
              style={{ width: "1.2rem", height: "1.2rem" }}
            />
            Enable Maintenance
          </label>

          {maintenance && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>Downtime Message</label>
              <textarea 
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="Server is undergoing scheduled maintenance..."
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--kumo-colors-gray-6)", minHeight: "80px" }}
              />
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
