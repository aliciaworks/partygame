import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal, type PlatformState } from "../lib/portal";
import { Button, Checkbox, Loader, Banner } from "../components/ui";
import { useState, useEffect } from "react";
import { Gear, Warning, HardDrives, Plus, Trash } from "@phosphor-icons/react";

export function Settings() {
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery({
    queryKey: ["platformState"],
    queryFn: () => portal.getPlatformState(),
  });

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [serverTiers, setServerTiers] = useState<
    { id: string; name: string; description?: string; isDefault: boolean }[]
  >([]);

  useEffect(() => {
    if (state) {
      setMaintenance(state.maintenance?.enabled || false);
      setMaintenanceMsg(state.maintenance?.message || "");
      setServerTiers(
        (state as any).serverTiers || [
          { id: "main", name: "Main Server", isDefault: true },
          { id: "internal-testing", name: "Internal Testing" },
          { id: "public-testing", name: "Public Testing" },
        ],
      );
    }
  }, [state]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<PlatformState>) =>
      portal.updatePlatformStateFull(updates),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platformState"] }),
  });

  const save = () => {
    if (!state) return;
    updateMutation.mutate({
      ...state,
      maintenance: { enabled: maintenance, message: maintenanceMsg },
      serverTiers: serverTiers as any,
    });
  };

  if (isLoading) return <Loader />;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Gear className="h-8 w-8 text-kumo-brand" />
        <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
          Platform Settings
        </h1>
      </div>

      {/* ── Maintenance Mode ───────────────────────────────────── */}
      <div className="bg-kumo-elevated border border-kumo-line p-6 rounded-xl flex flex-col gap-5">
        <div>
          <h3 className="text-lg font-semibold text-kumo-default">
            Maintenance Mode
          </h3>
          <p className="text-sm text-kumo-subtle mt-1">
            Prevent new player logins. Existing connections won't be dropped.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={maintenance}
            onCheckedChange={(c) => setMaintenance(c as boolean)}
          />
          <span className="text-sm font-semibold text-kumo-default">
            Enable Maintenance Mode
          </span>
        </label>

        {maintenance && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-kumo-warning flex items-center gap-1.5">
              <Warning className="h-4 w-4" />
              Downtime Message
            </label>
            <textarea
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              placeholder="Server is undergoing scheduled maintenance..."
              className="w-full min-h-[100px] p-3 text-sm bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand resize-y"
            />
          </div>
        )}

        <div className="pt-3 border-t border-kumo-line flex justify-end">
          <Button
            onClick={save}
            variant="primary"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* ── Server Tiers ────────────────────────────────────────── */}
      <div className="bg-kumo-elevated border border-kumo-line p-6 rounded-xl flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-kumo-default flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Tiers (Environments)
          </h3>
          <p className="text-sm text-kumo-subtle mt-1">
            Manage deployment environments. Assets can be assigned to specific
            tiers.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {serverTiers.map((tier, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-kumo-recessed rounded-md border border-kumo-line"
            >
              <div className="flex-1 flex flex-col gap-2">
                <input
                  placeholder="Tier ID (e.g. main)"
                  value={tier.id}
                  onChange={(e) => {
                    const u = [...serverTiers];
                    u[i] = { ...u[i], id: e.target.value };
                    setServerTiers(u);
                  }}
                  className="text-sm font-mono px-2 py-1.5 bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand"
                  disabled={tier.id === "main"}
                />
                <input
                  placeholder="Display name (e.g. Main Server)"
                  value={tier.name}
                  onChange={(e) => {
                    const u = [...serverTiers];
                    u[i] = { ...u[i], name: e.target.value };
                    setServerTiers(u);
                  }}
                  className="text-sm px-2 py-1.5 bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand"
                />
              </div>
              <div className="flex items-center gap-3 shrink-0 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-kumo-subtle">
                  <Checkbox
                    checked={tier.isDefault}
                    onCheckedChange={(c) => {
                      setServerTiers(
                        serverTiers.map((t, j) => ({
                          ...t,
                          isDefault: j === i ? (c as boolean) : false,
                        })),
                      );
                    }}
                  />
                  Default
                </label>
                {tier.id !== "main" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash}
                    onClick={() =>
                      setServerTiers(serverTiers.filter((_, j) => j !== i))
                    }
                    className="text-kumo-danger"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() =>
              setServerTiers([
                ...serverTiers,
                {
                  id: `tier-${Date.now()}`,
                  name: "",
                  isDefault: false,
                },
              ])
            }
          >
            Add Tier
          </Button>
        </div>

        <div className="pt-3 border-t border-kumo-line flex justify-end">
          <Button
            onClick={save}
            variant="primary"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
