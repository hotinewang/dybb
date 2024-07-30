const { time } = require('console')
const { config } = require('process')

var urllist = []
var urllistremain = []
var movieList = []
var loadingPoolCount = 0
const loadingPoolMax = 200 //同时加载网页的最大数量
const htmlTemplatePath='index_t.html'
const savePath='index.html'
const maxtxtlen=150  //像网页中输出的电影简介的最大字符数
const maxMovies =100  //最多读取的电影数
var movielisturl='https://www.dydytt.net'
var moviepageurl='https://www.dydytt.net'
var errorTimes=0

var debugMode=true


class MovieInfo
{
    constructor()
    {
        this.index=''
        this.title=''
        this.year=''
        this.country=''
        this.language=''
        this.type=''
        this.stars=''
        this.plot=''
        this.posturl=''
        this.downloadurl=''
    }
}


function strRemoveAll(str,regArr=[])
{
    var s=str
    for(let i=0;i<=regArr.length;i++)
    {
        s=s.replaceAll(regArr[i],"")
        //while(s.indexOf(regArr[i])!=-1)
        //{
        //    s=s.replace(regArr[i],"")
        //}
    }
    return s;
}


function loadPage(url,ishttps=false,pagecode='UTF8',otherinfo={}) {
    if(ishttps){
        var http = require('https')
    }else{
        var http = require('http')
    }
    var pm = new Promise(function (resolve,reject){
        console.log('载入：'+url)
        http.get(url, function (res){
            if(pagecode=='UTF8')
            {
                let html = ''
                res.on('data',function(d){
                    html += d.toString()
                })
                res.on('end',function(){
                    resolve({'data':html,'other':otherinfo})
                })
            }else{
                let bufferHelper=new (require('bufferhelper'))();
                res.on('data',function(d){
                    bufferHelper.concat(d)
                })
                res.on('end',function(){
                    resolve({'data':require('iconv-lite').decode(bufferHelper.toBuffer(),pagecode),'other':otherinfo})
                })
            }
        }).on('error',function(e){
            console.log("载入页面出错"+e)
            reject({'data':e,'other':otherinfo})
        });
    })
    return pm;
}

/*
* 整理出电影下载的URL列表
*/
function _parseURLListPage(d)
{
    let h = require('cheerio').load(d.data)
    movieList=[]
    urllist = []
    urllistremain = []
    movieList = []
    loadingPoolCount = 0
    //console.log(h.html())
    //console.log(h('.co_area2 .co_content2 ul').html())
    let listA=h('.co_area2 .co_content2 ul a')
    if(listA.length==0)
    {
        if(errorTimes==0)
        {
            console.log('获取电影列表数量为0，页面信息异常：'+d.data)
            console.log('尝试第二次读取电影列表。')
            errorTimes++
            //修改为备用网址
            movielisturl='https://www.dydytt.net/index.htm'
            moviepageurl='https://www.dydytt.net/'
            loadPage(movielisturl,true,'gb2312').then(_parseURLListPage,_loadErr)
            return
        }else{
            console.log('获取电影列表数量为0，页面信息异常：'+d.data)
            console.log('结束爬虫程序。')
            return  //结束爬虫
        }
    }
    //console.log(listA[1])
    for( let i=0;i<listA.length;i++)
    {
        urllist.push(moviepageurl+listA[i].attribs.href)
        //console.log('-------------'+i+'--------------')
        //console.log(listA[i].children[0].data)
        //console.log(listUrl[i])
    }
    console.log("共获取电影URL信息条数为："+urllist.length)
    //-仅供减少电影列表数量，发布时可去掉下边这一行------------------------------------------------
    urllist=urllist.splice(0,maxMovies)
    //------------------------------------------------------------------------------------------------
    urllistremain=urllist.slice()
    _parseUrlList()
}

/*
* 获取信息详情
*/
function _getMovieInfo(s)
{
    //console.log('加载网页成功（序号）：'+s.other)
    //提取关键信息
    let ept=['-'] //空数组。如果正则表达式匹配不到任何结果返回null，就使用此数组
    let d = require('cheerio').load(s.data)
    let info = new MovieInfo()
    info.index = s.other
    try{
        info.title = (d('.title_all h1 font').text().match(RegExp('《.+》')) || ept)[0]
        info.title = strRemoveAll(info.title,['《','》'])
        info.year = (d('#Zoom').html().match(RegExp('◎年　　代.*?<+')) || ept)[0]
        info.year = strRemoveAll(info.year,['◎年　　代','<',' ','　','年'])
        info.country = (d('#Zoom').html().match(RegExp('◎产　　地.*?<+')) || ept)[0]
        info.country = strRemoveAll(info.country,['◎产　　地','<',' ','　'])
        info.language = (d('#Zoom').html().match(RegExp('◎语　　言.*?<+')) || ept)[0]
        info.language = strRemoveAll(info.language,['◎语　　言','<',' ','　'])
        info.type = (d('#Zoom').html().match(RegExp('◎类　　别.*?<+')) || ept)[0]//◎类　　别　动作 / 奇幻 / 冒险
        info.type = strRemoveAll(info.type,['◎类　　别','<',' ','　'])
        info.stars = (d('#Zoom').html().match(RegExp('◎豆瓣评分.+?/')) || ept)[0] //REG:  ◎豆瓣评分.+?/    或   ◎IMDb评分.+?/ 
        if(info.stars == ept[0]){info.stars = (d('#Zoom').html().match(RegExp('◎IMDb评分.+?/')) || ept)[0]}  //没有豆瓣评分就尝试找到IMDb评分
        if(info.stars == ept[0]){info.stars='暂无评分'}
        info.stars = strRemoveAll(info.stars,['◎豆瓣评分','◎IMDb评分',' ','/','　'])
        info.plot = (d('#Zoom').html().match(RegExp('◎简　　介.+?<a')) || ept)[0]  //◎简　　介.+?<a
        info.plot = strRemoveAll(info.plot,['◎简　　介','<a','   ','  ','<br />','<br>','<br','　'])
        
        info.posturl = d('#Zoom img').attr('src')
        info.downloadurl = (d('#Zoom').html().match(RegExp('magnet:.*?"')) || ept)[0]  //magnet:.*?"
        info.downloadurl = strRemoveAll(info.downloadurl,['"',' '])
    }
    catch(e){
        console.log("在电影下载页识别电影信息时出错："+e)
        console.log(s.data)
    }
    
    
    if(info.title!=ept[0]&&info.title!='')
    {
        console.log('+添加数据，序号'+info.index+':'+info.title+'|'+info.year+'年|国家:'+info.country+'|语言:'+info.language+' 评分:'+info.stars)
        movieList.push(info);
    }
    else
    {
        console.log('-丢弃数据，序号：'+info.index)
    }
    
    loadingPoolCount--;
    _parseUrlList()
}

function _loadErr(e){
    console.log('加载页面错误'+e.data)
    console.log('附带信息'+(e.other|''))
    loadingPoolCount--;

    _parseUrlList()
}

function _parseUrlList()
{
    if(urllistremain.length==0&&loadingPoolCount==0){
        onAllInfoGetted()
        return;
    }

    if(urllistremain.length==0){
        return;
    }
    
    // 最多同时并发10个loadPage动作
    while(loadingPoolCount<loadingPoolMax&&urllistremain.length>0){
        let qm  = loadPage(urllistremain[0],true,'gb2312',urllist.length-urllistremain.length)
        qm.then(_getMovieInfo,_loadErr)
        //console.log('加载并行数:'+loadingPoolCount+',附带信息（序号）：'+(urllist.length-urllistremain.length));
        urllistremain.splice(0,1);
        loadingPoolCount++
    }

}

function onAllInfoGetted()
{
    console.log(movieList.length+"/"+urllist.length+"加载完毕！---------------------------------------------------------------------")
    movieList.sort((a,b)=>{
        return a.index - b.index ;
    })

    var fs = require('fs')
    //载入模板
    fs.readFile(htmlTemplatePath,'utf-8',(err,data)=>{
        if(data)
        {
            console.log('载入index.html成功')
            var html=data
            date=new Date()
            html=html.replace('#更新日期#',date.getFullYear()+'年'+(date.getMonth()+1)+'月'+date.getDate()+'日 '+date.getHours()+':'+date.getMinutes()+":"+date.getSeconds())
            //console.log('aaa'+html.match(/<!---模板片段开始-->.*[\d\D]*.*<!---模板片段结束-->/gm))
            var tmpl=(html.match(/<!---模板片段开始-->.*[\d\D]*.*<!---模板片段结束-->/gm)||[''])[0]
            tmpl=strRemoveAll(tmpl,['<!---模板片段开始-->','<!---模板片段结束-->','\b'])
            content=''
            //console.log('模板文件：'+tmpl)
            for(var i=0;i<movieList.length;i++)
            {
                div=tmpl
                div=div.replace('#电影名#','<small><small>'+movieList[i].index+'.</small></small>'+movieList[i].title)
                div=div.replace('#年份#',movieList[i].year)
                div=div.replace('#国家#',movieList[i].country)
                div=div.replace('#评分#',movieList[i].stars)
                div=div.replace('#类型#',movieList[i].type)
                if(movieList[i].plot.length>maxtxtlen){div=div.replace('#简介#',movieList[i].plot.substring(0,maxtxtlen)+'...')}
                else{div=div.replace('#简介#',movieList[i].plot)}
                div=div.replace('#下载地址#',movieList[i].downloadurl)
                div=div.replace('#海报链接#',movieList[i].posturl)
                content+=div
            }

            html=html.replace(tmpl,content)
            fs.writeFile(savePath,html,(err)=>{
                if(err)
                {
                    console.log('保存为index.html失败。');
                }else{
                    console.log('保存为index.html成功。')
                }
            })
            
        }
        else
        {
            console.log('读取文件'+path+'出错:'+err);
        }
    })
}


if(debugMode)
{
    //只执行一次脚本
    loadPage(movielisturl,true,'gb2312').then(_parseURLListPage,_loadErr);
}
else
{
    //自动执行脚本
    var schedule = require('node-schedule')
    //var rule = new schedule.RecurrenceRule()
    //rule.minute = [0,10,21,30,40,50]
    //rule.second = [0]
    var run = schedule.scheduleJob('0 0/10 * * * *', function(){
        loadPage(movielisturl,true,'gb2312').then(_parseURLListPage,_loadErr)
    })
}


