#!/bin/bash
# 完全重置应用状态

echo "=== HuLa 应用状态重置工具 ==="
echo ""
echo "警告：这将清除所有登录数据和本地存储"
echo ""
read -p "确定要继续吗？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "正在清除应用数据..."

    # 停止应用
    echo "1. 停止应用..."
    pkill -f "hula" || true

    # 清除 Tauri 应用数据
    echo "2. 清除 Tauri 应用数据..."
    rm -rf ~/Library/Application\ Support/com.hula.hula 2>/dev/null
    rm -rf ~/Library/Caches/com.hula.hula 2>/dev/null

    # 清除 SQLite 数据库
    echo "3. 清除数据库..."
    rm -f /Users/ljf/Desktop/back/foxchat/HuLamatrix/src-tauri/db.sqlite 2>/dev/null
    rm -f /Users/ljf/Desktop/back/foxchat/HuLamatrix/src-tauri/db.sqlite-* 2>/dev/null

    # 清除错误日志
    echo "4. 清除错误日志..."
    echo "" > /Users/ljf/Desktop/back/foxchat/HuLamatrix/docs/error_log.md

    # 清除 Vite 缓存
    echo "5. 清除 Vite 缓存..."
    rm -rf /Users/ljf/Desktop/back/foxchat/HuLamatrix/node_modules/.vite 2>/dev/null

    echo ""
    echo "✅ 清除完成！"
    echo ""
    echo "现在可以重新启动应用："
    echo "  cd /Users/ljf/Desktop/back/foxchat/HuLamatrix"
    echo "  pnpm run tauri:dev"
else
    echo "已取消"
fi
