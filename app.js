/* =============================================================
   daugia.vin — app.js (v11, fixed connect + USD fee + gas-safe)
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Token: VIN @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
   Library: ethers v5 UMD (window.ethers)
   ============================================================= */

/* ---------------- Constants ---------------- */
const RPC_URL = "https://rpc.viction.xyz";
const EXPLORER = "https://vicscan.xyz";
const CHAIN_ID_HEX = "0x58"; // 88
const DAUGIA_ADDR = "0x1765e20ecB8cD78688417A6d4123f2b899775599";
const VIN_ADDR    = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";
const BINANCE_API_URL = "https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT"; // 1 VIN ≈ VIC * 100 (USD)

/* ---------------- ABIs ---------------- */
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];

const DAUGIA_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"organizer","type":"address"},{"indexed":false,"internalType":"string","name":"profileCID","type":"string"}],"name":"OrganizerRegistered","type":"event"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"name":"getAuction","outputs":[
    {"internalType":"address","name":"organizer","type":"address"},
    {"internalType":"uint64","name":"startView","type":"uint64"},
    {"internalType":"uint64","name":"endView","type":"uint64"},
    {"internalType":"uint64","name":"depositStart","type":"uint64"},
    {"internalType":"uint64","name":"depositCutoff","type":"uint64"},
    {"internalType":"uint64","name":"auctionStart","type":"uint64"},
    {"internalType":"uint64","name":"auctionEnd","type":"uint64"},
    {"internalType":"uint256","name":"startingPriceVND","type":"uint256"},
    {"internalType":"uint256","name":"minIncrementVND","type":"uint256"},
    {"internalType":"uint256","name":"depositAmountVND","type":"uint256"},
    {"internalType":"uint256","name":"currentPriceVND","type":"uint256"},
    {"internalType":"address","name":"highestBidder","type":"address"},
    {"internalType":"bool","name":"finalized","type":"bool"},
    {"internalType":"bool","name":"failed","type":"bool"},
    {"internalType":"string","name":"auctionDetailCID","type":"string"}
  ],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"organizer","type":"address"}],"name":"getOrganizerAuctions","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"platformFeeVIN","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"profileCID","type":"string"}],"name":"registerOrganizer","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

/* ---------------- State ---------------- */
let provider, signer, account;
let dauGia, vin;
let vinDecimals = 18;
let cacheAuctions = [];
let balanceTimer = null;

/* ---------------- DOM ---------------- */
const $ = (s) => document.querySelector(s);
const el = {
  // header/menu
  btnConnect: $("#btn-connect"),
  btnDisconnect: $("#btn-disconnect"),
  walletChip: $("#wallet-chip"),
  walletAddress: $("#wallet-address"),
  balVic: $("#bal-vic"),
  balVin: $("#bal-vin"),
  btnRegister: $("#btn-register"),
  menuCreate: $("#menu-create"),
  // search + list
  inpOrganizer: $("#inp-organizer"),
  btnSearch: $("#btn-search"),
  btnFollowAdd: $("#btn-follow-add"),
  btnFollowClear: $("#btn-follow-clear"),
  list: $("#auction-list"),
  // toast
  toast: $("#toast"),
};

/* ---------------- Utils ---------------- */
function showToast(msg, ms = 2600){
  if (!el.toast){ alert(msg); return; }
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  setTimeout(()=> el.toast.classList.add("hidden"), ms);
}
function fmt(v){ try { return new Intl.NumberFormat("vi-VN").format(v); } catch { return String(v); } }
function shortAddr(a){ return a ? `${a.slice(0,6)}…${a.slice(-4)}` : ""; }
function isAddr(a){ return /^0x[a-fA-F0-9]{40}$/.test(a || ""); }
function fromUnix(s){ if(!s) return "-"; const d=new Date(Number(s)*1000); return d.toLocaleString(); }
function ipfsLink(cid){ if (!cid) return ""; if (cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.replace("ipfs://","")}`; if (cid.startsWith("http")) return cid; return `https://ipfs.io/ipfs/${cid}`; }
function setHidden(node, yes){ if(node) node.classList.toggle("hidden", !!yes); }

/* ---------------- Provider / Network ---------------- */
async function ensureProvider(){
  provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum, "any")
                             : new ethers.providers.JsonRpcProvider(RPC_URL);
}
async function addOrSwitchToVIC(){
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: CHAIN_ID_HEX }] });
  } catch(e){
    if (e.code === 4902){
      await window.ethereum.request({
        method:"wallet_addEthereumChain",
        params:[{ chainId: CHAIN_ID_HEX, chainName:"Viction Mainnet",
          nativeCurrency:{ name:"VIC", symbol:"VIC", decimals:18 },
          rpcUrls:[RPC_URL], blockExplorerUrls:[EXPLORER] }]
      });
    } else { throw e; }
  }
}

/* ---------------- Contracts ---------------- */
async function initContracts(readOnly=true){
  if (!provider) await ensureProvider();
  signer = (!readOnly && provider.getSigner) ? provider.getSigner() : null;
  dauGia = new ethers.Contract(DAUGIA_ADDR, DAUGIA_ABI, signer || provider);
  vin    = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer || provider);
  try { vinDecimals = await vin.decimals(); } catch {}
}

/* ---------------- Gas helpers ---------------- */
async function buildGasOverrides(contract, method, args){
  const fee = await provider.getFeeData();
  const ov = {};
  if (fee.maxFeePerGas) {
    ov.maxFeePerGas = ethers.BigNumber.from(fee.maxFeePerGas).mul(125).div(100); // +25%
    ov.maxPriorityFeePerGas = ethers.BigNumber.from(fee.maxPriorityFeePerGas || "1500000000").mul(125).div(100);
  } else if (fee.gasPrice) {
    ov.gasPrice = ethers.BigNumber.from(fee.gasPrice).mul(125).div(100); // +25%
  }
  try {
    const est = await contract.estimateGas[method](...args, ov);
    ov.gasLimit = est.mul(150).div(100); // +50%
  } catch {
    ov.gasLimit = ethers.BigNumber.from(600000);
  }
  return ov;
}

/* ---------------- Wallet ---------------- */
async function connectWallet(){
  try{
    if (!window.ethereum) return showToast("Không tìm thấy ví. Vui lòng cài MetaMask.");
    await ensureProvider();
    await addOrSwitchToVIC();
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    account = await signer.getAddress();

    setHidden(el.btnConnect, true);
    setHidden(el.btnDisconnect, false);
    setHidden(el.walletChip, false);
    if (el.walletAddress) el.walletAddress.textContent = shortAddr(account);

    await initContracts(false);
    await refreshBalances();
    startBalanceTimer();
    await refreshRegistrationUI();
  }catch(e){
    console.error(e);
    showToast(e?.message || "Không kết nối được ví");
  }
}
function disconnectWallet(){
  account = null; signer = null;
  setHidden(el.walletChip, true);
  setHidden(el.btnConnect, false);
  setHidden(el.btnDisconnect, true);
  setHidden(el.btnRegister, true);
  setHidden(el.menuCreate, true);
  stopBalanceTimer();
  showToast("Đã ngắt kết nối hiển thị.");
}
async function tryAutoConnect(){
  if (!window.ethereum) return;
  try{
    const accs = await window.ethereum.request({ method:"eth_accounts" });
    if (accs && accs[0]){
      provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      try { await addOrSwitchToVIC(); } catch {}
      signer = provider.getSigner();
      account = accs[0];

      setHidden(el.btnConnect, true);
      setHidden(el.btnDisconnect, false);
      setHidden(el.walletChip, false);
      if (el.walletAddress) el.walletAddress.textContent = shortAddr(account);

      await initContracts(false);
      await refreshBalances();
      startBalanceTimer();
      await refreshRegistrationUI();
    }
  }catch{}
}

/* ---------------- Balances ---------------- */
function stopBalanceTimer(){ if (balanceTimer){ clearInterval(balanceTimer); balanceTimer = null; } }
function startBalanceTimer(){ stopBalanceTimer(); balanceTimer = setInterval(refreshBalances, 15000); }
async function refreshBalances(){
  if (!account || !provider) return;
  try {
    const vic = await provider.getBalance(account);
    const vicHuman = Number(ethers.utils.formatEther(vic));
    if (el.balVic) el.balVic.textContent = `VIC: ${vicHuman.toLocaleString("en-US",{maximumFractionDigits:4})}`;
  } catch {}
  try {
    const balVin = await vin.balanceOf(account);
    const vinHuman = Number(ethers.utils.formatUnits(balVin, vinDecimals||18));
    if (el.balVin) el.balVin.textContent = `VIN: ${vinHuman.toLocaleString("en-US",{maximumFractionDigits:4})}`;
  } catch {}
}

/* ---------------- Registration visibility ---------------- */
async function isRegistered(addr){
  try{
    const topic0 = ethers.utils.id("OrganizerRegistered(address,string)");
    const topicAddr = ethers.utils.hexZeroPad(addr, 32);
    const logs = await provider.getLogs({ address: DAUGIA_ADDR, fromBlock: 0, toBlock: "latest", topics: [topic0, topicAddr] });
    return logs.length > 0;
  }catch{ return false; }
}
async function refreshRegistrationUI(){
  if (!account){ setHidden(el.btnRegister, true); setHidden(el.menuCreate, true); return; }
  const reg = await isRegistered(account);
  setHidden(el.btnRegister, !!reg);  // hiện nếu CHƯA đăng ký
  setHidden(el.menuCreate, !reg);    // hiện nếu ĐÃ đăng ký
}

/* ---------------- Price → 1 USD in VIN ---------------- */
async function fetchVinUsdPrice(){ // returns { vinUsd:number }
  const res = await fetch(BINANCE_API_URL, { cache:"no-store" });
  const data = await res.json();
  const vic = parseFloat(data?.price);
  if (!Number.isFinite(vic) || vic <= 0) throw new Error("Giá VIC không hợp lệ");
  const vinUsd = vic * 100; // 1 VIN = VIC*100 USD
  return { vinUsd };
}
function calcOneUsdInVinUnits(vinUsd, decimals){
  // units = ceil(10^decimals / vinUsd) ; +5% biên
  const D = BigInt(decimals);
  const TENP = BigInt(10) ** D;
  const SCALE = 100000000n;
  const vinUsdScaled = BigInt(Math.round(vinUsd * Number(SCALE)));
  if (vinUsdScaled <= 0n) throw new Error("vinUsdScaled <= 0");
  const units = (TENP * SCALE + vinUsdScaled - 1n) / vinUsdScaled; // ceil
  const unitsSafe = (units * 105n) / 100n; // +5%
  return ethers.BigNumber.from(unitsSafe.toString());
}
async function oneUsdVinAmountBN(){
  const { vinUsd } = await fetchVinUsdPrice();
  return calcOneUsdInVinUnits(vinUsd, vinDecimals || 18);
}

/* ---------------- Fees / Approvals ---------------- */
async function ensureAllowanceAtLeast(requiredBN){
  if (!account) throw new Error("Chưa kết nối ví");
  const allowance = await vin.allowance(account, DAUGIA_ADDR);
  if (allowance.gte(requiredBN)) return;
  const ov = await buildGasOverrides(vin, "approve", [DAUGIA_ADDR, requiredBN]);
  const tx = await vin.approve(DAUGIA_ADDR, requiredBN, ov);
  showToast("Đang approve VIN…");
  await tx.wait();
}

/* ---------------- Registration (≈1 USD in VIN) ---------------- */
async function handleRegister(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  try{
    // 1) Số VIN ≈ 1 USD (biên +5%), so với platformFeeVIN on-chain (lấy max)
    let required = await oneUsdVinAmountBN();
    try{
      const feeOnChain = await dauGia.platformFeeVIN();
      if (feeOnChain.gt(required)) required = feeOnChain;
    }catch{}

    // 2) đảm bảo allowance
    await ensureAllowanceAtLeast(required);

    // 3) gọi registerOrganizer với gas overrides
    const args = ["" /* profileCID optional */];
    const ov = await buildGasOverrides(dauGia, "registerOrganizer", args);
    const tx = await dauGia.registerOrganizer(...args, ov);
    showToast("Đang gửi đăng ký…");
    await tx.wait();

    // 4) UI
    showToast("Đăng ký thành công.");
    await refreshRegistrationUI();
  }catch(e){
    console.error(e);
    showToast(e?.data?.message || e?.message || "Đăng ký thất bại");
  }
}

/* ---------------- Auctions (read-only) ---------------- */
async function loadAllAuctions(){
  cacheAuctions = [];
  if (el.list) el.list.innerHTML = "";
  try{
    // totalAuctions() qua raw call (ABI rút gọn)
    const iface = new ethers.utils.Interface(["function totalAuctions() view returns (uint256)"]);
    const data  = iface.encodeFunctionData("totalAuctions", []);
    const ret   = await (provider || new ethers.providers.JsonRpcProvider(RPC_URL)).call({ to: DAUGIA_ADDR, data });
    const [total] = iface.decodeFunctionResult("totalAuctions", ret);
    const N = Number(total);
    for (let id = N; id >= 1; id--){
      const a = await dauGia.getAuction(id);
      cacheAuctions.push({ id, a });
    }
  }catch(e){
    console.error(e);
    if (el.list) el.list.innerHTML = `<div class="card"><div class="muted">Không tải được danh sách. Kiểm tra RPC/ABI.</div></div>`;
  }
  applyFiltersAndRender();
}

function renderAuctionCard(id, a){
  const [
    organizer, startView, endView, depositStart, depositCutoff,
    auctionStart, auctionEnd, startingPriceVND, minIncrementVND,
    depositAmountVND, currentPriceVND, highestBidder, finalized, failed,
    auctionDetailCID
  ] = a;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card__title">Auction #${id}</div>
    <div class="card__row"><span>Organizer</span><span class="value">${shortAddr(organizer)}</span></div>
    <div class="card__row"><span>Thời gian phiên</span><span class="value">${fromUnix(auctionStart)} → ${fromUnix(auctionEnd)}</span></div>
    <div class="card__row"><span>Giá hiện tại</span><span class="value">${fmt(currentPriceVND)} VND</span></div>
    <div class="card__row"><span>Bước giá</span><span class="value">+${fmt(minIncrementVND)} VND</span></div>
    <div class="card__row"><span>Đặt cọc</span><span class="value">${fmt(depositAmountVND)} VND</span></div>
    <div class="card__row"><span>Chi tiết</span><span class="value">${auctionDetailCID ? `<a href="${ipfsLink(auctionDetailCID)}" target="_blank" rel="noopener">IPFS</a>` : '-'}</span></div>
    <div class="card__row"><span>Explorer</span><span class="value"><a href="${EXPLORER}/address/${DAUGIA_ADDR}" target="_blank" rel="noopener">Vicscan</a></span></div>
  `;
  el.list.appendChild(card);
}

function applyFiltersAndRender(){
  if (!el.list) return;
  el.list.innerHTML = "";
  const followSet = new Set((JSON.parse(localStorage.getItem("follow-organizers") || "[]")).map(s=>s.toLowerCase()));
  const hasFollow = followSet.size > 0;

  let items = cacheAuctions.slice();
  if (hasFollow){
    items = items.filter(({a}) => (String(a[0]||"").toLowerCase()) && followSet.has(String(a[0]).toLowerCase()));
  }

  if (items.length === 0){
    el.list.innerHTML = `<div class="card"><div class="muted">Chưa có cuộc đấu giá nào.</div></div>`;
    return;
  }
  for (const {id, a} of items){ renderAuctionCard(id, a); }
}

/* ---------------- Search & Follow ---------------- */
async function searchByOrganizer(){
  const addr = (el.inpOrganizer?.value || "").trim();
  if (!isAddr(addr)) return showToast("Nhập địa chỉ ví người tạo hợp lệ");
  if (!el.list) return;
  el.list.innerHTML = "";
  try{
    const idsBn = await dauGia.getOrganizerAuctions(addr);
    const ids = idsBn.map(bn => Number(bn)).reverse();
    if (ids.length === 0){
      el.list.innerHTML = `<div class="card"><div class="muted">Không có phiên nào.</div></div>`;
      return;
    }
    for (const id of ids){
      const a = await dauGia.getAuction(id);
      renderAuctionCard(id, a);
    }
  }catch(e){
    console.error(e);
    showToast("Không tải được phiên theo organizer");
  }
}
function addFollowFromInput(){
  const addr = (el.inpOrganizer?.value || "").trim();
  if (!isAddr(addr)) return showToast("Nhập địa chỉ organizer hợp lệ");
  const s = new Set(JSON.parse(localStorage.getItem("follow-organizers") || "[]"));
  s.add(addr.toLowerCase());
  localStorage.setItem("follow-organizers", JSON.stringify(Array.from(s)));
  showToast("Đã theo dõi organizer");
  applyFiltersAndRender();
}
function clearFollow(){
  localStorage.removeItem("follow-organizers");
  showToast("Đã xóa danh sách theo dõi");
  applyFiltersAndRender();
}

/* ---------------- Init ---------------- */
window.addEventListener("load", async () => {
  await ensureProvider();
  await initContracts(true);
  await loadAllAuctions();

  if (window.ethereum){
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  // Header/menu events (null-safe)
  el.btnConnect?.addEventListener("click", connectWallet);
  el.btnDisconnect?.addEventListener("click", disconnectWallet);
  el.btnRegister?.addEventListener("click", handleRegister);
  el.menuCreate?.addEventListener("click", (e)=>{ e.preventDefault(); showToast("Tạo cuộc đấu giá: sẽ mở ở bản kế tiếp."); });

  // Search & Follow
  el.btnSearch?.addEventListener("click", searchByOrganizer);
  el.btnFollowAdd?.addEventListener("click", addFollowFromInput);
  el.btnFollowClear?.addEventListener("click", clearFollow);

  // Auto-connect nếu người dùng đã cho phép
  await tryAutoConnect();
});
