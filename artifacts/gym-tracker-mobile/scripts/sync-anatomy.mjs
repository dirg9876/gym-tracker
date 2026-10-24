import fs from "node:fs";
import ts from "typescript";

const repository = "HichamELBSI/react-native-body-highlighter";
const response = await fetch(`https://api.github.com/repos/${repository}/commits/${process.argv[2] ?? "main"}`);
if (!response.ok) throw new Error(`Commit lookup failed: ${response.status}`);
const { sha } = await response.json();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid source commit");
async function source(path) {
  const res = await fetch(`https://raw.githubusercontent.com/${repository}/${sha}/${path}`);
  if (!res.ok) throw new Error(`Source download failed: ${path}`);
  return res.text();
}
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error("Unsupported data property");
    return [property.name.text, literal(property.initializer)];
  }));
  throw new Error("Only literal anatomy data is accepted; source code is never executed");
}
async function parts(name) {
  const text = await source(`assets/${name}.ts`);
  const ast = ts.createSourceFile(`${name}.ts`, text, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations).find(d => ts.isIdentifier(d.name) && d.name.text === name);
  if (!declaration?.initializer) throw new Error(`Missing ${name}`);
  return literal(declaration.initializer).map(({ slug, path }) => {
    const paths = Object.values(path).flat();
    if (!slug || !paths.length || paths.some(d => typeof d !== "string" || !d.startsWith("M"))) throw new Error("Invalid muscle path");
    return { slug, paths };
  });
}
const license = await source("LICENSE");
if (!license.includes("MIT License") || !license.includes("ELABBASSI Hicham")) throw new Error("Review upstream license before updating");
const data = { source: `https://github.com/${repository}/tree/${sha}`, license,
  front: await parts("bodyFront"), back: await parts("bodyBack") };
const directory = new URL("../assets/anatomy/", import.meta.url);
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(new URL("muscles.json", directory), JSON.stringify(data, null, 2) + "\n");
fs.writeFileSync(new URL("LICENSE", directory), license);
console.log(`Synced MIT anatomy paths at ${sha}: ${data.front.length} front / ${data.back.length} back parts`);
