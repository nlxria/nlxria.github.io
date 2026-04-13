const version = "β";
const latest = { "ver": version, "uuid": crypto.randomUUID() };
function autoStorage(value) { localStorage.setItem("local", JSON.stringify(value)); };
if (!localStorage.hasOwnProperty("local")) { autoStorage(latest); };
var local = JSON.parse(localStorage.getItem("local"));
if (!local.ver || local.ver != version) { local = Object.assign(latest, local); local.ver = version; };
while (!local.name || local.name.length > 32) { local.name = window.prompt("ユーザー名"); };
autoStorage(local);