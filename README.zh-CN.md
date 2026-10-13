# Node Memory

记住你在每个项目上主动选择的 Node.js 版本，再次进入项目或新建 zsh 终端时自动恢复。

首发支持 **macOS + zsh + nvm**，零第三方依赖，不修改项目的 `package.json`、`.nvmrc` 或业务代码。

```sh
cd ~/projects/app-a
nvm use 18            # 自动记住实际完整版本，例如 v18.14.0
cd ~/projects/app-b
nvm use 22
cd ~/projects/app-a   # 自动恢复 app-a 的版本
node -v
```

## 安装

当前 0.1.0 已准备好发布，尚未正式上传 npm。首次发布后使用：

```sh
npm install -g @lspdesign/node-memory
node-memory init
```

现在可以在本地项目目录执行：

```sh
npm link
node-memory init
```

也可以使用 `npm install -g .` 安装本地包。无需构建或安装第三方依赖。

`init` 展示配置并在交互终端询问是否修改 `.zshrc`，修改前备份已有内容。非交互模式只打印说明；`init --yes` 表示明确允许修改。配置遵循 `ZDOTDIR`，重复初始化不重复添加。

**先加载 nvm，再加载 Node Memory**。完成后新建终端。若 nvm 在配置文件中较晚才加载，请将 Node Memory 区块移动到 nvm 初始化代码之后。

手动配置时复制 `node-memory init` 打印的区块即可；临时启用可以在加载 nvm 后执行：

```sh
eval "$(node-memory shell-init zsh)"
```

## 命令

| 命令 | 功能 |
| --- | --- |
| `init [--yes]` | 展示或配置 Shell 集成 |
| `save` | 保存当前 Node.js 完整版本 |
| `get` | 只输出当前项目记录的版本，没有记录则无输出 |
| `list [--json]` | 查看所有项目与版本 |
| `forget` | 删除当前项目记录 |
| `shell-init zsh` | 输出 Shell 加载命令 |
| `--help` / `--version` | 查看帮助 / 工具版本 |

命令前统一加 `node-memory`。通常只需要执行 `nvm use`，无需手动 `save`。

Hook 固定 CLI 和运行时的绝对路径，并提供 `node-memory` Shell 函数，因此 nvm 切换后，自动恢复和 CLI 不受另一版本缺少全局 npm 包影响。启用 Hook 后，手动 `save` 会读取 nvm 的当前实际版本；未启用 Hook 时使用运行 CLI 的版本。显式 `save --node-version vX.Y.Z` 可指定完整版本。

若卸载了提供固定运行时的 Node 版本、删除或移动工具安装目录，需要在可用的 Node 版本下重新安装、运行 `init`，再新建终端。

## 行为规则

- 从当前目录向上找最近的 `package.json`，子目录使用同一记录，Monorepo 子包各自记录。
- 软链接按真实路径归一化；移动项目后视为新项目。
- 成功的手动 `nvm use` 才记录；失败不覆盖。自动恢复、其他 nvm 命令内部的切换不记录。
- 支持用户使用版本别名、`--lts`、`--silent`、无参数 `.nvmrc` 选择，只保存成功后的完整版本。`system`、`none`、io.js 不记录。
- 无项目、无记录、版本相同均不自动切换；离开项目保留当前版本。
- 版本未安装时提示 `nvm install <version>`，不会自动安装。
- 每个终端单独切换，已运行的服务与其他终端不受影响。
- 新建 VS Code 集成终端需要加载 zsh 配置；仅打开编辑器工作区不会改变已有终端版本。

## 数据与故障处理

默认配置：`~/.config/node-memory/projects.json`，首次写入时创建。支持 `XDG_CONFIG_HOME`，也可以通过 `NODE_MEMORY_CONFIG_DIR` 指定整个配置目录。

并发写入有进程锁保护，写入采用临时文件、同步落盘和原子重命名。损坏 JSON 或不支持的 schema 会报错并保留原文件。修复数据或移走原文件后重试。

如果进程崩溃后留下 `projects.json.lock` 目录，先确认所有 Node Memory 进程都已停止，再删除锁目录。不要在其他终端正在保存时删锁。

没有 nvm 或 Node 时，Hook 提示并安全跳过。先加载 nvm、选择已安装的 Node，然后重新加载 Hook。

运行工具最低要求 Node.js 14.20；开发和测试要求 Node.js 22。最低版本是旧项目兼容边界，不代表建议使用停止维护的 Node。首发不支持 bash、fish、Windows、fnm、Volta。

## 卸载

1. 删除 `.zshrc` 中 `# >>> node-memory >>>` 到 `# <<< node-memory <<<` 的整个区块。
2. 在安装工具时所用的 Node 版本下执行 `npm uninstall -g @lspdesign/node-memory`；本地 link 使用 `npm unlink -g @lspdesign/node-memory`。
3. 新建终端。配置记录默认保留，如需清除，手动删除 Node Memory 配置目录。

## 开发与发布

```sh
npm run check
npm test
npm run test:e2e
npm run test:package
npm pack --dry-run
```

测试使用临时项目和配置，不修改个人 `.zshrc` 或版本记录。真实 nvm 测试需要本机安装两个不同 Node 版本，不会下载版本。

发布步骤见 [RELEASING.md](docs/RELEASING.md)，原始需求见 [PRD.md](PRD.md)。MIT 许可证。
