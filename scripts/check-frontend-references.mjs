import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve("src");
const sourceExtensions = new Set([".js", ".jsx"]);
const reactHooks = new Set([
  "useCallback",
  "useContext",
  "useEffect",
  "useId",
  "useMemo",
  "useReducer",
  "useRef",
  "useState",
]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function resolveImport(fromFile, importPath) {
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js")];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([\w$]+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const item of match[1].split(",")) names.add(item.trim().split(/\s+as\s+/)[0]);
  }
  return names;
}

const errors = [];
for (const file of sourceFiles(root)) {
  const source = fs.readFileSync(file, "utf8");

  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const importPath = match[2];
    if (!importPath.startsWith(".")) continue;
    const target = resolveImport(file, importPath);
    if (!target) {
      errors.push(`${file}: no se pudo resolver ${importPath}`);
      continue;
    }
    const exports = exportedNames(fs.readFileSync(target, "utf8"));
    for (const item of match[1].split(",")) {
      const imported = item.trim().split(/\s+as\s+/)[0];
      if (imported && !exports.has(imported)) errors.push(`${file}: ${imported} no está exportado por ${target}`);
    }
  }

  const reactImport = source.match(/import\s+(?:React\s*,\s*)?\{([^}]+)\}\s*from\s*["']react["']/);
  const importedHooks = new Set((reactImport?.[1] || "").split(",").map((item) => item.trim()).filter(Boolean));
  for (const hook of reactHooks) {
    if (new RegExp(`\\b${hook}\\s*\\(`).test(source) && !importedHooks.has(hook) && !new RegExp(`React\\.${hook}\\s*\\(`).test(source)) {
      errors.push(`${file}: ${hook} se usa pero no está importado desde react`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Frontend reference check passed.");
}
