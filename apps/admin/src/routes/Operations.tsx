import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Input } from "@cloudflare/kumo/components/input";
import { useState } from "react";

export function Operations() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hotfixes'],
    queryFn: () => portal.getHotfixes()
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => portal.uploadHotfix(formData),
    onSuccess: () => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['hotfixes'] });
    }
  });

  const promoteMutation = useMutation({
    mutationFn: (version: string) => portal.promoteHotfix(version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotfixes'] })
  });

  const rollbackMutation = useMutation({
    mutationFn: (version: string) => portal.rollbackHotfix(version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotfixes'] })
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    uploadMutation.mutate(formData);
  };

  const manifests = data?.manifests || [];

  return (
    <div>
      <h1 style={{ marginBottom: "2rem" }}>Operations (Hotfixes)</h1>

      <div style={{ marginBottom: "3rem" }}>
        <h3 style={{ marginBottom: "1rem" }}>Upload Hotfix (.zip or .js)</h3>
        <form onSubmit={handleUpload} style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Input 
            type="file" 
            accept=".zip,.js" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ maxWidth: "300px" }}
          />
          <Button type="submit" disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Deploy Hotfix"}
          </Button>
        </form>
      </div>

      <div>
        <h3 style={{ marginBottom: "1rem" }}>Deployment History</h3>
        {isLoading ? <p>Loading...</p> : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Version</Table.Head>
                <Table.Head>File Size</Table.Head>
                <Table.Head>Uploaded At</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {manifests.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                    No hotfixes deployed.
                  </Table.Cell>
                </Table.Row>
              ) : manifests.map((m: any) => (
                <Table.Row key={m.version}>
                  <Table.Cell style={{ fontFamily: "monospace" }}>{m.version}</Table.Cell>
                  <Table.Cell>{(m.size / 1024).toFixed(1)} KB</Table.Cell>
                  <Table.Cell>{new Date(m.uploadedAt).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    {m.active ? (
                      <Badge variant="success" appearance="dot">Live</Badge>
                    ) : (
                      <Badge variant="neutral" appearance="dot">Inactive</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ display: "flex", gap: "0.5rem" }}>
                    {!m.active && (
                      <Button variant="secondary" onClick={() => promoteMutation.mutate(m.version)}>Promote</Button>
                    )}
                    {m.active && manifests.length > 1 && (
                      <Button variant="destructive" onClick={() => rollbackMutation.mutate(manifests[1]?.version)}>Rollback to Prev</Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </div>
  );
}
