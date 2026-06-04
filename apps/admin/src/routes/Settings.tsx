import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal, type PlatformState } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
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
      <h1 style={{ marginBottom: "2rem" }}>Platform Settings</h1>

      <div style={{ maxWidth: "600px" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Maintenance Mode</h3>
        <p style={{ color: "var(--kumo-colors-gray-11)", marginBottom: "1.5rem", display: "block" }}>
          Enable maintenance mode to prevent new player logins. Existing active connections will not be dropped immediately.
        </p>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, cursor: "pointer" }}>
            <Checkbox 
              checked={maintenance}
              onCheckedChange={(checked) => setMaintenance(checked as boolean)}
            />
            <span>Enable Maintenance</span>
          </label>

          {maintenance && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>Downtime Message</label>
              <textarea 
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="Server is undergoing scheduled maintenance..."
                style={{ 
                  padding: "0.75rem", 
                  borderRadius: "6px", 
                  border: "1px solid var(--kumo-colors-gray-6)", 
                  minHeight: "100px",
                  backgroundColor: "var(--kumo-colors-gray-1)",
                  fontFamily: "inherit",
                  fontSize: "0.875rem"
                }}
              />
            </div>
          )}

          <div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
