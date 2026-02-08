import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
export function createMockHttpClient() {
  var mock = {
    request: jest.fn(),
    setResponse: jest.fn()
  };
  return mock;
}
export function createMockHttpClientInstance() {
  return createMockHttpClient();
}
export function createMockFriend(overrides) {
  return _objectSpread({
    friend_id: "@user".concat(Math.random().toString(36).substring(7), ":example.com"),
    display_name: "Test User",
    avatar_url: "mxc://example.com/avatar",
    status: "accepted",
    created_at: new Date().toISOString(),
    category_id: "default"
  }, overrides);
}
export function createMockFriendList() {
  var count = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;
  return Array.from({
    length: count
  }, (_, i) => createMockFriend({
    friend_id: "@user".concat(i, ":example.com"),
    display_name: "Test User ".concat(i)
  }));
}
export function createMockFriendCategory(overrides) {
  return _objectSpread({
    id: "category_".concat(Math.random().toString(36).substring(7)),
    name: "Test Category",
    created_at: new Date().toISOString(),
    friend_count: 0
  }, overrides);
}
export function createMockFriendRequest(overrides) {
  return _objectSpread({
    request_id: "request_".concat(Math.random().toString(36).substring(7)),
    requester_id: "@user".concat(Math.random().toString(36).substring(7), ":example.com"),
    target_id: "@user".concat(Math.random().toString(36).substring(7), ":example.com"),
    status: "pending",
    message: "Hi, I'd like to be friends!",
    created_at: new Date().toISOString()
  }, overrides);
}
export function createMockFriendRequestList() {
  var count = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 5;
  return Array.from({
    length: count
  }, (_, i) => createMockFriendRequest({
    request_id: "request_".concat(i),
    requester_id: "@user".concat(i, ":example.com"),
    target_id: "@user".concat(i + 1, ":example.com")
  }));
}
export function createMockBlockedUser(overrides) {
  return _objectSpread({
    user_id: "@user".concat(Math.random().toString(36).substring(7), ":example.com"),
    display_name: "Blocked User",
    blocked_at: new Date().toISOString(),
    reason: "Spam"
  }, overrides);
}
export function createMockPaginationParams(overrides) {
  return _objectSpread({
    page: 1,
    limit: 20
  }, overrides);
}
export function createMockSuccessResponse(data) {
  return {
    data,
    status: 200
  };
}
export function createMockErrorResponse(message) {
  var status = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 500;
  return {
    data: {
      status: "error",
      error: message
    },
    status
  };
}
export function setupMockRequest(mock, data) {
  mock.mockResolvedValue(createMockSuccessResponse(data));
}
export function setupMockError(mock, message) {
  var status = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 500;
  mock.mockResolvedValue(createMockErrorResponse(message, status));
}
//# sourceMappingURL=test-utils.js.map