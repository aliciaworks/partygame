import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button } from "../components/ui/button";
import { Table } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useState } from "react";
import { Terminal, Upload, ShieldAlert, Sparkles } from "lucide-react";

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
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Terminal className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Operations (Hotfixes)</h1>
      </div>

      {/* Upload Hotfix Form */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Upload Hotfix (.zip or .js)</h3>
          <p className="text-sm text-muted-foreground mt-1">Deploy minor application hotfixes live without taking the system offline.</p>
        </div>
        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <Input 
            type="file" 
            accept=".zip,.js" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!file || uploadMutation.isPending}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? "Uploading..." : "Deploy Hotfix"}
          </Button>
        </form>
      </div>

      {/* Deployment History Table */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold tracking-tight">Deployment History</h3>
        {isLoading ? (
          <div className="text-muted-foreground animate-pulse">Loading deployments...</div>
        ) : (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <Table>
              <Table.Header>
                <Table.Row className="bg-muted/50">
                  <Table.Head className="font-semibold text-foreground">Version</Table.Head>
                  <Table.Head className="font-semibold text-foreground">File Size</Table.Head>
                  <Table.Head className="font-semibold text-foreground">Uploaded At</Table.Head>
                  <Table.Head className="font-semibold text-foreground">Status</Table.Head>
                  <Table.Head className="font-semibold text-foreground">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {manifests.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hotfixes deployed.
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  manifests.map((m: any) => (
                    <Table.Row key={m.version} className="hover:bg-muted/30">
                      <Table.Cell className="font-mono text-xs">{m.version}</Table.Cell>
                      <Table.Cell className="text-muted-foreground">{(m.size / 1024).toFixed(1)} KB</Table.Cell>
                      <Table.Cell className="text-muted-foreground">{new Date(m.uploadedAt).toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        {m.active ? (
                          <Badge variant="success" appearance="dot">Live</Badge>
                        ) : (
                          <Badge variant="neutral" appearance="dot">Inactive</Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          {!m.active && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => promoteMutation.mutate(m.version)}
                              className="flex items-center gap-1 hover:border-primary hover:text-primary transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                              Promote
                            </Button>
                          )}
                          {m.active && manifests.length > 1 && (
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => rollbackMutation.mutate(String((manifests[1] as any)?.version || ""))}
                              className="flex items-center gap-1"
                            >
                              <ShieldAlert className="h-4 w-4" />
                              Rollback to Prev
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
