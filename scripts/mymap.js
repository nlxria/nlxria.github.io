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

const urlParams = new URLSearchParams(window.location.search);
const currentMode = urlParams.get('md');

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

// ライトテーマからダークテーマに変更
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    attribution: '&copy; CARTO'
}).addTo(map);

// 記憶用配列
let currentMarkers = [];

// ▼ ズーム完了時にすべてのピンのサイズを一斉に再計算する
map.on('zoomend', () => {
    const zoom = map.getZoom();
    const size = Math.max(20, Math.min(120, zoom * 8));

    currentMarkers.forEach(item => {
        const customIcon = L.divIcon({
            className: 'custom-chara-icon',
            html: `<img src="${item.iconUrl}" onerror="this.src='/assets/image/chara-image.png'">`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
        item.marker.setIcon(customIcon);
    });
});

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
    currentMarkers.forEach(item => map.removeLayer(item.marker));
    currentMarkers = [];

    if (currentMode !== 'earth') return;

    const characters = await fetchMapCharacters(uid);

    // 初回描画時のサイズ計算
    const zoom = map.getZoom();
    const size = Math.max(20, Math.min(120, zoom * 8));

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
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        // ▼ クリックで別タブ（新規タブ）で開く
        marker.on('click', () => {
            window.open(`/chara?id=${chara.id}`, '_blank');
        });

        currentMarkers.push({ marker: marker, iconUrl: iconUrl });
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