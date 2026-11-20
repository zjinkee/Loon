var mode = $resourceType;

var keep = "";
var drop = "";
var wipe = "";
var name = "";
var sort = "";
var emoji = false;
var ua = false;
var note = false;

var uaNote = "";
var nodeNote = "";

function loadArgs() {
    var args = $argument;
    if (!args) return;
    keep = args.keep != null ? String(args.keep) : keep;
    drop = args.drop != null ? String(args.drop) : drop;
    wipe = args.wipe != null ? String(args.wipe) : wipe;
    name = args.name != null ? String(args.name) : name;
    sort = args.sort != null ? String(args.sort) : sort;
    emoji = args.emoji === true || args.emoji === "true";
    ua = args.ua === true || args.ua === "true";
    note = args.note === true || args.note === "true";
}

function pad2(n) {
    return n < 10 ? "0" + n : String(n);
}

function getNowTime() {
    var d = new Date();
    var y = d.getFullYear();
    var m = pad2(d.getMonth() + 1);
    var day = pad2(d.getDate());
    var h = pad2(d.getHours());
    var min = pad2(d.getMinutes());
    var s = pad2(d.getSeconds());
    return y + "." + m + "." + day + "  " + h + ":" + min + ":" + s;
}

function postAlert(content) {
    if (!note || !content) return;
    if (typeof $notification !== "undefined" && typeof $notification.post === "function") {
        $notification.post("解析器", "", String(content));
    }
}

function flushLog() {
    if (!note) return;
    if (!uaNote && !nodeNote) return;

    var blocks = [getNowTime()];
    if (uaNote) blocks.push(uaNote);
    if (nodeNote) {
        if (uaNote) blocks.push("");
        blocks.push(nodeNote);
    }

    var logText = blocks.join("\n");
    if (typeof console !== "undefined" && typeof console.log === "function") {
        console.log(logText);
    }
}

function pullSub(cb) {
    var fallback = String($resource || "");
    if (ua && mode === 1 && typeof $httpClient !== "undefined" && $resourceUrl) {
        uaNote = "订阅请求使用小火箭UA拉取节点";
        postAlert(uaNote);
        $httpClient.get(
            {
                url: String($resourceUrl),
                headers: {
                    "User-Agent": "Shadowrocket/3218 CFNetwork/3860.600.12 Darwin/25.5.2 iPhone18,2",
                    "Cache-Control": "no-cache"
                }
            },
            function (_fault, _state, reply) {
                var text = reply != null && String(reply).length > 0 ? String(reply) : fallback;
                cb(text);
            }
        );
    } else {
        cb(fallback);
    }
}

function decodeUri(str) {
    if (!str) return "";
    try {
        return decodeURIComponent(str.replace(/\+/g, "%20"));
    } catch (_e) {
        return str;
    }
}

function decodeB64(rawText) {
    var text = String(rawText || "");
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!text) return "";

    var compact = text.replace(/\s+/g, "");
    if (compact.length >= 16 && compact.length % 4 !== 1 && /^[A-Za-z0-9+/=_-]+$/.test(compact)) {
        try {
            var norm = compact.replace(/_/g, "/").replace(/-/g, "+");
            var pad = norm.length % 4;
            if (pad === 2) norm += "==";
            else if (pad === 3) norm += "=";

            var bin = atob(norm);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            if (typeof TextDecoder !== "undefined") {
                var decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
                if (decoded.charCodeAt(0) === 0xFEFF) decoded = decoded.slice(1);
                return decoded.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            }
            var out = [];
            for (var j = 0; j < bytes.length; j++) {
                out.push("%" + ("00" + bytes[j].toString(16)).slice(-2));
            }
            var fallback = decodeURIComponent(out.join(""));
            if (fallback.charCodeAt(0) === 0xFEFF) fallback = fallback.slice(1);
            return fallback.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        } catch (_e) {
            return text;
        }
    }

    return text;
}

function getLinkName(line) {
    var hash = line.lastIndexOf("#");
    if (hash > -1) {
        return {
            title: decodeUri(line.slice(hash + 1)).trim(),
            hasHash: true,
            hashIndex: hash
        };
    }

    var qIndex = line.indexOf("?");
    if (qIndex > -1) {
        var queryPart = line.slice(qIndex + 1);
        var match = queryPart.match(/(?:^|&)(?:remark|remarks|ps)=([^&]*)/i);
        if (match && match[1]) {
            return {
                title: decodeUri(match[1]).trim(),
                hasHash: false,
                hashIndex: -1
            };
        }
    }

    return {
        title: "",
        hasHash: false,
        hashIndex: -1
    };
}

function parseLines(decodedText) {
    var entries = [];
    if (!decodedText) return entries;

    var rawLines = decodedText.split("\n");
    for (var i = 0; i < rawLines.length; i++) {
        var line = rawLines[i].trim();
        if (!line) continue;

        if (line[0] === "#" && line.indexOf("://") === -1) {
            entries.push({ kind: "other", text: line, id: i });
            continue;
        }

        var isShareLink = line.indexOf("://") > -1;
        var isNativeNode = !isShareLink && line.indexOf("=") > 0;

        if (isNativeNode) {
            var eqIdx = line.indexOf("=");
            entries.push({
                kind: "native",
                rawName: line.slice(0, eqIdx).trim(),
                body: line.slice(eqIdx + 1).trim(),
                id: i
            });
        } else if (isShareLink) {
            var info = getLinkName(line);
            entries.push({
                kind: "share",
                line: line,
                rawName: info.title,
                hasHash: info.hasHash,
                hashIndex: info.hashIndex,
                id: i
            });
        } else {
            entries.push({ kind: "other", text: line, id: i });
        }
    }

    return entries;
}

function makeRegex(pattern, flags) {
    if (!pattern) return null;
    try {
        return new RegExp(pattern, flags || "");
    } catch (_e) {
        return null;
    }
}

function parseRenameMap(rawName) {
    var rules = [];
    if (!rawName) return rules;
    var items = rawName.split(",");
    for (var i = 0; i < items.length; i++) {
        var idx = items[i].indexOf(":");
        if (idx > -1) {
            var oldStr = items[i].slice(0, idx);
            var newStr = items[i].slice(idx + 1);
            if (oldStr.length > 0) {
                rules.push([oldStr, newStr]);
            }
        }
    }
    return rules;
}

function replaceText(source, target, replacement) {
    if (!source || !target) return source;
    var pos = 0;
    var out = "";
    while (true) {
        var found = source.indexOf(target, pos);
        if (found === -1) {
            out += source.slice(pos);
            break;
        }
        out += source.slice(pos, found) + replacement;
        pos = found + target.length;
    }
    return out;
}

function parseSortKeys(rawSort) {
    var list = [];
    if (!rawSort) return list;
    var parts = rawSort.split(">");
    for (var i = 0; i < parts.length; i++) {
        var kw = parts[i].trim();
        if (kw) list.push(kw);
    }
    return list;
}

function dropEmoji(str) {
    return str
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/\uD83C[\uDDE6-\uDDFF]/g, "")
        .replace(/[\u200D\uFE0E\uFE0F]/g, "");
}

function checkFilter(title, ctx, stats) {
    var hasKeep = Boolean(ctx.keep);
    var hasDrop = Boolean(ctx.drop);

    if (hasKeep && hasDrop) {
        var matchedKeep = ctx.keep.test(title);
        var matchedDrop = ctx.drop.test(title);
        if (!matchedKeep) {
            stats.unmatchedKeep++;
            return false;
        }
        if (matchedDrop) {
            stats.excluded++;
            return false;
        }
        stats.kept++;
        return true;
    }

    if (hasKeep) {
        if (!ctx.keep.test(title)) {
            stats.filtered++;
            return false;
        }
        stats.kept++;
        return true;
    }

    if (hasDrop) {
        if (ctx.drop.test(title)) {
            stats.excluded++;
            return false;
        }
        stats.kept++;
        return true;
    }

    stats.kept++;
    return true;
}

function editName(rawTitle, ctx, stats) {
    var title = String(rawTitle || "").trim();
    if (!title) return "";

    if (!checkFilter(title, ctx, stats)) return null;

    if (ctx.wipe) {
        title = title.replace(ctx.wipe, "");
    }

    if (ctx.emoji) {
        title = dropEmoji(title);
    }

    for (var i = 0; i < ctx.renameRules.length; i++) {
        title = replaceText(title, ctx.renameRules[i][0], ctx.renameRules[i][1]);
    }

    return title.replace(/\s{2,}/g, " ").trim();
}

function notifyFilter(ctx, stats) {
    var hasKeep = Boolean(ctx.keep);
    var hasDrop = Boolean(ctx.drop);
    if (!hasKeep && !hasDrop) return;

    if (hasKeep && hasDrop) {
        nodeNote = "已保留 " + stats.kept + " 个节点 > 已排除 " + stats.excluded + " 个节点";
    } else if (hasKeep) {
        nodeNote = "已保留 " + stats.kept + " 个节点 > 过滤 " + stats.filtered + " 个节点";
    } else if (hasDrop) {
        nodeNote = "已排除 " + stats.excluded + " 个节点 > 保留 " + stats.kept + " 个节点";
    }

    postAlert(nodeNote);
}

function sortNodes(nodes, sortKeys) {
    if (!sortKeys.length) return nodes;
    nodes.sort(function (a, b) {
        var rankA = sortKeys.length;
        for (var x = 0; x < sortKeys.length; x++) {
            if (a.name.indexOf(sortKeys[x]) > -1) {
                rankA = x;
                break;
            }
        }
        var rankB = sortKeys.length;
        for (var y = 0; y < sortKeys.length; y++) {
            if (b.name.indexOf(sortKeys[y]) > -1) {
                rankB = y;
                break;
            }
        }
        if (rankA !== rankB) return rankA - rankB;
        return a.id - b.id;
    });
    return nodes;
}

function runNodes(entries) {
    if (!entries.length) return "";

    var ctx = {
        keep: makeRegex(keep, ""),
        drop: makeRegex(drop, ""),
        wipe: makeRegex(wipe, "g"),
        renameRules: parseRenameMap(name),
        emoji: emoji
    };

    var stats = {
        kept: 0,
        filtered: 0,
        excluded: 0,
        unmatchedKeep: 0
    };

    var sortKeys = parseSortKeys(sort);
    var processed = [];

    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];

        if (entry.kind === "native") {
            var nextName = editName(entry.rawName, ctx, stats);
            if (nextName === null || nextName === "") continue;
            processed.push({
                isNode: true,
                text: nextName + " = " + entry.body,
                name: nextName,
                id: entry.id
            });
        } else if (entry.kind === "share") {
            if (!entry.rawName) {
                processed.push({ isNode: false, text: entry.line, id: entry.id });
                continue;
            }
            var nextTitle = editName(entry.rawName, ctx, stats);
            if (nextTitle === null || nextTitle === "") continue;
            var encoded = encodeURIComponent(nextTitle);
            var nextLine = entry.hasHash
                ? entry.line.slice(0, entry.hashIndex + 1) + encoded
                : entry.line + "#" + encoded;
            processed.push({
                isNode: true,
                text: nextLine,
                name: nextTitle,
                id: entry.id
            });
        } else {
            processed.push({ isNode: false, text: entry.text, id: entry.id });
        }
    }

    notifyFilter(ctx, stats);

    var nodesOnly = [];
    for (var j = 0; j < processed.length; j++) {
        if (processed[j].isNode) nodesOnly.push(processed[j]);
    }

    sortNodes(nodesOnly, sortKeys);

    var result = [];
    var cursor = 0;
    for (var k = 0; k < processed.length; k++) {
        if (processed[k].isNode) {
            result.push(nodesOnly[cursor++].text);
        } else {
            result.push(processed[k].text);
        }
    }

    return result.join("\n");
}

(function main() {
    loadArgs();
    pullSub(function (rawText) {
        if (mode !== 1) {
            flushLog();
            $done(rawText);
            return;
        }
        var decodedText = decodeB64(rawText);
        var entries = parseLines(decodedText);
        var finalOutput = runNodes(entries);
        flushLog();
        $done(finalOutput);
    });
})();
