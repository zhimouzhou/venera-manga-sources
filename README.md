# Venera Manga Sources

Venera / EZVenera importable manga source collection.

## Import

Daily stable import. Includes only non-adult, non-duplicate, non-disabled `ready` sources:

```text
https://cdn.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/index.json
```

Normal test import. Includes non-adult `ready` and `experimental` sources, excluding disabled and duplicate sources:

```text
https://cdn.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/index_full.json
```

Adult / special import files are kept as valid empty JSON arrays because adult sources were removed by request:

```text
https://cdn.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/adult_index.json
https://cdn.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/adult_index_full.json
```

All-in-one import. Adult sources have been removed by request, so this includes stable normal sources first, then normal experimental sources:

```text
https://cdn.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/all_index.json
```

Raw fallback:

```text
https://raw.githubusercontent.com/zhimouzhou/venera-manga-sources/main/index.json
https://raw.githubusercontent.com/zhimouzhou/venera-manga-sources/main/index_full.json
https://raw.githubusercontent.com/zhimouzhou/venera-manga-sources/main/adult_index.json
https://raw.githubusercontent.com/zhimouzhou/venera-manga-sources/main/adult_index_full.json
https://raw.githubusercontent.com/zhimouzhou/venera-manga-sources/main/all_index.json
```

jsDelivr cache purge:

```text
https://purge.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/index.json
https://purge.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/index_full.json
https://purge.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/adult_index.json
https://purge.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/adult_index_full.json
https://purge.jsdelivr.net/gh/zhimouzhou/venera-manga-sources@main/all_index.json
```

## Latest Verification

- 野蛮漫画: ready. Image API pagination now continues by actual returned image count until an empty page, reported total, or safety limit; use the raw `all_index.json` URL first if jsDelivr still serves the old 10-page version.
- MYCOMIC: disabled. The home page, `/cn/comics`, and candidate search URLs returned Cloudflare 403 / Just a moment.
- 如漫画: experimental. POST `/s`, details, chapters, and `__c0rst96` image decoding work locally; Venera reported certificate mismatch, so this source now uses HTTP-first fallback and is excluded from stable import until confirmed in-app.
- 读漫屋: experimental. POST `/s`, details, chapters, and `__c0rst96` image decoding work locally; Venera reported connection reset on the mobile HTTPS host, so this source now uses `http://www.dumanwu1.com` first and is excluded from stable import until confirmed in-app.

## Status Policy

- `ready`: verified source file exists and passes syntax/import checks.
- `experimental`: partially available or requires special network/site handling.
- `todo`: reachable or plausible, but not fully adapted.
- `disabled`: DNS/TLS/access failure, parking page, shell page, or no useful comic structure.
- `duplicate`: covered by an existing source or an official Venera source.

## Build

```bash
node tools/build_index.js
node tools/check_sources.js
```

Generated files:

- `index.json`: stable non-adult import.
- `index_full.json`: non-adult test import.
- `adult_index.json`: currently an empty array.
- `adult_index_full.json`: currently an empty array.
- `all_index.json`: all non-adult importable sources, ordered stable normal, then normal test.
- `disabled_sources.json`: disabled and duplicate audit list.
