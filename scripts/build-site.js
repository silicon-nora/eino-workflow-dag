import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "site");
const distribution = resolve(projectRoot, "dist");
const output = resolve(projectRoot, ".artifacts/pages");

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
cpSync(distribution, resolve(output, "dist"), { recursive: true });

const indexPath = resolve(output, "index.html");
const index = readFileSync(indexPath, "utf8").replace(
  'name="eino-workflow-dag-asset-base" content="../dist/"',
  'name="eino-workflow-dag-asset-base" content="./dist/"',
);
writeFileSync(indexPath, index);
writeFileSync(resolve(output, ".nojekyll"), "");

console.log(`OK: public playground built at ${output}`);
