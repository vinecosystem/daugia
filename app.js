/* =============================================================
   daugia.vin — app.js (reboot: tối giản, dễ thao tác)
   - MetaMask / Viction (chainId 88)
   - Balances VIC/VIN; Register (1 USD VIN); Create auction (1 USD VIN)
   - Create form: 5 fields (as, ae, cutoff, startPrice, step, desc/link)
   - Whitelist: organizer update trước cutoff
   - Bid: chỉ whitelisted & trong khung thời gian; min = cur + step (hoặc start)
   ============================================================= */

/** ================= Config ================= **/
const CFG = window.DGV_CONFIG || {
  CHAIN_ID_HEX: "0x58",
  RPC_URL: "https://rpc.viction.xyz",
  EXPLORER: "https://vicscan.xyz",
  AUCTION_ADDR: "0x1765e20ecB8cD78688417A6d4123f2b899775599",
  VIN_ADDR: "0x941F63807401efCE8afe3C9d88d368bAA287Fac4"
};

// Prefer full ABI from JSON; fallback to minimal
let ABIAuction = null;
const ABI_FALLBACK = [
  // Views
  "function totalAuctions() view returns (uint256)",
  "function getAuction(uint256) view returns (address,uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint256,uint256,address,bool,bool,string)",
  "function getOrganizerAuctions(address) view returns (uint256[])",
  "function getStatus(uint256) view returns (uint8)",
  "function platformFeeVIN() view returns (uint256)",
  "function registeredOrganizer(address) view returns (bool)",
  "function vinToken() view returns (address)",
  "function isWhitelistedBidder(uint256,address) view returns (bool)",
  // Tx
  "function registerOrganizer(string)",
  "function createAuction(uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint256,string) returns (uint256)",
  "function updateWhitelist(uint256,address[],string[])",
  "function placeBid(uint256,uint256)"
];

const ABI_ERC20 = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

/** ================= State ================= **/
let readonlyProvider, provider, signer, userAddr;
let auction, vin;
let vinDecimals = 18;

let lastVinUsd = NaN;      // USD per VIN (from VIC/USDT × 100)
let lastPriceUpdatedAt = 0;

let activeAuctionId = null; // focus mode

/** ================= Boot ================= **/
bootstrap();

async function bootstrap() {
  readonlyProvider = new ethers.providers.JsonRpcProvider(CFG.RPC_URL);
  provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : readonlyProvider;

  // Load ABI JSON if present
  try {
    const res = await fetch("DauGia_ABI.json", { cache: "no-store" });
    if (res.ok) ABIAuction = await res.json();
  } catch {}
  if (!ABIAuction) ABIAuction = ABI_FALLBACK;

  auction = new ethers.Contract(CFG.AUCTION_ADDR, ABIAuction, readonlyProvider);

  // Price loop (independent from UI chip)
  await refreshVinPriceForApp();
  setInterval(refreshVinPriceForApp, 60000);

  wireUIEvents();
  window.addEventListener("wallet-state", handleWalletStateUI);

  // Render as guest
  await renderAllAuctions();

  // Auto-connect if authorized
  if (window.ethereum) {
    const accs = await provider.listAccounts().catch(()=>[]);
    if (accs && accs.length) {
      await connectWallet().catch(()=>{});
    }
  }
}

/** ================= Events from index.html ================= **/
function wireUIEvents() {
  window.addEventListener("do-connect", connectWallet);
  window.addEventListener("do-disconnect", disconnectWallet);
  window.addEventListener("do-register", onRegisterOneUsd);
  window.addEventListener("open-create", openCreateModal);
  window.addEventListener("do-search", doSearch);
  window.addEventListener("open-guide", openGuide);
}

/** ================= Pricing for fees (independent) ================= **/
async function refreshVinPriceForApp() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT", { cache: "no-store" });
    const data = await r.json();
    const vicUsd = parseFloat(data?.price);
    if (!isFinite(vicUsd)) throw new Error("No VIC/USDT price");
    lastVinUsd = vicUsd * 100; // VIN/USD
    lastPriceUpdatedAt = Date.now();
  } catch (e) {
    console.warn("refreshVinPriceForApp:", e?.message || e);
  }
}
async function ensureVinPrice() {
  if (!(lastVinUsd > 0) || (Date.now() - lastPriceUpdatedAt > 120000)) {
    await refreshVinPriceForApp();
  }
  if (!(lastVinUsd > 0)) throw new Error("Không lấy được giá VIN/USD để tính phí.");
}

/** ================= Wallet connect / disconnect ================= **/
async function connectWallet() {
  if (!window.ethereum) return alert("Vui lòng cài MetaMask để kết nối ví.");

  await provider.send("eth_requestAccounts", []);
  try {
    const net = await provider.getNetwork();
    if (net.chainId !== 88) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CFG.CHAIN_ID_HEX }]
      });
    }
  } catch (e) {
    if (e?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CFG.CHAIN_ID_HEX,
          chainName: "Viction",
          rpcUrls: [CFG.RPC_URL],
          nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 },
          blockExplorerUrls: [CFG.EXPLORER]
        }]
      });
    } else {
      console.error("switch chain error:", e);
    }
  }

  signer = provider.getSigner();
  userAddr = await signer.getAddress();
  auction = auction.connect(signer);

  try {
    const vinAddr = await auction.vinToken();
    vin = new ethers.Contract(vinAddr, ABI_ERC20, signer);
  } catch {
    vin = new ethers.Contract(CFG.VIN_ADDR, ABI_ERC20, signer);
  }
  try { vinDecimals = await vin.decimals(); } catch {}

  if (!window.__dgv_bound) {
    window.__dgv_bound = true;
    window.ethereum.on?.("accountsChanged", () => window.location.reload());
    window.ethereum.on?.("chainChanged", () => window.location.reload());
  }

  await refreshWalletPanel();
  await renderAllAuctions();
}

async function disconnectWallet() {
  provider = readonlyProvider;
  signer = null;
  userAddr = null;
  auction = new ethers.Contract(CFG.AUCTION_ADDR, ABIAuction, readonlyProvider);
  activeAuctionId = null;
  dispatchWalletState({ connected: false, registered: false });
  await renderAllAuctions();
}

/** ================= Wallet panel + CTA logic ================= **/
async function refreshWalletPanel() {
  if (!signer || !userAddr) {
    dispatchWalletState({ connected: false, registered: false });
    return;
  }

  let vicText = "—", vinText = "—";
  try { vicText = ethers.utils.formatEther(await provider.getBalance(userAddr)); } catch {}
  try { vinText = ethers.utils.formatUnits(await vin.balanceOf(userAddr), vinDecimals); } catch {}

  let registered = false;
  try { registered = await auction.registeredOrganizer(userAddr); } catch {}

  dispatchWalletState({
    connected: true,
    registered,
    accountShort: shorten(userAddr),
    accountExplorer: `${CFG.EXPLORER}/address/${userAddr}`,
    vicBalance: vicText,
    vinBalance: vinText
  });
}

function handleWalletStateUI(ev) {
  const s = ev.detail || {};
  const btnConnect = document.getElementById("btnConnect");
  const btnDisconnect = document.getElementById("btnDisconnect");
  const walletPanel = document.getElementById("walletPanel");
  const accShort = document.getElementById("accountShort");
  const linkVicScan = document.getElementById("linkVicScan");
  const vicBalance = document.getElementById("vicBalance");
  const vinBalance = document.getElementById("vinBalance");
  const btnRegister = document.getElementById("btnRegister");
  const btnCreate = document.getElementById("btnCreateAuction");

  // Connection toggle
  if (s.connected) {
    btnConnect?.classList.add("hidden");
    btnDisconnect?.classList.remove("hidden");
    walletPanel.style.display = "block";
  } else {
    btnConnect?.classList.remove("hidden");
    btnDisconnect?.classList.add("hidden");
    walletPanel.style.display = "none";
  }

  // Wallet info
  if (s.accountShort) accShort.textContent = s.accountShort;
  if (s.accountExplorer) linkVicScan.href = s.accountExplorer;
  if (s.vicBalance != null) vicBalance.textContent = s.vicBalance;
  if (s.vinBalance != null) vinBalance.textContent = s.vinBalance;

  // CTA logic
  if (s.connected) {
    if (s.registered) {
      btnRegister?.classList.add("hidden");
      btnCreate?.classList.remove("hidden");
    } else {
      btnRegister?.classList.remove("hidden");
      btnCreate?.classList.add("hidden");
    }
  } else {
    btnRegister?.classList.add("hidden");
    btnCreate?.classList.add("hidden");
  }
}

function dispatchWalletState(detail) {
  window.dispatchEvent(new CustomEvent("wallet-state", { detail }));
}

/** ================= Platform fee (1 USD VIN) + fast gas ================= **/
async function getRequiredPlatformFeeWei() {
  await ensureVinPrice();
  const vinNeed = 1 / lastVinUsd; // 1 USD / (USD per VIN)
  const vinNeedWei = ethers.utils.parseUnits(vinNeed.toString(), vinDecimals);
  let feeOnChain = ethers.constants.Zero;
  try { feeOnChain = await auction.platformFeeVIN(); } catch {}
  return feeOnChain.gt(vinNeedWei) ? feeOnChain : vinNeedWei;
}

async function ensurePlatformFeeAllowance() {
  const required = await getRequiredPlatformFeeWei();
  const cur = await vin.allowance(userAddr, CFG.AUCTION_ADDR);
  if (cur.gte(required)) return;
  const txReq = await vin.populateTransaction.approve(CFG.AUCTION_ADDR, required);
  await sendFast(txReq);
}

async function sendFast(txReq) {
  try {
    const est = await signer.estimateGas(txReq);
    txReq.gasLimit = est.mul(150).div(100);
  } catch {}
  try {
    const fee = await provider.getFeeData();
    if (fee.maxFeePerGas) {
      txReq.maxFeePerGas = fee.maxFeePerGas.mul(3);
      txReq.maxPriorityFeePerGas = (fee.maxPriorityFeePerGas || ethers.utils.parseUnits("2", "gwei")).mul(3);
    } else {
      txReq.gasPrice = (fee.gasPrice && fee.gasPrice.gt(0)) ? fee.gasPrice.mul(3) : ethers.utils.parseUnits("100", "gwei");
    }
  } catch {
    txReq.gasPrice = ethers.utils.parseUnits("100", "gwei");
  }
  const tx = await signer.sendTransaction(txReq);
  return await tx.wait();
}

/** ================= Register (charge 1 USD VIN) ================= **/
async function onRegisterOneUsd() {
  try {
    await ensureConnected();
    await ensurePlatformFeeAllowance();
    const txReq = await auction.populateTransaction.registerOrganizer("");
    await sendFast(txReq);
    alert("Đăng ký thành công!");
    await refreshWalletPanel();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Đăng ký thất bại.");
  }
}

/** ================= Create auction (charge 1 USD VIN) ================= **/
function openCreateModal() {
  ensureConnected().then(async () => {
    const registered = await auction.registeredOrganizer(userAddr).catch(()=>false);
    if (!registered) return alert("Bạn chưa đăng ký.");

    // FORM TỐI GIẢN — 5 trường quan trọng
    const m = modal(`
      <h3 style="margin-bottom:8px">Tạo cuộc đấu giá</h3>

      <div class="card">
        <div class="card-head"><h4>1) Thời gian đấu giá</h4></div>
        <div class="card-body">
          <div class="row"><label for="c_as">Bắt đầu</label><input id="c_as" type="datetime-local" class="input" /></div>
          <div class="row"><label for="c_ae">Kết thúc</label><input id="c_ae" type="datetime-local" class="input" /></div>
          <p class="small muted">Chỉ trong khoảng này người được whitelist mới thấy nút <b>Bỏ giá</b>.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h4>2) Hạn cập nhật ví đã đặt cọc</h4></div>
        <div class="card-body">
          <div class="row"><label for="c_dc">Hạn cuối</label><input id="c_dc" type="datetime-local" class="input" /></div>
          <p class="small muted">Sau mốc này organizer không thể thêm ví vào whitelist.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h4>3) Giá khởi điểm & 4) Bước giá (VND)</h4></div>
        <div class="card-body">
          <div class="row"><label for="c_sp">Giá khởi điểm (VND)</label><input id="c_sp" type="number" min="0" step="1" class="input" placeholder="vd: 5000000000" /></div>
          <div class="row"><label for="c_step">Bước giá (VND)</label><input id="c_step" type="number" min="1" step="1" class="input" placeholder="vd: 100000000" /></div>
          <p class="small muted">Giá người sau phải ≥ (giá hiện tại + bước giá). Lần đầu phải ≥ giá khởi điểm.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h4>5) Nội dung cuộc đấu giá</h4></div>
        <div class="card-body">
          <div class="row">
            <label for="c_desc">Mô tả ngắn gọn</label>
            <textarea id="c_desc" class="input" rows="6" maxlength="20000" placeholder="Mô tả tài sản, điều kiện ngoài chuỗi (tài khoản nhận cọc...), lưu ý quan trọng..."></textarea>
          </div>
          <div class="row">
            <label for="c_cid">Link kèm theo (không bắt buộc: IPFS CID/URL, website…)</label>
            <input id="c_cid" class="input" placeholder="vd: ipfs://bafy... hoặc https://..." />
          </div>
        </div>
      </div>

      <div class="actions" style="margin-top:10px">
        <button class="btn" id="c_cancel">Hủy</button>
        <button class="btn primary" id="c_ok">Ký & Đăng</button>
      </div>
    `);

    m.querySelector("#c_cancel").onclick = () => m.remove();
    m.querySelector("#c_ok").onclick = async () => {
      try {
        const as = toUnix(m.querySelector("#c_as").value);
        const ae = toUnix(m.querySelector("#c_ae").value);
        const dc = toUnix(m.querySelector("#c_dc").value);
        const sp = toBN(m.querySelector("#c_sp").value);
        const step = toBN(m.querySelector("#c_step").value);
        let cid = (m.querySelector("#c_cid").value || "").trim();
        const desc = (m.querySelector("#c_desc").value || "").trim();

        // RÀNG BUỘC LOGIC THỜI GIAN
        if (!(as && ae && dc)) throw new Error("Thiếu mốc thời gian bắt buộc.");
        if (!(as < ae)) throw new Error("Thời gian đấu giá: bắt đầu phải < kết thúc.");
        if (!(dc <= as)) throw new Error("Hạn cập nhật ví phải trước hoặc đúng lúc bắt đầu đấu giá.");
        if (step.lte(0)) throw new Error("Bước giá phải > 0.");
        if (sp.lt(0)) throw new Error("Giá khởi điểm không hợp lệ.");

        // Map vào createAuction (các mốc không sử dụng set = 0)
        const startView = 0, endView = 0, depositStart = 0;
        let cidFinal = cid.replace(/^ipfs:\/\//, "");
        if (!cidFinal && desc) cidFinal = desc.slice(0, 1800);

        await ensurePlatformFeeAllowance();
        const txReq = await auction.populateTransaction.createAuction(
          startView, endView, depositStart, dc, as, ae, sp, step, 0, cidFinal
        );
        await sendFast(txReq);

        alert("Tạo phiên thành công!");
        m.remove();
        await renderAllAuctions();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Tạo phiên thất bại.");
      }
    };
  });
}

/** ================= Update whitelist (charge 1 USD VIN) ================= **/
function openUpdateWhitelistModal(auctionId, depositCutoff) {
  const now = Math.floor(Date.now()/1000);
  if (now > Number(depositCutoff)) {
    return alert("Đã quá hạn cập nhật ví đã đặt cọc.");
  }
  const m = modal(`
    <h3>Cập nhật ví đã đặt cọc (#${auctionId})</h3>
    <p class="small muted">Chỉ cập nhật trước mốc "Hạn cập nhật ví".</p>
    <div class="row"><label>Địa chỉ ví (mỗi dòng 1 địa chỉ)</label><textarea id="w_addrs" class="input" rows="6" placeholder="0xabc...\n0xdef..."></textarea></div>
    <div class="row"><label>UNC proof CIDs (tuỳ chọn; cùng số dòng)</label><textarea id="w_unc" class="input" rows="4" placeholder="cid1\ncid2"></textarea></div>
    <div class="actions">
      <button class="btn" id="w_cancel">Hủy</button>
      <button class="btn primary" id="w_ok">Cập nhật</button>
    </div>
  `);
  m.querySelector("#w_cancel").onclick = () => m.remove();
  m.querySelector("#w_ok").onclick = async () => {
    try {
      await ensureConnected();
      await ensurePlatformFeeAllowance();

      const addrs = (m.querySelector("#w_addrs").value || "")
        .split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean).filter(ethers.utils.isAddress);
      if (!addrs.length) throw new Error("Chưa có địa chỉ hợp lệ.");

      const unc = (m.querySelector("#w_unc").value || "")
        .split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
      const uncCIDs = (unc.length === 0 || unc.length === addrs.length) ? unc : [];

      const txReq = await auction.populateTransaction.updateWhitelist(auctionId, addrs, uncCIDs);
      await sendFast(txReq);
      alert("Cập nhật whitelist thành công!");
      m.remove();
      await renderAllAuctions();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Cập nhật whitelist thất bại.");
    }
  };
}

/** ================= Place bid (charge 1 USD VIN) ================= **/
function openBidModal(auctionId, currentPriceVND, minIncrementVND, auctionStart, auctionEnd, startingPriceVND) {
  const now = Math.floor(Date.now()/1000);
  if (!(now >= Number(auctionStart) && now <= Number(auctionEnd))) {
    return alert("Chưa đến hoặc đã qua thời gian đấu giá.");
  }
  // Giá tối thiểu tiếp theo:
  const base = ethers.BigNumber.from(currentPriceVND).gt(0) ? currentPriceVND : startingPriceVND;
  const minNext = ethers.BigNumber.from(base).add(minIncrementVND);

  const m = modal(`
    <h3>Bỏ giá (#${auctionId})</h3>
    <p class="muted small">Tối thiểu: <b>${fmtVND(minNext)}</b></p>
    <div class="row"><label>Số tiền (VND)</label><input id="b_amt" type="number" min="${minNext}" step="1" class="input" placeholder="${minNext}"></div>
    <div class="actions">
      <button class="btn" id="b_cancel">Hủy</button>
      <button class="btn primary" id="b_ok">Xác nhận</button>
    </div>
  `);
  m.querySelector("#b_cancel").onclick = () => m.remove();
  m.querySelector("#b_ok").onclick = async () => {
    try {
      await ensureConnected();
      await ensurePlatformFeeAllowance();

      const val = toBN(m.querySelector("#b_amt").value);
      if (val.lt(minNext)) throw new Error("Số tiền phải ≥ mức tối thiểu.");
      const txReq = await auction.populateTransaction.placeBid(auctionId, val);
      await sendFast(txReq);
      alert("Đặt giá thành công!");
      m.remove();
      await renderAllAuctions();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Đặt giá thất bại.");
    }
  };
}

/** ================= Join/focus view ================= **/
function focusAuction(id) {
  activeAuctionId = id;
  renderAllAuctions();
}
function clearFocus() {
  activeAuctionId = null;
  renderAllAuctions();
}

/** ================= Search & render ================= **/
async function doSearch() {
  const q = (document.getElementById("searchQuery").value || "").trim();
  activeAuctionId = null; // reset focus on new search
  if (!q) { await renderAllAuctions(); return; }

  const wrap = document.getElementById("auctionList");
  wrap.innerHTML = `<div class="skeleton">Đang tìm…</div>`;

  try {
    // by numeric ID
    if (/^\d+$/.test(q)) {
      const card = await renderOneAuctionCard(Number(q), { showBack: true });
      wrap.innerHTML = "";
      if (card) wrap.appendChild(card); else wrap.innerHTML = `<div class="empty">Không tìm thấy #${q}.</div>`;
      return;
    }
    // by organizer address
    if (ethers.utils.isAddress(q)) {
      const ids = await auction.getOrganizerAuctions(q);
      wrap.innerHTML = "";
      if (!ids || !ids.length) { wrap.innerHTML = `<div class="empty">Organizer chưa có phiên nào.</div>`; return; }
      for (const id of ids) {
        const card = await renderOneAuctionCard(Number(id));
        if (card) wrap.appendChild(card);
      }
      return;
    }
    // keyword in CID
    const total = (await auction.totalAuctions()).toNumber();
    const found = [];
    for (let id = total; id >= 1; id--) {
      const info = await auction.getAuction(id);
      const cid = info[14] || "";
      if (String(cid).toLowerCase().includes(q.toLowerCase())) found.push(id);
    }
    wrap.innerHTML = "";
    if (!found.length) { wrap.innerHTML = `<div class="empty">Không thấy kết quả phù hợp.</div>`; return; }
    for (const id of found) {
      const card = await renderOneAuctionCard(id);
      if (card) wrap.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="empty">Lỗi tìm kiếm.</div>`;
  }
}

async function renderAllAuctions() {
  const wrap = document.getElementById("auctionList");
  wrap.innerHTML = `<div class="skeleton">Đang tải dữ liệu…</div>`;
  try {
    const total = (await auction.totalAuctions()).toNumber();
    wrap.innerHTML = "";
    if (!total) { wrap.innerHTML = `<div class="empty">Chưa có cuộc đấu giá nào.</div>`; return; }

    if (activeAuctionId) {
      const card = await renderOneAuctionCard(activeAuctionId, { showBack: true });
      wrap.appendChild(card || document.createElement("div"));
      return;
    }

    for (let id = total; id >= 1; id--) {
      const card = await renderOneAuctionCard(id);
      if (card) wrap.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="empty">Không thể tải dữ liệu.</div>`;
  }
}

async function renderOneAuctionCard(id, opts={}) {
  try {
    const info = await auction.getAuction(id);
    const [
      organizer,
      startView, endView, depositStart, depositCutoff,
      auctionStart, auctionEnd,
      startingPriceVND, minIncrementVND, depositAmountVND,
      currentPriceVND, highestBidder,
      finalized, failed, auctionDetailCID
    ] = info;

    const status = await auction.getStatus(id);
    const isOrganizer = !!userAddr && organizer?.toLowerCase() === userAddr.toLowerCase();

    let canBid = false;
    if (userAddr) { try { canBid = await auction.isWhitelistedBidder(id, userAddr); } catch {} }

    const tpl = document.getElementById("tpl-auction-card");
    const node = tpl.content.firstElementChild.cloneNode(true);

    node.querySelector(".auc-title").textContent = `Cuộc đấu giá #${id}`;
    node.querySelector(".auc-id").textContent = `#${id}`;
    const aOrg = node.querySelector(".auc-organizer");
    aOrg.textContent = shorten(organizer);
    aOrg.href = `${CFG.EXPLORER}/address/${organizer}`;

    const meta = node.querySelector(".auc-meta");
    meta.innerHTML = `
      <div><strong>Thời gian đấu giá:</strong> ${fmtTime(auctionStart)} → <b>${fmtTime(auctionEnd)}</b> &nbsp; <span class="chip">Trạng thái: ${statusText(status, finalized, failed)}</span></div>
      <div><strong>Hạn cập nhật ví:</strong> <b>${fmtTime(depositCutoff)}</b></div>
      <div><strong>Giá khởi điểm:</strong> <b>${fmtVND(startingPriceVND)}</b></div>
      <div><strong>Bước giá:</strong> +${fmtVND(minIncrementVND)}</div>
      ${auctionDetailCID ? `<div><strong>Link:</strong> <a href="${formatCidLink(auctionDetailCID)}" target="_blank" rel="noreferrer">${shortCID(auctionDetailCID)}</a></div>` : ""}
      ${highestBidder && highestBidder !== ethers.constants.AddressZero ? `<div><strong>Giá hiện tại:</strong> <b>${fmtVND(currentPriceVND)}</b> — người dẫn: ${shorten(highestBidder)}</div>` : `<div><strong>Giá hiện tại:</strong> <b>${fmtVND(currentPriceVND)}</b></div>`}
    `;

    // Actions
    const actionsWrap = node.querySelector(".auction-actions");
    const btnJoin = actionsWrap.querySelector('[data-action="join"]');
    const btnBack = actionsWrap.querySelector('[data-action="back"]');
    const btnWl = node.querySelector(".btn-update-whitelist");
    const btnBid = node.querySelector(".btn-bid");

    btnJoin.onclick = () => focusAuction(id);
    btnBack.onclick = clearFocus;
    btnBack.classList.toggle("hidden", !opts.showBack);

    // Organizer can update whitelist before cutoff
    const now = Math.floor(Date.now()/1000);
    const organizerCanUpdate = isOrganizer && !finalized && now <= Number(depositCutoff);
    btnWl.classList.toggle("hidden", !organizerCanUpdate);
    if (organizerCanUpdate) btnWl.onclick = () => openUpdateWhitelistModal(id, depositCutoff);

    // Whitelisted user can bid only within auction time window
    const canShowBid = !!userAddr && !!canBid && status === 1 && !finalized && now >= Number(auctionStart) && now <= Number(auctionEnd);
    btnBid.classList.toggle("hidden", !canShowBid);
    if (canShowBid) btnBid.onclick = () => openBidModal(id, currentPriceVND, minIncrementVND, auctionStart, auctionEnd, startingPriceVND);

    node.querySelector(".auc-open-onchain").href = `${CFG.EXPLORER}/address/${CFG.AUCTION_ADDR}`;
    return node;
  } catch (e) {
    console.error("renderOneAuctionCard", id, e);
    return null;
  }
}

/** ================= Guide ================= **/
async function openGuide() {
  try {
    const r = await fetch("mota-daugia.md", { cache: "no-store" });
    const txt = r.ok ? await r.text() : "Không đọc được hướng dẫn.";
    const m = modal(`
      <h3>Hướng dẫn</h3>
      <div style="max-height:60vh;overflow:auto">
        <pre style="white-space:pre-wrap">${escapeHtml(txt)}</pre>
      </div>
      <div class="actions"><button class="btn" id="g_close">Đóng</button></div>
    `);
    m.querySelector("#g_close").onclick = () => m.remove();
  } catch {
    alert("Không đọc được hướng dẫn.");
  }
}

/** ================= Utils ================= **/
async function ensureConnected(){ if (!signer || !userAddr) await connectWallet(); }

function modal(innerHTML){
  // backdrop
  const wrap = document.createElement("div");
  wrap.className="__modal";
  wrap.innerHTML = `
    <div class="__modal-backdrop"></div>
    <div class="__modal-box">
      <div class="__modal-inner">
        ${innerHTML}
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // lock body scroll
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  // close when click backdrop
  const backdrop = wrap.querySelector(".__modal-backdrop");
  backdrop.addEventListener("click", () => closeModal());

  // close helper
  function closeModal(){
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    wrap.remove();
  }
  // expose remove for callers
  wrap.remove = closeModal;

  // focus first input
  setTimeout(() => {
    const firstInput = wrap.querySelector("input, textarea, select, button");
    if (firstInput) firstInput.focus({ preventScroll: false });
  }, 50);

  // ESC to close
  window.addEventListener("keydown", function esc(e){
    if (e.key === "Escape"){
      closeModal();
      window.removeEventListener("keydown", esc);
    }
  });

  return wrap;
}

function shorten(a){ return a ? a.slice(0,6)+"..."+a.slice(-4) : "—"; }
function shortCID(cid){ const s=String(cid); return s.length>22 ? s.slice(0,10)+'…'+s.slice(-8) : s; }
function formatCidLink(x){ const s=String(x).trim(); return /^https?:\/\//.test(s) ? s : `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\//,'')}`; }
function toUnix(dt){ if(!dt) return 0; return Math.floor(new Date(dt).getTime()/1000); }
function toBN(n){ const s=String(n||"0").trim(); return ethers.BigNumber.from(s||"0"); }
function fmtTime(ts){ if(!ts) return "—"; return new Date(Number(ts)*1000).toLocaleString(); }
function fmtVND(x){ try{ const n=ethers.BigNumber.from(x).toString(); return Number(n).toLocaleString("vi-VN")+" VND"; }catch{return String(x)+" VND";} }
function statusText(s,fin,fail){ const m={0:"PENDING",1:"ACTIVE",2:"ENDED",3:"FINALIZED",4:"FAILED"}; if(fin) return fail?"FAILED":"FINALIZED"; return m[s]??"UNKNOWN"; }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
