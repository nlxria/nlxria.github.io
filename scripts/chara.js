// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// ▼ 変更：Google認証用の関数を読み込む
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
const exportBtn = document.getElementById('export-ccfolia-btn'); // ← ★この1行を追加
const container = document.getElementById('sheets-container');

// ==== ここから上書き ====

const dashboardContainer = document.getElementById('dashboard-container');
const createCharaBtn = document.getElementById('create-chara-btn');
const createLoginPrompt = document.getElementById('create-login-prompt');

// ▼ ★この1行を追加してください！★ ▼
const importCharaBtn = document.getElementById('import-ccfolia-btn');
// ▲ ★ここまで★ ▲

// 初期化処理
async function init() {
    if (!characterId) {
        dashboardContainer.style.display = 'block';
        return;
    }

    const docRef = doc(db, "characters", characterId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        characterData = docSnap.data();

        // ▼▼▼ この1行を追加：データがある時だけキャラクターエリアを表示する ▼▼▼
        document.getElementById('character-view-area').style.display = 'block';
        exportBtn.style.display = 'block'; // ← ★この1行を追加：データがあれば出力ボタンを表示

        renderSheets(characterData.data.sheets, container);
        renderBasicInfo();

        if (auth.currentUser && characterData.data.owner === auth.currentUser.uid) {
            editBtn.style.display = 'block';
        }
        updateSheetsContainerVisibility(); // ← ここに追加
    } else {
        alert("キャラクターが見つかりません");
    }
}

// --- キャラクター一覧を取得・描画する関数 ---
async function loadCharacterList(uid) {
    const listElement = document.getElementById('character-list');
    listElement.innerHTML = '<p style="color: white; text-align: center;">読み込み中...</p>';

    try {
        const q = query(collection(db, "characters"), where("data.owner", "==", uid));
        const querySnapshot = await getDocs(q);

        listElement.innerHTML = '';

        if (querySnapshot.empty) {
            listElement.innerHTML = '<p style="color: #E0E0E0; text-align: center;">作成したキャラクターはまだありません。</p>';
            return;
        }

        // ▼ 1. 取得したデータを一旦配列にまとめる
        const charaList = [];
        querySnapshot.forEach((docSnap) => {
            charaList.push({ id: docSnap.id, data: docSnap.data().data });
        });

        // ▼ 2. date（更新時間）が大きい順（新しい順）に並び替える
        // ※古いデータで date が無い場合は 0 として一番下に表示します
        charaList.sort((a, b) => (b.data.date || 0) - (a.data.date || 0));

        // ※ getSheetCharCount 関数は削除しました

        // ▼ 3. 並び替えたデータをループしてカードを作る
        charaList.forEach((chara) => {
            const charaId = chara.id;
            const data = chara.data;

            const card = document.createElement('a');
            card.href = `?id=${charaId}`;
            card.className = 'chara-list-card';

            const iconUrl = data.iconUrl || '/assets/image/chara-image.png';

            // ▼ ★ここを変更：ココフォリアに送るJSON全体の文字数をカウントする
            const charCount = JSON.stringify({ kind: "character", data: data }).length;

            card.innerHTML = `
                <img src="${iconUrl}" alt="icon" onerror="this.src='/assets/image/chara-image.png'">
                <div class="chara-info">
                    <h4>${data.name || '名無し'}</h4>
                    <p>データ量：${charCount}文字</p>
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
        importCharaBtn.style.display = 'inline-block'; // 追加：ログイン中なら入力ボタンを表示

        if (characterData && characterData.data.owner === user.uid) {
            editBtn.style.display = 'block';

            // ▼ ★ここを追記：本人だと確認できたタイミングで、ロック解除状態で再描画する
            renderSheets(characterData.data.sheets, container);
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
        importCharaBtn.style.display = 'none'; // 追加

        // ▼ 追加：ログアウト時は一覧を隠す
        document.getElementById('character-list-container').style.display = 'none';
    }
});

// アコーディオンの再帰的描画関数（親と子要素の分離版）
function renderSheets(sheetsArray, parentElement, isRoot = true) {
    // 再描画時にアコーディオンが閉じてしまうのを防ぐため、現在の開閉状態を記憶
    const openStates = Array.from(parentElement.children).map(child => {
        if (child.classList.contains('chara-box')) {
            const det = child.querySelector('details');
            return det ? det.open : false;
        } else if (child.tagName === 'DETAILS') {
            return child.open;
        }
        return false;
    });

    parentElement.innerHTML = '';

    sheetsArray.forEach((sheet, index) => {
        let targetParent = parentElement;

        // 親（ルート階層）の場合は青背景・白枠（chara-box）で囲む
        if (isRoot) {
            const box = document.createElement('div');
            box.className = 'chara-box';
            box.style.marginBottom = '2em';
            parentElement.appendChild(box);
            targetParent = box;
        }

        const details = document.createElement('details');

        // 記憶した開閉状態を復元（新規追加されたものは自動で開く）
        if (index < openStates.length) {
            details.open = openStates[index];
        } else if (index === sheetsArray.length - 1 && sheetsArray.length > openStates.length) {
            details.open = true;
        }

        const summary = document.createElement('summary');

        const headerContainer = document.createElement('span');
        headerContainer.className = 'sheet-header-controls';
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.width = 'auto';

        const markSpan = document.createElement('span');
        markSpan.textContent = details.open ? '▲ ' : '▼ ';
        markSpan.style.marginRight = '8px';
        details.addEventListener('toggle', () => {
            markSpan.textContent = details.open ? '▲ ' : '▼ ';
        });

        const titleSpan = document.createElement('span');
        titleSpan.className = 'sheet-title-text editable-area';
        titleSpan.textContent = sheet.name;
        titleSpan.oninput = (e) => { sheet.name = e.target.innerText; };

        // ▼ ▼ ★ここに追加★ ▼ ▼
        titleSpan.addEventListener('click', (e) => {
            // 編集モード（入力可能）の時だけ、クリックによる開閉を無効化する
            if (titleSpan.getAttribute('contenteditable') === 'true') {
                e.preventDefault();
            }
        });
        // ▲ ▲ ★ここまで★ ▲ ▲

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

        headerContainer.append(markSpan, titleSpan, lockSpan, settingBtn);
        summary.appendChild(headerContainer);
        details.appendChild(summary);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'sheet-content-container';

        // 1. 白い背景のコンテナ
        const whiteBox = document.createElement('div');
        whiteBox.className = 'sheet-text';

        // 2. テキスト編集専用エリア（子要素と分離することで入力時のバグを防ぐ）
        const textDiv = document.createElement('div');
        textDiv.className = 'editable-area text-content';
        if (sheet.value !== undefined && sheet.value !== "") {
            textDiv.textContent = sheet.value;
        }
        textDiv.oninput = (e) => { sheet.value = e.target.innerText; };
        whiteBox.appendChild(textDiv);

        // 3. 子要素（field）のコンテナ
        if (!sheet.field) sheet.field = [];
        const nestedContainer = document.createElement('div');
        nestedContainer.className = 'nested-field';

        // ▼ ▼ ★ここに追加：子メモが0個なら、枠を消すクラスを付ける★ ▼ ▼
        if (sheet.field.length === 0) {
            nestedContainer.classList.add('empty-nested');
        }
        // ▲ ▲ ★ここまで★ ▲ ▲

        // 子要素を描画（ここでは isRoot を false にする）
        renderSheets(sheet.field, nestedContainer, false);

        whiteBox.appendChild(nestedContainer);
        contentContainer.appendChild(whiteBox);

        // ▼ ▼ ★ここを追加＆変更★ ▼ ▼
        // 現在見ているのが「所有者本人」かどうかを判定
        const isOwner = auth.currentUser && characterData && characterData.data.owner === auth.currentUser.uid;

        // パスワード処理（パスワードが設定されていて、かつ「本人ではない」場合のみロックする）
        if (sheet.pass && !isOwner) {
            const passContainer = document.createElement('div');
            passContainer.className = 'password-container';
            const passInput = document.createElement('input');
            passInput.type = 'text';
            passInput.placeholder = 'パスワードを入力';
            passInput.className = 'pass-input';

            // ▼ この1行を追加
            passInput.setAttribute('autocomplete', 'off');

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
            // パスワードがない、または「本人」の場合は最初から中身を表示する
            details.appendChild(contentContainer);
        }
        // ▲ ▲ ★ここまで★ ▲ ▲

        targetParent.appendChild(details);
    });

    // ▼ ★修正箇所：追加ボタンはループの外で「1つだけ」配置する
    const addBtn = document.createElement('button');

    if (isRoot) {
        // 一番上の階層の場合は青色の全幅ボタン
        addBtn.textContent = "メモを追加";
        addBtn.className = "add-resource-btn edit-only-ui";
    } else {
        // 子階層の場合は通常の青色ボタン
        addBtn.textContent = "メモを追加";
        addBtn.className = "edit-btn edit-only-ui";
        addBtn.style.marginTop = "10px";
    }

    addBtn.addEventListener('click', () => {
        sheetsArray.push({ name: isRoot ? "メモ" : "メモ", value: "", pass: null, field: [] });

        // この階層だけを再描画する
        renderSheets(sheetsArray, parentElement, isRoot);

        if (document.getElementById('app-main').classList.contains('edit-mode')) {
            document.querySelectorAll('.editable-area').forEach(area => area.setAttribute('contenteditable', 'true'));
        }
        updateSheetsContainerVisibility();
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
        viewText.className = 'view-only-ui'; // ← ★この1行を追加！
        viewText.style.color = "white";
        viewText.style.flex = "1";
        viewText.textContent = `${param.label} : ${param.value}`;

        // 編集モード用の入力欄
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'pass-input param-input-label edit-only-ui';
        labelInput.value = param.label;
        labelInput.setAttribute('autocomplete', 'off'); // ▼ 追加
        labelInput.addEventListener('input', (e) => param.label = e.target.value);

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'pass-input param-input-value edit-only-ui';
        valueInput.value = param.value;
        valueInput.setAttribute('autocomplete', 'off'); // ▼ 追加
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

    // 「＋ リソース追加」ボタン（青色）
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
    updateSheetsContainerVisibility();
}

// --- 閲覧モードで空の枠を隠す関数（メモ・能力値の両方に対応） ---
function updateSheetsContainerVisibility() {
    const isEditing = document.getElementById('app-main').classList.contains('edit-mode');

    // ① メモ枠の表示切替
    const sheetsContainer = document.getElementById('sheets-container');
    if (characterData && characterData.data.sheets.length === 0 && !isEditing) {
        sheetsContainer.style.display = 'none';
    } else {
        sheetsContainer.style.display = 'block';
    }

    // ② 能力値（基本ステータス）枠の表示切替
    const basicContainer = document.getElementById('basic-status-container');
    if (characterData && characterData.data.params.length === 0 && !isEditing) {
        basicContainer.style.display = 'none';
    } else {
        basicContainer.style.display = 'block';
    }
}

// 編集モードの切り替えロジック
editBtn.addEventListener('click', async () => {
    const isEditing = mainElement.classList.toggle('edit-mode');
    const editableAreas = document.querySelectorAll('.editable-area');

    if (isEditing) {
        editBtn.textContent = "保存";
        exportBtn.style.display = 'none'; // ← ★追加：編集中は出力ボタンを隠す
        editableAreas.forEach(area => area.setAttribute('contenteditable', 'true'));
    } else {
        editBtn.textContent = "保存中...";
        editableAreas.forEach(area => area.setAttribute('contenteditable', 'false'));

        characterData.data.date = Date.now();

        // Firestoreへ上書き保存
        try {
            await setDoc(doc(db, "characters", characterId), characterData);
            editBtn.textContent = "編集";
            exportBtn.style.display = 'block'; // ← ★追加：保存完了で出力ボタンを復活させる
            alert("保存しました！");
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("保存に失敗しました。");
            editBtn.textContent = "保存";
            mainElement.classList.add('edit-mode'); // 失敗したら編集モードに戻す
        }
    }
    updateSheetsContainerVisibility(); // ← ここに追加
});

// --- 認証UIの要素を取得 ---
const loggedOutUI = document.getElementById('logged-out-ui');
const loggedInUI = document.getElementById('logged-in-ui');
const googleLoginBtn = document.getElementById('google-login-btn'); // 変更
const logoutBtn = document.getElementById('logout-btn');
const userEmailDisplay = document.getElementById('user-email-display');

// Google認証プロバイダの準備
const provider = new GoogleAuthProvider();

// --- Googleログインボタンの処理 ---
googleLoginBtn.addEventListener('click', async () => {
    try {
        // ポップアップウィンドウでGoogleログイン画面を表示
        await signInWithPopup(auth, provider);
        alert("ログインしました！");
    } catch (error) {
        console.error("ログインエラー:", error);
        // ユーザーがポップアップを閉じた場合などのエラーハンドリング
        if (error.code !== 'auth/popup-closed-by-user') {
            alert("ログインに失敗しました。");
        }
    }
});

// ※「ログアウトボタンの処理 (logoutBtn)」は前回のままでOKです。

// --- ログアウトボタンの処理 ---
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    alert("ログアウトしました。");
    // ログアウト時に強制的に閲覧モードに戻す
    document.getElementById('app-main').classList.remove('edit-mode');
    const editableAreas = document.querySelectorAll('.editable-area');
    editableAreas.forEach(area => area.setAttribute('contenteditable', 'false'));
    editBtn.textContent = "編集";
    updateSheetsContainerVisibility(); // ← ここに追加
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
            date: Date.now(),
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
        createCharaBtn.textContent = "キャラクターを作成";
        createCharaBtn.disabled = false;
    }
});

// --- ココフォリア駒入力（インポート）の処理 ---
importCharaBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("ログインが必要です");

    try {
        // 1. クリップボードからテキストを読み取る
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText) return alert("クリップボードが空です。");

        // 2. JSONとして解析
        let importedJson;
        try {
            importedJson = JSON.parse(clipboardText);
        } catch (e) {
            return alert("クリップボードの内容が正しいキャラクターデータではありません。");
        }

        // 3. データのバリデーション（ココフォリア形式かチェック）
        if (importedJson.kind !== "character" || !importedJson.data) {
            return alert("ココフォリア互換のキャラクターデータが見つかりませんでした。");
        }

        importCharaBtn.textContent = "読み込み中...";
        importCharaBtn.disabled = true;

        // 4. データの整形（本サイト用のメタデータを付与）
        const charaData = importedJson.data;

        // 既存のデータ構造を活かしつつ、管理に必要な情報を上書き/追加
        charaData.owner = user.uid;      // 所有者を自分に設定
        charaData.date = Date.now();    // 更新日時を現在に

        // 必須フィールドが欠けている場合の補完（念のため）
        if (!charaData.sheets) charaData.sheets = [];
        if (!charaData.params) charaData.params = [];
        if (!charaData.status) charaData.status = [];

        // 5. Firestoreへ新規保存
        const docRef = await addDoc(collection(db, "characters"), {
            kind: "character",
            data: charaData
        });

        // 6. URLを生成して更新（ココフォリア用のリンクも正しくしておく）
        const myUrl = `${window.location.origin}${window.location.pathname}?id=${docRef.id}`;
        charaData.externalUrl = myUrl;
        await setDoc(docRef, { kind: "character", data: charaData });

        alert("キャラクターをインポートしました！");
        window.location.href = `?id=${docRef.id}`;

    } catch (error) {
        console.error("インポートエラー:", error);
        alert("読み込みに失敗しました。クリップボードへのアクセスを許可してください。");
    } finally {
        importCharaBtn.textContent = "ココフォリア駒入力";
        importCharaBtn.disabled = false;
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

    // ▼ ★ここを追記：パスワード設定後も編集モードを維持する
    if (document.getElementById('app-main').classList.contains('edit-mode')) {
        document.querySelectorAll('.editable-area').forEach(area => area.setAttribute('contenteditable', 'true'));
    }
});

// モーダル：削除
document.getElementById('modal-delete-btn').addEventListener('click', () => {
    if (confirm("本当にこのメモを削除しますか？（内部のデータもすべて消えます）")) {
        currentTargetArray.splice(currentTargetIndex, 1); // 配列から削除
        settingsModal.style.display = 'none';
        renderSheets(characterData.data.sheets, container); // 再描画

        // ▼ 追加：再描画後も編集モードを維持する
        if (document.getElementById('app-main').classList.contains('edit-mode')) {
            document.querySelectorAll('.editable-area').forEach(area => area.setAttribute('contenteditable', 'true'));
        }
        // ▼ 追加：メモが0になったら枠を隠す
        updateSheetsContainerVisibility();
    }
});

// --- ココフォリア出力機能 ---
exportBtn.addEventListener('click', async () => {
    if (!characterData) return;

    try {
        // characterData は既に { kind: "character", data: {...} } の形になっています
        const jsonText = JSON.stringify(characterData);

        // クリップボードにJSON文字列をコピー
        await navigator.clipboard.writeText(jsonText);

        alert("ココフォリア用データをコピーしました！\nココフォリアの盤面を開き、「Ctrl + V（ペースト）」で出力できます。");
    } catch (err) {
        console.error("クリップボードコピーエラー:", err);
        alert("コピーに失敗しました。ブラウザのクリップボード権限を確認してください。");
    }
});

// 実行
init();