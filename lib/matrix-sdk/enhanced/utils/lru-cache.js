import _defineProperty from "@babel/runtime/helpers/defineProperty";
/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export class LRUCache {
  constructor(options) {
    var _options$max, _options$maxMemoryMB, _options$defaultTTL, _options$sizeCalculat;
    _defineProperty(this, "_maxEntries", void 0);
    _defineProperty(this, "_maxMemoryMB", void 0);
    _defineProperty(this, "_defaultTTL", void 0);
    _defineProperty(this, "_sizeCalculation", void 0);
    _defineProperty(this, "_map", void 0);
    _defineProperty(this, "_orderList", void 0);
    _defineProperty(this, "_memoryUsageMB", 0);
    _defineProperty(this, "_hitCount", 0);
    _defineProperty(this, "_missCount", 0);
    _defineProperty(this, "_evictions", 0);
    this._maxEntries = (_options$max = options === null || options === void 0 ? void 0 : options.max) !== null && _options$max !== void 0 ? _options$max : 500;
    this._maxMemoryMB = (_options$maxMemoryMB = options === null || options === void 0 ? void 0 : options.maxMemoryMB) !== null && _options$maxMemoryMB !== void 0 ? _options$maxMemoryMB : 50;
    this._defaultTTL = (_options$defaultTTL = options === null || options === void 0 ? void 0 : options.defaultTTL) !== null && _options$defaultTTL !== void 0 ? _options$defaultTTL : 5 * 60 * 1000;
    this._sizeCalculation = (_options$sizeCalculat = options === null || options === void 0 ? void 0 : options.sizeCalculation) !== null && _options$sizeCalculat !== void 0 ? _options$sizeCalculat : this.defaultSizeCalculation;
    this._map = new Map();
    this._orderList = [];
  }
  defaultSizeCalculation(value) {
    try {
      var jsonString = JSON.stringify(value);
      return new Blob([jsonString]).size / (1024 * 1024);
    } catch (_unused) {
      return 0.001;
    }
  }
  get(key) {
    var entry = this._map.get(key);
    if (!entry) {
      this._missCount++;
      return undefined;
    }
    var now = Date.now();
    if (entry.ttl > 0 && now - entry.timestamp > entry.ttl) {
      this.evict(key);
      this._missCount++;
      return undefined;
    }
    entry.accessCount++;
    entry.lastAccessed = now;
    this._hitCount++;
    this.promote(key);
    return entry.value;
  }
  set(key, value, ttl, size) {
    var existing = this._map.get(key);
    if (existing) {
      this._memoryUsageMB -= existing.size;
      this._map.delete(key);
      var idx = this._orderList.indexOf(key);
      if (idx !== -1) {
        this._orderList.splice(idx, 1);
      }
    }
    var entrySize = size !== null && size !== void 0 ? size : this._sizeCalculation(value, key);
    var now = Date.now();
    var entry = {
      key,
      value,
      timestamp: now,
      ttl: ttl !== null && ttl !== void 0 ? ttl : this._defaultTTL,
      size: entrySize,
      accessCount: 0,
      lastAccessed: now
    };
    this._memoryUsageMB += entrySize;
    while (this._map.size >= this._maxEntries || this._memoryUsageMB > this._maxMemoryMB) {
      this.evictOldest();
    }
    this._map.set(key, entry);
    this._orderList.push(key);
  }
  has(key) {
    var entry = this._map.get(key);
    if (!entry) {
      return false;
    }
    if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
      this.evict(key);
      return false;
    }
    return true;
  }
  delete(key) {
    var entry = this._map.get(key);
    if (entry) {
      this._memoryUsageMB -= entry.size;
      this._map.delete(key);
      var idx = this._orderList.indexOf(key);
      if (idx !== -1) {
        this._orderList.splice(idx, 1);
      }
      return true;
    }
    return false;
  }
  clear() {
    this._map.clear();
    this._orderList.length = 0;
    this._memoryUsageMB = 0;
  }
  getStats() {
    var totalRequests = this._hitCount + this._missCount;
    return {
      size: this._map.size,
      itemCount: this._map.size,
      hitCount: this._hitCount,
      missCount: this._missCount,
      hitRate: totalRequests > 0 ? this._hitCount / totalRequests * 100 : 0,
      memoryUsageMB: this._memoryUsageMB,
      evictions: this._evictions
    };
  }
  keys() {
    return this._map.keys();
  }
  values() {
    return this._map.values();
  }
  entries() {
    return this._map.entries();
  }
  get size() {
    return this._map.size;
  }
  get memoryUsage() {
    return this._memoryUsageMB;
  }
  peek(key) {
    var _this$_map$get;
    return (_this$_map$get = this._map.get(key)) === null || _this$_map$get === void 0 ? void 0 : _this$_map$get.value;
  }
  invalidateIf(predicate) {
    var keysToDelete = [];
    for (var [key, entry] of this._map.entries()) {
      if (predicate(key, entry.value)) {
        keysToDelete.push(key);
      }
    }
    for (var _key of keysToDelete) {
      this.delete(_key);
    }
    return keysToDelete.length;
  }
  invalidateByPrefix(prefix) {
    return this.invalidateIf(key => key.startsWith(prefix));
  }
  invalidateByTTL(maxAge) {
    var now = Date.now();
    return this.invalidateIf((_, entry) => {
      var cacheEntry = entry;
      return now - cacheEntry.timestamp > maxAge;
    });
  }
  promote(key) {
    var idx = this._orderList.indexOf(key);
    if (idx !== -1 && idx < this._orderList.length - 1) {
      this._orderList.splice(idx, 1);
      this._orderList.push(key);
    }
  }
  evict(key) {
    var entry = this._map.get(key);
    if (entry) {
      this._memoryUsageMB -= entry.size;
      this._map.delete(key);
      var idx = this._orderList.indexOf(key);
      if (idx !== -1) {
        this._orderList.splice(idx, 1);
      }
      this._evictions++;
    }
  }
  evictOldest() {
    if (this._orderList.length === 0) {
      return;
    }
    var oldestKey = this._orderList[0];
    this.evict(oldestKey);
  }
  dump() {
    var dump = new Map();
    for (var [key, entry] of this._map.entries()) {
      dump.set(key, {
        value: entry.value,
        timestamp: entry.timestamp,
        ttl: entry.ttl
      });
    }
    return dump;
  }
  load(data) {
    this.clear();
    for (var [key, entry] of data.entries()) {
      this.set(key, entry.value, entry.ttl);
    }
  }
}
export function createMemoryCache(options) {
  return new LRUCache(options);
}
//# sourceMappingURL=lru-cache.js.map