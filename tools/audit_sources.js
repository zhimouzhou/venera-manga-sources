const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceListPath = path.join(__dirname, "source_list.json");
const today = "2026-06-02";

const sourceList = JSON.parse(fs.readFileSync(sourceListPath, "utf8"));

const adultPattern = /(H漫|韩漫|腐漫画|乙女|肉漫画|X18|SS漫画|歪歪|可乐漫画|MUA韩漫|免费看韩漫|看了硬|艾米漫画|韩国污|韩漫窝|乐乐韩漫|九九韩漫|韩漫漫画|看妹子|奇客漫|梦游漫画|顶通漫画|夜斗漫画|漫小肆|漫画皮|CC漫画|韩漫吧|特漫网|Picacg|nhentai|紳士漫畫|ehentai|禁漫天堂|18漫画|H-Comic|hitomi|热辣漫画)/i;

const officialFiles = new Set([
  "copy_manga.js", "komiic.js", "baozi.js", "picacg.js", "nhentai.js", "wnacg.js",
  "ehentai.js", "jm.js", "manga_dex.js", "ikmmh.js", "shonen_jump_plus.js",
  "hitomi.js", "comick.js", "ykmh.js", "zaimanhua.js", "manhuagui.js",
  "manwaba.js", "lanraragi.js", "komga.js", "comic_walker.js", "mh1234.js",
  "ccc.js", "goda.js", "mh18.js", "mxs.js", "manhuaren.js", "hcomic.js",
  "jcomic.js", "hot_manga.js"
]);

const officialCoverage = new Map([
  ["拷贝漫画", "copy_manga.js"],
  ["拷贝漫画（APP）", "copy_manga.js"],
  ["漫画人", "manhuaren.js"],
  ["漫画1234", "mh1234.js"],
]);

const duplicateCoverage = new Map([
  ["极速漫画（PC）", "one_kkk.js"],
  ["漫画呗（PC）", "manhuabei.js"],
  ["漫画粉（PC）", "漫画粉移动端/同站点"],
  ["漫画码（PC）", "manhuama.js"],
  ["古风漫画（PC）", "gufengmh8.js"],
  ["土豆漫画（PC）", "土豆漫画移动端/同站点"],
  ["168漫画（PC）", "168漫画移动端/同站点"],
  ["土豪漫画（PC）", "土豪漫画移动端/同站点"],
  ["土豪漫画网（PC）", "土豪漫画网移动端/同站点"],
  ["彼阅漫画（PC）", "彼阅漫画移动端/同站点"],
  ["咚漫（PC）", "咚漫移动端/同站点"],
  ["非常爱漫（PC）", "非常爱漫移动端/同站点"],
  ["漫画看（PC）", "漫画看移动端/同站点"],
  ["90漫画（PC）", "90漫画移动端/同站点"],
  ["CC漫画（PC）", "CC漫画移动端/同站点"],
  ["X18漫画（PC）", "X18漫画移动端/同站点"],
  ["360漫画（PC）", "360漫画移动端/同站点"],
  ["乙女漫画（PC）", "乙女漫画移动端/同站点"],
  ["漫画吧（PC）", "漫画吧移动端/同站点"],
]);

const knownDisabled = new Map([
  ["动漫之家", "TLS EOF，当前环境无法稳定访问移动端首页，未能验证搜索/详情/章节/图片。"],
  ["漫画台", "证书过期，当前环境无法可靠验证。"],
  ["漫画码", "DNS 解析失败或域名不可达。"],
  ["扑飞漫画", "搜索无有效结果，详情页返回异常/空壳内容。"],
  ["古风漫画", "首页和搜索返回空壳页，未发现有效漫画结构。"],
  ["漫画呗", "跳转到停放页/低质量落地页。"],
  ["漫画堆", "跳转到停放页/低质量落地页。"],
]);

const priorityTodo = new Set([
  "40漫画", "漫画看", "漫画吧", "漫画123", "ONE漫画", "OH漫画", "X漫画",
  "非麻瓜漫画", "奇漫屋", "酷漫屋", "搜动漫", "733漫画", "733动漫",
  "90漫画", "168漫画", "2020漫画", "57漫画", "369漫画", "亲亲漫画",
  "大魔兔", "KAN漫画", "2Comic", "8Comic", "漫画殿", "漫画160", "我要去漫画",
  "土豆漫画", "依依漫画", "思思漫画", "HiComic", "土豪漫画", "土豪漫画网",
  "奇妙漫画", "狂人漫画", "彼阅漫画", "久五漫画", "国人漫画", "360漫画", "雪梨漫画"
]);

function isApiSource(item) {
  return item.type === "api" || /APP|api/i.test(item.name + " " + item.url);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

function looksParking(text, finalUrl) {
  const s = (text || "").slice(0, 20000).toLowerCase();
  const u = (finalUrl || "").toLowerCase();
  return /ww1\.|parking|domain for sale|buy this domain|sedo|cdn-fileserver|bping\.php|域名|出售/.test(u + " " + s);
}

function looksShell(text) {
  const s = (text || "").trim();
  if (!s) return true;
  const anchors = (s.match(/<a\b/gi) || []).length;
  const imgs = (s.match(/<img\b/gi) || []).length;
  return s.length < 900 || (s.length < 6000 && anchors < 3 && imgs < 2);
}

function looksChallenge(text) {
  return /cloudflare|cf-browser-verification|turnstile|captcha|人机验证|安全验证|just a moment/i.test(text || "");
}

function hasComicSignals(text) {
  return /(漫画|漫畫|manhua|comic|chapter|章节|章節|阅读|閱讀|search|book|cover)/i.test(text || "");
}

async function probe(item) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
    "Referer": item.url
  };
  try {
    const res = await fetch(item.url, { headers, redirect: "follow", signal: timeoutSignal(9000) });
    const text = await res.text();
    return {
      httpStatus: res.status,
      finalUrl: res.url,
      contentLength: text.length,
      isParking: looksParking(text, res.url),
      isShell: looksShell(text),
      isChallenge: looksChallenge(text),
      hasComicSignals: hasComicSignals(text)
    };
  } catch (error) {
    const msg = error && (error.cause?.code || error.code || error.name || error.message || String(error));
    return {
      httpStatus: null,
      finalUrl: "",
      contentLength: 0,
      probeError: String(msg)
    };
  }
}

function applyBaseFields(item, result) {
  item.lastChecked = today;
  item.httpStatus = result.httpStatus ?? null;
  item.finalUrl = result.finalUrl || item.finalUrl || "";
  item.canSearch = Boolean(item.canSearch);
  item.canGetInfo = Boolean(item.canGetInfo);
  item.canGetChapters = Boolean(item.canGetChapters);
  item.canGetImages = Boolean(item.canGetImages);
}

function setReadyCapabilities(item) {
  item.canSearch = true;
  item.canGetInfo = true;
  item.canGetChapters = true;
  item.canGetImages = true;
}

async function main() {
  const probes = new Map();
  const queue = [...sourceList];
  const workers = Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      probes.set(item.id, await probe(item));
    }
  });
  await Promise.all(workers);

  for (const item of sourceList) {
    const result = probes.get(item.id) || {};
    applyBaseFields(item, result);

    const isAdult = adultPattern.test(item.name);
    const isExistingReady = item.status === "ready" && item.sourceFile;
    const isOfficialFile = item.sourceFile && officialFiles.has(item.sourceFile);
    item.isOfficial = Boolean(isOfficialFile);
    if (isOfficialFile) item.officialFile = item.sourceFile;

    item.category = isAdult ? "adult" : (isOfficialFile ? "official" : "normal");

    if (isExistingReady) {
      setReadyCapabilities(item);
      item.status = "ready";
      item.reason = isOfficialFile
        ? `官方 Venera 配置已覆盖：${item.sourceFile}`
        : (item.note || item.description || "已适配并通过本地索引检查。");
      if (isAdult) item.reason += "；成人/特殊源，仅进入 adult_index.json。";
      continue;
    }

    if (officialCoverage.has(item.name)) {
      item.status = "duplicate";
      item.category = "duplicate";
      item.duplicateOf = officialCoverage.get(item.name);
      item.reason = `已有官方 Venera 源覆盖：${item.duplicateOf}`;
      continue;
    }

    if (duplicateCoverage.has(item.name)) {
      item.status = "duplicate";
      item.category = "duplicate";
      item.duplicateOf = duplicateCoverage.get(item.name);
      item.reason = `重复站点/旧域名，已由 ${item.duplicateOf} 覆盖或应以后合并处理。`;
      continue;
    }

    if (knownDisabled.has(item.name)) {
      item.status = "disabled";
      item.category = isAdult ? "adult" : "dead";
      item.reason = knownDisabled.get(item.name);
      continue;
    }

    if (result.probeError) {
      item.status = "disabled";
      item.category = isAdult ? "adult" : "dead";
      item.reason = `访问失败：${result.probeError}`;
      continue;
    }

    if (result.isParking) {
      item.status = "disabled";
      item.category = isAdult ? "adult" : "dead";
      item.reason = "检测为停放页、广告落地页或域名出售页。";
      continue;
    }

    if (result.isChallenge) {
      item.status = "experimental";
      item.category = isAdult ? "adult" : "normal";
      item.reason = "存在 Cloudflare/人机验证/安全验证，不能进入稳定版。";
      continue;
    }

    if (result.isShell || !result.hasComicSignals) {
      item.status = "disabled";
      item.category = isAdult ? "adult" : "dead";
      item.reason = "返回空壳 HTML 或未发现漫画站结构。";
      continue;
    }

    if (isAdult) {
      item.status = "experimental";
      item.category = "adult";
      item.reason = "成人/特殊源，首页可访问但未完整验证搜索、章节、图片，单独维护。";
      continue;
    }

    if (isApiSource(item)) {
      item.status = "todo";
      item.category = "api";
      item.reason = "API/APP 源可探测但缺少签名、token、设备参数或接口文档，未冒充 ready。";
      continue;
    }

    item.status = priorityTodo.has(item.name.replace(/（PC）|（APP）/g, "")) ? "todo" : "todo";
    item.category = "normal";
    item.reason = "站点可访问，但本轮未完整跑通搜索、详情、章节和图片解析，保留后续手工适配。";
  }

  fs.writeFileSync(sourceListPath, JSON.stringify(sourceList, null, 2) + "\n", "utf8");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
