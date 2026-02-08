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
//# sourceMappingURL=KeyValueStore.js.map