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
  "ECHO":  32,
  "HELP":  64
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
  "textMeasureCanvas": null,
  "callback": null,
  "callbackArgs": Object.seal({
    "level": null,
    "hitpoints": null,
    "shield": null,
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
      },
      "help": function() {
        var msg = "level: level [number]\n";
        msg += "    Gets or sets the game level.";
        state.entryList.add(EntryType.HELP, msg);
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
      },
      "help": function() {
        var msg = "hp: hp [number]\n";
        msg += "    Gets or sets the player hitpoints.";
        state.entryList.add(EntryType.HELP, msg);
      }
    }),
    "shield": Object.freeze({
      "get": function() {
        let sh = state.callbackArgs.shield;
        if (sh === null) {
          sh = state.game.player.shield;
        }
        state.entryList.add(EntryType.PRINT, `shield is ${sh}`);
      },
      "set": function(args) {
        const sh = parseInt(args[1], 10);
        if (!isFinite(sh) || isNaN(sh)) {
          return;
        }
        state.callbackArgs.shield = sh;
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
      },
      "help": function() {
        var msg = "shield: shield [number]\n";
        msg += "    Gets or sets the player shield.";
        state.entryList.add(EntryType.HELP, msg);
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
      },
      "help": function() {
        var msg = "score: score [number]\n";
        msg += "    Gets or sets the game score.";
        state.entryList.add(EntryType.HELP, msg);
      }
    }),
    "state": Object.freeze({
      "get": function() {
        let stat = state.callbackArgs.state;
        if (stat === null) {
          stat = state.game.levelState;
        }
        const statStr = state.LevelState.map(stat);
        state.entryList.add(EntryType.PRINT, `state is ${stat} (${statStr})`);
      },
      "set": function(args) {
        let stat = parseInt(args[1], 10);
        if (isFinite(stat) && !isNaN(stat)) {
          stat = state.LevelState.map(stat);
        } else {
          stat = args[1].toUpperCase();
        }
        state.callbackArgs.state = state.LevelState.map(stat);
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

        const indent = 0;
        const numCols = 3;
        const maxWidth = 80;
        const LevelState = state.LevelState;
        const states = Object.keys(LevelState).filter((el) => typeof LevelState[el] === "number");
        const arg = (args[1] && args[1].toUpperCase()) || null;

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
            const msg = columnizeArgs(matched, indent, numCols, maxWidth);
            state.entryList.add(EntryType.HELP, msg);
          } else if (matched.length === 1) {
            state.consoleInput.value = `${args[0]} ${matched[0]} `;
            state.tabCount = 0;
          }
        } else if (state.tabCount > 0) {
          const msg = columnizeArgs(states, indent, numCols, maxWidth);
          state.entryList.add(EntryType.HELP, msg);
        }
      },
      "help": function() {
        const indent = 4;
        const numCols = 3;
        const maxWidth = 80;
        const LevelState = state.LevelState;
        const states = Object.keys(LevelState).filter((el) => typeof LevelState[el] === "number");
        var msg = "state: state [levelstate]\n";
        msg += "    Gets or sets the level state.\n\n";
        msg += "    The available level states are:\n";
        msg += columnizeArgs(states, indent, numCols, maxWidth);
        state.entryList.add(EntryType.HELP, msg);
      }
    }),
    "echo": Object.freeze({
      "interpret": function(args) {
        const indent = 0;
        const numCols = 3;
        const maxWidth = 80;
        const msg = columnizeArgs(args.slice(1), indent, numCols, maxWidth);
        state.entryList.add(EntryType.PRINT, msg);
      },
      "auto": function() {
        //
      },
      "help": function() {
        var msg = "echo: echo [arg ...]\n";
        msg += "    Prints all given arguments.";
        state.entryList.add(EntryType.HELP, msg);
      }
    }),
    "env": Object.freeze({
      "interpret": function() {
        const vars = Object.keys(variables).sort();
        var msg = "";
        for (let k = 0, n = vars.length; k < n; k += 1) {
          const key = vars[k];
          const val = variables[key];
          if (k < n - 1) {
            msg += `${key}=${val}\n`;
          } else {
            msg += `${key}=${val}`;
          }
        }
        state.entryList.add(EntryType.PRINT, msg);
      },
      "auto": function() {
        //
      },
      "help": function() {
        var msg = "env: env\n";
        msg += "    Dumps all assigned variables.";
        state.entryList.add(EntryType.HELP, msg);
      }
    }),
    "unset": Object.freeze({
      "interpret": function(args) {
        const vars = args.slice(1);
        for (const key of vars) {
          if (key in variables) {
            delete variables[key];
          }
        }
      },
      "auto": function() {
        // TODO autocomplete var names
        const vars = Object.keys(variables);
        const indent = 0;
        const numCols = 3;
        const maxWidth = 80;
        const msg = columnizeArgs(vars, indent, numCols, maxWidth);
        state.entryList.add(EntryType.HELP, msg);
      },
      "help": function() {
        var msg = "unset: unset [name ...]\n";
        msg += "    Unsets the variables passed as arguments.";
        state.entryList.add(EntryType.HELP, msg);
      }
    }),
    "help": Object.freeze({
      "interpret": function(args) {
        if (args.length > 1) {
          const cmd = args[1];
          if (cmd in Commands) {
            Commands[cmd].help();
          }
        } else {
          this.help();
        }
      },
      "auto": function() {
        // TODO add tab completion
      },
      "help": function() {
        const indent = 4;
        const numCols = 3;
        const maxWidth = 80;
        const cmds = Object.keys(Commands).sort();
        var msg = `${state.game.name}\n`;
        msg += "    Enter a command into the console to run it.\n";
        msg += "    Use `help command` to get help with a command.\n";
        msg += "    Use `name=value` to set variables.\n";
        msg += "    Variables can be substituted using the syntax `$name` or `${name}`.\n";
        msg += "    Arguments can be quoted as \"argument\" or 'argument', in addition to the form\n";
        msg += "    $'argument' which accepts escape sequences as ASCII hexadecimal \\xHH\n";
        msg += "    or Unicode hexadecimal \\uHHHH or \\UHHHHHHHH, as well as the\n";
        msg += "    ANSI C short escape codes for tabs and newlines.\n\n";
        msg += "    The available commands are:\n";
        msg += columnizeArgs(cmds, indent, numCols, maxWidth);
        state.entryList.add(EntryType.HELP, msg);
      }
    })
  });

  const variables = Object.create(null);
  const history = [];
  const varCharRegex = new RegExp("[a-zA-Z_]");
  const hexEscapeRegex = new RegExp("\\\\x([0-9A-Fa-f]{1,2})", "g");
  const uniEscapeRegex = new RegExp("\\\\u([0-9A-Fa-f]{1,4})", "g");
  const uniLongEscapeRegex = new RegExp("\\\\U([0-9A-Fa-f]{1,8})", "g");
  const shortEscapeRegex = new RegExp("\\\\([abfnrtv\\\\])", "g");
  const shortEscapeMap = Object.freeze({
    "a":  "\x07",
    "b":  "\x08",
    "f":  "\x0C",
    "n":  "\x0A",
    "r":  "\x0D",
    "t":  "\x09",
    "v":  "\x0B",
    "\\": "\\"
  });
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

  function parseArgs(cmd) {
    cmd = cmd.trimLeft();
    const args = [];
    var current = "";
    for (let k = 0, n = cmd.length; k < n; k += 1) {
      if (cmd[k] === " " && (!k || (k && cmd[k - 1] !== "\\"))) {
        while (k < n - 1 && cmd[k + 1] === " ") {
          k += 1;
        }
        args.push(current);
        current = "";
      } else if (cmd[k] === "\\" && (k < n - 1) && cmd[k + 1] === " ") {
        // continue
      } else if (cmd[k] === "\"" && (!k || (k && cmd[k - 1] !== "\\"))) {
        k += 1;
        while (k < n) {
          if (cmd[k] === "\"" && cmd[k - 1] !== "\\") {
            break;
          } else if (cmd[k] === "\\" && (k < n - 1) && cmd[k + 1] === "\"") {
            k += 1;
          } else {
            current += cmd[k];
            k += 1;
          }
        }
      } else if (cmd[k] === "'" && (!k || (k && (cmd[k - 1] !== "\\") && (cmd[k - 1] !== "$")))) {
        k += 1;
        while (k < n) {
          if (cmd[k] === "'" && cmd[k - 1] !== "\\") {
            break;
          } else if (cmd[k] === "\\" && (k < n - 1) && cmd[k + 1] === "'") {
            k += 1;
          } else {
            current += cmd[k];
            k += 1;
          }
        }
      } else {
        current += cmd[k];
      }
    }
    if (current || cmd[cmd.length - 1] === " ") {
      args.push(current);
    }
    return args;
  }

  function substituteCQuotes(args) {
    const replaceHexEscape = (m, p1) => String.fromCodePoint(parseInt(p1, 16));
    const replaceShortEscape = (m, p1) => shortEscapeMap[p1];

    return args.map(function(arg) {
      if (arg.indexOf("$") > -1) {
        let out = "";
        for (let k = 0, n = arg.length; k < n; k += 1) {
          const prev = arg[k - 1];
          const chr = arg[k];
          const next = arg[k + 1];
          if (chr === "$" && prev !== "\\" && next === "'") {
            k += 2;
            const startPos = k;
            while (k < n && arg[k] !== "'") {
              k += 1;
            }
            const sub = arg.substring(startPos, k)
              .replace(hexEscapeRegex, replaceHexEscape)
              .replace(shortEscapeRegex, replaceShortEscape)
              .replace(uniEscapeRegex, replaceHexEscape)
              .replace(uniLongEscapeRegex, replaceHexEscape);
            out += sub;
          } else {
            out += chr;
          }
        }
        return out;
      }

      return arg;
    });
  }

  function substituteParameters(args) {
    const isVarChar = (chr) => varCharRegex.test(chr);

    return args.map(function(arg) {
      if (arg.indexOf("$") > -1) {
        let out = "";
        for (let k = 0, n = arg.length; k < n; k += 1) {
          const prev = arg[k - 1];
          const chr = arg[k];
          const next = arg[k + 1];
          if (chr === "$" && prev === "\\") {
            out += chr;
          } else if (chr === "$" && next === "{") {
            k += 2;
            const startPos = k;
            while (k < n && arg[k] !== "}") {
              k += 1;
            }
            const va = variables[arg.substring(startPos, k)];
            if (va) {
              out += va;
            } else {
              out += chr;
              k = startPos - 2;
            }
          } else if (chr === "$") {
            k += 1;
            const startPos = k;
            while (k < n && isVarChar(arg[k])) {
              k += 1;
            }
            const va = variables[arg.substring(startPos, k)];
            if (va) {
              out += va;
              k -= 1;
            } else {
              out += chr;
              k = startPos - 1;
            }
          } else {
            out += chr;
          }
        }
        return out;
      }

      return arg;
    });
  }

  function setVariables(args) {
    for (let k = 0, n = args.length; k < n; k += 1) {
      const arg = args[k];
      const eqPos = arg.indexOf("=");
      if (eqPos > 0) {
        const key = arg.substr(0, eqPos);
        const val = arg.substr(eqPos + 1);
        variables[key] = val;
      }
    }
  }

  function interpret(command = "") {
    if (!command) {
      return;
    }
    history.push(command);
    state.entryList.add(EntryType.ECHO, command);
    const args = substituteParameters(substituteCQuotes(parseArgs(command)));

    if (args[0].indexOf("=") > -1) {
      setVariables(args);
      historyIndex = history.length;
      return;
    }

    const cmd = args.length && args[0].toLowerCase();
    if (Commands[cmd]) {
      Commands[cmd].interpret(args);
    }
    historyIndex = history.length;
  }

  function autocomplete(command = "") {
    const indent = 0;
    const numCols = 3;
    const maxWidth = 80;

    if (!command) {
      if (state.tabCount) {
        const msg = columnizeArgs(Object.keys(Commands).sort(), indent, numCols, maxWidth);
        state.entryList.add(EntryType.HELP, msg);
      }
      state.tabCount += 1;
      return;
    }

    const args = parseArgs(command);
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

      if (state.tabCount > 0) {
        const msg = columnizeArgs(matched, indent, numCols, maxWidth);
        state.entryList.add(EntryType.HELP, msg);
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
        state.tabCount += 1;
      } else if (matched.length === 1) {
        state.consoleInput.value = `${matched[0]} `;
        state.tabCount = 0;
      }
    }
  }

  function columnizeArgs(args, indent = 0, numColumns = Infinity, maxWidth = Infinity) {
    const floor = Math.floor;
    const max = Math.max;
    const min = Math.min;
    const maxTextWidth = min(state.entryList.maxTextWidth, maxWidth);
    const spaces = " ".repeat(64);
    var out = "";
    const longestLength = args.reduce((len, el) => max(len, el.length), 0);

    if (longestLength > maxTextWidth) {
      for (let k = 0, n = args.length; k < n; k += 1) {
        out += args[k];
        if (k < n - 1) {
          out += "\n";
        }
      }
    } else {
      let maxCols = floor((maxTextWidth - indent) / longestLength);
      maxCols = floor((maxTextWidth - indent - maxCols + 1) / longestLength);
      maxCols = min(numColumns, maxCols);
      const colWidth = floor((maxTextWidth - indent) / maxCols);

      for (let k = 0, n = args.length; k < n; k += maxCols) {
        out += spaces.slice(0, indent);
        const numCols = min(n - k, maxCols);
        for (let iK = k, iN = k + numCols; iK < iN; iK += 1) {
          const arg = args[iK];
          out += arg;
          if (iK < iN - 1) {
            out += spaces.slice(0, colWidth - arg.length);
          }
        }
        out += "\n";
      }
    }

    return out;
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
    [EntryType.ECHO]:  "console_entry_echo",
    [EntryType.HELP]:  "console_entry_help"
  });
  const entries = [];
  const nodes = [];
  var queuePos = -1;
  var maxTextWidth = 0;

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

  function getMaxTextWidth() {
    const ctx = state.textMeasureCanvas.getContext("2d");
    const width = Math.min(1024, ctx.canvas.width);
    var str = "x";
    var k = 1;
    var metrics = ctx.measureText(str);
    while (metrics.width < width && k < width) {
      str += "x";
      k += 1;
      metrics = ctx.measureText(str);
    }
    return k - 1;
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
    },
    "calcMaxTextWidth": function() {
      maxTextWidth = getMaxTextWidth();
    },
    get maxTextWidth() {
      return maxTextWidth;
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

  state.entryFilterFlags = (
    debug | log | warn | error |
    EntryType.PRINT | EntryType.ECHO | EntryType.HELP
  );
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
  state.textMeasureCanvas = doc.createElement("canvas");
  state.game = args.game;
  state.shell = new Shell();
  state.entryList = new EntryList();
  state.entryList.calcMaxTextWidth();
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
      EntryType.PRINT | EntryType.ECHO | EntryType.HELP
    );
    state.entryList.refresh();
  } else {
    handleEntriesFilterChange();
  }
}

function show(args = {"callback": noop}) {
  state.callback = args.callback;
  global.addEventListener("keydown", handleWindowKeyDown, false);
  global.addEventListener("resize", handleWindowResize, false);
  state.console.classList.remove("hidden");
  state.consoleInput.value = "";
  state.consoleInput.focus();
  state.tabCount = 0;
  for (const key of Object.keys(state.callbackArgs)) {
    state.callbackArgs[key] = null;
  }
  handleWindowResize();
  state.entryList.processQueue();
}

function hide() {
  global.removeEventListener("keydown", handleWindowKeyDown, false);
  global.removeEventListener("resize", handleWindowResize, false);
  state.console.classList.add("hidden");
  state.callback(state.callbackArgs);
}

function handleInputEnter() {
  state.shell.interpret(state.consoleInput.value);
  state.consoleInput.value = "";
  state.consoleInput.focus();
}

function handleWindowResize() {
  const rect = state.consoleEntries.getBoundingClientRect();
  state.textMeasureCanvas.width = rect.width;
  state.textMeasureCanvas.height = rect.height;
  state.entryList.calcMaxTextWidth();
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
