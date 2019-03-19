/* exported Utils */

var Utils = (function(glob) {

const global = glob;
const cos = Math.cos;
const sin = Math.sin;
const identityMatrix = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]);
const randArrayUint8 = new Uint8Array(32);
const randArrayUint32 = new Uint32Array(4);
const UINT32_MAX = 4294967295;
const UINT32_MAX_RECIP = 1 / UINT32_MAX;

function ExponentialAverage(alpha, initVal) {
  alpha = alpha || 0.5;
  var avg = initVal || 0;

  function setAlpha(a) {
    if (typeof a === "number" || a instanceof Number) {
      if (a >= 0 && a <= 1) {
        alpha = parseFloat(a);
      }
    }
  }

  function update(val) {
    avg = alpha * val + (1 - alpha) * avg;
  }

  Object.defineProperty(this, "alpha", {get: function() {return alpha;}, set: setAlpha});
  Object.defineProperty(this, "average", {get: function() {return avg;}});
  this.update = update;
}

function getShader(gl, id, type) {
  const shaderScript = document.getElementById(id);
  if (!shaderScript) {
    return null;
  }

  const shaderSource = shaderScript.text;

  if (!type) {
    if (shaderScript.type === "x-shader/x-fragment") {
      type = gl.FRAGMENT_SHADER;
    } else if (shaderScript.type === "x-shader/x-vertex") {
      type = gl.VERTEX_SHADER;
    } else {
      return null;
    }
  }

  const shader = gl.createShader(type);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function getRandomInt(min, max) {
  max += 1;
  const range = max - min;
  if (typeof global.crypto === "object" && typeof global.crypto.getRandomValues === "function") {
    const numBytes = Math.ceil(Math.log2(range) / 8);
    const maxNum = Math.pow(256, numBytes);
    let val = 0;

    while (true) {
      global.crypto.getRandomValues(randArrayUint8);
      for (let k = 0; k < numBytes; k += 1) {
        val = (val << 8) + randArrayUint8[k];
      }

      if (val + range - (val % range) < maxNum) {
        break;
      }
    }
    return min + (val % range);
  }

  return min + Math.floor(Math.random() * (range + 1));
}

function random() {
  global.crypto.getRandomValues(randArrayUint32);
  return randArrayUint32[0] * UINT32_MAX_RECIP;
}

function mapValue(val, x1, y1, x2, y2) {
  return (val - x1) * (y2 - x2) / (y1 - x1) + x2;
}

function createCircleVertices(centerVertex, numPoints, radius) {
  radius = (typeof radius === "number") ? radius : 1;
  const vertices = [];
  const tex = [];
  const x0 = centerVertex.x;
  const y0 = centerVertex.y;
  const z0 = centerVertex.z;
  const pi = (360 / numPoints) * DEG2RAD;
  var x1 = x0 + 1;
  var y1 = y0;
  const xmax = x0 + radius;
  const xmin = x0 - radius;
  const ymax = y0 + radius;
  const ymin = y0 - radius;

  for (let k = 0; k <= numPoints; k += 1) {
    vertices.push(x0);
    vertices.push(y0);
    vertices.push(z0);
    tex.push(mapValue(x0, xmin, xmax, 0, 1));
    tex.push(mapValue(y0, ymin, ymax, 0, 1));

    vertices.push(x1);
    vertices.push(y1);
    vertices.push(z0);
    tex.push(mapValue(x1, xmin, xmax, 0, 1));
    tex.push(mapValue(y1, ymin, ymax, 0, 1));

    x1 = x0 + cos(k * pi) * radius;
    y1 = y0 + sin(k * pi) * radius;
    vertices.push(x1);
    vertices.push(y1);
    vertices.push(z0);
    tex.push(mapValue(x1, xmin, xmax, 0, 1));
    tex.push(mapValue(y1, ymin, ymax, 0, 1));
  }

  return {
    "vertices": new Float32Array(vertices),
    "tex": new Float32Array(tex)
  };
}

function isArrayLike(arr) {
  var ret = false;
  if (!arr) {
    ret = false;
  } else if (Array.isArray(arr)) {
    ret = true;
  } else if (arr instanceof Int8Array) {
    ret = true;
  } else if (arr instanceof Int16Array) {
    ret = true;
  } else if (arr instanceof Int32Array) {
    ret = true;
  } else if (arr instanceof Uint8Array) {
    ret = true;
  } else if (arr instanceof Uint8ClampedArray) {
    ret = true;
  } else if (arr instanceof Uint16Array) {
    ret = true;
  } else if (arr instanceof Uint32Array) {
    ret = true;
  } else if (arr instanceof Float32Array) {
    ret = true;
  } else if (arr instanceof Float64Array) {
    ret = true;
  }
  return ret;
}

function modelViewMatrix(mvMatrix, trans, rotate, scale) {
  const x = trans.x;
  const y = trans.y;
  const z = trans.z;
  const alpha = rotate.x;
  const beta = rotate.y;
  const gamma = rotate.z;
  const w = scale.x;
  const h = scale.y;
  const d = scale.z;

  mvMatrix[0] = w * cos(gamma) * cos(beta);
  mvMatrix[1] = -w * sin(gamma) * cos(beta);
  mvMatrix[2] = w * sin(beta);
  mvMatrix[3] = 0;
  mvMatrix[4] = h * (cos(alpha) * sin(gamma) + sin(alpha) * sin(gamma));
  mvMatrix[5] = h * (cos(alpha) * cos(gamma) - sin(alpha) * sin(beta) * sin(gamma));
  mvMatrix[6] = -h * sin(alpha) * cos(beta);
  mvMatrix[7] = 0;
  mvMatrix[8] = d * (sin(alpha) * sin(gamma) - sin(beta) * cos(alpha) * cos(gamma));
  mvMatrix[9] = d * (sin(alpha) * cos(gamma) + sin(beta) * sin(gamma) * cos(alpha));
  mvMatrix[10] = d * cos(alpha) * cos(beta);
  mvMatrix[11] = 0;
  mvMatrix[12] = x;
  mvMatrix[13] = y;
  mvMatrix[14] = z;
  mvMatrix[15] = 1;

  return mvMatrix;
}

function matrixMultiplyPoint(matrix, point, outPoint) {
  const x = point[0], y = point[1], z = point[2], w = point[3] || 1;

  const c1r1 = matrix[ 0], c2r1 = matrix[ 1], c3r1 = matrix[ 2], c4r1 = matrix[ 3],
        c1r2 = matrix[ 4], c2r2 = matrix[ 5], c3r2 = matrix[ 6], c4r2 = matrix[ 7],
        c1r3 = matrix[ 8], c2r3 = matrix[ 9], c3r3 = matrix[10], c4r3 = matrix[11],
        c1r4 = matrix[12], c2r4 = matrix[13], c3r4 = matrix[14], c4r4 = matrix[15];

  outPoint[0] = x*c1r1 + y*c1r2 + z*c1r3 + w*c1r4;
  outPoint[1] = x*c2r1 + y*c2r2 + z*c2r3 + w*c2r4;
  outPoint[2] = x*c3r1 + y*c3r2 + z*c3r3 + w*c3r4;
  outPoint[3] = x*c4r1 + y*c4r2 + z*c4r3 + w*c4r4;
  return outPoint;
}

function multiplyArrayOfMatrices(matrices) {
  // Multiply array of matrices, store result in first matrix
  var result = matrices[0];

  for (let k = 1, n = matrices.length; k < n; k += 1) {
    result = multiplyMatrices(result, matrices[k]);
  }

  return result;
}

function multiplyMatrices(a, b) {
  // Multiply a*b, store result in a
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  a[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  a[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  a[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  a[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  a[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  a[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  a[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  a[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  a[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  a[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  a[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  a[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  a[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  a[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  a[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  a[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  return a;
}

function rotateXMatrix(matrix, a) {
  matrix[0] = 1; matrix[1] = 0; matrix[2] = 0; matrix[3] = 0;
  matrix[4] = 0; matrix[5] = cos(a); matrix[6] = -sin(a); matrix[7] = 0;
  matrix[8] = 0; matrix[9] = sin(a); matrix[10] = cos(a); matrix[11] = 0;
  matrix[12] = 0; matrix[13] = 0; matrix[14] = 0; matrix[15] = 1;
  return matrix;
}

function rotateYMatrix(matrix, a) {
  matrix[0] = cos(a); matrix[1] = 0; matrix[2] = sin(a); matrix[3] = 0;
  matrix[4] = 0; matrix[5] = 1; matrix[6] = 0; matrix[7] = 0;
  matrix[8] = -sin(a); matrix[9] = 0; matrix[10] = cos(a); matrix[11] = 0;
  matrix[12] = 0; matrix[13] = 0; matrix[14] = 0; matrix[15] = 1;
  return matrix;
}

function rotateZMatrix(matrix, a) {
  matrix[0] = cos(a); matrix[1] = -sin(a); matrix[2] = 0; matrix[3] = 0;
  matrix[4] = sin(a); matrix[5] = cos(a); matrix[6] = 0; matrix[7] = 0;
  matrix[8] = 0; matrix[9] = 0; matrix[10] = 1; matrix[11] = 0;
  matrix[12] = 0; matrix[13] = 0; matrix[14] = 0; matrix[15] = 1;
  return matrix;
}

function scaleMatrix(matrix, w, h, d) {
  matrix[0] = w; matrix[1] = 0; matrix[2] = 0; matrix[3] = 0;
  matrix[4] = 0; matrix[5] = h; matrix[6] = 0; matrix[7] = 0;
  matrix[8] = 0; matrix[9] = 0; matrix[10] = d; matrix[11] = 0;
  matrix[12] = 0; matrix[13] = 0; matrix[14] = 0; matrix[15] = 1;
  return matrix;
}

function translateMatrix(matrix, x, y, z) {
  matrix[0] = 1; matrix[1] = 0; matrix[2] = 0; matrix[3] = 0;
  matrix[4] = 0; matrix[5] = 1; matrix[6] = 0; matrix[7] = 0;
  matrix[8] = 0; matrix[9] = 0; matrix[10] = 1; matrix[11] = 0;
  matrix[12] = x; matrix[13] = y; matrix[14] = z; matrix[15] = 1;
  return matrix;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const ROOT_TWO_OVER_TWO = Math.sqrt(2) / 2;
const TWOPI = Math.PI * 2;

return {
  "ExponentialAverage": ExponentialAverage,
  "getShader": getShader,
  "getRandomInt": getRandomInt,
  "random": random,
  "mapValue": mapValue,
  "createCircleVertices": createCircleVertices,
  "isArrayLike": isArrayLike,
  "modelViewMatrix": modelViewMatrix,
  "matrixMultiplyPoint": matrixMultiplyPoint,
  "multiplyArrayOfMatrices": multiplyArrayOfMatrices,
  "multiplyMatrices": multiplyMatrices,
  "rotateXMatrix": rotateXMatrix,
  "rotateYMatrix": rotateYMatrix,
  "rotateZMatrix": rotateZMatrix,
  "scaleMatrix": scaleMatrix,
  "translateMatrix": translateMatrix,
  "DEG2RAD": DEG2RAD,
  "RAD2DEG": RAD2DEG,
  "ROOT_TWO_OVER_TWO": ROOT_TWO_OVER_TWO,
  "TWOPI": TWOPI,
  "identityMatrix": identityMatrix
};

})(window);
