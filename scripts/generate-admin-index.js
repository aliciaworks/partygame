/**
 * Post-build: reads built admin index.html → TypeScript module for worker.
 * Usage: node scripts/generate-admin-index.js
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "apps", "admin", "build", "index.html");
const dst = path.join(__dirname, "..", "apps", "worker", "src", "admin-index.generated.ts");

if (!fs.existsSync(src)) { console.error("ERROR: admin not built"); process.exit(1); }

const h = fs.readFileSync(src, "utf-8")
  .replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

fs.writeFileSync(dst, `// generated\nexport const ADMIN_INDEX_HTML = \`${h}\`;\n`);
console.log("Generated admin-index.generated.ts");
