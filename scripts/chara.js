// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// ▼ collection と addDoc を追加で読み込む
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// ==== ここから上書き ====

const dashboardContainer = document.getElementById('dashboard-container');
const createCharaBtn = document.getElementById('create-chara-btn');
const createLoginPrompt = document.getElementById('create-login-prompt');

// 初期化処理
async function init() {
    if (!characterId) {
        // IDがない場合は、アラートを出さずにダッシュボード（作成画面）を表示する
        dashboardContainer.style.display = 'block';
        return;
    }

    // 1. データの取得 (IDがある場合)
    const docRef = doc(db, "characters", characterId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        characterData = docSnap.data();
        renderSheets(characterData.data.sheets, container);
    } else {
        alert("キャラクターが見つかりません");
    }
}

// 2. 権限チェック (ログイン状態の監視)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ログインしている時のUI切り替え
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'flex';
        userEmailDisplay.textContent = user.email;

        // ダッシュボード（作成ボタン）の表示切り替え
        createLoginPrompt.style.display = 'none';
        createCharaBtn.style.display = 'inline-block';

        // キャラクターの所有者と一致するかチェック（閲覧画面にいる場合）
        if (characterData && characterData.data.owner === user.uid) {
            editBtn.style.display = 'block'; 
        } else {
            editBtn.style.display = 'none'; 
        }
    } else {
        // ログアウトしている時のUI切り替え
        loggedOutUI.style.display = 'flex';
        loggedInUI.style.display = 'none';
        editBtn.style.display = 'none';

        // ダッシュボード（作成ボタン）の表示切り替え
        createLoginPrompt.style.display = 'block';
        createCharaBtn.style.display = 'none';
    }
});

// ==== ここまで上書き ====

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

// --- 認証UIの要素を取得 ---
const loggedOutUI = document.getElementById('logged-out-ui');
const loggedInUI = document.getElementById('logged-in-ui');
const emailInput = document.getElementById('email-input');
const passInput = document.getElementById('pass-input');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailDisplay = document.getElementById('user-email-display');

// --- 新規登録ボタンの処理 ---
signupBtn.addEventListener('click', async () => {
  const email = emailInput.value;
  const password = passInput.value;
  if(!email || !password) return alert("メールアドレスとパスワードを入力してください");
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    alert("新規登録が完了しました！\nあなたのUID: " + userCredential.user.uid);
    // ※お試し用：後でFirestoreに手動でテストデータを作る時のためにUIDを表示しています
  } catch (error) {
    alert("エラー: " + error.message);
  }
});

// --- フォームの要素を取得（追加） ---
const authForm = document.getElementById('logged-out-ui');

// --- ログイン処理（click から submit に変更） ---
authForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // 画面がリロードされるの防ぐ（重要！）
  
  const email = emailInput.value;
  const password = passInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("ログインしました！");
    // ※ブラウザによっては、このログイン成功のタイミングで「パスワードを保存しますか？」のポップアップが出ます
  } catch (error) {
    alert("ログイン失敗: メールアドレスかパスワードが間違っています。");
  }
});

// ※「新規登録ボタン (signupBtn)」と「ログアウトボタン (logoutBtn)」の処理は前回のままでOKです。

// --- ログアウトボタンの処理 ---
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  alert("ログアウトしました。");
  // ログアウト時に強制的に閲覧モードに戻す
  document.getElementById('app-main').classList.remove('edit-mode');
  const editableAreas = document.querySelectorAll('.editable-area');
  editableAreas.forEach(area => area.setAttribute('contenteditable', 'false'));
  editBtn.textContent = "編集する";
});

// --- キャラクター新規作成ボタンの処理 ---
createCharaBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("ログインが必要です");

    createCharaBtn.textContent = "作成中...";
    createCharaBtn.disabled = true;

    // ココフォリア互換の初期テンプレートデータ
    const defaultData = {
        kind: "character",
        data: {
            name: "新しい探索者",
            memo: "ここに設定などを記入します",
            initiative: 0,
            externalUrl: "", // ID生成後にURLを入れます
            status: [
                { label: "HP", value: 10, max: 10 },
                { label: "MP", value: 10, max: 10 },
                { label: "SAN", value: 50, max: 99 }
            ],
            params: [
                { label: "STR", value: "10" },
                { label: "DEX", value: "10" }
            ],
            iconUrl: "",
            faces: [],
            x: 0, y: 0, angle: 0, width: 4, height: 4,
            active: true, secret: false, invisible: false, hideStatus: false,
            color: "#322E7B",
            commands: "1d100<=50 【目星】",
            sheets: [
                { name: "設定メモ", value: "キャラクターのバックストーリーなどを記述します", pass: null, field: [] }
            ],
            owner: user.uid // 【重要】これで自分しか編集できなくなる
        }
    };

    try {
        // 1. コレクションにデータを追加し、ランダムなIDを自動生成させる
        const docRef = await addDoc(collection(db, "characters"), defaultData);
        
        // 2. 生成されたIDを使って、externalUrl (ココフォリアから飛んでくる用のURL) を完成させる
        const myUrl = `${window.location.origin}${window.location.pathname}?id=${docRef.id}`;
        defaultData.data.externalUrl = myUrl;
        
        // 3. URLを含めた状態で上書き保存
        await setDoc(docRef, defaultData);

        // 4. 新しく作られたキャラクターの個別ページへ移動
        alert("キャラクターを作成しました！");
        window.location.href = `?id=${docRef.id}`;
        
    } catch (error) {
        console.error("作成エラー:", error);
        alert("作成に失敗しました。");
        createCharaBtn.textContent = "＋ 新規キャラクターを作成";
        createCharaBtn.disabled = false;
    }
});

// 実行
init();