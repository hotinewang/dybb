# dybb 电影伴伴
电影伴伴nodejs爬虫程序
这是一个基于dytt8.net的NODEJS爬虫程序
原网站广告太多了，因此做了个爬虫，每天爬取最新的100个电影，这样可以干净清爽的浏览电影资源了。
该代码可以部署在服务器设置为定期执行，或者在pc上手动执行均可。
文件列表：
app.js主程序
default_post.png如果获取电影海报失败，会用这张图替代
index_t.html生成的电影网站的模板文件，执行app.js时，会根据该模板文件创建一个最新100部（大约）电影列表index.html。