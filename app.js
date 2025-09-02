/* =============================================================
   daugia.vin — app.js (phí nền tảng 1 USD & gas nhanh)
   Đồng bộ index.html tối giản
   ============================================================= */

/** ============= Cấu hình ============= **/
const CFG = window.DGV_CONFIG || {
  CHAIN_ID_HEX: "0x58",
  RPC_URL: "https://rpc.viction.xyz",
  EXPLORER: "https://vicscan.xyz",
  AUCTION_ADDR: "0x1765e20ecB8cD78688417A6d4123f2b899775599",
  VIN_ADDR: "0x941F63807401efCE8afe3C9d88d368bAA287Fac4"
};

const ABI = [
  // View
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

/** ============= Biến trạng thái ============= **/
let readonlyProvider, provider, signer, userAddr;
let auction, vin;
let vinDecimals = 18, vinSymbol = "VIN";
let lastVinUsd = NaN; // Nhận từ index qua event "vin-price"

/** ============= Khởi tạo ============= **/
bootstrap();

async function bootstrap() {
  readonlyProvider = new ethers.providers.JsonRpcProvider(CFG.RPC_URL);
  provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : readonlyProvider;

  auction = new ethers.Contract(CFG.AUCTION_ADDR, ABI, readonlyProvider);

  // Nhận giá VIN/USD từ index.html (VIC/USDT × 100)
  window.addEventListener("vin-price", (ev) => {
    const p = ev.detail?.priceUsd;
    if (typeof p === "number" && isFinite(p)) lastVinUsd = p;
  });

  wireUIEvents();
  await renderAllAuctions();

  if (window.ethereum) {
    const accs = await provider.listAccounts();
    if (accs && accs.length) await connectWallet().catch(()=>{});
  }
}

/** ============= Sự kiện từ index ============= **/
function wireUIEvents() {
  window.addEventListener("do-connect", connectWallet);
  window.addEventListener("do-disconnect", disconnectWallet);
  window.addEventListener("do-register", onRegisterOneUsd);
  window.addEventListener("open-create", openCreateModal);
  window.addEventListener("do-search", doSearch);
  window.addEventListener("open-guide", openGuide);
}

/** ============= Wallet ============= **/
async function connectWallet() {
  if (!window.ethereum) return alert("Vui lòng cài MetaMask.");
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
      console.error(e);
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
  try { vinSymbol = await vin.symbol(); } catch {}

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
  auction = new ethers.Contract(CFG.AUCTION_ADDR, ABI, readonlyProvider);
  dispatchWalletState({ connected: false, registered: false });
  await renderAllAuctions();
}

async function refreshWalletPanel() {
  if (!signer || !userAddr) {
    dispatchWalletState({ connected: false, registered: false });
    return;
  }
  // Balances
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

function dispatchWalletState(detail) {
  window.dispatchEvent(new CustomEvent("wallet-state", { detail }));
}

/** ============= Phí nền tảng 1 USD & gas nhanh ============= **/
// Tính số VIN (wei) tương ứng 1 USD, rồi lấy max với platformFeeVIN() nếu có
async function getRequiredPlatformFeeWei() {
  if (!(typeof lastVinUsd === "number" && lastVinUsd > 0)) {
    throw new Error("Chưa có giá VIN/USD. Hãy đợi chip giá hiển thị.");
  }
  // 1 USD / (USD per VIN) = VIN cần
  const vinNeed = 1 / lastVinUsd; // VIN (số thập phân)
  const vinNeedWei = ethers.utils.parseUnits(vinNeed.toString(), vinDecimals);

  let feeOnChain = ethers.constants.Zero;
  try { feeOnChain = await auction.platformFeeVIN(); } catch {}
  return feeOnChain.gt(vinNeedWei) ? feeOnChain : vinNeedWei;
}

// Đảm bảo allowance đủ (>= 1 USD bằng VIN hoặc fee on-chain nếu lớn hơn)
async function ensurePlatformFeeAllowance() {
  const required = await getRequiredPlatformFeeWei();
  const cur = await vin.allowance(userAddr, CFG.AUCTION_ADDR);
  if (cur.gte(required)) return;

  const txReq = await vin.populateTransaction.approve(CFG.AUCTION_ADDR, required);
  const rc = await sendFast(txReq);
  return rc;
}

// Gửi giao dịch “nhanh”: gasLimit +50%, fee ×3 (fallback gasPrice=100 gwei)
async function sendFast(txReq) {
  // Ước lượng gas
  try {
    const est = await signer.estimateGas(txReq);
    txReq.gasLimit = est.mul(150).div(100); // +50%
  } catch {}
  // Phí
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

/** ============= Đăng ký (thu 1 USD bằng VIN) ============= **/
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

/** ============= Tạo phiên (thu 1 USD bằng VIN) ============= **/
function openCreateModal() {
  ensureConnected().then(async () => {
    const registered = await auction.registeredOrganizer(userAddr).catch(()=>false);
    if (!registered) return alert("Bạn chưa đăng ký.");
    const m = modal(`
      <h3>Tạo cuộc đấu giá</h3>
      <div class="grid2">
        <div class="row"><label>Khung xem - Bắt đầu</label><input id="c_sv" type="datetime-local" class="input"></div>
        <div class="row"><label>Khung xem - Kết thúc</label><input id="c_ev" type="datetime-local" class="input"></div>
        <div class="row"><label>Nộp cọc - Bắt đầu</label><input id="c_ds" type="datetime-local" class="input"></div>
        <div class="row"><label>Hạn cập nhật whitelist</label><input id="c_dc" type="datetime-local" class="input"></div>
        <div class="row"><label>Phiên - Bắt đầu</label><input id="c_as" type="datetime-local" class="input"></div>
        <div class="row"><label>Phiên - Kết thúc</label><input id="c_ae" type="datetime-local" class="input"></div>
      </div>
      <div class="grid3">
        <div class="row"><label>Giá khởi điểm (VND)</label><input id="c_sp" type="number" min="0" step="1" class="input"></div>
        <div class="row"><label>Bước giá tối thiểu (VND)</label><input id="c_step" type="number" min="1" step="1" class="input"></div>
        <div class="row"><label>Tiền cọc (VND)</label><input id="c_dep" type="number" min="0" step="1" class="input"></div>
      </div>
      <div class="row"><label>CID chi tiết (IPFS)</label><input id="c_cid" class="input" placeholder="CID/IPFS URL"></div>
      <div class="actions">
        <button class="btn" id="c_cancel">Hủy</button>
        <button class="btn primary" id="c_ok">Tạo</button>
      </div>
    `);
    m.querySelector("#c_cancel").onclick = () => m.remove();
    m.querySelector("#c_ok").onclick = async () => {
      try {
        await ensurePlatformFeeAllowance();
        const sv = toUnix(m.querySelector("#c_sv").value);
        const ev = toUnix(m.querySelector("#c_ev").value);
        const ds = toUnix(m.querySelector("#c_ds").value);
        const dc = toUnix(m.querySelector("#c_dc").value);
        const as = toUnix(m.querySelector("#c_as").value);
        const ae = toUnix(m.querySelector("#c_ae").value);
        const sp = toBN(m.querySelector("#c_sp").value);
        const step = toBN(m.querySelector("#c_step").value);
        const dep = toBN(m.querySelector("#c_dep").value);
        const cid = (m.querySelector("#c_cid").value || "").trim().replace(/^ipfs:\/\//, "");

        if (!(sv && ev && ds && dc && as && ae)) throw new Error("Thiếu mốc thời gian");
        if (!(sv <= ev && ev <= dc && dc <= as && as < ae)) throw new Error("Thứ tự thời gian không hợp lệ");
        if (step.lte(0)) throw new Error("Bước giá phải > 0");

        const txReq = await auction.populateTransaction.createAuction(sv, ev, ds, dc, as, ae, sp, step, dep, cid);
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

/** ============= Cập nhật whitelist (thu 1 USD bằng VIN) ============= **/
function openUpdateWhitelistModal(auctionId) {
  const m = modal(`
    <h3>Cập nhật whitelist (#${auctionId})</h3>
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

/** ============= Bỏ giá (thu 1 USD bằng VIN) ============= **/
function openBidModal(auctionId, currentPriceVND, minIncrementVND) {
  const minNext = ethers.BigNumber.from(currentPriceVND).add(minIncrementVND);
  const m = modal(`
    <h3>Bỏ giá (#${auctionId})</h3>
    <p class="muted small">Mức tối thiểu hợp lệ: <b>${fmtVND(minNext)}</b></p>
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
      if (val.lt(minNext)) throw new Error("Số tiền phải >= mức tối thiểu.");

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

/** ============= Tìm kiếm & hiển thị ============= **/
async function doSearch() {
  const q = (document.getElementById("searchQuery").value || "").trim();
  if (!q) { await renderAllAuctions(); return; }
  const wrap = document.getElementById("auctionList");
  wrap.innerHTML = `<div class="skeleton">Đang tìm…</div>`;

  try {
    if (/^\d+$/.test(q)) {
      const card = await renderOneAuctionCard(Number(q));
      wrap.innerHTML = "";
      if (card) wrap.appendChild(card); else wrap.innerHTML = `<div class="empty">Không tìm thấy #${q}.</div>`;
      return;
    }
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
    for (let id = total; id >= 1; id--) {
      const card = await renderOneAuctionCard(id);
      if (card) wrap.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="empty">Không thể tải dữ liệu.</div>`;
  }
}

async function renderOneAuctionCard(id) {
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
      <div><strong>Khung xem:</strong> ${fmtTime(startView)} → ${fmtTime(endView)}</div>
      <div><strong>Nộp cọc:</strong> ${fmtTime(depositStart)} → <b>${fmtTime(depositCutoff)}</b></div>
      <div><strong>Phiên:</strong> ${fmtTime(auctionStart)} → <b>${fmtTime(auctionEnd)}</b> &nbsp; <span class="chip">Trạng thái: ${statusText(status, finalized, failed)}</span></div>
      <div><strong>Giá khởi điểm:</strong> ${fmtVND(startingPriceVND)}</div>
      <div><strong>Bước giá:</strong> +${fmtVND(minIncrementVND)}</div>
      <div><strong>Tiền cọc:</strong> ${fmtVND(depositAmountVND)}</div>
      <div><strong>Giá hiện tại:</strong> <b>${fmtVND(currentPriceVND)}</b>${highestBidder && highestBidder !== ethers.constants.AddressZero ? ` — người dẫn: ${shorten(highestBidder)}` : ""}</div>
      ${auctionDetailCID ? `<div><strong>CID:</strong> <a href="https://ipfs.io/ipfs/${auctionDetailCID}" target="_blank" rel="noreferrer">${auctionDetailCID}</a></div>` : ""}
    `;

    const btnWl = node.querySelector(".btn-update-whitelist");
    const btnBid = node.querySelector(".btn-bid");
    btnWl.dataset.auctionId = String(id);
    btnBid.dataset.auctionId = String(id);

    const now = Math.floor(Date.now()/1000);
    const organizerCanUpdate = isOrganizer && !finalized && now <= Number(depositCutoff);
    btnWl.classList.toggle("hidden", !organizerCanUpdate);
    if (organizerCanUpdate) btnWl.onclick = () => openUpdateWhitelistModal(id);

    const canShowBid = !!userAddr && !!canBid && status === 1 && !finalized;
    btnBid.classList.toggle("hidden", !canShowBid);
    if (canShowBid) btnBid.onclick = () => openBidModal(id, currentPriceVND, minIncrementVND);

    node.querySelector(".auc-open-onchain").href = `${CFG.EXPLORER}/address/${CFG.AUCTION_ADDR}`;
    return node;
  } catch (e) {
    console.error("renderOneAuctionCard", id, e);
    return null;
  }
}

/** ============= Hướng dẫn ============= **/
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

/** ============= Tiện ích chung ============= **/
async function ensureConnected(){ if (!signer || !userAddr) await connectWallet(); }

function modal(innerHTML){
  const wrap = document.createElement("div");
  wrap.style.position="fixed"; wrap.style.inset="0"; wrap.style.background="rgba(0,0,0,.5)";
  wrap.style.display="flex"; wrap.style.alignItems="center"; wrap.style.justifyContent="center"; wrap.style.zIndex="100";
  const box = document.createElement("div");
  box.style.background="var(--bg-card)"; box.style.border="1px solid var(--border)"; box.style.borderRadius="12px";
  box.style.padding="16px"; box.style.minWidth="320px"; box.style.maxWidth="94vw"; box.style.boxShadow="0 12px 40px rgba(0,0,0,.45)";
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">${innerHTML}</div>
    <style>
      .row{display:flex;flex-direction:column;gap:6px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
      @media (max-width:768px){ .grid2,.grid3{grid-template-columns:1fr} }
      input,textarea{padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text)}
      .actions{display:flex;gap:8px;justify-content:flex-end}
    </style>`;
  wrap.appendChild(box);
  wrap.addEventListener("click",(e)=>{ if(e.target===wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  return wrap;
}

function shorten(a){ return a ? a.slice(0,6)+"..."+a.slice(-4) : "—"; }
function toUnix(dt){ if(!dt) return 0; return Math.floor(new Date(dt).getTime()/1000); }
function toBN(n){ const s=String(n||"0").trim(); return ethers.BigNumber.from(s||"0"); }
function fmtTime(ts){ if(!ts) return "—"; return new Date(Number(ts)*1000).toLocaleString(); }
function fmtVND(x){ try{ const n=ethers.BigNumber.from(x).toString(); return Number(n).toLocaleString("vi-VN")+" VND"; }catch{return String(x)+" VND";} }
function statusText(s,fin,fail){ const m={0:"PENDING",1:"ACTIVE",2:"ENDED",3:"FINALIZED",4:"FAILED"}; if(fin) return fail?"FAILED":"FINALIZED"; return m[s]??"UNKNOWN"; }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
