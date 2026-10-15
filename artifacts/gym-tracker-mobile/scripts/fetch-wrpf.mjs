import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../../apk/norm-sources/', import.meta.url);
await mkdir(root, { recursive: true });
const html = await (await fetch('https://wrpf.pro/razryadnye-normativy-wrpf-wepf-waf-wsf/')).text();
const targets = { squat: 'j8Hemr', bench: 'z8boT1', deadlift: 'SWuyXu', press: 'kOcW0r', curl: 'whgJKT' };
for (const [name, code] of Object.entries(targets)) {
  const tag = [...html.matchAll(/<a\b[^>]+>/g)].map(m => m[0]).find(t => t.includes(`e=${code}`));
  const source = tag.match(/data-wrpf-doc="([^"]+)"/)[1];
  const signature = tag.match(/data-wrpf-doc-signature="([^"]+)"/)[1];
  const url = new URL('https://wrpf.pro/wp-json/wrpf-docs/v1/resource');
  url.searchParams.set('source', source);
  url.searchParams.set('signature', signature);
  let result;
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(url);
    result = await response.json();
    if (response.ok) break;
    if (result.code !== 'wrpf_onedrive_busy') break;
    await new Promise(r => setTimeout(r, 3000));
  }
  await writeFile(new URL(`${name}.json`, root), JSON.stringify(result, null, 2));
  console.log(name, JSON.stringify(result));
}
