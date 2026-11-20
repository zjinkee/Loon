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
    ua   = args.ua   === true || args.ua.  === "true";
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

        if (line.indexOf("://") > -1) {
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
            list.push({
                kind: "plain",
                rawName: line.slice(0, eq).trim(),
                body: line.slice(eq + 1).trim()
            });
        } else {
            list.push({
                kind: "plain",
                rawName: line,
                body: ""
            });
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

    var out = [];
    var kept = 0;
    var excluded = 0;

    for (var j = 0; j < entries.length; j++) {
        var item = entries[j];

        if (item.kind === "plain") {
            var nextN = editTitle(item.rawName);
            if (nextN === null || nextN === "") {
                excluded++;
                continue;
            }
            out.push(item.body ? nextN + " = " + item.body : nextN);
            kept++;
        } else if (item.kind === "share") {
            if (!item.rawName) {
                if (keepRe) {
                    excluded++;
                    continue;
                }
                out.push(item.line);
                kept++;
                continue;
            }
            var nextN = editTitle(item.rawName);
            if (nextN === null || nextN === "") {
                excluded++;
                continue;
            }
            var enc = encodeURIComponent(nextN);
            out.push(
                item.hasHash
                    ? item.line.slice(0, item.hashIndex + 1) + enc
                    : item.line + "#" + enc
            );
            kept++;
        }
    }

    if (note && (keep || drop)) {
        $notification.post(
            "资源解析器",
            "",
            "保留 " + kept + "个节点 >> 排除 " + excluded + "个节点"
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
                "资源解析器",
                "",
                "使用新的UA拉取订阅共计 " + list.length + " 个节点"
            );
        }
        var out = rename(list);
        $done(out);
    });
})();
