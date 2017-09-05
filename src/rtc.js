let ws = null;
let rId = 0;
let localStream;
let peerConn;
let peerStarted = false;
let mute = false;
let bye = false;

let queuedRemoteCandidates = [];
const sendQueue = [];

function noop() {}
function RTC() {}

function traceFunc(...args) {
  const now = (window.performance.now() / 1000).toFixed(3);
  console.log(now, ...args);
}

const trace = (typeof console === 'undefined') ? noop : traceFunc;

function send(msg) {
  if (ws) {
    ws.send(JSON.stringify(msg));
  } else {
    sendQueue.push(msg);
  }
}

function handleSendQueue() {
  while (sendQueue.length) {
    const msg = sendQueue.shift();
    if (msg) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function onIceCandidate(pc, evt) {
  if (evt.candidate) {
    send({
      type: 'candidate',
      sdpMLineIndex: evt.candidate.sdpMLineIndex,
      sdpMid: evt.candidate.sdpMid,
      candidate: evt.candidate.candidate,
    });
  }
}

function prepareNewConnection(label) {
  const conn = new RTCPeerConnection();
  trace('Created ', label);
  conn.onicecandidate = (e) => {
    onIceCandidate(conn, e);
  };

  function onRemoteStreamAdded(e) {
    trace('Added remote stream', e);
    const audio = document.querySelector('audio#rtc');
    if (audio) {
      audio.srcObject = e.stream;
    }
  }
  // when remote removes a stream, remove it from the local video element
  function onRemoteStreamRemoved() {
    trace('Remove remote stream');
  }

  trace('Adding Local Stream to peer connection');
  conn.addStream(localStream);

  conn.addEventListener('addstream', onRemoteStreamAdded, false);
  conn.addEventListener('removestream', onRemoteStreamRemoved, false);
  return conn;
}

function gotOfferDescription(desc) {
  trace('Offer from peerConn \n', desc.sdp);
  peerConn.setLocalDescription(desc);

  send(desc);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description:', error.toString());
}

function gotLocalStream() {
  peerConn = prepareNewConnection('offer');
  peerStarted = true;

  peerConn.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
    voiceActivityDetection: true,
  }).then(
    gotOfferDescription,
    onCreateSessionDescriptionError,
  );
}

function drainCandidates() {
  if (queuedRemoteCandidates && queuedRemoteCandidates.length) {
    queuedRemoteCandidates.forEach((c) => {
      peerConn.addIceCandidate(c);
    });
  }
  queuedRemoteCandidates = undefined;
}

function addIceCandidate(candidate) {
  if (typeof queuedRemoteCandidates === 'undefined') {
    peerConn.addIceCandidate(candidate);
    return;
  }
  queuedRemoteCandidates.push(candidate);
}

function hangup(byebye) {
  trace('Ending call');
  if (byebye) {
    send({ type: 'bye' });
    bye = true;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
    localStream = null;
  }

  if (peerConn) {
    peerConn.close();
    peerConn = null;
  }
  peerStarted = false;
}

function onChannelOpened(evt) {
  trace('onChannelOpened evt=', evt);
  send({
    type: 'ello',
    sdp: window.saler_name || 'saler_',
    isSaler: true,
    sdpMLineIndex: window.roomid || 0,
    saler_id: window.uid || 0,
    avatar: window.avatar || '',
  });
  handleSendQueue();
}

function Mute() {
  if (!localStream) {
    return;
  }
  mute = !mute;
  localStream.getTracks().forEach((_track) => {
    const track = _track;
    track.enabled = mute;
  });
}

function requestLocalStream(done, getFail, unsupportRTC) {
  trace('Requesting local stream');
  try {
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

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        trace('Received local stream');
        localStream = stream;
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          trace(`Using Audio device: ${audioTracks[0].label}`);
        }
        // eslint-disable-next-line no-param-reassign
        stream.oninactive = () => {
          trace('localStream inactive');
        };
        done(stream);
      })
      .catch(getFail);
  } catch (e) {
    unsupportRTC(e);
  }
}

function startTelephone() {
  if (!RTC.inited) {
    RTC.init();
  }
  trace('Starting call');
  const gotLocalStreamFail = (e) => {
    trace('getUserMedia error: ', e);
    $(RTC).trigger('localstreamerror', [e]);
  };
  const unsupportRTC = () => {
    $(RTC).trigger('unsupport');
  };
  requestLocalStream(gotLocalStream, gotLocalStreamFail, unsupportRTC);
}

function onMessage(_evt) {
  trace('onMessage evt=', _evt);
  const evt = JSON.parse(_evt.data);
  if (evt.type === 'answer' && peerStarted) {
    trace('Received answer...');
    trace('Setting remote session description...');
    peerConn.setRemoteDescription(new RTCSessionDescription(evt));
    drainCandidates();
  } else if (evt.type === 'candidate') {
    trace('Received ICE candidate...');
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: evt.sdpMLineIndex,
      sdpMid: evt.sdpMid,
      candidate: evt.candidate,
    });
    trace(evt);
    trace(candidate);
    addIceCandidate(candidate);
  } else if (evt.type === 'bye' && peerStarted) {
    bye = true;
    hangup();
    $(RTC).trigger('bye');
  } else if (evt.type === 'webrtcup') {
    $(RTC).trigger('VoiceReady');
  } else if (evt.type === 'hangup') {
    if (bye) {
      return;
    }
    hangup();
    $(RTC).trigger('hangup');
    startTelephone();
  } else if (window.$) {
    $(RTC).trigger('response', [evt]);
  }
}

function onError(evt) {
  trace('onError() evt=', evt);
}

function connectWs() {
  function onClose(evt) {
    trace('onClose() evt=', evt);
    ws = null;
    if (bye) {
      return;
    }
    setTimeout(connectWs, 10);
  }

  function geturl() {
    let host = location.hostname;
    if (location.port.length) {
      host = `${host}:${location.port}`;
    }
    const prot = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const qs = window.signaling_qs || '';
    return `${prot}//${host}/api/rtc?${qs}&r=${rId}`;
  }

  const w = new WebSocket(geturl());
  w.onopen = (e) => {
    ws = w;
    onChannelOpened(e);
  };
  w.onmessage = onMessage;
  w.onclose = onClose;
  w.onerror = onError;
  rId += 1;
}

RTC.postMessage = send;
RTC.Mute = Mute;
RTC.hangup = hangup;
RTC.init = () => {
  RTC.inited = true;
  connectWs();
};

window.worker = RTC;
window.startTelephone = startTelephone;
