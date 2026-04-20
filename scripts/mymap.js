// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBP17_hAR-NO_OT0MWDvtISiM20fjg1eO4",
    authDomain: "nlxria-fb.firebaseapp.com",
    projectId: "nlxria-fb",
    storageBucket: "nlxria-fb.firebasestorage.app",
    messagingSenderId: "1047829048643",
    appId: "1:1047829048643:web:4023756046497350e793f6",
    measurementId: "G-NXQ6Y4YTXH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === URLパラメータとモードの取得 ===
const urlParams = new URLSearchParams(window.location.search);
const currentMode = urlParams.get('md');

// === 認証UI要素の取得と処理 ===
const loggedOutUI = document.getElementById('logged-out-ui');
const loggedInUI = document.getElementById('logged-in-ui');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailDisplay = document.getElementById('user-email-display');
const provider = new GoogleAuthProvider();

let memoryCachePublic = null;
let memoryCacheMine = null;

function updateHeaderTitle() {
    const titleEl = document.querySelector('header .title');
    if (titleEl && currentMode === 'earth') {
        titleEl.textContent = '世界地図';
    }
}

googleLoginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
        alert("ログインしました！");
    } catch (error) {
        console.error("ログインエラー:", error);
        if (error.code !== 'auth/popup-closed-by-user') alert("ログインに失敗しました。");
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    memoryCacheMine = null;
    alert("ログアウトしました。");
});

// === マップの初期化 ===
const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([35.6895, 139.6917], 5);

// ▼ 文字なし（lyrs=r）のタイルを使用
L.tileLayer('https://{s}.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google'
}).addTo(map);

let currentMarkers = [];

// === キャラクターデータの取得 ===
async function fetchMapCharacters(uid) {
    let publicChars = [];
    let myChars = [];

    if (memoryCachePublic !== null) {
        publicChars = memoryCachePublic;
    } else {
        const q = query(collection(db, "characters"), where("data.privacy", "==", 0));
        const snap = await getDocs(q);
        snap.forEach(doc => publicChars.push({ id: doc.id, data: doc.data().data }));
        memoryCachePublic = publicChars;
    }

    if (uid) {
        if (memoryCacheMine !== null) {
            myChars = memoryCacheMine;
        } else {
            const q2 = query(collection(db, "characters"), where("data.owner", "==", uid));
            const snap2 = await getDocs(q2);
            snap2.forEach(doc => myChars.push({ id: doc.id, data: doc.data().data }));
            memoryCacheMine = myChars;
        }
    }

    const charaMap = new Map();
    publicChars.forEach(c => charaMap.set(c.id, c));
    myChars.forEach(c => charaMap.set(c.id, c));

    return Array.from(charaMap.values());
}

// === マップにピンを立てる ===
async function renderMarkers(uid) {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    if (currentMode !== 'earth') return;

    const characters = await fetchMapCharacters(uid);

    characters.forEach(chara => {
        const data = chara.data;
        const x = parseFloat(data.x) || 0;
        const y = parseFloat(data.y) || 0;

        if (currentMode === 'earth' && x === 0 && y === 0) return;

        const lat = y;
        const lng = x;
        const iconUrl = data.iconUrl || '/assets/image/chara-image.png';

        const customIcon = L.divIcon({
            className: 'custom-chara-icon',
            html: `<img src="${iconUrl}" onerror="this.src='/assets/image/chara-image.png'">`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.bindTooltip(data.name || '名無し', { direction: 'top', offset: [0, -20] });
        marker.on('click', () => {
            window.location.href = `/chara?id=${chara.id}`;
        });

        currentMarkers.push(marker);
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'flex';
        userEmailDisplay.textContent = user.email;
    } else {
        loggedOutUI.style.display = 'flex';
        loggedInUI.style.display = 'none';
    }

    updateHeaderTitle();
    renderMarkers(user ? user.uid : null);
});