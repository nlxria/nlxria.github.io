// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    } else if (titleEl && currentMode === 'human') {
        titleEl.textContent = '人間関係';
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', attribution: '&copy; CARTO' }).addTo(map);

    map.on('zoomend', () => {
        const zoom = map.getZoom();
        const size = Math.max(20, Math.min(120, zoom * 8));
        currentMarkers.forEach(item => {
            item.marker.setIcon(L.divIcon({
                className: 'custom-chara-icon',
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

    renderNetwork(auth.currentUser ? auth.currentUser.uid : null);

} else {
    // 【ホーム画面】
    mapContainer.style.display = 'none';
    if (networkContainer) networkContainer.style.display = 'none';
    if (homeMenu) homeMenu.style.display = 'block';
}

// === キャラクターデータの取得（超軽量化版） ===
async function fetchMapCharacters(uid) {
    let publicChars = [];
    let myChars = [];

    // ▼ 変更：公開キャラは「集約された1つのファイル」を1回読むだけで全員分取得する
    if (memoryCachePublic !== null) {
        publicChars = memoryCachePublic;
    } else {
        try {
            const metaDoc = await getDoc(doc(db, "map_meta", "public_pins"));
            if (metaDoc.exists() && metaDoc.data().pins) {
                publicChars = metaDoc.data().pins;
            } else {
                console.warn("マップ用インデックスがないため、直接取得します");
                const q = query(collection(db, "characters"), where("data.privacy", "==", 0));
                const snap = await getDocs(q);
                snap.forEach(docSnap => publicChars.push({ id: docSnap.id, data: docSnap.data().data }));
            }
            memoryCachePublic = publicChars;
        } catch (e) {
            console.error("集約データの取得エラー:", e);
        }
    }

    // mymap.js 内 fetchMapCharacters の抜粋
    if (uid) {
        if (memoryCacheMine !== null) {
            myChars = memoryCacheMine;
        } else {
            try {
                const myIndexDoc = await getDoc(doc(db, `users/${uid}/meta/index`));
                if (myIndexDoc.exists()) {
                    myChars = myIndexDoc.data().index || [];
                } else {
                    // フォールバック
                    const q2 = query(collection(db, "characters"), where("data.owner", "==", uid));
                    const snap2 = await getDocs(q2);
                    snap2.forEach(docSnap => myChars.push({ id: docSnap.id, data: docSnap.data().data }));
                }
                memoryCacheMine = myChars;
            } catch (e) { console.error(e); }
        }
    }

    // マージして重複排除
    const charaMap = new Map();
    publicChars.forEach(c => charaMap.set(c.id, c));
    myChars.forEach(c => charaMap.set(c.id, c));

    return Array.from(charaMap.values());
}

// === 世界地図の描画処理 ===
async function renderMarkers(uid) {
    if (currentMode !== 'earth' || !map) return;

    currentMarkers.forEach(item => map.removeLayer(item.marker));
    currentMarkers = [];

    const characters = await fetchMapCharacters(uid);
    const zoom = map.getZoom();
    const size = Math.max(20, Math.min(120, zoom * 8));

    characters.forEach(chara => {
        const data = chara.data;

        const earthData = data.mymaps?.earth || [0, 0];
        const x = parseFloat(earthData[0]) || 0;
        const y = parseFloat(earthData[1]) || 0;

        if (x === 0 && y === 0) return;

        const lat = y;
        const lng = x;
        const iconUrl = data.iconUrl || '/assets/image/chara-image.png';

        const customIcon = L.divIcon({
            className: 'custom-chara-icon',
            // ▼ 変更： onerror で無限ループ防止の null 処理を追加
            html: `<img src="${iconUrl}" onerror="this.src='/assets/image/chara-image.png'; this.onerror=null;">`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        marker.on('click', () => {
            window.open(`/chara?id=${chara.id}`, '_blank');
        });

        currentMarkers.push({ marker: marker, iconUrl: iconUrl });
    });
}

// === 人間関係の描画処理 ===
async function renderNetwork(uid) {
    if (!networkContainer) return;
    networkContainer.innerHTML = '<p style="color:white; text-align:center; padding-top:20vh; font-size:1.5em;">人間関係を生成中...</p>';

    const characters = await fetchMapCharacters(uid);
    let nodes = [];
    let edges = [];

    characters.forEach(chara => {
        const data = chara.data;

        // ノードの作成
        nodes.push({
            id: chara.id,
            label: data.name || '名無し',
            shape: 'circularImage',
            image: data.iconUrl || '/assets/image/chara-image.png',
            brokenImage: '/assets/image/chara-image.png', // ★追加：画像読み込みエラー時はこれを表示し、処理を止めない
            size: 50,
            borderWidth: 5,
            color: {
                border: '#44AEF3',
                background: '#050949'
            },
            font: { color: '#FFF', strokeWidth: 5, strokeColor: '#050949', size: 25 }
        });

        // エッジ（関係性）の作成
        const relations = data.mymaps?.human || {};

        Object.entries(relations).forEach(([targetId, relationText]) => {
            if (!targetId) return;

            const targetExists = characters.find(c => c.id === targetId);
            if (targetExists) {
                // ▼ 追加：矢印ごとにランダムな明るいネオンカラー（HSL）を生成する
                const hue = Math.floor(Math.random() * 360); // 0〜360のランダムな色相
                const randomColor = `hsl(${hue}, 100%, 65%)`; // 鮮やかさ100%、明るさ65%で固定

                // scripts/mymap.js の renderNetwork 関数内

                edges.push({
                    from: chara.id,
                    to: targetId,
                    label: relationText || '',
                    arrows: { to: { enabled: true, scaleFactor: 0.7 } },
                    width: 5,
                    color: { color: randomColor, highlight: '#FFF' },
                    font: {
                        align: 'horizontal',
                        color: randomColor,
                        strokeWidth: 5,
                        strokeColor: '#050949',
                        size: 20,
                        face: 'ShinMaruGo' // ★ここを追加
                    }
                });
            }
        });
    });

    networkContainer.innerHTML = '';

    const graphData = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
        physics: {
            solver: 'repulsion',
            repulsion: {
                nodeDistance: 250,
                springLength: 200
            },
            stabilization: {
                enabled: true,
                iterations: 200
            }
        },
        interaction: {
            hover: true,
            dragNodes: true,
            zoomView: true,
            dragView: true
        },
        edges: {
            smooth: { type: 'dynamic' }
        }
    };

    const network = new vis.Network(networkContainer, graphData, options);

    network.on("doubleClick", function (params) {
        if (params.nodes.length > 0) {
            window.open(`/chara?id=${params.nodes[0]}`, '_blank');
        }
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

    // 現在のモードに応じて描画
    if (currentMode === 'earth') {
        renderMarkers(user ? user.uid : null);
    } else if (currentMode === 'human') {
        renderNetwork(user ? user.uid : null);
    }
});