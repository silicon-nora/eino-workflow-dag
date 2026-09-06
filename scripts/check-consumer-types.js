import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import ts from "typescript";

const projectRoot = resolve(import.meta.dirname, "..");
const sourcePath = process.argv[2] ? resolve(process.argv[2]) : null;
const rootTypeName = process.argv[3] || "DAGMetrics";

function fail(message) {
  throw new Error(`Consumer type check failed: ${message}`);
}

if (!sourcePath) {
  fail("usage: node scripts/check-consumer-types.js <source.ts> [type-name]");
}
if (!existsSync(sourcePath)) fail(`source file does not exist: ${sourcePath}`);
if (!/^[A-Za-z_$][\w$]*$/.test(rootTypeName)) {
  fail(`invalid type name: ${rootTypeName}`);
}

const sourceText = readFileSync(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const declarations = new Map();
for (const statement of sourceFile.statements) {
  if (
    (ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    declarations.set(statement.name.text, statement);
  }
}

const selected = new Set();
function selectDeclaration(name) {
  if (selected.has(name)) return;
  const declaration = declarations.get(name);
  if (!declaration) {
    if (name === rootTypeName) fail(`type is not declared in source: ${name}`);
    return;
  }
  selected.add(name);
  ts.forEachChild(declaration, function visit(node) {
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      selectDeclaration(node.typeName.text);
    }
    if (
      ts.isExpressionWithTypeArguments(node) &&
      ts.isIdentifier(node.expression)
    ) {
      selectDeclaration(node.expression.text);
    }
    ts.forEachChild(node, visit);
  });
}
selectDeclaration(rootTypeName);

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const extracted = [...sourceFile.statements]
  .filter((statement) => statement.name && selected.has(statement.name.text))
  .map((statement) => printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile))
  .join("\n\n");
const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-consumer-"));
const executable = resolve(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc",
);

try {
  copyFileSync(resolve(projectRoot, "src/index.d.ts"), resolve(work, "library.d.ts"));
  writeFileSync(resolve(work, "consumer.d.ts"), `${extracted}\n`, "utf8");
  writeFileSync(
    resolve(work, "check.ts"),
    [
      'import type { DAGData } from "./library.js";',
      `import type { ${rootTypeName} } from "./consumer.js";`,
      `declare const consumerDAG: ${rootTypeName};`,
      "const acceptedByRenderer: DAGData = consumerDAG;",
      "void acceptedByRenderer;",
      "",
    ].join("\n"),
    "utf8",
  );
  const result = spawnSync(
    executable,
    [
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--strict",
      "--noEmit",
      "--skipLibCheck",
      "false",
      "check.ts",
    ],
    { cwd: work, encoding: "utf8", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    fail(`${rootTypeName} is not assignable to DAGData`);
  }
  console.log(
    `OK: ${rootTypeName} from ${basename(sourcePath)} is assignable to DAGData`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
