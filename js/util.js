var Utils = (function(glob) {//eslint-disable-line no-unused-vars

  var global = glob;

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
  var shaderScript = document.getElementById(id);
  if (!shaderScript) {
    return null;
  }

  var shaderSource = shaderScript.text;

  if (!type) {
    if (shaderScript.type === "x-shader/x-fragment") {
      type = gl.FRAGMENT_SHADER;
    } else if (shaderScript.type === "x-shader/x-vertex") {
      type = gl.VERTEX_SHADER;
    } else {
      return null;
    }
  }

  var shader = gl.createShader(type);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function mapValue(val, x1, y1, x2, y2) {
  return (val - x1) * (y2 - x2) / (y1 - x1) + x2;
}

function createCircleVertices(centerVertex, numPoints, radius) {
  radius = (typeof radius === "number") ? radius : 1;
  var vertices = [];
  var tex = [];
  var x0 = centerVertex.x;
  var y0 = centerVertex.y;
  var z0 = centerVertex.z;
  var pi = (360 / numPoints) * Utils.DEG2RAD;
  var x1 = x0 + 1;
  var y1 = y0;
  var xmax = x0 + radius;
  var xmin = x0 - radius;
  var ymax = y0 + radius;
  var ymin = y0 - radius;

  for (let k = 0; k <= numPoints; k += 1) {
    vertices.push(x0);
    vertices.push(y0);
    vertices.push(z0);
    tex.push(Utils.mapValue(x0, xmin, xmax, 0, 1));
    tex.push(Utils.mapValue(y0, ymin, ymax, 0, 1));

    vertices.push(x1);
    vertices.push(y1);
    vertices.push(z0);
    tex.push(Utils.mapValue(x1, xmin, xmax, 0, 1));
    tex.push(Utils.mapValue(y1, ymin, ymax, 0, 1));

    x1 = x0 + Math.cos(k * pi) * radius;
    y1 = y0 + Math.sin(k * pi) * radius;
    vertices.push(x1);
    vertices.push(y1);
    vertices.push(z0);
    tex.push(Utils.mapValue(x1, xmin, xmax, 0, 1));
    tex.push(Utils.mapValue(y1, ymin, ymax, 0, 1));
  }

  return {
    "vertices": new Float32Array(vertices),
    "tex": new Float32Array(tex)
  };
}

function fetchURL(opts) {
  opts = opts || {};
  var method = opts.method || "GET";
  var url = opts.url || opts.uri || "";
  var callback = opts.callback || opts.cb || null;
  var msg = opts.message || opts.msg || opts.payload || null;

  var xhr = new global.XMLHttpRequest();
  xhr.open(method, url);
  xhr.responseType = opts.responseType || "";
  if (opts.headers && typeof opts.headers === "object") {
    let headers = opts.headers;
    for (let prop in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, prop)) {
        xhr.setRequestHeader(prop, headers[prop]);
      }
    }
  }
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      callback(xhr); //eslint-disable-line callback-return
    }
  };
  if (opts.preSend && typeof opts.preSend === "function") {
    opts.preSend(xhr);
  }
  xhr.send(msg);
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
  var cos = Math.cos;
  var sin = Math.sin;
  var x = trans.x;
  var y = trans.y;
  var z = trans.z;
  var alpha = rotate.x;
  var beta = rotate.y;
  var gamma = rotate.z;
  var w = scale.x;
  var h = scale.y;
  var d = scale.z;

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
}

var DEG2RAD = Math.PI / 180;
var RAD2DEG = 180 / Math.PI;
var ROOT_TWO_OVER_TWO = Math.sqrt(2) / 2;

return {
  "ExponentialAverage": ExponentialAverage,
  "getShader": getShader,
  "mapValue": mapValue,
  "createCircleVertices": createCircleVertices,
  "fetchURL": fetchURL,
  "isArrayLike": isArrayLike,
  "modelViewMatrix": modelViewMatrix,
  "DEG2RAD": DEG2RAD,
  "RAD2DEG": RAD2DEG,
  "ROOT_TWO_OVER_TWO": ROOT_TWO_OVER_TWO
};

})(window);
