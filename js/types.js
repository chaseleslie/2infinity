/* global Physics Utils */
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
  var texCoordsBufferIndex = 0;

  var mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    {"x": horizontalPos, "y": verticalPos, "z": depthPos},
    {"x": 0, "y": 0, "z": 0},
    {"x": xScale, "y": yScale, "z": zScale}
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
    gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.star.coordBuffers[texCoordsBufferIndex]);
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
  type = type || 0;
  numProj = numProj || 50;
  projDir = projDir || 1;
  var projectiles = [];
  var weapon = game.weaponTypes[type];
  var projType = weapon.projectileType;
  var projCount = weapon.projectileCount;
  var projCoolDown = coolDown || game.projectileTypes[game.projectileTypesMap[projType]].coolDown;
  var point = {"x": 0, "y": 0, "z": 0};

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
    let score = 0;
    for (let k = 0; k < projectiles.length; k += 1) {
      let proj = projectiles[k];
      if (proj.active) {
        let offScreen = false;
        if (proj.dir > 0) {
          if (proj.hitbox.left > 1.0) {
            offScreen = true;
          }
        } else if (proj.dir < 0) {
          if (proj.hitbox.right < -1.0) {
            offScreen = true;
          }
        }

        if (offScreen) {
          proj.reset(projType, 0, 0, false, projDir);
        }
        proj.update(dt);

        if (proj.exploded) {
          continue;
        }

        let hitbox = proj.hitbox;
        for (let n = 0; n < game.enemies.length; n += 1) {
          let enemy = game.enemies[n];
          if (enemy.active && enemy.hitPoints > 0 && enemy.intersectsWith(hitbox)) {
            let projPos = proj.position;
            for (let m = 0; m < projPos.length; m += 1) {
              let vert = projPos[m];
              point.x = vert[0];
              point.y = vert[1];
              point.z = vert[2];
              let directHit = enemy.containsPoint(point);
              if (directHit) {
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
      }
    }
    return score;
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
  var speed = game.projectileTypes[projType].speed;
  var xScale = game.projectileTypes[projType].xScale;
  var yScale = game.projectileTypes[projType].yScale;
  var zScale = game.projectileTypes[projType].zScale;
  var texType = game.projectileTypes[projType].texType;
  var dmg = game.projectileTypes[projType].damage;
  var active = isActive || false;
  dir = dir || 1;
  var prune = 0;
  var showDestroyedFrames = 4;
  var depthPos = 0.0;
  var vertices = [
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3),
    new Float32Array(3)
  ];
  var state = new Physics.State(
    [x, y, depthPos],
    [dir ? speed : -speed, 0, 0]
  );
  var texCoordsBufferIndexProj = texType;
  var texCoordsBufferIndexExpl = 0;

  var mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    {"x": x, "y": y, "z": 0.0},
    {"x": 0, "y": 0, "z": 0},
    {"x": xScale, "y": yScale, "z": zScale}
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
    speed = game.projectileTypes[projType].speed;
    xScale = game.projectileTypes[projType].xScale;
    yScale = game.projectileTypes[projType].yScale;
    zScale = game.projectileTypes[projType].zScale;
    dmg = game.projectileTypes[projType].damage;

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
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.coordBuffers[texCoordsBufferIndexExpl]);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);
    } else {
      gl.activeTexture(game.textures.projectile.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.projectile.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.projectile.coordBuffers[texCoordsBufferIndexProj]);
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

  function getPosition() {
    //   <|
    //  |>
    var tri = game.verticesRectangleSub;
    var vert1 = tri[0];
    var vert2 = tri[1];
    var vert3 = tri[2];
    var vert4 = tri[3];
    var vert5 = tri[4];
    var vert6 = tri[5];

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
    var p4 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert4, vertices[3]),
      vertices[3]
    );
    var p5 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert5, vertices[4]),
      vertices[4]
    );
    var p6 = Utils.matrixMultiplyPoint(
      game.pUniformMatrix,
      Utils.matrixMultiplyPoint(mvUniformMatrix, vert6, vertices[5]),
      vertices[5]
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

    vertices[3][0] = p4[0];
    vertices[3][1] = p4[1];
    vertices[3][2] = p4[2];
    vertices[4][0] = p5[0];
    vertices[4][1] = p5[1];
    vertices[4][2] = p5[2];
    vertices[5][0] = p6[0];
    vertices[5][1] = p6[1];
    vertices[5][2] = p6[2];

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

  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "hitbox", {get: getHitbox});
  Object.defineProperty(this, "damage", {get: function() {return dmg;}});
  Object.defineProperty(this, "prune", {get: function() {return prune >= showDestroyedFrames;}});
  Object.defineProperty(this, "exploded", {get: function() {return prune > 0;}});
  Object.defineProperty(this, "active", {get: function() {return active;}});
  Object.defineProperty(this, "direction", {get: function() {return dir;}});
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
  var texCoordsBufferIndex = 0;

  var mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    {"x": horizontalPos, "y": verticalPos, "z": depthPos},
    {"x": 0, "y": Math.PI, "z": 0},
    {"x": xScale, "y": yScale, "z": zScale}
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
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.explosion.coordBuffers[texCoordsBufferIndex]);
      gl.vertexAttribPointer(game.textures.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(game.textureUniform, game.textures.explosion.texIdIndex);

      gl.bindBuffer(gl.ARRAY_BUFFER, game.vertexRectangleBufferObject);
      numTri = game.verticesRectangle.length / 3;
    } else {
      gl.activeTexture(game.textures.enemyShip.texId);
      gl.bindTexture(gl.TEXTURE_2D, game.textures.enemyShip.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, game.textures.enemyShip.coordBuffers[texCoordsBufferIndex]);
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
  const velocityDefault = 0.0006;
  var velocity = velocityDefault;

  // Rolling animation props
  var rollingUp = 0;
  var rollingDown = 0;
  const rollingMax = 10;
  var rollingAngle = 15;
  // Pitching animation props
  var pitching = 0;
  const pitchingMax = 96;
  var pitchingDepth = 0.6;
  var pitchAngleMax = Math.PI/5;
  // Movement animation props
  var texCoordsBufferIndex = game.textures.ship.SHIP_IDLE;
  const animMovementMax = rollingMax;
  var animMovementCount = 0;

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
  var state = new Physics.State(
    [startPos.x, startPos.y, startPos.z],
    [0, 0, 0]
  );

  for (let k = 0; k < game.weaponTypes.length; k += 1) {
    weapons.push(new Weapon(game, k, projCount, 1, null));
  }

  var mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    {"x": startPos.x, "y": startPos.y, "z": startPos.z},
    {"x": 0, "y": 0, "z": 0},
    {"x": xScale, "y": yScale, "z": zScale}
  );

  var hitbox = {
    "left": 0,
    "right": 0,
    "top": 0,
    "bottom": 0,
    "depth": 0
  };
  var translateVec = {"x": startPos.x, "y": startPos.y, "z": startPos.z};
  var rotations = {"x": 0, "y": 0, "z": 0};
  var scales = {"x": xScale, "y": yScale, "z": zScale};
  // var point = {"x": 0, "y": 0, "z": 0};

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

    let score = 0;
    for (let k = 0; k < weapons.length; k += 1) {
      let weapon = weapons[k];
      score += weapon.update(dt);
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
  Object.defineProperty(this, "position", {get: getPosition});
  Object.defineProperty(this, "positionLeft", {get: getPositionLeft});
  Object.defineProperty(this, "positionRight", {get: getPositionRight});
  Object.defineProperty(this, "positionTop", {get: getPositionTop});
  Object.defineProperty(this, "positionBottom", {get: getPositionBottom});
  Object.defineProperty(this, "hitbox", {get: getHitbox});

  this.resetGame();
}
