// Find flash calls whose path template lost its ${...} interpolation (PowerShell -replace casualties).
const fs = require("fs");
const path = require("path");
const dir = "src/server/actions";
for (const f of fs.readdirSync(dir)) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const re = /flash(Ok|Err)\((`[^`\n]*`)/g;
  let m;
  while ((m = re.exec(s))) {
    if (!m[2].includes("${")) {
      const line = s.slice(0, m.index).split("\n").length;
      console.log(`${f}:${line}  ${m[2]}`);
    }
  }
}
