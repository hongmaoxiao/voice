// import resampler from '../lib/resampler';

const constraints = {
  video: false,
  audio: {
    mandatory: {
      echoCancellation: true,
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googHighpassFilter: true,
      googTypingNoiseDetection: true,
    },
    optional: [{ echoCancellation: true }],
  },
};
const audioStack = [];

if ({}.hasOwnProperty.call(window, 'webkitAudioContext')) {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
}

function initBandpass(context) {
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1009.95;
  filter.Q.value = 0.32579;
  return filter;
}

const context = new AudioContext();
let when = 0;
const player = initBandpass(context);
const gainNode = context.createGain();
gainNode.gain.value = 0.7;
player.connect(gainNode);
gainNode.connect(context.destination);

function scheduleBuffers() {
  while (audioStack.length) {
    const source = context.createBufferSource();
    source.buffer = audioStack.shift();
    source.connect(player);
    if (when <= 0 || when < context.currentTime) {
      when = context.currentTime + 0.2;
    }
    source.start(when);
    source.stop(when + source.buffer.duration);
    when += source.buffer.duration;
  }
}

const worker = new Worker('/static/dealer/js/voiceworker.js?0306');
worker.onmessage = (e) => {
  if (!e.data.data) {
    if (window.$) {
      $(worker).trigger('response', [e.data.res]);
    }
    return;
  }
  const buffer = e.data.data;
  const inputBuffer = context.createBuffer(1, 160, 8000);
  inputBuffer.getChannelData(0).set(buffer);
  audioStack.push(inputBuffer);
  if (audioStack.length) {
    scheduleBuffers();
  }
};
window.worker = worker;

function handleSuccess(stream) {
  const mctx = new AudioContext();
  const audioTracks = stream.getAudioTracks();
  console.log('Using audio device: ', audioTracks[0].label);
  console.log('context.sampleRate: ', mctx.sampleRate);

  const param = {
    sampleRate: mctx.sampleRate,
    tracks: audioTracks.length,
    user: false,
    cmd: 'login',
    uid: window.uid || '0',
    utype: 'sale',
    roomid: window.roomid || '0',
    dealer_id: window.dealer_id || '0',
    factory_id: window.factory_id || '0',
  };
  worker.postMessage({ cmd: 'start', param });
  const mic = mctx.createMediaStreamSource(stream);
  const filter = initBandpass(mctx);
  const recorder = mctx.createScriptProcessor(1024, 1, 1);

  recorder.onaudioprocess = (e) => {
    if (window.pause_recording) {
      return;
    }
    try {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      output.fill(0.0);
      worker.postMessage({ data: input });
    } catch (err) {
      console.log('node.onaudioprocess', err.message);
    }
  };

  mic.connect(filter);
  filter.connect(recorder);
  recorder.connect(mctx.destination);
}

const MediaError = {
  DevicesNotFoundError: '您好像还没有插好麦克风, 请检查一下!',
  default: '您的麦克风好像没有插好, 请检查一下!',
};

function handleError(e) {
  console.log('getUserMedia error: ', e);
  // eslint-disable-next-line no-alert
  return window.confirm(MediaError[e.name] || MediaError.default);
}

function startTelephone() {
  try {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        handleSuccess(stream);
        // eslint-disable-next-line no-param-reassign
        stream.oninactive = () => {
          setTimeout(() => {
            startTelephone();
          }, 1000);
        };
      })
      .catch((e) => {
        if (handleError(e)) {
          startTelephone();
        }
      });
  } catch (e) {
    // eslint-disable-next-line no-alert
    alert('您的浏览器无法使用语音和控制功能，请先使用Chrome试试');
  }
}

window.startTelephone = startTelephone;
