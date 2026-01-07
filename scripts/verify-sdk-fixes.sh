#!/bin/bash

# Matrix SDK v39.1.3 修复验证脚本
# 用于验证所有修复是否正确应用

set -e

echo "================================================"
echo "Matrix SDK v39.1.3 修复验证脚本"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_file() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description - 未找到: $pattern"
        return 1
    fi
}

echo "1. 检查登录 API 格式..."
echo "--------------------------------------"
check_file "src/adapters/matrix-adapter.ts" "identifier:" "登录使用 identifier 格式"
check_file "src/adapters/matrix-adapter.ts" "type: 'm.id.user'" "identifier 类型正确"
check_file "src/adapters/matrix-adapter.ts" "refresh_token" "保存刷新令牌"
echo ""

echo "2. 检查线程支持..."
echo "--------------------------------------"
check_file "src/mobile/views/rooms/Manage.vue" "threadSupport: true" "Manage.vue - 线程支持"
check_file "src/mobile/views/friends/AddFriends.vue" "threadSupport: true" "AddFriends.vue - 线程支持"
check_file "src/views/homeWindow/message/index.vue" "threadSupport: true" "message/index.vue - 线程支持"
check_file "src/hooks/useMatrixAuth.ts" "threadSupport: true" "useMatrixAuth.ts - 线程支持"
check_file "src/main.ts" "threadSupport: true" "main.ts - 线程支持"
check_file "src/services/login-service.ts" "threadSupport: true" "login-service.ts - 线程支持"
echo ""

echo "3. 检查类型定义..."
echo "--------------------------------------"
check_file "src/types/matrix.ts" "threadSupport" "matrix.ts - threadSupport 类型"
check_file "src/typings/modules.d.ts" "threadSupport" "modules.d.ts - threadSupport 类型"
check_file "src/integrations/matrix/client.ts" "threadSupport" "client.ts - threadSupport 类型"
check_file "src/integrations/matrix/client.ts" "refresh_token" "client.ts - refresh_token 类型"
echo ""

echo "4. 统计修复情况..."
echo "--------------------------------------"
THREAD_SUPPORT_COUNT=$(grep -r "threadSupport: true" src/ --include="*.vue" --include="*.ts" | wc -l | tr -d ' ')
echo -e "${GREEN}找到 $THREAD_SUPPORT_COUNT 处 threadSupport 启用${NC}"

IDENTIFIER_COUNT=$(grep -r "identifier:" src/adapters/matrix-adapter.ts | wc -l | tr -d ' ')
echo -e "${GREEN}找到 $IDENTIFIER_COUNT 处 identifier 使用${NC}"

REFRESH_TOKEN_COUNT=$(grep -r "refresh_token" src/adapters/matrix-adapter.ts | wc -l | tr -d ' ')
echo -e "${GREEN}找到 $REFRESH_TOKEN_COUNT 处刷新令牌处理${NC}"
echo ""

echo "5. 运行类型检查..."
echo "--------------------------------------"
if pnpm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} TypeScript 类型检查通过"
else
    echo -e "${RED}✗${NC} TypeScript 类型检查失败"
    echo "运行 'pnpm run typecheck' 查看详细错误"
    exit 1
fi
echo ""

echo "6. 代码质量检查..."
echo "--------------------------------------"
if pnpm run check > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 代码质量检查通过"
else
    echo -e "${YELLOW}⚠${NC} 代码质量检查发现问题（非致命）"
    echo "运行 'pnpm run check' 查看详情"
fi
echo ""

echo "================================================"
echo "验证完成！"
echo "================================================"
echo ""
echo -e "${GREEN}所有关键修复已验证通过！${NC}"
echo ""
echo "下一步："
echo "  1. 运行 'pnpm run tauri:dev' 启动应用"
echo "  2. 测试登录功能"
echo "  3. 测试线程消息功能"
echo "  4. 检查控制台是否有错误"
echo ""
echo "查看详细文档："
echo "  - docs/matrix-sdk/QUICK_START_GUIDE.md"
echo "  - docs/matrix-sdk/FIXING_GUIDE.md"
echo ""
