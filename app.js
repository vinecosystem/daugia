/* =============================================================
   daugia.vin — app.js (v2, minimal buttons)
   Đồng bộ với index.html (v2) & style.css (v2)
   Chức năng: Kết nối ví (Viction), Đăng ký (trả phí VIN do contract quy định),
   Tạo cuộc đấu giá, Tìm theo organizer, Thêm ví vào giỏ (localStorage),
   Hiển thị địa chỉ + số dư VIC/VIN sau khi kết nối.
   ============================================================= */

// ---------- Chain/Contracts ----------
const RPC_URL = "https://rpc.viction.xyz";
const EXPLORER = "https://vicscan.xyz";
const CHAIN_ID_DEC = 88; // Viction
const CHAIN_ID_HEX = "0x58";

const DAUGIA_ADDR = "0x1765e20ecB8cD78688417A6d4123f2b899775599";
const VIN_ADDR    = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];

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

let provider, signer, account;
let dauGia, vin;
let vinDecimals = 18;
let platformFeeVIN = null; // BigNumber

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const el = {
  chainStatus: $("#chain-status"),
  btnConnect: $("#btn-connect"),
  walletChip: $("#wallet-chip"),
  walletAddress: $("#wallet-address"),
  balVic: $("#bal-vic"),
  balVin: $("#bal-vin"),
  // actions
  btnRegister: $("#btn-register"),
  btnOpenCreate: $("#btn-open-create"),
  btnCreate: $("#btn-create"),
  btnCloseCreate: $("#btn-close-create"),
  // inputs
  inpOrganizer: $("#inp-organizer"),
  btnSearch: $("#btn-search"),
  inpBasket: $("#inp-basket"),
  btnAddBasket: $("#btn-add-basket"),
  // render
  list: $("#auction-list"),
  drawerCreate: $("#drawer-create"),
  // toast
  toast: $("#toast"),
};

// ---------- Utils ----------
function showToast(msg, ms = 3000) {
  if (!el.toast) return alert(msg);
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  setTimeout(() => el.toast.classList.add("hidden"), ms);
}
function fmt(v) { try { return new Intl.NumberFormat("vi-VN").format(v); } catch { return String(v); } }
function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
function isAddr(a){ return /^0x[a-fA-F0-9]{40}$/.test(a || ""); }
function toUnix(dtInput) { if (!dtInput) return 0; const dt = new Date(dtInput); return Math.floor(dt.getTime() / 1000); }
function fromUnix(s) { if (!s) return "-"; const d = new Date(Number(s) * 1000); return d.toLocaleString(); }
function ipfsLink(cid){ if(!cid) return ""; if (cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.replace("ipfs://", "")}`; if (cid.startsWith("http")) return cid; return `https://ipfs.io/ipfs/${cid}`; }

function showWalletChip(show) { if (!el.walletChip) return; el.walletChip.classList.toggle("hidden", !show); }

// ---------- Provider / Network ----------
async function ensureProvider() {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  } else {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }
  const net = await provider.getNetwork();
  const ok = Number(net.chainId) === CHAIN_ID_DEC;
  if (el.chainStatus) el.chainStatus.textContent = ok ? "OK" : `Sai mạng (${net.chainId})`;
  return ok;
}

async function addOrSwitchToVIC(){
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
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
  vin    = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer || provider);
  try { vinDecimals = await vin.decimals(); } catch {}
}

// ---------- Wallet ----------
async function connectWallet(){
  if (!window.ethereum) return showToast("Không tìm thấy ví. Vui lòng cài MetaMask.");
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await addOrSwitchToVIC();
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    account = await signer.getAddress();

    // rebind contracts with signer
    await initContracts(false);

    if (el.btnConnect) el.btnConnect.textContent = shortAddr(account);
    if (el.walletAddress) el.walletAddress.textContent = shortAddr(account);
    showWalletChip(true);

    await refreshBalances();
  } catch (e) {
    console.error(e);
    showToast(e?.message || "Kết nối ví thất bại.");
  }
}

async function tryAutoConnect(){
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts && accounts[0]) {
      provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      try { await addOrSwitchToVIC(); } catch {}
      signer = provider.getSigner();
      account = accounts[0];
      await initContracts(false);
      if (el.btnConnect) el.btnConnect.textContent = shortAddr(account);
      if (el.walletAddress) el.walletAddress.textContent = shortAddr(account);
      showWalletChip(true);
      await refreshBalances();
    }
  } catch (e) { console.warn("tryAutoConnect", e); }
}

async function refreshBalances(){
  if (!account || !provider) return;
  try {
    const vicBal = await provider.getBalance(account);
    const vicHuman = Number(ethers.utils.formatEther(vicBal));
    if (el.balVic) el.balVic.textContent = `VIC: ${vicHuman.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  } catch {}
  try {
    const vinBal = await vin.balanceOf(account);
    const vinHuman = Number(ethers.utils.formatUnits(vinBal, vinDecimals || 18));
    if (el.balVin) el.balVin.textContent = `VIN: ${vinHuman.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  } catch {}
}

// ---------- Fees / Approvals ----------
async function refreshPlatformFee(){
  try { platformFeeVIN = await dauGia.platformFeeVIN(); } catch {}
}

async function ensureAllowance(minRequired){
  if (!account) throw new Error("Chưa kết nối ví");
  if (!minRequired) return; // nothing to check
  const allowance = await vin.allowance(account, DAUGIA_ADDR);
  if (allowance.gte(minRequired)) return;
  const tx = await vin.approve(DAUGIA_ADDR, minRequired);
  showToast("Đang approve VIN…");
  await tx.wait();
}

// ---------- Auctions (read-only list) ----------
async function loadAllAuctions() {
  if (!el.list) return;
  el.list.innerHTML = "";
  try {
    // totalAuctions() — read via raw call to keep ABI min
    const iface = new ethers.utils.Interface(["function totalAuctions() view returns (uint256)"]);
    const data = iface.encodeFunctionData("totalAuctions", []);
    const ret = await (provider || new ethers.providers.JsonRpcProvider(RPC_URL)).call({ to: DAUGIA_ADDR, data });
    const [total] = iface.decodeFunctionResult("totalAuctions", ret);

    const ids = [];
    for (let i=1; i<=Number(total); i++) ids.push(i);

    for (const id of ids.reverse()) {
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
  card.innerHTML = `
    <div class="card__title">Auction #${id}</div>
    <div class="card__row"><span>Organizer</span><span class="value">${shortAddr(organizer)}</span></div>
    <div class="card__row"><span>Thời gian phiên</span><span class="value">${fromUnix(auctionStart)} → ${fromUnix(auctionEnd)}</span></div>
    <div class="card__row"><span>Giá hiện tại</span><span class="value">${fmt(currentPriceVND)} VND</span></div>
    <div class="card__row"><span>Bước giá</span><span class="value">+${fmt(minIncrementVND)} VND</span></div>
    <div class="card__row"><span>Đặt cọc</span><span class="value">${fmt(depositAmountVND)} VND</span></div>
    <div class="card__row"><span>Chi tiết</span><span class="value">${detailCID ? `<a href="${ipfsLink(detailCID)}" target="_blank" rel="noopener">IPFS</a>` : '-'}</span></div>
    <div class="card__row"><span>Explorer</span><span class="value"><a href="${EXPLORER}/address/${DAUGIA_ADDR}" target="_blank" rel="noopener">Vicscan</a></span></div>
  `;
  el.list.appendChild(card);
}

// ---------- Actions ----------
async function registerOrganizer(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  await refreshPlatformFee();
  await ensureAllowance(platformFeeVIN);
  const profileCID = ""; // tùy chọn
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

function openCreate(){ el.drawerCreate?.classList.remove("hidden"); }
function closeCreate(){ el.drawerCreate?.classList.add("hidden"); }

async function searchByOrganizer(){
  const addr = el.inpOrganizer?.value.trim();
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
  } catch(e){ console.error(e); showToast("Không tải được phiên theo organizer"); }
}

// Giỏ địa chỉ ví (localStorage)
function getBasket(){ try { return JSON.parse(localStorage.getItem("basket-wallets")||"[]"); } catch { return []; } }
function setBasket(arr){ localStorage.setItem("basket-wallets", JSON.stringify(arr)); }
function addBasketAddress(){
  const addr = el.inpBasket?.value.trim();
  if (!isAddr(addr)) return showToast("Địa chỉ ví không hợp lệ");
  const set = new Set(getBasket());
  set.add(addr.toLowerCase());
  setBasket(Array.from(set));
  showToast("Đã thêm ví vào giỏ");
  el.inpBasket.value = "";
}

// ---------- Init ----------
window.addEventListener("load", async () => {
  await ensureProvider();
  await initContracts(true);
  await loadAllAuctions();
  await tryAutoConnect();

  if (window.ethereum){
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  // Buttons
  el.btnConnect?.addEventListener("click", connectWallet);
  el.btnRegister?.addEventListener("click", registerOrganizer);
  el.btnOpenCreate?.addEventListener("click", openCreate);
  el.btnCloseCreate?.addEventListener("click", closeCreate);
  el.btnCreate?.addEventListener("click", createAuction);
  el.btnSearch?.addEventListener("click", searchByOrganizer);
  el.btnAddBasket?.addEventListener("click", addBasketAddress);

  // refresh số dư định kỳ
  setInterval(refreshBalances, 15000);
});
