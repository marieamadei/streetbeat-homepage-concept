import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = new URL("../docs/", import.meta.url);
const clientRoot = new URL("../dist/client/", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
const basePath = "/streetbeat-homepage-concept";

const routes = [
  ["/", "index.html"],
  ["/apply", "apply/index.html"],
  ["/nonprofits-and-ngos", "nonprofits-and-ngos/index.html"],
  ["/biotech-life-sciences", "biotech-life-sciences/index.html"],
  ["/consumer-goods", "consumer-goods/index.html"],
];

await rm(docsRoot, { recursive: true, force: true });
await mkdir(docsRoot, { recursive: true });
await cp(clientRoot, docsRoot, { recursive: true });

workerUrl.searchParams.set("export", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function withBasePath(html) {
  return html
    .replaceAll('href="/', `href="${basePath}/`)
    .replaceAll('src="/', `src="${basePath}/`)
    .replaceAll('action="/', `action="${basePath}/`)
    .replaceAll('\\"href\\":\\"/', `\\"href\\":\\"${basePath}/`)
    .replaceAll('\\"src\\":\\"/', `\\"src\\":\\"${basePath}/`)
    .replaceAll('\\"action\\":\\"/', `\\"action\\":\\"${basePath}/`)
    .replaceAll(`${basePath}//`, `${basePath}/`);
}

for (const [route, destination] of routes) {
  const response = await worker.fetch(
    new Request(`http://localhost${route}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  if (response.status !== 200) {
    throw new Error(`Failed to render ${route}: ${response.status}`);
  }

  const target = new URL(destination, docsRoot);
  await mkdir(new URL("./", target), { recursive: true });
  await writeFile(target, withBasePath(await response.text()), "utf8");
}

async function prefixCssAssets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) {
      await prefixCssAssets(target);
    } else if (extname(entry.name) === ".css") {
      const css = await readFile(target, "utf8");
      await writeFile(target, css.replaceAll('url("/', `url("${basePath}/`), "utf8");
    }
  }
}

await prefixCssAssets(fileURLToPath(docsRoot));
await writeFile(new URL(".nojekyll", docsRoot), "", "utf8");
await writeFile(
  new URL("README.txt", docsRoot),
  "Generated public preview for GitHub Pages. Edit the source files in /app, not this folder.\n",
  "utf8",
);

console.log(`Exported ${routes.length} routes to ${docsRoot.pathname}`);
