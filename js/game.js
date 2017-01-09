/* global Utils Player Enemy StarMap */

(function(win, doc) {
  var global = win;
  var canvas = doc.getElementById("glcanvas");
  var canvasOverlay = doc.getElementById("glcanvas_overlay");
  var canvasOverlayCtx = canvasOverlay.getContext("2d");
  var gameAudio = doc.getElementById("game_audio");
  var menu = doc.getElementById("menu");
  var menuResume = doc.getElementById("menu_resume");
  var menuRestart = doc.getElementById("menu_restart");
  var menuDisplayFPS = doc.getElementById("menu_display_fps");
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  var aspect = canvas.width / canvas.height;
  var ROOT_TWO_OVER_TWO = Utils.ROOT_TWO_OVER_TWO;
  var zProjection = 1;
  // var identityMatrix = new Float32Array([
  //   1, 0, 0, 0,
  //   0, 1, 0, 0,
  //   0, 0, 1, 0,
  //   0, 0, 0, 1
  // ]);
  // var aspectMatrix = new Float32Array([
  //   1 / aspect, 0, 0, 0,
  //   0, 1, 0, 0,
  //   0, 0, 1, 0,
  //   0, 0, 0, 1
  // ]);
  var difficultyMap = {
    "labels": {
      "easy": 1,
      "medium": 2,
      "hard": 3
    },
    "prediv": {
      1: 1.0,
      2: 1/2.0,
      3: 1/3.0
    },
    "spawnInterval": {
      1: 5000,
      2: 3500,
      3: 2000
    }
  };

  canvasOverlay.style.top = canvas.offsetTop;
  canvasOverlay.style.left = canvas.offsetLeft;
  canvasOverlayCtx.fillStyle = "#FFF";
  canvasOverlayCtx.font = "32px sans";

  var Game = {
    "difficulty": difficultyMap.labels["easy"],
    "difficultyMap": difficultyMap,
    "time": 0,
    "accumulator": 0,
    "startTs": 0,
    "lastTs": 0,
    "pauseTs": 0,
    "averageFrameInterval": new Utils.ExponentialAverage(0.7, 0),
    "running": false,
    "isMenuShown": false,
    "animFrame": null,
    "overlayDirtyFlag": true,
    "overlayLastTs": 0,
    "displayFPS": false,
    "muted": false,
    "keydownMap": {
      "ArrowLeft": 0,
      "ArrowUp": 0,
      "ArrowRight": 0,
      "ArrowDown": 0,
      "Escape": 0,
      "Shoot": 0,
      "Dive": 0
    },
    "textures": {
      "ship": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": new Float32Array([
          0.0, 1.0,
          0.75, 0.5,
          0.0, 0.0
        ]),
        "buffer": null
      },
      "enemyShip": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": new Float32Array([
          0.0, 1.0,
          0.75, 0.5,
          0.0, 0.0
        ]),
        "buffer": null
      },
      "explosion": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": new Float32Array([
          0.0, 1.0,
          1.0, 1.0,
          1.0, 0.0,

          0.0, 1.0,
          1.0, 0.0,
          0.0, 0.0
        ]),
        "buffer": null
      },
      "projectile": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": null,
        "buffer": null
      },
      "star": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": new Float32Array([
          0.0, 1.0,
          1.0, 1.0,
          1.0, 0.0,

          0.0, 1.0,
          1.0, 0.0,
          0.0, 0.0
        ]),
        "buffer": null
      },
      "circle": {
        "tex": null,
        "texId": 0,
        "texIdIndex": 0,
        "img": null,
        "coords": null,
        "buffer": null
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

    "colorUniform": null,
    "pUniform": null,
    "mvUniform": null,

    "pUniformMatrix": new Float32Array([
      1.0, 0.0, 0.0, 0.0,
      0.0, 1.0, 0.0, 0.0,
      0.0, 0.0, 1.0, zProjection,
      0.0, 0.0, 0.0, 1.0
    ]),

    "player": null,
    "lastSpawnTs": [
      0, 0
    ],
    "enemies": [],
    "enemyTypes": null,
    "enemyTypesMap": {
      "wing": 0,
      "wing2": 1
    },
    "stars": [],
    "starMap": null,
    "numStars": 256,
    "projectiles": [],
    "projectileLastTs": 0,
    "projectilesTypes": null,
    "projectileTypesMap": {
      "basic": 0,
      "basic_upgrade": 1,
      "basic_multi": 2
    },
    "weaponTypes": [
      {
        "projectileType": "basic",
        "projectileTypeId": 0,
        "projectileCount": 1
      },
      {
        "projectileType": "basic_upgrade",
        "projectileTypeId": 1,
        "projectileCount": 1
      },
      {
        "projectileType": "basic_multi",
        "projectileTypeId": 2,
        "projectileCount": 2
      }
    ],
    "weaponTypesMap": {
      "basic": 0,
      "basic_upgrade": 1,
      "basic_multi": 2
    },
    "weaponSelected": 2,
    "score": 0,
    "frame": 0,
    "timing": {}
  };
  Game.enemyTypes = [
    {
      "type": "wing",
      "speed": 0.00015,
      "coolDown": 1000,
      "weaponType": null,
      // "xScale": Game.modelScale  / 2,
      "xScale": Game.modelScale  / aspect,
      "yScale": Game.modelScale,
      "zScale": Game.modelScale,
      "hitPoints": 100,
      "spawnIntervalMult": 1
    },
    {
      "type": "wing2",
      "speed": 0.0001,
      "coolDown": 2000,
      "weaponType": null,
      // "xScale": Game.modelScale,
      "xScale": Game.modelScale * 2 / aspect,
      "yScale": Game.modelScale * 2,
      "zScale": Game.modelScale * 2,
      "hitPoints": 200,
      "spawnIntervalMult": 2.25
    }
  ];
  Game.projectilesTypes = [
    {
      "speed": 0.0005,
      "coolDown": 384,
      "damage": 100,
      // "xScale": Game.modelScale  / 4,
      "xScale": Game.modelScale / 3 / aspect,
      "yScale": Game.modelScale / 16,
      "zScale": Game.modelScale,
      "texCoords": null
    },
    {
      "speed": 0.0008,
      "coolDown": 320,
      "damage": 100,
      // "xScale": Game.modelScale  / 4,
      "xScale": Game.modelScale  / 2 / aspect,
      "yScale": Game.modelScale / 16,
      "zScale": Game.modelScale,
      "texCoords": null
    },
    {
      "speed": 0.0008,
      "coolDown": 304,
      "damage": 50,
      // "xScale": Game.modelScale  / 4,
      "xScale": Game.modelScale  / 2 / aspect,
      "yScale": Game.modelScale / 16,
      "zScale": Game.modelScale,
      "texCoords": null
    }
  ];

  var projTexCoords = new Float32Array([
    // 0.0, 1.0,
    // 0.25, 1.0,
    // 0.25, 0.75,
    //
    // 0.0, 1.0,
    // 0.25, 0.75,
    // 0.0, 0.75

    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,

    0.0, 1.0,
    1.0, 0.0,
    0.0, 0.0

    // 0.0, 1.0,
    // 0.5, 1.0,
    // 0.5, 0.5,
    //
    // 0.0, 1.0,
    // 0.5, 0.5,
    // 0.0, 0.5

  ]);
  Game.projectilesTypes[0].texCoords = projTexCoords;
  Game.projectilesTypes[1].texCoords = projTexCoords;
  Game.projectilesTypes[2].texCoords = projTexCoords;

  var circleCoords = Utils.createCircleVertices({x: 0, y: 0, z: 0}, 360, 1);
  Game.verticesCircle = circleCoords.vertices;
  Game.textures.circle.coords = circleCoords.tex;

  Game.gameData = null;
  Utils.fetchURL({
    "method": "GET",
    "url": "js/game_data.json",
    "responseType": "json",
    "callback": function(xhr) {
      if (xhr.status === 200) {
        Game.gameData = xhr.response;
        setup(Game, gl);
      } else {
        console.error(xhr);
      }
    }
  });

  function handleKeyDown(e) {
    var ret;
    switch (e.key) {
      case "ArrowLeft":
      case "a":
        Game.keydownMap["ArrowLeft"] = true;
        e.preventDefault();
      break;
      case "ArrowUp":
      case "w":
        Game.keydownMap["ArrowUp"] = true;
        e.preventDefault();
      break;
      case "ArrowRight":
      case "d":
        Game.keydownMap["ArrowRight"] = true;
        e.preventDefault();
      break;
      case "ArrowDown":
      case "s":
        Game.keydownMap["ArrowDown"] = true;
        e.preventDefault();
      break;
      case " ":
        Game.keydownMap["Shoot"] = true;
        e.preventDefault();
      break;
      case "c":
        Game.keydownMap["Dive"] = true;
        e.preventDefault();
      break;
      case "Escape":
        if (Game.running) {
          stop();
        } else {
          start();
        }
        if (Game.isMenuShown) {
          hideMenu();
        } else {
          showMenu();
        }
        e.preventDefault();
        ret = false;
      break;
      case "m":
        Game.muted = !Game.muted;
        e.preventDefault();
      break;
    }
    return ret;
  }
  function handleKeyUp(e) {
    switch (e.key) {
      case "ArrowLeft":
      case "a":
        Game.keydownMap["ArrowLeft"] = false;
      break;
      case "ArrowUp":
      case "w":
        Game.keydownMap["ArrowUp"] = false;
      break;
      case "ArrowRight":
      case "d":
        Game.keydownMap["ArrowRight"] = false;
      break;
      case "ArrowDown":
      case "s":
        Game.keydownMap["ArrowDown"] = false;
      break;
      case " ":
        Game.keydownMap["Shoot"] = false;
      break;
      case "c":
        Game.keydownMap["Dive"] = false;
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

  function onMenuScroll(e) {
    var menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
    var selectedIndex = -1;

    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "Enter":
        e.preventDefault();
      break;

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

    switch (e.key) {
      case "ArrowUp":
        if (selectedIndex > 0) {
          selectedIndex -= 1;
        } else {
          selectedIndex = menuItems.length - 1;
        }
        menuItems[selectedIndex].classList.add("selected");
      break;
      case "ArrowDown":
        if (selectedIndex < (menuItems.length - 1)) {
          selectedIndex += 1;
        } else {
          selectedIndex = 0;
        }
        menuItems[selectedIndex].classList.add("selected");
      break;
      case "Enter":
        menuItems[selectedIndex].click();
      break;
    }
  }

  function showMenu() {
    var menuItems = Array.prototype.slice.call(menu.querySelectorAll("menuitem.selectable"));
    menuItems[0].classList.add("selected");
    window.addEventListener("keydown", onMenuScroll, false);

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
    Game.overlayDirtyFlag = true;
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

  var splashState = {
    "ts": 0,
    "state": 0,
    "animFrame": null,
    "frame": 0,
    "img": document.getElementById("img_ship"),
    "left": 0,
    "top": 0,
    "width": ROOT_TWO_OVER_TWO * 64,
    "height": 64,
    "maxWidth": 512,
    "maxHeight": 512,
    "srcWidth": 512,
    "srcHeight": 512,
    "canvasWidth": canvasOverlay.width,
    "canvasHeight": canvasOverlay.height,
    "aspect": 0,
    "canvasImageData": canvasOverlayCtx.createImageData(canvasOverlay.width, canvasOverlay.height)
  };

  function splashHandleKeyDown(e) {
    splashState.state = -1;
    e.preventDefault();
    return false;
  }
  doc.body.addEventListener("keydown", splashHandleKeyDown, false);

  function splashEnd(ts) {
    delete splashState.canvasImageData;
    splashState.canvasImageData = null;
    splashState.img = null;
    doc.body.removeEventListener("keydown", splashHandleKeyDown, false);
    doc.body.addEventListener("keydown", handleKeyDown, false);
    doc.body.addEventListener("keyup", handleKeyUp, false);
    start(ts);
  }
  function preSplash(ts) {
    splashState.maxWidth = parseInt(ROOT_TWO_OVER_TWO * splashState.img.width, 10);
    splashState.maxHeight = splashState.img.height;
    splashState.srcWidth = parseInt(ROOT_TWO_OVER_TWO * splashState.img.width, 10);
    splashState.srcHeight = splashState.img.height;
    splashState.left = -splashState.width;
    splashState.aspect = splashState.canvasWidth / splashState.canvasHeight;
    for (let k = 0; k < canvasOverlay.height; k += 1) {
      for (let iK = 0; iK < canvasOverlay.width; iK += 1) {
        let buff = splashState.canvasImageData.data;
        let pixel = k * canvasOverlay.width * 4 + iK * 4;
        buff[pixel] = 220;
        buff[pixel + 1] = 220;
        buff[pixel + 2] = 255;
        buff[pixel + 3] = 255;
      }
    }

    splash(ts);
  }
  function splash(ts) {
    splashState.animFrame = global.requestAnimationFrame(splash);
    var ctx = canvasOverlayCtx;
    ctx.clearRect(0, 0, splashState.canvasWidth, splashState.canvasHeight);

    switch (splashState.state) {
      case -1:
        global.cancelAnimationFrame(splashState.animFrame);
        return splashEnd(ts);
      case 0:
        splashState.height += 4;
        splashState.width = parseInt(ROOT_TWO_OVER_TWO * splashState.height, 10);
        splashState.top = splashState.canvasHeight / 2 - splashState.height / 2;
      break;
      case 1:
        splashState.left += 4;
      break;
      case 2: {
        splashState.srcWidth -= 4;
        splashState.width = splashState.srcWidth;
        if (splashState.srcWidth <= 0) {
          splashState.srcWidth = 1;
        }

        let halfHeight = splashState.height / 2;
        let aspect = splashState.aspect;

        for (let k = 0; k <= splashState.height; k += 8) {
          let x = 0;
          if (k <= halfHeight) {
            x = splashState.left + aspect * ROOT_TWO_OVER_TWO * k;
          } else {
            x = splashState.left + aspect * ROOT_TWO_OVER_TWO * (splashState.height - k);
          }

          let y = splashState.top + k;
          ctx.putImageData(splashState.canvasImageData, x, y, 0, 0, splashState.canvasWidth, 1);
        }
      }
      break;
    }

    let moveEnd = splashState.canvasWidth / 3;
    if (splashState.width >= splashState.maxWidth) {
      splashState.state = 1;
    }
    if (splashState.left >= moveEnd) {
      splashState.state = 2;
    }
    if (splashState.srcWidth <= 1) {
      splashState.state = -1;
    }

    ctx.drawImage(
      splashState.img,
      0, 0,
      splashState.srcWidth,
      splashState.srcHeight,
      splashState.left,
      splashState.top,
      splashState.width,
      splashState.height
    );
    splashState.frame += 1;
  }

  function start() {
    if (!Game.running) {
      Game.startTs = global.performance.now();
      Game.running = true;
      preStart(Game, Game.startTs);
      main(Game.startTs);
    }
  }
  function stop() {
    Game.pauseTs = global.performance.now();
    Game.running = false;
    global.cancelAnimationFrame(Game.animFrame);
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
    Game.animFrame = global.requestAnimationFrame(main);

    var dt = ts - Game.lastTs;
    Game.time += dt;
    var timestep = 10;

    Game.averageFrameInterval.update((ts - Game.lastTs) || 0);

    var overlayNeedsUpdating = Boolean(Game.displayFPS);
    if (overlayNeedsUpdating && (ts > Game.overlayLastTs + 1000)) {
      Game.overlayDirtyFlag = true;
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

  function preStart(Game, ts) {
    Game.lastTs = ts;
    var lastSpawnTs = Game.lastSpawnTs;
    var pauseTs = Game.pauseTs;
    for (let k = 0; k < lastSpawnTs.length; k += 1) {
      if (pauseTs) {
        lastSpawnTs[k] = ts - (pauseTs - lastSpawnTs[k]);
      } else {
        lastSpawnTs[k] = ts;
      }
    }
  }

  function update(Game, ts, dt) {
    var score = Game.player.update(dt);
    if (score) {
      updateScore(Game, score);
    }
    var playerHitbox = Game.player.hitbox;

    for (let k = Game.enemies.length - 1; k >= 0; k -= 1) {
      let enemy = Game.enemies[k];
      if (!enemy.active) {
        continue;
      }
      enemy.update(dt);
      let hitbox = enemy.hitbox;
      let enemyPrune = enemy.prune;
      let enemyOffscreen = hitbox.right < -1.0;
      if (enemyOffscreen || enemyPrune) {
        let points = enemy.points;
        if (enemyOffscreen) {
          updateScore(Game, -points);
        }

        enemy.reset(enemy.enemyType, false);
      }
    }

    //Check for player collisions with enemies
    if (!playerHitbox.depth) {
      for (let k = 0; k < Game.enemies.length; k += 1) {
        let keepLooping = true;
        let enemy = Game.enemies[k];
        if (enemy.active && enemy.hitPoints > 0 && enemy.intersectsWith(playerHitbox)) {
          var playerPos = Game.player.position;
          for (let iK = 0; iK < playerPos.length; iK += 1) {
            let vert = playerPos[iK];
            let directHit = enemy.containsPoint({x: vert[0], y: vert[1]});
            if (directHit ) {
              enemy.takeHit(enemy.hitPoints);
              let hp = Game.player.takeHit(enemy.points);
              if (hp <= 0) {
                restart();
                keepLooping = false;
                Game.overlayDirtyFlag = true;
                break;
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

    spawnEnemies(Game, ts);

    if (Game.keydownMap["Shoot"]) {
      fireWeapon(Game, ts, dt);
    }

    Game.starMap.update(dt);

    if (Game.overlayDirtyFlag) {
      updateOverlay(Game);
      updateWeapon(Game);
    }
  }

  function updateScore(Game, score) {
    Game.score += score;
    Game.overlayDirtyFlag = true;
  }

  function updateOverlay(Game) {
    var ctx = canvasOverlayCtx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillText(`Score: ${Game.score}`, 0, 32);
    if (Game.displayFPS) {
      let fps = Math.round(1000 / Game.averageFrameInterval.average);
      fps = isFinite(fps) ? fps : 0;
      ctx.fillText(`fps: ${fps}`, ctx.canvas.width - 128, ctx.canvas.height - 16);
    }

    Game.overlayDirtyFlag = false;

    //  Draw hitpoints indicator
    var player = Game.player;
    var percentage = Math.max(0, player.hitPoints / player.maxHitPoints);
    var x = 10;
    var y = 50;
    var w = 100;
    var h = 20;
    var d = 10;
    var d2 = d / 2;
    var red = parseInt((1 - percentage) * 0xFF, 10).toString(16);
    var green = parseInt(percentage * 0xFF, 10).toString(16);
    var color = `#${("0" + red).substr(-2)}${("0" + green).substr(-2)}88`;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "#FFF";
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
    ctx.restore();
  }

  function updateWeapon(Game) {
    if (Game.score < 2000) {
      Game.weaponSelected = 0;
    } else if (Game.score < 5000) {
      Game.weaponSelected = 1;
    } else if (Game.score < 10000) {
      Game.weaponSelected = 2;
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
    for (let k = 0; k < Game.enemyTypes.length; k += 1) {
      let timeInterval = Game.enemyTypes[k].spawnIntervalMult * difficultyMap.spawnInterval[Game.difficulty];
      if (ts - Game.lastSpawnTs[k] > timeInterval) {
        let type = Game.enemyTypes[k].type;
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
          Game.enemies.push(new Enemy(Game, type, ts, true));
        }
        Game.lastSpawnTs[k] = ts;
      }
    }
  }

  function draw(Game) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    Game.player.draw(gl);
    for (let k = 0; k < Game.enemies.length; k += 1) {
      Game.enemies[k].draw(gl);
    }

    Game.starMap.draw(gl);

    //testDraw(Game, ts, dt);
  }

  // function testDraw(Game, ts, dt) {
  //   gl.useProgram(Game.shaderProg);
  //
  //   gl.activeTexture(Game.textures.circle.texId);
  //   gl.bindTexture(gl.TEXTURE_2D, Game.textures.circle.tex);
  //   gl.bindBuffer(gl.ARRAY_BUFFER, Game.textures.circle.buffer);
  //   gl.vertexAttribPointer(Game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
  //   gl.uniform1i(Game.textureUniform, Game.textures.circle.texIdIndex);
  //
  //   gl.uniformMatrix4fv(Game.mvUniform, false, aspectMatrix);
  //   gl.bindBuffer(gl.ARRAY_BUFFER, Game.vertexCircleBufferObject);
  //   gl.vertexAttribPointer(Game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
  //   gl.drawArrays(gl.TRIANGLES, 0, Game.verticesCircle.length / 3);
  //
  //   gl.bindTexture(gl.TEXTURE_2D, null);
  // }

  function setup(Game, gl) {
    gl.clearColor(0.0, 0.0, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    Game.fragShader = Utils.getShader(gl, "gl_shader_frag");
    Game.vertShader = Utils.getShader(gl, "gl_shader_vert");
    Game.shaderProg = gl.createProgram();
    gl.attachShader(Game.shaderProg, Game.fragShader);
    gl.attachShader(Game.shaderProg, Game.vertShader);
    gl.linkProgram(Game.shaderProg);
    if (!gl.getProgramParameter(Game.shaderProg, gl.LINK_STATUS)) {
      console.log(gl.getProgramInfoLog(Game.shaderProg));
      return;
    }

    Game.colorUniform = gl.getUniformLocation(Game.shaderProg, "uColor");
    Game.player = new Player(Game, aspect);
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

    function loadTexture(texObj, img, texCoords, texIdIndex) {
      texObj.tex = gl.createTexture();
      texObj.img = doc.getElementById(img);

      gl.bindTexture(gl.TEXTURE_2D, texObj.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texObj.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.generateMipmap(gl.TEXTURE_2D);

      texObj.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texObj.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

      texObj.texId = gl.TEXTURE0 + texIdIndex;
      texObj.texIdIndex = texIdIndex;
    }

    loadTexture(Game.textures.ship, "img_ship", Game.textures.ship.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.enemyShip, "img_enemy_ship", Game.textures.enemyShip.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.explosion, "img_explosion", Game.textures.explosion.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.projectile, "img_projectiles_sprite", Game.projectilesTypes[0].texCoords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    loadTexture(Game.textures.star, "img_star", Game.textures.star.coords, Game.textures.numTextures);
    Game.textures.numTextures += 1;

    Game.starMap = new StarMap(Game, Game.numStars);

    preSplash(global.performance.now());
  }
})(window, document);
