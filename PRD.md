# Node Memory — 产品需求文档与开发实施计划

- **版本**：v0.1.0（规划）
- **定位**：自动记忆项目上次主动选择的 Node.js 版本，进入项目时自动恢复
- **首发平台**：macOS + zsh + nvm
- **实现技术**：Node.js CLI + zsh Shell Hook + 本地 JSON
- **开发周期估计**：3–5 天（视测试与环境兼容情况调整）

> **状态说明**：这是待开发产品的需求文档，不代表 `node-memory` 已经发布到 npm。安装命令仅表示期望的最终用户体验，发布前须核查包名可用性。

## 1. 背景与目标

开发者经常维护多个需要不同 Node.js 版本的项目，切换目录后反复手动执行 `nvm use`。虽然 `.nvmrc` 可以声明版本，但用户希望**不修改项目文件、不要求团队配合**，仅记住自己上次在该项目主动使用的版本。

**目标体验**：

```bash
cd ~/projects/project-a
nvm use 18        # 首次手动选择，成功后自动记录实际版本
cd ../project-b
nvm use 22        # 自动记录
cd ../project-a   # 自动恢复 project-a 对应版本
node -v
```

产品不重新实现 Node.js 版本管理：由现有 `nvm` 安装和切换版本；Node Memory 负责识别项目、持久化和 Shell 自动化。

### 非目标（v0.1.0）

- 不支持 Windows、bash、fish、fnm、Volta。
- 不自动安装缺失的 Node.js 版本。
- 不修改项目内的 `package.json`、`.nvmrc` 或 Git 文件。
- 不自动调整已经运行的进程、VS Code 扩展宿主或开发服务器的 Node.js 版本。
- 不根据 `npm` 的版本单独选择 Node.js：**nvm 管理的是 Node.js 版本**，npm 版本是另一回事。

## 2. 用户故事与验收

1. **首次进入项目**：没有记录时不切换；用户执行 `nvm use 18` 成功后记录实际完整版本（如 `v18.20.4`）。
2. **再次进入项目**：`cd` 到项目根目录或子目录，若有记录且版本不同，自动调用当前 Shell 的 nvm 切换。
3. **新建终端**：在 VS Code 项目目录新建加载 zsh 配置的终端时，初始化阶段自动恢复版本。
4. **无记录/无项目**：不切换，不报干扰性错误。
5. **版本缺失**：提示 `nvm install <version>`，不自动下载。
6. **多个终端**：不同终端可以分别使用不同版本，互不改变彼此 PATH。
7. **离开项目**：v0.1.0 不自动恢复默认 Node.js，保留当前版本。

## 3. 功能清单

| ID | 功能 | 优先级 | MVP |
|---|---|---|---|
| F01 | 从当前目录向上识别项目根目录 | P0 | 是 |
| F02 | `nvm use` 成功后记录实际版本 | P0 | 是 |
| F03 | 本地 JSON 持久化 | P0 | 是 |
| F04 | zsh `chpwd` 监听目录变化 | P0 | 是 |
| F05 | 进入项目自动恢复 | P0 | 是 |
| F06 | Shell 初始化时恢复 | P0 | 是 |
| F07 | 相同版本不重复切换 | P0 | 是 |
| F08 | `list` 查看所有项目 | P1 | 是 |
| F09 | `forget` 删除项目记录 | P1 | 是 |
| F10 | 自动安装 Node.js | P2 | 否 |
| F11 | 支持 fnm/Volta | P2 | 否 |
| F12 | VS Code 扩展 | P2 | 否 |

## 4. 核心设计

### 4.1 本地配置文件

路径：`~/.config/node-memory/projects.json`。

```json
{
  "schemaVersion": 1,
  "projects": {
    "/Users/example/projects/project-a": {
      "nodeVersion": "v18.20.4"
    },
    "/Users/example/projects/project-b": {
      "nodeVersion": "v22.12.0"
    }
  }
}
```

使用规范化绝对路径作为键。配置目录不存在时创建；读取损坏的 JSON 时给出提示并保留原文件，不应静默覆盖。写入采用临时文件 + 原子重命名；后续若考虑并发写入，需要额外锁或串行机制，原子重命名本身不能避免并发覆盖。

### 4.2 项目识别

从 `process.cwd()` 开始向上寻找最近的 `package.json`，其所在目录作为项目根目录。进入 `project-a/src/components` 仍映射到 `project-a`。MVP 中 Monorepo 子包可能被视为独立项目，后续增加 workspace 识别。路径含空格、软链接及没有 `package.json` 的情况均应测试。

### 4.3 Shell 与 CLI 的职责边界

```text
用户 cd / nvm use
        ↓
zsh Hook / nvm 包装函数
        ↓
Node Memory CLI（识别项目、读写 JSON）
        ↓
Shell 中调用原始 nvm 函数切换版本
```

**关键原理**：Node.js 子进程不能改变父 Shell 的 `PATH`。因此 CLI 不直接负责切换当前终端的 Node.js；必须由 Shell Hook 在**当前 Shell**执行 `nvm use`。

### 4.4 自动记录

包装 zsh 中的 `nvm` 函数：对用户主动执行的 `nvm use <version>`，先调用原始函数，只有成功后才读取当前实际版本并执行 `node-memory save`。其他 nvm 子命令原样转发，保留参数、退出码和输出。自动恢复时调用原始函数或使用内部标志，避免触发再次记录或递归。重复加载 Hook 不应重复包装。

### 4.5 自动恢复

在 `chpwd` 和 Shell 初始化时：

1. 识别当前项目；
2. 从 JSON 查询目标版本；
3. 无记录则跳过；
4. 与当前 `nvm current` 比较；
5. 相同则跳过，不同则在当前 Shell 调用 nvm；
6. 切换失败则提示，不更改记录。

**注意**：zsh 的 `chpwd` 响应 Shell 目录变化，并非 VS Code 工作区打开事件；新建集成终端需在 Shell 初始化时主动恢复。

## 5. CLI 命令（规划）

| 命令 | 行为 |
|---|---|
| `node-memory init` | 检查 zsh/nvm 并提示配置 Shell 集成；修改 `.zshrc` 前征求确认 |
| `node-memory save` | 保存当前项目的实际 Node.js 版本 |
| `node-memory get` | 只输出当前项目记录的版本；无记录输出空 |
| `node-memory list` | 列出项目与版本 |
| `node-memory forget` | 删除当前项目的记录 |
| `node-memory shell-init zsh` | 输出供当前 Shell 加载的 Hook 脚本 |
| `node-memory --help` | 帮助信息 |

预期最终安装流程（**开发完成并发布后**）：

```bash
npm install -g node-memory
node-memory init
# 根据提示完成 Shell 配置，重新打开终端
```

**初始化顺序要求**：先加载 nvm，再加载 Node Memory。Node Memory CLI 自身依赖 Node.js，若 Shell 启动时没有可用 Node.js，必须安全降级，不得阻止终端启动。开发时可考虑通过绝对路径加载 Shell 脚本，降低 CLI 启动依赖风险。

## 6. 目录结构

```text
node-memory/
├── bin/node-memory.js
├── src/
│   ├── cli.js
│   ├── project.js
│   ├── storage.js
│   └── version.js
├── shell/node-memory.zsh
├── tests/
│   ├── project.test.js
│   ├── storage.test.js
│   └── shell.test.js
├── package.json
├── README.md
├── PRD.md
└── .gitignore
```

## 7. 开发实施计划

### 阶段一：本地存储（约半天）

- [ ] 初始化 npm 项目，设置 `bin` 入口。
- [ ] 实现 `storage.js` 的创建、读取、写入、删除。
- [ ] 实现 `schemaVersion` 和损坏文件错误处理。
- [ ] 编写持久化单元测试。

**验收**：给定项目路径，可保存、查询、删除版本；重启进程后数据保留。

### 阶段二：项目识别（约半天）

- [ ] 向上查找最近 `package.json`。
- [ ] 处理不存在项目、路径空格、子目录与软链接。
- [ ] 编写项目识别单元测试。

**验收**：在 `src/components` 中查询，返回所属项目根目录的记录。

### 阶段三：CLI（约半天）

- [ ] 实现 `save/get/list/forget/--help`。
- [ ] 规范 stdout（机器可读）和 stderr（诊断提示）。
- [ ] 使用 `npm link` 本地测试。

**验收**：四个命令可独立使用，异常返回非零退出码。

### 阶段四：自动恢复（约一天）

- [ ] 实现 zsh `chpwd` Hook。
- [ ] 比较目标版本与当前版本，避免重复切换。
- [ ] 通过当前 Shell 的 nvm 函数切换。
- [ ] Shell 初始化时执行一次恢复。
- [ ] 处理目标版本未安装、nvm 不存在、CLI 不可用。

**验收**：进入已记录项目自动切换；新终端打开项目时也恢复；其他终端不受影响。

### 阶段五：自动记忆（约一天）

- [ ] 安全包装 `nvm` 函数并保留原行为。
- [ ] 仅成功的用户主动 `nvm use` 触发保存。
- [ ] 避免自动恢复再次保存或递归。
- [ ] 重复初始化不重复注册 Hook。

**验收**：首次手动 `nvm use 18` 后无需 `save`；再次进入项目自动恢复。

### 阶段六：测试与发布准备（约半天至一天）

- [ ] 使用 `node --test` 运行单元测试。
- [ ] 使用真实 zsh + nvm 做端到端测试。
- [ ] 编写 README、安装/卸载指引。
- [ ] 测试初始化脚本不会破坏 `.zshrc`。
- [ ] 检查 npm 包名是否可用，发布前进行包内容审查。

## 8. 测试矩阵

| 场景 | 预期 |
|---|---|
| 项目没有记录 | 不切换 |
| 当前版本相同 | 不切换 |
| 目标版本未安装 | 提示安装，不修改记录 |
| 没有 `package.json` | 不识别项目 |
| JSON 不存在 | 初始化数据文件 |
| JSON 损坏 | 报错并保留原数据 |
| `nvm use` 失败 | 不更新记录 |
| 路径包含空格 | 正常识别 |
| 项目内子目录切换 | 不重复切换 |
| 同时打开两个终端 | 各自版本独立 |
| 离开项目 | 保留当前版本 |
| 重复加载 Hook | 不重复注册或包装 |
| nvm 不可用 | 提示，不阻止 Shell 启动 |
| Node Memory CLI 不可用 | 安全降级 |
| VS Code 新终端 | 在 Shell 初始化后恢复 |

## 9. MVP 完成定义

在两个项目中分别手动执行一次 `nvm use 18`、`nvm use 22` 后，随后仅通过 `cd` 往返切换，`node -v` 显示对应项目上次记录的完整版本。关闭终端再打开仍有效，且不需要 `.nvmrc`、不修改项目代码、不影响其他终端。

## 10. 后续路线图

- **v0.2**：项目别名、手动绑定、记录清理、诊断命令。
- **v0.3**：支持 `.nvmrc`、`.node-version`、`engines`，明确优先级规则。
- **v0.4**：增加 fnm/Volta 等适配器。
- **v1.0**：Linux、其他 Shell 与 Windows PowerShell。

## 11. 产品与商业验证

这是一个明确但已有替代方案的开发者痛点。v0.1.0 优先作为开源工具发布，验证安装成功率、实际使用频率和反馈；与 nvm Hook、fnm、mise、Volta 等方案比较差异。**不要预设“自动记忆 Node 版本”本身足以支撑收费产品。**
