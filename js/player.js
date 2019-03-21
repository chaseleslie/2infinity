/* global Physics Utils HealthPowerup ShieldPowerup */
/* exported Player */

"use strict";

function Player(game) {
  const playerData = game.gameData.player;
  const maxHp = playerData.maxHp;
  var hp = maxHp;
  var dmgRate = game.difficultyMap.prediv[game.difficulty];
  var shield = 0;
  const maxShield = playerData.maxShield;
  var velocity = playerData.velocity;

  /* Rolling animation props */
  const rollingMax = playerData.anim.rollingMax;
  const rollingAngle = playerData.anim.rollingAngle;
  var rollingUp = 0;
  var rollingDown = 0;

  /* Pitching animation props */
  const pitchingMax = playerData.anim.pitchingMax;
  const pitchingDepth = playerData.anim.pitchingDepth;
  const pitchAngleMax = playerData.anim.pitchingAngleMax;
  var pitching = 0;

  /* Movement animation props */
  const animMovementMax = playerData.anim.movementMax;
  var texCoordsBufferIndex = game.textures.ship.SHIP_IDLE;
  var animMovementCount = 0;

  const weapons = [];
  var weaponSelected = 0;
  const startPos = playerData.startPos;
  const vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  const state = new Physics.State(
    [startPos.x, startPos.y, startPos.z],
    [0, 0, 0]
  );

  const translations = Object.seal({"x": startPos.x, "y": startPos.y, "z": startPos.z});
  const rotations = Object.seal({"x": 0, "y": 0, "z": 0});
  const scales = Object.seal({
    "x": game.modelScale * game.recipAspect,
    "y": game.modelScale,
    "z": game.modelScale * game.recipAspect
  });
  const mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    translations,
    rotations,
    scales
  );

  const hitbox = Object.seal({
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  });

  this.reset = function(dt) {
    Physics.integrateState(state, game.time, dt);
    state.velocity[0] = 0;
    state.velocity[1] = 0;
    state.velocity[2] = 0;

    const trans = translations;

    trans.x = state.position[0];
    trans.y = state.position[1];
    trans.z = state.position[2];

    Utils.modelViewMatrix(mvUniformMatrix, trans, rotations, scales);
  };

  this.resetGame = function() {
    hp = maxHp;

    state.position[0] = startPos.x;
    state.position[1] = startPos.y;
    state.position[2] = startPos.z;
    state.velocity[0] = 0;
    state.velocity[1] = 0;
    state.velocity[2] = 0;
    rotations.x = 0;
    rotations.y = 0;
    rotations.z = 0;

    Utils.modelViewMatrix(mvUniformMatrix, startPos, rotations, scales);
  };

  this.resetLevel = function(level) {
    const levelData = game.gameData.levels[level];
    const playerWeapons = levelData.playerWeapons;
    weapons.splice(0, weapons.length);
    for (let k = 0, n = playerWeapons.length; k < n; k += 1) {
      const weapon = playerWeapons[k];
      weapons.push(new window[weapon.type](game, weapon));
    }
    weaponSelected = 0;
  };

  this.draw = function(gl) {
    gl.activeTexture(game.textures.ship.texId);
    gl.bindTexture(gl.TEXTURE_2D, game.textures.ship.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.ship.coordBuffers[texCoordsBufferIndex]);
    gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(game.textureUniform, game.textures.ship.texIdIndex);

    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexTriangleBufferObject);
    gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, game.verticesTriangle.length / 3);

    gl.bindTexture(gl.TEXTURE_2D, null);

    for (let k = 0; k < weapons.length; k += 1) {
      const weapon = weapons[k];
      weapon.draw(gl);
    }
  };

  this.update = function(dt) {
    const cos = Math.cos;
    const sin = Math.sin;
    const aspect = game.aspect;
    const rAspect = game.recipAspect;
    const winAspect = game.windowAspect;
    const arrowLeft = game.keydownMap["ArrowLeft"];
    const arrowUp = game.keydownMap["ArrowUp"];
    const arrowRight = game.keydownMap["ArrowRight"];
    const arrowDown = game.keydownMap["ArrowDown"];
    const dive = game.keydownMap["Dive"];
    const rot = rotations;
    const vx = velocity * rAspect;
    const vy = vx * winAspect * rAspect;
    var isMoving = false;

    if (arrowLeft && !arrowRight) {
      state.velocity[0] = -vx;
      isMoving = true;
    } else if (arrowRight && !arrowLeft) {
      state.velocity[0] = vx;
      isMoving = true;
    }

    if (arrowUp && !arrowDown) {
      state.velocity[1] = vy;
      isMoving = true;
    } else if (arrowDown && !arrowUp) {
      state.velocity[1] = -vy;
      isMoving = true;
    }

    if (dive && !pitching) {
      pitching = pitchingMax;
    }

    /* Apply rotations if rolling or pitching */
    if (rollingUp || rollingDown || pitching) {
      let angleX = 0;
      let angleY = 0;
      let angleZ = 0;
      let iter = 0;

      if (rollingUp) {
        rollingUp -= 1;
        iter = -rollingUp;
      } else if (rollingDown) {
        rollingDown -= 1;
        iter = rollingDown;
      }

      angleX = (iter / rollingMax) * rollingAngle;

      if (pitching) {
        isMoving = true;
        pitching -= 1;
        iter = pitching / pitchingMax;
        let PI = Math.PI;
        let z = pitchingDepth * sin(PI * iter);

        state.position[2] = Utils.mapValue(z, 0, 1, 0, pitchingDepth);

        angleY = Utils.mapValue(
          -PI * cos(PI*2*iter + 3/2*PI),
          -PI, PI, -pitchAngleMax, pitchAngleMax
        );
      } else {
        state.position[2] = 0;
      }

      rot.x = angleX;
      rot.y = angleY;
      rot.z = angleZ;
      this.reset(dt);
    } else if (arrowLeft || arrowUp || arrowRight || arrowDown) {
      this.reset(dt);
    }

    /* Clamp player to viewport */
    if (arrowLeft) {
      const left = getPositionLeft();
      if (left < -1.0) {
        const vertTri = game.verticesTriangle;
        const p1 = -vertTri[0] * scales.x * cos(rot.y) * cos(rot.z);
        const p2 = -vertTri[1] * scales.y * (cos(rot.x) * sin(rot.z) + sin(rot.x) * sin(rot.z));
        const p3 = vertTri[2] * scales.z * (cos(rot.x) * cos(rot.z) * sin(rot.y) - sin(rot.x) * sin(rot.z));
        state.position[0] = (p1 + p2 + p3 - 1) * aspect;
      }
    }
    if (arrowUp) {
      const top = getPositionTop();
      if (top > rAspect) {
        const vertTri = game.verticesTriangle;
        const p1 = vertTri[0] * scales.x * cos(rot.y) * sin(rot.z);
        const p2 = vertTri[1] * scales.y * (sin(rot.x) * sin(rot.y) * sin(rot.z) - cos(rot.x) * cos(rot.z));
        const p3 = -vertTri[2] * scales.z * (cos(rot.x) * sin(rot.y) * sin(rot.z) + cos(rot.z) * sin(rot.x));
        state.position[1] = p1 + p2 + p3 + 1;
      }

      if (!arrowDown) {
        rollingUp = rollingMax;
        rollingDown = 0;
      }
    }
    if (arrowRight) {
      const right = getPositionRight();
      if (right > 1.0) {
        const vertTri = game.verticesTriangle;
        const p1 = -vertTri[3] * scales.x * cos(rot.y) * cos(rot.z);
        const p2 = -vertTri[4] * scales.y * (cos(rot.x) * sin(rot.z) + sin(rot.x) * sin(rot.z));
        const p3 = vertTri[5] * scales.z * (cos(rot.x) * cos(rot.z) * sin(rot.y) - sin(rot.x) * sin(rot.z));
        state.position[0] = (p1 + p2 + p3 + 1) * aspect;
      }
    }
    if (arrowDown) {
      const bottom = getPositionBottom();
      if (bottom < -rAspect) {
        const vertTri = game.verticesTriangle;
        const p1 = vertTri[6] * scales.x * cos(rot.y) * sin(rot.z);
        const p2 = vertTri[7] * scales.y * (sin(rot.x) * sin(rot.y) * sin(rot.z) - cos(rot.x) * cos(rot.z));
        const p3 = -vertTri[8] * scales.z * (cos(rot.x) * sin(rot.y) * sin(rot.z) + cos(rot.z) * sin(rot.x));
        state.position[1] = p1 + p2 + p3 - 1;
      }

      if (!arrowUp) {
        rollingDown = rollingMax;
        rollingUp = 0;
      }
    }

    /* Set movement animation counter */
    if (isMoving) {
      animMovementCount = animMovementMax;
    } else if (animMovementCount) {
      animMovementCount -= 1;
    }

    /* Set ship texture based on movement animation state */
    if (animMovementCount) {
      texCoordsBufferIndex = game.textures.ship.SHIP_ACTIVE;
    } else {
      texCoordsBufferIndex = game.textures.ship.SHIP_IDLE;
    }
  };

  this.acceptPowerup = function(powerup) {
    if (powerup instanceof HealthPowerup) {
      return this.acceptHealthPowerup(powerup);
    } else if (powerup instanceof ShieldPowerup) {
      return this.acceptShieldPowerup(powerup);
    }
  };

  this.acceptHealthPowerup = function(powerup) {
    hp += powerup.value;
    hp = Math.min(hp, maxHp);
    powerup.deactivate();
    return game.OverlayFlags.INCREMENT | game.OverlayFlags.HP_DIRTY;
  };

  this.acceptShieldPowerup = function(powerup) {
    shield += powerup.value;
    shield = Math.min(shield, maxShield);
    powerup.deactivate();
    return game.OverlayFlags.INCREMENT | game.OverlayFlags.HP_DIRTY;
  };

  this.takeHit = function(points) {
    shield -= dmgRate * points;
    if (shield < 0) {
      hp += shield;
      shield = 0;
    }
    return points;
  };

  this.fireWeapon = function(ts, dt) {
    const weapon = weapons[weaponSelected];
    var fired = false;
    if (!pitching) {
      fired = weapon.fireWeapon(ts, dt, getHitbox());
    }
    return fired;
  };

  this.selectWeapon = function(weapon) {
    weaponSelected = weapon;
  };

  this.containsPointHitbox = function(point) {
    const hitbox = getHitbox();
    return (
      (point.x >= hitbox.left) &&
      (point.x <= hitbox.right) &&
      (point.y <= hitbox.top) &&
      (point.y >= hitbox.bottom)
    );
  };

  this.containsPoint = function(point) {
    //Parametric equations solution
    const pos = getPosition();
    const p1 = pos[0], p2 = pos[1], p3 = pos[2];
    const denom = (p2[1] - p3[1])*(p1[0] - p3[0]) + (p3[0] - p2[0])*(p1[1] - p3[1]);
    const a = ((p2[1] - p3[1])*(point.x - p3[0]) + (p3[0] - p2[0])*(point.y - p3[1])) / denom;
    const b = ((p3[1] - p1[1])*(point.x - p3[0]) + (p1[0] - p3[0])*(point.y - p3[1])) / denom;
    const c = 1 - a - b;
    return (
      (0 <= a && a <= 1) &&
      (0 <= b && b <= 1) &&
      (0 <= c && c <= 1)
    );
  };

  this.intersectsWith = function(rect) {
    const hitbox = getHitbox();
    return (
      (rect.left < hitbox.right) &&
      (hitbox.left < rect.right) &&
      (rect.bottom < hitbox.top) &&
      (hitbox.bottom < rect.top)
    );
  };

  function getPosition() {
    //  |>
    const tri = game.verticesTriangleSub;
    const vert1 = tri[0];
    const vert2 = tri[1];
    const vert3 = tri[2];

    const p1 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert1, vertices[0]),
      vertices[0]
    );
    const p2 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert2, vertices[1]),
      vertices[1]
    );
    const p3 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert3, vertices[2]),
      vertices[2]
    );
    vertices[0][0] = p1[0];
    vertices[0][1] = p1[1];
    vertices[0][2] = p1[2];
    vertices[1][0] = p2[0];
    vertices[1][1] = p2[1];
    vertices[1][2] = p2[2];
    vertices[2][0] = p3[0];
    vertices[2][1] = p3[1];
    vertices[2][2] = p3[2];
    return vertices;
  }

  function getPositionLeft() {
    const tri = game.verticesTriangle;
    const x = tri[0], y = tri[1], z = tri[2], w = 1;
    const mvm = mvUniformMatrix;
    const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }

  function getPositionRight() {
    const tri = game.verticesTriangle;
    const x = tri[3], y = tri[4], z = tri[5], w = 1;
    const mvm = mvUniformMatrix;
    const c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }

  function getPositionTop() {
    const tri = game.verticesTriangle;
    const x = tri[0], y = tri[1], z = tri[2], w = 1;
    const mvm = mvUniformMatrix;
    const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }

  function getPositionBottom() {
    const tri = game.verticesTriangle;
    const x = tri[6], y = tri[7], z = tri[8], w = 1;
    const mvm = mvUniformMatrix;
    const c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }

  function getHitbox() {
    hitbox.left = getPositionLeft();
    hitbox.right = getPositionRight();
    hitbox.top = getPositionTop();
    hitbox.bottom = getPositionBottom();
    hitbox.depth = mvUniformMatrix[14];
    return hitbox;
  }

  Object.defineProperty(this, "hitpoints", {get: function () {return hp;}, set: function(hp_) {hp = hp_;}});
  Object.defineProperty(this, "maxHitpoints", {get: function () {return maxHp;}});
  Object.defineProperty(this, "shield", {get: function () {return shield;}, set: function(sh) {shield = sh;}});
  Object.defineProperty(this, "maxShield", {get: function () {return maxShield;}});
  Object.defineProperty(this, "weapons", {get: function() {return weapons;}});
  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "positionDepth", {get: function() {return mvUniformMatrix[14];}});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "active", {get: function() {return true;}});
  Object.defineProperty(this, "linger", {get: function() {return true;}});

  this.resetGame();
}
