/** @type {import('./_venera_.js')} */
class MycomicSource extends ComicSource {
    name = "MYCOMIC"
    key = "mycomic"
    version = "0.1.1"
    minAppVersion = "1.6.0"
    url = "https://mycomic.com/cn"

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36",
            "Referer": this.url + "/",
            "Accept-Language": "zh-CN,zh;q=0.9"
        }
    }

    blocked() {
        throw "MYCOMIC 当前首页、/cn/comics 和搜索候选路径均返回 Cloudflare 403 / Just a moment，搜索接口未能验证。"
    }

    explore = [{ title: "MYCOMIC", type: "multiPageComicList", load: async (page) => this.blocked() }]

    search = { load: async (keyword, options, page) => this.blocked(), optionList: [] }

    comic = {
        loadInfo: async (id) => this.blocked(),
        loadEp: async (comicId, epId) => this.blocked(),
        onImageLoad: (url, comicId, epId) => ({ headers: this.headers }),
        onThumbnailLoad: (url) => ({ headers: this.headers })
    }

    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = this.comic.loadInfo
    getImages = this.comic.loadEp
}
