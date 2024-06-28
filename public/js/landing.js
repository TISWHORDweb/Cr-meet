const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const codeCont = document.querySelector('#roomcode');
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');

let micAllowed = 1;
let camAllowed = 1;

let mediaConstraints = { video: true, audio: true };

navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {
        videoCont.srcObject = localstream;
    })

function uuidv4() {
    return 'xxyxyxxyx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
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
        }
        else {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length - 3);
        }
    }, 500);

    //const name = nameField.value;
    location.href = `/room.html?room=${uuidv4()}`;
});

joinBut.addEventListener('click', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() == "") {
        codeCont.classList.add('roomcode-error');
        return;
    }
    const code = codeCont.value;
    location.href = `/room.html?room=${code}`;
})

codeCont.addEventListener('change', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() !== "") {
        codeCont.classList.remove('roomcode-error');
        return;
    }
})

cam.addEventListener('click', () => {
    if (camAllowed) {
        mediaConstraints = { video: false, audio: micAllowed ? true : false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        cam.classList = "nodevice";
        cam.innerHTML = `<i class="fas fa-video-slash"></i>`;
        camAllowed = 0;
    }
    else {
        mediaConstraints = { video: true, audio: micAllowed ? true : false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        cam.classList = "device";
        cam.innerHTML = `<i class="fas fa-video"></i>`;
        camAllowed = 1;
    }
})

mic.addEventListener('click', () => {
    if (micAllowed) {
        mediaConstraints = { video: camAllowed ? true : false, audio: false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        mic.classList = "nodevice";
        mic.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        micAllowed = 0;
    }
    else {
        mediaConstraints = { video: camAllowed ? true : false, audio: true };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        mic.innerHTML = `<i class="fas fa-microphone"></i>`;
        mic.classList = "device";
        micAllowed = 1;
    }
})
//

const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' }, 
    {
        urls: 'turn:13.246.44.15:3478',
        username: 'emmanuel_xolani_aws',
        credential: '=hB9|Dh#123,'
    },
    {
        urls: 'turn:13.246.44.15:3478?transport=tcp',
        username: 'emmanuel_xolani_aws',
        credential: '=hB9|Dh#123,'
    }
];

const config = { iceServers: iceServers };

let localStream;
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        document.querySelector('.video-self').srcObject = localStream;
    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

const peerConnection = new RTCPeerConnection(config);
peerConnection.addStream(localStream);

// Add event listeners for ICE candidates and negotiation
peerConnection.onicecandidate = event => {
    if (event.candidate) {
        socket.emit('new icecandidate', event.candidate, targetSocketId);
    }
};

peerConnection.onaddstream = event => {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.stream;
    document.body.appendChild(remoteVideo);
};

// Handling incoming ICE candidates
socket.on('new icecandidate', (candidate, fromSocketId) => {
    const iceCandidate = new RTCIceCandidate(candidate);
    peerConnection.addIceCandidate(iceCandidate).catch(error => {
        console.error('Error adding received ice candidate', error);
    });
});

// Create offer
peerConnection.createOffer()
    .then(offer => {
        return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
        socket.emit('video-offer', peerConnection.localDescription, targetSocketId);
    })
    .catch(error => {
        console.error('Error creating offer: ', error);
    });

// Handling video offers and answers
socket.on('video-offer', (offer, fromSocketId, username, micStatus, videoStatus) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            return navigator.mediaDevices.getUserMedia(mediaConstraints);
        })
        .then(stream => {
            localStream = stream;
            document.querySelector('.video-self').srcObject = localStream;
            peerConnection.addStream(localStream);
        })
        .then(() => {
            return peerConnection.createAnswer();
        })
        .then(answer => {
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            socket.emit('video-answer', peerConnection.localDescription, fromSocketId);
        })
        .catch(error => {
            console.error('Error handling offer: ', error);
        });
});

socket.on('video-answer', (answer, fromSocketId) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(error => {
            console.error('Error setting remote description: ', error);
        });
});