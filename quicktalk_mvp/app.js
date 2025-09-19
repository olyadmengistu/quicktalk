// QuickTalk MVP — client-side logic using Firebase compat SDKs.
// Features: Auth (anonymous fallback), record 10s audio/video, upload to Storage, create Firestore post, show recent 24h feed, reply by recording.

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const timerEl = document.getElementById('timer');
const postsEl = document.getElementById('posts');
const preview = document.getElementById('preview');

let mediaRecorder, recordedChunks = [], stream;
let recordStartTime = null;
const MAX_SECONDS = 10;
const FEED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Auth handlers
signInBtn.onclick = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (e) {
    console.error(e);
    // fallback to anonymous
    await auth.signInAnonymously();
  }
};
signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
  } else {
    signInBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
  }
});

// Recording setup
startBtn.onclick = async () => {
  recordedChunks = [];
  // request both audio and video; user can deny video
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    preview.srcObject = stream;
    preview.style.display = 'block';
  } catch(e) {
    // fallback to audio only
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = handleStop;
  mediaRecorder.start();

  recordStartTime = Date.now();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  updateTimer();
  // auto-stop after MAX_SECONDS
  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  }, (MAX_SECONDS + 0.2) * 1000);
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
};

function updateTimer(){
  if (!recordStartTime) { timerEl.textContent = '00:00'; return; }
  const diff = Math.floor((Date.now() - recordStartTime)/1000);
  const s = String(Math.min(diff, MAX_SECONDS)).padStart(2,'0');
  timerEl.textContent = `00:${s}`;
  if (mediaRecorder && mediaRecorder.state === 'recording' && diff < MAX_SECONDS) {
    requestAnimationFrame(updateTimer);
  }
}

// handle upload and post creation
async function handleStop(){
  startBtn.disabled = false;
  stopBtn.disabled = true;
  preview.style.display = 'none';
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  recordStartTime = null;
  timerEl.textContent = '00:00';

  const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'audio/webm' });
  const user = auth.currentUser;
  if (!user) {
    // sign in anonymously
    await auth.signInAnonymously();
  }

  const id = db.collection('posts').doc().id;
  const filename = `clips/${id}`;
  const ref = storage.ref().child(filename);
  const uploadTask = ref.put(blob);

  uploadTask.on('state_changed',
    null,
    err => console.error('Upload error', err),
    async () => {
      const url = await ref.getDownloadURL();
      const post = {
        owner: auth.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        mediaUrl: url,
        contentType: blob.type,
        replyTo: null
      };
      await db.collection('posts').doc(id).set(post);
    }
  );
}

// render feed
async function loadFeed(){
  postsEl.innerHTML = '<em>Loading...</em>';
  const cutoff = new Date(Date.now() - FEED_WINDOW_MS);
  const snapshot = await db.collection('posts')
    .where('createdAt', '>', cutoff)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  postsEl.innerHTML = '';
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement('div');
    div.className = 'post';
    const t = document.createElement('time');
    const ts = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date();
    t.textContent = ts.toLocaleString();
    div.appendChild(t);

    if (data.contentType && data.contentType.startsWith('video')) {
      const v = document.createElement('video');
      v.src = data.mediaUrl;
      v.controls = true;
      v.width = 420;
      div.appendChild(v);
    } else {
      const a = document.createElement('audio');
      a.src = data.mediaUrl;
      a.controls = true;
      div.appendChild(a);
    }

    // reply button (client-side: records and posts with replyTo)
    const replyBtn = document.createElement('button');
    replyBtn.textContent = 'Reply (10s)';
    replyBtn.onclick = () => replyToPost(doc.id);
    div.appendChild(replyBtn);

    postsEl.appendChild(div);
  });
}

// minimal reply flow
async function replyToPost(postId){
  // record like before, but attach replyTo
  recordedChunks = [];
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch(e) {
    alert('Cannot access microphone.');
    return;
  }
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size>0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    if (stream) stream.getTracks().forEach(t=>t.stop());
    const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'audio/webm' });
    const id = db.collection('posts').doc().id;
    const filename = `clips/${id}`;
    const ref = storage.ref().child(filename);
    const uploadTask = ref.put(blob);
    uploadTask.on('state_changed', null, e=>console.error(e), async () => {
      const url = await ref.getDownloadURL();
      const post = {
        owner: auth.currentUser ? auth.currentUser.uid : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        mediaUrl: url,
        contentType: blob.type,
        replyTo: postId
      };
      await db.collection('posts').doc(id).set(post);
      loadFeed();
    });
  };
  mediaRecorder.start();
  setTimeout(()=> { if (mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop(); }, (MAX_SECONDS+0.2)*1000);
  alert('Recording reply: speak now for up to 10 seconds. It will auto-stop.');
}

// load feed on start and on changes
auth.onAuthStateChanged(() => {
  loadFeed();
});

// simple real-time listener to refresh feed
db.collection('posts').orderBy('createdAt','desc').limit(50).onSnapshot(() => {
  loadFeed();
});
