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

export var DEFAULT_PAGE_SIZE = 20;
export var MAX_PAGE_SIZE = 100;
export var DEFAULT_PAGE = 1;
export function validatePagination(params) {
  var _params$limit;
  if (!params) return {
    limit: DEFAULT_PAGE_SIZE
  };
  return {
    limit: Math.min(Math.max(1, (_params$limit = params.limit) !== null && _params$limit !== void 0 ? _params$limit : DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    cursor: params.cursor
  };
}
export function validateOffsetPagination(params) {
  var _params$limit2, _params$page;
  if (!params) return {
    limit: DEFAULT_PAGE_SIZE,
    page: DEFAULT_PAGE
  };
  return {
    limit: Math.min(Math.max(1, (_params$limit2 = params.limit) !== null && _params$limit2 !== void 0 ? _params$limit2 : DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    offset: params.offset,
    page: Math.max(1, (_params$page = params.page) !== null && _params$page !== void 0 ? _params$page : DEFAULT_PAGE)
  };
}
export function buildPaginationQuery(params) {
  var _validated$limit;
  var validated = validatePagination(params);
  var query = {};
  var limit = (_validated$limit = validated.limit) !== null && _validated$limit !== void 0 ? _validated$limit : DEFAULT_PAGE_SIZE;
  if (limit !== DEFAULT_PAGE_SIZE) {
    query.limit = limit.toString();
  }
  if (validated.cursor) {
    query.cursor = validated.cursor;
  }
  return query;
}
export function buildOffsetPaginationQuery(params) {
  var _validated$limit2, _validated$page;
  var validated = validateOffsetPagination(params);
  var query = {};
  var limit = (_validated$limit2 = validated.limit) !== null && _validated$limit2 !== void 0 ? _validated$limit2 : DEFAULT_PAGE_SIZE;
  var page = (_validated$page = validated.page) !== null && _validated$page !== void 0 ? _validated$page : DEFAULT_PAGE;
  if (limit !== DEFAULT_PAGE_SIZE) {
    query.limit = limit.toString();
  }
  if (validated.offset !== undefined) {
    query.offset = validated.offset.toString();
  }
  if (page !== DEFAULT_PAGE) {
    query.page = page.toString();
  }
  return query;
}
export function createPaginatedResult(items, page, pageSize, total) {
  var totalPages = Math.ceil(total / pageSize);
  return {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_next: page < totalPages
    }
  };
}
export function createCursorPaginatedResult(items, hasNext, nextCursor, total) {
  return {
    items,
    pagination: {
      has_next: hasNext,
      next_cursor: nextCursor,
      total
    }
  };
}
export function calculateOffset(page, pageSize) {
  return (Math.max(1, page) - 1) * Math.min(pageSize, MAX_PAGE_SIZE);
}
//# sourceMappingURL=pagination.js.map