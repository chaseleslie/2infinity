/* global Physics MDN Utils */
/* exported StarMap Star Weapon Projectile Enemy Player */

var global = window;

function StarMap(game, numStars) {
  var stars = [];
  numStars = numStars || 256;
  for (let k = 0; k < numStars; k += 1) {
    stars.push(new Star(game));
  }

  this.draw = function(gl) {
    for (let k = 0; k < numStars; k += 1) {
      let star = stars[k];
      star.draw(gl);
    }
  };
  this.update = function(dt) {
    for (let k = 0; k < numStars; k += 1) {
      let star = stars[k];
      star.update(dt);
      if (star.offScreen) {
        star.reset();
      }
    }
  };
}

function Star(game) {
  var depths = [0.8, 0.9, 1.0];
  var speedAndDepth = Math.floor(Math.random() * depths.length);
  var scale = 12;
  var scaleBounds = scale / 4;
  var xScale = game.modelScale / (scale * 2);
  var yScale = game.modelScale / scale;
  var zScale = game.modelScale / scale;
  var verticalPos = Math.random() * (scaleBounds - yScale);
  verticalPos = (Math.round(Math.random()) % 2) ? -verticalPos : verticalPos;
  var horizontalPos = (scaleBounds - xScale) * Math.random();
  horizontalPos = (Math.round(Math.random()) % 2) ? -horizontalPos : horizontalPos ;
  var depthPos = depths[speedAndDepth];
  var speeds = [
    0.0001, 0.00005, 0.00002
  ];
  var speed = speeds[speedAndDepth];
  var state = new Physics.State(
    [horizontalPos, verticalPos, depthPos],
    [-speed, 0, 0]
  );

  var mvUniformMatrix = new Float32Array(
    MDN.multiplyArrayOfMatrices([
      MDN.translateMatrix(horizontalPos, verticalPos, depthPos),
      MDN.scaleMatrix(xScale, yScale, zScale)
    ])
  );

  this.reset = function() {
    verticalPos = Math.random() * (scaleBounds - yScale);
    verticalPos = (Math.round(Math.random()) % 2) ? -verticalPos : verticalPos;
    horizontalPos = 1 + scale/4 + Math.random() * xScale;

    state.position[0] = horizontalPos;
    state.position[1] = verticalPos;

    mvUniformMatrix[0] = xScale;
    mvUniformMatrix[5] = yScale;
    mvUniformMatrix[10] = zScale;
    mvUniformMatrix[12] = horizontalPos;
    mvUniformMatrix[13] = verticalPos;
    mvUniformMatrix[14] = depthPos;
    mvUniformMatrix[15] = 1;
  };
  this.draw = function(gl) {
    gl.activeTexture(game.textures.star.texId);
    gl.bindTexture(gl.TEXTURE_2D, game.textures.star.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.star.buffer);
    gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(game.textureUniform, game.textures.star.texIdIndex);

    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
    gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, game.verticesRectangle.length / 3);

    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  this.update = function(dt) {
    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];
  };

  function getPositionRight() {
    var tri = game.verticesTriangle;
    var x = tri[0], y = tri[1], z = tri[2], w = 1;
    var mvm = mvUniformMatrix;
    var c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }
  function offScreen() {
    return getPositionRight() < -scaleBounds;
  }

  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "offScreen", {get: offScreen});
}

function Weapon(game, type, numProj, projDir, coolDown) {
  // type = type || "basic";
  type = type || 0;
  numProj = numProj || 50;
  projDir = projDir || 1;
  var projectiles = [];
  // var weaponType = game.weaponTypesMap[type];
  // var weapon = game.weaponTypes[weaponType];
  var weapon = game.weaponTypes[type];
  var projType = weapon.projectileType;
  var projCount = weapon.projectileCount;
  var projCoolDown = coolDown || game.projectilesTypes[game.projectileTypesMap[projType]].coolDown;

  for (let k = 0; k < numProj; k += 1) {
    projectiles.push(new Projectile(game, projType, 0, 0, 0, false, projDir));
  }

  this.draw = function(gl) {
    for (let k = 0; k < projectiles.length; k += 1) {
      let proj = projectiles[k];
      if (proj.active) {
        proj.draw(gl);
      }
    }
  };
  this.update = function(dt) {
    for (let k = 0; k < projectiles.length; k += 1) {
      let proj = projectiles[k];
      if (proj.active) {
        if (proj.hitbox.left > 1.0) {
          proj.reset(projType, 0, 0, false, projDir);
        }
        proj.update(dt);
      }
    }
  };
  this.fireWeapon = function(ts, dt, lastTs, hitbox) {
    var numFoundProj = 0;
    var projSpacing = (hitbox.top - hitbox.bottom) / (projCount + 1);
    var x = (projDir) ? hitbox.right : hitbox.left;

    if (ts < (lastTs + projCoolDown)) {
      return false;
    }

    for (let k = 0; k < projectiles.length; k += 1) {
      let proj = projectiles[k];
      if (!proj.active) {
        numFoundProj += 1;
        let yVal = hitbox.top - numFoundProj * projSpacing;
        proj.reset(projType, x, yVal, true, projDir);
        if (numFoundProj >= projCount) {
          break;
        }
      }
    }

    if (numFoundProj < projCount) {
      for (let k = 0, n = projCount - numFoundProj; k < n; k += 1) {
        let yVal = hitbox.top - (numFoundProj + 1) * projSpacing;
        projectiles.push(new Projectile(game, projType, x, yVal, ts, true, projDir));
        numFoundProj += 1;
      }
    }

    return true;
  };
  Object.defineProperty(this, "projectiles", {get: function() {return projectiles;}});
}

function Projectile(game, pType, x, y, spawnTs, isActive, dir) {
  pType = pType || game.projectileTypesMap["default"] || 0;
  var type = pType;
  var projType = game.projectileTypesMap[type];
  var speed = game.projectilesTypes[projType].speed;
  var xScale = game.projectilesTypes[projType].xScale;
  var yScale = game.projectilesTypes[projType].yScale;
  var zScale = game.projectilesTypes[projType].zScale;
  var dmg = game.projectilesTypes[projType].damage;
  var active = isActive || false;
  dir = dir || 1;
  var prune = 0;
  var showDestroyedFrames = 4;
  var depthPos = 0.0;
  var state = new Physics.State(
    [x, y, depthPos],
    [dir ? speed : -speed, 0, 0]
  );
  var mvUniformMatrix = new Float32Array(
    MDN.multiplyArrayOfMatrices([
      MDN.translateMatrix(x, y, 0.0),
      MDN.scaleMatrix(xScale, yScale, zScale)
    ])
  );
  var hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };

  this.reset = function(pType, x1, y1, isActive, direc) {
    type = pType;
    projType = game.projectileTypesMap[type];
    speed = game.projectilesTypes[projType].speed;
    xScale = game.projectilesTypes[projType].xScale;
    yScale = game.projectilesTypes[projType].yScale;
    zScale = game.projectilesTypes[projType].zScale;
    dmg = game.projectilesTypes[projType].damage;

    active = isActive || false;
    dir = direc || 1;

    state.position[0] = x1;
    state.position[1] = y1;
    state.velocity[0] = dir ? speed : -speed;

    mvUniformMatrix[5] = yScale;
    mvUniformMatrix[12] = x1 || 0;
    mvUniformMatrix[13] = y1 || 0;
    x = x1;
    y = y1;
    prune = 0;
  };
  this.draw = function(gl) {
    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    if (prune) {
      gl.activeTexture(game.textures.explosion.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.explosion.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.buffer);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);
    } else {
      gl.activeTexture(game.textures.projectile.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.projectile.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.projectile.buffer);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.projectile.texIdIndex);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
    gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, game.verticesRectangle.length / 3);

    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  this.update = function(dt) {
    if (prune) {
      if (prune > showDestroyedFrames) {
        active = false;
        return false;
      }
      prune += 1;
      return false;
    }

    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];

    return true;
  };
  this.setExploded = function() {
    prune += 1;
    mvUniformMatrix[0] = xScale;
    mvUniformMatrix[5] = yScale * 3;
    mvUniformMatrix[10] = zScale;
    mvUniformMatrix[13] = y;
    mvUniformMatrix[14] = 0.0;
    mvUniformMatrix[15] = 1;
  };

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

  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "damage", {get: function() {return dmg;}});
  Object.defineProperty(this, "prune", {get: function() {return prune >= showDestroyedFrames;}});
  Object.defineProperty(this, "exploded", {get: function() {return prune > 0;}});
  Object.defineProperty(this, "active", {get: function() {return active;}});
}

function Enemy(game, type, isActive) {
  var enemyType = game.enemyTypesMap[type];
  var speed = game.enemyTypes[enemyType].speed;
  var xScale = game.enemyTypes[enemyType].xScale;
  var yScale = game.enemyTypes[enemyType].yScale;
  var zScale = game.enemyTypes[enemyType].zScale;
  var hp = game.enemyTypes[enemyType].hitPoints;
  var points = game.enemyTypes[enemyType].hitPoints;
  var dmgRate = game.difficultyMap.prediv[game.difficulty];
  var prune = 0;
  var showDestroyedFrames = 8;
  var active = isActive || false;
  var verticalPos = Math.random() * (1 - game.modelScale);
  verticalPos = ((global.performance.now()|0) % 2) ? -verticalPos : verticalPos;
  var horizontalPos = 1.10;
  var depthPos = 0.0;
  var vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  var state = new Physics.State(
    [horizontalPos, verticalPos, depthPos],
    [-speed, 0, 0]
  );
  var mvUniformMatrix = new Float32Array(
    MDN.multiplyArrayOfMatrices([
      MDN.translateMatrix(horizontalPos, verticalPos, depthPos),
      MDN.rotateYMatrix(Math.PI),
      MDN.scaleMatrix(xScale, yScale, zScale)
    ])
  );
  var hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };

  this.reset = function(eType, isActive) {
    var now = global.performance.now();
    type = eType;
    enemyType = game.enemyTypesMap[type];
    speed = game.enemyTypes[enemyType].speed;
    xScale = game.enemyTypes[enemyType].xScale;
    yScale = game.enemyTypes[enemyType].yScale;
    zScale = game.enemyTypes[enemyType].zScale;
    hp = game.enemyTypes[enemyType].hitPoints;
    points = game.enemyTypes[enemyType].hitPoints;
    dmgRate = game.difficultyMap.prediv[game.difficulty];
    prune = 0;
    active = isActive || false;

    state.position[0] = horizontalPos;
    state.position[1] = verticalPos;
    state.velocity[0] = -speed;

    verticalPos = Math.random() * (1 - game.modelScale);
    verticalPos = ((now|0) % 2) ? -verticalPos : verticalPos;
    mvUniformMatrix[0] = -xScale;
    mvUniformMatrix[2] = 0;
    mvUniformMatrix[5] = yScale;
    mvUniformMatrix[8] = 0;
    mvUniformMatrix[10] = -zScale;
    mvUniformMatrix[12] = horizontalPos;
    mvUniformMatrix[13] = verticalPos;
  };
  this.draw = function(gl) {
    var numTri = 0;
    gl.uniformMatrix4fv(game.mvUniform, false, mvUniformMatrix);
    if (prune) {
      gl.activeTexture(game.textures.explosion.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.explosion.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.buffer);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);

      gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
      numTri = game.verticesRectangle.length / 3;
    } else {
      gl.activeTexture(game.textures.enemyShip.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.enemyShip.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.enemyShip.buffer);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.enemyShip.texIdIndex);

      gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexTriangleBufferObject);
      numTri = game.verticesTriangle.length / 3;
    }

    gl.vertexAttribPointer(game.vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, numTri);

    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  this.update = function(dt) {
    if (hp <= 0) {
      if (prune > showDestroyedFrames) {
        active = false;
        return false;
      }
      prune += 1;
      return false;
    }

    Physics.integrateState(state, game.time, dt);
    mvUniformMatrix[12] = state.position[0];

    return true;
  };
  this.takeHit = function(pts) {
    hp -= dmgRate * pts;
    return hp;
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
    //  <|
    var tri = game.verticesTriangle;
    var vert1 = [tri[0], tri[1], tri[2], 1];
    var vert2 = [tri[3], tri[4], tri[5], 1];
    var vert3 = [tri[6], tri[7], tri[8], 1];

    var p1 = MDN.multiplyPoint(
      game.pUniformMatrix, MDN.multiplyPoint(mvUniformMatrix, vert1)
    );
    var p2 = MDN.multiplyPoint(
      game.pUniformMatrix, MDN.multiplyPoint(mvUniformMatrix, vert2)
    );
    var p3 = MDN.multiplyPoint(
      game.pUniformMatrix, MDN.multiplyPoint(mvUniformMatrix, vert3)
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
    var x = tri[3], y = tri[4], z = tri[5], w = 1;
    var mvm = mvUniformMatrix;
    var c1r1 = mvm[0], c1r2 = mvm[4], c1r3 = mvm[8], c1r4 = mvm[12];

    return (x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4) * game.pUniformMatrix[0];
  }
  function getPositionRight() {
    var tri = game.verticesTriangle;
    var x = tri[0], y = tri[1], z = tri[2], w = 1;
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
    return hitbox;
  }

  Object.defineProperty(this, "hitPoints", {get: function () {return hp;}});
  Object.defineProperty(this, "points", {get: function () {return points;}});
  Object.defineProperty(this, "prune", {get: function () {return prune >= showDestroyedFrames;}});
  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "active", {get: function() {return active;}});
  Object.defineProperty(this, "enemyType", {get: function() {return type;}});
}

function Player(game, aspect) {
  var xScale = game.modelScale / aspect;
  var yScale = game.modelScale;
  var zScale = game.modelScale;
  var maxHp = 1000;
  var hp = maxHp;
  var dmgRate = game.difficultyMap.prediv[game.difficulty];
  var rollingUp = 0;
  var rollingDown = 0;
  var rollingMax = 10;
  var rollingAngle = 15;
  var pitching = 0;
  var pitchingMax = 96;
  var pitchingDepth = 0.6;
  var weapons = [];
  var weaponSelected = 2;
  var weaponLastTs = 0;
  var projCount = 50;
  var startPos = {x: -0.5, y: 0.0, z: 0.0};
  var vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];

  for (let k = 0; k < game.weaponTypes.length; k += 1) {
    weapons.push(new Weapon(game, k, projCount, 1, null));
  }

  var mvUniformMatrix = new Float32Array(
    MDN.multiplyArrayOfMatrices([
      MDN.translateMatrix(startPos.x, startPos.y, startPos.z),
      MDN.scaleMatrix(xScale, yScale, zScale)
    ])
  );
  var hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };
  var translateVec = {"x": startPos.x, "y": startPos.y, "z": startPos.z};
  var positionVec = {"x": startPos.x, "y": startPos.y, "z": startPos.z};
  var rotations = {"x": 0, "y": 0, "z": 0};
  var scales = {"x": xScale, "y": yScale, "z": zScale};

  this.reset = function(translate, rotate) {
    var trans = translateVec;
    var rot = rotations;

    if (translate && typeof translate === "object") {
      if ("x" in translate && typeof translate.x === "number") {
        trans.x = translate.x;
      } else {
        trans.x = startPos.x;
      }
      if ("y" in translate && typeof translate.y === "number") {
        trans.y = translate.y;
      } else {
        trans.y = startPos.y;
      }
      if ("z" in translate && typeof translate.z === "number") {
        trans.z = translate.z;
      } else {
        trans.z = startPos.z;
      }
    } else {
      trans.x = startPos.x;
      trans.y = startPos.y;
      trans.z = startPos.z;
    }

    if (rotate && typeof rotate === "object") {
      if ("x" in rotate && typeof rotate.x === "number") {
        rot.x = rotate.x;
      } else {
        rot.x = 0;
      }
      if ("y" in rotate && typeof rotate.y === "number") {
        rot.y = rotate.y;
      } else {
        rot.y = 0;
      }
      if ("z" in rotate && typeof rotate.z === "number") {
        rot.z = rotate.z;
      } else {
        rot.z = 0;
      }
    } else {
      rot.x = 0;
      rot.y = 0;
      rot.z = 0;
    }

    Utils.modelViewMatrix(mvUniformMatrix, trans, rot, scales);
  };
  this.resetGame = function() {
    hp = maxHp;
    this.reset(startPos, false);
  };
  this.draw = function(gl) {
    gl.activeTexture(game.textures.ship.texId);
    gl.bindTexture(gl.TEXTURE_2D, game.textures.ship.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.ship.buffer);
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
    var incr = 0.01;

    let arrowLeft = game.keydownMap["ArrowLeft"];
    if (arrowLeft) {
      let left = getPositionLeft();
      if (Math.abs(-1.0 - left) < incr) {
        let hitbox = getHitbox();
        mvUniformMatrix[12] = -1.0 + (hitbox.right - hitbox.left) / 2;
      } else if (left - incr >= -1) {
        mvUniformMatrix[12] -= incr;
      }
    }

    let arrowUp = game.keydownMap["ArrowUp"];
    if (arrowUp) {
      let top = getPositionTop();
      if (Math.abs(1.0 - top) < incr) {
        let hitbox = getHitbox();
        mvUniformMatrix[13] = 1.0 - (hitbox.top - hitbox.bottom) / 2;
      } else if (top - incr >= -1) {
        mvUniformMatrix[13] += incr;
      }

      rollingUp = rollingMax;
      rollingDown = 0;
    }

    let arrowRight = game.keydownMap["ArrowRight"];
    if (arrowRight) {
      let right = getPositionRight();
      if (Math.abs(1.0 - right) < incr) {
        let hitbox = getHitbox();
        mvUniformMatrix[12] = 1.0 - (hitbox.right - hitbox.left) / 2;
      } else if (right - incr >= -1) {
        mvUniformMatrix[12] += incr;
      }
    }

    let arrowDown = game.keydownMap["ArrowDown"];
    if (arrowDown) {
      let bottom = getPositionBottom();
      if (Math.abs(-1.0 - bottom) < incr) {
        let hitbox = getHitbox();
        mvUniformMatrix[13] = -1.0 + (hitbox.top - hitbox.bottom) / 2;
      } else if (bottom - incr >= -1) {
        mvUniformMatrix[13] -= incr;
      }

      rollingDown = rollingMax;
      rollingUp = 0;
    }

    let dive = game.keydownMap["Dive"];
    if (dive && !pitching) {
      pitching = pitchingMax;
    }

    if (rollingUp || rollingDown || pitching) {
      let angleX = 0;
      let angleY = 0;
      let angleZ = 0;
      let pos = positionVec;
      let iter = 0;

      pos.x = mvUniformMatrix[12];
      pos.y = mvUniformMatrix[13];
      pos.z = mvUniformMatrix[14];

      if (rollingUp) {
        rollingUp -= 1;
        iter = -rollingUp;
      } else if (rollingDown) {
        rollingDown -= 1;
        iter = rollingDown;
      }
      angleX = (iter / rollingMax) * rollingAngle * (Utils.DEG2RAD);
      if (pitching) {
        pitching -= 1;
        iter = pitching / pitchingMax;
        let z = pitchingDepth * Math.sin(Math.PI * iter);

        pos.z = Utils.mapValue(z, 0, 1, 0, pitchingDepth);
        if (iter >= 0.5) {
          angleY = Utils.mapValue(Math.sin(Math.PI * iter), 0, 1, 0, Math.PI/6);
        } else {
          angleY = Utils.mapValue(-Math.sin(Math.PI * iter), 0, 1, 0, Math.PI/6);
        }

      } else {
        pos.z = 0;
      }

      rotations.x = angleX;
      rotations.y = angleY;
      rotations.z = angleZ;
      this.reset(pos, rotations);
    }

    let score = 0;
    for (let k = 0; k < weapons.length; k += 1) {
      let weapon = weapons[k];
      weapon.update(dt);
      let projectiles = weapon.projectiles;
      for (let iK = 0; iK < projectiles.length; iK += 1) {
        let proj = projectiles[iK];
        if (!proj.active || proj.exploded) {
          continue;
        }
        let hitbox = proj.hitbox;
        for (let n = 0; n < game.enemies.length; n += 1) {
          let enemy = game.enemies[n];
          if (enemy.active && enemy.hitPoints > 0 && enemy.intersectsWith(hitbox)) {
            enemy.takeHit(proj.damage);
            if (enemy.hitPoints <= 0) {
              score += enemy.points;
            }
            proj.setExploded();
            break;
          }
        }
      }
    }
    return score;
  };
  this.takeHit = function(points) {
    hp -= dmgRate * points;
    return hp;
  };
  this.fireWeapon = function(ts, dt) {
    var weapon = weapons[weaponSelected];
    var fired = false;
    if (!pitching) {
      fired = weapon.fireWeapon(ts, dt, weaponLastTs, getHitbox());
      if (fired) {
        weaponLastTs = ts;
      }
    }
    return fired;
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
    var tri = game.verticesTriangle;
    var vert1 = [tri[0], tri[1], tri[2], 1];
    var vert2 = [tri[3], tri[4], tri[5], 1];
    var vert3 = [tri[6], tri[7], tri[8], 1];

    var p1 = MDN.multiplyPoint(
      game.pUniformMatrix, MDN.multiplyPoint(mvUniformMatrix, vert1)
    );
    var p2 = MDN.multiplyPoint(
      game.pUniformMatrix, MDN.multiplyPoint(mvUniformMatrix, vert2)
    );
    var p3 = MDN.multiplyPoint(
      game.pUniformMatrix, MDN.multiplyPoint(mvUniformMatrix, vert3)
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
  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "hitbox", {get: getHitbox});

  this.reset(positionVec, rotations);
}
