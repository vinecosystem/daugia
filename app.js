/* =============================================================
   daugia.vin — app.js (ethers v5 UMD)
   Chain: Viction (VIC, chainId 88), Explorer: vicscan.xyz
   Contract: DauGia (dùng VND cho giá, VIN cho phí nền tảng)
   ============================================================= */

const CFG = window.DAUGIA_CFG || {};
const {
  CHAIN_ID_HEX = "0x58",
  RPC_URL      = "https://rpc.viction.xyz",
  EXPLORER     = "https://vicscan.xyz",
  AUCTION_ADDR = "",
  VIN_ADDR: FALLBACK_VIN = "" // fallback nếu cần
} = CFG;

const { ethers } = window;

/* ---------------- DOM refs ---------------- */
const $ = (id) => document.getElementById(id);
const connectBtn     = $("connectBtn");
const addrShortEl    = $("addrShort");
const balancesBar    = $("balancesBar");
const vicBalEl       = $("vicBalance");
const vinBalEl       = $("vinBalance");
const walletArea     = $("walletArea");
const walletAddrFull = $("walletAddrFull");

const btnRegister    = $("btnRegister");
const registerStatus = $("registerStatus");

const openCreateForm = $("openCreateForm");
const createForm     = $("createForm");
const btnPublish     = $("btnPublish");
const publishStatus  = $("publishStatus");

const searchInput    = $("searchQuery");
const btnSearch      = $("btnSearch");
const filterStateSel = $("filterState");
const btnReload      = $("btnReload");
const auctionGrid    = $("auctionGrid");
const paginationBox  = $("pagination");
const pageInfo       = $("pageInfo");

const updModal       = $("updateDepositorsModal");
const updClose       = $("updDepoClose");
const updInput       = $("updDepositorsInput");
const updConfirm     = $("updDepositorsConfirm");
const updStatus      = $("updDepositorsStatus");

/* ---------------- Providers & contracts ---------------- */
let roProvider, provider, signer, userAddress = "";
let vin, auction;     // write
let vinRead, auctionRead; // read-only

/* ---------------- Price caches ---------------- */
let vinUsdCache = null;  // 1 VIN = ? USD (chỉ để tham khảo phí platformFee)
let vicUsdCache = null;

/* ---------------- Data stores ---------------- */
let AUCTIONS = [];
let CURRENT_FILTER = "all";
let CURRENT_QUERY  = "";

/* ---------------- ABIs ---------------- */
// ERC-20 tối thiểu
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// DauGia ABI (rút gọn các hàm dùng trong DApp) — theo file ABI anh đã lưu
const AUCTION_ABI = [
  // views
  "function totalAuctions() view returns (uint256)",
  "function auctions(uint256) view returns (address organizer,uint64 startView,uint64 endView,uint64 depositStart,uint64 depositCutoff,uint64 auctionStart,uint64 auctionEnd,uint256 startingPriceVND,uint256 minIncrementVND,uint256 depositAmountVND,uint256 currentPriceVND,address highestBidder,bool finalized,bool failed,uint256 whitelistCount,string auctionDetailCID)",
  "function getAuction(uint256) view returns (address organizer,uint64 startView,uint64 endView,uint64 depositStart,uint64 depositCutoff,uint64 auctionStart,uint64 auctionEnd,uint256 startingPriceVND,uint256 minIncrementVND,uint256 depositAmountVND,uint256 currentPriceVND,address highestBidder,bool finalized,bool failed,string auctionDetailCID)",
  "function getStatus(uint256) view returns (uint8)",
  "function isWhitelistedBidder(uint256,address) view returns (bool)",
  "function registeredOrganizer(address) view returns (bool)",
  "function platformFeeVIN() view returns (uint256)",
  "function vinToken() view returns (address)",

  // writes
  "function registerOrganizer(string profileCID)",
  "function createAuction(uint64 startView,uint64 endView,uint64 depositStart,uint64 depositCutoff,uint64 auctionStart,uint64 auctionEnd,uint256 startingPriceVND,uint256 minIncrementVND,uint256 depositAmountVND,string auctionDetailCID) returns (uint256 auctionId)",
  "function placeBid(uint256 auctionId, uint256 bidAmountVND)",
  "function updateWhitelist(uint256 auctionId, address[] bidders, string[] uncProofCIDs)",
  "function finalize(uint256 auctionId)"
];

/* ---------------- Utils ---------------- */
const nowSec = () => Math.floor(Date.now() / 1000);
const shortAddr = (a) => a ? a.slice(0,6) + "…" + a.slice(-4) : "";
const toWei18 = (n) => ethers.utils.parseUnits(String(n), 18);
const fromWei = (bn, dec=18) => ethers.utils.formatUnits(bn || 0, dec);
function fmtTime(s){ if(!s) return "—"; const d=new Date(s*1000); return d.toLocaleString(); }
function clampNonNegInt(x){ const n = Math.max(0, Math.floor(Number(x)||0)); return n; }

/* USD/price: đọc VICUSDT từ Binance, suy ra VIN≈100*VIC (như index.html hiển thị) */
async function getVinUsd() {
  const el = $("vinUsd");
  if (el && el.textContent && !["Loading price...","N/A"].includes(el.textContent)) {
    const v = parseFloat(el.textContent); if (isFinite(v)&&v>0){ vinUsdCache=v; vicUsdCache=v/100; return v; }
  }
  try{
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT",{cache:"no-store"});
    const j = await r.json(); const vic = parseFloat(j.price||"0");
    if(vic>0){ vicUsdCache=vic; vinUsdCache=vic*100; if(el) el.textContent = vinUsdCache.toFixed(2); return vinUsdCache; }
  }catch{}
  vinUsdCache=null; return null;
}

/* ---------------- Chain helpers ---------------- */
async function ensureChain() {
  if (!window.ethereum) return false;
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId?.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return true;
  try{
    await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{chainId: CHAIN_ID_HEX}] });
    return true;
  }catch(e){
    if(e?.code===4902){
      try{
        await window.ethereum.request({
          method:"wallet_addEthereumChain",
          params:[{
            chainId: CHAIN_ID_HEX,
            chainName: "Viction",
            nativeCurrency: { name:"VIC", symbol:"VIC", decimals:18 },
            rpcUrls:[RPC_URL],
            blockExplorerUrls:[EXPLORER]
          }]
        });
        return true;
      }catch{return false;}
    }
    return false;
  }
}

async function gasOverrides() {
  try{
    const fd = await (provider||roProvider).getFeeData();
    if(fd.maxFeePerGas && fd.maxPriorityFeePerGas){
      const up = n => n.mul(125).div(100);
      return { maxFeePerGas: up(fd.maxFeePerGas), maxPriorityFeePerGas: up(fd.maxPriorityFeePerGas) };
    }
    if(fd.gasPrice){ return { gasPrice: fd.gasPrice.mul(125).div(100) }; }
  }catch{}
  return {};
}

/* ---------------- Bind contracts ---------------- */
function bindReadOnly() {
  auctionRead = new ethers.Contract(AUCTION_ADDR, AUCTION_ABI, roProvider);
  // vinRead sẽ bind sau khi biết địa chỉ từ contract
}
function bindWrite() {
  auction = new ethers.Contract(AUCTION_ADDR, AUCTION_ABI, signer);
  if (vinAddrActual) vin = new ethers.Contract(vinAddrActual, ERC20_ABI, signer);
}

/* ---------------- Wallet & balances ---------------- */
let vinAddrActual = FALLBACK_VIN;
let vinDecimals = 18;

async function connectWallet(){
  if(!window.ethereum){ alert("Vui lòng cài ví EVM (MetaMask, Rabby, v.v.)"); return; }
  const ok = await ensureChain(); if(!ok) return;

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  // bind write + read
  bindWrite(); bindReadOnly();

  // Lấy địa chỉ VIN từ contract (chính xác 100%)
  try {
    const vinAddr = await auctionRead.vinToken();
    if (vinAddr && vinAddr !== ethers.constants.AddressZero) {
      vinAddrActual = vinAddr;
      vinRead = new ethers.Contract(vinAddrActual, ERC20_ABI, roProvider);
      vin = new ethers.Contract(vinAddrActual, ERC20_ABI, signer);
      try { vinDecimals = await vinRead.decimals(); } catch {}
    }
  } catch {}

  // UI
  connectBtn.textContent = "Ngắt kết nối";
  connectBtn.dataset.state = "connected";
  addrShortEl.textContent = shortAddr(userAddress);
  addrShortEl.hidden = false;
  walletArea.hidden = false;
  balancesBar.hidden = false;
  walletAddrFull.textContent = userAddress;

  await refreshBalances();
  await refreshRegisterState();

  setupWalletListeners();
}

function disconnectWallet(){
  provider = undefined; signer = undefined; userAddress = "";
  connectBtn.textContent = "Kết nối ví";
  connectBtn.dataset.state = "disconnected";
  addrShortEl.hidden = true; walletArea.hidden = true; balancesBar.hidden = true;
}

function setupWalletListeners(){
  if(!window.ethereum) return;
  window.ethereum.removeAllListeners?.("accountsChanged");
  window.ethereum.removeAllListeners?.("chainChanged");
  window.ethereum.on("accountsChanged", async (accs)=>{
    if(!accs?.length){ disconnectWallet(); return; }
    userAddress = ethers.utils.getAddress(accs[0]);
    signer = provider.getSigner();
    bindWrite();
    await refreshBalances(); await refreshRegisterState();
  });
  window.ethereum.on("chainChanged", ()=> window.location.reload());
}

async function refreshBalances(){
  try{
    const vicWei = await (provider||roProvider).getBalance(userAddress);
    vicBalEl.textContent = Number(ethers.utils.formatEther(vicWei)).toFixed(4);
  }catch{}
  try{
    if(!vinRead){ vinBalEl.textContent="—"; return; }
    const bal = await vinRead.balanceOf(userAddress);
    vinBalEl.textContent = Number(ethers.utils.formatUnits(bal, vinDecimals)).toFixed(4);
  }catch{ vinBalEl.textContent="—"; }
}

/* ---------------- Register organizer (thu platformFeeVIN) ---------------- */
async function refreshRegisterState(){
  if(!userAddress){ btnRegister.hidden = true; return; }
  try{
    const isReg = await auctionRead.registeredOrganizer(userAddress); // bool
    btnRegister.hidden = !!isReg;
  }catch{
    // nếu đọc thất bại thì cứ cho phép bấm, contract sẽ revert nếu cần
    btnRegister.hidden = false;
  }
}

async function handleRegister(){
  if(!userAddress){ alert("Vui lòng kết nối ví."); return; }
  try{
    btnRegister.disabled = true;
    registerStatus.textContent = "Đang kiểm tra phí nền tảng…";
    const feeVIN = await auctionRead.platformFeeVIN(); // uint256 (VIN, 18 decimals thường)
    const feeVINHuman = fromWei(feeVIN, vinDecimals);
    const usd = await getVinUsd();
    const feeUsd = (usd ? (parseFloat(feeVINHuman)*usd) : null);

    registerStatus.textContent = `Phí: ${feeVINHuman} VIN` + (feeUsd? ` (~$${feeUsd.toFixed(2)})`:"") + ". Đang approve…";

    // approve
    const allowance = await vinRead.allowance(userAddress, AUCTION_ADDR);
    if (allowance.lt(feeVIN)) {
      const ov = await gasOverrides();
      const txA = await vin.approve(AUCTION_ADDR, feeVIN, ov);
      await txA.wait();
    }

    registerStatus.textContent = "Đang ký giao dịch đăng ký…";
    const ov2 = await gasOverrides();
    const tx = await auction.registerOrganizer(""); // profileCID để trống, có thể bổ sung sau
    await tx.wait();

    registerStatus.textContent = "Đăng ký thành công.";
    btnRegister.hidden = true;
  }catch(e){
    registerStatus.textContent = "Đăng ký thất bại: " + (e?.data?.message || e?.message || "Unknown");
  }finally{ btnRegister.disabled = false; }
}

/* ---------------- Create auction (VND) ---------------- */
/* Map form:
   - startTime  -> auctionStart
   - endTime    -> auctionEnd
   - depositCloseTime -> depositCutoff
   - startingPriceVND: lấy từ #startPrice (coi là VND)
   - minIncrementVND:  lấy từ #minBidStep (coi là VND)
   - depositAmountVND: không có input => đặt 0
   - startView,endView,depositStart: suy ra từ auctionStart để hợp lệ:
       startView = auctionStart
       endView   = auctionStart
       depositStart = auctionStart
*/
function readFormVND(){
  const startTime = $("startTime").value ? Math.floor(new Date($("startTime").value).getTime()/1000) : 0;
  const endTime   = $("endTime").value   ? Math.floor(new Date($("endTime").value).getTime()/1000)   : 0;
  const depoCut   = $("depositCloseTime").value ? Math.floor(new Date($("depositCloseTime").value).getTime()/1000) : 0;

  const startPriceVND = clampNonNegInt($("startPrice").value);
  const minStepVND    = clampNonNegInt($("minBidStep").value);
  const contentRaw    = ($("auctionContent").value || "").trim();
  const media         = ($("mediaLinks").value || "").trim();

  // Contract yêu cầu: startView <= endView <= depositCutoff <= auctionStart < auctionEnd
  if(!startTime || !endTime || !(startTime < endTime)) throw new Error("Thời gian chưa hợp lệ.");
  if(!depoCut || depoCut > startTime) {
    // Nếu người dùng để hạn cập nhật trễ hơn startTime, ép về = startTime (đảm bảo ràng buộc)
  }

  if(startPriceVND<=0) throw new Error("Giá khởi điểm (VND) phải > 0.");
  if(minStepVND<=0) throw new Error("Bước giá (VND) phải > 0.");

  const startView = startTime;
  const endView   = startTime;
  const depositStart = startTime;
  const depositCutoff = Math.min(depoCut||startTime, startTime); // không vượt startTime
  const auctionStart  = startTime;
  const auctionEnd    = endTime;

  // Mô tả dài lưu IPFS => ở đây tạm thời nhét content + media vào 1 chuỗi (CID/URL thực tế do backend upload)
  const detail = contentRaw + (media ? ("\nMedia: " + media) : "");

  return {
    startView, endView, depositStart, depositCutoff, auctionStart, auctionEnd,
    startingPriceVND: startPriceVND,
    minIncrementVND:  minStepVND,
    depositAmountVND: 0,
    auctionDetailCID: detail
  };
}

async function handlePublish(){
  if(!userAddress){ alert("Vui lòng kết nối ví."); return; }
  try{
    btnPublish.disabled = true;
    publishStatus.textContent = "Đang chuẩn bị…";

    // Phí nền tảng
    const feeVIN = await auctionRead.platformFeeVIN();
    const feeVINHuman = fromWei(feeVIN, vinDecimals);

    // approve nếu cần
    const allowance = await vinRead.allowance(userAddress, AUCTION_ADDR);
    if (allowance.lt(feeVIN)) {
      publishStatus.textContent = `Approve ${feeVINHuman} VIN…`;
      const ov = await gasOverrides();
      const txA = await vin.approve(AUCTION_ADDR, feeVIN, ov);
      await txA.wait();
    }

    // đọc form
    const p = readFormVND();

    publishStatus.textContent = "Đang gửi giao dịch tạo đấu giá…";
    const ov2 = await gasOverrides();
    const tx = await auction.createAuction(
      p.startView, p.endView, p.depositStart, p.depositCutoff,
      p.auctionStart, p.auctionEnd,
      p.startingPriceVND, p.minIncrementVND, p.depositAmountVND,
      p.auctionDetailCID,
      ov2
    );
    await tx.wait();

    publishStatus.textContent = "Tạo thành công. Tải lại danh sách…";
    createForm.hidden = true;
    await loadAuctions();
  }catch(e){
    publishStatus.textContent = "Đăng thất bại: " + (e?.data?.message || e?.message || "Unknown");
  }finally{ btnPublish.disabled = false; }
}

/* ---------------- List & render auctions ---------------- */
function statusLabelByCode(c){
  // 0:PENDING,1:ACTIVE,2:ENDED,3:FINALIZED,4:FAILED
  return c===0?"Chưa diễn ra": c===1?"Đang diễn ra": c===2?"Đã kết thúc": c===3?"Đã chốt": "Thất bại";
}
async function loadAuctions(){
  AUCTIONS = [];
  auctionGrid.innerHTML = "";
  pageInfo.textContent = "—";
  paginationBox.hidden = true;

  try{
    const total = (await auctionRead.totalAuctions()).toNumber?.() ?? parseInt(await auctionRead.totalAuctions());
    if(!total){ auctionGrid.innerHTML = `<div class="card muted">Chưa có cuộc đấu giá nào.</div>`; pageInfo.textContent="0"; return; }

    const ids = Array.from({length: Math.min(total, 200)}, (_,i)=> i+1); // contract đếm từ 1
    for(const id of ids){
      const a = await auctionRead.auctions(id);
      AUCTIONS.push(normalizeAuction(id, a));
    }
    renderAuctions();
  }catch(e){
    auctionGrid.innerHTML = `<div class="card muted">Lỗi tải danh sách: ${e?.message||"Unknown"}</div>`;
  }
}

function normalizeAuction(id, raw){
  // raw tuple theo ABI
  const obj = {
    id,
    organizer: raw.organizer,
    startView: Number(raw.startView),
    endView: Number(raw.endView),
    depositStart: Number(raw.depositStart),
    depositCutoff: Number(raw.depositCutoff),
    auctionStart: Number(raw.auctionStart),
    auctionEnd: Number(raw.auctionEnd),
    startingPriceVND: raw.startingPriceVND ? ethers.BigNumber.from(raw.startingPriceVND).toString() : "0",
    minIncrementVND:  raw.minIncrementVND ? ethers.BigNumber.from(raw.minIncrementVND).toString()  : "0",
    depositAmountVND: raw.depositAmountVND ? ethers.BigNumber.from(raw.depositAmountVND).toString() : "0",
    currentPriceVND:  raw.currentPriceVND ? ethers.BigNumber.from(raw.currentPriceVND).toString()  : "0",
    highestBidder: raw.highestBidder,
    finalized: !!raw.finalized,
    failed: !!raw.failed,
    whitelistCount: raw.whitelistCount ? Number(raw.whitelistCount) : 0,
    auctionDetailCID: raw.auctionDetailCID || ""
  };
  return obj;
}

async function computeStatus(a){
  try{ return await auctionRead.getStatus(a.id); }catch{ 
    // fallback theo thời gian
    const n = nowSec();
    if (a.finalized) return a.failed?4:3;
    if (n < a.auctionStart) return 0;
    if (n < a.auctionEnd) return 1;
    return 2;
  }
}

async function isUserWhitelisted(a){
  if(!userAddress) return null;
  try{ return await auctionRead.isWhitelistedBidder(a.id, userAddress); }catch{ return null; }
}

function passSearchFilter(a){
  const q = CURRENT_QUERY.trim().toLowerCase();
  if(!q) return true;
  const hay = [
    a.organizer?.toLowerCase() || "",
    a.auctionDetailCID?.toLowerCase() || "",
    String(a.id)
  ].join("|");
  return hay.includes(q);
}

async function renderAuctions(){
  auctionGrid.innerHTML = "";
  const tpl = $("auctionCardTpl");
  const usdPerVin = vinUsdCache;

  // parallel status checks (bounded)
  const filtered = AUCTIONS.filter(passSearchFilter);

  for(const a of filtered){
    const node = tpl.content.cloneNode(true);
    const root = node.querySelector(".auction-card");
    root.dataset.id = a.id;

    root.querySelector(".title").textContent = `#${a.id}`;
    root.querySelector(".creator").textContent = shortAddr(a.organizer);
    root.querySelector(".start").textContent   = fmtTime(a.auctionStart);
    root.querySelector(".end").textContent     = fmtTime(a.auctionEnd);
    root.querySelector(".deposit-deadline").textContent = fmtTime(a.depositCutoff);

    // hiển thị VND (số nguyên)
    const sp = Number(a.startingPriceVND||0);
    const st = Number(a.minIncrementVND||0);
    const cp = Number(a.currentPriceVND||0);
    root.querySelector(".start-price").textContent = sp.toLocaleString("vi-VN");
    root.querySelector(".step").textContent        = st.toLocaleString("vi-VN");
    root.querySelector(".current-price").textContent = cp ? cp.toLocaleString("vi-VN") : "—";

    // USD quy đổi — không chính xác (VIN->USD) vì giá là VND; chỉ ước lượng nếu cần: VND≈USD*~25k (bỏ qua để tránh hiểu nhầm)
    root.querySelector(".current-usd").textContent = "—";

    // mô tả
    root.querySelector(".desc").textContent = a.auctionDetailCID || "";

    // trạng thái
    const code = await computeStatus(a);
    root.querySelector(".status").textContent = statusLabelByCode(Number(code));

    // buttons
    const joinBtn = root.querySelector(".join-btn");
    const bidInput = root.querySelector(".bid-input");
    const bidBtn   = root.querySelector(".bid-btn");
    const updBtn   = root.querySelector(".update-depositors-btn");

    joinBtn.onclick = () => focusAuction(a.id);
    bidBtn.onclick  = () => onBidClick(a, bidInput);
    updBtn.onclick  = () => openUpdateDepositors(a.id);

    // disable theo trạng thái
    if (Number(code) !== 1) { bidInput.disabled = true; bidBtn.disabled = true; } // chỉ khi ACTIVE

    // nếu chưa kết nối
    if (!userAddress) { bidInput.disabled = true; bidBtn.disabled = true; updBtn.disabled = true; }

    // quyền update whitelist: chỉ organizer và trước cutoff
    const beforeCutoff = nowSec() <= a.depositCutoff;
    if (!(userAddress && userAddress.toLowerCase() === (a.organizer||"").toLowerCase() && beforeCutoff)) {
      updBtn.disabled = true;
    }

    auctionGrid.appendChild(root);
  }

  pageInfo.textContent = `Tổng: ${filtered.length}`;
}

/* focus 1 thẻ */
function focusAuction(id){
  const cards = auctionGrid.querySelectorAll(".auction-card");
  cards.forEach(c => { c.style.display = (String(c.dataset.id)===String(id)) ? "flex" : "none"; });
}

/* Bỏ giá (đơn vị VND) */
async function onBidClick(a, inputEl){
  if(!userAddress){ alert("Vui lòng kết nối ví."); return; }
  const price = clampNonNegInt(inputEl.value);
  if(!price){ alert("Nhập giá (VND) hợp lệ."); return; }

  // check tối thiểu
  const minValid = Number(a.currentPriceVND||a.startingPriceVND||0) + Number(a.minIncrementVND||0);
  if (price < minValid) { alert(`Giá phải ≥ ${minValid.toLocaleString("vi-VN")} VND.`); return; }

  try{
    inputEl.disabled = true;
    // Thu phí nền tảng (VIN): approve nếu cần
    const feeVIN = await auctionRead.platformFeeVIN();
    const allowance = await vinRead.allowance(userAddress, AUCTION_ADDR);
    if (allowance.lt(feeVIN)) {
      const ov = await gasOverrides();
      const txA = await vin.approve(AUCTION_ADDR, feeVIN, ov);
      await txA.wait();
    }

    const ov2 = await gasOverrides();
    const tx = await auction.placeBid(a.id, price, ov2);
    await tx.wait();
    alert("Bỏ giá thành công.");
    await loadAuctions();
  }catch(e){
    alert("Bỏ giá thất bại: " + (e?.data?.message || e?.message || "Unknown"));
  }finally{ inputEl.disabled = false; }
}

/* Update whitelist */
function openUpdateDepositors(auctionId){
  updModal.dataset.auctionId = String(auctionId);
  updStatus.textContent = "";
  updInput.value = "";
  updModal.setAttribute("aria-hidden","false");
}
function closeUpdateDepositors(){ updModal.setAttribute("aria-hidden","true"); }

async function confirmUpdateDepositors(){
  if(!userAddress){ alert("Vui lòng kết nối ví."); return; }
  const auctionId = Number(updModal.dataset.auctionId || "0");
  const raw = updInput.value.trim(); if(!raw){ alert("Dán danh sách địa chỉ trước."); return; }
  const parts = raw.split(/[\s,;]+/g).map(s=>s.trim()).filter(Boolean);
  const addrs = [];
  for(const p of parts){ try{ addrs.push(ethers.utils.getAddress(p)); }catch{} }
  if(!addrs.length){ alert("Danh sách không có địa chỉ hợp lệ."); return; }

  try{
    updConfirm.disabled = true;
    updStatus.textContent = "Approve phí & cập nhật on-chain…";

    // approve phí VIN nếu cần
    const feeVIN = await auctionRead.platformFeeVIN();
    const allowance = await vinRead.allowance(userAddress, AUCTION_ADDR);
    if (allowance.lt(feeVIN)) {
      const ov = await gasOverrides();
      const txA = await vin.approve(AUCTION_ADDR, feeVIN, ov);
      await txA.wait();
    }

    // uncProofCIDs cho phép rỗng theo spec
    const proofs = []; // để trống
    const ov2 = await gasOverrides();
    const tx = await auction.updateWhitelist(auctionId, addrs, proofs, ov2);
    await tx.wait();
    updStatus.textContent = "Cập nhật thành công.";
    setTimeout(closeUpdateDepositors, 800);
  }catch(e){
    updStatus.textContent = "Lỗi: " + (e?.data?.message || e?.message || "Unknown");
  }finally{ updConfirm.disabled = false; }
}

/* ---------------- Events ---------------- */
connectBtn.addEventListener("click", async ()=>{
  if (connectBtn.dataset.state === "connected") disconnectWallet();
  else await connectWallet();
});
btnRegister.addEventListener("click", handleRegister);
openCreateForm.addEventListener("click", ()=> createForm.hidden = !createForm.hidden);
btnPublish.addEventListener("click", handlePublish);

btnReload.addEventListener("click", loadAuctions);
filterStateSel.addEventListener("change", e=>{ CURRENT_FILTER = e.target.value; renderAuctions(); });
btnSearch.addEventListener("click", ()=>{ CURRENT_QUERY = searchInput.value||""; renderAuctions(); });
searchInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ CURRENT_QUERY=searchInput.value||""; renderAuctions(); }});

updClose.addEventListener("click", closeUpdateDepositors);
updConfirm.addEventListener("click", confirmUpdateDepositors);
updModal.addEventListener("click", (e)=>{ if(e.target===updModal) closeUpdateDepositors(); });

/* ---------------- Boot ---------------- */
(async function boot(){
  // Chỉnh label giao diện từ VIN -> VND cho phần giá (để đúng với contract)
  try{
    const repl = [
      ["Giá khởi điểm (VIN)", "Giá khởi điểm (VND)"],
      ["Bước giá (VIN)", "Bước giá (VND)"],
      ["Giá hiện thời (VIN):", "Giá hiện thời (VND):"]
    ];
    document.querySelectorAll("label, .kv").forEach(el=>{
      repl.forEach(([a,b])=>{ if(el.textContent.includes(a)) el.textContent = el.textContent.replace(a,b); });
    });
  }catch{}

  roProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  bindReadOnly();

  // Lấy địa chỉ VIN thực tế từ contract để hiện số dư đúng ngay cả khi chưa connect (nếu cần)
  try{
    const vinAddr = await auctionRead.vinToken();
    if (vinAddr && vinAddr !== ethers.constants.AddressZero) {
      vinAddrActual = vinAddr;
      vinRead = new ethers.Contract(vinAddrActual, ERC20_ABI, roProvider);
      try { vinDecimals = await vinRead.decimals(); } catch {}
    } else if (FALLBACK_VIN) {
      vinAddrActual = FALLBACK_VIN;
      vinRead = new ethers.Contract(vinAddrActual, ERC20_ABI, roProvider);
      try { vinDecimals = await vinRead.decimals(); } catch {}
    }
  }catch{}

  await getVinUsd();
  await loadAuctions();

  // auto-connect nếu trình duyệt đã cấp quyền
  if (window.ethereum?.selectedAddress) { try{ await connectWallet(); }catch{} }
})();
