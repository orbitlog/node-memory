# 发布 @lspdesign/node-memory

仓库：https://github.com/orbitlog/node-memory

包名：`@lspdesign/node-memory`；可执行命令：`node-memory`。原无作用域包名已被占用。2026-10-13 官方 registry 查询 scoped 包返回 404；实际发布时再次核查。

## 首次发布

使用有权发布 `@lspdesign` scope 的 npm 账户，在自己的终端登录。不要把 token 或密码写入仓库。

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm view @lspdesign/node-memory version --registry=https://registry.npmjs.org/
```

尚未发布时 `npm view` 返回 E404。如果 scope 是组织，账户需有对应发布权限；如果 scope 是个人用户名，需登录对应账户。

使用 Node.js 22 或更新版本运行：

```sh
npm run check
npm test
npm run test:e2e
npm run test:package
npm pack --dry-run
npm publish --dry-run
```

审查包中只包含 `bin/`、`src/`、`shell/`、README、CHANGELOG、LICENSE 和 package.json。`files` 白名单不包含测试、原始 PRD、内部文档、CI、个人配置或凭证。`prepublishOnly` 会执行语法检查和测试；真实 nvm 测试需要单独执行，避免在无本机 nvm 的环境隐式失败。

更新 README 中“尚未发布”的说明，记录验证结果并提交后，正式发布：

```sh
npm publish --access public
```

按 npm 提示完成账户要求的身份验证 / 2FA。认证由 npm 官方流程处理；不要把长期凭证写入项目。包显式配置 public access 和官方 registry。

发布成功后验证：

```sh
npm view @lspdesign/node-memory version
npm install -g @lspdesign/node-memory
node-memory --version
node-memory init
git tag v0.1.0
git push origin main --tags
```

`npm publish` 会公开上传包，同一包名和版本无法再次使用；后续修复需提升版本。以 [npm 官方发布说明](https://docs.npmjs.com/cli/v11/commands/npm-publish/) 为准。

## 后续版本

1. 更新 CHANGELOG 和版本相关测试。
2. `npm version patch` / `minor` / `major`。
3. 完成上述验证、dry-run，再发布并推送提交与标签。

本项目无第三方运行依赖，无构建产物。GitHub Actions 执行 macOS/Linux 的语法检查、Shell/CLI/存储测试及包清单审查；真实 nvm 验证保留为发布前本地检查。
