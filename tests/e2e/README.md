E2E 环境变量说明

- `E2E_MATRIX_SERVER`: 用于 `.well-known/matrix/client` 服务发现的服务器域名，如 `cjystx.top`
- `E2E_MATRIX_USER`: 只读测试账号的用户名（完整 MXID 或 localpart），建议只读权限
- `E2E_MATRIX_PASSWORD`: 上述账号的密码
- `E2E_PUBLIC_ROOM_ALIAS`: 可加入的公共房间别名，如 `#public:cjystx.top`

在 CI 中通过仓库 Secrets 注入上述变量，工作流见 `.github/workflows/e2e.yml`。

