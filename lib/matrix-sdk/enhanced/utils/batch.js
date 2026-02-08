import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
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

export class BatchProcessor {
  constructor(options) {
    var _options$batchSize, _options$flushInterva;
    _defineProperty(this, "queue", []);
    _defineProperty(this, "timer", null);
    _defineProperty(this, "batchSize", void 0);
    _defineProperty(this, "flushInterval", void 0);
    _defineProperty(this, "executeBatch", void 0);
    _defineProperty(this, "onError", void 0);
    _defineProperty(this, "processing", false);
    this.batchSize = (_options$batchSize = options.batchSize) !== null && _options$batchSize !== void 0 ? _options$batchSize : 10;
    this.flushInterval = (_options$flushInterva = options.flushInterval) !== null && _options$flushInterva !== void 0 ? _options$flushInterva : 50;
    this.executeBatch = options.executeBatch;
    this.onError = options.onError;
  }
  add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        item,
        resolve,
        reject
      });
      this.scheduleFlush();
    });
  }
  addMany(items) {
    return Promise.all(items.map(item => this.add(item)));
  }
  flush() {
    if (this.processing || this.queue.length === 0) {
      return Promise.resolve();
    }
    this.processing = true;
    var batch = this.queue.splice(0, this.batchSize);
    var items = batch.map(b => b.item);
    return this.executeBatch(items).then(results => {
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    }).catch(error => {
      batch.forEach(item => {
        var err = error instanceof Error ? error : new Error(String(error));
        if (this.onError) {
          this.onError(err, item.item);
        }
        item.reject(err);
      });
    }).finally(() => {
      this.processing = false;
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    });
  }
  getQueueSize() {
    return this.queue.length;
  }
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    var rejected = new Error("Batch processing cancelled");
    this.queue.forEach(item => {
      item.reject(rejected);
    });
    this.queue = [];
  }
  scheduleFlush() {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.flushInterval);
  }
}
export function processInBatches(_x, _x2) {
  return _processInBatches.apply(this, arguments);
}
function _processInBatches() {
  _processInBatches = _asyncToGenerator(function* (items, processor) {
    var batchSize = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 10;
    var results = [];
    for (var i = 0; i < items.length; i += batchSize) {
      var batch = items.slice(i, i + batchSize);
      for (var item of batch) {
        try {
          yield processor(item);
          results.push({
            success: true,
            item
          });
        } catch (error) {
          results.push({
            success: false,
            item,
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }
    }
    return results;
  });
  return _processInBatches.apply(this, arguments);
}
export function createBatchedExecutor(executeBatch, options) {
  var processor = new BatchProcessor(_objectSpread(_objectSpread({}, options), {}, {
    executeBatch
  }));
  return item => processor.add(item);
}
export var BatchProfile = /*#__PURE__*/function (BatchProfile) {
  BatchProfile["IO_INTENSIVE"] = "io-intensive";
  BatchProfile["CPU_INTENSIVE"] = "cpu-intensive";
  BatchProfile["LOW_LATENCY"] = "low-latency";
  BatchProfile["HIGH_THROUGHPUT"] = "high-throughput";
  return BatchProfile;
}({});
export var BATCH_PRESETS = {
  [BatchProfile.IO_INTENSIVE]: {
    batchSize: 25,
    flushInterval: 100,
    description: "Optimized for I/O operations like network requests. Larger batches reduce overhead."
  },
  [BatchProfile.CPU_INTENSIVE]: {
    batchSize: 5,
    flushInterval: 200,
    description: "Optimized for CPU-bound operations. Smaller batches prevent blocking."
  },
  [BatchProfile.LOW_LATENCY]: {
    batchSize: 5,
    flushInterval: 20,
    description: "Optimized for low latency. Fast flushing for time-sensitive operations."
  },
  [BatchProfile.HIGH_THROUGHPUT]: {
    batchSize: 50,
    flushInterval: 500,
    description: "Optimized for maximum throughput. Larger batches, longer wait for efficiency."
  }
};
export function createPresetBatchProcessor(executeBatch) {
  var profile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : BatchProfile.IO_INTENSIVE;
  var onError = arguments.length > 2 ? arguments[2] : undefined;
  var config = BATCH_PRESETS[profile];
  return new BatchProcessor({
    batchSize: config.batchSize,
    flushInterval: config.flushInterval,
    executeBatch,
    onError
  });
}
export function getPresetConfig(profile) {
  return BATCH_PRESETS[profile];
}
//# sourceMappingURL=batch.js.map