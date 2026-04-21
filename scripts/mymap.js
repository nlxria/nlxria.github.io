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

// === マップの初期化と表示切り替え ===
let map = null;
let currentMarkers = [];
const mapContainer = document.getElementById('map');
const networkContainer = document.getElementById('network-map');
const homeMenu = document.getElementById('home-menu');

if (currentMode === 'earth') {
    // 【世界地図モード】
    mapContainer.style.display = 'block';
    if (networkContainer) networkContainer.style.display = 'none';
    if (homeMenu) homeMenu.style.display = 'none';

    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([35.6895, 139.6917], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd' }).addTo(map);

    map.on('zoomend', () => {
        const zoom = map.getZoom();
        const size = Math.max(20, Math.min(120, zoom * 8));
        currentMarkers.forEach(item => {
            const isPremium = localStorage.getItem('isPremium') === 'true';
            item.marker.setIcon(L.divIcon({
                className: isPremium ? 'custom-chara-icon premium-icon' : 'custom-chara-icon',
                html: `<img src="${item.iconUrl}" onerror="this.src='/assets/image/chara-image.png'">`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2]
            }));
        });
    });

} else if (currentMode === 'human') {
    // 【人間関係モード】
    mapContainer.style.display = 'none';
    if (networkContainer) networkContainer.style.display = 'block';
    if (homeMenu) homeMenu.style.display = 'none';

    // 人間関係を描画する関数を呼び出し
    renderNetwork(auth.currentUser ? auth.currentUser.uid : null);

} else {
    // 【ホーム画面】
    mapContainer.style.display = 'none';
    if (networkContainer) networkContainer.style.display = 'none';
    if (homeMenu) homeMenu.style.display = 'block';
}

// === 人間関係の描画処理 ===
async function renderNetwork(uid) {
    if (!networkContainer) return;
    networkContainer.innerHTML = '<p style="color:white; text-align:center; padding-top:20vh; font-size:1.5em;">人間関係を生成中...</p>';

    const characters = await fetchMapCharacters(uid); // 地図と同じ取得ロジックを流用（公開設定のキャラ）
    let nodes = [];
    let edges = [];

    const isPremium = localStorage.getItem('isPremium') === 'true';

    characters.forEach(chara => {
        const data = chara.data;
        // ノード（キャラアイコン）の作成
        nodes.push({
            id: chara.id,
            label: data.name || '名無し',
            shape: 'circularImage',
            image: data.iconUrl || '/assets/image/chara-image.png',
            size: 35,
            borderWidth: 2,
            color: {
                border: isPremium ? '#FFD700' : '#47B8FF',
                background: '#050949'
            },
            font: { color: '#FFF', strokeWidth: 3, strokeColor: '#050949', size: 16 }
        });

        // ▼ 変更：新しい mymaps.human オブジェクトから関係性を取得してループ
        const relations = data.mymaps?.human || {};

        Object.entries(relations).forEach(([targetId, relationText]) => {
            if (!targetId) return;

            // 対象のキャラがマップ上に存在する場合のみ線を繋ぐ
            const targetExists = characters.find(c => c.id === targetId);
            if (targetExists) {
                edges.push({
                    from: chara.id,
                    to: targetId,
                    label: relationText || '',
                    arrows: { to: { enabled: true, scaleFactor: 0.7 } },
                    color: { color: '#FF47B8', highlight: '#FFD700' },
                    font: { align: 'horizontal', color: '#FF47B8', strokeWidth: 3, strokeColor: '#050949', size: 14 }
                });
            }
        });
    });

    networkContainer.innerHTML = ''; // ロード文字を消去

    const graphData = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
        physics: {
            solver: 'repulsion', // 反発力モデル（点同士が重ならない）
            repulsion: {
                nodeDistance: 250, // 距離を保つことで文字を読みやすくする
                springLength: 200
            },
            stabilization: {
                enabled: true,
                iterations: 200 // ★重要：画面に表示する前に計算を終わらせて、ピタッと止まった状態で表示させる
            }
        },
        interaction: {
            hover: true,
            dragNodes: true, // 手動での微調整は許可
            zoomView: true,
            dragView: true
        },
        edges: {
            smooth: { type: 'dynamic' } // 相互関係(⇄)の時に自動で矢印を曲げて2本にする
        }
    };

    const network = new vis.Network(networkContainer, graphData, options);

    // ダブルクリックで対象のキャラシを開く機能
    network.on("doubleClick", function (params) {
        if (params.nodes.length > 0) {
            window.open(`/chara?id=${params.nodes[0]}`, '_blank');
        }
    });
}

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
    if (currentMode !== 'earth' || !map) return; // ▼ ここを厳格に弾くように修正

    currentMarkers.forEach(item => map.removeLayer(item.marker));
    currentMarkers = [];

    if (currentMode !== 'earth') return;

    // (中略) ...
    const characters = await fetchMapCharacters(uid);
    const zoom = map.getZoom();
    const size = Math.max(20, Math.min(120, zoom * 8));

    characters.forEach(chara => {
        const data = chara.data;

        // ▼ 変更：新しい mymaps.earth から座標を取得
        const earthData = data.mymaps?.earth || [0, 0];
        const x = parseFloat(earthData[0]) || 0;
        const y = parseFloat(earthData[1]) || 0;

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