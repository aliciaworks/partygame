import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portal } from "../lib/portal";
import { generateVariants, extractWatermark, type WatermarkProgress } from "../lib/watermark";
import { Button, Badge, Checkbox, Loader } from "../components/ui";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Package,
  Upload,
  Trash,
  ShieldCheck,
  Fingerprint,
  Flask,
  ChartBar,
  Spinner,
} from "@phosphor-icons/react";

const SECRET_SEED = "partygame-watermark-v1";

// ── Predefined variant counts for A/B/C testing ──────────────────────────────

const VARIANT_PRESETS = [2, 4, 8, 16, 32, 64];

// ── Component ────────────────────────────────────────────────────────────────

export function Assets() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form
  const [assetName, setAssetName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [variantCount, setVariantCount] = useState(4);

  // Progress
  const [uploading, setUploading] = useState(false);
  const [watermarkProgress, setWatermarkProgress] = useState<WatermarkProgress[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Forensic
  const [forensicFile, setForensicFile] = useState<File | null>(null);
  const [forensicResult, setForensicResult] = useState<{
    found: boolean;
    variantIndex?: number;
    payload?: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: () => portal.getAssets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => portal.deleteAsset(assetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });

  // ── Upload handler ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedFile || !assetName.trim()) return;
      setUploading(true);
      setError(null);
      setWatermarkProgress([]);
      setUploadStatus("");

      try {
        const count = watermarkEnabled ? variantCount : 1;

        // 1. Create asset on server
        setUploadStatus("Creating asset...");
        const created = await portal.createAsset({
          name: assetName.trim(),
          watermarkEnabled,
          variantCount: count,
        });
        const { assetId, uploadUrls } = created;

        // 2. Generate watermarked variants in browser
        const variants = watermarkEnabled
          ? await generateVariants(selectedFile, assetId, count, SECRET_SEED, (prog) =>
              setWatermarkProgress((prev) => [
                ...prev.filter((p) => p.variantIndex !== prog.variantIndex),
                prog,
              ]),
            )
          : [{ variantIndex: 0, data: await selectedFile.arrayBuffer() }];

        // 3. Upload each variant
        for (let i = 0; i < variants.length; i++) {
          const { variantIndex, data } = variants[i];
          setUploadStatus(`Uploading variant ${variantIndex + 1}/${variants.length}...`);
          await portal.uploadAssetVariant(assetId, variantIndex, data);
        }

        setUploadStatus("Done!");
        setSelectedFile(null);
        setAssetName("");
        if (fileRef.current) fileRef.current.value = "";
        queryClient.invalidateQueries({ queryKey: ["assets"] });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setTimeout(() => {
          setUploadStatus("");
          setWatermarkProgress([]);
        }, 3000);
      }
    },
    [selectedFile, assetName, watermarkEnabled, variantCount, queryClient],
  );

  // ── Forensic handler ───────────────────────────────────────────────────────

  const handleForensic = useCallback(async () => {
    if (!forensicFile) return;
    try {
      const buf = await forensicFile.arrayBuffer();
      const local = extractWatermark(buf);
      if (local) {
        setForensicResult({ found: true, ...local });
        return;
      }
      const remote = await portal.extractWatermark(buf);
      setForensicResult(remote);
    } catch {
      setForensicResult({ found: false });
    }
  }, [forensicFile]);

  const assets = (data?.assets as any[]) || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Package className="h-8 w-8 text-kumo-brand" />
        <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
          {t("assets.title", "Asset Manager")}
        </h1>
      </div>

      {/* ── Upload Card ─────────────────────────────────────────────── */}
      <div className="bg-kumo-elevated border border-kumo-line p-6 rounded-xl flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-kumo-default flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("assets.upload_title", "Upload Asset")}
          </h3>
          <p className="text-sm text-kumo-subtle mt-1">
            {t(
              "assets.upload_desc",
              "Upload game assets with hidden watermarking and A/B/C testing variants.",
            )}
          </p>
        </div>

        <form onSubmit={handleUpload} className="flex flex-col gap-4 max-w-2xl">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-kumo-default">
              {t("assets.name_label", "Asset Name")}
            </label>
            <input
              type="text"
              placeholder="ship_model_v2.glb"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              required
              className="px-3 py-2 text-sm bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand"
            />
          </div>

          {/* File */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-kumo-default">
              {t("assets.file_label", "Asset File")}
            </label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="text-sm text-kumo-default file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-kumo-brand file:text-white hover:file:opacity-90"
            />
            {selectedFile && (
              <span className="text-xs text-kumo-subtle">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          {/* Watermark toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={watermarkEnabled}
              onCheckedChange={(c) => setWatermarkEnabled(c as boolean)}
            />
            <span className="text-sm font-semibold text-kumo-default flex items-center gap-1.5">
              <Fingerprint className="h-4 w-4" />
              {t("assets.watermark_enable", "Enable Hidden Watermark")}
            </span>
          </label>

          {/* Variant count (A/B/C) */}
          {watermarkEnabled && (
            <div className="flex flex-col gap-2 ml-8 pl-4 border-l-2 border-kumo-brand/30">
              <label className="text-sm font-semibold text-kumo-default flex items-center gap-1.5">
                <Flask className="h-4 w-4 text-kumo-brand" />
                {t("assets.variant_count", "A/B/C Test Variants")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={256}
                  value={variantCount}
                  onChange={(e) =>
                    setVariantCount(Math.max(2, Math.min(256, parseInt(e.target.value) || 2)))
                  }
                  className="w-20 px-2 py-1.5 text-sm bg-kumo-base border border-kumo-line rounded-md text-kumo-default focus:outline-none focus:ring-2 focus:ring-kumo-brand"
                />
                <span className="text-sm text-kumo-subtle">
                  {t("assets.variant_hint", "{{count}} uniquely watermarked copies.", {
                    count: variantCount,
                  })}
                </span>
              </div>
              <div className="flex gap-1.5 mt-1">
                {VARIANT_PRESETS.map((n) => (
                  <Button
                    key={n}
                    variant={variantCount === n ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setVariantCount(n)}
                    type="button"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm bg-kumo-danger-tint text-kumo-danger border border-kumo-danger/30 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Watermark generation progress */}
          {watermarkProgress.length > 0 && (
            <div className="flex flex-col gap-1.5 bg-kumo-recessed p-3 rounded-md">
              <span className="text-xs font-semibold text-kumo-subtle flex items-center gap-1.5">
                <Spinner className="h-3 w-3 animate-spin" />
                {t("assets.processing", "Processing variants...")}
              </span>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: variantCount }).map((_, i) => {
                  const prog = watermarkProgress.find((p) => p.variantIndex === i);
                  const done = prog?.status === "done";
                  const err = prog?.status === "error";
                  return (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-sm text-[10px] flex items-center justify-center font-mono ${
                        done
                          ? "bg-kumo-success text-white"
                          : err
                            ? "bg-kumo-danger text-white"
                            : "bg-kumo-recessed border border-kumo-line"
                      }`}
                    >
                      {i}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload status */}
          {uploadStatus && (
            <div className="text-sm font-medium text-kumo-brand flex items-center gap-2">
              {uploadStatus !== "Done!" && <Spinner className="h-4 w-4 animate-spin" />}
              {uploadStatus}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              icon={Upload}
              disabled={!selectedFile || !assetName.trim() || uploading}
            >
              {uploading
                ? t("assets.uploading", "Uploading...")
                : watermarkEnabled
                  ? t("assets.upload_watermarked", "Upload {{count}} Variants", {
                      count: variantCount,
                    })
                  : t("assets.upload_btn", "Upload Asset")}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Assets Table ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-kumo-default flex items-center gap-2">
          <ChartBar className="h-5 w-5" />
          {t("assets.asset_list", "Deployed Assets")}
        </h3>

        {isLoading ? (
          <Loader />
        ) : (
          <div className="bg-kumo-elevated border border-kumo-line rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-kumo-recessed border-b border-kumo-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    {t("assets.col_name", "Name")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    {t("assets.col_id", "Asset ID")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    {t("assets.col_variants", "Variants")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    {t("assets.col_size", "Size")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    {t("assets.col_date", "Uploaded")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-kumo-default uppercase" />
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-kumo-subtle">
                      {t("assets.empty", "No assets uploaded yet.")}
                    </td>
                  </tr>
                ) : (
                  assets.map((a: any) => (
                    <tr
                      key={a.assetId}
                      className="border-b border-kumo-hairline hover:bg-kumo-tint transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-kumo-default">{a.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-kumo-subtle">
                        {a.assetId}
                      </td>
                      <td className="px-4 py-3">
                        {a.watermarkEnabled ? (
                          <Badge variant="success" appearance="dot">
                            {a.variantCount} variants
                          </Badge>
                        ) : (
                          <Badge variant="neutral" appearance="dot">
                            1 (no watermark)
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-kumo-subtle text-sm">
                        {a.originalSize > 0
                          ? `${(a.originalSize / 1024).toFixed(1)} KB`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-kumo-subtle text-sm">
                        {new Date(a.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {a.watermarkEnabled ? (
                          <Badge variant="success" appearance="dot">
                            <ShieldCheck className="h-3 w-3 inline mr-1" />
                            Watermarked
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Standard</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="destructive"
                          size="sm"
                          icon={Trash}
                          onClick={() => {
                            if (
                              confirm(`Delete "${a.name}"? This removes all variants.`)
                            )
                              deleteMutation.mutate(a.assetId);
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Forensic Extraction ─────────────────────────────────────── */}
      <div className="bg-kumo-elevated border border-kumo-line p-6 rounded-xl flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-kumo-default flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t("assets.forensic_title", "Forensic Watermark Extraction")}
          </h3>
          <p className="text-sm text-kumo-subtle mt-1">
            {t(
              "assets.forensic_desc",
              "Upload a leaked file to extract its hidden watermark and trace the source.",
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="file"
            onChange={(e) => {
              setForensicFile(e.target.files?.[0] || null);
              setForensicResult(null);
            }}
            className="flex-1 text-sm text-kumo-default file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-kumo-brand file:text-white"
          />
          <Button
            variant="secondary"
            icon={Fingerprint}
            onClick={handleForensic}
            disabled={!forensicFile}
          >
            {t("assets.extract_btn", "Extract")}
          </Button>
        </div>

        {forensicResult && (
          <div
            className={`p-4 rounded-md border ${
              forensicResult.found
                ? "bg-kumo-warning-tint border-kumo-warning/30 text-kumo-warning"
                : "bg-kumo-recessed border-kumo-line text-kumo-subtle"
            }`}
          >
            {forensicResult.found ? (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  {t("assets.watermark_found", "Watermark Found!")}
                </span>
                <span className="text-sm">
                  {t("assets.variant_label", "Variant Index")}:{" "}
                  <code className="font-mono font-bold">{forensicResult.variantIndex}</code>
                </span>
                <span className="text-xs font-mono break-all opacity-70">
                  HMAC: {forensicResult.payload}
                </span>
              </div>
            ) : (
              <span className="text-sm">
                {t("assets.watermark_not_found", "No watermark block found.")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
