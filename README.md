# tenx-ai-media-ui

Tenx AI 图片与视频生成控制台。部署在 Windows，与 `tenx-ai-media-service` 配合使用：Mac Studio 负责模型推理和视频帧生成，Windows 负责 FFmpeg 视频合成与媒体文件保存。

## 多分镜短剧

侧栏“多分镜短剧”支持2–12个分镜，页面每镜可选3秒或5秒，最多60秒。默认提供6个空白分镜（30秒），不预填角色或台词。

1. 填写统一角色外观/画风，可选已有角色参考图 ID；每镜分别填写动作画面。
2. 连续动作选择“接上一镜尾帧”；切换机位选择“独立生成”。首镜只能独立生成。统一参考图只用于独立镜头，本镜头参考图可覆盖它。
3. 按需开启每镜配音，导入多角色对白。对白含停顿必须短于该镜头；超时会停止，不用定格画面补时。角色姓名不朗读，不同音色需先安装对应声音。
4. 提交后可查看各镜头进度、预览单镜头、下载最终拼接 MP4。失败后可从断点继续；也可修改画面/对白/时长后保存并重新生成。
5. 单镜重生成会更新后面连续依赖其尾帧的镜头，直到下一个独立镜头为止。操作前会提示影响范围。切换图片/单镜/短剧模式会保留当前短剧草稿，但刷新或关闭页面不会保留未提交草稿，请先另行保存。

部署顺序：Mac 上新版 `tenx-ai-gateway` → Windows 新版媒体服务 → 新版 UI。旧网关不认识 `start_video_result_id`，即使只更新页面也无法进行尾帧续接。各镜头通过鉴权 HTTP 传输，不需开启 Mac 文件共享。

开发时可设置 `TENX_MEDIA_PROXY_TARGET=http://localhost:8092`，避免默认示例域名未解析导致502。多镜头生成目前固定使用 Wan2.2-TI2V-5B，单镜模式仍保留原模型选项。尾帧续接不能保证动作无缝、角色不变形，也不提供口型同步。

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

生成有声视频：保持「CosyVoice 配音」勾选，编辑逐句对白，或切换到单段旁白，再生成视频。
画面提示词不会自动作为台词朗读；默认音色为 `demo`，自定义音色需先在 CosyVoice 中安装。
配音长于画面时延长最后一帧，短于画面时补静音；不包含口型同步。预览需点击播放才能听到声音。
取消勾选可生成无声视频；历史视频不会自动补配音。

## 多角色对白

初始页面不预填画面或示例角色；“粘贴剧本”入口默认展开，也可手动添加空白对白。
导入已有对白时先确认替换，删除或替换后可撤销。逐句的情绪、语速与停顿收纳在“表演设置”。
页面按“画面 → 剧本与角色 → 试听后生成”引导，未满足连接、台词或音色条件时禁用操作并提示原因。
动态画面时长与对白时长分开说明，手机布局和桌面跟随预览均已适配。

默认使用“多角色逐句对白”：每句设置角色标签、已安装音色、情绪指令、语速与句后停顿；可增删、排序。
角色标签与情绪指令不作为台词朗读，台词中主动称呼对方的姓名则保留。
可展开“从角色名：台词剧本导入”，粘贴剧本后解析，已知“角色对白”标题会跳过，其他无法识别行会报错。
同一角色可批量绑定音色，也可逐句调整。总计最多 30 句、500 字，每句停顿 0–5000 毫秒。

“试听配音”只生成 WAV，不请求 Mac 画面；确认后再提交视频。输入或配置改变后旧试听会清除。
单段旁白模式继续保留，支持独立情绪输入。情绪效果依赖模型与参考音频，需要试听调整。

当前只安装 `demo` 时，界面会提示所有角色仍为同一音色。不同角色的真实音色需要各自的授权参考录音。
安装到 `E:\tenx-ai-media\audio\voices\<voice-id>\prompt.wav` 与 `prompt.txt` 后重启 CosyVoice 并刷新音色。

运行 `npm test` 验证剧本解析，运行 `npm run build` 验证生产构建。

## 本地开发

需要 Node.js 22.13 或更高版本（测试使用 Node 内置 TypeScript 类型擦除）。

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
