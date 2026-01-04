# 09. 媒体和文件

> Matrix JS SDK 媒体上传、下载、处理等功能

## 目录
- [上传文件](#上传文件)
- [下载文件](#下载文件)
- [媒体 URL 处理](#媒体-url-处理)
- [缩略图](#缩略图)
- [媒体缓存](#媒体缓存)
- [完整示例](#完整示例)

## 上传文件

### 基本文件上传

```typescript
import * as sdk from "matrix-js-sdk";

// 上传文件
const file = new File(["content"], "example.txt", {
  type: "text/plain"
});

const mxcUrl = await client.uploadContent(file, {
  name: "example.txt",
  type: "text/plain"
});

console.log("Uploaded to:", mxcUrl);
// mxcUrl 格式: "mxc://server.com/mediaId"
```

### 上传图片

```typescript
// 上传图片文件
const imageFile = new File([blob], "image.jpg", {
  type: "image/jpeg"
});

// 获取图片尺寸
const dimensions = await getImageDimensions(imageFile);

const mxcUrl = await client.uploadContent(imageFile, {
  name: "image.jpg",
  type: "image/jpeg",
  // 可选的原始文件名
  rawResponse: false
});

// 发送图片消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.image",
  url: mxcUrl,
  body: "image.jpg",
  info: {
    h: dimensions.height,
    w: dimensions.width,
    mimetype: "image/jpeg",
    size: imageFile.size
  }
});

// 获取图片尺寸的辅助函数
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
```

### 上传视频

```typescript
// 上传视频文件
const videoFile = new File([blob], "video.mp4", {
  type: "video/mp4"
});

// 获取视频元数据
const metadata = await getVideoMetadata(videoFile);

const mxcUrl = await client.uploadContent(videoFile, {
  name: "video.mp4",
  type: "video/mp4"
});

// 发送视频消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.video",
  url: mxcUrl,
  body: "video.mp4",
  info: {
    duration: metadata.duration,
    h: metadata.height,
    w: metadata.width,
    mimetype: "video/mp4",
    size: videoFile.size
  }
});

// 获取视频元数据
async function getVideoMetadata(file: File): Promise<{
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: video.duration * 1000,
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
}
```

### 上传音频

```typescript
// 上传音频文件
const audioFile = new File([blob], "audio.mp3", {
  type: "audio/mpeg"
});

// 获取音频时长
const duration = await getAudioDuration(audioFile);

const mxcUrl = await client.uploadContent(audioFile, {
  name: "audio.mp3",
  type: "audio/mpeg"
});

// 发送音频消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.audio",
  url: mxcUrl,
  body: "audio.mp3",
  info: {
    duration: duration,
    mimetype: "audio/mpeg",
    size: audioFile.size
  }
});

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration * 1000);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load audio"));
    };

    audio.src = url;
  });
}
```

### 监控上传进度

```typescript
// 监控上传进度
async function uploadWithProgress(
  client: sdk.MatrixClient,
  file: File,
  options: any
): Promise<string> {
  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        console.log(`Upload progress: ${percentComplete.toFixed(2)}%`);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.content_uri);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    // 使用 XHR 上传
    const uploadUrl = `${client.getBaseUrl()}/_matrix/media/v3/upload`;
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${client.getAccessToken()}`);

    const formData = new FormData();
    formData.append("file", file);

    if (options?.name) {
      formData.append("filename", options.name);
    }

    xhr.send(formData);
  });
}

// 使用
try {
  const mxcUrl = await uploadWithProgress(client, file, {
    name: "document.pdf"
  });
  console.log("Uploaded:", mxcUrl);
} catch (error) {
  console.error("Upload failed:", error);
}
```

### 批量上传

```typescript
// 批量上传文件
async function uploadMultipleFiles(
  client: sdk.MatrixClient,
  files: File[]
): Promise<Map<File, string>> {
  const results = new Map<File, string>();
  const errors = new Map<File, Error>();

  for (const file of files) {
    try {
      const mxcUrl = await client.uploadContent(file, {
        name: file.name,
        type: file.type
      });
      results.set(file, mxcUrl);
    } catch (error) {
      errors.set(file, error as Error);
    }
  }

  console.log(`Uploaded ${results.size}/${files.length} files`);
  if (errors.size > 0) {
    console.error(`${errors.size} files failed to upload`);
  }

  return results;
}

// 使用
const files = [file1, file2, file3];
const uploaded = await uploadMultipleFiles(client, files);
```

## 下载文件

### 基本文件下载

```typescript
// 下载文件
const mxcUrl = "mxc://server.com/mediaId";
const httpUrl = client.mxcUrlToHttp(mxcUrl);

const response = await fetch(httpUrl);
const blob = await response.blob();

console.log("Downloaded file size:", blob.size);
```

### 下载并保存

```typescript
// 下载并保存文件
async function downloadAndSave(mxcUrl: string, filename: string) {
  const httpUrl = client.mxcUrlToHttp(mxcUrl);
  const response = await fetch(httpUrl);
  const blob = await response.blob();

  // 创建下载链接
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// 使用
await downloadAndSave("mxc://server.com/mediaId", "document.pdf");
```

### 带认证的下载

```typescript
// 使用认证令牌下载私有媒体
async function downloadAuthenticatedMedia(
  client: sdk.MatrixClient,
  mxcUrl: string
): Promise<Blob> {
  // 生成带认证的 URL
  const httpUrl = client.mxcUrlToHttp(
    mxcUrl,
    undefined,  // width
    undefined,  // height
    undefined,  // resize method
    false,      // allow direct links
    true,       // allow redirects
    true        // use authentication
  );

  const response = await fetch(httpUrl, {
    headers: {
      "Authorization": `Bearer ${client.getAccessToken()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  return await response.blob();
}
```

### 下载文本内容

```typescript
// 下载文本内容
async function downloadText(mxcUrl: string): Promise<string> {
  const httpUrl = client.mxcUrlToHttp(mxcUrl);
  const response = await fetch(httpUrl);
  const text = await response.text();
  return text;
}

// 使用
const text = await downloadText("mxc://server.com/mediaId");
console.log("Text content:", text);
```

## 媒体 URL 处理

### MXC 转 HTTP URL

```typescript
// 基本转换
const mxcUrl = "mxc://server.com/mediaId";
const httpUrl = client.mxcUrlToHttp(mxcUrl);

console.log("HTTP URL:", httpUrl);
// "https://server.com/_matrix/media/v3/download/server.com/mediaId"
```

### 缩略图 URL

```typescript
// 生成缩略图 URL
const mxcUrl = "mxc://server.com/mediaId";
const thumbnailUrl = client.mxcUrlToHttp(
  mxcUrl,
  128,    // width
  128,    // height
  "scale",  // resize method: "crop", "scale"
  false,  // allow direct links
  true    // allow redirects
);

console.log("Thumbnail URL:", thumbnailUrl);
```

### URL 转换选项

```typescript
// 完整的 URL 转换选项
const httpUrl = client.mxcUrlToHttp(
  mxcUrl,
  width = undefined,
  height = undefined,
  resizeMethod = undefined,  // "crop" | "scale"
  allowDirectLinks = false,
  allowRedirects = true,
  useAuthentication = false
);

// 参数说明:
// - width: 图片宽度（像素）
// - height: 图片高度（像素）
// - resizeMethod: 调整大小的方法
//   - "crop": 裁剪到指定尺寸
//   - "scale": 缩放到指定尺寸
// - allowDirectLinks: 如果为 true，可能返回直接链接而非下载链接
// - allowRedirects: 如果为 true，允许重定向
// - useAuthentication: 如果为 true，URL 将包含认证参数
```

### HTTP 转 MXC

```typescript
// 从 HTTP URL 提取 MXC URL
function httpToMxc(httpUrl: string): string | null {
  const url = new URL(httpUrl);
  const parts = url.pathname.split("/");

  // 格式: /_matrix/media/v3/download/serverName/mediaId
  if (parts.includes("download")) {
    const serverName = parts[parts.length - 2];
    const mediaId = parts[parts.length - 1];
    return `mxc://${serverName}/${mediaId}`;
  }

  return null;
}

// 使用
const mxcUrl = httpToMxc("https://server.com/_matrix/media/v3/download/server.com/mediaId");
console.log("MXC URL:", mxcUrl);
```

## 缩略图

### 获取多个缩略图尺寸

```typescript
// 为图片生成多个尺寸的缩略图 URL
function getThumbnailUrls(
  client: sdk.MatrixClient,
  mxcUrl: string
): Record<string, string> {
  return {
    small: client.mxcUrlToHttp(mxcUrl, 32, 32, "crop"),
    medium: client.mxcUrlToHttp(mxcUrl, 96, 96, "crop"),
    large: client.mxcUrlToHttp(mxcUrl, 320, 320, "scale"),
    xlarge: client.mxcUrlToHttp(mxcUrl, 640, 640, "scale")
  };
}

// 使用
const mxcUrl = "mxc://server.com/mediaId";
const thumbnails = getThumbnailUrls(client, mxcUrl);

console.log("Small thumbnail:", thumbnails.small);
console.log("Medium thumbnail:", thumbnails.medium);
```

### 响应式图片加载

```typescript
// 根据屏幕尺寸加载合适的缩略图
async function loadResponsiveImage(
  client: sdk.MatrixClient,
  mxcUrl: string,
  containerWidth: number
): Promise<HTMLImageElement> {
  // 根据容器宽度选择合适的缩略图尺寸
  let thumbnailSize: number;

  if (containerWidth <= 100) {
    thumbnailSize = 64;
  } else if (containerWidth <= 300) {
    thumbnailSize = 128;
  } else if (containerWidth <= 600) {
    thumbnailSize = 256;
  } else {
    thumbnailSize = 512;
  }

  const thumbnailUrl = client.mxcUrlToHttp(
    mxcUrl,
    thumbnailSize,
    thumbnailSize,
    "scale"
  );

  // 加载图片
  const img = new Image();
  img.src = thumbnailUrl;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  return img;
}

// 使用
const container = document.getElementById("imageContainer");
const img = await loadResponsiveImage(
  client,
  "mxc://server.com/mediaId",
  container.offsetWidth
);

container.appendChild(img);
```

### 懒加载图片

```typescript
// 懒加载图片组件
class LazyImage {
  private loaded = false;
  private element: HTMLImageElement;

  constructor(
    private client: sdk.MatrixClient,
    private mxcUrl: string,
    private options: {
      width?: number;
      height?: number;
      method?: "crop" | "scale";
      placeholder?: string;
    } = {}
  ) {
    this.element = document.createElement("img");
    this.setup();
  }

  private setup() {
    // 设置占位符
    if (this.options.placeholder) {
      this.element.src = this.options.placeholder;
    }

    // 使用 Intersection Observer 检测可见性
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.loaded) {
            this.load();
            observer.disconnect();
          }
        });
      },
      { rootMargin: "50px" }
    );

    observer.observe(this.element);
  }

  private async load() {
    if (this.loaded) return;

    try {
      const thumbnailUrl = this.client.mxcUrlToHttp(
        this.mxcUrl,
        this.options.width,
        this.options.height,
        this.options.method
      );

      await new Promise((resolve, reject) => {
        this.element.onload = resolve;
        this.element.onerror = reject;
        this.element.src = thumbnailUrl;
      });

      this.loaded = true;
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  }

  getElement(): HTMLImageElement {
    return this.element;
  }
}

// 使用
const lazyImage = new LazyImage(client, "mxc://server.com/mediaId", {
  width: 200,
  height: 200,
  method: "crop",
  placeholder: "/placeholder.png"
});

document.body.appendChild(lazyImage.getElement());
```

## 媒体缓存

### 缓存图片

```typescript
// 简单的内存缓存
class MediaCache {
  private cache = new Map<string, Blob>();

  async get(
    client: sdk.MatrixClient,
    mxcUrl: string,
    thumbnailOptions?: { width?: number; height?: number; method?: "crop" | "scale" }
  ): Promise<Blob> {
    // 检查缓存
    const cacheKey = this.getCacheKey(mxcUrl, thumbnailOptions);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 下载媒体
    const httpUrl = client.mxcUrlToHttp(
      mxcUrl,
      thumbnailOptions?.width,
      thumbnailOptions?.height,
      thumbnailOptions?.method
    );

    const response = await fetch(httpUrl);
    const blob = await response.blob();

    // 存入缓存
    this.cache.set(cacheKey, blob);

    return blob;
  }

  private getCacheKey(
    mxcUrl: string,
    options?: { width?: number; height?: number; method?: string }
  ): string {
    const opts = options ? JSON.stringify(options) : "";
    return `${mxcUrl}:${opts}`;
  }

  clear() {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// 使用
const mediaCache = new MediaCache();
const blob = await mediaCache.get(client, "mxc://server.com/mediaId", {
  width: 128,
  height: 128,
  method: "crop"
});
```

### IndexedDB 缓存

```typescript
// 使用 IndexedDB 持久化缓存
class PersistentMediaCache {
  private db: IDBDatabase | null = null;

  async init(dbName = "mediaCache", version = 1) {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("media")) {
          const store = db.createObjectStore("media", { keyPath: "url" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  async put(url: string, blob: Blob): Promise<void> {
    if (!this.db) {
      throw new Error("Cache not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["media"], "readwrite");
      const store = transaction.objectStore("media");

      const request = store.put({
        url,
        blob,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(url: string): Promise<Blob | undefined> {
    if (!this.db) {
      throw new Error("Cache not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["media"], "readonly");
      const store = transaction.objectStore("media");
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.blob);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error("Cache not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["media"], "readwrite");
      const store = transaction.objectStore("media");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

## 完整示例

### 完整的媒体管理器

```typescript
import * as sdk from "matrix-js-sdk";

interface UploadOptions {
  name?: string;
  type?: string;
  onProgress?: (percent: number) => void;
}

interface DownloadOptions {
  thumbnail?: {
    width: number;
    height: number;
    method?: "crop" | "scale";
  };
  useAuth?: boolean;
}

class MediaManager {
  private cache = new Map<string, Blob>();

  constructor(private client: sdk.MatrixClient) {}

  // 上传文件
  async upload(file: File, options?: UploadOptions): Promise<string> {
    const mxcUrl = await this.client.uploadContent(file, {
      name: options?.name || file.name,
      type: options?.type || file.type
    });

    return mxcUrl;
  }

  // 上传并监控进度
  async uploadWithProgress(
    file: File,
    options?: UploadOptions
  ): Promise<string> {
    const accessToken = this.client.getAccessToken();
    const baseUrl = this.client.getBaseUrl();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && options?.onProgress) {
          const percent = (event.loaded / event.total) * 100;
          options.onProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.content_uri);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("POST", `${baseUrl}/_matrix/media/v3/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

      const formData = new FormData();
      formData.append("file", file);

      if (options?.name) {
        formData.append("filename", options.name);
      }

      xhr.send(formData);
    });
  }

  // 下载文件
  async download(mxcUrl: string, options?: DownloadOptions): Promise<Blob> {
    const cacheKey = this.getCacheKey(mxcUrl, options);

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 生成 HTTP URL
    const httpUrl = this.client.mxcUrlToHttp(
      mxcUrl,
      options?.thumbnail?.width,
      options?.thumbnail?.height,
      options?.thumbnail?.method,
      false,
      true,
      options?.useAuth
    );

    // 下载
    const fetchOptions: RequestInit = {};
    if (options?.useAuth) {
      fetchOptions.headers = {
        "Authorization": `Bearer ${this.client.getAccessToken()}`
      };
    }

    const response = await fetch(httpUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();

    // 缓存结果
    this.cache.set(cacheKey, blob);

    return blob;
  }

  // 获取缩略图 URL
  getThumbnailUrl(
    mxcUrl: string,
    width: number,
    height: number,
    method: "crop" | "scale" = "scale"
  ): string {
    return this.client.mxcUrlToHttp(mxcUrl, width, height, method);
  }

  // 清除缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取缓存大小
  getCacheSize(): number {
    return this.cache.size;
  }

  private getCacheKey(mxcUrl: string, options?: DownloadOptions): string {
    if (!options?.thumbnail) {
      return mxcUrl;
    }

    return `${mxcUrl}:${options.thumbnail.width}:${options.thumbnail.height}:${options.thumbnail.method}`;
  }
}

// 使用示例
async function example() {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: "token",
    userId: "@user:matrix.org"
  });

  const mediaManager = new MediaManager(client);

  // 上传文件
  const file = new File(["Hello, World!"], "test.txt", {
    type: "text/plain"
  });

  const mxcUrl = await mediaManager.upload(file);
  console.log("Uploaded:", mxcUrl);

  // 下载文件
  const blob = await mediaManager.download(mxcUrl);
  console.log("Downloaded:", blob.size, "bytes");

  // 获取缩略图 URL
  const thumbnailUrl = mediaManager.getThumbnailUrl(mxcUrl, 128, 128, "crop");
  console.log("Thumbnail:", thumbnailUrl);

  // 清除缓存
  mediaManager.clearCache();
}

example();
```
