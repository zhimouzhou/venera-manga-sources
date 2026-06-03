/** @type {import('./_venera_.js')} */
class Rumanhua2Source extends ComicSource {
    name = "\u5982\u6f2b\u753b"
    key = "rumanhua2"
    version = "0.4.1"
    minAppVersion = "1.6.0"
    url = "http://www.rumanhua2.com"

    BASE_URL_CANDIDATES = [
        "http://www.rumanhua2.com",
        "http://rumanhua2.com",
        "https://rumanhua2.com",
        "https://www.rumanhua2.com"
    ]

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": this.url + "/"
        }
    }

    attr(el, name) { return el && el.attributes ? (el.attributes[name] || "") : "" }
    text(el) { return el ? (el.text || "").trim().replace(/\s+/g, " ") : "" }

    originOf(u) {
        let m = (u || "").match(/^(https?:\/\/[^\/]+)/i)
        return m ? m[1].replace(/\/$/, "") : ""
    }

    pathOf(u) {
        if (!u) return "/"
        u = ("" + u).trim()
        if (u.startsWith("//")) u = "http:" + u
        let m = u.match(/^https?:\/\/[^\/]+(\/[\s\S]*)?$/i)
        if (m) return m[1] || "/"
        if (!u.startsWith("/")) u = "/" + u
        return u
    }

    isSiteUrl(u) {
        return /^(https?:\/\/)?(www\.)?rumanhua2\.com(\/|$)/i.test((u || "").replace(/^\/\//, "http://"))
    }

    normalizeUrl(u, base) {
        if (!u) return ""
        u = ("" + u).trim()
        if (/^(https?:\/\/)?([^\/]+\.)?(ecombdimg|zhuxiaobang|shimolife)\.com/i.test(u)) return u
        if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("//")) {
            if (!this.isSiteUrl(u)) return u.startsWith("//") ? "http:" + u : u
            return (base || this.url) + this.pathOf(u)
        }
        return (base || this.url) + this.pathOf(u)
    }

    requestHeaders(base, referer, contentType) {
        let headers = Object.assign({}, this.headers, { "Referer": referer || base + "/" })
        if (contentType) headers["Content-Type"] = contentType
        return headers
    }

    async fetchWithFallback(pathOrUrl, postData, referer) {
        let path = this.pathOf(pathOrUrl)
        let last = ""
        for (let base of this.BASE_URL_CANDIDATES) {
            let target = base + path
            try {
                let res
                if (postData) {
                    let body = Object.keys(postData).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(postData[k])}`).join("&")
                    res = await Network.post(target, this.requestHeaders(base, referer, "application/x-www-form-urlencoded; charset=UTF-8"), body)
                } else {
                    res = await Network.get(target, this.requestHeaders(base, referer))
                }
                if (res.status === 200 && (res.body || "").length) {
                    return { body: res.body || "", base, url: target }
                }
                last = `HTTP ${res.status} ${target}`
            } catch (e) {
                last = `${e}`
            }
        }
        throw `All rumanhua2 fallback hosts failed: ${last}`
    }

    parseMeta(doc, name) {
        return this.attr(doc.querySelector(`meta[property="og:${name}"]`), "content") ||
            this.attr(doc.querySelector(`meta[itemprop="${name}"]`), "content")
    }

    parseComicList(doc, base) {
        let list = []
        let seen = {}
        for (let a of doc.querySelectorAll("a")) {
            let href = this.attr(a, "href")
            if (!href || !/^\/[^\/]+\/$/.test(this.pathOf(href))) continue
            let img = a.querySelector("img")
            let title = this.attr(a, "title") || this.attr(img, "alt") || this.text(a)
            title = title.replace(/\s*(最新|章节|作者).*$/g, "").trim()
            let cover = this.attr(img, "data-src") || this.attr(img, "data-original") || this.attr(img, "src")
            let id = this.normalizeUrl(href, base)
            if (!title || seen[id] || /^(首页|排行|分类|登录|注册|用户|历史)$/.test(title)) continue
            seen[id] = true
            list.push(new Comic({
                id: id || "",
                title: title || "",
                cover: this.normalizeUrl(cover, base) || "",
                subtitle: "",
                description: "\u5982\u6f2b\u753b"
            }))
        }
        return list
    }

    parseInfo(html, id, base) {
        let doc = new HtmlDocument(html)
        let title = this.parseMeta(doc, "title") || this.text(doc.querySelector("h1")) || this.text(doc.querySelector(".title"))
        title = title.replace(/_.*$/, "").trim()
        let cover = this.parseMeta(doc, "image") ||
            this.attr(doc.querySelector(".detail img"), "data-src") ||
            this.attr(doc.querySelector(".detail img"), "src") ||
            this.attr(doc.querySelector("img"), "data-src") ||
            this.attr(doc.querySelector("img"), "src")
        let author = this.parseMeta(doc, "author") || ""
        let description = this.parseMeta(doc, "description") || this.text(doc.querySelector(".introduction")) || this.text(doc.querySelector(".desc"))
        let chapters = this.parseChapters(doc, this.normalizeUrl(id, base), base)
        doc.dispose()
        return new ComicDetails({
            title: title || "",
            cover: this.normalizeUrl(cover, base) || "",
            description: description || "",
            tags: new Map([
                ["作者", author ? [author] : []],
                ["状态", []]
            ]),
            chapters: chapters || new Map(),
            url: this.normalizeUrl(id, base) || ""
        })
    }

    parseChapters(doc, comicId, base) {
        let chapters = new Map()
        let id = (this.pathOf(comicId).match(/^\/([^\/]+)\/?/) || [])[1]
        if (!id) return chapters
        let pattern = new RegExp(`^/${id}/[^/]+\\.html$`)
        for (let a of doc.querySelectorAll("a")) {
            let href = this.attr(a, "href")
            if (!href || !pattern.test(this.pathOf(href))) continue
            let name = this.text(a) || this.attr(a, "title")
            if (!name || /上一章|下一章|继续阅读/.test(name)) continue
            chapters.set(this.normalizeUrl(href, base), name || "")
        }
        return chapters
    }

    unpackPageScript(html) {
        let m = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d\)[\s\S]*?)\s*<\/script>/i)
        if (!m) return ""
        try { return eval(m[1].replace(/^eval/, "")) } catch (e) { return "" }
    }

    extractC0rst96(html) {
        let unpacked = this.unpackPageScript(html)
        return (unpacked.match(/__c0rst96\s*=\s*["']([^"']+)/) || [])[1] || ""
    }

    extractReaderId(html) {
        let m = html.match(/readerContainer["'\s][^>]*data-id=["']?(\d+)/i)
        return m ? parseInt(m[1]) : 0
    }

    extractAll2Url(html, base) {
        let m = html.match(/<script[^>]+src=["']([^"']*all2\.js[^"']*)["']/i)
        return this.normalizeUrl(m ? m[1] : "/static/js/all2.js?v=2.3", base)
    }

    runAll2Decoder(all2, encoded, dataId) {
        let appended = ""
        let root = Function("return this")()
        let oldWindow = root.window, oldGlobal = root.global, oldAtob = root.atob, oldC0 = root.__c0rst96, oldDollar = root.$
        try {
            root.window = root
            root.global = root
            if (!root.atob) {
                root.atob = function(value) {
                    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
                    let str = String(value).replace(/=+$/, "")
                    let output = "", bc = 0, bs, buffer, idx = 0
                    while ((buffer = str.charAt(idx++))) {
                        buffer = chars.indexOf(buffer)
                        if (~buffer) {
                            bs = bc % 4 ? bs * 64 + buffer : buffer
                            if (bc++ % 4) output += String.fromCharCode(255 & bs >> ((-2 * bc) & 6))
                        }
                    }
                    return output
                }
            }
            root.__c0rst96 = encoded
            root.$ = function(arg) {
                if (typeof arg === "function") {
                    arg()
                    return {}
                }
                return { data: () => dataId, append: html => { appended += html } }
            }
            Function(all2)()
        } finally {
            root.window = oldWindow
            root.global = oldGlobal
            root.atob = oldAtob
            root.__c0rst96 = oldC0
            root.$ = oldDollar
        }
        return appended
    }

    async parseImages(html, pageUrl, base) {
        let encoded = this.extractC0rst96(html)
        if (!encoded) throw `getImages failed: decode __c0rst96 failed, url=${pageUrl}`
        let all2Res = await this.fetchWithFallback(this.extractAll2Url(html, base), null, pageUrl)
        let rendered = this.runAll2Decoder(all2Res.body, encoded, this.extractReaderId(html))
        let images = []
        let seen = {}
        for (let u of rendered.match(/(?:data-src|src)=["']([^"']+)/ig) || []) {
            let m = u.match(/=["']([^"']+)/)
            let src = this.normalizeUrl(m ? m[1] : "", base)
            if (!src || /load|logo|track|favicon|static\/images/i.test(src)) continue
            if (!seen[src]) {
                seen[src] = true
                images.push(src)
            }
        }
        if (!images.length) throw `getImages failed: decode __c0rst96 failed, url=${pageUrl}`
        return images
    }

    explore = [{ title: "\u5982\u6f2b\u753b", type: "multiPageComicList", load: async (page) => {
        let res = await this.fetchWithFallback("/")
        let doc = new HtmlDocument(res.body)
        let comics = this.parseComicList(doc, res.base)
        doc.dispose()
        return { comics, maxPage: 1 }
    }}]

    search = { load: async (keyword, options, page) => {
        try {
            let res = await this.fetchWithFallback("/s", { k: keyword })
            let doc = new HtmlDocument(res.body)
            let comics = this.parseComicList(doc, res.base).filter(c => c && c.id && c.title)
            doc.dispose()
            return { comics, maxPage: 1 }
        } catch (e) {
            throw `search failed, url=/s, ${e}`
        }
    }, optionList: [] }

    comic = {
        loadInfo: async (id) => {
            try {
                let res = await this.fetchWithFallback(id)
                return this.parseInfo(res.body, id, res.base)
            } catch (e) {
                throw `getComicInfo failed, url=${id}, ${e}`
            }
        },
        loadEp: async (comicId, epId) => {
            let url = epId || comicId
            try {
                let res = await this.fetchWithFallback(url, null, comicId)
                let images = await this.parseImages(res.body, res.url, res.base)
                return { images: images || [] }
            } catch (e) {
                throw `getImages failed, url=${url}, ${e}`
            }
        },
        onImageLoad: (url, comicId, epId) => ({ headers: Object.assign({}, this.headers, { "Referer": epId || comicId || this.url }) }),
        onThumbnailLoad: (url) => ({ headers: this.headers })
    }

    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = async (id) => {
        let details = await this.comic.loadInfo(id)
        return details && details.chapters ? details.chapters : new Map()
    }
    getImages = this.comic.loadEp
}
