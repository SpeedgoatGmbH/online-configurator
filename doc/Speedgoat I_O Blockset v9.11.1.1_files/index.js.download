const a = window;
a.appCdn = a.appCdn || {};
a.appCdn.initCacheStatus = a.appCdn.initCacheStatus || E;
function E({ domId: l, isEnabled: d, header: f, cacheTag: p, serverTime: h }) {
  m(window.location.hash === "#cachedebug"), document.addEventListener("DOMContentLoaded", () => {
    const t = document.querySelector("#custom-purge");
    t && t.addEventListener("click", function() {
      const e = document.querySelector("#custom-purge-url").value;
      o(e);
    });
    const c = document.querySelector("#full-purge");
    c && c.addEventListener("click", function() {
      o();
    });
    const n = document.querySelector("#tag-purge");
    n && n.addEventListener("click", function() {
      const e = document.querySelector("#tag-purge-url").value;
      e.trim() !== "" ? o("", e) : alert("Please enter at least one tag to purge.");
    });
  });
  function o(t = "", c = "") {
    if (!(!c && (!t || t.trim() === "") && !confirm("You are about to purge the entire cache. Are you sure?"))) {
      var n = $2sxc(l), e = {
        flushUrl: t,
        tags: c
      };
      n.webApi.fetchJson("app/auto/api/Cache/Purge", e).then((s) => {
        s.success && alert("Purge successful!");
      });
    }
  }
  async function i(t) {
    try {
      const c = await fetch(t, { method: "GET", cache: "reload" }), n = c.headers.get("cf-cache-status") || "missing", e = c.headers.get("cache-control") || "missing", s = e.toLowerCase().includes("public");
      return { cf: n, cc: e, isPublic: s };
    } catch {
      return { cf: "Error loading", cc: "Error loading", isPublic: !1 };
    }
  }
  function g(t, c, n, e, s) {
    const r = ["HTML", "JS", "CSS", "IMG"].map((S, y) => {
      const { cf: b, cc: w, isPublic: P } = t[y] || {};
      return `${S}: CF=${b}, CC=${w}, ${P ? "✅ public" : "❌ not public"}`;
    }), C = (/* @__PURE__ */ new Date()).toLocaleString("de-DE", { hour12: !1 });
    return `Cache Status: ${c ? "enabled" : "disabled"}
Cache-Control: ${n}
Cache-Tag: ${e}
Server-Zeit: ${s} Browser-Zeit: ${C}
` + r.join(`
`);
  }
  async function m(t = !1) {
    const c = [
      { selector: window.location.href, prop: null, id: "cf-status-html" },
      { selector: "script[src]", prop: "src", id: "cf-status-js" },
      { selector: 'link[rel="stylesheet"][href]', prop: "href", id: "cf-status-css" },
      { selector: "img[src]", prop: "src", id: "cf-status-img" }
    ], n = await Promise.all(
      c.map(async ({ selector: s, prop: u }) => {
        if (u === null) return i(s);
        const r = document.querySelector(s);
        return r ? i(r[u]) : { cf: "missing", cc: "missing", isPublic: !1 };
      })
    ), e = g(n, d, f, p, h);
    if (t)
      alert(e);
    else {
      const s = document.querySelector("#app-stats");
      s && (s.value = e);
    }
  }
}
