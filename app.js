/* =============================================================
   daugia.vin — app.js (v6)
   Synced with index.html (vin-price pill, 1 search field, follow list)
   and style.css (v6, dock footer, prominent buttons)

   Features:
   - Connect / Disconnect wallet (Viction, chainId 88)
   - Wallet chip: address + VIC & VIN balances (auto-refresh)
   - Register button only visible when: connected & NOT registered
   - Search auctions by organizer address
   - Follow organizers (localStorage) → filter auction list; clear to show all
   - Show platform fee (VIN)
   - Read-only auction cards with links (IPFS / Vicscan)
   ============================================================= */

// ---------- Chain/Contracts ----------
const RPC_URL = "https://rpc.viction.xyz";
const EXPLORER = "https://vicscan.xyz";
const CHAIN_ID_DEC = 88; // Viction mainnet
const CHAIN_ID_HEX = "0x58";

const DAUGIA_ADDR = "0x1765e20ecB8cD78688417A6d4123f2b899775599";
const VIN_ADDR    = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];

const DAUGIA_ABI = [
  {"inputs":[{"internalType":"address","name":"vinToken_","type":"address"},{"internalType":"address","name":"feeReceiver_","type":"address"},{"internalType":"uint256","name":"platformFeeVIN_","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"organizer","type":"address"},{"indexed":false,"internalType":"string","name":"profileCID","type":"string"}],"name":"OrganizerRegistered","type":"event"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"name":"getAuction","outputs":[{"internalType":"address","name":"organizer","type":"address"},{"internalType":"uint64","name":"startView","type":"uint64"},{"internalType":"uint64","name":"endView","type":"uint64"},{"internalType":"uint64","name":"depositStart","type":"uint64"},{"internalType":"uint64","name":"depositCutoff","type":"uint64"},{"internalType":"uint64","name":"auctionStart","type":"uint64"},{"internalType":"uint64","name":"auctionEnd","type":"uint64"},{"internalType":"uint256","name":"startingPriceVND","type":"uint256"},{"internalType":"uint256","name":"minIncrementVND","type":"uint256"},{"internalType":"uint256","name":"depositAmountVND","type":"uint256"},{"internalType":"uint256","name":"currentPriceVND","type":"uint256"},{"internalType":"address","name":"highestBidder","type":"address"},{"internalType":"bool","name":"finalized","type":"bool"},{"internalType":"bool","name":"failed","type":"bool"},{"internalType":"string","name":"auctionDetailCID","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"organizer","type":"address"}],"name":"getOrganizerAuctions","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"platformFeeVIN","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"profileCID","type":"string"}],"name":"registerOrganizer","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// ---------- State ----------
let provider, signer, account;
let dauGia, vin;
let vinDecimals = 18;
let platformFeeVIN = null; // BigNumber
let refreshTimer = null;
let cacheAuctions = []; // { id, a }

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const el = {
  // Header
  walletChip: $("#wallet-chip"),
  walletAddress: $("#wallet-address"),
  balVic: $("#bal-vic"),
  balVin: $("#bal-vin"),
  btnConnect: $("#btn-connect"),
  btnDisconnect: $("#btn-disconnect"),
  // Toolbar
  btnRegister: $("#btn-register"),
  inpOrganizer: $("#inp-organizer"),
  btnSearch: $("#btn-search"),
  inpFollow: $("#inp-follow"),
  btnFollowAdd: $("#btn-follow-add"),
  btnFollowClear: $("#btn-follow-clear"),
  followHint: $("#follow-hint"),
  // Sub-status & list
  filterPill: $("#filter-pill"),
  platformFee: $("#platform-fee"),
  list: $("#auction-list"),
  // Toast
  toast: $("#toast"),
};

// ---------- Utils ----------
function showToast(msg, ms = 3000){ if(!el.toast) return alert(msg); el.toast.textContent = msg; el.toast.classList.remove("hidden"); setTimeout(()=> el.toast.classList.add("hidden"), ms); }
function fmt(v){ try{return new Intl.NumberFormat("vi-VN").format(v)}catch{return String(v)} }
function shortAddr(a){ return a ? a.slice(0,6)+"…"+a.slice(-4) : "" }
function isAddr(a){ return /^0x[a-fA-F0-9]{40}$/.test(a||"") }
function fromUnix(s){ if(!s) return "-"; const d=new Date(Number(s)*1000); return d.toLocaleString(); }
function ipfsLink(cid){ if(!cid) return ""; if(cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.replace("ipfs://","")}`; if(cid.startsWith("http")) return cid; return `https://ipfs.io/ipfs/${cid}` }
function setHidden(node, yes){ if(!node) return; node.classList.toggle("hidden", !!yes); }

// ---------- Provider / Network ----------
async function ensureProvider(){
  provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum, "any") : new ethers.providers.JsonRpcProvider(RPC_URL);
  try { const net = await provider.getNetwork(); if (Number(net.chainId) !== CHAIN_ID_DEC) { /* just info; UI pill removed */ } } catch {}
}

async function addOrSwitchToVIC(){
  if (!window.ethereum) return;
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] }); }
  catch(e){ if (e.code === 4902){ await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN_ID_HEX, chainName: "Viction Mainnet", nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER] }] }); } else throw e; }
}

// ---------- Contracts ----------
async function initContracts(readOnly=true){
  if (!provider) await ensureProvider();
  signer = (!readOnly && provider.getSigner) ? provider.getSigner() : null;
  dauGia = new ethers.Contract(DAUGIA_ADDR, DAUGIA_ABI, signer || provider);
  vin    = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer || provider);
  try { vinDecimals = await vin.decimals(); } catch {}
}

// ---------- Wallet ----------
async function connectWallet(){
  if (!window.ethereum) return showToast("Không tìm thấy ví. Vui lòng cài MetaMask.");
  await addOrSwitchToVIC();
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  account = await signer.getAddress();
  if (el.walletAddress) el.walletAddress.textContent = shortAddr(account);
  setHidden(el.walletChip, false);
  setHidden(el.btnConnect, true);
  setHidden(el.btnDisconnect, false);
  await initContracts(false);
  await refreshPlatformFee();
  await refreshBalances();
  await refreshRegisterVisibility();
  startBalanceTimer();
}

function disconnectWallet(){
  // MetaMask không có API disconnect; ta chỉ reset UI/state phía client
  account = null; signer = null;
  setHidden(el.walletChip, true);
  setHidden(el.btnConnect, false);
  setHidden(el.btnDisconnect, true);
  if (el.btnRegister) setHidden(el.btnRegister, true);
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  showToast("Đã ngắt kết nối hiển thị.");
}

async function tryAutoConnect(){
  if (!window.ethereum) return;
  try {
    const accs = await window.ethereum.request({ method: "eth_accounts" });
    if (accs && accs[0]){
      provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      try { await addOrSwitchToVIC(); } catch {}
      signer = provider.getSigner();
      account = accs[0];
      if (el.walletAddress) el.walletAddress.textContent = shortAddr(account);
      setHidden(el.walletChip, false);
      setHidden(el.btnConnect, true);
      setHidden(el.btnDisconnect, false);
      await initContracts(false);
      await refreshPlatformFee();
      await refreshBalances();
      await refreshRegisterVisibility();
      startBalanceTimer();
    }
  } catch {}
}

// ---------- Balances & Fee ----------
async function refreshBalances(){
  if (!account || !provider) return;
  try { const vic = await provider.getBalance(account); const vicHuman = Number(ethers.utils.formatEther(vic)); if (el.balVic) el.balVic.textContent = `VIC: ${vicHuman.toLocaleString("en-US",{maximumFractionDigits:4})}`; } catch {}
  try { const balVin = await vin.balanceOf(account); const vinHuman = Number(ethers.utils.formatUnits(balVin, vinDecimals||18)); if (el.balVin) el.balVin.textContent = `VIN: ${vinHuman.toLocaleString("en-US",{maximumFractionDigits:4})}`; } catch {}
}
function startBalanceTimer(){ if (refreshTimer) clearInterval(refreshTimer); refreshTimer = setInterval(refreshBalances, 15000); }

async function refreshPlatformFee(){
  try { platformFeeVIN = await dauGia.platformFeeVIN(); const dec = vinDecimals||18; const fee = Number(ethers.utils.formatUnits(platformFeeVIN, dec)); if (el.platformFee) el.platformFee.textContent = `${fee} VIN`; } catch { if (el.platformFee) el.platformFee.textContent = "không đọc được"; }
}

// ---------- Registration visibility ----------
async function isRegistered(addr){
  // Kiểm tra có event OrganizerRegistered của địa chỉ này hay chưa
  try{
    const topic0 = ethers.utils.id("OrganizerRegistered(address,string)");
    const topicAddr = ethers.utils.hexZeroPad(addr, 32);
    const logs = await provider.getLogs({ address: DAUGIA_ADDR, fromBlock: 0, toBlock: "latest", topics: [topic0, topicAddr] });
    return logs.length > 0;
  }catch{ return false; }
}
async function refreshRegisterVisibility(){
  if (!el.btnRegister) return;
  if (!account) return setHidden(el.btnRegister, true);
  const reg = await isRegistered(account);
  setHidden(el.btnRegister, !!reg); // ẩn nếu đã đăng ký
}

// ---------- Follow list (organizers) ----------
function getFollow(){ try{ return JSON.parse(localStorage.getItem("follow-organizers")||"[]"); }catch{ return []; } }
function setFollow(arr){ localStorage.setItem("follow-organizers", JSON.stringify(arr)); }
function addFollow(addr){ if (!isAddr(addr)) return showToast("Địa chỉ không hợp lệ"); const s=new Set(getFollow()); s.add(addr.toLowerCase()); setFollow(Array.from(s)); updateFollowUI(); applyFiltersAndRender(); showToast("Đã theo dõi organizer"); }
function clearFollow(){ setFollow([]); updateFollowUI(); applyFiltersAndRender(); showToast("Đã xóa danh sách theo dõi"); }
function updateFollowUI(){ const list=getFollow(); if (el.followHint) el.followHint.textContent = list.length? `Đang theo dõi ${list.length} organizer` : "Chưa có ví theo dõi"; if (el.filterPill){ if (list.length){ el.filterPill.textContent = `Lọc: ${list.length} organizer`; setHidden(el.filterPill, false); } else { setHidden(el.filterPill, true); } } }

// ---------- Auctions (read) ----------
async function loadAllAuctions(){
  cacheAuctions = [];
  if (el.list) el.list.innerHTML = "";
  try{
    const iface = new ethers.utils.Interface(["function totalAuctions() view returns (uint256)"]);
    const data = iface.encodeFunctionData("totalAuctions", []);
    const ret  = await (provider||new ethers.providers.JsonRpcProvider(RPC_URL)).call({ to: DAUGIA_ADDR, data });
    const [total] = iface.decodeFunctionResult("totalAuctions", ret);
    const N = Number(total);
    for (let id=N; id>=1; id--){
      const a = await dauGia.getAuction(id);
      cacheAuctions.push({ id, a });
    }
  }catch(e){ console.error(e); if (el.list) el.list.innerHTML = `<div class=\"card\"><div class=\"muted\">Không tải được danh sách. Kiểm tra RPC/ABI.</div></div>`; }
  applyFiltersAndRender();
}

function applyFiltersAndRender(){
  if (!el.list) return;
  el.list.innerHTML = "";
  const follow = new Set(getFollow().map(x=>x.toLowerCase()));
  const hasFollow = follow.size > 0;

  let items = cacheAuctions.slice();
  if (hasFollow){ items = items.filter(({a}) => (a[0]||"").toLowerCase() && follow.has(String(a[0]).toLowerCase())); }

  if (items.length === 0){ el.list.innerHTML = `<div class=\"card\"><div class=\"muted\">Chưa có cuộc đấu giá nào.</div></div>`; return; }
  for (const {id,a} of items){ renderAuctionCard(id, a); }
}

function renderAuctionCard(id, a){
  const [organizer,startView,endView,depositStart,depositCutoff,auctionStart,auctionEnd,startingPriceVND,minIncrementVND,depositAmountVND,currentPriceVND,highestBidder,finalized,failed,auctionDetailCID] = a;
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class=\"card__title\">Auction #${id}</div>
    <div class=\"card__row\"><span>Organizer</span><span class=\"value\">${shortAddr(organizer)}</span></div>
    <div class=\"card__row\"><span>Thời gian phiên</span><span class=\"value\">${fromUnix(auctionStart)} → ${fromUnix(auctionEnd)}</span></div>
    <div class=\"card__row\"><span>Giá hiện tại</span><span class=\"value\">${fmt(currentPriceVND)} VND</span></div>
    <div class=\"card__row\"><span>Bước giá</span><span class=\"value\">+${fmt(minIncrementVND)} VND</span></div>
    <div class=\"card__row\"><span>Đặt cọc</span><span class=\"value\">${fmt(depositAmountVND)} VND</span></div>
    <div class=\"card__row\"><span>Chi tiết</span><span class=\"value\">${auctionDetailCID ? `<a href=\"${ipfsLink(auctionDetailCID)}\" target=\"_blank\" rel=\"noopener\">IPFS</a>` : '-'}</span></div>
    <div class=\"card__row\"><span>Explorer</span><span class=\"value\"><a href=\"${EXPLORER}/address/${DAUGIA_ADDR}\" target=\"_blank\" rel=\"noopener\">Vicscan</a></span></div>
  `;
  el.list.appendChild(card);
}

// ---------- Search ----------
async function searchByOrganizer(){
  const addr = (el.inpOrganizer?.value||"").trim();
  if (!isAddr(addr)) return showToast("Nhập địa chỉ ví người tạo hợp lệ");
  if (!el.list) return;
  el.list.innerHTML = "";
  try{
    const idsBn = await dauGia.getOrganizerAuctions(addr);
    const ids = idsBn.map(bn => Number(bn)).reverse();
    if (ids.length===0){ el.list.innerHTML = `<div class=\"card\"><div class=\"muted\">Không có phiên nào.</div></div>`; return; }
    for (const id of ids){ const a = await dauGia.getAuction(id); renderAuctionCard(id, a); }
  }catch(e){ console.error(e); showToast("Không tải được phiên theo organizer"); }
}

// ---------- Init ----------
window.addEventListener("load", async () => {
  await ensureProvider();
  await initContracts(true);
  await refreshPlatformFee();
  await loadAllAuctions();
  await tryAutoConnect();

  if (window.ethereum){
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  // Buttons
  el.btnConnect?.addEventListener("click", connectWallet);
  el.btnDisconnect?.addEventListener("click", disconnectWallet);
  el.btnRegister?.addEventListener("click", async () => {
    if (!account) return showToast("Vui lòng kết nối ví.");
    try{
      // Ensure allowance for platform fee
      const allowance = await vin.allowance(account, DAUGIA_ADDR);
      if (platformFeeVIN && allowance.lt(platformFeeVIN)){
        const tx1 = await vin.approve(DAUGIA_ADDR, platformFeeVIN);
        showToast("Đang approve VIN…");
        await tx1.wait();
      }
      const tx = await dauGia.registerOrganizer("");
      showToast("Đang gửi đăng ký…");
      await tx.wait();
      showToast("Đăng ký thành công.");
      await refreshRegisterVisibility();
    }catch(e){ console.error(e); showToast(e?.data?.message || e?.message || "Đăng ký thất bại"); }
  });

  el.btnSearch?.addEventListener("click", searchByOrganizer);
  el.btnFollowAdd?.addEventListener("click", () => addFollow(el.inpFollow?.value.trim()));
  el.btnFollowClear?.addEventListener("click", clearFollow);

  updateFollowUI();
});
