import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";

export function Players() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['players'],
    queryFn: () => portal.getPlayers(50)
  });

  const banMutation = useMutation({
    mutationFn: (playerId: string) => portal.banPlayer(playerId, "Banned by admin panel"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] })
  });

  const unbanMutation = useMutation({
    mutationFn: (playerId: string) => portal.unbanPlayer(playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] })
  });

  if (isLoading) return <div>Loading players...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {(error as Error).message}</div>;

  const players = data?.players || [];

  return (
    <div>
      <h1>Player Management</h1>
      
      <div style={{ marginTop: "2rem", backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--kumo-colors-gray-4)" }}>
        <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--kumo-colors-gray-4)", color: "var(--kumo-colors-gray-11)" }}>
              <th style={{ padding: "0.75rem 0" }}>Player ID</th>
              <th>Name</th>
              <th>Created At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "1rem", textAlign: "center" }}>No players found.</td></tr>
            ) : players.map(p => (
              <tr key={p.playerId} style={{ borderBottom: "1px solid var(--kumo-colors-gray-3)" }}>
                <td style={{ padding: "0.75rem 0", fontFamily: "monospace" }}>{p.playerId}</td>
                <td style={{ fontWeight: 600 }}>{p.playerName || "Unknown"}</td>
                <td style={{ color: "var(--kumo-colors-gray-11)" }}>{new Date(p.createdAt).toLocaleString()}</td>
                <td>
                  {p.ban ? (
                    <span style={{ color: "var(--kumo-colors-red-9)", backgroundColor: "var(--kumo-colors-red-2)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.875rem" }}>Banned</span>
                  ) : (
                    <span style={{ color: "var(--kumo-colors-green-9)", backgroundColor: "var(--kumo-colors-green-2)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.875rem" }}>Active</span>
                  )}
                </td>
                <td>
                  {p.ban ? (
                    <Button variant="secondary" onClick={() => unbanMutation.mutate(p.playerId)}>Unban</Button>
                  ) : (
                    <Button variant="destructive" onClick={() => banMutation.mutate(p.playerId)}>Ban</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
