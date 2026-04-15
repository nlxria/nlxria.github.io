// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// グローバル変数としてキャラクターデータを保持
let characterData = null;
let characterId = new URLSearchParams(window.location.search).get('id');

const mainElement = document.getElementById('app-main');
const editBtn = document.getElementById('edit-mode-btn');
const container = document.getElementById('sheets-container');

// 初期化処理
async function init() {
    if (!characterId) {
        alert("キャラクターIDが指定されていません");
        return;
    }

    // 1. データの取得
    const docRef = doc(db, "characters", characterId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        characterData = docSnap.data();
        renderSheets(characterData.data.sheets, container);
    } else {
        alert("キャラクターが見つかりません");
    }

    // 2. 権限チェック (ログイン状態の監視)
    onAuthStateChanged(auth, (user) => {
        if (user && characterData && characterData.data.owner === user.uid) {
            editBtn.style.display = 'block'; // 本人なら編集ボタンを表示
        } else {
            editBtn.style.display = 'none';
        }
    });
}

// アコーディオンの再帰的描画関数
function renderSheets(sheetsArray, parentElement) {
    parentElement.innerHTML = ''; // 再描画用にリセット

    sheetsArray.forEach(sheet => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.innerHTML = `<div>▼</div><div>▲</div> <span>${sheet.name}</span>`;
        if (sheet.pass) summary.innerHTML += ` 🔒`;
        details.appendChild(summary);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'sheet-content-container';

        // テキスト領域の生成
        if (sheet.value !== undefined) {
            const textDiv = document.createElement('div');
            textDiv.className = 'sheet-text editable-area';
            textDiv.textContent = sheet.value;

            // 編集時のデータ連動
            textDiv.addEventListener('input', (e) => {
                sheet.value = e.target.innerText;
            });
            contentContainer.appendChild(textDiv);
        }

        // 子要素の再帰処理
        if (sheet.field && sheet.field.length > 0) {
            const nestedContainer = document.createElement('div');
            nestedContainer.className = 'nested-field';
            renderSheets(sheet.field, nestedContainer);
            contentContainer.appendChild(nestedContainer);
        }

        // パスワード処理
        if (sheet.pass) {
            const passContainer = document.createElement('div');
            passContainer.className = 'password-container';
            const passInput = document.createElement('input');
            passInput.type = 'text';
            passInput.placeholder = 'パスワードを入力';
            passInput.className = 'pass-input';

            passContainer.appendChild(passInput);
            details.appendChild(passContainer);

            contentContainer.style.display = 'none';
            details.appendChild(contentContainer);

            passInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (passInput.value === sheet.pass) {
                        passContainer.style.display = 'none';
                        contentContainer.style.display = 'block';
                    } else {
                        passInput.value = '';
                        passInput.placeholder = 'パスワードが違います';
                        passInput.style.backgroundColor = '#ffcccc';
                    }
                }
            });
        } else {
            details.appendChild(contentContainer);
        }

        parentElement.appendChild(details);
    });
}

// 編集モードの切り替えロジック
editBtn.addEventListener('click', async () => {
    const isEditing = mainElement.classList.toggle('edit-mode');
    const editableAreas = document.querySelectorAll('.editable-area');

    if (isEditing) {
        editBtn.textContent = "保存して閲覧モードに戻る";
        editableAreas.forEach(area => area.setAttribute('contenteditable', 'true'));
    } else {
        editBtn.textContent = "保存中...";
        editableAreas.forEach(area => area.setAttribute('contenteditable', 'false'));

        // Firestoreへ上書き保存
        try {
            await setDoc(doc(db, "characters", characterId), characterData);
            editBtn.textContent = "編集する";
            alert("保存しました！");
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("保存に失敗しました。");
            editBtn.textContent = "保存して閲覧モードに戻る";
            mainElement.classList.add('edit-mode'); // 失敗したら編集モードに戻す
        }
    }
});

// 実行
init();