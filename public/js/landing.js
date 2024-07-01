const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const codeCont = document.querySelector('#roomcode');
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');
const remoteVideo = document.querySelector('#remoteVideo');  // Remote video element

let micAllowed = 1;
let camAllowed = 1;

let mediaConstraints = { video: true, audio: true };

navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {
        videoCont.srcObject = localstream;
        localStream = localstream;
    });

function uuidv4() {
    return 'xxyxyxxyx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const createroomtext = 'Creating Room...';

createButton.addEventListener('click', (e) => {
    e.preventDefault();
    createButton.disabled = true;
    createButton.innerHTML = 'Creating Room';
    createButton.classList = 'createroom-clicked';

    setInterval(() => {
        if (createButton.innerHTML < createroomtext) {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length + 1);
        } else {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length - 3);
        }
    }, 500);

    location.href = `/room.html?room=${uuidv4()}`;
});

joinBut.addEventListener('click', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() === "") {
        codeCont.classList.add('roomcode-error');
        return;
    }
    const code = codeCont.value;
    location.href = `/room.html?room=${code}`;
});

codeCont.addEventListener('change', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() !== "") {
        codeCont.classList.remove('roomcode-error');
        return;
    }
});

cam.addEventListener('click', () => {
    if (camAllowed) {
        mediaConstraints = { video: false, audio: micAllowed ? true : false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            });

        cam.classList = "nodevice";
        cam.innerHTML = `<i class="fas fa-video-slash"></i>`;
        camAllowed = 0;
    } else {
        mediaConstraints = { video: true, audio: micAllowed ? true : false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            });

        cam.classList = "device";
        cam.innerHTML = `<i class="fas fa-video"></i>`;
        camAllowed = 1;
    }
});

mic.addEventListener('click', () => {
    if (micAllowed) {
        mediaConstraints = { video: camAllowed ? true : false, audio: false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            });

        mic.classList = "nodevice";
        mic.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        micAllowed = 0;
    } else {
        mediaConstraints = { video: camAllowed ? true : false, audio: true };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            });

        mic.innerHTML = `<i class="fas fa-microphone"></i>`;
        mic.classList = "device";
        micAllowed = 1;
    }
});

const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' }, 
    {
        urls: 'turn:13.246.44.15:3478',
        username: 'emmanuel_xolani_aws',
        credential: '=hB9|Dh#123'
    }
];

const config = { iceServers: iceServers };

let localStream;
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

// Signaling and peer connection management
const socket = io();

let peerConnections = {};

socket.on('connect', () => {
    const room = new URLSearchParams(window.location.search).get('room');
    const username = prompt('Enter your name:');
    socket.emit('join room', room, username);
});

socket.on('join room', (peerIds, socketname, micSocket, videoSocket) => {
    if (peerIds) {
        peerIds.forEach(peerId => {
            const peerConnection = new RTCPeerConnection(config);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('new icecandidate', event.candidate, peerId);
                }
            };

            peerConnection.ontrack = event => {
                // Handle remote stream
                if (event.streams && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                }
            };

            peerConnection.onconnectionstatechange = () => {
                if (peerConnection.connectionState === 'connected') {
                    console.log('Peers connected');
                }
            };

            peerConnections[peerId] = peerConnection;

            peerConnection.createOffer()
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {
                    socket.emit('video-offer', peerConnection.localDescription, peerId);
                });
        });
    }
});

socket.on('video-offer', (offer, peerId, name, micState, videoState) => {
    const peerConnection = new RTCPeerConnection(config);
    peerConnections[peerId] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('video-answer', peerConnection.localDescription, peerId);
        });

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('new icecandidate', event.candidate, peerId);
        }
    };

    peerConnection.ontrack = event => {
        // Handle remote stream
        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };
});

socket.on('video-answer', (answer, peerId) => {
    const peerConnection = peerConnections[peerId];
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('new icecandidate', (candidate, peerId) => {
    const peerConnection = peerConnections[peerId];
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('remove peer', (peerId) => {
    const peerConnection = peerConnections[peerId];
    if (peerConnection) {
        peerConnection.close();
        delete peerConnections[peerId];
    }
});
