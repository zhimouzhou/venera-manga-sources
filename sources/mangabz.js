/** @type {import('./_venera_.js')} */
class MangabzSource extends ComicSource {
    name = "Mangabz"
    key = "mangabz"
    version = "0.2.0"
    minAppVersion = "1.6.0"
    url = "https://www.mangabz.com"

    get baseUrl() { return "https://www.mangabz.com" }

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

    text(el) { return el ? (el.text || "").trim().replace(/\s+/g, " ") : "" }
    attr(el, name) { return el && el.attributes ? (el.attributes[name] || "") : "" }

    async getText(url, referer) {
        let headers = Object.assign({}, this.headers)
        if (referer) headers["Referer"] = referer
        let res = await Network.get(url, headers)
        if (res.status !== 200) throw `Request Error: ${res.status} ${url}`
        return res.body || ""
    }

    async getDoc(url, referer) {
        return new HtmlDocument(await this.getText(url, referer))
    }

    parseComicItem(a) {
        let href = this.attr(a, "href")
        if (!href || !/\/\d+bz\/?$/i.test(href)) return null
        let img = a.querySelector("img")
        let title = this.attr(a, "title") || this.attr(img, "alt") || this.text(a)
        title = title.split(/\s{2,}/)[0].trim()
        let cover = this.attr(img, "data-src") || this.attr(img, "data-original") || this.attr(img, "src")
        let id = this.abs(href)
        if (!title) return null
        return new Comic({ id, title, cover: this.abs(cover), description: this.baseUrl })
    }

    parseComicList(doc) {
        let list = []
        let seen = {}
        for (let a of doc.querySelectorAll("a")) {
            let c = this.parseComicItem(a)
            if (c && !seen[c.id]) {
                seen[c.id] = true
                list.push(c)
            }
        }
        return list
    }

    parseTitle(html, doc) {
        let m = html.match(/<title[^>]*>([^<]+)/i)
        let title = m ? m[1].replace(/漫畫.*/, "").trim() : ""
        return title || this.text(doc.querySelector("h1")) || this.text(doc.querySelector(".title"))
    }

    parseChapters(doc) {
        let chapters = {}
        for (let a of doc.querySelectorAll("a")) {
            let href = this.attr(a, "href")
            if (!href || !/^\/m\d+\/?$/i.test(href)) continue
            let name = this.text(a) || this.attr(a, "title")
            if (!name) continue
            chapters[this.abs(href)] = name
        }
        return chapters
    }

    parseImagesFromPacked(html) {
        let m = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?;\s*<\/script>/i)
        if (!m) return []
        try {
            let packed = m[0].replace(/<\/script>/i, "")
            let unpacked = eval(packed.replace(/^eval/, ""))
            let images = unpacked.match(/https?:\/\/[^'"]+/g) || []
            return images.filter(u => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u))
        } catch (e) {
            return []
        }
    }

    explore = [
        {
            title: "Mangabz",
            type: "multiPageComicList",
            load: async (page) => {
                let doc = await this.getDoc(this.baseUrl + "/")
                let comics = this.parseComicList(doc)
                doc.dispose()
                return { comics, maxPage: 1 }
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            let doc = await this.getDoc(`${this.baseUrl}/search?title=${encodeURIComponent(keyword)}`)
            let comics = this.parseComicList(doc)
            doc.dispose()
            return { comics, maxPage: 1 }
        },
        optionList: []
    }

    comic = {
        loadInfo: async (id) => {
            let html = await this.getText(id)
            let doc = new HtmlDocument(html)
            let title = this.parseTitle(html, doc)
            let cover = this.attr(doc.querySelector(".cover img"), "src") || this.attr(doc.querySelector(".detail-list-form-con img"), "src") || this.attr(doc.querySelector("img"), "src")
            let desc = this.text(doc.querySelector(".detail-info-content")) || this.text(doc.querySelector(".comic_deCon")) || this.text(doc.querySelector(".desc"))
            let chapters = this.parseChapters(doc)
            doc.dispose()
            return new ComicDetails({ title, cover: this.abs(cover), description: desc, chapters, url: id })
        },
        loadEp: async (comicId, epId) => {
            let url = epId || comicId
            let html = await this.getText(url, comicId)
            let images = this.parseImagesFromPacked(html)
            if (!images.length) throw `No images parsed: ${url}`
            return { images }
        },
        onImageLoad: (url, comicId, epId) => ({ headers: Object.assign({}, this.headers, { "Referer": epId || comicId || this.baseUrl }) }),
        onThumbnailLoad: (url) => ({ headers: this.headers })
    }

    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = this.comic.loadInfo
    getImages = this.comic.loadEp
}
