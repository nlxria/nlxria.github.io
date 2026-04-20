// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// ▼ 変更：ログイン処理に必要な関数（signOut, GoogleAuthProvider, signInWithPopup）を追加
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

// === 認証UI要素の取得とログイン・ログアウト処理 ===
const loggedOutUI = document.getElementById('logged-out-ui');
const loggedInUI = document.getElementById('logged-in-ui');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailDisplay = document.getElementById('user-email-display');
const provider = new GoogleAuthProvider();

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
    alert("ログアウトしました。");
});


// === マップの初期化 ===
const map = L.map('map').setView([35.681236, 139.767125], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ▼ 追加：現在マップに表示されているピンを記憶する配列（重複防止用）
let currentMarkers = [];


// === キャラクターデータの取得（キャッシュ付き） ===
async function fetchMapCharacters(uid) {
    const CACHE_KEY = 'map_public_chars_cache';
    const CACHE_TIME = 5 * 60 * 1000;

    let publicChars = [];
    let myChars = [];

    const cachedData = sessionStorage.getItem(CACHE_KEY);
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < CACHE_TIME) {
            publicChars = parsed.data;
        }
    }

    if (publicChars.length === 0) {
        const q = query(collection(db, "characters"), where("data.privacy", "==", 0));
        const snap = await getDocs(q);
        snap.forEach(doc => publicChars.push({ id: doc.id, data: doc.data().data }));
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: publicChars }));
    }

    if (uid) {
        const q2 = query(collection(db, "characters"), where("data.owner", "==", uid));
        const snap2 = await getDocs(q2);
        snap2.forEach(doc => myChars.push({ id: doc.id, data: doc.data().data }));
    }

    const charaMap = new Map();
    publicChars.forEach(c => charaMap.set(c.id, c));
    myChars.forEach(c => charaMap.set(c.id, c));

    return Array.from(charaMap.values());
}


// === マップにピン（アイコン）を立てる ===
async function renderMarkers(uid) {
    // ▼ 追加：新しいピンを立てる前に、古いピンをすべてマップから消去する
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    const characters = await fetchMapCharacters(uid);

    characters.forEach(chara => {
        const data = chara.data;
        const lat = parseFloat(data.y) || 0;
        const lng = parseFloat(data.x) || 0;
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

        // ▼ 追加：立てたピンを配列に記憶しておく
        currentMarkers.push(marker);
    });
}


// === 認証状態が確定したらUI切り替え＆描画スタート ===
onAuthStateChanged(auth, (user) => {
    // ▼ 追加：ログイン・ログアウトのUI表示切り替え
    if (user) {
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'flex';
        userEmailDisplay.textContent = user.email;
    } else {
        loggedOutUI.style.display = 'flex';
        loggedInUI.style.display = 'none';
    }

    // マップの描画を実行
    renderMarkers(user ? user.uid : null);
});