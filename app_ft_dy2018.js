var debugMode=true

//电影列表的URL和备用URL
var movielisturl='https://www.dy2018.com/'
var movielisturl_backup='https://www.dytt89.com/'

//最大爬几页的内容
var maxPagesCount=3


/
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

//从字符串str中移除regArr数组中指定的全部字符串。
function strRemoveAll(str,regArr=[])
{
    var s=str
    for(let i=0;i<=regArr.length;i++)
    {
        s=s.replaceAll(regArr[i],"")
    }
    return s;
}

loadMovieListPage()
{

}