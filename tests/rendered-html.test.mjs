import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the complete homepage narrative", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Applied AI for what you/);
  assert.match(html, /Move faster/);
  assert.match(html, /We started where shortcuts are not an option/);
  assert.match(html, /Nonprofits &amp; NGOs/);
  assert.match(html, /Biotech &amp; Life Sciences/);
  assert.match(html, /Consumer Goods/);
  assert.match(html, /The people turning/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("renders the three application pages", async () => {
  for (const path of [
    "/nonprofits-and-ngos",
    "/biotech-life-sciences",
    "/consumer-goods",
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /One workflow/);
    assert.match(html, /Apply to build with us/);
  }
});

test("renders the prototype application flow", async () => {
  const response = await render("/apply");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Start with one workflow that matters/);
  assert.match(html, /this form does not transmit or store information/i);
});
