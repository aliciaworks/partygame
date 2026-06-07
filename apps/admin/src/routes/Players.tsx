import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import { Badge } from "@cloudflare/kumo/components/badge";

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
      <h1 style={{ marginBottom: "2rem" }}>Player Management</h1>
      
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Player ID</Table.Head>
            <Table.Head>Name</Table.Head>
            <Table.Head>Created At</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {players.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                No players found.
              </Table.Cell>
            </Table.Row>
          ) : players.map((p: { playerId: string; playerName: string; createdAt: string; ban: boolean }) => (
            <Table.Row key={p.playerId}>
              <Table.Cell style={{ fontFamily: "monospace" }}>{p.playerId}</Table.Cell>
              <Table.Cell style={{ fontWeight: 600 }}>{p.playerName || "Unknown"}</Table.Cell>
              <Table.Cell>{new Date(p.createdAt).toLocaleString()}</Table.Cell>
              <Table.Cell>
                {p.ban ? (
                  <Badge variant="error" appearance="dot">Banned</Badge>
                ) : (
                  <Badge variant="success" appearance="dot">Active</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                {p.ban ? (
                  <Button variant="secondary" onClick={() => unbanMutation.mutate(p.playerId)}>Unban</Button>
                ) : (
                  <Button variant="destructive" onClick={() => banMutation.mutate(p.playerId)}>Ban</Button>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
