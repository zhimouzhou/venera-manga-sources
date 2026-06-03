/** @type {import('./_venera_.js')} */
class ManhuabeiSource extends ComicSource {
    name = "漫画呗"
    key = "manhuabei"
    version = "0.1.0"
    minAppVersion = "1.6.0"
    url = "https://m.manhuabei.com"
    status = "experimental"

    get baseUrl() { return "https://m.manhuabei.com".replace(/\/$/, "") }

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": this.baseUrl + "/"
        }
    }

    abs(u) {
        if (!u) return ""
        u = ("" + u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("http://") || u.startsWith("https://")) return u
        if (!u.startsWith("/")) u = "/" + u
        return this.baseUrl + u
    }

    text(el) { return el ? (el.text || "").trim() : "" }
    attr(el, name) { return el && el.attributes ? (el.attributes[name] || "") : "" }

    async getDoc(url) {
        let res = await Network.get(url, this.headers)
        if (res.status !== 200) throw `Request Error: ${res.status} ${url}`
        return new HtmlDocument(res.body || "")
    }

    parseComicList(doc) {
        let nodes = doc.querySelectorAll(".comic-item, .book-item, .mh-item, .item, li")
        let list = []
        let seen = {}
        for (let item of nodes) {
            let a = item.querySelector("a")
            let img = item.querySelector("img")
            let href = this.attr(a, "href")
            let title = this.attr(a, "title") || this.attr(img, "alt") || this.text(item.querySelector(".title")) || this.text(a)
            let cover = this.attr(img, "data-src") || this.attr(img, "data-original") || this.attr(img, "src")
            if (!href || !title) continue
            let id = this.abs(href)
            if (seen[id]) continue
            seen[id] = true
            list.push(new Comic({
                id,
                title,
                cover: this.abs(cover),
                description: "experimental source"
            }))
        }
        return list
    }

    search = {
        load: async (keyword, options, page) => {
            let urls = [
                `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`,
                `${this.baseUrl}/search?searchkey=${encodeURIComponent(keyword)}`,
                `${this.baseUrl}/search/${encodeURIComponent(keyword)}`
            ]
            for (let url of urls) {
                try {
                    let doc = await this.getDoc(url)
                    let comics = this.parseComicList(doc)
                    doc.dispose()
                    if (comics.length) return { comics, maxPage: page || 1 }
                } catch (e) {}
            }
            return { comics: [], maxPage: 1 }
        },
        optionList: []
    }

    explore = [
        {
            title: "漫画呗",
            type: "multiPageComicList",
            load: async (page) => {
                let doc = await this.getDoc(this.baseUrl + "/")
                let comics = this.parseComicList(doc)
                doc.dispose()
                return { comics, maxPage: 1 }
            }
        }
    ]

    comic = {
        loadInfo: async (id) => {
            let doc = await this.getDoc(id)
            let title = this.text(doc.querySelector("h1")) || this.text(doc.querySelector(".title"))
            let cover = this.attr(doc.querySelector(".cover img"), "src") || this.attr(doc.querySelector(".thumbnail img"), "src") || this.attr(doc.querySelector("img"), "src")
            let desc = this.text(doc.querySelector(".desc")) || this.text(doc.querySelector(".description")) || this.text(doc.querySelector("#intro"))
            let chapters = {}
            let links = doc.querySelectorAll("a[href*='chapter'], a[href*='read'], .chapter a, .chapter-list a, .episode-list a")
            for (let a of links) {
                let href = this.attr(a, "href")
                let name = this.text(a) || this.attr(a, "title")
                if (href && name) chapters[this.abs(href)] = name
            }
            doc.dispose()
            return new ComicDetails({
                title,
                cover: this.abs(cover),
                description: desc,
                chapters,
                url: id
            })
        },
        loadEp: async (comicId, epId) => {
            let doc = await this.getDoc(epId || comicId)
            let images = []
            let seen = {}
            let imgNodes = doc.querySelectorAll(".comicpage img, .comic-page img, .chapter-content img, .read-content img, #images img, article img, img")
            for (let img of imgNodes) {
                let src = this.attr(img, "data-original") || this.attr(img, "data-src") || this.attr(img, "src")
                src = this.abs(src)
                if (!src || /logo|avatar|icon|loading|default|qrcode|blank|data:image/i.test(src)) continue
                if (!seen[src]) {
                    seen[src] = true
                    images.push(src)
                }
            }
            doc.dispose()
            return { images }
        },
        onImageLoad: (url, comicId, epId) => {
            return { headers: this.headers }
        },
        onThumbnailLoad: (url) => {
            return { headers: this.headers }
        }
    }

    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = this.comic.loadInfo
    getImages = this.comic.loadEp
}
