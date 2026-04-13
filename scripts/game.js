import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Firebase設定
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
const db = getFirestore(app);

// ユーザー設定処理
function autoStorage(value) { localStorage.setItem("local", JSON.stringify(value)); };
let local = JSON.parse(localStorage.getItem("local"));
if (!local.color) { local.color = "#FFFFFF"; }
autoStorage(local);

const colorInput = document.querySelector(".color-picker");
const contentInput = document.querySelector(".chat-input");
colorInput.value = local.color;

// 送信処理
contentInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const text = contentInput.value.trim();
        if (!text) return;
        local.color = colorInput.value;
        autoStorage(local);
        contentInput.value = "";
        
        try {
            await addDoc(collection(db, "messages"), {
                uuid: local.uuid,
                name: local.name,
                color: local.color,
                content: text,
                tag: "comment", // デフォルトで「comment」として送信
                createdAt: serverTimestamp()
            });
        } catch (error) { console.error("送信エラー:", error); }
    }
});

// 受信処理
const section = document.querySelector(".message-list");
section.setAttribute("data-current-filter", "main"); // 初期値の設定
const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));

onSnapshot(q, (snapshot) => {
    let messages = "";
    snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.createdAt ? data.createdAt.toDate() : new Date();
        const timeString = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const safeName = data.name.replaceAll("<","&lt;").replaceAll(">","&gt;");
        const safeContent = data.content.replaceAll("<","&lt;").replaceAll(">","&gt;");
        
        // 過去のログやタグなしデータは "comment" 扱いにする
        const tag = data.tag || "comment";

        // メッセージをラッパーで囲み、data-tag を付与する
        messages += `
        <div class="message-item" data-tag="${tag}">
            <div class="message-header"><b style="color:${data.color};">${safeName}</b><span>［${tag}］</span></div>
            <p>${safeContent}</p>
        </div>`;
    });

    if (section.innerHTML != messages) {
        section.innerHTML = messages;
        if (section.lastElementChild) { section.lastElementChild.scrollIntoView(); }
    }
});

// ドラッグ機能
const chatWindow = document.querySelector(".chat-window");
const chatHeader = document.querySelector(".chat-header");

let isDragging = false;
let offsetX, offsetY;

chatHeader.onmousedown = (e) => {
    isDragging = true;
    offsetX = e.clientX - chatWindow.offsetLeft;
    offsetY = e.clientY - chatWindow.offsetTop;
};

document.onmousemove = (e) => {
    if (!isDragging) return;
    chatWindow.style.left = (e.clientX - offsetX) + "px";
    chatWindow.style.top = (e.clientY - offsetY) + "px";
};

document.onmouseup = () => { isDragging = false; };

// タブ切り替え機能
const tabToggle = document.getElementById("tab-toggle");
const tabs = [
    { id: "main", label: "＃ メイン" },
    { id: "info", label: "＃ 情報" },
    { id: "chat", label: "＃ 雑談" }
];
let currentTab = 0;

// 「＃」をタップしたときに、ウィンドウのドラッグが始まらないようにする
tabToggle.onmousedown = (e) => { e.stopPropagation(); };

tabToggle.onclick = () => {
    // 次のタブへ順番に切り替える
    currentTab = (currentTab + 1) % tabs.length;
    
    // 表示テキストを更新
    tabToggle.textContent = tabs[currentTab].label;
    
    // CSSの表示/非表示を切り替える属性を更新
    section.setAttribute("data-current-filter", tabs[currentTab].id);
    
    // フィルターを切り替えたら一番下へスクロール
    if (section.lastElementChild) { section.lastElementChild.scrollIntoView(); }
};