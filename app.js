/* =============================================================
   daugia.vin — app.js (v9, gas-safe)
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Token: VIN @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
   Library: ethers v5 UMD (window.ethers)

   Cải tiến v9:
   - Tất cả giao dịch đều dùng gas overrides:
     * gasLimit = estimateGas * 1.5 (biên an toàn)
     * fee: +25% (maxFeePerGas/maxPriorityFeePerGas hoặc gasPrice)
   - Mục tiêu: ký 1 lần, hạn chế lỗi thiếu gas trên VIC.
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
  {"inputs":[{"internalType":"string","name":"profileCID","type":"string"}],"name":"registerOrganizer","outputs":[],"stateMutability":"nonpayable","type":"function"},

  /* Các hàm mutation bổ sung (khi bạn mở UI tạo/đấu giá) */
  {"inputs":[{"internalType":"uint64","name":"startView","type":"uint64"},{"internalType":"uint64","name":"endView","type":"uint64"},{"internalType":"uint64","name":"depositStart","type":"uint64"},{"internalType":"uint64","name":"depositCutoff","type":"uint64"},{"internalType":"uint64","name":"auctionStart","type":"uint64"},{"internalType":"uint64","name":"auctionEnd","type":"uint64"},{"internalType":"uint256","name":"startingPriceVND","type":"uint256"},{"internalType":"uint256","name":"minIncrementVND","type":"uint256"},{"internalType":"uint256","name":"depositAmountVND","type":"uint256"},{"internalType":"string","name":"auctionDetailCID","type":"string"}],"name":"createAuction","outputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"address[]","name":"bidders","type":"address[]"},{"internalType":"string[]","name":"uncProofCIDs","type":"string[]"}],"name":"updateWhitelist","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"uint256","name":"bidAmountVND","type":"uint256"}],"name":"placeBid","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"auctionId","type":"uint256"}],"name":"finalize","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// ---------- State ----------
let provider, signer, account;
let dauGia, vin;
let vinDecimals = 18;
let balanceTimer = null;
let cacheAuctions = [];

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const el = {
  // menu / header
  btnConnect: $("#btn-connect"),
  btnDisconnect: $("#btn-disconnect"),
  menuCreate: $("#menu-create"),
  btnRegister: $("#btn-register"),
  walletChip: $("#wallet-chip"),
  walletAddress: $("#wallet-address"),
  balVic: $("#bal-vic"),
  balVin: $("#bal-vin"),
  // search
  inpOrganizer: $("#inp-organizer"),
  btnSearch: $("#btn-search"),
  btnFollowAdd: $("#btn-follow-add"),
  btnFollowClear: $("#btn-follow-clear"),
  // list + toast
  list: $("#auction-list"),
  toast: $("#toast")
};

// ---------- Utils ----------
function showToast(msg, ms = 2600){ if(!el.toast){ alert(msg); return; } el.toast.textContent = msg; el.toast.classList.remove("hidden"); setTimeout(()=> el.toast.classList.add("hidden"), ms); }
function fmt(v){ try{return new Intl.NumberFormat("vi-VN").format(v)}catch{return String(v)} }
function shortAddr(a){ return a ? a.slice(0,6)+"…"+a.slice(-4) : ""; }
function isAddr(a){ return /^0x[a-fA-F0-9]{40}$/.test(a||""); }
function fromUnix(s){ if(!s) return "-"; const d=new Date(Number(s)*1000); return d.toLocaleString(); }
function ipfsLink(cid){ if(!cid) return ""; if(cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.replace("ipfs://","")}`; if(cid.startsWith("http")) return cid; return `https://ipfs.io/ipfs/${cid}`; }
function setHidden(node, yes){ if(node) node.classList.toggle("hidden", !!yes); }

// ---------- Provider / Network ----------
async function ensureProvider(){
  provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum, "any")
                             : new ethers.providers.JsonRpcProvider("https://rpc.viction.xyz");
}
async function addOrSwitchToVIC(){
  if (!window.ethereum) return;
  try { await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: CHAIN_ID_HEX }] }); }
  catch(e){
    if (e.code === 4902){
      await window.ethereum.request({ method:"wallet_addEthereumChain", params:[{ chainId: CHAIN_ID_HEX, chainName:"Viction Mainnet", nativeCurrency:{ name:"VIC", symbol:"VIC", decimals:18 }, rpcUrls:[RPC_URL], blockExplorerUrls:[EXPLORER] }] });
    } else { throw e; }
  }
}

// ---------- Contracts ----------
async function initContracts(readOnly=true){
  if (!provider) await ensureProvider();
  signer = (!readOnly && provider.getSigner) ? provider.getSigner() : null;
  dauGia = new ethers.Contract(DAUGIA_ADDR, DAUGIA_ABI, signer || provider);
  vin    = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer || provider);
  try { vinDecimals = await vin.decimals(); } catch {}
}

// ---------- Gas helpers (v9) ----------
async function buildGasOverrides(contract, method, args){
  // Fee ↑25% ; gasLimit = estimate * 1.5
  const fee = await provider.getFeeData();
  const ov = {};
  if (fee.maxFeePerGas) {
    const bump = ethers.BigNumber.from(fee.maxFeePerGas).mul(125).div(100);
    const tip  = ethers.BigNumber.from(fee.maxPriorityFeePerGas || "1500000000").mul(125).div(100); // >=1.5 gwei
    ov.maxFeePerGas = bump;
    ov.maxPriorityFeePerGas = tip;
  } else if (fee.gasPrice) {
    ov.gasPrice = ethers.BigNumber.from(fee.gasPrice).mul(125).div(100);
  }
  try {
    const est = await contract.estimateGas[method](...args, ov);
    ov.gasLimit = est.mul(150).div(100); // +50%
  } catch {
    // fallback gasLimit an toàn theo loại giao dịch
    const fallback = {
      approve: 120000,
      registerOrganizer: 350000,
      createAuction: 1200000,
      updateWhitelist: 1500000,
      placeBid: 400000,
      finalize: 300000
    }[method] || 600000;
    ov.gasLimit = ethers.BigNumber.from(fallback);
  }
  return ov;
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
  await refreshBalances();
  startBalanceTimer();
  await refreshRegistrationUI();
}
function disconnectWallet(){
  account = null; signer = null;
  setHidden(el.walletChip, true);
  setHidden(el.btnConnect, false);
  setHidden(el.btnDisconnect, true);
  setHidden(el.btnRegister, true);
  setHidden(el.menuCreate, true);
  if (balanceTimer) { clearInterval(balanceTimer); balanceTimer = null; }
  showToast("Đã ngắt kết nối hiển thị.");
}
async function tryAutoConnect(){
  if (!window.ethereum) return;
  try {
    const accs = await window.ethereum.request({ method:"eth_accounts" });
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
      await refreshBalances();
      startBalanceTimer();
      await refreshRegistrationUI();
    }
  } catch {}
}

// ---------- Balances ----------
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
function startBalanceTimer(){ if (balanceTimer) clearInterval(balanceTimer); balanceTimer = setInterval(refreshBalances, 15000); }

// ---------- Registration visibility ----------
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
  setHidden(el.btnRegister, !!reg);
  setHidden(el.menuCreate, !reg);
}

// ---------- Fees / Approvals ----------
async function fetchPlatformFee(){ try { return await dauGia.platformFeeVIN(); } catch { return null; } }

async function ensureAllowance(minRequired){
  if (!account) throw new Error("Chưa kết nối ví");
  const allowance = await vin.allowance(account, DAUGIA_ADDR);
  if (allowance.gte(minRequired || 0)) return;
  const args = [DAUGIA_ADDR, minRequired];
  const ov = await buildGasOverrides(vin, "approve", args);
  const tx = await vin.approve(...args, ov);
  showToast("Đang approve VIN…");
  await tx.wait();
}

// ---------- Read: Load auctions ----------
async function loadAllAuctions(){
  cacheAuctions = [];
  if (el.list) el.list.innerHTML = "";
  try{
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

function applyFiltersAndRender(){
  if (!el.list) return;
  el.list.innerHTML = "";
  let items = cacheAuctions.slice();
  if (items.length === 0){
    el.list.innerHTML = `<div class="card"><div class="muted">Chưa có cuộc đấu giá nào.</div></div>`;
    return;
  }
  for (const {id, a} of items){ renderAuctionCard(id, a); }
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

// ---------- Mutations (gas-safe) ----------
async function handleRegister(){
  if (!account) return showToast("Vui lòng kết nối ví.");
  try{
    const fee = await fetchPlatformFee();
    if (!fee) throw new Error("Không đọc được phí nền tảng.");
    await ensureAllowance(fee);
    const args = ["" /* profileCID optional */];
    const ov   = await buildGasOverrides(dauGia, "registerOrganizer", args);
    const tx   = await dauGia.registerOrganizer(...args, ov);
    showToast("Đang gửi đăng ký…");
    await tx.wait();
    showToast("Đăng ký thành công.");
    await refreshRegistrationUI();
  }catch(e){
    console.error(e);
    showToast(e?.data?.message || e?.message || "Đăng ký thất bại");
  }
}

// Các hàm dưới dành cho lúc bạn mở giao diện tạo/đấu giá.
// Bạn có thể gọi trực tiếp với args phù hợp; gas overrides đã sẵn.
async function createAuction(args){
  if (!account) throw new Error("Chưa kết nối ví");
  const ov = await buildGasOverrides(dauGia, "createAuction", args);
  const tx = await dauGia.createAuction(...args, ov);
  showToast("Đang tạo phiên…"); await tx.wait(); showToast("Tạo thành công.");
}
async function updateWhitelist(auctionId, bidders, uncProofCIDs){
  if (!account) throw new Error("Chưa kết nối ví");
  const args = [auctionId, bidders, uncProofCIDs];
  const ov = await buildGasOverrides(dauGia, "updateWhitelist", args);
  const tx = await dauGia.updateWhitelist(...args, ov);
  showToast("Đang cập nhật whitelist…"); await tx.wait(); showToast("Cập nhật thành công.");
}
async function placeBid(auctionId, bidAmountVND){
  if (!account) throw new Error("Chưa kết nối ví");
  const args = [auctionId, ethers.BigNumber.from(bidAmountVND)];
  const ov = await buildGasOverrides(dauGia, "placeBid", args);
  const tx = await dauGia.placeBid(...args, ov);
  showToast("Đang gửi bid…"); await tx.wait(); showToast("Đặt giá thành công.");
}
async function finalize(auctionId){
  if (!account) throw new Error("Chưa kết nối ví");
  const args = [auctionId];
  const ov = await buildGasOverrides(dauGia, "finalize", args);
  const tx = await dauGia.finalize(...args, ov);
  showToast("Đang kết thúc…"); await tx.wait(); showToast("Đã công bố kết quả.");
}

// ---------- Search ----------
async function searchByOrganizer(){
  const addr = (el.inpOrganizer?.value || "").trim();
  if (!isAddr(addr)) return showToast("Nhập địa chỉ ví người tạo hợp lệ");
  if (!el.list) return;
  el.list.innerHTML = "";
  try{
    const idsBn = await dauGia.getOrganizerAuctions(addr);
    const ids = idsBn.map(x => Number(x)).reverse();
    if (ids.length === 0){
      el.list.innerHTML = `<div class="card"><div class="muted">Không có phiên nào.</div></div>`;
      return;
    }
    for (const id of ids){ const a = await dauGia.getAuction(id); renderAuctionCard(id, a); }
  }catch(e){
    console.error(e); showToast("Không tải được phiên theo organizer");
  }
}

// ---------- Init ----------
window.addEventListener("load", async () => {
  await ensureProvider();
  await initContracts(true);
  await loadAllAuctions();

  if (window.ethereum){
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  // Header/menu
  el.btnConnect?.addEventListener("click", connectWallet);
  el.btnDisconnect?.addEventListener("click", disconnectWallet);
  el.btnRegister?.addEventListener("click", handleRegister);
  el.menuCreate?.addEventListener("click", (e) => {
    e.preventDefault();
    showToast("Tạo cuộc đấu giá: giao diện sẽ mở ở bản kế tiếp.");
  });

  // Search / Follow (follow ở bản này lọc theo giao diện sắp thêm)
  el.btnSearch?.addEventListener("click", searchByOrganizer);
  el.btnFollowAdd?.addEventListener("click", () => showToast("Theo dõi: sẽ có lọc theo organizer ở bản sau."));
  el.btnFollowClear?.addEventListener("click", () => showToast("Đã xóa danh sách theo dõi (nếu có)."));

  // Auto-connect nếu ví đã cho phép
  await tryAutoConnect();
});
