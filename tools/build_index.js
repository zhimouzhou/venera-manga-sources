const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceListPath = path.join(__dirname, "source_list.json");
const sourcesDir = path.join(root, "sources");

const sourceList = JSON.parse(fs.readFileSync(sourceListPath, "utf8"));

function buildIndex(predicate) {
  const index = [];

  for (const source of sourceList) {
    if (!predicate(source)) continue;
    if (!source.sourceFile) continue;

    const fullPath = path.join(sourcesDir, source.sourceFile);
    if (!fs.existsSync(fullPath)) continue;

    index.push({
      name: source.name,
      key: source.key,
      version: source.version || (source.status === "ready" ? "1.0.0" : "0.1.0"),
      fileName: `sources/${source.sourceFile}`,
      description: source.description || `${source.name}：${source.note || source.url}`
    });
  }

  return index;
}

const index = buildIndex(source =>
  source.status === "ready" &&
  source.category !== "adult" &&
  source.category !== "duplicate" &&
  source.category !== "dead"
);

const fullIndex = buildIndex(source =>
  ["ready", "experimental"].includes(source.status) &&
  source.category !== "adult" &&
  source.status !== "disabled" &&
  source.status !== "duplicate"
);

const adultIndex = buildIndex(source =>
  source.status === "ready" &&
  source.category === "adult"
);

const adultFullIndex = buildIndex(source =>
  ["ready", "experimental"].includes(source.status) &&
  source.category === "adult"
);

const stableKeys = new Set(index.map(item => item.key));
const adultStableKeys = new Set(adultIndex.map(item => item.key));
const normalExperimental = fullIndex.filter(item => !stableKeys.has(item.key));
const adultExperimental = adultFullIndex.filter(item => !adultStableKeys.has(item.key));
const allIndex = [
  ...index,
  ...normalExperimental
];

const disabledSources = sourceList
  .filter(source => ["disabled", "duplicate"].includes(source.status))
  .map(source => ({
    name: source.name,
    url: source.url,
    status: source.status,
    category: source.category,
    reason: source.reason || source.note || "",
    finalUrl: source.finalUrl || "",
    lastChecked: source.lastChecked || ""
  }));

fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(index, null, 2), "utf8");
fs.writeFileSync(path.join(root, "index_full.json"), JSON.stringify(fullIndex, null, 2), "utf8");
fs.writeFileSync(path.join(root, "adult_index.json"), JSON.stringify(adultIndex, null, 2), "utf8");
fs.writeFileSync(path.join(root, "adult_index_full.json"), JSON.stringify(adultFullIndex, null, 2), "utf8");
fs.writeFileSync(path.join(root, "all_index.json"), JSON.stringify(allIndex, null, 2), "utf8");
fs.writeFileSync(path.join(root, "disabled_sources.json"), JSON.stringify(disabledSources, null, 2), "utf8");
fs.writeFileSync(path.join(root, "source_list.json"), JSON.stringify(sourceList, null, 2) + "\n", "utf8");
console.log(`Generated index.json with ${index.length} stable sources.`);
console.log(`Generated index_full.json with ${fullIndex.length} ready + experimental non-adult sources.`);
console.log(`Generated adult_index.json with ${adultIndex.length} adult/special ready sources.`);
console.log(`Generated adult_index_full.json with ${adultFullIndex.length} adult/special ready + experimental sources.`);
console.log(`Generated all_index.json with ${allIndex.length} grouped non-adult importable sources.`);
console.log(`Generated disabled_sources.json with ${disabledSources.length} disabled/duplicate sources.`);
