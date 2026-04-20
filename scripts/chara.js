// 注意: 実際のFirebase設定情報に書き換えてください
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// グローバル変数
let characterData = null;
let charaMap = null;
let charaMarker = null;
let tempMapX = 0;
let tempMapY = 0;
let characterId = new URLSearchParams(window.location.search).get('id');
let specialOpenStates = { memo: false, status: false, params: false, commands: false };
let isAuthLoaded = false;

// キャッシュ変数
let cachedMyCharacters = null;
let cachedPublicCharacters = null;
let isPublicCacheLoading = false;

const mainElement = document.getElementById('app-main');
const editBtn = document.getElementById('edit-mode-btn');
const exportBtn = document.getElementById('export-ccfolia-btn');
const container = document.getElementById('sheets-container');
const dashboardContainer = document.getElementById('dashboard-container');
const createCharaBtn = document.getElementById('create-chara-btn');
const createLoginPrompt = document.getElementById('create-login-prompt');
const importCharaBtn = document.getElementById('import-ccfolia-btn');
const searchInput = document.getElementById('search-input');

function getDefaultData(uid) {
    return {
        name: "新たなキャラクター",
        ruby: "",
        memo: "",
        date: Date.now(),
        initiative: 0,
        externalUrl: "",
        status: [],
        params: [],
        iconUrl: "",
        faces: [],
        x: 0, y: 0, angle: 0, width: 4, height: 4,
        active: true, secret: false, invisible: false, hideStatus: false,
        color: "#888888",
        commands: "",
        sheets: [],
        owner: uid,
        privacy: 2,
    };
}

function applyEditMode() {
    const isEditing = mainElement.classList.contains('edit-mode');
    document.querySelectorAll('.editable-area').forEach(area => area.setAttribute('contenteditable', isEditing ? 'true' : 'false'));

    const privacySelect = document.getElementById('chara-privacy-select');
    if (privacySelect) {
        privacySelect.disabled = !isEditing;
        privacySelect.style.opacity = isEditing ? "1" : "0.8";
        privacySelect.style.cursor = isEditing ? "pointer" : "default";
    }
}

// === 初期化とデータ取得 ===
async function init() {
    if (!characterId) {
        dashboardContainer.style.display = 'block';
        return;
    }

    const docRef = doc(db, "characters", characterId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        characterData = docSnap.data();
        if (characterData.data.privacy === undefined) characterData.data.privacy = 2;
        if (isAuthLoaded) checkAndRender();
    } else {
        alert("キャラクターが見つかりません。");
    }
}

// === 権限チェックと描画 ===
function checkAndRender() {
    const isOwner = auth.currentUser && characterData.data.owner === auth.currentUser.uid;
    const privacy = characterData.data.privacy;

    if (privacy === 2 && !isOwner) {
        document.getElementById('character-view-area').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'none';
        document.getElementById('private-alert-container').style.display = 'block';
        exportBtn.style.display = 'none';
        editBtn.style.display = 'none';
        return;
    }

    document.getElementById('private-alert-container').style.display = 'none';
    document.getElementById('character-view-area').style.display = 'block';
    exportBtn.style.display = 'block';

    renderProfile();
    renderMap();
    renderSpecialSections();
    renderSheets(characterData.data.sheets, container, true, false);

    editBtn.style.display = isOwner ? 'block' : 'none';
    updateSheetsContainerVisibility();
    applyEditMode();
}

// === 認証状態の監視 ===
onAuthStateChanged(auth, (user) => {
    isAuthLoaded = true;
    if (user) {
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'flex';
        userEmailDisplay.textContent = user.email;
        createLoginPrompt.style.display = 'none';
        createCharaBtn.style.display = 'inline-block';
        importCharaBtn.style.display = 'inline-block';
    } else {
        loggedOutUI.style.display = 'flex';
        loggedInUI.style.display = 'none';
        editBtn.style.display = 'none';
        createLoginPrompt.style.display = 'block';
        createCharaBtn.style.display = 'none';
        importCharaBtn.style.display = 'none';
    }

    if (characterData) {
        checkAndRender();
    } else if (!characterId) {
        document.getElementById('character-list-container').style.display = 'block';
        if (user) loadCharacterList(user.uid);
    }
});

// === キャラクター一覧の取得 ===
async function loadCharacterList(uid) {
    const listElement = document.getElementById('character-list');
    const searchKeyword = searchInput.innerText.trim().toLowerCase();

    const renderCards = (charaList) => {
        listElement.innerHTML = ''; // ▼ 修正：タグを処理するためinnerHTMLに戻す
        if (charaList.length === 0) {
            listElement.innerHTML = '<p style="color: #E0E0E0; text-align: center;">キャラクターが見つかりません。</p>';
            return;
        }

        const sortedList = [...charaList].sort((a, b) => (b.data.date || 0) - (a.data.date || 0));

        sortedList.forEach((chara) => {
            const charaId = chara.id;
            const data = chara.data;
            const card = document.createElement('a');
            card.href = `?id=${charaId}`;
            card.className = 'chara-list-card';

            const iconUrl = data.iconUrl || '/assets/image/chara-image.png';
            const charCount = JSON.stringify({ kind: "character", data: data }).length;

            // ▼ 修正：UI構築はinnerHTMLで行い、名前だけは安全にtextContentで後から入れる
            card.innerHTML = `
                <img src="${iconUrl}" alt="icon" onerror="this.src='/assets/image/chara-image.png'">
                <div class="chara-info">
                    <h4 class="card-name-display"></h4>
                    <p>データ量：${charCount}文字</p>
                </div>
            `;
            card.querySelector('.card-name-display').textContent = data.name || '名無し';

            if (uid && data.owner === uid) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '削除';
                deleteBtn.className = 'chara-delete-btn';
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm("本当にこのキャラクターを削除しますか？")) {
                        try {
                            await deleteDoc(doc(db, "characters", charaId));
                            alert("キャラクターを削除しました。");
                            cachedMyCharacters = null;
                            cachedPublicCharacters = null;
                            loadCharacterList(uid);
                        } catch (err) {
                            console.error("削除エラー:", err);
                            alert("削除に失敗しました。");
                        }
                    }
                });
                card.appendChild(deleteBtn);
            }
            listElement.appendChild(card);
        });
    };

    try {
        if (searchKeyword === "") {
            if (!uid) {
                listElement.innerHTML = '<p style="color: #E0E0E0; text-align: center;">検索キーワードを入力してください。</p>';
                return;
            }

            if (cachedMyCharacters) {
                renderCards(cachedMyCharacters);
                return;
            }

            listElement.innerHTML = '<p style="color: white; text-align: center;">読み込み中...</p>'; // ▼ 修正
            const q = query(collection(db, "characters"), where("data.owner", "==", uid));
            const querySnapshot = await getDocs(q);
            cachedMyCharacters = [];
            querySnapshot.forEach((docSnap) => cachedMyCharacters.push({ id: docSnap.id, data: docSnap.data().data }));
            renderCards(cachedMyCharacters);

        } else {
            const executeSearch = () => {
                const filteredList = cachedPublicCharacters.filter(chara => {
                    const jsonStr = JSON.stringify(chara.data).toLowerCase();
                    return jsonStr.includes(searchKeyword);
                });
                renderCards(filteredList);
            };

            if (cachedPublicCharacters) {
                executeSearch();
            } else {
                if (isPublicCacheLoading) return;
                isPublicCacheLoading = true;
                listElement.innerHTML = '<p style="color: white; text-align: center;">公開データを取得中...</p>'; // ▼ 修正

                const q = query(collection(db, "characters"), where("data.privacy", "==", 0));
                const querySnapshot = await getDocs(q);
                cachedPublicCharacters = [];
                querySnapshot.forEach((docSnap) => cachedPublicCharacters.push({ id: docSnap.id, data: docSnap.data().data }));

                isPublicCacheLoading = false;
                executeSearch();
            }
        }
    } catch (error) {
        console.error("一覧取得エラー:", error);
        listElement.innerHTML = '<p style="color: lightpink; text-align: center;">リストの取得に失敗しました。</p>'; // ▼ 修正
        isPublicCacheLoading = false;
    }
}

// === 特殊セクションの描画 ===
function renderSpecialSections() {
    const container = document.getElementById('special-sections-container');
    container.innerHTML = ''; // ▼ 修正
    const isEditing = mainElement.classList.contains('edit-mode');
    const data = characterData.data;
    const isOwner = auth.currentUser && data.owner === auth.currentUser.uid;

    const sections = [
        { id: 'memo', title: 'キャラクターメモ', dataKey: 'memo', passKey: 'memoPass', render: renderMemoContent, isEmpty: !data.memo || data.memo.trim() === "" },
        { id: 'status', title: 'ステータス', dataKey: 'status', passKey: 'statusPass', render: renderStatusContent, isEmpty: !data.status || data.status.length === 0 },
        { id: 'params', title: 'パラメータ', dataKey: 'params', passKey: 'paramsPass', render: renderParamsContent, isEmpty: !data.params || data.params.length === 0 },
        { id: 'commands', title: 'チャットパレット', dataKey: 'commands', passKey: 'commandsPass', render: renderCommandsContent, isEmpty: !data.commands || data.commands.trim() === "" }
    ];

    sections.forEach(sec => {
        if (sec.isEmpty && !isEditing) return;

        const box = document.createElement('div');
        box.className = 'chara-box';
        box.style.marginBottom = '2em';

        const details = document.createElement('details');
        details.open = specialOpenStates[sec.id];

        const summary = document.createElement('summary');
        const headerContainer = document.createElement('span');
        headerContainer.className = 'sheet-header-controls';
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.width = 'auto';

        const markSpan = document.createElement('span');
        markSpan.className = 'accordion-icon';

        details.addEventListener('toggle', () => {
            specialOpenStates[sec.id] = details.open;
        });

        const titleSpan = document.createElement('span');
        titleSpan.className = 'sheet-title-text';
        titleSpan.textContent = sec.title;

        const lockSpan = document.createElement('span');
        if (data[sec.passKey]) lockSpan.textContent = " [ロック中]";

        const settingBtn = document.createElement('button');
        settingBtn.textContent = "設定";
        settingBtn.className = "setting-btn edit-only-ui";
        settingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentTargetType = 'special';
            currentTargetPassKey = sec.passKey;
            modalPassInput.innerText = data[sec.passKey] || "";
            document.getElementById('modal-delete-btn').style.display = 'none';
            settingsModal.style.display = 'flex';
        });

        headerContainer.append(markSpan, titleSpan, lockSpan, settingBtn);
        summary.appendChild(headerContainer);
        details.appendChild(summary);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'sheet-content-container';
        const whiteBox = document.createElement('div');
        whiteBox.className = 'sheet-text';

        sec.render(whiteBox, data);
        contentContainer.appendChild(whiteBox);

        if (data[sec.passKey] && !isOwner) {
            const passContainer = document.createElement('div');
            passContainer.className = 'password-container';

            const passInput = document.createElement('div');
            passInput.setAttribute('placeholder', 'パスワードを入力');
            passInput.className = 'pass-input';
            passInput.contentEditable = 'true';
            passInput.style.minHeight = '1.5em';
            passInput.style.cursor = 'text';

            passContainer.appendChild(passInput);
            details.appendChild(passContainer);

            contentContainer.style.display = 'none';
            details.appendChild(contentContainer);

            passInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (passInput.innerText.trim() === data[sec.passKey]) {
                        passContainer.style.display = 'none';
                        contentContainer.style.display = 'block';
                    } else {
                        passInput.innerText = '';
                        passInput.setAttribute('placeholder', 'パスワードが違います');
                        passInput.style.backgroundColor = '#ffcccc';
                    }
                }
            });
        } else {
            details.appendChild(contentContainer);
        }

        box.appendChild(details);
        container.appendChild(box);
    });
}

function renderStatusContent(containerElement, data) {
    if (!data.status) data.status = [];
    data.status.forEach((st, index) => {
        const row = document.createElement('div');
        row.className = 'param-row';

        const viewText = document.createElement('span');
        viewText.className = 'view-only-ui';
        viewText.style.color = "white";
        viewText.style.flex = "1";
        viewText.textContent = `${st.label}：${st.value} / ${st.max}`;

        const labelInput = document.createElement('div');
        labelInput.className = 'pass-input param-input-label edit-only-ui';
        labelInput.contentEditable = 'true';
        labelInput.innerHTML = st.label; // ▼ 修正：改行などを維持
        labelInput.addEventListener('input', (e) => st.label = e.target.innerHTML.trim());
        labelInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

        const valueInput = document.createElement('div');
        valueInput.className = 'pass-input param-input-value edit-only-ui';
        valueInput.contentEditable = 'true';
        valueInput.innerHTML = st.value; // ▼ 修正
        valueInput.style.textAlign = 'right';
        valueInput.addEventListener('input', (e) => st.value = e.target.innerHTML.trim());
        valueInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

        const separator = document.createElement('span');
        separator.textContent = " / ";
        separator.className = 'edit-only-ui';
        separator.style.color = "white";

        const maxInput = document.createElement('div');
        maxInput.className = 'pass-input param-input-value edit-only-ui';
        maxInput.contentEditable = 'true';
        maxInput.innerHTML = st.max; // ▼ 修正
        maxInput.addEventListener('input', (e) => st.max = e.target.innerHTML.trim());
        maxInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

        const delBtn = document.createElement('button');
        delBtn.textContent = "削除";
        delBtn.className = 'setting-btn edit-only-ui';
        delBtn.addEventListener('click', () => {
            data.status.splice(index, 1);
            renderSpecialSections();
            applyEditMode();
        });

        row.append(viewText, labelInput, valueInput, separator, maxInput, delBtn);
        containerElement.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = "ステータスを追加";
    addBtn.className = 'add-resource-btn edit-only-ui';
    addBtn.addEventListener('click', () => {
        data.status.push({ label: "NEW", value: "0", max: "0" });
        specialOpenStates.status = true;
        renderSpecialSections();
        applyEditMode();
    });
    containerElement.appendChild(addBtn);
}

function renderParamsContent(containerElement, data) {
    if (!data.params) data.params = [];
    data.params.forEach((param, index) => {
        const row = document.createElement('div');
        row.className = 'param-row';

        const viewText = document.createElement('span');
        viewText.className = 'view-only-ui';
        viewText.style.color = "white";
        viewText.style.flex = "1";
        viewText.textContent = `${param.label}：${param.value}`;

        const labelInput = document.createElement('div');
        labelInput.className = 'pass-input param-input-label edit-only-ui';
        labelInput.contentEditable = 'true';
        labelInput.innerHTML = param.label; // ▼ 修正
        labelInput.addEventListener('input', (e) => param.label = e.target.innerHTML.trim());
        labelInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

        const valueInput = document.createElement('div');
        valueInput.className = 'pass-input param-input-value edit-only-ui';
        valueInput.contentEditable = 'true';
        valueInput.innerHTML = param.value; // ▼ 修正
        valueInput.addEventListener('input', (e) => param.value = e.target.innerHTML.trim());
        valueInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

        const delBtn = document.createElement('button');
        delBtn.textContent = "削除";
        delBtn.className = 'setting-btn edit-only-ui';
        delBtn.addEventListener('click', () => {
            data.params.splice(index, 1);
            renderSpecialSections();
            applyEditMode();
        });

        row.append(viewText, labelInput, valueInput, delBtn);
        containerElement.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = "パラメータを追加";
    addBtn.className = 'add-resource-btn edit-only-ui';
    addBtn.addEventListener('click', () => {
        data.params.push({ label: "NEW", value: "0" });
        specialOpenStates.params = true;
        renderSpecialSections();
        applyEditMode();
    });
    containerElement.appendChild(addBtn);
}

function renderCommandsContent(containerElement, data) {
    const textDiv = document.createElement('div');
    textDiv.className = 'editable-area text-content';
    if (data.commands !== undefined) textDiv.innerHTML = data.commands; // ▼ 修正：改行を保持するためinnerHTMLに
    textDiv.oninput = (e) => { data.commands = e.target.innerHTML; };
    containerElement.appendChild(textDiv);
}

function renderMemoContent(containerElement, data) {
    const textDiv = document.createElement('div');
    textDiv.className = 'editable-area text-content';
    if (data.memo !== undefined) textDiv.innerHTML = data.memo; // ▼ 修正
    textDiv.oninput = (e) => { data.memo = e.target.innerHTML; };
    containerElement.appendChild(textDiv);
}

// === メモの描画 ===
function renderSheets(sheetsArray, parentElement, isRoot = true) {
    parentElement.innerHTML = ''; // ▼ 修正

    sheetsArray.forEach((sheet, index) => {
        let targetParent = parentElement;

        if (isRoot) {
            const box = document.createElement('div');
            box.className = 'chara-box';
            box.style.marginBottom = '2em';
            parentElement.appendChild(box);
            targetParent = box;
        }

        const details = document.createElement('details');

        if (sheet._isOpen) {
            details.open = true;
        }

        const summary = document.createElement('summary');
        const headerContainer = document.createElement('span');
        headerContainer.className = 'sheet-header-controls';
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.width = 'auto';

        const markSpan = document.createElement('span');
        markSpan.className = 'accordion-icon';

        details.addEventListener('toggle', () => {
            Object.defineProperty(sheet, '_isOpen', { value: details.open, writable: true, enumerable: false, configurable: true });
        });

        const titleSpan = document.createElement('span');
        titleSpan.className = 'sheet-title-text editable-area';
        titleSpan.innerHTML = sheet.name; // ▼ 修正
        titleSpan.oninput = (e) => { sheet.name = e.target.innerHTML; };

        titleSpan.addEventListener('click', (e) => {
            if (titleSpan.getAttribute('contenteditable') === 'true') e.preventDefault();
        });

        const lockSpan = document.createElement('span');
        if (sheet.pass) lockSpan.textContent = " [ロック中]";

        const settingBtn = document.createElement('button');
        settingBtn.textContent = "設定";
        settingBtn.className = "setting-btn edit-only-ui";
        settingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentTargetType = 'sheet';
            currentTargetSheet = sheet;
            currentTargetArray = sheetsArray;
            currentTargetIndex = index;
            modalPassInput.innerText = sheet.pass || "";
            document.getElementById('modal-delete-btn').style.display = 'block';
            settingsModal.style.display = 'flex';
        });

        headerContainer.append(markSpan, titleSpan, lockSpan, settingBtn);
        summary.appendChild(headerContainer);
        details.appendChild(summary);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'sheet-content-container';
        const whiteBox = document.createElement('div');
        whiteBox.className = 'sheet-text';

        const textDiv = document.createElement('div');
        textDiv.className = 'editable-area text-content';
        if (sheet.value !== undefined && sheet.value !== "") textDiv.innerHTML = sheet.value; // ▼ 修正
        textDiv.oninput = (e) => { sheet.value = e.target.innerHTML; };
        whiteBox.appendChild(textDiv);

        if (!sheet.field) sheet.field = [];
        const nestedContainer = document.createElement('div');
        nestedContainer.className = 'nested-field';
        if (sheet.field.length === 0) nestedContainer.classList.add('empty-nested');

        renderSheets(sheet.field, nestedContainer, false);

        whiteBox.appendChild(nestedContainer);
        contentContainer.appendChild(whiteBox);

        const isOwner = auth.currentUser && characterData && characterData.data.owner === auth.currentUser.uid;

        if (sheet.pass && !isOwner) {
            const passContainer = document.createElement('div');
            passContainer.className = 'password-container';

            const passInput = document.createElement('div');
            passInput.setAttribute('placeholder', 'パスワードを入力');
            passInput.className = 'pass-input';
            passInput.contentEditable = 'true';
            passInput.style.minHeight = '1.5em';
            passInput.style.cursor = 'text';

            passContainer.appendChild(passInput);
            details.appendChild(passContainer);

            contentContainer.style.display = 'none';
            details.appendChild(contentContainer);

            passInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (passInput.innerText.trim() === sheet.pass) {
                        passContainer.style.display = 'none';
                        contentContainer.style.display = 'block';
                    } else {
                        passInput.innerText = '';
                        passInput.setAttribute('placeholder', 'パスワードが違います');
                        passInput.style.backgroundColor = '#ffcccc';
                    }
                }
            });
        } else {
            details.appendChild(contentContainer);
        }

        targetParent.appendChild(details);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = "メモを追加";
    addBtn.className = isRoot ? "add-resource-btn edit-only-ui" : "edit-btn edit-only-ui";
    if (!isRoot) addBtn.style.marginTop = "10px";

    addBtn.addEventListener('click', () => {
        const newMemo = { name: "新規メモ", value: "", pass: null, field: [] };
        Object.defineProperty(newMemo, '_isOpen', { value: true, writable: true, enumerable: false, configurable: true });
        sheetsArray.push(newMemo);
        renderSheets(sheetsArray, parentElement, isRoot);
        applyEditMode();
        updateSheetsContainerVisibility();
    });

    parentElement.appendChild(addBtn);
}

// === プロフィール描画 ===
function renderProfile() {
    const data = characterData.data;
    document.getElementById('profile-container').style.display = 'block';

    const imgEl = document.getElementById('chara-image');
    const nameEl = document.getElementById('chara-name');
    const rubyEl = document.getElementById('chara-ruby');
    const imgInput = document.getElementById('chara-image-input');
    const privacySelect = document.getElementById('chara-privacy-select');

    if (data.iconUrl) imgEl.src = data.iconUrl;

    nameEl.className = 'editable-title editable-area';
    nameEl.innerHTML = data.name; // ▼ 修正
    rubyEl.innerHTML = data.ruby || ""; // ▼ 修正
    imgInput.innerText = data.iconUrl || ""; // 画像URLはタグを含まないのでinnerTextのまま

    privacySelect.value = data.privacy;
    privacySelect.onchange = (e) => { data.privacy = parseInt(e.target.value, 10); };

    nameEl.oninput = (e) => { data.name = e.target.innerHTML; }; // ▼ 修正
    rubyEl.oninput = (e) => { data.ruby = e.target.innerHTML; }; // ▼ 修正

    imgInput.oninput = (e) => {
        data.iconUrl = e.target.innerText.trim();
        imgEl.src = data.iconUrl;

        if (charaMarker && typeof updateMarkerPosition === 'function') {
            updateMarkerPosition(tempMapY, tempMapX);
        }
    };
    imgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
}

// === マイマップの描画と操作 ===
function renderMap() {
    const data = characterData.data;
    const x = parseFloat(data.x) || 0;
    const y = parseFloat(data.y) || 0;

    const hasCoords = (x !== 0 || y !== 0);
    tempMapX = x;
    tempMapY = y;

    const centerLat = hasCoords ? y : 35.6895;
    const centerLng = hasCoords ? x : 139.6917;

    if (!charaMap) {
        charaMap = L.map('chara-map', {
            zoomControl: false,
            attributionControl: false
        }).setView([centerLat, centerLng], hasCoords ? 10 : 5);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd'
        }).addTo(charaMap);

        charaMap.on('click', (e) => {
            if (document.getElementById('app-main').classList.contains('edit-mode')) {
                tempMapY = e.latlng.lat;
                tempMapX = e.latlng.lng;
                updateMarkerPosition(tempMapY, tempMapX);
            }
        });

        charaMap.on('zoomend', () => {
            if (charaMarker) updateMarkerPosition(tempMapY, tempMapX);
        });

        document.getElementById('map-details').addEventListener('toggle', function () {
            if (this.open) {
                setTimeout(() => { charaMap.invalidateSize(); }, 100);
            }
        });
    }

    if (hasCoords) {
        updateMarkerPosition(y, x);
    } else if (charaMarker) {
        charaMap.removeLayer(charaMarker);
        charaMarker = null;
    }
}

function updateMarkerPosition(lat, lng) {
    const iconUrl = characterData.data.iconUrl || '/assets/image/chara-image.png';
    const zoom = charaMap ? charaMap.getZoom() : 5;

    const size = Math.max(20, Math.min(120, zoom * 8));

    const customIcon = L.divIcon({
        className: 'custom-chara-icon',
        html: `<img src="${iconUrl}" onerror="this.src='/assets/image/chara-image.png'">`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });

    if (!charaMarker) {
        charaMarker = L.marker([lat, lng], { icon: customIcon }).addTo(charaMap);
    } else {
        charaMarker.setLatLng([lat, lng]);
        charaMarker.setIcon(customIcon);
    }
}

function updateSheetsContainerVisibility() {
    const isEditing = document.getElementById('app-main').classList.contains('edit-mode');
    const sheetsContainer = document.getElementById('sheets-container');
    if (characterData && characterData.data.sheets.length === 0 && !isEditing) {
        sheetsContainer.style.display = 'none';
    } else {
        sheetsContainer.style.display = 'block';
    }
}

// === 編集モード切替 ===
editBtn.addEventListener('click', async () => {
    const isEditing = mainElement.classList.toggle('edit-mode');

    if (isEditing) {
        editBtn.textContent = "保存";
        exportBtn.style.display = 'none';
        checkAndRender();
    } else {
        editBtn.textContent = "保存中...";
        applyEditMode();

        characterData.data.x = tempMapX;
        characterData.data.y = tempMapY;

        const baseData = getDefaultData(characterData.data.owner);
        characterData.data = { ...baseData, ...characterData.data };
        characterData.data.date = Date.now();

        try {
            await setDoc(doc(db, "characters", characterId), characterData);
            editBtn.textContent = "編集";
            exportBtn.style.display = 'block';
            alert("保存しました！");

            cachedMyCharacters = null;
            cachedPublicCharacters = null;

            checkAndRender();
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("保存に失敗しました。");
            editBtn.textContent = "保存";
            mainElement.classList.add('edit-mode');
            applyEditMode();
        }
    }
});

// === 認証・ログアウト ===
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
    mainElement.classList.remove('edit-mode');
    editBtn.textContent = "編集";
});

// === 新規作成 ===
createCharaBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("ログインが必要です");

    createCharaBtn.textContent = "作成中...";
    createCharaBtn.disabled = true;

    const defaultData = {
        kind: "character",
        data: getDefaultData(user.uid)
    };

    try {
        const docRef = await addDoc(collection(db, "characters"), defaultData);
        const myUrl = `${window.location.origin}${window.location.pathname}?id=${docRef.id}`;
        defaultData.data.externalUrl = myUrl;
        await setDoc(docRef, defaultData);
        alert("キャラクターを作成しました！");
        window.location.href = `?id=${docRef.id}`;
    } catch (error) {
        console.error("作成エラー:", error);
        alert("作成に失敗しました。");
        createCharaBtn.textContent = "キャラクターを作成";
        createCharaBtn.disabled = false;
    }
});

// === インポート ===
importCharaBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("ログインが必要です");

    try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText) return alert("クリップボードが空です。");

        let importedJson;
        try { importedJson = JSON.parse(clipboardText); }
        catch (e) { return alert("クリップボードの内容が正しいデータではありません。"); }

        if (importedJson.kind !== "character" || !importedJson.data) {
            return alert("ココフォリア互換のデータが見つかりませんでした。");
        }

        importCharaBtn.textContent = "読み込み中...";
        importCharaBtn.disabled = true;

        const baseData = getDefaultData(user.uid);
        const charaData = { ...baseData, ...importedJson.data };

        charaData.owner = user.uid;
        charaData.date = Date.now();
        charaData.privacy = 2;

        const docRef = await addDoc(collection(db, "characters"), {
            kind: "character",
            data: charaData
        });

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

// === モーダル ===
let currentTargetType = 'sheet';
let currentTargetPassKey = null;
let currentTargetSheet = null;
let currentTargetArray = null;
let currentTargetIndex = null;

const settingsModal = document.getElementById('settings-modal');
const modalPassInput = document.getElementById('modal-pass-input');

modalPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

document.getElementById('modal-cancel-btn').addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

document.getElementById('modal-save-btn').addEventListener('click', () => {
    const passVal = modalPassInput.innerText.trim();
    if (currentTargetType === 'sheet') {
        currentTargetSheet.pass = passVal !== "" ? passVal : null;
        renderSheets(characterData.data.sheets, container, true, false);
    } else if (currentTargetType === 'special') {
        characterData.data[currentTargetPassKey] = passVal !== "" ? passVal : null;
        renderSpecialSections();
    }

    settingsModal.style.display = 'none';
    applyEditMode();
});

document.getElementById('modal-delete-btn').addEventListener('click', () => {
    if (confirm("本当にこのメモを削除しますか？（内部のデータもすべて消えます）")) {
        currentTargetArray.splice(currentTargetIndex, 1);
        settingsModal.style.display = 'none';
        renderSheets(characterData.data.sheets, container, true, false);
        applyEditMode();
        updateSheetsContainerVisibility();
    }
});

// === 出力 ===
exportBtn.addEventListener('click', async () => {
    if (!characterData) return;
    try {
        const jsonText = JSON.stringify(characterData);
        await navigator.clipboard.writeText(jsonText);
        alert("ココフォリア用データをコピーしました！\nココフォリアの盤面を開き、「Ctrl + V（ペースト）」で出力できます。");
    } catch (err) {
        console.error("クリップボードコピーエラー:", err);
        alert("コピーに失敗しました。ブラウザのクリップボード権限を確認してください。");
    }
});

// === 検索 ===
let searchTimeout;
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadCharacterList(auth.currentUser ? auth.currentUser.uid : null);
    }, 500);
});

init();