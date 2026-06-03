/** @type {import('./_venera_.js')} */
class AdultExpKelemhSource extends ComicSource {
    name = "可乐漫画（H漫）"
    key = "h_7"
    version = "0.1.0"
    minAppVersion = "1.6.0"
    url = "https://www.kelemh.com"
    status = "experimental"

    get headers() { return { "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile)", "Referer": this.url + "/" } }
    notReady() { throw "可乐漫画（H漫） adult experimental: 需要单独维护，尚未完成完整解析。" }
    search = { load: async () => this.notReady(), optionList: [] }
    explore = [{ title: "可乐漫画（H漫）", type: "multiPageComicList", load: async () => this.notReady() }]
    comic = { loadInfo: async () => this.notReady(), loadEp: async () => this.notReady(), onImageLoad: () => ({ headers: this.headers }), onThumbnailLoad: () => ({ headers: this.headers }) }
    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = this.comic.loadInfo
    getImages = this.comic.loadEp
}
