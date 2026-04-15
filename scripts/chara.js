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
        renderBasicInfo();
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
    parentElement.innerHTML = '';

    sheetsArray.forEach((sheet, index) => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        
        // ヘッダー構造の変更（タイトル編集と設定ボタン）
        const headerDiv = document.createElement('div');
        headerDiv.className = 'sheet-header-controls';
        
        const markDiv = document.createElement('div');
        markDiv.innerHTML = `<span>▼</span><span>▲</span>`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'sheet-title-text editable-area';
        titleSpan.textContent = sheet.name;
        // タイトル変更の連動
        titleSpan.addEventListener('input', (e) => { sheet.name = e.target.innerText; });

        // 鍵マーク
        const lockSpan = document.createElement('span');
        if (sheet.pass) lockSpan.textContent = " [ロック中]";

        // 設定ボタン（編集時のみ表示）
        const settingBtn = document.createElement('button');
        settingBtn.textContent = "設定";
        settingBtn.className = "setting-btn edit-only-ui";
        // クリック時にアコーディオンが開閉するのを防ぎつつ、モーダルを開く
        settingBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            currentTargetSheet = sheet;
            currentTargetArray = sheetsArray;
            currentTargetIndex = index;
            modalPassInput.value = sheet.pass || "";
            settingsModal.style.display = 'flex';
        });

        headerDiv.append(markDiv, titleSpan, lockSpan, settingBtn);
        summary.appendChild(headerDiv);
        details.appendChild(summary);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'sheet-content-container';

        // テキスト領域
        if (sheet.value !== undefined) {
            const textDiv = document.createElement('div');
            textDiv.className = 'sheet-text editable-area';
            textDiv.textContent = sheet.value;
            textDiv.addEventListener('input', (e) => { sheet.value = e.target.innerText; });
            contentContainer.appendChild(textDiv);
        }

        // 子要素の再帰処理
        if (sheet.field && sheet.field.length > 0) {
            const nestedContainer = document.createElement('div');
            nestedContainer.className = 'nested-field';
            renderSheets(sheet.field, nestedContainer);
            contentContainer.appendChild(nestedContainer);
        }

        // --- 子メモを追加するボタン（編集時のみ表示） ---
        const addSubBtn = document.createElement('button');
        addSubBtn.textContent = "＋ メモを追加";
        addSubBtn.className = "edit-btn edit-only-ui";
        addSubBtn.style.margin = "10px";
        addSubBtn.addEventListener('click', () => {
            if (!sheet.field) sheet.field = [];
            sheet.field.push({ name: "新規メモ", value: "内容を入力", pass: null, field: [] });
            renderSheets(sheetsArray, parentElement); // 再描画して編集状態を維持する処理が必要ですが、簡易的に再描画します
            
            // 再描画後に編集モードを再度適用する
            if(document.getElementById('app-main').classList.contains('edit-mode')){
                document.querySelectorAll('.editable-area').forEach(area => area.setAttribute('contenteditable', 'true'));
            }
        });
        contentContainer.appendChild(addSubBtn);

        // ...（パスワード入力ロックの処理は前回と同じなので省略・そのまま残してください）...

        details.appendChild(contentContainer);
        parentElement.appendChild(details);
    });
}

// プロフィールと基本パラメータを描画する関数
function renderBasicInfo() {
    const data = characterData.data;

    // トップの画像と名前
    document.getElementById('profile-container').style.display = 'block';
    const imgEl = document.getElementById('chara-image');
    const nameEl = document.getElementById('chara-name');
    const imgInput = document.getElementById('chara-image-input');

    if (data.iconUrl) imgEl.src = data.iconUrl;
    nameEl.textContent = data.name;
    imgInput.value = data.iconUrl || "";

    // 名前と画像のリアルタイム反映
    nameEl.addEventListener('input', (e) => data.name = e.target.innerText);
    imgInput.addEventListener('change', (e) => {
        data.iconUrl = e.target.value;
        imgEl.src = e.target.value; // すぐに画像プレビューを更新
    });

    // パラメータ（能力値）の描画
    const basicContainer = document.getElementById('basic-status-container');
    basicContainer.innerHTML = ''; // リセット

    // params配列をループして行を作る
    data.params.forEach((param, index) => {
        const row = document.createElement('div');
        row.className = 'param-row';

        // 閲覧モード用のテキスト（通常表示）
        const viewText = document.createElement('span');
        viewText.style.color = "white";
        viewText.style.flex = "1";
        viewText.textContent = `${param.label} : ${param.value}`;
        
        // 編集モード用の入力欄
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'pass-input param-input-label edit-only-ui';
        labelInput.value = param.label;
        labelInput.addEventListener('input', (e) => param.label = e.target.value);

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'pass-input param-input-value edit-only-ui';
        valueInput.value = param.value;
        valueInput.addEventListener('input', (e) => param.value = e.target.value);

        // 削除ボタン
        const delBtn = document.createElement('button');
        delBtn.textContent = "削除";
        delBtn.className = 'setting-btn edit-only-ui';
        delBtn.addEventListener('click', () => {
            data.params.splice(index, 1);
            renderBasicInfo(); // 行を消して再描画
        });

        row.append(viewText, labelInput, valueInput, delBtn);
        basicContainer.appendChild(row);
    });

    // 「＋ リソース追加」ボタン（緑色）
    const addBtn = document.createElement('button');
    addBtn.textContent = "＋ リソース追加";
    addBtn.className = 'add-resource-btn edit-only-ui';
    addBtn.addEventListener('click', () => {
        data.params.push({ label: "新規項目", value: "10" });
        renderBasicInfo();
        // 再描画時に編集モード状態なら input を表示したままにするため
        if(document.getElementById('app-main').classList.contains('edit-mode')){
            // 特殊な処理は不要（CSSで .edit-mode 下の .edit-only-ui が表示されるため）
        }
    });

    basicContainer.appendChild(addBtn);
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
            name: "新たなキャラクター",
            memo: "",
            initiative: 0,
            externalUrl: "", // ID生成後にURLを入れます
            status: [],
            params: [],
            iconUrl: "",
            faces: [],
            x: 0, y: 0, angle: 0, width: 4, height: 4,
            active: true, secret: false, invisible: false, hideStatus: false,
            color: "#888888",
            commands: "",
            sheets: [],
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

// --- モーダル用の変数とイベント ---
let currentTargetSheet = null;
let currentTargetArray = null;
let currentTargetIndex = null;

const settingsModal = document.getElementById('settings-modal');
const modalPassInput = document.getElementById('modal-pass-input');

// モーダル：キャンセル
document.getElementById('modal-cancel-btn').addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// モーダル：保存（パスワード設定）
document.getElementById('modal-save-btn').addEventListener('click', () => {
    currentTargetSheet.pass = modalPassInput.value !== "" ? modalPassInput.value : null;
    settingsModal.style.display = 'none';
    renderSheets(characterData.data.sheets, container); // 再描画
});

// モーダル：削除
document.getElementById('modal-delete-btn').addEventListener('click', () => {
    if (confirm("本当にこのメモを削除しますか？（内部のデータもすべて消えます）")) {
        currentTargetArray.splice(currentTargetIndex, 1); // 配列から削除
        settingsModal.style.display = 'none';
        renderSheets(characterData.data.sheets, container); // 再描画
    }
});

// 実行
init();