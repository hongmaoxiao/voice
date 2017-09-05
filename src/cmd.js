const worker = new Worker('/static/dealer/js/cmdworker.js');
worker.onmessage = (e) => {
  if (!e.data.data) {
    if (window.$) {
      $(worker).trigger('response', [e.data.res]);
    }
  }
};
window.worker = worker;

function handleStart() {
  const param = {
    sampleRate: 8000,
    tracks: 1,
    user: false,
    cmd: 'login',
    uid: window.uid || '0',
    utype: 'sale',
    roomid: window.roomid || '0',
    factory_id: window.factory_id || '0',
    dealer_id: window.dealer_id || '0',
  };
  worker.postMessage({ cmd: 'start', param });
}

function startTelephone() {
  handleStart();
}

window.startTelephone = startTelephone;
