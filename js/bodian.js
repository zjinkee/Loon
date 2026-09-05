var url = $request.url;
var body = $response.body;

if (/us\.l\.qq\.com\/exapp/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        for (var key in obj.data) {
            if (obj.data[key] && obj.data[key].list) {
                obj.data[key].list = [{
                    endtime: 1,
                    begintime: 1,
                    timelife: 0,
                    video_duration: 0,
                    img: "",
                    video: ""
                }];
            }
        }
    }
    body = JSON.stringify(obj);
    $done({ body });
}

if (/api\/search\/topic\/word\/list/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        delete obj.data.globalJumpInfo;
        delete obj.data.kingKong;
        delete obj.data.hotTopic;
        delete obj.data.searchFind;
    }
    body = JSON.stringify(obj);
    $done({ body });
}

if (/api\/service\/global\/config\/scene/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.showShopEntry = false;
        obj.data.idolTabShow = false;
    }
    body = JSON.stringify(obj);
    $done({ body });
}

if (/api\/service\/home\/index/i.test(url)) {
    let obj = JSON.parse(body);
    if (obj.data) {
        obj.data.moduleList = obj.data.moduleList.filter(item =>
            ![1, 2, 6, 8, 12].includes(item.type)
        );
    }
    body = JSON.stringify(obj);
    $done({ body });
}

if (/api\/service\/music\/info/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        obj.data.showAd = 0;
        obj.data.downloadAdvert = 0;
        if (obj.data.payInfo) {
            obj.data.payInfo.tips_intercept = "0";
            obj.data.payInfo.cannotDownload = 0;
            obj.data.payInfo.cannotOnlinePlay = 0;
        }
    }
    body = JSON.stringify(obj);
    $done({ body });
}

if (/api\/play\/music\/v2\/checkRight/i.test(url)) {
    var obj = JSON.parse(body);
    var boy = {
        reqId: obj.reqId,
        code: 200,
        data: { status: 7 },
        msg: "success",
        profileId: "site",
        curTime: obj.curTime
    };
    body = JSON.stringify(boy);
    $done({ body });
}

if (/api\/play\/music\/v2\/audioUrl/i.test(url)) {
    var obj = JSON.parse(body);
    var rid = url.match(/musicId=([^&]+)/)[1];

    var url =
        "https://mobi.kuwo.cn/mobi.s?f=web&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&type=convert_url_with_sign&br=2000kflac&format=mp3&user=" +
        (Math.floor(Math.random() * 90000000) + 10000000) +
        "&rid=" + rid;

    $httpClient.get(url, function (error, response, body) {
        if (error) {
            $done({
                body: JSON.stringify(obj)
            });
            return;
        }

        var mobi = JSON.parse(body);
        var data = {
            reqId: obj.reqId,
            data: {
                format: mobi.data.format,
                bitrate: mobi.data.bitrate,
                duration: mobi.data.duration,
                p2pAudioSourceId: mobi.data.p2p_audiosourceid,
                audioUrl: mobi.data.url,
                audioHttpsUrl: mobi.data.url
            },
            code: mobi.code,
            msg: "success",
            profileId: "site",
            curTime: obj.curTime
        };

        $done({
            body: JSON.stringify(data)
        });
    });
    return;
}

if (/api\/ucenter\/users\/(pub|login)/i.test(url)) {
    var obj = JSON.parse(body);
    if (obj.data) {
        if (obj.data.payInfo) {
            var pay = obj.data.payInfo;
            pay.isSignedBoolean = true;
            pay.isCtVipBoolean = true;
            pay.isCtPayVipBoolean = true;
            pay.ctExpireDate = 2524608000000;
            pay.isVip = 1;
            pay.signedCount = 999;
            pay.isVipBoolean = true;
            pay.isBigVipBoolean = true;
            pay.bigExpireDate = 2524608000000;
            pay.signType = 1;
            pay.actVipType = 1;
            pay.bigPayExpireDate = 2524608000000;
            pay.vipType = 1;
            pay.ctPayExpireDate = 2524608000000;
            pay.isBigPayVipBoolean = true;
            pay.payExpireDate = 2524608000000;
            pay.actExpireDate = 2524608000000;
            pay.isActVipBoolean = true;
            pay.isPayVipBoolean = true;
            pay.payVipType = 1;
            pay.isSigned = 1;
            pay.isFreeCtVip = true;
            pay.signPayType = 1;
            pay.expireDate = 2524608000000;
        }
        if (obj.data.userInfo) {
            var pay = obj.data.userInfo;
            pay.vipType = 1;
            pay.isVip = 1;
            pay.payVipType = 1;
            pay.authType = 1;
        }
    }
    body = JSON.stringify(obj);
    $done({ body });
}

$done({ body });
