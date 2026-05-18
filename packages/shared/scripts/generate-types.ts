import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildGeneratedArtifacts } from "../src/typegen";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(SCRIPT_DIR, "../../../engines");

export function writeGeneratedArtifacts() {
  const artifacts = buildGeneratedArtifacts();

  for (const [relativePath, content] of Object.entries(artifacts)) {
    const outputPath = path.join(OUT_DIR, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      content.endsWith("\n") ? content : `${content}\n`,
    );
  }
}

function main() {
  writeGeneratedArtifacts();
  console.log(
    "Successfully generated standard Plugins for Unity (UPM), Godot (Addon), and Unreal (uplugin)!",
  );
}

const isExecutedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isExecutedDirectly) {
  main();
}
