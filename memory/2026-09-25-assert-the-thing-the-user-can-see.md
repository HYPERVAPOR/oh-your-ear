
## 第二次：元素存在不等于看得见（头像 401，2026-09-25）

头像上传之后，探针断言的是 `img[src*="/api/v1/me/avatar"]` **元素存在** —— 它确实存在，于是"验证通过"。用户看到的是**破图**：`<img>` 发不出 `Authorization` 头，而 `GET /me/avatar` 只认 Bearer，所以 401。

- **图片要断言的是"渲染出来了"，不是"元素在"**：`img.complete && img.naturalWidth > 0`（再补一条 `fetch(src).status === 200`），`naturalWidth === 0` 就是破图。
- **同一类陷阱的其他样子**：`<img>` 不带 header、`<link>`/`<script>` 不带 header、CSS 里的 `url()` 不带 header —— 凡是浏览器自己发起的请求，都不会带应用层的 Bearer。
- 断言写"元素存在"时，等于断言"我插进去了"，不是断言"他能看见"。请求发出去、响应回来、像素画出来，是三件不同的事，只有最后一件是用户的事。

## 顺便：dev 下重建 api 要等约 40 秒

`compose.dev.yml` 里 api 是 `go mod download && go run ./cmd/server`（源码直跑，不是编译好的镜像），而且 `up -d` 在只有源码变化时**不会**重建容器，必须 `--force-recreate`。重建之后要等约 40 秒才监听 8080（`go mod download` + 编译），这期间 `/health` 是 000。别把这段等待当成启动失败。
