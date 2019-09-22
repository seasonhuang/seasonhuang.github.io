const server = require('server');
const { get } = server.router;
const { render, cookie, header } = server.reply;

const setCookie = ctx => cookie('foo', 'bar').send();

server({
  port: 8080,
  engine: 'handlebars',
  views: './',
  env: 'test',
  log: 'debug',
}, [
  get('/load_html_test', ctx => {
    return cookie('is_http_only', '1', { expires: new Date(Date.now() + 900000), httpOnly: true })
    .cookie('not_http_only', '1', { expires: new Date(Date.now() + 900000) })
    .header({
      'Content-Security-Policy': `script-src 'self' 'unsafe-inline'`,
    })
    .render('./load_html_test.html', {
      serverRecvCookie: ctx.cookies,
      serverSentCookie: {is_http_only: 1, not_http_only: 1},
    })
  }),
  get('/favicon.ico', ctx => ''),
])

// const Koa = require('koa');
// const app = new Koa();

// app.listen(8080);
