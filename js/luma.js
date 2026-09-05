var type = $argument.type;

var code = {"音乐":"j","网络":"f","文学":"d","诗词":"i","影视":"h","动画":"a","游戏":"c","哲学":"k","原创":"e","机灵":"l"}[type]||"d";

var url = "https://v1.hitokoto.cn/?c="+code;
var image = "https://api.yujn.cn/api/heisi.php";

$httpClient.get(url,(error,response,body)=>{
  if(error){
    console.log("请求失败："+error);
    $notification.post("每日一句","","请求失败"+error);
    $done();
    return;
  }

  var json = JSON.parse(body);
  var text = json.hitokoto;

  console.log(`每日一句\n\n${text}`);
  $notification.post("每日一句","",text,{mediaUrl:image});
  $done();
});
