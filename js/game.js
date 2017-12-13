/* global Console Utils Splash Weapon Player Enemy Boss StarMap */

"use strict";

(function(win, doc) {

const global = win;
const canvas = doc.getElementById("glcanvas");
const canvasOverlay = doc.getElementById("glcanvas_overlay");
const canvasOverlayCtx = canvasOverlay.getContext("2d");
const gameAudio = doc.getElementById("game_audio");
const gameConsole = doc.getElementById("console");
const gameConsoleEntries = doc.getElementById("console_entries");
const gameConsoleEntriesFilterDebug = doc.getElementById("console_entries_filter_debug");
const gameConsoleEntriesFilterLog = doc.getElementById("console_entries_filter_log");
const gameConsoleEntriesFilterWarn = doc.getElementById("console_entries_filter_warn");
const gameConsoleEntriesFilterError = doc.getElementById("console_entries_filter_error");
const gameConsoleInput = doc.getElementById("console_input");
const gameConsoleInputEnter = doc.getElementById("console_input_enter");
const menu = doc.getElementById("menu");
const menuResume = doc.getElementById("menu_resume");
const menuRestart = doc.getElementById("menu_restart");
const menuDisplayFPS = doc.getElementById("menu_display_fps");
const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
const point = Object.seal({"x": 0, "y": 0, "z": 0});
const zProjection = 1;
const aspect = canvas.width / canvas.height;
const devMode = global.location.hash.indexOf("#dev") === 0;

const KEY_MAP = Object.freeze({
  "ArrowLeft":  37,
  "Left":       37,
  "a":          37,
  "ArrowUp":    38,
  "Up":         38,
  "w":          38,
  "ArrowRight": 39,
  "Right":      39,
  "d":          39,
  "ArrowDown":  40,
  "Down":       40,
  "s":          40,

  "c":          99,
  "m":          109,
  "Enter":      13,
  "Escape":     27,
  "Tab":        9,
  "Alt":        18,
  "F5":         116,
  " ":          32,
  "`":          192
});

const defaultFontSize = 32;
canvasOverlayCtx.fillStyle = "#FFF";
canvasOverlayCtx.font = `${defaultFontSize}px sans-serif`;
var canvasOverlayProps = Object.seal({
  "canvasOverlayFont":      `${defaultFontSize}px monospace`,
  "scoreTemplateStr":       "Score: 000000",
  "scoreTemplateStrProps":  null,
  "scoreTemplateNumDigits": 6,
  "fpsTemplateStr":         "fps: 0000",
  "fpsTemplateStrProps":    null,
  "fpsTemplateNumDigits":   4,
  "hpWidthScale":           0.125, // 1 / 8
  "hpHeightScale":          0.022222222222 // 1 / 45
});
canvasOverlayCtx.save();
canvasOverlayCtx.font = canvasOverlayProps.canvasOverlayFont;
canvasOverlayProps.scoreTemplateStrProps = canvasOverlayCtx.measureText(canvasOverlayProps.scoreTemplateStr);
canvasOverlayProps.fpsTemplateStrProps = canvasOverlayCtx.measureText(canvasOverlayProps.fpsTemplateStr);
canvasOverlayCtx.restore();

const OverlayFlags = Object.freeze({
  "INCREMENT":       0b00000001,
  "DECREMENT":       0b00000010,
  "SCORE_DIRTY":     0b00000100,
  "HP_DIRTY":        0b00001000,
  "FPS_DIRTY":       0b00010000,
  "BOSS_NAME_DIRTY": 0b00100000,
  "BOSS_HP_DIRTY":   0b01000000
});

const LevelState = Object.freeze({
  "INTRO":      0,
  "PLAYING":    1,
  "END":        2,
  "BOSS_INTRO": 3,
  "BOSS":       4,
  "GAME_OVER":  5,
  "map": function(arg) {
    let val = null;
    if (typeof arg === "number") {
      for (let key of Object.keys(this)) {
        if (this[key] === arg) {
          val = key;
          break;
        }
      }
    } else if (typeof arg === "string") {
      for (let key of Object.keys(this)) {
        if (key === arg) {
          val = this[key];
          break;
        }
      }
    }
    return val;
  }
});

const Difficulty = Object.freeze({
  "EASY":   1,
  "MEDIUM": 2,
  "HARD":   3
});

const difficultyMap = Object.freeze({
  "prediv": Object.freeze({
    [Difficulty.EASY]:   1.0,
    [Difficulty.MEDIUM]: 1/2.0,
    [Difficulty.HARD]:   1/3.0
  }),
  "spawnIntervalMult": Object.freeze({
    [Difficulty.EASY]:   1,
    [Difficulty.MEDIUM]: 0.75,
    [Difficulty.HARD]:   0.5
  })
});

const Game = {
  "devMode": devMode,
  "difficulty": Difficulty.EASY,
  "difficultyMap": difficultyMap,
  "aspect": aspect,
  "recipAspect": 1 / aspect,
  "zProjection": zProjection,
  "level": 0,
  "score": 0,
  "timestep": 10,
  "levelState": LevelState.INTRO,
  "time": 0,
  "accumulator": 0,
  "frame": 0,
  "startTs": 0,
  "lastTs": 0,
  "pauseTs": 0,
  "averageFrameInterval": new Utils.ExponentialAverage(0.7, 0),
  "running": false,
  "isMenuShown": false,
  "animFrame": null,
  "overlayState": Object.seal({
    "flag": OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY,
    "indicatorFrameCountMax": 64,
    "playerIndicatorFrameCount": 0,
    "bossIndicatorFrameCount": 0
  }),
  "overlayLastTs": 0,
  "displayFPS": false,
  "muted": false,
  "keydownMap": Object.seal({
    "ArrowLeft": 0,
    "ArrowUp": 0,
    "ArrowRight": 0,
    "ArrowDown": 0,
    "Escape": 0,
    "Shoot": 0,
    "Dive": 0
  }),
  "textures": {
    "ship": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": [
        new Float32Array([
          0.0, 0.0,
          0.375, 0.25,
          0.0, 0.5
        ]),
        new Float32Array([
          0.5, 0.0,
          0.875, 0.25,
          0.5, 0.5
        ])
      ],
      "coordBuffers": [],
      "SHIP_IDLE": 0,
      "SHIP_ACTIVE": 1
    },
    "enemyShip": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": [
        new Float32Array([
          0.0, 0.0,
          0.375, 0.25,
          0.0, 0.5
        ]),
        new Float32Array([
          0.5, 0.0,
          0.875, 0.25,
          0.5, 0.5
        ])
      ],
      "coordBuffers": [],
      "ENEMY_SHIP_BASIC": 0,
      "ENEMY_SHIP_FIGHTER": 1
    },
    "boss": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": [
        new Float32Array([
          0.0, 0.0,
          0.375, 0.25,
          0.0, 0.5
        ]),
        new Float32Array([
          0.5, 0.0,
          0.875, 0.25,
          0.5, 0.5
        ])
      ],
      "coordBuffers": [],
      "BOSS_SHIP_IDLE": 0,
      "BOSS_SHIP_ACTIVE": 1
    },
    "explosion": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": [
        new Float32Array([
          0.0, 1.0,
          1.0, 1.0,
          1.0, 0.0,

          0.0, 1.0,
          1.0, 0.0,
          0.0, 0.0
        ])
      ],
      "coordBuffers": []
    },
    "projectile": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": null,
      "coordBuffers": [],
      "PROJ_BASIC_BLUE": 0,
      "PROJ_BASIC_RED": 1,
      "PROJ_BASIC_GREEN": 2,
      "PROJ_BASIC_GRAY": 3
    },
    "star": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": [
        new Float32Array([
          0.0, 1.0,
          1.0, 1.0,
          1.0, 0.0,

          0.0, 1.0,
          1.0, 0.0,
          0.0, 0.0
        ])
      ],
      "coordBuffers": []
    },
    "circle": {
      "tex": null,
      "texId": 0,
      "texIdIndex": 0,
      "img": null,
      "coords": null,
      "coordBuffers": []
    },
    "texCoordAttrib": null,
    "numTextures": 0
  },
  "textureUniform": null,

  "modelScale": 0.125,
  "fragShader": null,
  "vertShader": null,
  "shaderProg": null,
  "vertexPositionAttrib": 0,

  //Verts top leftmost clockwise; triangle width approx. height * sqrt(2)/2
  "vertexTriangleBufferObject": gl.createBuffer(),
  "verticesTriangle": new Float32Array([
    -1.0, 1.0, 0.0,
    0.5, 0.0, 0.0,
    -1.0, -1.0, 0.0
  ]),
  "verticesTriangleSub": [
    new Float32Array([-1.0, 1.0, 0.0]),
    new Float32Array([0.5, 0.0, 0.0]),
    new Float32Array([-1.0, -1.0, 0.0])
  ],

  "vertexCircleBufferObject": gl.createBuffer(),
  "verticesCircle": null,

  //Verts top leftmost clockwise; top triangle then bottom
  "vertexRectangleBufferObject": gl.createBuffer(),
  "verticesRectangle": new Float32Array([
    -1.0, 1.0, 0.0,
    1.0, 1.0, 0.0,
    1.0, -1.0, 0.0,

    -1.0, 1.0, 0.0,
    1.0, -1.0, 0.0,
    -1.0, -1.0, 0.0
  ]),
  "verticesRectangleSub": [
    new Float32Array([-1.0, 1.0, 0.0]),
    new Float32Array([1.0, 1.0, 0.0]),
    new Float32Array([1.0, -1.0, 0.0]),

    new Float32Array([-1.0, 1.0, 0.0]),
    new Float32Array([1.0, -1.0, 0.0]),
    new Float32Array([-1.0, -1.0, 0.0])
  ],

  "pUniform": null,
  "mvUniform": null,

  "pUniformMatrix": new Float32Array([
    1.0 / aspect, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, zProjection,
    0.0, 0.0, 0.0, 1.0
  ]),

  "player": null,
  "players": [],
  "levelEnemies": [],
  "enemies": [],
  "enemyWeapons": [],
  "findEnemyWeapon": findEnemyWeapon,
  "bosses": [],
  "stars": [],
  "starMap": null,
  "numStars": 256,
  "projectiles": [],
  "projectileLastTs": 0
};

Splash.init({
  "KEY_MAP": KEY_MAP,
  "aspect": aspect
});

Console.init({
  "LevelState": LevelState,
  "game": Game,
  "console": gameConsole,
  "consoleEntries": gameConsoleEntries,
  "consoleEntriesFilterDebug": gameConsoleEntriesFilterDebug,
  "consoleEntriesFilterLog": gameConsoleEntriesFilterLog,
  "consoleEntriesFilterWarn": gameConsoleEntriesFilterWarn,
  "consoleEntriesFilterError": gameConsoleEntriesFilterError,
  "consoleInput": gameConsoleInput,
  "consoleInputEnter": gameConsoleInputEnter
});

var circleCoords = Utils.createCircleVertices({x: 0, y: 0, z: 0}, 360, 1);
Game.verticesCircle = circleCoords.vertices;
Game.textures.circle.coords = [circleCoords.tex];

Console.debug("Fetching game data");
Game.gameData = null;
var gameDataURL = "js/game_data.json";
gameDataURL += (win.location.hash === "#dev") ? `?ts=${Date.now()}` : "" ;
Utils.fetchURL({
  "method": "GET",
  "url": gameDataURL,
  "responseType": "json",
  "callback": function(xhr) {
    if (xhr.status === 200) {
      Game.gameData = xhr.response;
      setup(Game, gl);
    } else {
      Console.error(`Error: fetching game data failed with status ${xhr.status}`);
      console.error(xhr);
    }
  }
});

function handleKeyDown(e) {
  var ret;
  var now = win.performance.now();
  var keydownMap = Game.keydownMap;
  var key = KEY_MAP[e.key];

  switch (key || e.which || e.keyCode) {
    // ArrowLeft / a
    case 37:
    case 97:
      keydownMap["ArrowLeft"] = keydownMap["ArrowLeft"] || now;
      e.preventDefault();
    break;
    // ArrowUp / w
    case 38:
    case 119:
      keydownMap["ArrowUp"] = keydownMap["ArrowUp"] || now;
      e.preventDefault();
    break;
    // ArrowRight / d
    case 39:
    case 100:
      keydownMap["ArrowRight"] = keydownMap["ArrowRight"] || now;
      e.preventDefault();
    break;
    // ArrowDown / s
    case 40:
    case 115:
      keydownMap["ArrowDown"] = keydownMap["ArrowDown"] || now;
      e.preventDefault();
    break;
    // Space
    case 32:
      keydownMap["Shoot"] = keydownMap["Shoot"] || now;
      e.preventDefault();
    break;
    // c
    case 99:
      keydownMap["Dive"] = keydownMap["Dive"] || now;
      e.preventDefault();
    break;
    // Escape
    case 27:
      stop();
      showMenu();
      e.preventDefault();
      e.stopPropagation();
      ret = false;
    break;
    // m
    case 109:
      Game.muted = !Game.muted;
      e.preventDefault();
    break;
    // Backtick
    case 192:
    stop();
    showConsole();
    e.preventDefault();
    e.stopPropagation();
    break;
  }
  return ret;
}
function handleKeyUp(e) {
  var key = KEY_MAP[e.key];
  switch (key || e.which || e.keyCode) {
    // ArrowLeft / a
    case 37:
    case 97:
      Game.keydownMap["ArrowLeft"] = 0;
    break;
    // ArowUp / w
    case 38:
    case 119:
      Game.keydownMap["ArrowUp"] = 0;
    break;
    // ArrowRight / d
    case 39:
    case 100:
      Game.keydownMap["ArrowRight"] = 0;
    break;
    // ArrowDown / s
    case 40:
    case 115:
      Game.keydownMap["ArrowDown"] = 0;
    break;
    // Space
    case 32:
      Game.keydownMap["Shoot"] = 0;
    break;
    // c
    case 99:
      Game.keydownMap["Dive"] = 0;
      e.preventDefault();
    break;
  }
}

function loadSettings(Game) {
  var settings = null;
  try {
    settings = global.localStorage.getItem("settings");
    settings = JSON.parse(settings);
  } catch (e) {
    settings = null;
  }

  if (settings) {
    if ("muted" in settings) {
      Game.muted = settings.muted;
    }
    if ("displayFPS" in settings) {
      Game.displayFPS = settings.displayFPS;
      if (settings.displayFPS) {
        menuDisplayFPS.classList.add("checked");
        menuDisplayFPS.classList.remove("unchecked");
      }
    }
  }
}
function saveSettings(Game) {
  var settings = {
    "muted": Game.muted,
    "displayFPS": Game.displayFPS
  };
  try {
    global.localStorage.setItem(
      "settings",
      JSON.stringify(settings)
    );
  } catch (e) {}
}
loadSettings(Game);
global.onbeforeunload = function() {
  saveSettings(Game);
};

function clearAllLevels() {
  const levels = Game.gameData.levels;
  for (let k = 0, n = levels.length; k < n; k += 1) {
    clearLevel(k);
  }
}

function clearLevel(lvl) {
  const now = global.performance.now();
  const levelEnemies = Game.levelEnemies;
  const lastTs = levelEnemies[lvl].lastTs;
  for (let k = 0, n = lastTs.length; k < n; k += 1) {
    lastTs[k] = now;
  }
}

function clearEnemies() {
  const enemies = Game.enemies;
  for (let k = 0, n = enemies.length; k < n; k += 1) {
    const enemy = enemies[k];
    enemy.reset(0, false);
  }
}

function clearBosses() {
  const bosses = Game.bosses;
  for (let k = 0, n = bosses.length; k < n; k += 1) {
    const boss = bosses[k];
    boss.reset(k, false);
  }
}

function showConsole() {
  canvas.classList.add("inactive");
  canvasOverlay.classList.add("inactive");
  Console.show({"callback": hideConsole});
}

function hideConsole(args) {
  const game = Game;
  canvas.classList.remove("inactive");
  canvasOverlay.classList.remove("inactive");

  if (args.level !== null) {
    clearEnemies();
    clearBosses();
    game.level = args.level - 1;
    game.levelState = LevelState.INTRO;
    clearAllLevels();
  }

  if (args.hitpoints !== null) {
    game.player.hitpoints = args.hitpoints;
    game.overlayState.flag |= OverlayFlags.HP_DIRTY;
  }

  if (args.score !== null) {
    game.score = args.score;
    game.overlayState.flag |= OverlayFlags.SCORE_DIRTY;
  }

  if (args.state !== null) {
    const prevState = game.levelState;
    game.levelState = args.state;
    switch(prevState) {
      case LevelState.INTRO:
      case LevelState.PLAYING:
      case LevelState.END:
        clearAllLevels();
        clearEnemies();
      break;
      case LevelState.BOSS_INTRO:
      case LevelState.BOSS:
        clearBosses();
      break;
    }

    switch (game.levelState) {
      case LevelState.BOSS_INTRO:
      case LevelState.BOSS:
        Game.bosses[Game.level].reset(Game.level, true);
      break;
    }
  }

  setTimeout(start, 0);
}

function onMenuScroll(e) {
  var menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
  var selectedIndex = -1;
  var key = KEY_MAP[e.key];

  switch (key || e.which || e.keyCode) {
    // ArrowUp / ArrowDown / Enter
    case 38:
    case 40:
    case 13:
      e.preventDefault();
    break;
    // Escape
    case 27:
      e.preventDefault();
      e.stopPropagation();
      onMenuResume();
      return;

    default:
      return;
  }

  for (let k = 0; k < menuItems.length; k += 1) {
    if (menuItems[k].classList.contains("selected")) {
      selectedIndex = k;
      break;
    }
  }
  if (selectedIndex === -1 && menuItems.length) {
    selectedIndex = 0;
  }
  for (let k = 0; k < menuItems.length; k += 1) {
    menuItems[k].classList.remove("selected");
  }

  switch (key || e.which || e.keyCode) {
    // ArrowUp
    case 38:
      if (selectedIndex > 0) {
        selectedIndex -= 1;
      } else {
        selectedIndex = menuItems.length - 1;
      }
      menuItems[selectedIndex].classList.add("selected");
    break;
    // ArrowDown
    case 40:
      if (selectedIndex < (menuItems.length - 1)) {
        selectedIndex += 1;
      } else {
        selectedIndex = 0;
      }
      menuItems[selectedIndex].classList.add("selected");
    break;
    // Enter
    case 13:
      menuItems[selectedIndex].click();
    break;
  }
}
function onMenuScrollWheel(e) {
  var now = win.performance.now();
  var lastTs = parseFloat(onMenuScrollWheel.lastTs) || 0;

  if (now < lastTs + 200) {
    e.preventDefault();
    return;
  }
  onMenuScrollWheel.lastTs = now;

  if (e.deltaY > 0) {
    e.key = "ArrowDown";
    e.keyCode = 40;
    onMenuScroll(e);
  } else {
    e.key = "ArrowUp";
    e.keyCode = 38;
    onMenuScroll(e);
  }
}

function showMenu() {
  var menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
  menuItems.forEach((el) => {el.classList.remove("selected");});
  menuItems[0].classList.add("selected");
  window.addEventListener("keydown", onMenuScroll, false);
  window.addEventListener("wheel", onMenuScrollWheel, false);

  Game.isMenuShown = true;
  canvasOverlay.classList.add("inactive");
  canvas.classList.add("inactive");
  menu.classList.remove("hidden");
  var menuRect = menu.getBoundingClientRect();
  var canvasRect = canvas.getBoundingClientRect();
  menu.style.top = canvas.offsetTop + (canvasRect.height / 2) - (menuRect.height / 2) + "px";
  menu.style.left = canvas.offsetLeft + (canvasRect.width / 2) - (menuRect.width / 2) + "px";
}
function hideMenu() {
  Game.isMenuShown = false;
  menu.classList.add("hidden");
  canvasOverlay.classList.remove("inactive");
  canvas.classList.remove("inactive");

  window.removeEventListener("keydown", onMenuScroll, false);
  window.removeEventListener("wheel", onMenuScrollWheel, false);
}
function onMenuResume() {
  hideMenu();
  start();
}
function onMenuRestart() {
  hideMenu();
  stop();
  start();
  restart();
}
function onMenuDisplayFPS(e) {
  e.target.classList.toggle("checked");
  e.target.classList.toggle("unchecked");
  Game.displayFPS = !Game.displayFPS;
  Game.overlayState.flag |= OverlayFlags.FPS_DIRTY;
  hideMenu();
  start();
}
function onMenuMousedown(e) {
  e.target.classList.add("clicked");
}
function onMenuMouseup(e) {
  e.target.classList.remove("clicked");
}
function onMenuMouseleave(e) {
  e.target.classList.remove("clicked");
}

menuResume.addEventListener("click", onMenuResume, false);
menuRestart.addEventListener("click", onMenuRestart, false);
menuDisplayFPS.addEventListener("click", onMenuDisplayFPS, false);
menuResume.addEventListener("mousedown", onMenuMousedown, false);
menuResume.addEventListener("mouseup", onMenuMouseup, false);
menuResume.addEventListener("mouseleave", onMenuMouseleave, false);
menuRestart.addEventListener("mousedown", onMenuMousedown, false);
menuRestart.addEventListener("mouseup", onMenuMouseup, false);
menuRestart.addEventListener("mouseleave", onMenuMouseleave, false);
menuDisplayFPS.addEventListener("mousedown", onMenuMousedown, false);
menuDisplayFPS.addEventListener("mouseup", onMenuMouseup, false);
menuDisplayFPS.addEventListener("mouseleave", onMenuMouseleave, false);

function start() {
  if (!Game.running) {
    Game.overlayState.flag |= OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY;
    doc.body.addEventListener("keydown", handleKeyDown, false);
    doc.body.addEventListener("keyup", handleKeyUp, false);
    Game.startTs = global.performance.now();
    Game.running = true;
    preStart(Game, Game.startTs);
    main(Game.startTs);
  }
}

function preStart(Game, ts) {
  Game.lastTs = ts;
  var levelEnemies = Game.levelEnemies[Game.level];
  var pauseTs = Game.pauseTs;
  for (let k = 0; k < levelEnemies.lastTs.length; k += 1) {
    if (pauseTs) {
      levelEnemies.lastTs[k] = ts - (pauseTs - levelEnemies.lastTs[k]);
    } else {
      levelEnemies.lastTs[k] = ts;
    }
  }
}

function stop() {
  doc.body.removeEventListener("keydown", handleKeyDown, false);
  doc.body.removeEventListener("keyup", handleKeyUp, false);
  Game.pauseTs = global.performance.now();
  Game.running = false;
  global.cancelAnimationFrame(Game.animFrame);
  Game.keydownMap["ArrowLeft"] = 0;
  Game.keydownMap["ArrowUp"] = 0;
  Game.keydownMap["ArrowRight"] = 0;
  Game.keydownMap["ArrowDown"] = 0;
  Game.keydownMap["Shoot"] = 0;
  Game.keydownMap["Dive"] = 0;
}

function restart() {
  Game.player.resetGame(global.performance.now());
  Game.projectiles = [];
  Game.enemies = [];
  Game.score = 0;
  Game.pauseTs = 0;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function main(ts) {
  if (Game.levelState === LevelState.INTRO) {
    Game.levelState = LevelState.PLAYING;
    global.cancelAnimationFrame(Game.animFrame);
    stop();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const img = doc.getElementById("img_ship");
    Splash.start({
      "canvasOverlay": canvasOverlay,
      "canvasOverlayCtx": canvasOverlayCtx,
      "callback": start,
      "img": img,
      "imgX": 0,
      "imgY": 0,
      "imgWidth": parseInt(img.dataset.unitSize, 10),
      "imgHeight": parseInt(img.dataset.unitSize, 10),
      "text": Game.gameData.levels[Game.level].introText
    });
    return;
  } else if (Game.levelState === LevelState.BOSS_INTRO) {
    Game.levelState = LevelState.BOSS;
    Game.overlayState.flag |= OverlayFlags.BOSS_HP_DIRTY;
    global.cancelAnimationFrame(Game.animFrame);
    stop();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const trunc = Math.trunc;
    const img = doc.getElementById("img_boss");
    const imgUnitSize = parseInt(img.dataset.unitSize, 10);
    const bossData = Game.gameData.bosses[Game.level];
    const imgSpritePos = bossData.spritePos;
    const ROOT_TWO = Math.sqrt(2);
    const aspect = Game.aspect;
    const canvasWidth = canvasOverlay.width;
    const canvasHeight = canvasOverlay.height;
    const destWidth = trunc(
      bossData.modelScales[0] * Game.modelScale *
      (canvasWidth / aspect) / ROOT_TWO / aspect
    );
    const destHeight = trunc(
      bossData.modelScales[1] * Game.modelScale * canvasHeight
    );
    Splash.bossIntro({
      "canvasOverlay": canvasOverlay,
      "canvasOverlayCtx": canvasOverlayCtx,
      "callback": start,
      "img": img,
      "srcX": imgSpritePos[0] * imgUnitSize,
      "srcY": imgSpritePos[1] * imgUnitSize,
      "srcWidth": imgUnitSize / ROOT_TWO,
      "srcHeight": imgUnitSize,
      "imgRotation": Math.PI,
      "destWidth": destWidth,
      "destHeight": destHeight,
      "canvasX": 0.5 * (bossData.spawnPos[0] + 1) * canvasWidth - destWidth * ROOT_TWO,
      "canvasY": 0.5 * (bossData.spawnPos[1] + 1) * canvasHeight - 0.5 * destHeight,
      "text": Game.gameData.levels[Game.level].bossText
    });
    return;
  } else if (Game.levelState === LevelState.GAME_OVER) {
    console.log("Game Over");
    return;
  }

  Game.animFrame = global.requestAnimationFrame(main);

  var dt = ts - Game.lastTs;
  Game.time += dt;
  var timestep = Game.timestep;

  Game.averageFrameInterval.update((ts - Game.lastTs) || 0);

  var overlayNeedsUpdating = Boolean(Game.displayFPS);
  if (overlayNeedsUpdating && (ts > Game.overlayLastTs + 1000)) {
    Game.overlayState.flag |= OverlayFlags.FPS_DIRTY;
    Game.overlayLastTs = ts;
  }

  var frameTime = ts - Game.lastTs;
  if (frameTime > 250) {
    frameTime = 250;
  }
  // var accumulator = frameTime;
  Game.accumulator += frameTime;
  while (Game.accumulator >= timestep) {
    update(Game, ts, timestep);
    Game.time += timestep;
    Game.accumulator -= timestep;
  }

  Game.lastTs = ts;

  draw(Game);

  Game.frame += 1;
}

function update(Game, ts, dt) {
  var player = Game.player;
  var enemies = null;
  if (Game.levelState === LevelState.PLAYING || Game.levelState === LevelState.END) {
    enemies = Game.enemies;
  } else if (Game.levelState === LevelState.BOSS) {
    enemies = Game.bosses;
  } else {
    return;
  }

  /* Update player */
  player.update(dt);
  var score = 0;
  var playerWeapons = player.weapons;
  for (let k = 0, n = playerWeapons.length; k < n; k += 1) {
    score += playerWeapons[k].update(dt, enemies);
    if (score && Game.levelState === LevelState.BOSS) {
      Game.overlayState.flag |= OverlayFlags.BOSS_HP_DIRTY | OverlayFlags.DECREMENT;
    }
  }
  if (score) {
    updateScore(Game, score);
  }
  var playerHitbox = player.hitbox;

  /* Update enemies */
  score = 0;
  for (let k = enemies.length - 1; k >= 0; k -= 1) {
    let enemy = enemies[k];
    if (!enemy.active) {
      continue;
    }
    let hitScore = -enemy.update(dt);
    if (hitScore) {
      Game.overlayState.flag |= OverlayFlags.HP_DIRTY | OverlayFlags.DECREMENT;
      score += hitScore;
    }
    let hitbox = enemy.hitbox;
    let enemyPrune = enemy.prune;
    let enemyOffscreen = hitbox.right < -1.0;
    if (enemyOffscreen || enemyPrune) {
      if (enemyOffscreen) {
        score -= enemy.points;
      }

      let enemyType = 0;
      enemy.reset(enemyType, false);
    }
  }
  if (score) {
    updateScore(Game, score);
  }

  /* Check for player collisions with enemies */
  if (!playerHitbox.depth && Game.levelState === LevelState.PLAYING) {
    for (let k = 0; k < enemies.length; k += 1) {
      let keepLooping = true;
      let enemy = enemies[k];
      if (enemy.active && enemy.hitpoints > 0 && enemy.intersectsWith(playerHitbox)) {
        let playerPos = player.position;
        for (let iK = 0; iK < playerPos.length; iK += 1) {
          let vert = playerPos[iK];
          point.x = vert[0];
          point.y = vert[1];
          point.z = vert[2];
          let directHit = enemy.containsPoint(point);
          if (directHit ) {
            enemy.takeHit(enemy.hitpoints);
            let hp = player.takeHit(enemy.points);
            if (hp <= 0) {
              restart();
              keepLooping = false;
              Game.overlayState.flag = OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY | OverlayFlags.FPS_DIRTY;
              break;
            } else {
              Game.overlayState.flag |= OverlayFlags.HP_DIRTY | OverlayFlags.DECREMENT;
            }
            updateScore(Game, -enemy.points);
          }
        }
        if (!keepLooping) {
          break;
        }
      }
    }
  }

  updateLevel(Game, ts, enemies);

  if (Game.keydownMap["Shoot"]) {
    fireWeapon(Game, ts, dt);
  }

  Game.starMap.update(dt);
}

function updateLevel(Game, ts, enemies) {
  if (Game.levelState === LevelState.PLAYING) {
    spawnEnemies(Game, ts);
    if (Game.overlayState.flag) {
      updateWeapon(Game);
    }
    if (Game.score >= Game.gameData.levels[Game.level].scoreGoal) {
      Game.levelState = LevelState.END;
    }
  } else if (Game.levelState === LevelState.END) {
    let enemiesActive = false;
    for (let k = 0, n = enemies.length; k < n; k += 1) {
      if (enemies[k].active) {
        enemiesActive = true;
        break;
      }
    }

    if (!enemiesActive) {
      Game.levelState = LevelState.BOSS_INTRO;
      Game.overlayState.flag |= OverlayFlags.BOSS_HP_DIRTY | OverlayFlags.INCREMENT;
      Game.bosses[Game.level].reset(Game.level, true);
    }
  } else if (Game.levelState === LevelState.BOSS) {
    let bossActive = false;
    for (let k = 0, n = enemies.length; k < n; k += 1) {
      if (enemies[k].active) {
        bossActive = true;
      }
    }
    if (!bossActive) {
      if (Game.level < Game.gameData.levels.length - 1) {
        Game.level += 1;
        Game.levelState = LevelState.INTRO;
        Game.overlayState.flag = OverlayFlags.SCORE_DIRTY | OverlayFlags.HP_DIRTY;
      } else {
        Game.levelState = LevelState.GAME_OVER;
      }
    }
  }
}

function updateScore(Game, score) {
  Game.score += score;
  Game.overlayState.flag |= OverlayFlags.SCORE_DIRTY;
}

function updateWeapon(Game) {
  var level = Game.gameData.levels[Game.level];
  var weapons = level.playerWeapons;
  for (let k = weapons.length; k; k -= 1) {
    if (Game.score >= level.playerWeaponsScoreThreshold[k]) {
      Game.player.selectWeapon(weapons[k]);
      break;
    }
  }
}

function fireWeapon(Game, ts, dt) {
  var fired = Game.player.fireWeapon(ts, dt);
  Game.projectileLastTs = ts;
  if (!Game.muted && fired) {
    gameAudio.currentTime = 0;
    gameAudio.play();
  }
}

function spawnEnemies(Game, ts, dt) {
  let gameData = Game.gameData;
  let level = gameData.levels[Game.level];
  let levelEnemies = Game.levelEnemies[Game.level];
  let enemyTypes = level.enemies;
  for (let k = 0, n = enemyTypes.length; k < n; k += 1) {
    let type = enemyTypes[k];
    let enemyType = gameData.enemies[type];
    let timeInterval = level.baseSpawnInterval * enemyType.spawnIntervalMult * difficultyMap.spawnIntervalMult[Game.difficulty];

    if (ts - levelEnemies.lastTs[k] > timeInterval) {
      let foundEnemy = false;
      for (let iK = 0; iK < Game.enemies.length; iK += 1) {
        let enemy = Game.enemies[iK];
        if (!enemy.active) {
          foundEnemy = true;
          enemy.reset(type, true);
          break;
        }
      }
      if (!foundEnemy) {
        Game.enemies.push(new Enemy(Game, type, true));
      }
      levelEnemies.lastTs[k] = ts;
    }
  }
}

function drawOverlay(Game) {
  var ctx = canvasOverlayCtx;
  var width = ctx.canvas.width;
  var height = ctx.canvas.height;
  var hpWidth = canvasOverlayProps.hpWidthScale * width;
  var hpHeight = canvasOverlayProps.hpHeightScale * height;
  var canvasOverlayFont = canvasOverlayProps.canvasOverlayFont;
  var keepDirtyFlags = 0;

  ctx.save();
  ctx.font = canvasOverlayFont;

  /* Update score display */
  if (Game.overlayState.flag & OverlayFlags.SCORE_DIRTY) {
    let scoreTemplateStrProps = canvasOverlayProps.scoreTemplateStrProps;
    let scoreTemplateNumDigits = canvasOverlayProps.scoreTemplateNumDigits;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let scoreNumStr = Game.score.toString();
    while (scoreNumStr.length < scoreTemplateNumDigits) {
      scoreNumStr = " " + scoreNumStr;
    }
    let scoreStr = `Score: ${scoreNumStr}`;
    let x = 1.25 * hpWidth + ctx.lineWidth;
    let y = 0;
    ctx.clearRect(x, y, scoreTemplateStrProps.width, defaultFontSize);
    ctx.fillText(scoreStr, x, y);
    ctx.restore();
  }

  /* Update fps display */
  if (Game.displayFPS && Game.overlayState.flag & OverlayFlags.FPS_DIRTY) {
    let fpsTemplateStrProps = canvasOverlayProps.fpsTemplateStrProps;
    let fpsTemplateNumDigits = canvasOverlayProps.fpsTemplateNumDigits;
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    let fps = Math.round(1000 / Game.averageFrameInterval.average);
    fps = isFinite(fps) ? fps : 0;
    fps = (fps <= 9999) ? fps : 9999;
    let fpsNumStr = fps.toString();
    while (fpsNumStr.length < fpsTemplateNumDigits) {
      fpsNumStr = " " + fpsNumStr;
    }
    let fpsStr = `fps: ${fpsNumStr}`;
    ctx.clearRect(
      width - fpsTemplateStrProps.width, height - defaultFontSize,
      width, height
    );
    ctx.fillText(fpsStr, width, height);
    ctx.restore();
  }

  /* Update hitpoints indicator */
  if (Game.overlayState.flag & OverlayFlags.HP_DIRTY || Game.overlayState.flag & OverlayFlags.BOSS_HP_DIRTY) {
    ctx.save();
    let player = null;
    let x = 0;
    let flag = Game.overlayState.flag & (OverlayFlags.HP_DIRTY | OverlayFlags.BOSS_HP_DIRTY);

    while (flag) {
      let frameCount = 0;
      if (flag & OverlayFlags.HP_DIRTY) {
        x = ctx.lineWidth;
        player = Game.player;
        flag &= ~OverlayFlags.HP_DIRTY;

        if (Game.overlayState.flag & OverlayFlags.INCREMENT) {
          Game.overlayState.playerIndicatorFrameCount = Game.overlayState.indicatorFrameCountMax;
        } else if (Game.overlayState.flag & OverlayFlags.DECREMENT) {
          Game.overlayState.playerIndicatorFrameCount = -Game.overlayState.indicatorFrameCountMax;
        } else if (Game.overlayState.playerIndicatorFrameCount > 0) {
          Game.overlayState.playerIndicatorFrameCount -= 1;
        } else if (Game.overlayState.playerIndicatorFrameCount < 0) {
          Game.overlayState.playerIndicatorFrameCount += 1;
        }

        frameCount = Game.overlayState.playerIndicatorFrameCount;
        if (frameCount) {
          keepDirtyFlags |= OverlayFlags.HP_DIRTY;
        }
      } else if (flag & OverlayFlags.BOSS_HP_DIRTY) {
        x = ctx.canvas.width - 8 - hpWidth;
        player = Game.bosses[Game.level];
        flag &= ~OverlayFlags.BOSS_HP_DIRTY;

        if (Game.overlayState.flag & OverlayFlags.INCREMENT) {
          Game.overlayState.bossIndicatorFrameCount = Game.overlayState.indicatorFrameCountMax;
        } else if (Game.overlayState.flag & OverlayFlags.DECREMENT) {
          Game.overlayState.bossIndicatorFrameCount = -Game.overlayState.indicatorFrameCountMax;
        } else if (Game.overlayState.bossIndicatorFrameCount > 0) {
          Game.overlayState.bossIndicatorFrameCount -= 1;
        } else if (Game.overlayState.bossIndicatorFrameCount < 0) {
          Game.overlayState.bossIndicatorFrameCount += 1;
        }

        frameCount = Game.overlayState.bossIndicatorFrameCount;
        if (frameCount) {
          keepDirtyFlags |= OverlayFlags.BOSS_HP_DIRTY;
        }
      }

      if (frameCount > 0) {
        if (Math.floor(Math.sin(2*Math.PI*(60/1000)*frameCount)) >= 0) {
          ctx.strokeStyle = "#4F4";
        } else {
          ctx.strokeStyle = "#FFF";
        }

      } else if (frameCount < 0) {
        if (Math.floor(Math.sin(2*Math.PI*(60/1000)*frameCount)) >= 0) {
          ctx.strokeStyle = "#F44";
        } else {
          ctx.strokeStyle = "#FFF";
        }
      } else {
        ctx.strokeStyle = "#FFF";
      }

      let percentage = Math.max(0, player.hitpoints / player.maxHitpoints);

      let y = ctx.lineWidth;
      let w = hpWidth;
      w = (w % 8) ? (w + 8 - w % 8) : w;
      let h = hpHeight;
      h = (h % 8) ? (h + 8 - h % 8) : h;
      let d = 10;
      let d2 = 0.5 * d;
      let red = parseInt((1 - percentage) * 0xFF, 10).toString(16);
      let green = parseInt(percentage * 0xFF, 10).toString(16);
      let color = `#${("0" + red).substr(-2)}${("0" + green).substr(-2)}88`;

      ctx.clearRect(x, y, w, h);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(x + d2, y + d2, percentage * (w - d), h - d);
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + w - d, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + d);
      ctx.lineTo(x + w, y + h - d);
      ctx.quadraticCurveTo(x + w, y + h, x + w - d, y + h);
      ctx.lineTo(x + d, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - d);
      ctx.lineTo(x, y + d);
      ctx.quadraticCurveTo(x, y, x + d, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // if (Game.overlayState.flag & OverlayFlags.BOSS_NAME_DIRTY) {
  //
  // }

  ctx.restore();

  Game.overlayState.flag = keepDirtyFlags;
}

function draw(Game) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  Game.player.draw(gl);

  if (Game.levelState === LevelState.PLAYING || Game.levelState === LevelState.END) {
    for (let k = 0, n = Game.enemies.length; k < n; k += 1) {
      Game.enemies[k].draw(gl);
    }
  } else if (Game.levelState === LevelState.BOSS) {
    Game.bosses[Game.level].draw(gl);
  }

  Game.starMap.draw(gl);

  if (Game.overlayState.flag) {
    drawOverlay(Game);
  }
}

function findEnemyWeapon(Game) {
  var enemyWeapons = Game.enemyWeapons;
  for (let k = 0, n = enemyWeapons.length; k < n; k += 1) {
    let weapon = enemyWeapons[k];
    if (!weapon.active) {
      return weapon;
    }
  }

  return new Weapon(Game, 0, 50, 0, 0, 0, false);
}

function setup(Game, gl) {
  var err = 0;
  gl.clearColor(0.0, 0.0, 0.3, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  Console.debug("Initializing shaders");
  Game.fragShader = Utils.getShader(gl, "gl_shader_frag");
  Game.vertShader = Utils.getShader(gl, "gl_shader_vert");
  Game.shaderProg = gl.createProgram();
  gl.attachShader(Game.shaderProg, Game.fragShader);
  gl.attachShader(Game.shaderProg, Game.vertShader);
  gl.linkProgram(Game.shaderProg);
  if (!gl.getProgramParameter(Game.shaderProg, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(Game.shaderProg));
    Console.error("Error: linking WebGL program");
    Console.show();
    return;
  }
  err = gl.getError();
  if (err) {
    Console.error(`Error: ${err}: Initializing shaders`);
    Console.show();
    return;
  }

  gl.useProgram(Game.shaderProg);

  gl.bindAttribLocation(Game.shaderProg, Game.vertexPositionAttrib, "aVertexPosition");
  gl.enableVertexAttribArray(Game.vertexPositionAttrib);

  gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexTriangleBufferObject);
  gl.bufferData(gl.ARRAY_BUFFER, Game.verticesTriangle, gl.STATIC_DRAW);
  gl.vertexAttribPointer(Game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);


  gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexCircleBufferObject);
  gl.bufferData(gl.ARRAY_BUFFER, Game.verticesCircle, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexRectangleBufferObject);
  gl.bufferData(gl.ARRAY_BUFFER, Game.verticesRectangle, gl.STATIC_DRAW);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  Game.pUniform = gl.getUniformLocation(Game.shaderProg, "uPMatrix");
  Game.mvUniform = gl.getUniformLocation(Game.shaderProg, "uMVMatrix");
  gl.uniformMatrix4fv(Game.pUniform, false, Game.pUniformMatrix);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  Game.textureUniform = gl.getUniformLocation(Game.shaderProg, "uSampler");
  Game.textures.texCoordAttrib = gl.getAttribLocation(Game.shaderProg, "aTextureCoord");
  gl.enableVertexAttribArray(Game.textures.texCoordAttrib);
  gl.vertexAttribPointer(Game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);

  Game.projectileTexCoords = Game.gameData.projectileTexCoords.map((el) => {
    return new Float32Array(el.coords);
  });

  function loadTexture(texObj, img, texCoords, texIdIndex) {
    texObj.tex = gl.createTexture();
    texObj.img = doc.getElementById(img);

    gl.bindTexture(gl.TEXTURE_2D, texObj.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texObj.img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    for (let k = 0, n = texCoords.length; k < n; k += 1) {
      const buff = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buff);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords[k], gl.STATIC_DRAW);
      texObj.coordBuffers.push(buff);
    }

    texObj.texId = gl.TEXTURE0 + texIdIndex;
    texObj.texIdIndex = texIdIndex;
  }

  Console.debug("Initializing textures");

  loadTexture(Game.textures.ship, "img_ship", Game.textures.ship.coords, Game.textures.numTextures);
  Game.textures.numTextures += 1;

  loadTexture(Game.textures.enemyShip, "img_enemy_ship", Game.textures.enemyShip.coords, Game.textures.numTextures);
  Game.textures.numTextures += 1;

  loadTexture(Game.textures.boss, "img_boss", Game.textures.boss.coords, Game.textures.numTextures);
  Game.textures.numTextures += 1;

  loadTexture(Game.textures.explosion, "img_explosion", Game.textures.explosion.coords, Game.textures.numTextures);
  Game.textures.numTextures += 1;

  loadTexture(Game.textures.projectile, "img_projectiles_sprite", Game.projectileTexCoords, Game.textures.numTextures);
  Game.textures.numTextures += 1;

  loadTexture(Game.textures.star, "img_star", Game.textures.star.coords, Game.textures.numTextures);
  Game.textures.numTextures += 1;

  err = gl.getError();
  if (err) {
    Console.error(`Error: ${err}: Initializing textures`);
    Console.show();
    return;
  }

  Console.debug("Initializing game assets");

  Game.player = new Player(Game);
  Game.players.push(Game.player);

  Game.starMap = new StarMap(Game, Game.numStars);

  /* Create arrays to hold enemy last spawn ts per level */
  let levels = Game.gameData.levels;
  let levelEnemies = Game.levelEnemies;
  for (let k = 0, n = levels.length; k < n; k += 1) {
    let lastTs = [];
    let level = levels[k];
    for (let iK = 0, iN = level.enemies.length; iK < iN; iK += 1) {
      lastTs.push(0);
    }
    levelEnemies.push({"lastTs": lastTs});
  }

  /* Create cache of weapons for enemies to reuse */
  for (let k = 0; k < 50; k += 1) {
    Game.enemyWeapons.push(new Weapon(Game, 0, 50, 0, 0, 0, false));
  }

  /* Create bosses */
  for (let k = 0, n = Game.gameData.levels.length; k < n; k += 1) {
    Game.bosses.push(new Boss(Game, k, false));
  }

  Splash.intro({
    "canvasOverlayCtx": canvasOverlayCtx,
    "callback": start,
    "KEY_MAP": KEY_MAP
  });
}

})(window, document);
