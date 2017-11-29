/* exported Console */

"use strict";

const Console = (function(global) {

const state = Object.seal({
  "KEY_MAP": null,
  "console": null,
  "callback": null
});

function noop() {
  // nada
}

function init(args) {
  state.KEY_MAP = args.KEY_MAP;
  state.console = args.console;
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

return {
  "init": init,
  "show": show
};

})(window);
