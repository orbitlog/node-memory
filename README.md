# Node Memory

Remember the Node.js version you last chose for a project. Restore it when you enter that project or open a new zsh terminal.

**macOS + zsh + nvm · No dependencies · No project files changed**

[中文文档](README.zh-CN.md)

```sh
cd ~/projects/app-a
nvm use 18             # remembers the installed, complete version
cd ~/projects/app-b
nvm use 22
cd ~/projects/app-a    # automatically switches back to app-a's version
node -v
```

## Install

Version 0.1.0 is prepared for publication. The registry install command below becomes available after the first release:

```sh
npm install -g @lspdesign/node-memory
node-memory init
```

`init` displays the integration block and asks before editing `.zshrc`. It backs up existing content and adds the block once. Noninteractive invocations only print instructions; use `init --yes` to explicitly allow editing. Open a new terminal afterward. Load nvm **before** Node Memory; move the block below nvm initialization if your dotfiles load nvm later.

To use the checkout before publication:

```sh
git clone https://github.com/orbitlog/node-memory.git
cd node-memory
npm link
node-memory init
```

Alternatively install the local package with `npm install -g .`. No dependency installation or build step is required.

### Manual setup

The preferred initialization writes a guarded `source` command with an absolute path. You can copy the block printed by `node-memory init` instead of allowing automatic changes. For a temporary session, after nvm is loaded:

```sh
eval "$(node-memory shell-init zsh)"
```

The hook fixes the CLI and Node executable paths when loaded and provides a `node-memory` shell function. Both automatic restoration and CLI commands remain available after switching to a Node version with different global npm packages. If you remove the Node installation that supplied that runtime or move/remove this package, reinstall and run `init` using an available Node version, then open a new terminal.

## Commands

| Command | Behavior |
| --- | --- |
| `node-memory init [--yes]` | Show/configure the zsh integration, respecting `ZDOTDIR` |
| `node-memory save` | Save the current Node.js version for the current project |
| `node-memory get` | Print only the remembered version; print nothing when absent |
| `node-memory list [--json]` | List all project records, optionally as JSON |
| `node-memory forget` | Remove the current project's record |
| `node-memory shell-init zsh` | Print a source command for the packaged hook |
| `node-memory --help` | Show help |
| `node-memory --version` | Show the tool version |

The wrapper automatically saves the actual result of successful, manually invoked `nvm use`, including aliases, major versions, flags, and `.nvmrc` selection. Failed calls leave the record unchanged. Automatic switches and calls nested inside other nvm operations never update records. `system`, `none`, and io.js results are not stored.

`save --node-version vX.Y.Z` supplies an explicit complete version; the hook uses it because its fixed runtime may differ from the active shell's Node. With the hook active, ordinary `save` reads `nvm current` to record the active shell version. Without the hook, it records the Node executable running the CLI.

## Project and storage rules

- The closest parent directory containing a `package.json` is the project root. Project subdirectories share that root; nested monorepo packages have separate records.
- Symlinks resolve to the physical path. Moving a project gives it a new identity; remove obsolete entries manually from the configuration if needed.
- No record means no automatic switch. Leaving a project keeps the current Node version.
- Missing versions produce `nvm install vX.Y.Z` guidance; Node Memory never installs Node automatically.
- Each terminal changes its own environment. Existing servers/processes and other terminals are unaffected.

Records live at `~/.config/node-memory/projects.json`. `XDG_CONFIG_HOME` changes the config base; `NODE_MEMORY_CONFIG_DIR` overrides the complete directory (useful for testing).

```json
{
  "schemaVersion": 1,
  "projects": {
    "/absolute/project/path": { "nodeVersion": "v22.14.0" }
  }
}
```

The file is created on the first write. Writes use a process lock, a private temporary file, and an atomic rename. Concurrent writers reload after acquiring the lock so they preserve each other's projects. Corrupted JSON or unknown schemas cause a diagnostic and are preserved. A crashed writer may leave `projects.json.lock`; stop all Node Memory processes before removing that lock directory. Readers never need the lock.

## Compatibility

Initial supported platform: macOS, zsh, and nvm. Runtime requires Node.js 14.20 or newer; development/test commands require Node.js 22 or newer. The minimum runtime permits switching older projects without breaking the CLI; it is not a recommendation to use end-of-life Node versions. Linux runs in CI, but is outside the initial supported product scope. bash, fish, Windows, fnm, and Volta are not supported.

For VS Code, new integrated terminals must load your zsh configuration. This tool responds to shell startup and directory changes, not editor workspace events. With no available Node runtime, integration skips safely; load nvm and select an installed Node before sourcing the hook again.

## Uninstall

1. Remove the section between `# >>> node-memory >>>` and `# <<< node-memory <<<` from `.zshrc`.
2. Run `npm uninstall -g @lspdesign/node-memory` using the Node version under which you installed it (or `npm unlink -g @lspdesign/node-memory` for a linked checkout).
3. Open a new terminal. Optionally delete the Node Memory config directory to erase records; uninstalling preserves them.

## Development

```sh
npm run check
npm test
npm run test:e2e
npm run test:package
npm pack --dry-run
```

Unit/integration tests use temporary config and projects, not your personal records or `.zshrc`. `test:e2e` uses installed nvm versions without downloading anything. Set `NODE_MEMORY_NVM_SH` for a custom nvm.sh location, and optionally `NODE_MEMORY_TEST_VERSION_A` / `NODE_MEMORY_TEST_VERSION_B` to choose two installed versions.

See [the original PRD](PRD.md), [implementation notes](docs/IMPLEMENTATION.md), and [release instructions](docs/RELEASING.md).

## License

MIT.
