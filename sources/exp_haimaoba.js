/** @type {import('./_venera_.js')} */
class ExpHaimaobaSource extends ComicSource {
    name = "海猫吧"
    key = "source_43"
    version = "0.1.0"
    minAppVersion = "1.6.0"
    url = "http://www.haimaoba.com"
    status = "experimental"

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": this.url + "/"
        }
    }

    notReady() {
        throw "海猫吧 experimental: 当前检测存在 Cloudflare/人机验证，尚未完成搜索、详情、章节、图片解析。"
    }

    search = { load: async () => this.notReady(), optionList: [] }
    explore = [{ title: "海猫吧", type: "multiPageComicList", load: async () => this.notReady() }]
    comic = {
        loadInfo: async () => this.notReady(),
        loadEp: async () => this.notReady(),
        onImageLoad: () => ({ headers: this.headers }),
        onThumbnailLoad: () => ({ headers: this.headers })
    }

    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = this.comic.loadInfo
    getImages = this.comic.loadEp
}
