import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
export class MemoryKeyValueStore {
  constructor() {
    _defineProperty(this, "data", new Map());
  }
  setItem(key, value) {
    var _this = this;
    return _asyncToGenerator(function* () {
      _this.data.set(key, value);
    })();
  }
  getItem(key) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var value = _this2.data.get(key);
      return value !== undefined ? value : null;
    })();
  }
  deleteItem(key) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      _this3.data.delete(key);
    })();
  }
}
export class LocalStorageKeyValueStore {
  constructor(localStorage) {
    this.localStorage = localStorage;
  }
  setItem(key, value) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      _this4.localStorage.setItem(key, JSON.stringify(value));
    })();
  }
  getItem(key) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var value = _this5.localStorage.getItem(key);
      if (value === null) {
        return null;
      }
      try {
        return JSON.parse(value);
      } catch (_unused) {
        return null;
      }
    })();
  }
  deleteItem(key) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      _this6.localStorage.removeItem(key);
    })();
  }
}
//# sourceMappingURL=KeyValueStore.js.map