export function loadImage(imageSrc) {
  return new Promise(resolve => {
    var image = new Image();
    image.src = imageSrc;

    image.addEventListener('load', () => {
      resolve(image);
    });
  });
}

export
function rgbpalette(x) {
  return Array.from(
    { length: 3 },
    (_, i) => Math.floor((Math.sin((x + i / 3.0) * Math.PI) ** 2) * 256)
  );
}

export
function generateNoise(size) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = Array.from({ length: 3 }, () =>
        Math.floor(Math.random() * 255)
      );

      ctx.fillStyle = `rgba(${r},${g},${b},1.0)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return canvas;
}

export
function download(path, onProgress = null) {
  return new Promise((resolve) => {
    const req = new XMLHttpRequest();

    req.open('GET', path, true);
    req.withCredentials = false;
    req.responseType = 'arraybuffer';

    if (onProgress) {
      req.onprogress = onProgress;
    }

    req.onload = () => {
      var arrayBuffer = req.response;

      if (arrayBuffer) {
        resolve(new Uint8Array(arrayBuffer))
      } else {
        reject('Failed');
      }
    };

    req.send(null);
  });
}

export
function promiseSerial(args, callback) {
  return args.reduce((promise, arg) => {
    return promise.then((result) => {
      return callback(arg).then(Array.prototype.concat.bind(result));
    });
  }, Promise.resolve([]));
}

export
function promiseSerialIter(iter) {
  const results = [];
  let i = 0;

  function getNext() {
    i++;

    return new Promise((resolve) => {
      const next = iter.next();

      if (next.done) {
        // console.error('Resolving', results.length);
        return resolve(results);
      };

      next.value.then((value) => {
        if (value) {
          results.push(value);
        }
        resolve(getNext());
      }).catch((e) => {
        console.error(e);
        resolve(getNext());
      })
    });
  }

  return getNext();
}

export
function* downloadAsset(url) {
  let data = null;
  let progress = 0;
  let max = 0;

  yield { progress, max };

  function onProgress(e) {
    progress = e.loaded;
    max = e.total;
  }

  download(url, onProgress).then(file => data = file);

  while (data === null) {
    yield { progress, max };
  }

  yield { data };
}
