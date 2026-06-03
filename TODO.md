# TODO

## 当前调整

- MYCOMIC、如漫画、读漫屋已重新实测，不能继续假标 ready。
- MYCOMIC 当前被 Cloudflare 403 / Just a moment 阻断，已从稳定版移除并标记 disabled。
- 如漫画、读漫屋已修复搜索、详情、章节和 `__c0rst96` 图片解密；但 Venera/EZVenera 实际网络环境分别报证书错误与连接重置，已降回 experimental。
- 成人源已按要求从所有可导入索引移除；adult_index.json 与 adult_index_full.json 保留为空数组。

## all_index.json

all_index.json 是全部非成人可导入源整合索引，排序为：

1. 稳定普通源
2. 普通测试源

不包含 adult、disabled、duplicate，也不包含没有 JS 文件的 todo。

## 需要继续修复的普通测试源

- [experimental] 如漫画 - http://www.rumanhua2.com/ - Venera 报 Invalid certificate；已改为 HTTP 优先、多域名 fallback 和站内链接 normalizeHost，需要客户端复测。
- [experimental] 读漫屋 - http://www.dumanwu1.com/ - Venera 报移动端 HTTPS connection reset；已改为 www/http 优先、多域名 fallback，需要客户端复测。
- [experimental] 733动漫 - https://www.733.so - 存在 Cloudflare/人机验证/安全验证，不能进入稳定版。
- [experimental] 海猫吧 - http://www.haimaoba.com - 存在 Cloudflare/人机验证/安全验证，不能进入稳定版。
- [experimental] 漫画园漫画 - https://m.magayuan.com - 存在 Cloudflare/人机验证/安全验证，不能进入稳定版。

## 当前禁用

- [disabled] MYCOMIC - https://mycomic.com/cn - 首页、漫画列表和搜索候选路径均返回 Cloudflare 403 / Just a moment，搜索接口无法验证。

其余 todo、disabled、duplicate 源以 `tools/source_list.json` 和生成的 `disabled_sources.json` 为准。
