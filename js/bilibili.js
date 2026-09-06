var url = $request.url;
var body = $response.body;

if (/^https:\/\/app\.bilibili\.com\/x\/v2\/splash\/(list|show|event\/list2)/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.min_interval = 999999;
        obj.data.pull_interval = 999999;
        obj.data.event_list = [];
        obj.data.show = [{"ad_cb":""}];
        obj.data.list = [{"is_ad":false,"duration":0,"ad_cb":"","jump_image_url":"","schema_image_url":""}];
        obj.data.keep_ids = [];
        obj.data.max_time = 0;
    }
    body = JSON.stringify(obj);
    $done({ body });

} else if (/^https:\/\/app\.bilibili\.com\/x\/v2\/search/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data = obj.data.filter(v => v.type != "recommend").map(v => {
            delete v.search_ranking_meta;
            return v;
        });
    }
    body = JSON.stringify(obj);
    $done({ body });

} else if (/^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\/story/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.items = (obj.data.items || []).filter(v =>
            !(v.is_ad == true || v.ad_info || v.goto == "ad_av" || v.goto == "vertical_ad")
        );
    }
    body = JSON.stringify(obj);
    $done({ body });

} else if (/^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\?/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.items = (obj.data.items || []).filter(v =>
            !((v.ad_info && v.ad_info.is_ad_loc == true) || (v.card_type && v.card_type.indexOf("banner_") == 0))
        );
    }
    body = JSON.stringify(obj);
    $done({ body });

} else if (/^https:\/\/app\.bilibili\.com\/x\/resource\/show\/tab\/v2/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        var tab = obj.data.tab || [];
        obj.data.tab = [
            ...tab.filter(v => v.id == 40),
            ...tab.filter(v => v.id == 41),
            ...tab.filter(v => v.id == 3502),
            ...tab.filter(v => v.id == 3503),
            ...tab.filter(v => v.id == 39)
        ];
        obj.data.bottom = (obj.data.bottom || []).filter(v => [177, 179, 181].includes(v.id));
        obj.data.top = (obj.data.top || []).filter(v => v.id == 3510);
        obj.data.top_more = (obj.data.top_more || []).filter(v => v.id == 3504);
        obj.data.top_left = [];
    }
    body = JSON.stringify(obj);
    $done({ body });

} else if (/^https:\/\/app\.bilibili\.com\/x\/v2\/account\/mine\?/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.modular_vip_section = null;
        obj.data.sections_v2 = (obj.data.sections_v2 || [])
            .filter(v => v.type != 1 && v.type != 4)
            .map(v => {
                if (v.title == "更多服务") v.title = "";
                if (v.items) {
                    v.items = v.items.filter(i => ![812, 964].includes(i.id)).map(i => {
                        if (i.id == 410) i.title = "我的设置";
                        return i;
                    });
                }
                return v;
            })
            .filter(v => v.items && v.items.length > 0);
    }
    body = JSON.stringify(obj);
    $done({ body });

} else if (/^https:\/\/app\.bilibili\.com\/x\/v2\/account\/mine\/ipad/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.ipad_upper_sections = [];
        obj.data.ipad_recommend_sections = (obj.data.ipad_recommend_sections || [])
            .filter(v => v.title == "我的关注" || v.title == "我的消息" || v.title == "我的钱包");
        obj.data.ipad_more_sections = (obj.data.ipad_more_sections || [])
            .map(v => {
                if (v.title == "设置") v.title = "我的设置";
                return v;
            })
            .filter(v => v.title != "青少年守护");
    }
    body = JSON.stringify(obj);
    $done({ body });

} else {
    $done({ body });
}
