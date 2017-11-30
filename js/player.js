/* global Physics Utils Weapon */
/* exported Player */

"use strict";

function Player(game, aspect) {
  var maxHp = 1000;
  var hp = maxHp;
  var dmgRate = game.difficultyMap.prediv[game.difficulty];
  const velocityDefault = 0.0006;
  var velocity = velocityDefault;

  /* Rolling animation props */
  var rollingUp = 0;
  var rollingDown = 0;
  const rollingMax = 10;
  var rollingAngle = 15;
  /* Pitching animation props */
  var pitching = 0;
  const pitchingMax = 96;
  var pitchingDepth = 0.6;
  var pitchAngleMax = Math.PI/5;
  /* Movement animation props */
  var texCoordsBufferIndex = game.textures.ship.SHIP_IDLE;
  const animMovementMax = rollingMax;
  var animMovementCount = 0;

  var weapons = [];
  var weaponSelected = 0;
  var projCount = 50;
  var projDir = 0;
  var startPos = {x: -0.5, y: 0.0, z: 0.0};
  var vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  var state = new Physics.State(
    [startPos.x, startPos.y, startPos.z],
    [0, 0, 0]
  );

  for (let k = 0; k < game.gameData.weapons.length; k += 1) {
    let weapon = game.gameData.weapons[k];
    weapons.push(new Weapon(game, k, projCount, projDir, null, weapon.texType));
  }

  var translateVec = {"x": startPos.x, "y": startPos.y, "z": startPos.z};
  var rotations = {"x": 0, "y": 0, "z": 0};
  var scales = {
    "x": game.modelScale / aspect,
    "y": game.modelScale,
    "z": game.modelScale / aspect
  };
  var mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    translateVec,
    rotations,
    scales
  );

  var hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };

  this.reset = function(dt) {
    Physics.integrateState(state, game.time, dt);
    state.velocity[0] = 0;
    state.velocity[1] = 0;
    state.velocity[2] = 0;

    var trans = translateVec;

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
      let weapon = weapons[k];
      weapon.draw(gl);
    }
  };
  this.update = function(dt) {
    var arrowLeft = game.keydownMap["ArrowLeft"];
    var arrowUp = game.keydownMap["ArrowUp"];
    var arrowRight = game.keydownMap["ArrowRight"];
    var arrowDown = game.keydownMap["ArrowDown"];
    var dive = game.keydownMap["Dive"];
    var rot = rotations;
    var isMoving = false;
    var cos = Math.cos;
    var sin = Math.sin;

    if (arrowLeft && !arrowRight) {
      state.velocity[0] = -velocity;
      isMoving = true;
    } else if (arrowRight && !arrowLeft) {
      state.velocity[0] = velocity;
      isMoving = true;
    }

    if (arrowUp && !arrowDown) {
      state.velocity[1] = velocity * aspect;
      isMoving = true;
    } else if (arrowDown && !arrowUp) {
      state.velocity[1] = -velocity * aspect;
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

      angleX = (iter / rollingMax) * (rollingAngle * Utils.DEG2RAD);

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
      let left = getPositionLeft();
      if (left < -1.0) {
        let vertTri = game.verticesTriangle;
        let p1 = -vertTri[0] * scales.x * cos(rot.y) * cos(rot.z);
        let p2 = -vertTri[1] * scales.y * (cos(rot.x) * sin(rot.z) + sin(rot.x) * sin(rot.z));
        let p3 = vertTri[2] * scales.z * (cos(rot.x) * cos(rot.z) * sin(rot.y) - sin(rot.x) * sin(rot.z));
        state.position[0] = p1 + p2 + p3 - 1;
      }
    }
    if (arrowUp) {
      let top = getPositionTop();
      if (top > 1.0) {
        let vertTri = game.verticesTriangle;
        let p1 = vertTri[0] * scales.x * cos(rot.y) * sin(rot.z);
        let p2 = vertTri[1] * scales.y * (sin(rot.x) * sin(rot.y) * sin(rot.z) - cos(rot.x) * cos(rot.z));
        let p3 = -vertTri[2] * scales.z * (cos(rot.x) * sin(rot.y) * sin(rot.z) + cos(rot.z) * sin(rot.x));
        state.position[1] = p1 + p2 + p3 + 1;
      }

      if (!arrowDown) {
        rollingUp = rollingMax;
        rollingDown = 0;
      }
    }
    if (arrowRight) {
      let right = getPositionRight();
      if (right > 1.0) {
        let vertTri = game.verticesTriangle;
        let p1 = -vertTri[3] * scales.x * cos(rot.y) * cos(rot.z);
        let p2 = -vertTri[4] * scales.y * (cos(rot.x) * sin(rot.z) + sin(rot.x) * sin(rot.z));
        let p3 = vertTri[5] * scales.z * (cos(rot.x) * cos(rot.z) * sin(rot.y) - sin(rot.x) * sin(rot.z));
        state.position[0] = p1 + p2 + p3 + 1;
      }
    }
    if (arrowDown) {
      let bottom = getPositionBottom();
      if (bottom < -1.0) {
        let vertTri = game.verticesTriangle;
        let p1 = vertTri[6] * scales.x * cos(rot.y) * sin(rot.z);
        let p2 = vertTri[7] * scales.y * (sin(rot.x) * sin(rot.y) * sin(rot.z) - cos(rot.x) * cos(rot.z));
        let p3 = -vertTri[8] * scales.z * (cos(rot.x) * sin(rot.y) * sin(rot.z) + cos(rot.z) * sin(rot.x));
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
  this.takeHit = function(points) {
    hp -= dmgRate * points;
    return points;
  };
  this.fireWeapon = function(ts, dt) {
    var weapon = weapons[weaponSelected];
    var fired = false;
    if (!pitching) {
      fired = weapon.fireWeapon(ts, dt, projDir, getHitbox());
    }
    return fired;
  };
  this.selectWeapon = function(weapon) {
    weaponSelected = weapon;
  };
  this.containsPointHitbox = function(point) {
    var hitbox = getHitbox();
    return (
      (point.x >= hitbox.left) &&
      (point.x <= hitbox.right) &&
      (point.y <= hitbox.top) &&
      (point.y >= hitbox.bottom)
    );
  };
  this.containsPoint = function(point) {
    //Parametric equations solution
    var pos = getPosition();
    var p1 = pos[0], p2 = pos[1], p3 = pos[2];
    var denom = (p2[1] - p3[1])*(p1[0] - p3[0]) + (p3[0] - p2[0])*(p1[1] - p3[1]);
    var a = ((p2[1] - p3[1])*(point.x - p3[0]) + (p3[0] - p2[0])*(point.y - p3[1])) / denom;
    var b = ((p3[1] - p1[1])*(point.x - p3[0]) + (p1[0] - p3[0])*(point.y - p3[1])) / denom;
    var c = 1 - a - b;
    return (
      (0 <= a && a <= 1) &&
      (0 <= b && b <= 1) &&
      (0 <= c && c <= 1)
    );
  };
  this.intersectsWith = function(rect) {
    var hitbox = getHitbox();
    return (
      (rect.left < hitbox.right) &&
      (hitbox.left < rect.right) &&
      (rect.bottom < hitbox.top) &&
      (hitbox.bottom < rect.top)
    );
  };

  function getPosition() {
    //  |>
    var tri = game.verticesTriangleSub;
    var vert1 = tri[0];
    var vert2 = tri[1];
    var vert3 = tri[2];

    var p1 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert1, vertices[0]),
      vertices[0]
    );
    var p2 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert2, vertices[1]),
      vertices[1]
    );
    var p3 = Utils.matrixMultiplyPoint(
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
    var tri = game.verticesTriangle;
    var x = tri[0], y = tri[1], z = tri[2], w = 1;
    var mvm = mvUniformMatrix;
    var c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }
  function getPositionRight() {
    var tri = game.verticesTriangle;
    var x = tri[3], y = tri[4], z = tri[5], w = 1;
    var mvm = mvUniformMatrix;
    var c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }
  function getPositionTop() {
    var tri = game.verticesTriangle;
    var x = tri[0], y = tri[1], z = tri[2], w = 1;
    var mvm = mvUniformMatrix;
    var c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

    return (x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4) * game.pUniformMatrix[0];
  }
  function getPositionBottom() {
    var tri = game.verticesTriangle;
    var x = tri[6], y = tri[7], z = tri[8], w = 1;
    var mvm = mvUniformMatrix;
    var c2r1 = mvm[1], c2r2 = mvm[5], c2r3 = mvm[9], c2r4 = mvm[13];

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

  Object.defineProperty(this, "hitPoints", {get: function () {return hp;}});
  Object.defineProperty(this, "maxHitPoints", {get: function () {return maxHp;}});
  Object.defineProperty(this, "weapons", {get: function() {return weapons;}});
  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "positionDepth", {get: function() {return mvUniformMatrix[14];}});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "active", {get: function() {return true;}});

  this.resetGame();
}
