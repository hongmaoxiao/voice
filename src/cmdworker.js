function geturl() {
  let host = location.hostname;
  if (location.port.length) {
    host = `${host}:${location.port}`;
  }
  const prot = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${prot}//${host}/api/console`;
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
  }
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
  }
};
