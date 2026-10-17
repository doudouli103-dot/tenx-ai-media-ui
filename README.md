# tenx-ai-media-ui

Tenx AI 图片与视频生成控制台。部署在 Windows，与 `tenx-ai-media-service` 配合使用：Mac Studio 负责模型推理和视频帧生成，Windows 负责 FFmpeg 视频合成与媒体文件保存。

## 功能

- Media Service 健康状态和外接硬盘可用性检查
- `qwen-image`、`flux-dev` 图片生成与受保护结果下载
- `Wan2.2-TI2V-5B`、`HunyuanVideo-1.5` 视频任务提交
- 短剧项目、场景和镜头标识，以及可复现 Seed
- 将已生成图片直接设为 Wan 2.2 镜头首帧
- 展示 Windows 通过鉴权 HTTP 下载帧的任务阶段
- CosyVoice 台词/旁白配音、音色 ID 与语速设置，MP4 同时包含画面和声音
- 视频任务列表、自动轮询、阶段状态和错误展示
- 通过鉴权请求预览、下载图片和 MP4
- API Key 仅保存到浏览器当前会话
- 响应式桌面与移动端界面

生成有声视频：保持「CosyVoice 配音」勾选，在独立配音文本框填写台词/旁白，再生成视频。
画面提示词不会自动作为台词朗读；默认音色为 `demo`，自定义音色需先在 CosyVoice 中安装。
配音长于画面时延长最后一帧，短于画面时补静音；不包含口型同步。预览需点击播放才能听到声音。
取消勾选可生成无声视频；历史视频不会自动补配音。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
cp .env.example .env.local
npm install
npm run dev
```

开发地址：`http://localhost:5175`

Vite 会把 `/media-api/*` 转发至 `TENX_MEDIA_PROXY_TARGET`，默认目标是：

```text
http://windows.tentest.cn:8092
```

## Windows 生产部署

```powershell
npm install
npm run build
```

将 `dist` 目录交给 Nginx 托管。项目中的 `nginx.conf.example` 同时完成：

- UI 静态资源：`http://windows.tentest.cn:5175`
- `/media-api/*` 反向代理至本机 `tenx-ai-media-service:8092`

使用同源代理后无需在 Media Service 中开放浏览器 CORS。

## Docker 部署

在父目录 `tenx-ai-project` 中运行：

```powershell
Copy-Item .env.media.example .env
docker compose -f docker-compose.media.yml up -d --build
```

默认访问地址为 `http://localhost:5281`。本机 Windows 保留了 5154–5253 端口段，
原端口 5181 无法由 Docker 绑定；使用 5281 也可避免与同机的
`tenx-ai-webui` 默认端口 5175 冲突；可通过 `.env` 中的 `TENX_MEDIA_UI_PORT` 修改。

## 连接设置

首次打开页面时填写：

```text
服务地址：/media-api
API Key：TENX_MEDIA_API_KEYS 中配置的一项
```

API Key 使用 `sessionStorage`，关闭浏览器会话后自动清除，不会写入项目文件或构建产物。

## 依赖服务

```text
tenx-ai-media-ui:5175
  -> tenx-ai-media-service:8092 (Windows)
      -> tenx-ai-gateway:8088 (Mac Studio)
          -> ComfyUI:8188
```
