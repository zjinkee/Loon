var mode = $resourceType;

var keep = "";
var drop = "";
var wipe = "";
var name = "";
var note = false;
var ua   = false;

function param() {
    var args = $argument;
    if (!args) return;

    keep = args.keep != null ? String(args.keep) : keep;
    drop = args.drop != null ? String(args.drop) : drop;
    wipe = args.wipe != null ? String(args.wipe) : wipe;
    name = args.name != null ? String(args.name) : name;
    note = args.note === true || args.note === "true";
    ua   = args.ua === true || args.ua === "true";
}

function Reouest(cb) {
    var raw = String($resource || "");
    if (ua && mode === 1 && $resourceUrl) {
        $httpClient.get(
            {
                url: String($resourceUrl),
                headers: {
                    "User-Agent": "Shadowrocket/3218 CFNetwork/3860.600.12 Darwin/25.5.2 iPhone18,2",
                    "Cache-Control": "no-cache"
                }
            },
            function (_fault, _state, reply) {
                var res = reply != null && String(reply).length > 0 ? String(reply) : raw;
                cb(res, true);
            }
        );
    } else {
        cb(raw, false);
    }
}

function base64(content) {
    if (!content) return "";
    var str = String(content).replace(/^\uFEFF/, "").trim();
    if (!str) return "";

    var b64 = str.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length % 4 === 1) {
        return str;
    }
    while (b64.length % 4 !== 0) {
        b64 += "=";
    }

    try {
        var bin = atob(b64);
        var buf = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) {
            buf[i] = bin.charCodeAt(i);
        }
        return new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/^\uFEFF/, "");
    } catch (_) {
        return str;
    }
}

function node(decodedText) {
    var list = [];
    if (!decodedText) return list;

    var shareRe = /^(?:vmess|vless|trojan|ss|ssr|hysteria2?|hy2|tuic|wireguard|wg|anytls):\/\//i;
    var plainProtoRe = /^(?:shadowsocks|shadowsocksr|ss|ssr|vmess|vless|trojan|http|https|socks5|socks5h|wireguard|hysteria|hysteria2|tuic|snell|anytls)\s*,/i;

    function decodeNamePart(s) {
        if (!s) return "";
        try {
            return decodeURIComponent(s.replace(/\+/g, "%20")).trim();
        } catch (_) {
            return s.trim();
        }
    }

    var lines = decodedText.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        if (/^(?:#|\/\/|;)/.test(line)) continue;

        if (shareRe.test(line)) {
            var hash = line.lastIndexOf("#");
            if (hash > -1) {
                list.push({
                    kind: "share",
                    line: line,
                    rawName: decodeNamePart(line.slice(hash + 1)),
                    hasHash: true,
                    hashIndex: hash
                });
                continue;
            }

            var qIdx = line.indexOf("?");
            if (qIdx > -1) {
                var qs = line.slice(qIdx + 1);
                var m = qs.match(/(?:^|&)(?:remark|remarks|ps)=([^&]*)/i);
                if (m && m[1]) {
                    list.push({
                        kind: "share",
                        line: line,
                        rawName: decodeNamePart(m[1]),
                        hasHash: false,
                        hashIndex: -1
                    });
                    continue;
                }
            }

            list.push({
                kind: "share",
                line: line,
                rawName: "",
                hasHash: false,
                hashIndex: -1
            });
            continue;
        }

        var eq = line.indexOf("=");
        if (eq > 0) {
            var left = line.slice(0, eq).trim();
            var right = line.slice(eq + 1).trim();
            if (left && plainProtoRe.test(right)) {
                list.push({
                    kind: "plain",
                    rawName: left,
                    body: right
                });
            }
        }
    }

    return list;
}

function rename(entries) {
    if (!entries.length) return "";

    var keepRe = null;
    if (keep) {
        try { keepRe = new RegExp(keep); } catch (_) { keepRe = null; }
    }

    var dropRe = null;
    if (drop) {
        try { dropRe = new RegExp(drop); } catch (_) { dropRe = null; }
    }

    var wipeRe = null;
    if (wipe) {
        try { wipeRe = new RegExp(wipe, "g"); } catch (_) { wipeRe = null; }
    }

    var rules = [];
    if (name) {
        var arr = name.split("+");
        for (var i = 0; i < arr.length; i++) {
            var sep = arr[i].indexOf(":");
            if (sep > -1) {
                var src = arr[i].slice(0, sep).trim();
                var dst = arr[i].slice(sep + 1).trim();
                if (src.length > 0) {
                    rules.push([src, dst]);
                }
            }
        }
    }

    function editTitle(rawTitle) {
        var t = String(rawTitle || "").trim();
        if (!t) return "";

        if (keepRe && !keepRe.test(t)) return null;
        if (dropRe && dropRe.test(t)) return null;
        if (wipeRe) {
            t = t.replace(wipeRe, "");
        }
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (t && rule[0]) {
                t = t.split(rule[0]).join(rule[1]);
            }
        }

        return t.replace(/\s{2,}/g, " ").trim();
    }

    var total = entries.length;
    var out = [];
    var matchedKeep = 0;
    var matchedDrop = 0;

    for (var j = 0; j < total; j++) {
        var item = entries[j];
        var rawN = String(item.rawName || "").trim();

        if (keepRe && rawN && keepRe.test(rawN)) {
            matchedKeep++;
        }
        if (dropRe && rawN && dropRe.test(rawN)) {
            matchedDrop++;
        }

        if (item.kind === "plain") {
            var nextN = editTitle(item.rawName);
            if (nextN === null || nextN === "") continue;
            out.push(item.body ? nextN + " = " + item.body : nextN);
        } else if (item.kind === "share") {
            if (!item.rawName) {
                if (keepRe) continue;
                out.push(item.line);
                continue;
            }
            var nextN = editTitle(item.rawName);
            if (nextN === null || nextN === "") continue;
            var enc = encodeURIComponent(nextN);
            out.push(
                item.hasHash
                    ? item.line.slice(0, item.hashIndex + 1) + enc
                    : item.line + "#" + enc
            );
        }
    }

    if (note && (keep || drop)) {
        var kept = 0;
        var excluded = 0;

        if (dropRe && !keepRe) {
            excluded = matchedDrop;
            kept = total - excluded;
        } else if (keepRe && !dropRe) {
            kept = matchedKeep;
            excluded = total - kept;
        } else {
            kept = out.length;
            excluded = total - kept;
        }

        $notification.post(
            "解析器",
            "筛选⇣",
            "保留 " + kept + "个节点 ➟ 排除 " + excluded + "个节点"
        );
    }

    return out.join("\n");
}

(function main() {
    param();
    Reouest(function (contentText, fetchedByUa) {
        var dec = base64(contentText);
        if (mode !== 1) {
            $done(dec);
            return;
        }
        var list = node(dec);
        if (note && fetchedByUa) {
            $notification.post(
                "解析器",
                "",
                "已启用替换UA请求拉取订阅共计 " + list.length + " 个节点"
            );
        }
        var out = rename(list);
        $done(out);
    });
})();
