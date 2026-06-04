const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcesDir = path.join(root, "sources");
const sourceListPath = path.join(__dirname, "source_list.json");

const METHOD_TEMPLATE = `
__IMAGE_LOADER_INDENT__getImageHeaders(url, pageUrl, siteBase) {
__IMAGE_LOADER_INDENT__  let base = typeof siteBase === "string" ? siteBase : url || "";
__IMAGE_LOADER_INDENT__  let origin = "";
__IMAGE_LOADER_INDENT__  try {
__IMAGE_LOADER_INDENT__    origin = new URL(base).origin;
__IMAGE_LOADER_INDENT__  } catch (_) {
__IMAGE_LOADER_INDENT__    origin = (base || "").replace(/\\/$/, "");
__IMAGE_LOADER_INDENT__  }
__IMAGE_LOADER_INDENT__  let referer = pageUrl || (origin ? origin + "/" : base);
__IMAGE_LOADER_INDENT__  try {
__IMAGE_LOADER_INDENT__    referer = new URL(referer, origin ? origin + "/" : base).toString();
__IMAGE_LOADER_INDENT__  } catch (_) {}
__IMAGE_LOADER_INDENT__  return {
__IMAGE_LOADER_INDENT__    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36",
__IMAGE_LOADER_INDENT__    "Referer": referer,
__IMAGE_LOADER_INDENT__    "Origin": origin,
__IMAGE_LOADER_INDENT__    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
__IMAGE_LOADER_INDENT__    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
__IMAGE_LOADER_INDENT__    "Connection": "keep-alive"
__IMAGE_LOADER_INDENT__  };
__IMAGE_LOADER_INDENT__}

__IMAGE_LOADER_INDENT__getImageLoadingConfig(url, comicId, epId) {
__IMAGE_LOADER_INDENT__  let siteBase = url || "";
__IMAGE_LOADER_INDENT__  for (let key of ["baseUrl", "apiUrl", "api"]) {
__IMAGE_LOADER_INDENT__    try {
__IMAGE_LOADER_INDENT__      let value = this[key];
__IMAGE_LOADER_INDENT__      if (typeof value === "string" && /^https?:\\/\\//i.test(value)) {
__IMAGE_LOADER_INDENT__        siteBase = value;
__IMAGE_LOADER_INDENT__        break;
__IMAGE_LOADER_INDENT__      }
__IMAGE_LOADER_INDENT__    } catch (_) {}
__IMAGE_LOADER_INDENT__  }
__IMAGE_LOADER_INDENT__  let pageUrl = [epId, comicId].find(value => typeof value === "string" && /^https?:\\/\\//i.test(value)) || siteBase;
__IMAGE_LOADER_INDENT__  const headers = this.getImageHeaders(url, pageUrl, siteBase);
__IMAGE_LOADER_INDENT__  return {
__IMAGE_LOADER_INDENT__    url,
__IMAGE_LOADER_INDENT__    method: "GET",
__IMAGE_LOADER_INDENT__    headers,
__IMAGE_LOADER_INDENT__    onLoadFailed: () => ({
__IMAGE_LOADER_INDENT__      url,
__IMAGE_LOADER_INDENT__      method: "GET",
__IMAGE_LOADER_INDENT__      headers: this.getImageHeaders(url, siteBase, siteBase)
__IMAGE_LOADER_INDENT__    })
__IMAGE_LOADER_INDENT__  };
__IMAGE_LOADER_INDENT__}
`;

function bumpPatch(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Unsupported version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

const sourceList = JSON.parse(fs.readFileSync(sourceListPath, "utf8"));
const sourceByFile = new Map(sourceList.filter(x => x.sourceFile).map(x => [x.sourceFile, x]));
const modified = [];

for (const fileName of fs.readdirSync(sourcesDir).filter(x => x.endsWith(".js")).sort()) {
  const fullPath = path.join(sourcesDir, fileName);
  let source = fs.readFileSync(fullPath, "utf8");
  if (source.includes("onImageLoad")) continue;

  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const comicMatch = source.match(/\r?\n([ \t]*)comic\s*=\s*\{/);
  if (!comicMatch) throw new Error(`${fileName}: comic object not found`);
  const indent = comicMatch[1];
  const methods = METHOD_TEMPLATE.replaceAll("__IMAGE_LOADER_INDENT__", indent).replaceAll("\n", eol);
  source = source.replace(comicMatch[0], `${eol}${methods}${eol}${indent}comic = {`);
  source = source.replace(
    `${indent}comic = {`,
    `${indent}comic = {${eol}${indent}  onImageLoad: (url, comicId, epId) => this.getImageLoadingConfig(url, comicId, epId),`
  );

  const versionMatch = source.match(/version\s*=\s*["'](\d+\.\d+\.\d+)["']/);
  if (!versionMatch) throw new Error(`${fileName}: version not found`);
  const oldVersion = versionMatch[1];
  const newVersion = bumpPatch(oldVersion);
  source = source.replace(versionMatch[0], versionMatch[0].replace(oldVersion, newVersion));

  const listItem = sourceByFile.get(fileName);
  if (!listItem) throw new Error(`${fileName}: source_list entry not found`);
  listItem.version = newVersion;

  fs.writeFileSync(fullPath, source, "utf8");
  modified.push({ fileName, oldVersion, newVersion });
}

fs.writeFileSync(sourceListPath, JSON.stringify(sourceList, null, 2) + "\n", "utf8");
console.log(JSON.stringify(modified, null, 2));
