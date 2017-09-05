function geturl() {
  let host = location.hostname;
  if (location.port.length) {
    host = `${host}:${location.port}`;
  }
  const prot = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${prot}//${host}/api/console`;
}

function int16ToFloat32(i) {
  return (i < 0) ? i / 0x8000 : i / 0x7FFF;
}

function float32ToInt16(_i) {
  const i = Math.max(-1, Math.min(1, _i));
  return i * (i < 0 ? 0x8000 : 0x7FFF);
}

function startWebsocket(endpoint, messagecb, opencb, closecb) {
  const ws = new WebSocket(endpoint);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    opencb(ws);
  };

  ws.onclose = () => {
    if (closecb()) {
      setTimeout(() => {
        startWebsocket(endpoint, messagecb, opencb, closecb);
      }, 1000);
    }
  };
  ws.onmessage = messagecb;
}

let audioParam = {};
let pageend = false;

const onopen = (ws) => {
  self.ws = ws;
  console.log('ws open');
  audioParam.start = true;
  ws.send(JSON.stringify(audioParam));
};

const onclose = () => {
  self.ws = undefined;
  return !pageend;
};

const onwsmessage = (evt) => {
  if (evt.data[0] === '{') {
    self.postMessage({ res: JSON.parse(evt.data) });
    return;
  }
  const buffer = new Int16Array(evt.data.byteLength / 2);
  buffer.set(new Int16Array(evt.data), 0);
  const buf32 = new Float32Array(buffer.length);
  for (let i = buffer.length - 1; i > -1; i -= 1) {
    buf32[i] = int16ToFloat32(buffer[i]);
  }
  self.postMessage({ data: buf32 });
};

function start(param) {
  audioParam = param;
  const url = geturl();
  startWebsocket(url, onwsmessage, onopen, onclose);
}

function exit() {
  pageend = true;
  if (self.ws) {
    self.ws.close();
    self.ws = undefined;
  }
}

self.onmessage = (e) => {
  if (!e.data.data) {
    switch (e.data.cmd) {
      case 'pageend':
        exit();
        break;
      case 'start':
        start(e.data.param);
        break;
      default:
        if (self.ws) {
          self.ws.send(JSON.stringify(e.data));
        }
        break;
    }
    return;
  }
  if (self.ws) {
    const buf32 = e.data.data;
    const buf = new Int16Array(buf32.length);
    for (let i = buf32.length - 1; i > -1; i -= 1) {
      buf[i] = float32ToInt16(buf32[i]);
    }
    self.ws.send(buf);
  }
};
