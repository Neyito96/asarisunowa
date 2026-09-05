import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const outputDirectory = "dist/client";
const repositoryPath = "/asarisunowa";
const textExtensions = new Set([".html", ".rsc", ".js", ".css", ".json"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else files.push(path);
  }
  return files;
}

for (const file of await collectFiles(outputDirectory)) {
  if (!textExtensions.has(extname(file))) continue;
  const source = await readFile(file, "utf8");
  const prepared = source
    .replaceAll('"/assets/', `"${repositoryPath}/assets/`)
    .replaceAll("'/assets/", `'${repositoryPath}/assets/`)
    .replaceAll("(/assets/", `(${repositoryPath}/assets/`)
    .replaceAll("\\\"/assets/", `\\\"${repositoryPath}/assets/`);
  if (prepared !== source) await writeFile(file, prepared);
}

await writeFile(join(outputDirectory, ".nojekyll"), "");
await writeFile(
  join(outputDirectory, "404.html"),
  await readFile(join(outputDirectory, "index.html"), "utf8"),
);

console.log(`GitHub Pages files prepared in ${outputDirectory}`);
