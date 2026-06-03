import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button } from "@cloudflare/kumo/components/button";
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
      <h1>Operations (Hotfixes)</h1>

      <div style={{ marginTop: "2rem", backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--kumo-colors-gray-4)", marginBottom: "2rem" }}>
        <h3>Upload Hotfix (.zip or .js)</h3>
        <form onSubmit={handleUpload} style={{ display: "flex", gap: "1rem", marginTop: "1rem", alignItems: "center" }}>
          <input 
            type="file" 
            accept=".zip,.js" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button type="submit" disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Deploy Hotfix"}
          </Button>
        </form>
      </div>

      <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--kumo-colors-gray-4)" }}>
        <h3>Deployment History</h3>
        {isLoading ? <div>Loading...</div> : (
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--kumo-colors-gray-4)", color: "var(--kumo-colors-gray-11)" }}>
                <th style={{ padding: "0.75rem 0" }}>Version</th>
                <th>File Size</th>
                <th>Uploaded At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manifests.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "1rem", textAlign: "center" }}>No hotfixes deployed.</td></tr>
              ) : manifests.map(m => (
                <tr key={m.version} style={{ borderBottom: "1px solid var(--kumo-colors-gray-3)" }}>
                  <td style={{ padding: "0.75rem 0", fontFamily: "monospace" }}>{m.version}</td>
                  <td>{(m.size / 1024).toFixed(1)} KB</td>
                  <td style={{ color: "var(--kumo-colors-gray-11)" }}>{new Date(m.uploadedAt).toLocaleString()}</td>
                  <td>
                    {m.active ? (
                      <span style={{ color: "var(--kumo-colors-green-9)", backgroundColor: "var(--kumo-colors-green-2)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.875rem" }}>Live</span>
                    ) : (
                      <span style={{ color: "var(--kumo-colors-gray-9)", backgroundColor: "var(--kumo-colors-gray-2)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.875rem" }}>Inactive</span>
                    )}
                  </td>
                  <td>
                    {!m.active && (
                      <Button variant="secondary" onClick={() => promoteMutation.mutate(m.version)}>Promote</Button>
                    )}
                    {m.active && manifests.length > 1 && (
                      <Button variant="destructive" onClick={() => rollbackMutation.mutate(manifests[1]?.version)}>Rollback to Prev</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
