# Matrix SDK - 位置共享 (Location Sharing)

**文档版本**: 1.0.0
**SDK 版本**: 30.0.0+
**最后更新**: 2026-01-04
**相关规范**: [MSC 3488 - Location Sharing](https://github.com/matrix-org/matrix-spec-proposals/pull/3672)

---

## 概述

Matrix SDK 支持**位置共享（Location Sharing）**功能，允许用户：

- ✅ **发送位置消息** - 分享静态位置（坐标、描述）
- ✅ **实时位置追踪（Beacon）** - 持续共享实时位置
- ✅ **位置生命周期管理** - 控制位置共享的时长和状态
- ✅ **多个位置源** - 支持多个用户同时共享位置

---

## 核心概念

### 位置消息类型

| 类型 | 事件类型 | 描述 |
|------|---------|------|
| 静态位置 | `m.room.message` (msgtype: `m.location`) | 单次位置分享 |
| 位置信息 | `m.beacon_info` | 定义信标的元数据（持续时间、描述） |
| 位置数据 | `m.beacon` | 实际的位置坐标数据 |

### Beacon 类

SDK 提供 `Beacon` 类来管理位置信标：

```typescript
import { Beacon, BeaconEvent } from "matrix-js-sdk";

// Beacon 事件
enum BeaconEvent {
    New = "Beacon.new",                    // 新建信标
    Update = "Beacon.update",              // 信标更新
    LivenessChange = "Beacon.LivenessChange", // 存活状态变化
    Destroy = "Beacon.Destroy",            // 信标销毁
    LocationUpdate = "Beacon.LocationUpdate", // 位置更新
}
```

---

## 发送静态位置

### 发送位置消息

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({ ... });
const roomId = "!roomId:server.com";

// 发送静态位置
await client.sendEvent(roomId, "m.room.message", {
    msgtype: "m.location",
    body: "Alice's Location",
    geo_uri: "geo:37.7749,-122.4194", // 格式: geo:latitude,longitude
    location: {
        uri: "geo:37.7749,-122.4194",
        description: "San Francisco, CA",
    },
    // 可选：添加缩略图
    info: {
        thumbnail_url: "mxc://server.com/abc123",
        thumbnail_info: {
            mimetype: "image/jpeg",
            w: 256,
            h: 256,
            size: 12345,
        },
    },
});
```

### 带额外信息的静态位置

```typescript
await client.sendEvent(roomId, "m.room.message", {
    msgtype: "m.location",
    body: "Meeting Point",
    geo_uri: "geo:51.5074,-0.1278", // 伦敦
    location: {
        uri: "geo:51.5074,-0.1278",
        description: "Starbucks, Piccadilly Circus",
    },
    // 添加额外的组织信息
    "org.matrix.msc3488.location": {
        description: "Starbucks",
        zoom_level: 15,
        asset_type: "m.pin",
    },
});
```

---

## 创建位置信标（Beacon）

### 1. 创建 Beacon Info 事件

```typescript
const roomId = "!roomId:server.com";
const userId = "@user:server.com";
const beaconInfoId = `$${Date.now()}`; // 唯一 ID

// 创建信标信息（定义信标的元数据）
await client.sendStateEvent(
    roomId,
    "m.beacon_info",
    {
        description: "Alice's Live Location",
        timeout: 3600000, // 持续时间（毫秒）：1 小时
        live: true,
        start: Date.now(), // 开始时间戳
        // MSC 格式
        "org.matrix.msc3488.beacon_info": {
            description: "Alice's Live Location",
            timeout: 3600000,
            live: true,
        },
    },
    `${userId}:${beaconInfoId}` // state_key 格式: userId:beaconId
);
```

### 2. 发送位置数据

```typescript
// 发送实际的位置坐标
await client.sendEvent(roomId, "m.beacon", {
    "org.matrix.msc3488.location": {
        uri: "geo:37.7749,-122.4194", // 当前位置
        description: "Near Golden Gate Park",
    },
    // 坐标信息
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10, // 可选：海拔（米）
    // 精度信息
    accuracy: 10, // 水平精度（米）
    // 时间戳
    timestamp: Date.now(),
});
```

---

## 管理 Beacon 对象

### 创建 Beacon 实例

```typescript
import { Beacon, BeaconInfoState } from "matrix-js-sdk";

// 从房间获取 Beacon
const room = client.getRoom(roomId);
const beaconInfoEvents = room.currentState.getStateEvents("m.beacon_info");

const beacon = new Beacon(beaconInfoEvents[0]);

// 获取信标信息
console.log("信标 ID:", beacon.identifier);
console.log("所有者:", beacon.beaconInfoOwner);
console.log("描述:", beacon.beaconInfo?.description);
console.log("是否存活:", beacon.isLive);

// 启动存活监控
beacon.monitorLiveness();
```

### 监听 Beacon 事件

```typescript
// 监听信标更新
beacon.on(BeaconEvent.Update, (event, beacon) => {
    console.log("信标已更新:", beacon.beaconInfo);
});

// 监听存活状态变化
beacon.on(BeaconEvent.LivenessChange, (isLive, beacon) => {
    console.log("信标状态:", isLive ? "存活" : "过期");
});

// 监听位置更新
beacon.on(BeaconEvent.LocationUpdate, (locationState) => {
    console.log("新位置:", {
        latitude: locationState.latitude,
        longitude: locationState.longitude,
        timestamp: locationState.timestamp,
    });
});

// 监听信标销毁
beacon.on(BeaconEvent.Destroy, (beaconId) => {
    console.log("信标已销毁:", beaconId);
});
```

### 添加位置更新

```typescript
// 处理位置事件数组
const locationEvents = room
    .getLiveTimeline()
    .getEvents()
    .filter((e) => e.getType() === "m.beacon");

// 添加位置到 Beacon
beacon.addLocations(locationEvents);

// 获取最新位置
const latestLocation = beacon.latestLocationState;
if (latestLocation) {
    console.log("最新位置:", {
        uri: latestLocation.uri,
        description: latestLocation.description,
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
    });
}
```

---

## 完整示例：实时位置共享

```typescript
import * as sdk from "matrix-js-sdk";

class LocationSharingManager {
    private watchId: number | null = null;
    private beaconInterval: ReturnType<typeof setInterval> | null = null;

    constructor(private client: sdk.MatrixClient) {}

    /**
     * 开始共享实时位置
     */
    async startLiveSharing(
        roomId: string,
        options: {
            description?: string;
            duration?: number; // 持续时间（毫秒）
            updateInterval?: number; // 更新间隔（毫秒）
        } = {}
    ): Promise<void> {
        const {
            description = "My Location",
            duration = 3600000, // 默认 1 小时
            updateInterval = 30000, // 默认 30 秒
        } = options;

        // 1. 创建信标信息
        const userId = this.client.getUserId()!;
        const beaconInfoId = `$${Date.now()}`;
        const stateKey = `${userId}:${beaconInfoId}`;

        await this.client.sendStateEvent(
            roomId,
            "m.beacon_info",
            {
                description,
                timeout: duration,
                live: true,
                start: Date.now(),
            },
            stateKey
        );

        // 2. 获取当前位置并发送
        await this.sendCurrentLocation(roomId, stateKey);

        // 3. 设置定期更新
        this.beaconInterval = setInterval(async () => {
            await this.sendCurrentLocation(roomId, stateKey);
        }, updateInterval);

        // 4. 设置自动停止
        setTimeout(() => {
            this.stopLiveSharing(roomId, stateKey);
        }, duration);
    }

    /**
     * 发送当前位置
     */
    private async sendCurrentLocation(
        roomId: string,
        stateKey: string
    ): Promise<void> {
        const position = await this.getCurrentPosition();
        if (!position) return;

        await this.client.sendEvent(roomId, "m.beacon", {
            "org.matrix.msc3488.location": {
                uri: `geo:${position.latitude},${position.longitude}`,
                description: "Current Location",
            },
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
            timestamp: Date.now(),
        });
    }

    /**
     * 获取当前位置
     */
    private getCurrentPosition(): Promise<GeolocationPosition | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => {
                    console.error("获取位置失败:", error);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                }
            );
        });
    }

    /**
     * 停止实时位置共享
     */
    async stopLiveSharing(roomId: string, stateKey: string): Promise<void> {
        // 清除定时器
        if (this.beaconInterval) {
            clearInterval(this.beaconInterval);
            this.beaconInterval = null;
        }

        // 停止位置监听
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // 停止信标
        await this.client.sendStateEvent(
            roomId,
            "m.beacon_info",
            {
                live: false,
            },
            stateKey
        );
    }

    /**
     * 获取房间中的所有信标
     */
    getActiveBeacons(roomId: string): sdk.Beacon[] {
        const room = this.client.getRoom(roomId);
        if (!room) return [];

        const beaconInfoEvents = room.currentState.getStateEvents("m.beacon_info");
        return beaconInfoEvents
            .filter((event) => event.getContent()?.live)
            .map((event) => new sdk.Beacon(event));
    }

    /**
     * 监听其他用户的位置更新
     */
    watchUserLocations(
        roomId: string,
        callback: (userId: string, location: sdk.BeaconLocationState) => void
    ): () => void {
        const room = this.client.getRoom(roomId);
        if (!room) return () => {};

        const beacons = this.getActiveBeacons(roomId);
        const handlers: Array<() => void> = [];

        beacons.forEach((beacon) => {
            const handler = () => {
                if (beacon.latestLocationState) {
                    callback(beacon.beaconInfoOwner, beacon.latestLocationState);
                }
            };

            beacon.on(sdk.BeaconEvent.LocationUpdate, handler);
            beacon.monitorLiveness();

            handlers.push(() => {
                beacon.off(sdk.BeaconEvent.LocationUpdate, handler);
            });
        });

        // 返回清理函数
        return () => {
            handlers.forEach((cleanup) => cleanup());
        };
    }
}

// 使用示例
const client = sdk.createClient({ ... });
const locationManager = new LocationSharingManager(client);

// 开始共享位置
await locationManager.startLiveSharing("!roomId:server.com", {
    description: "我的实时位置",
    duration: 1800000, // 30 分钟
    updateInterval: 15000, // 每 15 秒更新
});

// 监听其他用户的位置
const unwatch = locationManager.watchUserLocations(
    "!roomId:server.com",
    (userId, location) => {
        console.log(`${userId} 的位置:`, {
            latitude: location.latitude,
            longitude: location.longitude,
            uri: location.uri,
        });
    }
);

// 停止监听
// unwatch();
```

---

## 监听位置事件

### 监听新位置消息

```typescript
// 监听位置消息
client.on(sdk.RoomEvent.Timeline, (event, room) => {
    if (event.getType() === "m.room.message") {
        const content = event.getContent();
        if (content.msgtype === "m.location") {
            console.log("收到静态位置:", {
                description: content.body,
                geoUri: content.geo_uri,
            });
        }
    }

    if (event.getType() === "m.beacon") {
        console.log("收到位置更新:", event.getContent());
    }
});
```

### 监听 Beacon 信息变更

```typescript
client.on(sdk.RoomEvent.Name, (event, room) => {
    if (event.getType() === "m.beacon_info") {
        const content = event.getContent();
        console.log("信标状态:", content.live ? "存活" : "停止");
    }
});
```

---

## 在地图上显示位置

### 使用 Leaflet 地图

```typescript
import L from "leaflet";

class MapDisplay {
    private map: L.Map;
    private markers: Map<string, L.Marker> = new Map();

    constructor(containerId: string) {
        this.map = L.map(containerId).setView([37.7749, -122.4194], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
        }).addTo(this.map);
    }

    // 添加静态位置
    addStaticMarker(userId: string, geoUri: string, description: string) {
        const coords = this.parseGeoUri(geoUri);
        const marker = L.marker([coords.lat, coords.lng])
            .addTo(this.map)
            .bindPopup(description);

        this.markers.set(userId, marker);
    }

    // 更新用户位置
    updateUserLocation(userId: string, location: sdk.BeaconLocationState) {
        const coords = {
            lat: location.latitude!,
            lng: location.longitude!,
        };

        let marker = this.markers.get(userId);

        if (!marker) {
            // 创建新标记
            marker = L.marker([coords.lat, coords.lng])
                .addTo(this.map)
                .bindPopup(`${userId}'s Location`);
            this.markers.set(userId, marker);
        } else {
            // 更新现有标记
            marker.setLatLng([coords.lat, coords.lng]);
        }
    }

    // 解析 geo URI
    private parseGeoUri(geoUri: string): { lat: number; lng: number } {
        const match = geoUri.match(/geo:([\d.-]+),([\d.-]+)/);
        if (!match) throw new Error("Invalid geo URI");
        return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2]),
        };
    }
}

// 使用示例
const map = new MapDisplay("map-container");

// 监听位置更新
locationManager.watchUserLocations("!roomId:server.com", (userId, location) => {
    map.updateUserLocation(userId, location);
});
```

---

## 隐私和安全

### 位置权限检查

```typescript
async function checkLocationPermission(): Promise<boolean> {
    if (!navigator.geolocation) {
        console.error("浏览器不支持地理位置");
        return false;
    }

    const permission = await navigator.permissions.query({ name: "geolocation" });
    return permission.state === "granted";
}

// 使用示例
const canShareLocation = await checkLocationPermission();
if (!canShareLocation) {
    alert("请允许位置访问权限以共享您的位置");
}
```

### 限制位置精度

```typescript
// 降低精度以保护隐私
const position = await new Promise<GeolocationPosition>((resolve) => {
    navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => console.error(err),
        {
            enableHighAccuracy: false, // 不使用高精度
            maximumAge: 60000, // 接受 60 秒内的缓存位置
            timeout: 10000,
        }
    );
});
```

---

## 故障排查

### 位置获取失败

```typescript
// 常见错误处理
function handleLocationError(error: GeolocationPositionError): void {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            console.error("用户拒绝了位置请求");
            break;
        case error.POSITION_UNAVAILABLE:
            console.error("位置信息不可用");
            break;
        case error.TIMEOUT:
            console.error("获取位置超时");
            break;
        default:
            console.error("未知错误");
    }
}
```

### Beacon 状态同步问题

```typescript
// 等待 Beacon 通过同步更新
async function waitForBeaconUpdate(
    roomId: string,
    stateKey: string
): Promise<sdk.MatrixEvent | null> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);

        const handler = (event: sdk.MatrixEvent) => {
            if (
                event.getType() === "m.beacon_info" &&
                event.getStateKey() === stateKey
            ) {
                clearTimeout(timeout);
                client.off(sdk.RoomEvent.Name, handler);
                resolve(event);
            }
        };

        client.on(sdk.RoomEvent.Name, handler);
    });
}
```

---

## 相关文档

- [04-messaging.md](./04-messaging.md) - 消息功能
- [05-events-handling.md](./05-events-handling.md) - 事件处理
- [MSC 3488 - Location Sharing](https://github.com/matrix-org/matrix-spec-proposals/pull/3672)
- [MSC 3672 - Beacons](https://github.com/matrix-org/matrix-spec-proposals/pull/3672)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
