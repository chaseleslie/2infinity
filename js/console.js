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

    "Tab":        9,
    "Enter":      13,
    "Alt":        18,
    "Escape":     27,
    "c":          99,
    "F5":         116,
    "`":          192
  }),
  "LevelState": null,
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
  "tabCount": 0,
  "callback": null,
  "callbackArgs": Object.seal({
    "level": null,
    "hitpoints": null,
    "score": null,
    "state": null
  })
});

function noop() {
  // nada
}

function Shell() {
  const Commands = Object.freeze({
    "level": Object.freeze({
      "get": function() {
        let lvl = state.callbackArgs.level;
        if (lvl === null) {
          lvl = state.game.level + 1;
        }
        state.entryList.add(EntryType.PRINT, `lvl is ${lvl}`);
      },
      "set": function(args) {
        const lvl = parseInt(args[1], 10);
        if (!isFinite(lvl) || isNaN(lvl) || lvl < 1 || lvl > state.game.gameData.levels.length) {
          return;
        }
        state.callbackArgs.level = lvl;
      },
      "interpret": function(args) {
        if (args.length > 1) {
          this.set(args);
          this.get(args);
        } else {
          this.get(args);
        }
      },
      "auto": function() {
        //
      }
    }),
    "hp": Object.freeze({
      "get": function() {
        let hp = state.callbackArgs.hitpoints;
        if (hp === null) {
          hp = state.game.player.hitpoints;
        }
        state.entryList.add(EntryType.PRINT, `hp is ${hp}`);
      },
      "set": function(args) {
        const hp = parseInt(args[1], 10);
        if (!isFinite(hp) || isNaN(hp)) {
          return;
        }
        state.callbackArgs.hitpoints = hp;
      },
      "interpret": function(args) {
        if (args.length > 1) {
          this.set(args);
          this.get(args);
        } else {
          this.get(args);
        }
      },
      "auto": function() {
        //
      }
    }),
    "score": Object.freeze({
      "get": function() {
        let score = state.callbackArgs.score;
        if (score === null) {
          score = state.game.score;
        }
        state.entryList.add(EntryType.PRINT, `score is ${score}`);
      },
      "set": function(args) {
        const score = parseInt(args[1], 10);
        if (!isFinite(score) || isNaN(score)) {
          return;
        }
        state.callbackArgs.score = score;
      },
      "interpret": function(args) {
        if (args.length > 1) {
          this.set(args);
          this.get(args);
        } else {
          this.get(args);
        }
      },
      "auto": function() {
        //
      }
    }),
    "state": Object.freeze({
      "get": function() {
        let state = state.callbackArgs.state;
        if (state === null) {
          state = state.game.levelState;
        }
        const statStr = state.LevelState.map(state);
        state.entryList.add(EntryType.PRINT, `state is ${state} (${statStr})`);
      },
      "set": function(args) {
        let state = parseInt(args[1], 10);
        if (isFinite(state) && !isNaN(state)) {
          state = state.LevelState.map(state);
        } else {
          state = args[1].toUpperCase();
        }
        state.callbackArgs.state = state.LevelState.map(state);
      },
      "interpret": function(args) {
        if (args.length > 1) {
          this.set(args);
          this.get(args);
        } else {
          this.get(args);
        }
      },
      "auto": function(args) {
        if (args.length > 2) {
          return;
        }

        const LevelState = state.LevelState;
        const states = Object.keys(LevelState).filter((el) => typeof LevelState[el] === "number");
        const arg = args[1].toUpperCase();

        if (arg) {
          const matched = states.filter((el) => el.indexOf(arg) === 0).sort();
          if (matched.length > 1) {
            const first = matched[0];
            const last = matched[matched.length - 1];
            let len = 0;
            while (first[len] === last[len]) {
              len += 1;
            }
            const common = first.substr(0, len);
            state.consoleInput.value = `${args[0]} ${common}`;
            state.entryList.add(EntryType.PRINT, serializeArgs(matched));
          } else if (matched.length === 1) {
            state.consoleInput.value = `${args[0]} ${matched[0]} `;
            state.tabCount = 0;
          }
        } else if (state.tabCount > 0) {
          const msg = serializeArgs(states);
          state.entryList.add(EntryType.PRINT, msg);
        }
      }
    })
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

  function serializeArgs(args, padding = "  ") {
    var msg = "";
    for (let k = 0, n = args.length; k < n; k += 1) {
      msg += args[k];
      if (k < n - 1) {
        msg += padding;
      }
    }
    return msg;
  }

  function interpret(command = "") {
    if (!command) {
      return;
    }

    history.push(command);
    state.entryList.add(EntryType.ECHO, command);
    const args = command.split(" ");
    const cmd = args.length && args[0].toLowerCase();
    if (Commands[cmd]) {
      Commands[cmd].interpret(args);
    }
    historyIndex = history.length;
  }

  function autocomplete(command = "") {
    if (!command) {
      if (state.tabCount) {
        let msg = "";
        for (const key of Object.keys(Commands)) {
          msg += `${key}  `;
        }
        state.entryList.add(EntryType.PRINT, msg);
      }
      state.tabCount += 1;
      return;
    }

    const args = command.split(" ");
    if (args.length > 1) {
      if (state.tabCount || args[args.length - 1]) {
        const cmd = args[0].toLowerCase();
        if (Commands[cmd]) {
          Commands[cmd].auto(args);
        }
      }
      state.tabCount += 1;
    } else {
      const cmd = args[0].toLowerCase();
      const matched = Object.keys(Commands).filter((el) => el.indexOf(cmd) === 0);
      const msg = serializeArgs(matched);

      if (state.tabCount > 0) {
        state.entryList.add(EntryType.PRINT, msg);
      } else if (matched.length > 1) {
        matched.sort();
        const first = matched[0];
        const last = matched[matched.length - 1];
        let len = 0;
        while (first[len] === last[len]) {
          len += 1;
        }
        const common = first.substr(0, len);
        state.consoleInput.value = `${common}`;
      } else if (matched.length === 1) {
        state.consoleInput.value = `${matched[0]} `;
        state.tabCount = 0;
      }
    }

  }

  return Object.freeze({
    "interpret": interpret,
    "autocomplete": autocomplete,
    "historyBack": historyBack,
    "historyForward": historyForward
  });
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
  var queuePos = -1;

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
    "queue": function(type, msg) {
      if (queuePos < 0) {
        queuePos = entries.length;
      }
      const now = Date.now();
      const entry = new Entry(type, msg, now);
      entries.push(entry);
    },
    "processQueue": function() {
      if (queuePos >= 0) {
        for (let k = queuePos, n = entries.length; k < n; k += 1) {
          let entry = entries[k];
          addNode(entry);
        }
        queuePos = -1;
      }
    },
    "clear": function() {
      const parent = state.consoleEntries;
      let child = parent.lastChild;
      while (child) {
        parent.removeChild(child);
        child = parent.lastChild;
      }
    },
    "refresh": function() {
      this.clear();

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

/**
@param {object} args Init arguments
@this Console
@returns {undefined} Returns
*/
function init(args) {
  state.LevelState = args.LevelState;
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
  state.tabCount = 0;
  for (let key of Object.keys(state.callbackArgs)) {
    state.callbackArgs[key] = null;
  }
  state.entryList.processQueue();
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
  var wasTab = false;
  var preventDefault = false;

  switch (key || evt.which || evt.keyCode) {
    // Tab
    case 0x09:
      state.shell.autocomplete(state.consoleInput.value);
      wasTab = true;
      preventDefault = true;
    break;
    // Enter
    case 13:
      handleInputEnter();
    break;
    // ArrowUp
    case 38:
      state.consoleInput.value = state.shell.historyBack() || "";
      preventDefault = true;
    break;
    // ArrowDown
    case 40:
      state.consoleInput.value = state.shell.historyForward() || "";
      preventDefault = true;
    break;
    // c
    case 99:
      if (evt.ctrlKey) {
        state.consoleInput.value = "";
      }
    break;
  }

  if (!wasTab) {
    state.tabCount = 0;
  }

  if (preventDefault) {
    evt.preventDefault();
  }
}

function debug(msg) {
  state.entryList.queue(EntryType.DEBUG, msg);
}

function log(msg) {
  state.entryList.queue(EntryType.LOG, msg);
}

function warn(msg) {
  state.entryList.queue(EntryType.WARN, msg);
}

function error(msg) {
  state.entryList.queue(EntryType.ERROR, msg);
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
