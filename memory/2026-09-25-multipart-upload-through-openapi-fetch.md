---
date: "2026-09-25"
category: "lesson"
tags: ["api", "openapi", "upload", "typescript", "go"]
summary: "openapi-fetch 传 multipart：类型系统把二进制字段写成 string，用占位 body + bodySerializer 返回 FormData 绕过，浏览器自己带 boundary；Go 侧 schema 是裸字符串，注释里别写反引号"
---

# 二进制上传：类型系统说的和线上跑的不是一回事

上传头像要过 `POST /api/v1/me/avatar`（multipart）。OpenAPI 里写的是标准写法：

```yaml
content:
  multipart/form-data:
    schema:
      type: object
      properties:
        file:
          type: string
          format: binary
```

两边代码生成器都不认识 `format: binary` 的语义：

- **Go（oapi-codegen）** 生成 `PutMyAvatarMultipartBody{ File openapi_types.File }`，但处理函数的签名还是朴素的 `PutMyAvatar(c *gin.Context)` —— 请求体要自己 `c.FormFile("file")` 解，生成物只提供类型。
- **TypeScript（openapi-typescript）** 把二进制字段写成 `file: string`，于是 `body: { file }`（`File` 对象）直接类型报错。

真正的解法是**让 body 只是个占位、把 FormData 交给序列化器**：

```ts
const form = new FormData()
form.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))

const { data, error } = await apiClient.POST('/me/avatar', {
  // 生成的类型把二进制字段叫 string；真正上路的是下面这个 FormData
  body: { file: '' },
  bodySerializer: () => form,
})
```

两个要点：

1. `bodySerializer` 一旦返回 `FormData`，openapi-fetch 会**不设 content-type**，让浏览器自己带 boundary（看 `openapi-fetch/src/index.js` 里那句 `serializedBody instanceof FormData` 的判断）。手写 `'Content-Type': 'multipart/form-data'` 反而会缺 boundary 而失败。
2. 占位 body 用 `{ file: '' }` 就够，不需要 `as unknown as` 这种转换 —— 类型对得上，读代码的人也能看懂"这里不是真 body"。

服务端**不要信请求的 content-type**：`image.DecodeConfig` 读字节本身，用返回的 format 决定 mime 与白名单。WebP 因此被排除（标准库读不了，存下来等于没验）。真正缩小图片的工作放在浏览器（canvas 裁方 + 缩到 256×256 JPEG），服务端只验尺寸与体积 —— 这样后端不需要任何图像处理依赖。

## 附带：Go 里的 SQL 裸字符串

`db/schema.go` 用反引号裸字符串装整段 SQL。往 SQL 注释里写 `users` 这种带反引号的 Markdown 习惯写法，会**直接把 Go 字符串截断**，报的错却是 `expected ';', found users` —— 指向 SQL 文件里的行号，看着像 SQL 语法错。往裸字符串里加内容时，先搜一遍有没有反引号。
