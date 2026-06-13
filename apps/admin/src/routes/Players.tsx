import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button } from "../components/ui/button";
import { Table } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Users, ShieldAlert, ShieldCheck } from "lucide-react";

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

  if (isLoading) return <div className="text-muted-foreground animate-pulse">Loading players...</div>;
  if (error) return <div className="text-red-500 font-semibold">Error: {(error as Error).message}</div>;

  const players = data?.players || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Player Management</h1>
      </div>
      
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <Table.Header>
            <Table.Row className="bg-muted/50">
              <Table.Head className="font-semibold text-foreground">Player ID</Table.Head>
              <Table.Head className="font-semibold text-foreground">Name</Table.Head>
              <Table.Head className="font-semibold text-foreground">Created At</Table.Head>
              <Table.Head className="font-semibold text-foreground">Status</Table.Head>
              <Table.Head className="font-semibold text-foreground">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {players.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No players found.
                </Table.Cell>
              </Table.Row>
            ) : (
              players.map((p: any) => (
                <Table.Row key={p.playerId} className="hover:bg-muted/30">
                  <Table.Cell className="font-mono text-xs">{p.playerId}</Table.Cell>
                  <Table.Cell className="font-semibold text-foreground">{p.playerName || "Unknown"}</Table.Cell>
                  <Table.Cell className="text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    {p.ban ? (
                      <Badge variant="error" appearance="dot">Banned</Badge>
                    ) : (
                      <Badge variant="success" appearance="dot">Active</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {p.ban ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1 hover:border-green-500 hover:text-green-500 transition-colors"
                        onClick={() => unbanMutation.mutate(p.playerId)}
                        disabled={unbanMutation.isPending}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Unban
                      </Button>
                    ) : (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => banMutation.mutate(p.playerId)}
                        disabled={banMutation.isPending}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Ban
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
}
