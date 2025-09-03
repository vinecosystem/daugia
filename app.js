/* =============================================================
   daugia.vin — app.js (auction-ready with standard create form)
   - Stable wallet connect (MetaMask, chainId 88 – Viction)
   - Show addr (short), VIC & VIN balances
   - Register → single CTA on toolbar ("Tạo cuộc đấu giá")
   - All actions charge 1 USD in VIN (pricing independent from UI)
   - Create form: 10 sections (organizer, seller, times, bank, prices…)
     + Auto-generate Markdown description from form
     + Export .txt to pin IPFS → paste CID to create
   - Each auction card:
     + "Tham gia": focus view to this auction (with "Quay lại danh sách")
     + Organizer: "Cập nhật ví đã cọc" (before cutoff)
     + Whitelisted: "Bỏ giá" (only within auction time window)
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
let vinDecimals = 18, vinSymbol = "VIN";

// Pricing for FEES ONLY (independent of index.html UI)
let lastVinUsd = NaN;     // USD per VIN
let lastPriceUpdatedAt = 0;

// Focused auction view (after "Tham gia")
let activeAuctionId = null;

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

  // Internal price loop (independent of UI)
  await refreshVinPriceForApp();
  setInterval(refreshVinPriceForApp, 60000);

  // Wire UI events
  wireUIEvents();
  window.addEventListener("wallet-state", handleWalletStateUI);

  // Render as guest
  await renderAllAuctions();

  // Auto connect if already authorized
  if (window.ethereum) {
    const accs = await provider.listAccounts().catch(()=>[]);
    if (accs && accs.length) await connectWallet().catch(()=>{});
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
    lastVinUsd = vicUsd * 100; // VIN = VIC * 100
    lastPriceUpdatedAt = Date.now();
  } catch (e) {
    console.warn("refreshVinPriceForApp:", e?.message || e);
  }
}
async function ensureVinPrice() {
  if (!(lastVinUsd > 0) || (Date.now() - lastPriceUpdatedAt > 120000)) {
    await refreshVinPriceForApp();
  }
  if (!(lastVinUsd > 0)) throw new Error("Không lấy được giá VIN/USD để tính phí. Vui lòng thử lại.");
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

  // Single CTA on toolbar
  const btnRegister = document.getElementById("btnRegister");
  const btnCreate = document.getElementById("btnCreateAuction");

  // Connection toggle
  if (s.connected) {
    btnConnect?.classList.add("hidden");
    btnDisconnect?.classList.remove("hidden");
    walletPanel?.style && (walletPanel.style.display = "block");
  } else {
    btnConnect?.classList.remove("hidden");
    btnDisconnect?.classList.add("hidden");
    walletPanel?.style && (walletPanel.style.display = "none");
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
  await ensureVinPrice(); // fetch if missing/stale
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

/** ================= Register (charge 1 USD in VIN) ================= **/
async function onRegisterOneUsd() {
  try {
    await ensureConnected();
    await ensurePlatformFeeAllowance();

    const txReq = await auction.populateTransaction.registerOrganizer("");
    await sendFast(txReq);

    alert("Đăng ký thành công!");
    await refreshWalletPanel(); // CTA changes to "Tạo cuộc đấu giá"
  } catch (e) {
    console.error(e);
    alert(e?.message || "Đăng ký thất bại.");
  }
}

/** ================= Create auction (charge 1 USD in VIN) ================= **/
function openCreateModal() {
  ensureConnected().then(async () => {
    const registered = await auction.registeredOrganizer(userAddr).catch(()=>false);
    if (!registered) return alert("Bạn chưa đăng ký.");

    const m = modal(`
      <h3>Tạo cuộc đấu giá</h3>

      <!-- 1) Đơn vị tổ chức -->
      <div class="card">
        <div class="card-head"><h4>1) Thông tin đơn vị tổ chức đấu giá</h4></div>
        <div class="card-body grid2">
          <div class="row"><label>Tên đơn vị (bắt buộc)</label><input id="org_name" class="input" placeholder="Công ty Đấu giá ABC *"></div>
          <div class="row"><label>Địa chỉ (tuỳ chọn)</label><input id="org_addr" class="input" placeholder="Số, đường, phường/xã, quận/huyện, tỉnh/thành"></div>
          <div class="row"><label>Số điện thoại (tuỳ chọn)</label><input id="org_phone" class="input" placeholder="+84…"></div>
          <div class="row"><label>Email (tuỳ chọn)</label><input id="org_email" class="input" placeholder="email@domain.com"></div>
          <div class="row"><label>Website (tuỳ chọn)</label><input id="org_web" class="input" placeholder="https://…"></div>
          <div class="row"><label>Mã số thuế / GPKD (tuỳ chọn)</label><input id="org_tax" class="input" placeholder="0101xxxxxxx"></div>
        </div>
      </div>

      <!-- 2) Bên bán -->
      <div class="card">
        <div class="card-head"><h4>2) Thông tin bên bán tài sản</h4></div>
        <div class="card-body grid2">
          <div class="row"><label>Tên đơn vị (bắt buộc)</label><input id="sell_name" class="input" placeholder="Công ty/Bên bán *"></div>
          <div class="row"><label>Địa chỉ (tuỳ chọn)</label><input id="sell_addr" class="input"></div>
          <div class="row"><label>Số điện thoại (tuỳ chọn)</label><input id="sell_phone" class="input"></div>
          <div class="row"><label>Email (tuỳ chọn)</label><input id="sell_email" class="input"></div>
          <div class="row"><label>Website (tuỳ chọn)</label><input id="sell_web" class="input"></div>
          <div class="row"><label>Mã số thuế / GPKD (tuỳ chọn)</label><input id="sell_tax" class="input"></div>
        </div>
      </div>

      <!-- 3-7) Mốc thời gian -->
      <div class="card">
        <div class="card-head"><h4>3-7) Thời gian</h4></div>
        <div class="card-body grid2">
          <div class="row"><label>3) Thời gian xem tài sản - Bắt đầu</label><input id="c_sv" type="datetime-local" class="input"></div>
          <div class="row"><label>3) Thời gian xem tài sản - Kết thúc</label><input id="c_ev" type="datetime-local" class="input"></div>
          <div class="row"><label>4) Thời gian nộp tiền đặt cọc - Bắt đầu</label><input id="c_ds" type="datetime-local" class="input"></div>
          <div class="row"><label>5) Hạn cập nhật ví đã đặt cọc</label><input id="c_dc" type="datetime-local" class="input"></div>
          <div class="row"><label>7) Thời gian đấu giá - Bắt đầu</label><input id="c_as" type="datetime-local" class="input"></div>
          <div class="row"><label>7) Thời gian đấu giá - Kết thúc</label><input id="c_ae" type="datetime-local" class="input"></div>
        </div>
      </div>

      <!-- 6) Thông tin nhận tiền đặt cọc -->
      <div class="card">
        <div class="card-head"><h4>6) Thông tin nhận tiền đặt cọc (ngoài chuỗi)</h4></div>
        <div class="card-body grid2">
          <div class="row"><label>Tên chủ tài khoản</label><input id="dep_owner" class="input" placeholder="Nguyễn Văn A"></div>
          <div class="row"><label>Số tài khoản ngân hàng</label><input id="dep_acc" class="input" placeholder="xxxxxxxxxx"></div>
          <div class="row"><label>Tên ngân hàng</label><input id="dep_bank" class="input" placeholder="VCB/TCB/…"></div>
          <div class="row"><label>Nội dung chuyển khoản</label><input id="dep_memo" class="input" placeholder='Mặc định: "Tên + địa chỉ ví VIC"'></div>
        </div>
      </div>

      <!-- 8-10) Giá & cọc -->
      <div class="card">
        <div class="card-head"><h4>8-10) Giá & cọc (VND)</h4></div>
        <div class="card-body grid3">
          <div class="row"><label>8) Giá khởi điểm (VND)</label><input id="c_sp" type="number" min="0" step="1" class="input" placeholder="vd: 100000000"></div>
          <div class="row"><label>9) Bước giá (VND)</label><input id="c_step" type="number" min="1" step="1" class="input" placeholder="vd: 1000000"></div>
          <div class="row"><label>10) Mức tiền đặt cọc (VND)</label><input id="c_dep" type="number" min="0" step="1" class="input" placeholder="vd: 10000000"></div>
        </div>
      </div>

      <!-- Mô tả & CID -->
      <div class="card">
        <div class="card-head"><h4>Mô tả chi tiết & IPFS</h4></div>
        <div class="card-body">
          <div class="row">
            <label>Mô tả chi tiết (tối đa 20.000 ký tự)</label>
            <textarea id="c_desc" class="input" rows="8" maxlength="20000" placeholder="Bạn có thể bấm 'Tạo mô tả từ mẫu' để sinh nội dung chuẩn."></textarea>
          </div>
          <div class="actions" style="justify-content:flex-start;gap:8px;margin-top:8px">
            <button class="btn ghost" id="c_desc_gen">Tạo mô tả từ mẫu</button>
            <button class="btn ghost" id="c_desc_save">Xuất mô tả (.txt)</button>
            <span class="small muted">→ pin IPFS rồi dán CID vào ô dưới</span>
          </div>
          <div class="row" style="margin-top:10px">
            <label>CID chi tiết (IPFS)</label>
            <input id="c_cid" class="input" placeholder="CID/IPFS URL (khuyến nghị)">
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn" id="c_cancel">Hủy</button>
        <button class="btn primary" id="c_ok">Ký & Đăng</button>
      </div>
    `);

    // Generate description from form (Markdown)
    const genDesc = () => {
      const v = (id)=> (m.querySelector("#"+id)?.value || "").trim();
      const md =
`# Thông tin đấu giá

## 1) Đơn vị tổ chức đấu giá
- Tên đơn vị: **${v("org_name")}**
- Địa chỉ: ${v("org_addr")}
- Điện thoại: ${v("org_phone")}
- Email: ${v("org_email")}
- Website: ${v("org_web")}
- MST/GPKD: ${v("org_tax")}

## 2) Bên bán tài sản
- Tên đơn vị: **${v("sell_name")}**
- Địa chỉ: ${v("sell_addr")}
- Điện thoại: ${v("sell_phone")}
- Email: ${v("sell_email")}
- Website: ${v("sell_web")}
- MST/GPKD: ${v("sell_tax")}

## 3) Thời gian xem tài sản
- Bắt đầu: ${v("c_sv")}
- Kết thúc: ${v("c_ev")}

## 4) Thời gian nộp tiền đặt cọc
- Bắt đầu: ${v("c_ds")}

## 5) Hạn cập nhật ví đã đặt cọc
- Trước: ${v("c_dc")}

## 6) Thông tin nhận tiền đặt cọc (ngoài chuỗi)
- Chủ TK: ${v("dep_owner")}
- Số TK: ${v("dep_acc")}
- Ngân hàng: ${v("dep_bank")}
- Nội dung CK: ${v("dep_memo") || 'Tên + địa chỉ ví VIC'}

## 7) Thời gian đấu giá
- Bắt đầu: ${v("c_as")}
- Kết thúc: ${v("c_ae")}

## 8) Giá khởi điểm
- ${v("c_sp")} VND

## 9) Bước giá
- +${v("c_step")} VND / bước

## 10) Mức tiền đặt cọc
- ${v("c_dep")} VND

---

> *Dữ liệu on-chain minh bạch. Mọi người có thể xem và theo dõi tiến trình trên VicScan.*`;
      m.querySelector("#c_desc").value = md;
    };

    // Export description as .txt for IPFS pin
    m.querySelector("#c_desc_save").onclick = () => {
      const txt = m.querySelector("#c_desc").value || "";
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mo-ta-dau-gia.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    m.querySelector("#c_desc_gen").onclick = genDesc;

    m.querySelector("#c_cancel").onclick = () => m.remove();
    m.querySelector("#c_ok").onclick = async () => {
      try {
        // Validate minimal required fields
        const orgName = (m.querySelector("#org_name").value || "").trim();
        const sellName = (m.querySelector("#sell_name").value || "").trim();
        if (!orgName || !sellName) throw new Error("Vui lòng điền tên Đơn vị tổ chức và Bên bán (bắt buộc).");

        const sv = toUnix(m.querySelector("#c_sv").value);
        const ev = toUnix(m.querySelector("#c_ev").value);
        const ds = toUnix(m.querySelector("#c_ds").value);
        const dc = toUnix(m.querySelector("#c_dc").value);
        const as = toUnix(m.querySelector("#c_as").value);
        const ae = toUnix(m.querySelector("#c_ae").value);
        const sp = toBN(m.querySelector("#c_sp").value);
        const step = toBN(m.querySelector("#c_step").value);
        const dep = toBN(m.querySelector("#c_dep").value);
        let cid = (m.querySelector("#c_cid").value || "").trim().replace(/^ipfs:\/\//, "");

        // Logical time constraints:
        // xem: sv<=ev; cọc: ds<=dc; đấu giá: as<ae; và sv<=ev<=dc<=as<ae (chuỗi logic để whitelist/bid đúng thời điểm)
        if (!(sv && ev && ds && dc && as && ae)) throw new Error("Thiếu mốc thời gian.");
        if (!(sv <= ev)) throw new Error("Thời gian xem: bắt đầu phải ≤ kết thúc.");
        if (!(ds <= dc)) throw new Error("Đặt cọc: bắt đầu phải ≤ hạn cập nhật ví.");
        if (!(as < ae)) throw new Error("Đấu giá: bắt đầu phải < kết thúc.");
        if (!(ev <= dc && dc <= as)) throw new Error("Logic thời gian: (xem) ≤ (hạn cập nhật ví) ≤ (đấu giá).");
        if (step.lte(0)) throw new Error("Bước giá phải > 0.");

        // Khuyến nghị CID (không bắt buộc)
        if (!cid) {
          if (!confirm("Bạn chưa nhập CID IPFS cho mô tả. Vẫn tạo phiên (không có mô tả công khai)?")) return;
        }

        // Thu phí VIN (1 USD) + create
        await ensurePlatformFeeAllowance();
        const txReq = await auction.populateTransaction.createAuction(
          sv, ev, ds, dc, as, ae, sp, step, dep, cid
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
function openUpdateWhitelistModal(auctionId) {
  const m = modal(`
    <h3>Cập nhật ví đã đặt cọc (#${auctionId})</h3>
    <p class="small muted">Chỉ cập nhật trước thời điểm "Hạn cập nhật ví". Người có trong danh sách sẽ thấy nút "Bỏ giá" khi tới thời gian đấu giá.</p>
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
function openBidModal(auctionId, currentPriceVND, minIncrementVND, auctionStart, auctionEnd) {
  const now = Math.floor(Date.now()/1000);
  if (!(now >= Number(auctionStart) && now <= Number(auctionEnd))) {
    return alert("Chưa đến hoặc đã qua thời gian đấu giá.");
  }
  const minNext = ethers.BigNumber.from(currentPriceVND).add(minIncrementVND);
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
    // keyword: naive match in CID
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
      <div><strong>Khung xem tài sản:</strong> ${fmtTime(startView)} → ${fmtTime(endView)}</div>
      <div><strong>Nộp tiền đặt cọc:</strong> ${fmtTime(depositStart)} → <b>${fmtTime(depositCutoff)}</b></div>
      <div><strong>Thời gian đấu giá:</strong> ${fmtTime(auctionStart)} → <b>${fmtTime(auctionEnd)}</b> &nbsp; <span class="chip">Trạng thái: ${statusText(status, finalized, failed)}</span></div>
      <div><strong>Giá khởi điểm:</strong> ${fmtVND(startingPriceVND)}</div>
      <div><strong>Bước giá:</strong> +${fmtVND(minIncrementVND)}</div>
      <div><strong>Tiền cọc:</strong> ${fmtVND(depositAmountVND)}</div>
      <div><strong>Giá hiện tại:</strong> <b>${fmtVND(currentPriceVND)}</b>${highestBidder && highestBidder !== ethers.constants.AddressZero ? ` — người dẫn: ${shorten(highestBidder)}` : ""}</div>
      ${auctionDetailCID ? `<div><strong>CID:</strong> <a href="https://ipfs.io/ipfs/${auctionDetailCID}" target="_blank" rel="noreferrer">${auctionDetailCID}</a></div>` : ""}
    `;

    // Actions
    const btnWl = node.querySelector(".btn-update-whitelist");
    const btnBid = node.querySelector(".btn-bid");

    // Thêm nút "Tham gia" (focus view) & "Quay lại danh sách" nếu đang focus
    const actionsWrap = node.querySelector(".auction-actions");
    const btnJoin = document.createElement("button");
    btnJoin.className = "btn";
    btnJoin.textContent = "Tham gia";
    btnJoin.onclick = () => focusAuction(id);
    actionsWrap.prepend(btnJoin);

    if (opts.showBack) {
      const back = document.createElement("button");
      back.className = "btn ghost";
      back.textContent = "Quay lại danh sách";
      back.onclick = clearFocus;
      actionsWrap.prepend(back);
    }

    // Organizer can update whitelist before cutoff
    const now = Math.floor(Date.now()/1000);
    const organizerCanUpdate = isOrganizer && !finalized && now <= Number(depositCutoff);
    btnWl.classList.toggle("hidden", !organizerCanUpdate);
    if (organizerCanUpdate) btnWl.onclick = () => openUpdateWhitelistModal(id);

    // Whitelisted user can bid only within auction time window
    const canShowBid = !!userAddr && !!canBid && status === 1 && !finalized && now >= Number(auctionStart) && now <= Number(auctionEnd);
    btnBid.classList.toggle("hidden", !canShowBid);
    if (canShowBid) btnBid.onclick = () => openBidModal(id, currentPriceVND, minIncrementVND, auctionStart, auctionEnd);

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
  const wrap = document.createElement("div");
  wrap.className="__modal"; wrap.style.position="fixed"; wrap.style.inset="0";
  wrap.style.background="rgba(0,0,0,.5)"; wrap.style.display="flex";
  wrap.style.alignItems="center"; wrap.style.justifyContent="center"; wrap.style.zIndex="100";
  const box = document.createElement("div");
  box.style.background="var(--bg-card)"; box.style.border="1px solid var(--border)";
  box.style.borderRadius="12px"; box.style.padding="16px"; box.style.minWidth="320px"; box.style.maxWidth="94vw";
  box.style.boxShadow="0 12px 40px rgba(0,0,0,.45)";
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">${innerHTML}</div>
    <style>
      .row{display:flex;flex-direction:column;gap:6px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
      @media (max-width:768px){ .grid2,.grid3{grid-template-columns:1fr} }
      input,textarea{padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text)}
      textarea{white-space:pre-wrap}
      .actions{display:flex;gap:8px;justify-content:flex-end}
      .card{border:1px solid var(--border);border-radius:12px;background:var(--bg);overflow:hidden}
      .card-head{padding:10px 12px;border-bottom:1px solid var(--border);font-weight:700}
      .card-body{padding:12px}
      .small{font-size:.9rem}
      .muted{color:#9ca3af}
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
