/**
 * 本脚本从电影天堂自动获取最新发布的19部电影信息，并读取top20movie.json的19部电影名称，进行对比
 * 新增的电影（限5部，可通过maxMsg设置）通过ntfy.sh推送话题为xxx（通过msgTopic设置）的通知
 * 从ntfy客户端或者https://ntfy.sh/app 订阅对应的话题即可接收通知
 * v2024-12-11
*/
const { time } = require('console')
const fs = require('fs')
const cheerio = require('cheerio')
const https = require('https')
const iconv = require('iconv-lite')

var urllist = []
var urllistremain = []
var movieList = []
var loadingPoolCount = 0
const loadingPoolMax = 200 //同时加载网页的最大数量
const maxMovies = 20  //最多读取的电影数
const maxMsg = 5 //单次最多发送的消息数
const msgTopic = 'hotine'  //要推送的话题名称
const msgServer = 'https://ntfy.sh' //ntfy服务器地址
movielisturl='https://www.dydytt.net/index.htm'
moviepageurl='https://www.dydytt.net/'
//var errorTimes = 0

var debugMode = true

class MovieInfo {
    constructor() {
        this.index = ''
        this.title = ''
        this.year = ''
        this.country = ''
        this.language = ''
        this.type = ''
        this.stars = ''
        this.plot = ''
        this.posturl = ''
        this.downloadurl = ''
    }
}

function strRemoveAll(str, regArr = []) {
    var s = str
    for (let i = 0; i < regArr.length; i++) {
        s = s.replaceAll(regArr[i], "")
    }
    return s;
}

/**
 * 发送推送消息到ntfy服务
 * @param {string} topic - 消息的主题
 * @param {string} message - 要发送的消息内容
 * @param {string} title - 消息的大标题(默认不使用大标题)
 * @param {int} [priority=3] - 消息的优先级，可以是1-5的整数，分别是最小、小、默认、大、最大
 * @param {array} [tags] - 消息的标签,字符串数组。
 * @param {array} [attach] - 附件、图片URL。
 * @param {array} [click] - 消息被点击时跳转的url。
 * @param {string} [serverUrl='https://ntfy.sh'] - ntfy服务的URL,默认为官方服务器
 */
async function sendNtfyMessage(topic, message, title = null,  priority = 3, tags = null, attach = null , click = null , serverUrl = 'https://ntfy.sh') {
    try {
      if(topic==null || message==null || priority >5 ||priority <1){
        console.error("topic、message不能为空，priority的值只能取1、2、3、4、5!");
      }
  
      // 构建请求的headers
      const headers = new Headers({
        'Content-Type': 'application/json',
      });
  
      // 创建消息Object
      const payload={topic,message,priority};
      if(title)  payload.title = title;
      if(tags) payload.tags = tags;
      if(attach) payload.attach = attach;
      if(click) payload.click = click;
  
      // 构建请求的body
      const body = JSON.stringify(payload);
      console.log('body:', body);
  
      // 发送POST请求到ntfy服务
      const response = await fetch(serverUrl, { method: 'POST', headers: headers, body: body });
  
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      // 获取响应数据
      const data = await response.json();
      console.log('Message sent successfully:', data);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

//主函数
function loadPage(url, ishttps = false, pagecode = 'UTF8', otherinfo = {}) {
    var http = ishttps ? https : require('http')
    var pm = new Promise(function (resolve, reject) {
        console.log('载入：' + url)
        http.get(url, function (res) {
            if (pagecode == 'UTF8') {
                let html = ''
                res.on('data', function (d) {
                    html += d.toString()
                })
                res.on('end', function () {
                    resolve({ 'data': html, 'other': otherinfo })
                })
            } else {
                let bufferHelper = new (require('bufferhelper'))();
                res.on('data', function (d) {
                    bufferHelper.concat(d)
                })
                res.on('end', function () {
                    resolve({ 'data': iconv.decode(bufferHelper.toBuffer(), pagecode), 'other': otherinfo })
                })
            }
        }).on('error', function (e) {
            console.log("载入页面出错" + e)
            reject({ 'data': e, 'other': otherinfo })
        });
    })
    return pm;//执行成功会跳转至_parseURLListPage函数
}

function _parseURLListPage(d) {
    let h = cheerio.load(d.data)
    urllist = []
    urllistremain = []
    movieList = []
    loadingPoolCount = 0
    let listA = h('.co_area2 .co_content2 ul a')
    if (listA.length == 0) {
        
        console.log('获取电影列表数量为0，页面信息异常：' + d.data)
        console.log('结束爬虫程序。')
        sendNtfyMessage('hotine','app_dybb_ntyf获取电影列表异常，请检查'+moviepageurl+'网站是否异常。','程序异常',3,['firefighter','电影伴伴'])
        return
    }
    for (let i = 0; i < listA.length && i < maxMovies; i++) {
        urllist.push(moviepageurl + listA[i].attribs.href)
    }
    console.log("共获取电影URL信息条数为：" + urllist.length)
    urllistremain = urllist.slice()
    _parseUrlList()
}

function _getMovieInfo(s) {
    let ept = ['-']//空数组。如果正则表达式匹配不到任何结果返回null，就使用此数组
    let d = cheerio.load(s.data)
    let info = new MovieInfo()
    info.index = s.other
    try {
        info.title = (d('.title_all h1 font').text().match(RegExp('《.+》')) || ept)[0]
        info.title = strRemoveAll(info.title, ['《', '》'])
        info.year = (d('#Zoom').html().match(RegExp('◎年　　代.*?<+')) || ept)[0]
        info.year = strRemoveAll(info.year, ['◎年　　代', '<', ' ', '　', '年'])
        info.country = (d('#Zoom').html().match(RegExp('◎产　　地.*?<+')) || ept)[0]
        info.country = strRemoveAll(info.country, ['◎产　　地', '<', ' ', '　'])
        info.language = (d('#Zoom').html().match(RegExp('◎语　　言.*?<+')) || ept)[0]
        info.language = strRemoveAll(info.language, ['◎语　　言', '<', ' ', '　'])
        info.type = (d('#Zoom').html().match(RegExp('◎类　　别.*?<+')) || ept)[0]
        info.type = strRemoveAll(info.type, ['◎类　　别', '<', ' ', '　'])
        info.stars = (d('#Zoom').html().match(RegExp('◎豆瓣评分.+?/')) || ept)[0]
        if (info.stars == ept[0]) { info.stars = (d('#Zoom').html().match(RegExp('◎IMDb评分.+?/')) || ept)[0] }
        if (info.stars == ept[0]) { info.stars = '暂无评分' }
        info.stars = strRemoveAll(info.stars, ['◎豆瓣评分', '◎IMDb评分', ' ', '/', '　','&nbsp;'])
        info.plot = (d('#Zoom').html().match(RegExp('◎简　　介.+?<a')) || ept)[0]
        //info.plot = strRemoveAll(info.plot, ['◎简　　介', '<a', '   ', '  ', '<br />', '<br>', '<br', '　'])
        info.plot = strRemoveAll(info.plot, ['◎简　　介', '<a', '   ', '  ', '　'])
        
        //移除简介中的html标签
        let tempHtml = cheerio.load(info.plot);
        tempHtml('style').remove();
        info.plot = tempHtml('body').text();

        info.posturl = d('#Zoom img').attr('src')
        info.downloadurl = (d('#Zoom').html().match(RegExp('magnet:.*?"')) || ept)[0]
        info.downloadurl = strRemoveAll(info.downloadurl, ['"', ' '])
    } catch (e) {
        console.log("在电影下载页识别电影信息时出错：" + e)
        console.log(s.data)
    }

    if (info.title != ept[0] && info.title != '') {
        console.log('+添加数据，序号' + info.index + ':' + info.title + '|' + info.year + '年|国家:' + info.country + '|语言:' + info.language + ' 评分:' + info.stars)
        movieList.push(info);
    } else {
        console.log('-丢弃数据，序号：' + info.index)
    }

    loadingPoolCount--;
    _parseUrlList()
}

function _loadErr(e) {
    console.log('加载页面错误' + e.data)
    console.log('附带信息' + (e.other || ''))
    loadingPoolCount--;

    _parseUrlList()
}

//根据电影列表数组，获取每一个电影的信息。
function _parseUrlList() {
    if (urllistremain.length == 0 && loadingPoolCount == 0) {
        onAllInfoGetted()
        return;
    }

    if (urllistremain.length == 0) {
        return;
    }

    while (loadingPoolCount < loadingPoolMax && urllistremain.length > 0) {
        let qm = loadPage(urllistremain[0], true, 'gb2312', urllist.length - urllistremain.length)
        qm.then(_getMovieInfo, _loadErr)
        urllistremain.splice(0, 1);
        loadingPoolCount++
    }
}

function onAllInfoGetted() {
    console.log(movieList.length + "/" + urllist.length + "加载完毕！---------------------------------------------------------------------")
    movieList.sort((a, b) => {
        return a.index - b.index;
    })

    // 读取旧的电影列表
    let oldMovieTitles = []
    try {
        const data = fs.readFileSync('top20movie.json', 'utf-8')
        oldMovieTitles = JSON.parse(data)
    } catch (err) {
        console.log('读取top20movie.json出错（使用空数组）:', err)
    }

    // 找出新增的电影
    const newMovieList = movieList.filter(newMovie => !oldMovieTitles.includes(newMovie.title))
    console.log('新增电影'+newMovieList.length+'个：')
    console.log(newMovieList)

    // 保存新的电影列表到top20movie.json
    fs.writeFileSync('top20movie.json', JSON.stringify(movieList.map(movie => movie.title), null, 2), 'utf-8')
    console.log('保存为top20movie.json成功。')
    console.log('----------------------------------------------------------------------------')


    //发送电影通知
    if(newMovieList.length>0)
    {
        for (let i = 0; i < newMovieList.length && i < maxMsg ; i++) 
        {
            //console.log('+添加数据，序号' + info.index + ':' + info.title + '|' + info.year + '年|国家:' + info.country + '|语言:' + info.language + ' 评分:' + info.stars)
            sendNtfyMessage(msgTopic,
                newMovieList[i].year + '年|国家:' + newMovieList[i].country + '|语言:' + newMovieList[i].language + '|评分:' + newMovieList[i].stars + '\n' + newMovieList[i].plot,
                '新片：'+newMovieList[i].title,
                3,
                ['film_strip','电影伴伴'],
                newMovieList[i].posturl,
                newMovieList[i].downloadurl,
                msgServer
            )
        }
    }
}


/**
 * 如果单独部署，
 * 先把debugMode改为false
 * 程序定时自动运行，需要forever进程守护
 * 全局安装
 * npm install forever -g
 * 之后定位到app_dybb_ntfy.js所在文件夹后，开启进程守护
 * forever start app_dybb_ntfy.js
 * 即可
 * 
 * 
 * 如果是用青龙面包等自动跑脚本，则直接debugMode改为true即可
 */
if (debugMode) {
    loadPage(movielisturl, true, 'gb2312').then(_parseURLListPage, _loadErr);
} else {
    const schedule = require('node-schedule')
    const run = schedule.scheduleJob('0 0/10 * * * *', function () {
        loadPage(movielisturl, true, 'gb2312').then(_parseURLListPage, _loadErr)
    })
}