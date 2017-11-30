/* exported Console */

"use strict";

const Console = (function(global) {

const doc = global.document;

const EntryType = Object.freeze({
  "DEBUG": 0,
  "LOG":   1,
  "WARN":  2,
  "ERROR": 3,
  "PRINT": 4
});

const EntryTypeString = Object.freeze({
  [EntryType.DEBUG]: "DEBUG ",
  [EntryType.LOG]:   "LOG   ",
  [EntryType.WARN]:  "WARN  ",
  [EntryType.ERROR]: "ERROR ",
  [EntryType.PRINT]: "      "
});

const state = Object.seal({
  "KEY_MAP": null,
  "console": null,
  "consoleEntries": null,
  "consoleInput": null,
  "consoleInputEnter": null,
  "game": null,
  "shell": null,
  "entryList": null,
  "callback": null
});

function noop() {
  // nada
}

function Shell() {
  const Commands = Object.freeze({
    "setlvl": setLevel,
    "sethp": setHitpoints
  });
  const history = [];

  function setLevel(args) {
    if (args.length > 1) {
      console.log("setLevel()", args);
    }
  }

  function setHitpoints(args) {
    if (args.length > 1) {
      console.log("setHitpoints()", args);
    }
  }

  function interpret(command = "") {
    history.push(command);
    state.entryList.add(EntryType.PRINT, command);
    const args = command.split(" ");
    const cmd = args[0];
    if (Commands[cmd]) {
      Commands[cmd](args);
    }
  }

  return {"interpret": interpret};
}

function EntryList() {
  const entries = [];
  const nodes = [];

  function addNode(entry) {
    const node = doc.createElement("div");
    node.classList.add("console_entry");
    node.textContent = formatEntry(entry);
    nodes.push(node);
    state.consoleEntries.appendChild(node);
    node.scrollIntoView({"block": "end", "behavior": "smooth"});
  }

  function formatEntry(entry) {
    const date = new Date(entry.ts);
    const hours = `0${date.getHours()}`.substr(-2);
    const minutes = `0${date.getMinutes()}`.substr(-2);
    const ts = entry.type === EntryType.PRINT ? "" : `[${hours}:${minutes}] `;
    const header = entry.type === EntryType.PRINT ? "" : `${EntryTypeString[entry.type]}${ts}`;
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
    }
  };
}

function Entry(type, msg, ts) {
  this.type = type;
  this.msg = msg;
  this.ts = ts;
}

function init(args) {
  state.KEY_MAP = args.KEY_MAP;
  state.console = args.console;
  state.consoleEntries = args.consoleEntries;
  state.consoleInput = args.consoleInput;
  state.consoleInputEnter = args.consoleInputEnter;
  state.game = args.game;
  state.shell = new Shell();
  state.entryList = new EntryList();
  state.consoleInputEnter.addEventListener("click", function() {
    state.shell.interpret(state.consoleInput.value);
    state.consoleInput.value = "";
  }, false);
}

function show(args = {"callback": noop}) {
  state.callback = args.callback;
  global.addEventListener("keydown", handleKeyDown, false);
  state.console.classList.remove("hidden");
}

function hide() {
  global.removeEventListener("keydown", handleKeyDown, false);
  state.console.classList.add("hidden");
  state.callback();
}

function handleKeyDown(evt) {
  const key = state.KEY_MAP[evt.key];

  switch (key) {
    case 192:
      hide();
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
