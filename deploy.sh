#!/usr/bin/env bash
set -e
echo "========================================"
echo "  CineGen AI Director - 一键部署与启动"
echo "========================================"
echo

if [ ! -f package.json ]; then
  echo "[错误] 请在项目根目录下运行此脚本。"
  exit 1
fi

echo "[1/3] 安装依赖..."
npm install

echo
echo "[2/3] 构建前端..."
npm run build

echo
echo "[3/3] 启动服务（生产模式）..."
echo "应用将运行在: http://localhost:3001"
echo "按 Ctrl+C 停止服务"
echo
npm run start
