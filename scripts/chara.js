// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// ▼ query, where, getDocs を追加で読み込む
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

        // ▼ 修正ポイント①：データが届いた直後にも「本人か」をチェックしてボタンを出す
        if (auth.currentUser && characterData.data.owner === auth.currentUser.uid) {
            editBtn.style.display = 'block';
        }
    } else {
        alert("キャラクターが見つかりません");
    }
}

// --- キャラクター一覧を取得・描画する関数 ---
async function loadCharacterList(uid) {
    const listElement = document.getElementById('character-list');
    listElement.innerHTML = '<p style="color: white; text-align: center;">読み込み中...</p>';

    try {
        // 「data.owner が 自分のUID と同じもの」を検索するクエリ
        const q = query(collection(db, "characters"), where("data.owner", "==", uid));
        const querySnapshot = await getDocs(q);

        listElement.innerHTML = ''; // 読み込み中テキストをクリア

        if (querySnapshot.empty) {
            listElement.innerHTML = '<p style="color: #E0E0E0; text-align: center;">作成したキャラクターはまだありません。</p>';
            return;
        }

        // 取得したキャラクターをループ処理してカードを作る
        querySnapshot.forEach((docSnap) => {
            const charaId = docSnap.id;
            const data = docSnap.data().data; 

            const card = document.createElement('a');
            card.href = `?id=${charaId}`;
            card.className = 'chara-list-card';

            // 画像URL（空なら灰色のプレースホルダー画像）
            const iconUrl = data.iconUrl || 'data:image/svg+xml;charset=UTF8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2260%22%20height=%2260%22%20style=%22background:%236C757D%22%3E%3C/svg%3E';
            
            // メモ（空ならデフォルトテキスト）
            const memoText = data.memo ? data.memo : '設定メモなし';

            card.innerHTML = `
                <img src="${iconUrl}" alt="icon" onerror="this.src='data:image/svg+xml;charset=UTF8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2260%22%20height=%2260%22%20style=%22background:%236C757D%22%3E%3C/svg%3E'">
                <div class="chara-info">
                    <h4>${data.name || '名前なし'}</h4>
                    <p>${memoText}</p>
                </div>
            `;
            listElement.appendChild(card);
        });

    } catch (error) {
        console.error("一覧取得エラー:", error);
        listElement.innerHTML = '<p style="color: lightpink; text-align: center;">リストの取得に失敗しました。</p>';
    }
}

// 2. 権限チェック (ログイン状態の監視)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ... (既存のUI切り替えコードはそのまま) ...
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'flex';
        userEmailDisplay.textContent = user.email;
        createLoginPrompt.style.display = 'none';
        createCharaBtn.style.display = 'inline-block';

        if (characterData && characterData.data.owner === user.uid) {
            editBtn.style.display = 'block'; 
        } else {
            editBtn.style.display = 'none'; 
        }

        // ▼ ▼ ここを追加 ▼ ▼
        if (!characterId) {
            // ダッシュボードにいる場合、一覧エリアを表示してデータ取得
            document.getElementById('character-list-container').style.display = 'block';
            loadCharacterList(user.uid);
        }
        // ▲ ▲ ここまで ▲ ▲

    } else {
        // ... (既存のログアウト時コード) ...
        loggedOutUI.style.display = 'flex';
        loggedInUI.style.display = 'none';
        editBtn.style.display = 'none';
        createLoginPrompt.style.display = 'block';
        createCharaBtn.style.display = 'none';

        // ▼ 追加：ログアウト時は一覧を隠す
        document.getElementById('character-list-container').style.display = 'none';
    }
});

// ==== ここまで上書き ====

// アコーディオンの再帰的描画関数
function renderSheets(sheetsArray, parentElement) {
    parentElement.innerHTML = '';

    sheetsArray.forEach((sheet, index) => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');

        const headerDiv = document.createElement('div');
        headerDiv.className = 'sheet-header-controls';

        const markDiv = document.createElement('div');
        markDiv.innerHTML = `<span>▼</span><span>▲</span>`;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'sheet-title-text editable-area';
        titleSpan.textContent = sheet.name;
        // oninputを使って上書き（イベントの重複を防ぐ）
        titleSpan.oninput = (e) => { sheet.name = e.target.innerText; };

        const lockSpan = document.createElement('span');
        if (sheet.pass) lockSpan.textContent = " [ロック中]";

        const settingBtn = document.createElement('button');
        settingBtn.textContent = "設定";
        settingBtn.className = "setting-btn edit-only-ui";
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

        if (sheet.value !== undefined) {
            const textDiv = document.createElement('div');
            textDiv.className = 'sheet-text editable-area';
            textDiv.textContent = sheet.value;
            textDiv.oninput = (e) => { sheet.value = e.target.innerText; };
            contentContainer.appendChild(textDiv);
        }

        // ▼ 変更点：必ず子要素コンテナを作り、再帰呼び出しに任せる
        if (!sheet.field) sheet.field = [];
        const nestedContainer = document.createElement('div');
        nestedContainer.className = 'nested-field';
        renderSheets(sheet.field, nestedContainer);
        contentContainer.appendChild(nestedContainer);

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

    // ▼ 変更点：階層の「最後」に必ず追加ボタンを配置する！
    const addBtn = document.createElement('button');
    addBtn.textContent = "＋ メモを追加";
    addBtn.className = "edit-btn edit-only-ui";
    addBtn.style.margin = "10px";
    addBtn.addEventListener('click', () => {
        sheetsArray.push({ name: "新規メモ", value: "内容を入力してください", pass: null, field: [] });
        renderSheets(sheetsArray, parentElement); // 再描画
        if (document.getElementById('app-main').classList.contains('edit-mode')) {
            // 再描画された要素を編集可能にする
            document.querySelectorAll('.editable-area').forEach(area => area.setAttribute('contenteditable', 'true'));
        }
    });
    parentElement.appendChild(addBtn);
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

    // ▼ 変更点: editable-area クラスを追加して編集可能にする
    nameEl.className = 'editable-title editable-area';
    nameEl.textContent = data.name;
    imgInput.value = data.iconUrl || "";

    // 名前と画像のリアルタイム反映 (oninputとonchangeに変更)
    nameEl.oninput = (e) => { data.name = e.target.innerText; };
    imgInput.onchange = (e) => {
        data.iconUrl = e.target.value;
        imgEl.src = e.target.value;
    };

    // ... (以降のパラメータ描画の処理はそのまま残してください) ...

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
        if (document.getElementById('app-main').classList.contains('edit-mode')) {
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
        editBtn.textContent = "保存";
        editableAreas.forEach(area => area.setAttribute('contenteditable', 'true'));
    } else {
        editBtn.textContent = "保存中...";
        editableAreas.forEach(area => area.setAttribute('contenteditable', 'false'));

        // Firestoreへ上書き保存
        try {
            await setDoc(doc(db, "characters", characterId), characterData);
            editBtn.textContent = "編集";
            alert("保存しました！");
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("保存に失敗しました。");
            editBtn.textContent = "保存";
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
    if (!email || !password) return alert("メールアドレスとパスワードを入力してください");

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
    editBtn.textContent = "編集";
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