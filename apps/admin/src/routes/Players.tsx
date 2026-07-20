import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button, Badge, Loader } from "../components/ui";
import { Users, ShieldCheck, ShieldWarning } from "@phosphor-icons/react";

export function Players() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["players"],
    queryFn: () => portal.getPlayers(50),
  });

  const banMutation = useMutation({
    mutationFn: (playerId: string) =>
      portal.banPlayer(playerId, "Banned by admin panel"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });

  const unbanMutation = useMutation({
    mutationFn: (playerId: string) => portal.unbanPlayer(playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });

  if (isLoading) return <Loader />;
  if (error)
    return (
      <div className="text-kumo-danger font-semibold">
        Error: {(error as Error).message}
      </div>
    );

  const players = data?.players || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-kumo-brand" />
        <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
          Player Management
        </h1>
      </div>

      <div className="bg-kumo-elevated border border-kumo-line rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-kumo-recessed border-b border-kumo-line">
              <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase tracking-wider">
                Player ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-kumo-subtle"
                >
                  No players found.
                </td>
              </tr>
            ) : (
              players.map((p: any) => (
                <tr
                  key={p.playerId}
                  className="border-b border-kumo-hairline hover:bg-kumo-tint transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-kumo-subtle">
                    {p.playerId}
                  </td>
                  <td className="px-4 py-3 font-semibold text-kumo-default">
                    {p.playerName || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-kumo-subtle text-sm">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {p.ban ? (
                      <Badge variant="error" appearance="dot">
                        Banned
                      </Badge>
                    ) : (
                      <Badge variant="success" appearance="dot">
                        Active
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.ban ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={ShieldCheck}
                        onClick={() => unbanMutation.mutate(p.playerId)}
                        disabled={unbanMutation.isPending}
                      >
                        Unban
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        icon={ShieldWarning}
                        onClick={() => banMutation.mutate(p.playerId)}
                        disabled={banMutation.isPending}
                      >
                        Ban
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
