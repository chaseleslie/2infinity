/* global Physics Utils */
/* exported StarMap Star */

"use strict";

function StarMap(game, numStars) {
  const stars = [];
  numStars = numStars || 256;
  for (let k = 0; k < numStars; k += 1) {
    stars.push(new Star(game));
  }

  this.draw = function(gl) {
    for (let k = 0; k < numStars; k += 1) {
      const star = stars[k];
      star.draw(gl);
    }
  };
  this.update = function(dt) {
    for (let k = 0; k < numStars; k += 1) {
      const star = stars[k];
      star.update(dt);
      if (star.offScreen) {
        star.reset();
      }
    }
  };
}

function Star(game) {
  const stepFn = () => Utils.getRandomInt(0, 1);
  const depths = [0.8, 0.9, 1.0];
  const speedAndDepth = Math.floor(Math.random() * depths.length);
  const scale = 12;
  const scaleBounds = scale / 4;
  const xScale = game.modelScale / (scale * 2);
  const yScale = game.modelScale / scale;
  const zScale = game.modelScale / scale;
  var verticalPos = (stepFn() ? 1 : -1) * Math.random() * (scaleBounds - yScale);
  var horizontalPos = (stepFn() ? 1 : -1) * (scaleBounds - xScale) * Math.random();
  const depthPos = depths[speedAndDepth];
  const speeds = [
    0.0001, 0.00005, 0.00002
  ];
  const speed = speeds[speedAndDepth];
  const state = new Physics.State(
    [horizontalPos, verticalPos, depthPos],
    [-speed, 0, 0]
  );
  var texCoordsBufferIndex = 0;

  const mvUniformMatrix = Utils.modelViewMatrix(
    new Float32Array(16),
    {"x": horizontalPos, "y": verticalPos, "z": depthPos},
    {"x": 0, "y": 0, "z": 0},
    {"x": xScale, "y": yScale, "z": zScale}
  );

  this.reset = function() {
    verticalPos = (stepFn() ? 1 : -1) * Math.random() * (scaleBounds - yScale);
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
