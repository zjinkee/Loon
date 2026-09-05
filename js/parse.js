var mode = $resourceType;

var keep = "";
var drop = "";
var wipe = "";
var name = "";
var sort = "";
var emoji = false;
var ua = false;

(function parse() {
    var args = $argument;
    if (args) {
        keep = args.keep != null ? String(args.keep) : keep;
		drop = args.drop != null ? String(args.drop) : drop;
        wipe = args.wipe != null ? String(args.wipe) : wipe;
        name = args.name != null ? String(args.name) : name;
		sort = args.sort != null ? String(args.sort) : sort;
	    emoji = args.emoji === true;
        ua = args.ua === true;
    }
})();

(function main() {
    var input = $resource || "";

    if (ua && mode === 1 && $httpClient && $resourceUrl) {
        $httpClient.get(
            {
                url: String($resourceUrl),
                headers: { 
                    "User-Agent": "Shadowrocket/3218 CFNetwork/3860.600.12 Darwin/25.5.2 iPhone18,2",
                    "Cache-Control": "no-cache"
                }
            },
            function (fault, state, reply) {
                $done(mode === 1 ? sift(reply || input) : String(reply || ""));
            }
        );
    } else {
        $done(mode === 1 ? sift(input) : String(input));
    }
})();

function note(array) {
    var title = "资源解析器";
    var subtitle = "正则写错误";
    var detail = array.join("\n");

    if (typeof console !== "undefined" && console.log) {
        console.log(`${title} ${subtitle}\n${detail}\n`);
    }

    if (typeof $notification !== "undefined") {
        $notification.post(title, subtitle, detail);
    }
}

function sift(input) {
    var stage = String(input || "");
    if (stage.charCodeAt(0) === 0xFEFF) stage = stage.slice(1);

    var block = stage.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!block) return "";

    var match = null;
    var clear = null;
    var loose = null;
    var wrong = [];

    if (keep) {
        try { match = new RegExp(keep); } catch (e) { wrong.push(keep); match = null; }
    }
    if (wipe) {
        try { clear = new RegExp(wipe, "g"); } catch (e) { wrong.push(wipe); clear = null; }
    }
    if (drop) {
        try { loose = new RegExp(drop); } catch (e) { wrong.push(drop); loose = null; }
    }

    var alter = [];
    if (name) {
        var items = name.split(",");
        for (var i = 0; i < items.length; i++) {
            var split = items[i].indexOf(":");
            if (split > -1) {
                var key = items[i].slice(0, split).trim();
                if (key) {
                    try {
                        var reg = new RegExp(key, "g");
                        alter.push([reg, items[i].slice(split + 1).trim()]);
                    } catch (e) {
                        wrong.push(key);
                    }
                }
            }
        }
    }

    var sortKeywords = [];
    if (sort) {
        var sortItems = sort.split(">");
        for (var k = 0; k < sortItems.length; k++) {
            var item = sortItems[k].trim();
            if (item) {
                sortKeywords.push(item);
            }
        }
    }

    if (wrong.length > 0) {
        note(wrong);
    }

    var base = block.replace(/\s+/g, "");
    if (base && base.length >= 16 && /^[A-Za-z0-9+/=_-]+$/.test(base)) {
        try {
            var pad = base.length % 4;
            if (pad === 2) base += "==";
            else if (pad === 3) base += "=";
            var bin = atob(base.replace(/_/g, "/").replace(/-/g, "+")), out = [];
            for (var i = 0; i < bin.length; i++) {
                out.push("%" + ("00" + bin.charCodeAt(i).toString(16)).slice(-2));
            }
            var plain = decodeURIComponent(out.join(""));
            
            if (plain) {
                if (plain.charCodeAt(0) === 0xFEFF) plain = plain.slice(1);
                return processLines(plain.split("\n"), match, clear, loose, alter, sortKeywords);
            }
        } catch (e) {
            return processLines(block.split("\n"), match, clear, loose, alter, sortKeywords);
        }
    }
    
    return processLines(block.split("\n"), match, clear, loose, alter, sortKeywords);
}

function processLines(lines, match, clear, loose, alter, sortKeywords) {
    var output = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;

        if (line[0] === "#" && line.indexOf("://") === -1) {
            output.push({ isNode: false, text: line, id: i });
            continue;
        }

        var isUrlNode = line.indexOf("://") > -1;
        var isConfigNode = !isUrlNode && line.indexOf("=") > 0;

        if (isUrlNode) {
            var hash = line.lastIndexOf("#"), title = "", coded = false;
            if (hash > -1 && hash < line.length - 1) {
                try { title = decodeURIComponent(line.slice(hash + 1)); } catch (e) { title = line.slice(hash + 1); }
                coded = true;
            } else {
                var m = line.match(/[?&]remark=([^&#]*)/);
                if (m) {
                    try { title = decodeURIComponent(m[1]); } catch (e) { title = m[1]; }
                }
            }

            if (!title) {
                output.push({ isNode: false, text: line, id: i });
                continue;
            }

            if (loose && loose.test(title)) continue;
            if (match && !match.test(title)) continue;
            if (clear) title = title.replace(clear, "");
            
            if (emoji) {
                title = title.replace(/\p{Extended_Pictographic}/gu, "").replace(/\uD83C[\uDDE6-\uDDFF]/g, "").replace(/[\u200D\uFE0F]/g, "");
            }

            for (var j = 0; j < alter.length; j++) {
                title = title.replace(alter[j][0], alter[j][1]);
            }

            var finalText = coded
                ? line.slice(0, hash + 1) + encodeURIComponent(title)
                : line + "#" + encodeURIComponent(title);

            output.push({ isNode: true, text: finalText, name: title, id: i });

        } else if (isConfigNode) {
            var sign = line.indexOf("=");
            var label = line.slice(0, sign).trim();
            
            if (loose && loose.test(label)) continue;
            if (match && !match.test(label)) continue;
            if (clear) label = label.replace(clear, "").trim();
            
            if (emoji) {
                label = label.replace(/\p{Extended_Pictographic}/gu, "").replace(/\uD83C[\uDDE6-\uDDFF]/g, "").replace(/[\u200D\uFE0F]/g, "").trim();
            }

            for (var j = 0; j < alter.length; j++) {
                label = label.replace(alter[j][0], alter[j][1]);
            }

            output.push({ isNode: true, text: label + "=" + line.slice(sign + 1).trim(), name: label, id: i });
        } else {
            output.push({ isNode: false, text: line, id: i });
        }
    }

    var nodesOnly = [];
    for (var i = 0; i < output.length; i++) {
        if (output[i].isNode) {
            nodesOnly.push(output[i]);
        }
    }

    if (sortKeywords && sortKeywords.length > 0) {
        nodesOnly.sort(function(x, y) {
            var idxX = sortKeywords.length;
            for (var k = 0; k < sortKeywords.length; k++) {
                if (x.name.indexOf(sortKeywords[k]) > -1) { idxX = k; break; }
            }
            var idxY = sortKeywords.length;
            for (var k = 0; k < sortKeywords.length; k++) {
                if (y.name.indexOf(sortKeywords[k]) > -1) { idxY = k; break; }
            }
            if (idxX !== idxY) return idxX - idxY;
            return x.id - y.id;
        });
    }

    var resultLines = [];
    var nodeIdx = 0;
    for (var i = 0; i < output.length; i++) {
        if (output[i].isNode) {
            resultLines.push(nodesOnly[nodeIdx++].text);
        } else {
            resultLines.push(output[i].text);
        }
    }

    return resultLines.join("\n");
}
