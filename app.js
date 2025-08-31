/* =============================================================
   daugia.vin — app.js (v1)
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Token: VIN @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
   Library: ethers v5 UMD (window.ethers)
   Notes:
   - Read-only view works without wallet (public RPC).
   - Mutations require wallet, correct chain, and VIN allowance to contract.
   - All amounts in VND are plain integers (no decimals).
   ============================================================= */

// ---------- Constants ----------
const RPC_URL = "https://rpc.viction.xyz";
const EXPLORER = "https://vicscan.xyz";
const CHAIN_ID_DEC = 88;
const CHAIN_ID_HEX = "0x58";

const DAUGIA_ADDR = "0x1765e20ecB8cD78688417A6d4123f2b899775599";
const VIN_ADDR    = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";

// Minimal ABIs
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];

// DauGia ABI (minified) — inlined from uploaded file
const DAUGIA_ABI = [
  {"inputs":[{"internalType":"address","name":"vinToken_","type":"address"},{"internalType":"address","name":"feeReceiver_","type":"address"},{"internalType":"uint256","name":"platformFeeVIN_","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[],"name":"ALREADY_FINALIZED","type":"error"},
  {"inputs":[],"name":"AUCTION_ENDED","type":"error"},
  {"inputs":[],"name":"AUCTION_NOT_STARTED","type":"error"},
  {"inputs":[],"name":"BIDDER_NOT_WHITELISTED","type":"error"},
  {"inputs":[],"name":"BID_TOO_LOW","type":"error"},
  {"inputs":[],"name":"INVALID_TIME_ORDER","type":"error"},
  {"inputs":[],"name":"NOT_ORGANIZER","type":"error"},
  {"inputs":[],"name":"PLATFORM_FEE_REQUIRED","type":"error"},
  {"inputs":[],"name":"WHITELIST_CUTOFF","type":"error"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"organizer","type":"address"},{"indexed":false,"internalType":"string","name":"auctionDetailCID","type":"string"}],"name":"AuctionCreated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"reasonCode","type":"uint8"}],"name":"AuctionFailed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint256","name":"finalPriceVND","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"AuctionFinalized","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"bidder","type":"address"},{"indexed":false,"internalType":"uint256","name":"amountVND","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"BidPlaced","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"organizer","type":"address"},{"indexed":false,"internalType":"string","name":"profileCID","type":"string"}],"name":"OrganizerRegistered","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"organizer","type":"address"},{"indexed":false,"internalType":"address[]","name":"added","type":"address[]"},{"indexed":false,"internalType":"string[]","name":"uncProofCIDs","type":"string[]"}],"name":"WhitelistUpdated","type":"event"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"auctions","outputs":[{"internalType":"address","name":"organizer","type":"address"},{"internalType":"uint64","name":"startView","type":"uint64"},{"internalType":"uint64","name":"endView","type":"uint64"},{"internalType":"uint64","name":"depositStart","type":"uint64"},{"internalType":"uint64","name":"depositCutoff","type":"uint64"},{"internalType":"uint64","name":"auctionStart","type":"uint64"},{"internalType":"uint64","name":"auctionEnd","type":"uint64"},{"internalType":"uint256","name":"startingPriceVND","type":"uint256"},{"internalType":"uint256","name":"minIncrementVND","type":"uint256"},{"internalType":"uint256","name":"depositAmountVND","type":"uint256"},{"internalType":"uint256","name":"currentPriceVND","type":"uint256"},{"internalType":"address","name":"highestBidder","type":"address"},{"internalType":"bool","name":"finalized","type":"bool"},{"internalType":"bool","name":"failed","type":"bool"},{"internalType":"uint256","name":"whitelistCount","type":"uint256"},{"internalType":"string","name":"auctionDetailCID","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint64","name":"startView","type":"uint64"},{"internalType":"uint64","name":"endView","type":"uint64"},{"internalType":"uint64","name":"depositStart","type":"uint64"},{"internalType":"uint64","name":"depositCutoff","type":"uint64"},{"internalType":"uint64","name":"auctionStart","type":"uint64"},{"internalType":"uint64","name":"auctionEnd","type":"uint64"},{"internalType":"uint256","name":"startingPriceVND","type":"uint256"},{"internalType":"uint256","name":"minIncrementVND","type":"uint256"},{"internalType":"uint256","name":"depositAmountVND","type":"uint256"},{"internalType":"string","name":"auctionDetailCID","type":"string"}],"name":"createAuction","outputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"feeReceiver","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"name":"finalize","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"name":"getAuction","outputs":[{"internalType":"address","name":"organizer","type":"address"},{"internalType":"uint64","name":"startView","type":"uint64"},{"internalType":"uint64","name":"endView","type":"uint64"},{"internalType":"uint64","name":"depositStart","type":"uint64"},{"internalType":"uint64","name":"depositCutoff","type":"uint64"},{"internalType":"uint64","name":"auctionStart","type":"uint64"},{"internalType":"uint64","name":"auctionEnd","type":"uint64"},{"internalType":"uint256","name":"startingPriceVND","type":"uint256"},{"internalType":"uint256","name":"minIncrementVND","type":"uint256"},{"internalType":"uint256","name":"depositAmountVND","type":"uint256"},{"internalType":"uint256","name":"currentPriceVND","type":"uint256"},{"internalType":"address","name":"highestBidder","type":"address"},{"internalType":"bool","name":"finalized","type":"bool"},{"internalType":"bool","name":"failed","type":"bool"},{"internalType":"string","name":"auctionDetailCID","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"organizer","type":"address"}],"name":"getOrganizerAuctions","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"name":"getStatus","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"address","name":"bidder","type":"address"}],"name":"isWhitelistedBidder","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"profileCID","type":"string"}],"name":"registerOrganizer","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"uint256","name":"bidAmountVND","type":"uint256"}],"name":"placeBid","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"platformFeeVIN","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"address[]","name":"bidders","type":"address[]"},{"internalType":"string[]","name":"uncProofCIDs","type":"string[]"}],"name":"updateWhitelist","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// ---------- State ----------
let provider, signer, account;
let dauGia, vin;
let vinDecimals = 18; // will be loaded
let platformFeeVIN = null; // BigNumber

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

const el = {
  chainStatus: $("#chain-status"),
  btnAddNet: $("#btn-add-network"),
  btnConnect: $("#btn-connect"),
  platformFee: $("#platform-fee"),
  list: $("#auction-list"),
  // create drawer
  drawerCreate: $("#drawer-create"),
  btnOpenCreate: $("#btn-open-create"),
  btnCloseCreate: $("#btn-close-create"),
  btnCreate: $("#btn-create"),
  // whitelist drawer
  drawerWl: $("#drawer-whitelist"),
  btnUpdateWl: $("#btn-update-wl"),
  btnCloseWl: $("#btn-close-wl"),
  inpWlAuctionId: $("#wl-auction-id"),
  inpWlAddresses: $("#wl-addresses"),
  inpWlCids: $("#wl-cids"),
  // search
  inpOrganizer: $("#inp-organizer"),
  btnSearch: $("#btn-search"),
  btnClearSearch: $("#btn-clear-search"),
  btnOpenWatchlist: $("#btn-open-watchlist"),
  // bid modal
  modalBid: $("#modal-bid"),
  bidAuctionId: $("#bid-auction-id"),
  bidAmount: $("#bid-amount"),
  bidHint: $("#bid-hint"),
  btnConfirmBid: $("#btn-confirm-bid"),
  btnCancelBid: $("#btn-cancel-bid"),
  // toast
  toast: $("#toast"),
};

// ---------- Utils ----------
function showToast(msg, ms = 3000) {
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  setTimeout(() => el.toast.classList.add("hidden"), ms);
}
function fmt(v) {
  try {
    return new Intl.NumberFormat("vi-VN").format(v);
  } catch { return String(v); }
}
function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
function isAddr(a){ return /^0x[a-fA-F0-9]{40}$/.test(a || ""); }
function toUnix(dtInput) { // datetime-local -> seconds
  if (!dtInput) return 0;
  const dt = new Date(dtInput);
  return Math.floor(dt.getTime() / 1000);
}
function fromUnix(s) {
  if (!s) return "-";
  const d = new Date(Number(s) * 1000);
  return d.toLocaleString();
}
function statusBadge(code){
  return [
    {t:"PENDING", c:"warn"},
    {t:"ACTIVE", c:"success"},
    {t:"ENDED", c:""},
    {t:"FINALIZED", c:"success"},
    {t:"FAILED", c:"error"}
  ][code] || {t:"?", c:""};
}
function ipfsLink(cid){
  if(!cid) return "";
  if (cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.replace("ipfs://", "")}`;
  if (cid.startsWith("http")) return cid;
  return `https://ipfs.io/ipfs/${cid}`;
}

// ---------- Network ----------
async function ensureProvider() {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  } else {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }
  const net = await provider.getNetwork();
  const ok = Number(net.chainId) === CHAIN_ID_DEC;
  el.chainStatus.textContent = ok ? "OK" : `Sai mạng (${net.chainId})`;
  return ok;
}

async function addOrSwitchToVIC(){
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }]
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: "Viction Mainnet",
          nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER]
        }]
      });
    } else throw e;
  }
}

// ---------- Contracts ----------
async function initContracts(readOnly=false){
  if (!provider) await ensureProvider();
  signer = !readOnly && provider.getSigner ? provider.getSigner() : null;
  dauGia = new ethers.Contract(DAUGIA_ADDR, DAUGIA_ABI, signer || provider);
  vin = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer || provider);
  try {
    vinDecimals = await vin.decimals();
  } catch {}
}

// ---------- Wallet ----------
async function connectWallet(){
  if (!window.ethereum) {
    showToast("Không tìm thấy ví. Vui lòng cài MetaMask.");
    return;
  }
  await addOrSwitchToVIC();
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  account = await signer.getAddress();
  el.btnConnect.textContent = shortAddr(account);
  await initContracts(false);
  await refreshPlatformFee();
}

// ---------- Fees / Approvals ----------
async function refreshPlatformFee(){
  try {
    platformFeeVIN = await dauGia.platformFeeVIN();
    const sym = await vin.symbol().catch(()=>"VIN");
    const dec = vinDecimals || 18;
    const feeHuman = Number(ethers.utils.formatUnits(platformFeeVIN, dec));
    el.platformFee.textContent = `${feeHuman} ${sym}`;
  } catch(e){
    el.platformFee.textContent = "không đọc được";
  }
}

async function ensureAllowance(minRequired){
  if (!account) throw new Error("Chưa kết nối ví");
  const allowance = await vin.allowance(account, DAUGIA_ADDR);
  if (allowance.gte(minRequired)) return;
  const symbol = await vin.symbol().catch(()=>"VIN");
  const need = minRequired.sub(allowance);
  const tx = await vin.approve(DAUGIA_ADDR, minRequired);
  showToast(`Approve ${symbol}…`);
  await tx.wait();
}

// ---------- Read: Load auctions ----------
async function loadAllAuctions() {
  el.list.innerHTML = "";
  try {
    // totalAuctions is not in min ABI (read via raw call)
    const iface = new ethers.utils.Interface(["function totalAuctions() view returns (uint256)"]);
    const data = iface.encodeFunctionData("totalAuctions", []);
    const ret = await provider.call({ to: DAUGIA_ADDR, data });
    const [total] = iface.decodeFunctionResult("totalAuctions", ret);

    const ids = [];
    for (let i=1; i<=Number(total); i++) ids.push(i);

    for (const id of ids.reverse()) { // newest first
      const a = await dauGia.getAuction(id);
      renderAuctionCard(id, a);
    }
    if (ids.length === 0) {
      el.list.innerHTML = `<div class="card"><div class="muted">Chưa có cuộc đấu giá nào.</div></div>`;
    }
  } catch(e){
    console.error(e);
    el.list.innerHTML = `<div class="card"><div class="muted">Không tải được danh sách. Kiểm tra RPC/ABI.</div></div>`;
  }
}

function renderAuctionCard(id, a){
  const [organizer,startView,endView,depositStart,depositCutoff,auctionStart,auctionEnd,startingPriceVND,minIncrementVND,depositAmountVND,currentPriceVND,highestBidder,finalized,failed,detailCID] = a;
  const card = document.createElement("div");
  card.className = "card";

  const st = statusBadge(Number(/* getStatus is cheaper via view call */0));
  // We will query real status separately

  card.innerHTML = `
    <div class="card__title">Auction #${id}</div>
    <div class="card__row"><span>Organizer</span><span class="value">${shortAddr(organizer)}</span></div>
    <div class="card__row"><span>Thời gian phiên</span><span class="value">${fromUnix(auctionStart)} → ${fromUnix(auctionEnd)}</span></div>
    <div class="card__row"><span>Giá hiện tại</span><span class="value">${fmt(currentPriceVND)} VND</span></div>
    <div class="card__row"><span>Bước giá</span><span class="value">+${fmt(minIncrementVND)} VND</span></div>
    <div class="card__row"><span>Đặt cọc</span><span class="value">${fmt(depositAmountVND)} VND</span></div>
    <div class="card__row"><span>Chi tiết</span><span class="value"><a href="${ipfsLink(detailCID)}" target="_blank" rel="noopener">IPFS</a></span></div>
    <div class="card__row"><span>Dẫn đầu</span><span class="value">${highestBidder === ethers.constants.AddressZero ? "-" : shortAddr(highestBidder)}</span></div>
    <div class="card__row" id="status-${id}"><span>Trạng thái</span><span class="value"><span class="badge">đang tải…</span></span></div>
    <div class="card__actions">
      <button class="btn" data-act="watch" data-id="${id}">Theo dõi</button>
      <button class="btn btn-secondary" data-act="whitelist" data-id="${id}">Whitelist</button>
      <button class="btn btn-primary" data-act="bid" data-id="${id}" data-min="${ethers.BigNumber.from(currentPriceVND).add(minIncrementVND)}">Đặt giá</button>
      <button class="btn" data-act="finalize" data-id="${id}">Kết thúc</button>
      <a class="btn btn-ghost" href="${EXPLORER}/address/${DAUGIA_ADDR}?fromaddress=${organizer}" target="_blank" rel="noopener">Logs</a>
    </div>
  `;

  card.querySelectorAll("button").forEach(b => b.addEventListener("click", onCardAction));
  el.list.appendChild(card);

  // load status
  dauGia.getStatus(id).then(s => {
    const st = statusBadge(Number(s));
    const row = document.querySelector(`#status-${id} .value`);
    if (row) row.innerHTML = `<span class="badge ${st.c}">${st.t}</span>`;
  }).catch(()=>{});
}

function onCardAction(ev){
  const btn = ev.currentTarget;
  const id = Number(btn.getAttribute("data-id"));
  const act = btn.getAttribute("data-act");

  if (act === "watch") {
    toggleWatch(id);
  } else if (act === "whitelist") {
    openWhitelist(id);
  } else if (act === "bid") {
    openBid(id, btn.getAttribute("data-min"));
  } else if (act === "finalize") {
    finalizeAuction(id);
  }
}

// ---------- Watchlist ----------
function getWatch(){
  try { return JSON.parse(localStorage.getItem("watchlist-auctions") || "[]"); } catch { return []; }
}
function setWatch(arr){ localStorage.setItem("watchlist-auctions", JSON.stringify(arr)); }
function toggleWatch(id){
  const w = new Set(getWatch());
  if (w.has(id)) { w.delete(id); showToast(`Đã bỏ theo dõi #${id}`); }
  else { w.add(id); showToast(`Đã theo dõi #${id}`); }
  setWatch(Array.from(w));
}

// ---------- Drawers & Modals ----------
function openCreate(){ el.drawerCreate.classList.remove("hidden"); }
function closeCreate(){ el.drawerCreate.classList.add("hidden"); }
function openWhitelist(id){ el.drawerWl.classList.remove("hidden"); if (id) el.inpWlAuctionId.value = id; }
function closeWhitelist(){ el.drawerWl.classList.add("hidden"); }
function openBid(id, min){
  el.modalBid.classList.remove("hidden");
  el.bidAuctionId.value = id;
  if (min) el.bidHint.textContent = `Tối thiểu: ${fmt(ethers.BigNumber.from(min).toString())} VND`;
}
function closeBid(){ el.modalBid.classList.add("hidden"); }

// ---------- Actions (Tx) ----------
async function registerOrganizer(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  await refreshPlatformFee();
  await ensureAllowance(platformFeeVIN);
  const profileCID = ""; // optional
  const tx = await dauGia.registerOrganizer(profileCID);
  showToast("Đang gửi đăng ký…");
  await tx.wait();
  showToast("Đăng ký thành công.");
}

async function createAuction(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  const sv = toUnix($("#startView").value);
  const ev = toUnix($("#endView").value);
  const ds = toUnix($("#depositStart").value);
  const dc = toUnix($("#depositCutoff").value);
  const as = toUnix($("#auctionStart").value);
  const ae = toUnix($("#auctionEnd").value);
  const sp = ethers.BigNumber.from($("#startingPriceVND").value || 0);
  const mi = ethers.BigNumber.from($("#minIncrementVND").value || 0);
  const da = ethers.BigNumber.from($("#depositAmountVND").value || 0);
  const cid = $("#auctionDetailCID").value.trim();
  if (!mi.gt(0)) return showToast("Bước giá tối thiểu phải > 0");

  await refreshPlatformFee();
  await ensureAllowance(platformFeeVIN);

  const tx = await dauGia.createAuction(sv, ev, ds, dc, as, ae, sp, mi, da, cid);
  showToast("Đang tạo phiên…");
  await tx.wait();
  showToast("Tạo thành công.");
  closeCreate();
  await loadAllAuctions();
}

async function updateWhitelist(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  const id = Number(el.inpWlAuctionId.value);
  if (!id) return showToast("Nhập Auction ID");
  const addrs = el.inpWlAddresses.value.split(/\n|,|;/).map(s=>s.trim()).filter(Boolean);
  const cids  = el.inpWlCids.value.split(/\n|,|;/).map(s=>s.trim()).filter(Boolean);
  if (addrs.some(a=>!isAddr(a))) return showToast("Có địa chỉ không hợp lệ");

  await refreshPlatformFee();
  await ensureAllowance(platformFeeVIN);

  const tx = await dauGia.updateWhitelist(id, addrs, cids);
  showToast("Đang cập nhật whitelist…");
  await tx.wait();
  showToast("Cập nhật thành công.");
  closeWhitelist();
  await loadAllAuctions();
}

async function placeBid(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  const id = Number(el.bidAuctionId.value);
  const amt = $("#bid-amount").value.trim();
  if (!amt) return showToast("Nhập số tiền VND");

  await refreshPlatformFee();
  await ensureAllowance(platformFeeVIN);

  const tx = await dauGia.placeBid(id, ethers.BigNumber.from(amt));
  showToast("Đang gửi bid…");
  await tx.wait();
  showToast("Đặt giá thành công.");
  closeBid();
  await loadAllAuctions();
}

async function finalizeAuction(id){
  if (!account) return showToast("Vui lòng kết nối ví.");
  const tx = await dauGia.finalize(id);
  showToast("Đang kết thúc phiên…");
  await tx.wait();
  showToast("Đã công bố kết quả.");
  await loadAllAuctions();
}

// ---------- Search ----------
async function searchByOrganizer(){
  const addr = el.inpOrganizer.value.trim();
  if (!isAddr(addr)) return showToast("Nhập địa chỉ organizer hợp lệ");
  el.list.innerHTML = "";
  try {
    const ids = await dauGia.getOrganizerAuctions(addr);
    if (!ids || ids.length === 0) {
      el.list.innerHTML = `<div class=card><div class=muted>Không có phiên nào.</div></div>`;
      return;
    }
    for (const id of ids.slice().reverse()){
      const a = await dauGia.getAuction(id);
      renderAuctionCard(id, a);
    }
  } catch(e){
    console.error(e);
    showToast("Không tải được phiên theo organizer");
  }
}

// ---------- Events / Init ----------
window.addEventListener("load", async () => {
  const ok = await ensureProvider();
  await initContracts(true);
  await refreshPlatformFee();
  await loadAllAuctions();

  if (window.ethereum){
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  // Nav buttons
  el.btnAddNet.addEventListener("click", addOrSwitchToVIC);
  el.btnConnect.addEventListener("click", connectWallet);

  // Drawers
  el.btnOpenCreate.addEventListener("click", openCreate);
  el.btnCloseCreate.addEventListener("click", closeCreate);
  el.btnCreate.addEventListener("click", createAuction);

  el.btnCloseWl.addEventListener("click", closeWhitelist);
  el.btnUpdateWl.addEventListener("click", updateWhitelist);

  // Search
  el.btnSearch.addEventListener("click", searchByOrganizer);
  el.btnClearSearch.addEventListener("click", () => { el.inpOrganizer.value = ""; loadAllAuctions(); });

  // Bid modal
  el.btnCancelBid.addEventListener("click", closeBid);
  el.btnConfirmBid.addEventListener("click", placeBid);
});
