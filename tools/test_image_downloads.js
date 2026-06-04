const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sourcesDir = path.join(root, "sources");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

async function request(method, url, headers, body) {
  const res = await fetch(url, {
    method,
    headers: headers || {},
    body: method === "GET" || method === "HEAD" ? undefined : body,
    redirect: "follow",
    signal: timeoutSignal(30000),
  });
  return { status: res.status, body: await res.text(), headers: Object.fromEntries(res.headers), url: res.url };
}

const Network = {
  get: (url, headers) => request("GET", url, headers),
  post: (url, headers, body) => request("POST", url, headers, body),
  sendRequest: (method, url, headers, body) => request(method, url, headers, body),
  setCookies: () => {},
  deleteCookies: () => {},
};

class ComicSource {
  constructor() {
    this.__settings = {};
    this.__data = {};
  }
  loadSetting(name) {
    return this.__settings[name] ?? this.settings?.[name]?.default;
  }
  loadData(name) {
    return this.__data[name] ?? null;
  }
  saveData(name, value) {
    this.__data[name] = value;
  }
  deleteData(name) {
    delete this.__data[name];
  }
}

class DataObject {
  constructor(value) {
    Object.assign(this, value);
  }
}

function loadSource(fileName) {
  const fullPath = path.join(sourcesDir, fileName);
  const source = fs.readFileSync(fullPath, "utf8");
  const className = source.match(/class\s+(\w+)\s+extends\s+ComicSource/)?.[1];
  assert(className, `${fileName}: source class not found`);
  const context = {
    AbortController,
    APP: { locale: "zh_CN", version: "1.6.0" },
    Comic: DataObject,
    ComicDetails: DataObject,
    ComicSource,
    Comment: DataObject,
    Convert: {},
    Date,
    Error,
    JSON,
    Map,
    Network,
    Object,
    Promise,
    RegExp,
    Set,
    URL,
    UI: { showMessage: () => {} },
    clearTimeout,
    console,
    fetch,
    log: () => {},
    setTimeout,
  };
  vm.createContext(context);
  new vm.Script(`${source}\nglobalThis.__Source = ${className};`, { filename: fileName }).runInContext(context);
  return new context.__Source();
}

function firstChapterId(chapters) {
  if (chapters instanceof Map) {
    for (const [key, value] of chapters) {
      if (value instanceof Map) return firstChapterId(value);
      return key;
    }
  }
  if (chapters && typeof chapters === "object") return Object.keys(chapters)[0];
  return null;
}

async function mangaDexCase() {
  const source = loadSource("manga_dex.js");
  source.__settings.image_quality = "Data Saver";
  const feed = await fetch("https://api.mangadex.org/chapter?limit=10&translatedLanguage[]=en&order[readableAt]=desc", {
    signal: timeoutSignal(30000),
  }).then(res => res.json());
  const chapter = feed.data.find(item => item.relationships.some(rel => rel.type === "manga"));
  assert(chapter, "MangaDex: no chapter discovered");
  const comicId = chapter.relationships.find(rel => rel.type === "manga").id;
  return { source, comicId, epId: chapter.id, result: await source.comic.loadEp(comicId, chapter.id) };
}

async function manwabaCase() {
  const source = loadSource("manwaba.js");
  source.init();
  const home = await source.fetchJson(`${source.api}/home`, { params: { page: 1, pageSize: 6, type: "", flag: false } });
  const lists = Object.values(home.data).filter(Array.isArray);
  const comic = lists.flat().find(item => item?.id);
  assert(comic, "ManWaBa: no comic discovered");
  const details = await source.comic.loadInfo(String(comic.id));
  const epId = firstChapterId(details.chapters);
  assert(epId, "ManWaBa: no chapter discovered");
  return { source, comicId: String(comic.id), epId: String(epId), result: await source.comic.loadEp(String(comic.id), String(epId)) };
}

async function zaimanhuaCase() {
  const source = loadSource("zaimanhua.js");
  source.init();
  const listRes = await Network.get(source.buildUrl("comic/update/list/0/1"), source.headers);
  const list = JSON.parse(listRes.body).data;
  const comic = list.find(item => item.comic_id || item.id);
  assert(comic, "Zaimanhua: no comic discovered");
  const comicId = String(comic.comic_id || comic.id);
  const detailRes = await Network.get(source.buildUrl(`comic/detail/${comicId}?channel=android`), source.headers);
  const detail = JSON.parse(detailRes.body).data.data;
  const chapter = (detail.chapters || []).flatMap(group => group.data || []).find(item => item.chapter_id);
  assert(chapter, "Zaimanhua: no chapter discovered");
  const epId = String(chapter.chapter_id);
  return { source, comicId, epId, result: await source.comic.loadEp(comicId, epId) };
}

async function wnacgCase() {
  const source = loadSource("wnacg.js");
  source.__settings.domain0 = "www.wnacg.com";
  source.__settings.domainSelection = 0;
  const comicId = "210814";
  return { source, comicId, epId: null, result: await source.comic.loadEp(comicId, null) };
}

async function mh1234Case() {
  const source = loadSource("mh1234.js");
  const home = await Network.get(source.baseUrl, {});
  assert(home.status === 200, `MH1234: home status ${home.status}`);
  const matches = [...home.body.matchAll(/\/comic\/(\d+)\/(\d+)\.html/g)];
  assert(matches.length > 0, "MH1234: no chapter discovered");
  for (const match of matches.slice(0, 20)) {
    const comicId = match[1];
    const epId = `${match[1]}_${match[2]}`;
    const result = await source.comic.loadEp(comicId, epId);
    if (result?.images?.length >= 5) return { source, comicId, epId, result };
  }
  throw new Error("MH1234: no chapter with at least 5 images");
}

async function godaCase() {
  const source = loadSource("goda.js");
  const home = await Network.get(source.baseUrl, source.headers);
  assert(home.status === 200, `Goda: home status ${home.status}`);
  const links = [...new Set([...home.body.matchAll(/href=["']([^"']+)["']/g)].map(match => match[1]))]
    .filter(link => link.startsWith("/") && !link.startsWith("//"));
  for (const link of links.slice(0, 40)) {
    const page = await Network.get(source.baseUrl + link, source.headers);
    const mid = page.body.match(/id=["']mangachapters["'][^>]*data-mid=["'](\d+)["']/i)?.[1]
      || page.body.match(/data-mid=["'](\d+)["'][^>]*id=["']mangachapters["']/i)?.[1];
    if (!mid) continue;
    const chapterRes = await Network.get(`${source.apiUrl}/manga/get?mid=${mid}&mode=all&t=${Date.now()}`, source.headers);
    const chapter = JSON.parse(chapterRes.body)?.data?.chapters?.[0];
    if (!chapter?.id) continue;
    const epId = `${mid}@${chapter.id}`;
    const result = await source.comic.loadEp(link, epId);
    if (result?.images?.length >= 5) return { source, comicId: link, epId, result };
  }
  throw new Error("Goda: no downloadable chapter discovered");
}

function getHeader(headers, name) {
  const key = Object.keys(headers || {}).find(item => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

async function downloadImage(sourceName, source, comicId, epId, imageUrl) {
  let config = await source.comic.onImageLoad(imageUrl, comicId, epId);
  assert(config && typeof config === "object", `${sourceName}: onImageLoad returned no config`);
  assert(getHeader(config.headers, "User-Agent"), `${sourceName}: User-Agent missing`);
  assert(getHeader(config.headers, "Referer"), `${sourceName}: Referer missing`);

  async function run(current) {
    const res = await fetch(current.url || imageUrl, {
      method: current.method || "GET",
      headers: current.headers,
      redirect: "follow",
      signal: timeoutSignal(30000),
    });
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get("content-type") || "", bytes: bytes.length, url: res.url };
  }

  let downloaded = await run(config);
  if ((!([200, 206].includes(downloaded.status)) || downloaded.bytes === 0) && typeof config.onLoadFailed === "function") {
    config = await config.onLoadFailed();
    downloaded = await run(config);
  }
  assert([200, 206].includes(downloaded.status), `${sourceName}: image status ${downloaded.status}`);
  assert(downloaded.type.toLowerCase().startsWith("image/"), `${sourceName}: invalid Content-Type ${downloaded.type}`);
  assert(downloaded.bytes > 0, `${sourceName}: downloaded 0B`);
  return downloaded;
}

async function main() {
  const files = fs.readdirSync(sourcesDir).filter(file => file.endsWith(".js")).sort();
  for (const file of files) {
    const text = fs.readFileSync(path.join(sourcesDir, file), "utf8");
    assert(/\bonImageLoad\s*:/.test(text), `${file}: onImageLoad missing`);
    assert(/\bloadEp\s*:/.test(text), `${file}: loadEp missing`);
  }

  const cases = [
    ["MangaDex", mangaDexCase],
    ["ManWaBa", manwabaCase],
    ["Goda", godaCase],
  ];
  const report = [];
  for (const [name, createCase] of cases) {
    console.log(`Testing ${name}...`);
    const { source, comicId, epId, result } = await createCase();
    assert(Array.isArray(result?.images) && result.images.length > 0, `${name}: loadEp returned no images`);
    assert(result.images.every(image => typeof image === "string"), `${name}: loadEp images must remain string[]`);
    const images = result.images.slice(0, 5);
    assert(images.length >= 5, `${name}: fewer than 5 images available for concurrency test`);
    const downloaded = await Promise.all(images.map(url => downloadImage(name, source, comicId, epId, url)));
    report.push({ name, comicId, epId, images: result.images.length, downloaded });
  }
  console.log(JSON.stringify({ auditedSources: files.length, report }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error);
  if (error.cause) console.error(error.cause);
  process.exit(1);
});
