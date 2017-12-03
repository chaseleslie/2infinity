/* exported Console */

"use strict";

const Console = (function(global) {

const doc = global.document;

const EntryType = Object.freeze({
  "DEBUG": 1,
  "LOG":   2,
  "WARN":  4,
  "ERROR": 8,
  "PRINT": 16,
  "ECHO":  32
});

const EntryTypeString = Object.freeze({
  [EntryType.DEBUG]: "DEBUG ",
  [EntryType.LOG]:   "LOG   ",
  [EntryType.WARN]:  "WARN  ",
  [EntryType.ERROR]: "ERROR ",
  [EntryType.PRINT]: "      ",
  [EntryType.ECHO]:  "      "
});

const state = Object.seal({
  "KEY_MAP": Object.freeze({
    "ArrowLeft":  37,
    "Left":       37,
    "ArrowUp":    38,
    "Up":         38,
    "ArrowRight": 39,
    "Right":      39,
    "ArrowDown":  40,
    "Down":       40,

    "Enter":      13,
    "Escape":     27,
    "Tab":        9,
    "Alt":        18,
    "F5":         116,
    "`":          192
  }),
  "console": null,
  "consoleEntries": null,
  "consoleEntriesFilterDebug": null,
  "consoleEntriesFilterLog": null,
  "consoleEntriesFilterWarn": null,
  "consoleEntriesFilterError": null,
  "consoleInput": null,
  "consoleInputEnter": null,
  "game": null,
  "shell": null,
  "entryList": null,
  "entryFilterFlags": 0,
  "callback": null,
  "callbackArgs": Object.seal({
    "level": null,
    "hitpoints": null
  })
});

function noop() {
  // nada
}

function Shell() {
  const Commands = Object.freeze({
    "level": level,
    "hp": hitpoints
  });
  const history = [];
  var historyIndex = 0;

  function historyBack() {
    if (historyIndex > 0) {
      historyIndex -= 1;
    }
    return history[historyIndex];
  }

  function historyForward() {
    if (historyIndex < history.length) {
      historyIndex += 1;
    }
    return history[historyIndex];
  }

  function getLevel() {
    let lvl = state.callbackArgs.level;
    if (lvl === null) {
      lvl = state.game.level + 1;
    }
    state.entryList.add(EntryType.PRINT, `lvl ${lvl}`);
  }

  function setLevel(args) {
    const lvl = parseInt(args[1], 10);
    if (!isFinite(lvl) || isNaN(lvl) || lvl < 1 || lvl > state.game.gameData.levels.length) {
      return;
    }
    state.callbackArgs.level = lvl;
  }

  function level(args) {
    if (args.length > 1) {
      setLevel(args);
      getLevel();
    } else {
      getLevel(args);
    }
  }

  function getHitpoints() {
    let hp = state.callbackArgs.hitpoints;
    if (hp === null) {
      hp = state.game.player.hitpoints;
    }
    state.entryList.add(EntryType.PRINT, `hp ${hp}`);
  }

  function setHitpoints(args) {
    const hp = parseInt(args[1], 10);
    if (!isFinite(hp) || isNaN(hp)) {
      return;
    }
    state.callbackArgs.hitpoints = hp;
  }

  function hitpoints(args) {
    if (args.length > 1) {
      setHitpoints(args);
      getHitpoints();
    } else {
      getHitpoints(args);
    }
  }

  function interpret(command = "") {
    if (!command) {
      return;
    }

    history.push(command);
    state.entryList.add(EntryType.ECHO, command);
    const args = command.split(" ");
    const cmd = args[0];
    if (Commands[cmd]) {
      Commands[cmd](args);
    }
    historyIndex = history.length;
  }

  return {
    "interpret": interpret,
    "historyBack": historyBack,
    "historyForward": historyForward
  };
}

function EntryList() {
  const NodeStyles = Object.freeze({
    [EntryType.DEBUG]: "console_entry_debug",
    [EntryType.LOG]:   "console_entry_log",
    [EntryType.WARN]:  "console_entry_warn",
    [EntryType.ERROR]: "console_entry_error",
    [EntryType.PRINT]: "console_entry_print",
    [EntryType.ECHO]:  "console_entry_echo"
  });
  const entries = [];
  const nodes = [];

  function addNode(entry) {
    const node = doc.createElement("div");
    const type = entry.type;
    node.classList.add("console_entry");
    node.classList.add(NodeStyles[type]);
    node.textContent = formatEntry(entry);
    node.dataset.type = type;
    node.dataset.msg = entry.msg;
    node.dataset.ts = entry.ts;
    nodes.push(node);
    if (type & state.entryFilterFlags) {
      state.consoleEntries.appendChild(node);
      node.scrollIntoView({"block": "end", "behavior": "smooth"});
    }
  }

  function formatEntry(entry) {
    var header = "";

    switch (entry.type) {
      case EntryType.DEBUG:
      case EntryType.LOG:
      case EntryType.WARN:
      case EntryType.ERROR: {
        const date = new Date(entry.ts);
        const hours = `0${date.getHours()}`.substr(-2);
        const minutes = `0${date.getMinutes()}`.substr(-2);
        const ts = `[${hours}:${minutes}] `;
        header = `${EntryTypeString[entry.type]}${ts}`;
      }
      break;

      case EntryType.PRINT:
      case EntryType.ECHO:
      default:

      break;
    }

    return `${header}${entry.msg}`;
  }

  return {
    get entries() {
      return entries;
    },
    "add": function(type, msg) {
      const now = Date.now();
      const entry = new Entry(type, msg, now);
      entries.push(entry);
      addNode(entry);
    },
    "refresh": function() {
      const parent = state.consoleEntries;
      let child = parent.lastChild;
      while (child) {
        parent.removeChild(child);
        child = parent.lastChild;
      }

      const docFrag = doc.createDocumentFragment();
      for (let k = 0, n = nodes.length; k < n; k += 1) {
        let node = nodes[k];
        if (Number(node.dataset.type) & state.entryFilterFlags) {
          docFrag.appendChild(node);
        }
      }
      state.consoleEntries.appendChild(docFrag);
    }
  };
}

function Entry(type, msg, ts) {
  this.type = type;
  this.msg = msg;
  this.ts = ts;
}

function handleEntriesFilterChange() {
  const debug = state.consoleEntriesFilterDebug.checked && EntryType.DEBUG;
  const log = state.consoleEntriesFilterLog.checked && EntryType.LOG;
  const warn = state.consoleEntriesFilterWarn.checked && EntryType.WARN;
  const error = state.consoleEntriesFilterError.checked && EntryType.ERROR;

  state.entryFilterFlags = debug | log | warn | error | EntryType.PRINT | EntryType.ECHO;
  state.entryList.refresh();
}

function init(args) {
  state.console = args.console;
  state.consoleEntriesFilterDebug = args.consoleEntriesFilterDebug;
  state.consoleEntriesFilterLog = args.consoleEntriesFilterLog;
  state.consoleEntriesFilterWarn = args.consoleEntriesFilterWarn;
  state.consoleEntriesFilterError = args.consoleEntriesFilterError;
  state.consoleEntries = args.consoleEntries;
  state.consoleInput = args.consoleInput;
  state.consoleInputEnter = args.consoleInputEnter;
  state.game = args.game;
  state.shell = new Shell();
  state.entryList = new EntryList();
  state.consoleInputEnter.addEventListener("click", handleInputEnter, false);
  state.consoleInput.addEventListener("keydown", handleInputKeyDown, false);
  state.consoleEntriesFilterDebug.addEventListener("change", handleEntriesFilterChange, false);
  state.consoleEntriesFilterLog.addEventListener("change", handleEntriesFilterChange, false);
  state.consoleEntriesFilterWarn.addEventListener("change", handleEntriesFilterChange, false);
  state.consoleEntriesFilterError.addEventListener("change", handleEntriesFilterChange, false);

  if (state.game.devMode) {
    state.consoleEntriesFilterDebug.checked = true;
    state.consoleEntriesFilterLog.checked = true;
    state.consoleEntriesFilterWarn.checked = true;
    state.consoleEntriesFilterError.checked = true;
    state.entryFilterFlags = (
      EntryType.DEBUG | EntryType.LOG | EntryType.WARN | EntryType.ERROR |
      EntryType.PRINT | EntryType.ECHO
    );
    state.entryList.refresh();
  } else {
    handleEntriesFilterChange();
  }
}

function show(args = {"callback": noop}) {
  state.callback = args.callback;
  global.addEventListener("keydown", handleWindowKeyDown, false);
  state.console.classList.remove("hidden");
  state.consoleInput.value = "";
  state.consoleInput.focus();
  for (let key of Object.keys(state.callbackArgs)) {
    state.callbackArgs[key] = null;
  }
}

function hide() {
  global.removeEventListener("keydown", handleWindowKeyDown, false);
  state.console.classList.add("hidden");
  state.callback(state.callbackArgs);
}

function handleInputEnter() {
  state.shell.interpret(state.consoleInput.value);
  state.consoleInput.value = "";
  state.consoleInput.focus();
}

function handleWindowKeyDown(evt) {
  const key = state.KEY_MAP[evt.key];

  switch (key || evt.which || evt.keyCode) {
    case 192:
      hide();
    break;
  }
}

function handleInputKeyDown(evt) {
  const key = state.KEY_MAP[evt.key];

  switch (key || evt.which || evt.keyCode) {
    case 13:
      handleInputEnter();
    break;
    // ArrowUp
    case 38:
      state.consoleInput.value = state.shell.historyBack() || "";
    break;
    // ArrowDown
    case 40:
      state.consoleInput.value = state.shell.historyForward() || "";
    break;
  }
}

function debug(msg) {
  state.entryList.add(EntryType.DEBUG, msg);
}

function log(msg) {
  state.entryList.add(EntryType.LOG, msg);
}

function warn(msg) {
  state.entryList.add(EntryType.WARN, msg);
}

function error(msg) {
  state.entryList.add(EntryType.ERROR, msg);
}

return {
  "init": init,
  "show": show,
  "debug": debug,
  "log": log,
  "warn": warn,
  "error": error
};

})(window);
