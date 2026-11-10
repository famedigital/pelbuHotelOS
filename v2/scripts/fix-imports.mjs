import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      const c = fs.readFileSync(p, "utf8");
      const n = c.replace(/from (["'])(\.[^"']+)\.ts\1/g, "from $1$2.js$1");
      if (n !== c) {
        fs.writeFileSync(p, n);
        console.log("fixed", p);
      }
    }
  }
}

walk(path.resolve("c:/GitHub/Hotel OS Bhutan/v2"));
