# Node Memory: source this file AFTER loading nvm in ~/.zshrc.
# Keep the runtime and CLI paths fixed: nvm changes PATH and global npm packages.
if [[ -z ${ZSH_VERSION-} ]]; then
  return 0
fi
if [[ ${_NODE_MEMORY_LOADED:-0} == 1 ]]; then
  return 0
fi
if (( ! $+functions[nvm] )); then
  print -u2 -- 'node-memory: nvm is unavailable. Load nvm before Node Memory.'
  return 0
fi
if (( ! $+commands[node] )); then
  print -u2 -- 'node-memory: Node.js is unavailable; shell integration skipped.'
  return 0
fi

typeset -g _NODE_MEMORY_NODE=${commands[node]:A}
typeset -g _NODE_MEMORY_CLI="${${(%):-%x}:A:h:h}/bin/node-memory.js"
if [[ ! -r $_NODE_MEMORY_CLI ]]; then
  print -u2 -- 'node-memory: CLI is unavailable; shell integration skipped.'
  return 0
fi

_node_memory_cli() {
  "$_NODE_MEMORY_NODE" "$_NODE_MEMORY_CLI" "$@"
}

# Global npm binaries are per Node installation; keep the command available too.
node-memory() {
  if [[ $# == 1 && $1 == save ]]; then
    local actual
    actual=$(_node_memory_original_nvm current 2>/dev/null) || actual=''
    if [[ ! $actual =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]]; then
      print -u2 -- 'node-memory: Select an installed Node.js version with nvm use before saving.'
      return 1
    fi
    _node_memory_cli save --node-version "$actual"
    return $?
  fi
  _node_memory_cli "$@"
}

# Copy the function without eval so the original arguments/output/exit code survive.
functions[_node_memory_original_nvm]=$functions[nvm]
nvm() {
  local was_internal=${_node_memory_in_nvm:-0}
  local _node_memory_in_nvm=1
  local result actual
  if _node_memory_original_nvm "$@"; then
    result=0
  else
    result=$?
  fi
  if (( result == 0 )) && [[ $was_internal == 0 && ${1-} == use ]]; then
    actual=$(_node_memory_original_nvm current 2>/dev/null) || actual=''
    # 'system', 'none' and io.js are not complete Node.js versions.
    if [[ $actual =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]]; then
      _node_memory_cli save --node-version "$actual" --if-project >/dev/null || :
    fi
  fi
  return $result
}

_node_memory_restore() {
  emulate -L zsh
  local target current
  local _node_memory_in_nvm=1
  if [[ ! -x $_NODE_MEMORY_NODE || ! -r $_NODE_MEMORY_CLI ]]; then
    print -u2 -- 'node-memory: CLI/runtime is unavailable; reload integration from an installed Node.js version.'
    return 0
  fi
  target=$(_node_memory_cli get) || return 0
  [[ -n $target ]] || return 0
  current=$(_node_memory_original_nvm current 2>/dev/null)
  [[ $target != $current ]] || return 0
  if ! _node_memory_original_nvm use --silent "$target" >/dev/null 2>&1; then
    print -u2 -- "node-memory: Could not restore $target. If missing, run: nvm install $target; otherwise try nvm use $target for details."
  fi
  return 0
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd _node_memory_restore
typeset -g _NODE_MEMORY_LOADED=1
_node_memory_restore
