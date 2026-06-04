const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sourceListPath = path.join(__dirname, "source_list.json");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

let sourceList;

try {
  sourceList = JSON.parse(fs.readFileSync(sourceListPath, "utf8"));
  if (!Array.isArray(sourceList)) fail("source_list.json must be an array.");
} catch (error) {
  fail(`source_list.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

const urls = new Set();
const sourceListKeys = new Set();

function readIndex(fileName) {
  const indexPath = path.join(root, fileName);
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    if (!Array.isArray(index)) fail(`${fileName} must be an array.`);
    return index;
  } catch (error) {
    fail(`${fileName} is not valid JSON: ${error.message}`);
    process.exit(1);
  }
}

function checkIndex(fileName, index, allowedStatuses) {
  const keys = new Set();
  const files = new Set();
  const sourceByFile = new Map(sourceList.filter(x => x.sourceFile).map(x => [`sources/${x.sourceFile}`, x]));

  for (const item of index) {
    if (!item.name || !item.key || !item.version || !item.fileName) {
      fail(`${fileName} entry is missing required fields: ${JSON.stringify(item)}`);
      continue;
    }
    if (keys.has(item.key)) fail(`duplicate key in ${fileName}: ${item.key}`);
    keys.add(item.key);
    files.add(item.fileName);

    if (!/^sources\/[^/]+\.js$/.test(item.fileName)) {
      fail(`${fileName} has invalid fileName path for ${item.key}: ${item.fileName}`);
    }

    const source = sourceByFile.get(item.fileName);
    if (!source) {
      fail(`${fileName} entry is not present in source_list.json: ${item.fileName}`);
    } else if (!allowedStatuses.includes(source.status)) {
      fail(`${fileName} includes disallowed status ${source.status}: ${item.key}`);
    } else if (source.key !== item.key) {
      fail(`${fileName} key mismatch for ${item.fileName}: ${item.key} != ${source.key}`);
    }

    if (fileName === "index.json") {
      if (source.status !== "ready") fail(`index.json includes non-ready source: ${item.key}`);
      if (source.category === "adult") fail(`index.json includes adult source: ${item.key}`);
      if (["disabled", "duplicate"].includes(source.status)) fail(`index.json includes ${source.status} source: ${item.key}`);
    }

    if (fileName === "index_full.json") {
      if (["disabled", "duplicate"].includes(source.status)) fail(`index_full.json includes ${source.status} source: ${item.key}`);
      if (source.category === "adult") fail(`index_full.json includes adult source: ${item.key}`);
    }

    if ((fileName === "adult_index.json" || fileName === "adult_index_full.json") && source.category !== "adult") {
      fail(`adult_index.json includes non-adult source: ${item.key}`);
    }

    if (fileName === "all_index.json") {
      if (["disabled", "duplicate"].includes(source.status)) fail(`all_index.json includes ${source.status} source: ${item.key}`);
      if (source.category === "adult") fail(`all_index.json includes adult source: ${item.key}`);
      if (source.status === "todo" && !source.sourceFile) fail(`all_index.json includes todo source without JS: ${item.key}`);
    }

    const sourcePath = path.join(root, item.fileName);
    if (!fs.existsSync(sourcePath)) {
      fail(`missing JS file for ${item.key}: ${item.fileName}`);
      continue;
    }
    try {
      new vm.Script(fs.readFileSync(sourcePath, "utf8"), { filename: item.fileName });
    } catch (error) {
      fail(`syntax error in ${item.fileName}: ${error.message}`);
    }
  }

  for (const source of sourceList) {
    if (!source.sourceFile) continue;
    if (!allowedStatuses.includes(source.status)) continue;
    if (fileName === "index.json" && source.category === "adult") continue;
    if (fileName === "index.json" && ["disabled", "duplicate"].includes(source.status)) continue;
    if (fileName === "index_full.json" && source.category === "adult") continue;
    if (fileName === "index_full.json" && ["disabled", "duplicate"].includes(source.status)) continue;
    if ((fileName === "adult_index.json" || fileName === "adult_index_full.json") && source.category !== "adult") continue;
    if (fileName === "all_index.json") {
      if (["disabled", "duplicate"].includes(source.status)) continue;
      if (source.category === "adult") continue;
      if (!["ready", "experimental"].includes(source.status) && !(source.status === "todo" && source.sourceFile)) continue;
    }
    const fileNameInIndex = `sources/${source.sourceFile}`;
    if (!files.has(fileNameInIndex)) {
      fail(`${fileName} is missing ${source.status} source: ${source.name} (${fileNameInIndex})`);
    }
  }
}

for (const source of sourceList) {
  if (!source.key) {
    fail(`source_list entry missing key: ${source.name || source.url}`);
  } else if (sourceListKeys.has(source.key)) {
    fail(`duplicate key in source_list.json: ${source.key}`);
  }
  sourceListKeys.add(source.key);

  if (!source.url) {
    fail(`source_list entry missing url: ${source.name || source.key}`);
    continue;
  }
  if (urls.has(source.url)) fail(`duplicate url in source_list.json: ${source.url}`);
  urls.add(source.url);
}

const sourcesDir = path.join(root, "sources");
for (const file of fs.readdirSync(sourcesDir)) {
  if (!file.endsWith(".js")) continue;
  const sourcePath = path.join(sourcesDir, file);
  const sourceText = fs.readFileSync(sourcePath, "utf8");
  try {
    new vm.Script(sourceText, { filename: `sources/${file}` });
  } catch (error) {
    fail(`syntax error in sources/${file}: ${error.message}`);
  }
  if (!/class\s+\w+\s+extends\s+ComicSource/.test(sourceText)) {
    fail(`sources/${file} does not define a ComicSource class`);
  }
}

const stableIndex = readIndex("index.json");
const fullIndex = readIndex("index_full.json");
const adultIndex = readIndex("adult_index.json");
const adultFullIndex = readIndex("adult_index_full.json");
const allIndex = readIndex("all_index.json");
const disabledSources = readIndex("disabled_sources.json");
checkIndex("index.json", stableIndex, ["ready"]);
checkIndex("index_full.json", fullIndex, ["ready", "experimental"]);
checkIndex("adult_index.json", adultIndex, ["ready"]);
checkIndex("adult_index_full.json", adultFullIndex, ["ready", "experimental"]);
checkIndex("all_index.json", allIndex, ["ready", "experimental", "todo"]);

function assertSameOrder(label, actual, expected) {
  if (actual.length !== expected.length) {
    fail(`${label} length mismatch: ${actual.length} != ${expected.length}`);
    return;
  }
  for (let i = 0; i < expected.length; i++) {
    if (actual[i]?.key !== expected[i]?.key) {
      fail(`${label} order mismatch at ${i}: ${actual[i]?.key} != ${expected[i]?.key}`);
      return;
    }
  }
}

const stableKeys = new Set(stableIndex.map(item => item.key));
const expectedAllIndex = [
  ...stableIndex,
  ...fullIndex.filter(item => !stableKeys.has(item.key))
];
assertSameOrder("all_index.json", allIndex, expectedAllIndex);

if (sourceList.length !== 213) {
  fail(`source_list.json must contain 213 entries, got ${sourceList.length}`);
}

for (const item of disabledSources) {
  if (!item.name || !item.url || !item.status || !item.category || !item.reason) {
    fail(`disabled_sources.json entry is missing fields: ${JSON.stringify(item)}`);
  }
  if (!["disabled", "duplicate"].includes(item.status)) {
    fail(`disabled_sources.json includes invalid status: ${item.status}`);
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (readme.includes("zlp369963-oss")) {
  fail("README.md still contains zlp369963-oss");
}
if (!readme.includes("zhimouzhou")) {
  fail("README.md must contain zhimouzhou import links");
}
if (!readme.includes("all_index.json")) {
  fail("README.md must contain all_index.json import link");
}

if (!process.exitCode) {
  console.log(`OK: ${stableIndex.length} stable index entries, ${fullIndex.length} full index entries, ${adultIndex.length} adult index entries, ${adultFullIndex.length} adult full index entries, ${allIndex.length} all index entries, ${disabledSources.length} disabled entries, ${sourceList.length} source_list entries.`);
}
