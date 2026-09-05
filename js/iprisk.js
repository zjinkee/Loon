var node = $environment.params.nodeInfo.name;

function rate(num,len=30){
    var val=Number(num);
    var obj={
        x:"",
        k:"获取失败",
        b:`<span style="color:#A5A5A5;">${"■".repeat(len)}</span>`
    };

    if(num!==""&&!isNaN(+num)){
        obj.x=val+"%";

        if(val>=70)obj.k="高危风险IP";
        else if(val>=50)obj.k="高风险IP";
        else if(val>=20)obj.k="中风险IP";
        else if(val>0)obj.k="低风险IP";
        else obj.k="无风险IP";

        var done=val>0?Math.max(1,Math.min(len,Math.ceil(val/100*len))):0;

        obj.b=
        `<span style="color:#E56666;text-shadow:0 0 1.5px #E56666;">${"■".repeat(done)}</span>`+
        `<span style="color:#52D078;text-shadow:0 0 1.5px #52D078;">${"■".repeat(len-done)}</span>`;
    }
    return obj;
}


function get(url){
    return new Promise(function(back){
        $httpClient.get({
            url:url,
            timeout:4000,
            node:node,
            headers:{
                "User-Agent":"Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
            }
        },function(error,response,body){

            if(error){
                back({error:"请求超时"});
                return;
            }
            if(!response||response.status!=200){
                back({
                    error:`请求失败HTTP ${response.status}`
                });
                return;
            }
            back({body:body});
        });
    });
}


(async function(){    
    var main=await get("https://my.ippure.com/v1/info");
    if (main.error){
        $done({
            title:"查询失败",
            message:`节点「${node}」${main.error}`
        });
        return;
    }
    var data=JSON.parse(main.body);

    var loca=new Intl.DisplayNames(['zh-Hans'],{type:'region'}).of(data.countryCode);
    var type=data.isResidential?"住宅":"数据中心";
    var bcst=data.isBroadcast?"广播IP":"非广播IP";

    var rska=rate(data.fraudScore);
    var txta=rska.k+" "+rska.x;


    var [
        ipdata,
        ip2location,
        scamalytics
    ]=await Promise.all([
        get(`https://ipdata.co/${data.ip}`),
        get(`https://www.ip2location.io/${data.ip}`),
        get(`https://scamalytics.com/ip/${data.ip}`)
    ]);


    var rskb=rate("");
    var rskc=rate("");
    var rskd=rate("");

    var txtb;
    var txtc;
    var txtd;


    if(ipdata.error){
        txtb=ipdata.error;
    }else{
        var matc=ipdata.body.match(/sidebar-trust-score-value[\s\S]*?>\s*(\d+)/);
        var scor=matc?(100-Number(matc[1])):"";
        rskb=rate(scor);
        txtb=rskb.k+" "+rskb.x;
    }


    if(ip2location.error){
        txtc=ip2location.error;
    }else{
        var matc=ip2location.body.match(
            /<label class="mb-0">Fraud Score<\/label>[\s\S]*?<p class="ip-result">([\s\S]*?)<\/p>/
        );
        var scor=matc?matc[1].trim():"";
        rskc=rate(scor);
        txtc=rskc.k+" "+rskc.x;
    }


    if(scamalytics.error){
        txtd=scamalytics.error;
    }else{
        var matc=scamalytics.body.match(/Fraud Score:\s*(\d+)/i);
        var scor=matc?matc[1].trim():"";
        rskd=rate(scor);
        txtd=rskd.k+" "+rskd.x;
    }


    var html=`
<p style="text-align:center;font-family:-apple-system;line-height:1;"><br>
<span style="font-size:17px;font-weight:600;color:#228CFF;">IP ${data.ip}</span><br>
<span style="color:#CCC;">─────────────────────</span><br>

<span style="font-size:10px;font-weight:500;">${txta}</span><br>
<span style="font-size:9px;">${rska.b}</span><br>
<span style="font-size:9px;font-weight:400;">IPPure</span><br><br>

<span style="font-size:10px;font-weight:500;">${txtb}</span><br>
<span style="font-size:9px;">${rskb.b}</span><br>
<span style="font-size:9px;font-weight:400;">IPdata</span><br><br>

<span style="font-size:10px;font-weight:500;">${txtc}</span><br>
<span style="font-size:9px;">${rskc.b}</span><br>
<span style="font-size:9px;font-weight:400;">IP2Location</span><br><br>

<span style="font-size:10px;font-weight:500;">${txtd}</span><br>
<span style="font-size:9px;">${rskd.b}</span><br>
<span style="font-size:9px;font-weight:400;">Scamalytics</span><br><br>

<span style="font-size:13px;font-weight:400;">属于：${type} • ${bcst}</span><br>
<span style="font-size:13px;font-weight:400;">位置：${loca}</span><br>

<span style="color:#CCC;">─────────────────────</span><br>
<span style="font-size:13px;font-weight:600;color:#8659E8;">节点：${node}</span>
</p>`;

    $done({
        title:"查询结果",
        htmlMessage:html
    });

})();
