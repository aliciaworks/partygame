import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { Button, Badge, Loader } from "./ui";
import { useState } from "react";
import { Terminal, Upload, Rocket, ShieldWarning } from "@phosphor-icons/react";

export function Operations() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hotfixes"],
    queryFn: () => portal.getHotfixes(),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => portal.uploadHotfix(formData),
    onSuccess: () => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["hotfixes"] });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (version: string) => portal.promoteHotfix(version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotfixes"] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (version: string) => portal.rollbackHotfix(version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotfixes"] }),
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Terminal className="h-8 w-8 text-kumo-brand" />
        <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
          Operations (Hotfixes)
        </h1>
      </div>

      {/* Upload form */}
      <div className="bg-kumo-elevated border border-kumo-line p-6 rounded-xl flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-kumo-default">
            Upload Hotfix (.zip or .js)
          </h3>
          <p className="text-sm text-kumo-subtle mt-1">
            Deploy minor application hotfixes live without taking the system
            offline.
          </p>
        </div>
        <form
          onSubmit={handleUpload}
          className="flex flex-col sm:flex-row gap-3 max-w-xl"
        >
          <input
            type="file"
            accept=".zip,.js"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1 text-sm text-kumo-default file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-kumo-brand file:text-white hover:file:opacity-90"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!file || uploadMutation.isPending}
            icon={Upload}
          >
            {uploadMutation.isPending ? "Uploading..." : "Deploy Hotfix"}
          </Button>
        </form>
      </div>

      {/* Deployment history */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-kumo-default">
          Deployment History
        </h3>
        {isLoading ? (
          <Loader />
        ) : (
          <div className="bg-kumo-elevated border border-kumo-line rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-kumo-recessed border-b border-kumo-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    Uploaded
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {manifests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-kumo-subtle"
                    >
                      No hotfixes deployed.
                    </td>
                  </tr>
                ) : (
                  manifests.map((m: any) => (
                    <tr
                      key={m.version}
                      className="border-b border-kumo-hairline hover:bg-kumo-tint transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {m.version}
                      </td>
                      <td className="px-4 py-3 text-kumo-subtle">
                        {(m.size / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-4 py-3 text-kumo-subtle text-sm">
                        {new Date(m.uploadedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {m.active ? (
                          <Badge variant="success" appearance="dot">
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="neutral" appearance="dot">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {!m.active && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Rocket}
                              onClick={() =>
                                promoteMutation.mutate(m.version)
                              }
                            >
                              Promote
                            </Button>
                          )}
                          {m.active && manifests.length > 1 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              icon={ShieldWarning}
                              onClick={() =>
                                rollbackMutation.mutate(
                                  String(
                                    (manifests[1] as any)?.version || "",
                                  ),
                                )
                              }
                            >
                              Rollback
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
