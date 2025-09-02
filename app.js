/* =============================================================
   daugia.vin — app.js (UI 2 trạng thái, bám sát ABI DauGia)
   Chain: Viction (VIC / chainId 88)
   Hợp đồng DauGia: getAuction, getOrganizerAuctions, registerOrganizer,
   createAuction, updateWhitelist, placeBid, isWhitelistedBidder, ...
   ============================================================= */

/** ================= CẤU HÌNH CHUNG ================= **/
const CFG = window.DGV_CONFIG || {
  CHAIN_ID_HEX: "0x58",
  RPC_URL: "https://rpc.viction.xyz",
  EXPLORER: "https://vicscan.xyz",
  AUCTION_ADDR: "0x1765e20ecB8cD78688417A6d4123f2b899775599",
  VIN_ADDR: "0x941F63807401efCE8afe3C9d88d368bAA287Fac4"
};

// ABI: load từ file JSON (nếu có), fallback sang mảng tối thiểu
let ABIAuction = null;
const ABI_MIN = [
  // view
  "function totalAuctions() view returns (uint256)",
  "function getAuction(uint256) view returns (address,uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint256,uint256,address,bool,bool,string)",
  "function getOrganizerAuctions(address) view returns (uint256[])",
  "function getStatus(uint256) view returns (uint8)", // 0=PENDING,1=ACTIVE,2=ENDED,3=FINALIZED,4=FAILED
  "function platformFeeVIN() view returns (uint256)",
  "function registeredOrganizer(address) view returns (bool)",
  "function vinToken() view returns (address)",
  "function isWhitelistedBidder(uint256,address) view returns (bool)",

  // tx
  "function registerOrganizer(string profileCID)",
  "function createAuction(uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint256,string) returns (uint256)",
  "function updateWhitelist(uint256,address[],string[])",
  "function placeBid(uint256,uint256)"
];

const ABI_ERC20 = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function symbol() view returns (string)"
];

/** ================= BIẾN TOÀN CỤC ================= **/
let provider, readonlyProvider;
let signer, user;
let auction, vin;
let vinDecimals = 18;
let vinSymbol = "VIN";

/** ================= KHỞI TẠO ================= **/
bootstrap();

async function bootstrap() {
  // Provider read-only luôn sẵn
  readonlyProvider = new ethers.providers.JsonRpcProvider(CFG.RPC_URL);
  provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : readonlyProvider;

  // Tải ABI nếu có file DauGia_ABI.json
  try {
    const res = await fetch("DauGia_ABI.json", { cache: "no-store" });
    if (res.ok) {
      ABIAuction = await res.json();
    }
  } catch (_) {}
  if (!ABIAuction) ABIAuction = ABI_MIN;

  // Tạo contract ở chế độ read-only
  auction = new ethers.Contract(CFG.AUCTION_ADDR, ABIAuction, readonlyProvider);

  // Đọc giá VIN (nếu không lấy được thì để —, không chặn UI)
  loadVinPrice().catch(()=>{});

  // Render danh sách đấu giá công khai
  await renderAllAuctions().catch(console.error);

  // Gắn listeners cho các event từ index.html
  wireUIEvents();

  // Auto-connect (nếu từng cấp quyền)
  if (window.ethereum) {
    const accs = await provider.listAccounts();
    if (accs && accs.length) await connectWallet().catch(()=>{});
  }
}

/** ================= SỰ KIỆN TỪ INDEX ================= **/
function wireUIEvents() {
  window.addEventListener("do-connect", () => connectWallet());
  window.addEventListener("do-disconnect", () => disconnectWallet());
  window.addEventListener("do-register", () => openRegisterModal());
  window.addEventListener("open-create", () => openCreateModal());
  window.addEventListener("do-search", () => doSearch());
  window.addEventListener("open-guide", () => openGuide());
}

/** ================= KẾT NỐI VÍ & CHUỖI ================= **/
async function connectWallet() {
  if (!window.ethereum) {
    alert("Vui lòng cài MetaMask để kết nối ví.");
    return;
  }
  // Yêu cầu tài khoản
  await provider.send("eth_requestAccounts", []);
  // Đảm bảo chain VIC
  try {
    const net = await provider.getNetwork();
    if (net.chainId !== 88) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CFG.CHAIN_ID_HEX }]
      });
    }
  } catch (e) {
    // Nếu chain chưa có -> add
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
  user = await signer.getAddress();

  // Rebind contract với signer
  auction = auction.connect(signer);

  // Lấy VIN token address từ contract (nếu khác CFG.VIN_ADDR thì tuân theo on-chain)
  try {
    const vinAddrOnChain = await auction.vinToken();
    vin = new ethers.Contract(vinAddrOnChain, ABI_ERC20, signer);
  } catch {
    vin = new ethers.Contract(CFG.VIN_ADDR, ABI_ERC20, signer);
  }

  // VIN metadata
  try {
    vinDecimals = await vin.decimals();
  } catch {}
  try {
    vinSymbol = await vin.symbol();
  } catch {}

  // Lắng nghe thay đổi
  if (window.ethereum && !window.__dgvBound) {
    window.__dgvBound = true;
    window.ethereum.on?.("accountsChanged", () => window.location.reload());
    window.ethereum.on?.("chainChanged", () => window.location.reload());
  }

  // Cập nhật UI ví & quyền
  await refreshWalletState();

  // Render lại để hiện nút theo vai trò (organizer/bidder)
  await renderAllAuctions().catch(()=>{});
}

async function disconnectWallet() {
  // Không có API "disconnect" thực sự; ta reset sang read-only
  provider = readonlyProvider;
  signer = null;
  user = null;
  auction = new ethers.Contract(CFG.AUCTION_ADDR, ABIAuction, readonlyProvider);
  dispatchWalletState({ connected: false, registered: false });
  // Render lại (ẩn các nút hành động)
  await renderAllAuctions().catch(()=>{});
}

/** ================= TRẠNG THÁI VÍ & SỐ DƯ ================= **/
async function refreshWalletState() {
  if (!signer || !user) {
    dispatchWalletState({ connected: false, registered: false });
    return;
  }
  // Balances
  let vicBal = "—", vinBal = "—";
  try {
    const vic = await provider.getBalance(user);
    vicBal = ethers.utils.formatEther(vic);
  } catch {}
  try {
    const bal = await vin.balanceOf(user);
    vinBal = ethers.utils.formatUnits(bal, vinDecimals);
  } catch {}

  // Registered?
  let registered = false;
  try {
    registered = await auction.registeredOrganizer(user);
  } catch {}

  dispatchWalletState({
    connected: true,
    registered,
    networkName: "Viction (88)",
    accountShort: shorten(user),
    accountExplorer: `${CFG.EXPLORER}/address/${user}`,
    vicBalance: vicBal,
    vinBalance: vinBal
  });
}

function dispatchWalletState(detail) {
  window.dispatchEvent(new CustomEvent("wallet-state", { detail }));
}

/** ================= GIÁ VIN THEO USD ================= **/
async function loadVinPrice() {
  // Không có oracle chính thức => thử lấy giá VIC/USDT rồi để “—” nếu không chắc.
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT");
    const data = await res.json();
    const vicUsd = parseFloat(data?.price);
    if (!isFinite(vicUsd)) throw new Error("no VIC price");
    // Không giả định tỷ lệ VIN↔VIC. Chỉ hiển thị “—” nếu không có nguồn đáng tin cho VIN.
    // Bạn có thể thay bằng API giá VIN riêng khi có.
    window.dispatchEvent(new CustomEvent("vin-price", { detail: { priceUsd: NaN } }));
  } catch {
    window.dispatchEvent(new CustomEvent("vin-price", { detail: { priceUsd: NaN } }));
  }
}

/** ================= TÌM KIẾM ================= **/
async function doSearch() {
  const q = (document.getElementById("searchQuery").value || "").trim();
  if (!q) {
    await renderAllAuctions();
    return;
  }

  const listWrap = document.getElementById("auctionList");
  listWrap.innerHTML = `<div class="skeleton">Đang tìm…</div>`;

  try {
    // 1) nếu là số -> tìm theo ID
    if (/^\d+$/.test(q)) {
      const id = ethers.BigNumber.from(q).toNumber();
      const card = await renderOneAuctionCard(id);
      listWrap.innerHTML = "";
      if (card) listWrap.appendChild(card); else listWrap.innerHTML = `<div class="empty">Không tìm thấy ID #${id}.</div>`;
      return;
    }
    // 2) nếu là địa chỉ -> lấy danh sách phiên của organizer
    if (ethers.utils.isAddress(q)) {
      const ids = await auction.getOrganizerAuctions(q);
      listWrap.innerHTML = "";
      if (!ids || !ids.length) {
        listWrap.innerHTML = `<div class="empty">Organizer chưa có phiên nào.</div>`;
        return;
      }
      for (const id of ids) {
        const card = await renderOneAuctionCard(ethers.BigNumber.from(id).toNumber());
        if (card) listWrap.appendChild(card);
      }
      return;
    }

    // 3) chuỗi tự do -> duyệt tất cả, lọc theo CID (chứa q) — đơn giản
    const total = (await auction.totalAuctions()).toNumber();
    const matches = [];
    for (let id = total; id >= 1; id--) {
      const info = await auction.getAuction(id);
      const cid = info[14] || ""; // auctionDetailCID
      if (String(cid).toLowerCase().includes(q.toLowerCase())) matches.push(id);
    }
    listWrap.innerHTML = "";
    if (!matches.length) {
      listWrap.innerHTML = `<div class="empty">Không thấy kết quả phù hợp.</div>`;
      return;
    }
    for (const id of matches) {
      const card = await renderOneAuctionCard(id);
      if (card) listWrap.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    listWrap.innerHTML = `<div class="empty">Lỗi tìm kiếm.</div>`;
  }
}

/** ================= RENDER DANH SÁCH PHIÊN ================= **/
async function renderAllAuctions() {
  const listWrap = document.getElementById("auctionList");
  listWrap.innerHTML = `<div class="skeleton">Đang tải dữ liệu…</div>`;

  try {
    const total = (await auction.totalAuctions()).toNumber();
    listWrap.innerHTML = "";
    if (!total) {
      listWrap.innerHTML = `<div class="empty">Chưa có cuộc đấu giá nào.</div>`;
      return;
    }
    // hiển thị từ mới nhất
    for (let id = total; id >= 1; id--) {
      const card = await renderOneAuctionCard(id);
      if (card) listWrap.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    listWrap.innerHTML = `<div class="empty">Không thể tải danh sách (kiểm tra RPC/ABI/hợp đồng).</div>`;
  }
}

async function renderOneAuctionCard(id) {
  try {
    const info = await auction.getAuction(id);
    // Map fields theo ABI getAuction(...)
    const [
      organizer,
      startView, endView, depositStart, depositCutoff,
      auctionStart, auctionEnd,
      startingPriceVND, minIncrementVND, depositAmountVND,
      currentPriceVND, highestBidder,
      finalized, failed, auctionDetailCID
    ] = info;

    const status = await auction.getStatus(id); // 0..4
    const isOrganizer = user && organizer?.toLowerCase() === user.toLowerCase();

    // kiểm tra whitelist cho người dùng (nếu đã đăng ký & đã kết nối ví)
    let canBid = false;
    if (user) {
      try { canBid = await auction.isWhitelistedBidder(id, user); } catch {}
    }

    // clone template
    const tpl = document.getElementById("tpl-auction-card");
    const node = tpl.content.firstElementChild.cloneNode(true);

    // tiêu đề + meta
    node.querySelector(".auc-title").textContent = `Cuộc đấu giá #${id}`;
    node.querySelector(".auc-id").textContent = `#${id}`;
    const aOrg = node.querySelector(".auc-organizer");
    aOrg.textContent = shorten(organizer);
    aOrg.href = `${CFG.EXPLORER}/address/${organizer}`;

    // meta (thời gian & giá)
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

    // mô tả chi tiết (thử fetch IPFS nếu có)
    const detail = node.querySelector(".auc-detail");
    if (auctionDetailCID) {
      try {
        const r = await fetch(`https://ipfs.io/ipfs/${auctionDetailCID}`, { cache: "no-store" });
        if (r.ok) {
          const txt = await r.text();
          detail.innerHTML = `<pre style="white-space:pre-wrap">${escapeHtml(txt.slice(0, 2000))}${txt.length>2000?"\n...":""}</pre>`;
        }
      } catch {}
    }

    // Hành động theo vai trò
    const btnWl = node.querySelector(".btn-update-whitelist");
    const btnBid = node.querySelector(".btn-bid");
    btnWl.dataset.auctionId = String(id);
    btnBid.dataset.auctionId = String(id);

    // Organizer: hiện "Cập nhật whitelist" nếu chưa quá cutoff & chưa finalized
    const now = Math.floor(Date.now()/1000);
    const organizerCanUpdate = isOrganizer && !finalized && now <= Number(depositCutoff);
    btnWl.classList.toggle("hidden", !organizerCanUpdate);
    if (organizerCanUpdate) {
      btnWl.onclick = () => openUpdateWhitelistModal(id);
    }

    // Bidder đã đăng ký + whitelist + phiên ACTIVE (status==1) + chưa finalized
    const canShowBid = !!user && !!canBid && status === 1 && !finalized;
    btnBid.classList.toggle("hidden", !canShowBid);
    if (canShowBid) {
      btnBid.onclick = () => openBidModal(id, currentPriceVND, minIncrementVND);
    }

    // Link onchain
    node.querySelector(".auc-open-onchain").href = `${CFG.EXPLORER}/address/${CFG.AUCTION_ADDR}`;

    return node;
  } catch (e) {
    console.error("renderOneAuctionCard", id, e);
    return null;
  }
}

/** ================= MODALS: Đăng ký / Tạo / Whitelist / Bid / Guide ================= **/
function openRegisterModal() {
  const m = modal(`
    <h3>Đăng ký tổ chức</h3>
    <p class="muted small">Phí: <b>platformFeeVIN</b> (${vinSymbol}) sẽ bị thu khi gửi giao dịch.</p>
    <div class="row">
      <label>Profile CID (tùy chọn)</label>
      <input id="rg_cid" class="input" placeholder="ipfs://... hoặc để trống" />
    </div>
    <div class="actions">
      <button class="btn" id="rg_cancel">Hủy</button>
      <button class="btn primary" id="rg_ok">Đăng ký</button>
    </div>
  `);
  m.querySelector("#rg_cancel").onclick = () => m.remove();
  m.querySelector("#rg_ok").onclick = async () => {
    try {
      await ensureConnected();
      const fee = await auction.platformFeeVIN();
      await ensureAllowanceVIN(fee);
      const cid = (m.querySelector("#rg_cid").value || "").trim();
      const tx = await auction.registerOrganizer(cid);
      await tx.wait();
      alert("Đăng ký thành công!");
      m.remove();
      await refreshWalletState();
    } catch (e) {
      console.error(e);
      alert("Đăng ký thất bại.");
    }
  };
}

function openCreateModal() {
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
      <div class="row"><label>Giá khởi điểm (VND)</label><input id="c_sp" type="number" min="0" step="1" class="input" placeholder="vd: 1000000"></div>
      <div class="row"><label>Bước giá tối thiểu (VND)</label><input id="c_step" type="number" min="1" step="1" class="input" placeholder="vd: 100000"></div>
      <div class="row"><label>Tiền cọc (VND)</label><input id="c_dep" type="number" min="0" step="1" class="input" placeholder="vd: 5000000"></div>
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
      await ensureConnected();
      const fee = await auction.platformFeeVIN();
      await ensureAllowanceVIN(fee);

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

      // Kiểm tra logic thời gian & step
      if (!(sv && ev && ds && dc && as && ae)) throw new Error("Thiếu mốc thời gian");
      if (!(sv <= ev && ev <= dc && dc <= as && as < ae)) throw new Error("Thứ tự thời gian không hợp lệ");
      if (step.lte(0)) throw new Error("Bước giá phải > 0");

      const tx = await auction.createAuction(
        sv, ev, ds, dc, as, ae,
        sp, step, dep,
        cid
      );
      const rc = await tx.wait();
      alert("Tạo phiên thành công!");
      m.remove();
      await renderAllAuctions();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Tạo phiên thất bại.");
    }
  };
}

function openUpdateWhitelistModal(auctionId) {
  const m = modal(`
    <h3>Cập nhật whitelist (#${auctionId})</h3>
    <p class="muted small">Dán danh sách ví (mỗi dòng 1 địa chỉ). Trường chứng cứ (UNC proof CID) có thể để trống hoặc điền cùng số dòng.</p>
    <div class="row"><label>Địa chỉ ví</label><textarea id="w_addrs" class="input" rows="6" placeholder="0xabc...\n0xdef..."></textarea></div>
    <div class="row"><label>UNC proof CIDs (tùy chọn)</label><textarea id="w_unc" class="input" rows="4" placeholder="cid1\ncid2"></textarea></div>
    <div class="actions">
      <button class="btn" id="w_cancel">Hủy</button>
      <button class="btn primary" id="w_ok">Cập nhật</button>
    </div>
  `);
  m.querySelector("#w_cancel").onclick = () => m.remove();
  m.querySelector("#w_ok").onclick = async () => {
    try {
      await ensureConnected();
      const fee = await auction.platformFeeVIN();
      await ensureAllowanceVIN(fee);

      const addrs = (m.querySelector("#w_addrs").value || "")
        .split(/[\s,;]+/).map(v => v.trim()).filter(Boolean);
      if (!addrs.length) throw new Error("Chưa có địa chỉ nào.");

      // lọc địa chỉ hợp lệ
      const bidders = addrs.filter(a => {
        try { return ethers.utils.isAddress(a); } catch { return false; }
      });
      if (!bidders.length) throw new Error("Không có địa chỉ hợp lệ.");

      const unc = (m.querySelector("#w_unc").value || "")
        .split(/[\r\n]+/).map(v => v.trim()).filter(Boolean);

      // unc có thể rỗng hoặc cùng độ dài với bidders
      const uncCIDs = (unc.length === 0 || unc.length === bidders.length) ? unc : [];

      const tx = await auction.updateWhitelist(auctionId, bidders, uncCIDs);
      await tx.wait();
      alert("Cập nhật whitelist thành công!");
      m.remove();
      await renderAllAuctions();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Cập nhật whitelist thất bại.");
    }
  };
}

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
      const fee = await auction.platformFeeVIN();
      await ensureAllowanceVIN(fee);

      const val = toBN(m.querySelector("#b_amt").value);
      if (val.lt(minNext)) throw new Error("Số tiền phải >= mức tối thiểu.");

      const tx = await auction.placeBid(auctionId, val);
      await tx.wait();
      alert("Đặt giá thành công!");
      m.remove();
      await renderAllAuctions();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Đặt giá thất bại.");
    }
  };
}

async function openGuide() {
  // Đọc file mô tả để hiển thị hướng dẫn
  try {
    const r = await fetch("mota-daugia.md", { cache: "no-store" });
    const txt = r.ok ? await r.text() : "Không đọc được hướng dẫn.";
    modal(`
      <h3>Hướng dẫn</h3>
      <div style="max-height:60vh;overflow:auto">
        <pre style="white-space:pre-wrap">${escapeHtml(txt)}</pre>
      </div>
      <div class="actions"><button class="btn" id="g_close">Đóng</button></div>
    `).querySelector("#g_close").onclick = (e)=> e.currentTarget.closest(".__modal").remove();
  } catch {
    alert("Không đọc được hướng dẫn.");
  }
}

/** ================= HỖ TRỢ GỬI TX: APPROVE VIN ================= **/
async function ensureAllowanceVIN(requiredWei) {
  if (!vin || !user) throw new Error("Chưa kết nối ví.");
  const cur = await vin.allowance(user, CFG.AUCTION_ADDR);
  if (cur.gte(requiredWei)) return;
  const tx = await vin.approve(CFG.AUCTION_ADDR, requiredWei);
  await tx.wait();
}

/** ================= TIỆN ÍCH UI ================= **/
function modal(innerHTML) {
  const wrap = document.createElement("div");
  wrap.className = "__modal";
  wrap.style.position = "fixed";
  wrap.style.inset = "0";
  wrap.style.background = "rgba(0,0,0,.5)";
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.zIndex = "100";

  const box = document.createElement("div");
  box.style.background = "var(--bg-card)";
  box.style.border = "1px solid var(--border)";
  box.style.borderRadius = "12px";
  box.style.padding = "16px";
  box.style.minWidth = "320px";
  box.style.maxWidth = "94vw";
  box.style.boxShadow = "0 12px 40px rgba(0,0,0,.45)";
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${innerHTML}
    </div>
    <style>
      .__modal .row{display:flex;flex-direction:column;gap:6px}
      .__modal .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .__modal .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
      @media (max-width:768px){ .__modal .grid2,.__modal .grid3{grid-template-columns:1fr} }
      .__modal input,.__modal textarea{
        padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text)
      }
      .__modal .actions{display:flex;gap:8px;justify-content:flex-end}
    </style>
  `;
  wrap.appendChild(box);
  wrap.addEventListener("click", (e)=> { if (e.target===wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  return wrap;
}

function shorten(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
function toUnix(datetimeLocal) {
  if (!datetimeLocal) return 0;
  const d = new Date(datetimeLocal);
  return Math.floor(d.getTime()/1000);
}
function toBN(n) {
  const v = String(n || "0").trim();
  return ethers.BigNumber.from(v || "0");
}
function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts) * 1000);
  // GMT+7 hiển thị theo time locale của trình duyệt
  return d.toLocaleString();
}
function fmtVND(x) {
  try {
    const n = ethers.BigNumber.from(x).toString();
    return Number(n).toLocaleString("vi-VN") + " VND";
  } catch {
    return String(x) + " VND";
  }
}
function statusText(s, finalized, failed) {
  const map = {0:"PENDING",1:"ACTIVE",2:"ENDED",3:"FINALIZED",4:"FAILED"};
  if (finalized) return failed ? "FAILED" : "FINALIZED";
  return map[s] ?? "UNKNOWN";
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

/* =============================================================
   HẾT FILE
   Ghi chú: Code này bám đúng ABI:
   - registerOrganizer(string) — đăng ký tổ chức (thu phí VIN)  :contentReference[oaicite:4]{index=4}
   - createAuction(...) — tạo phiên với mốc thời gian, giá & CID  :contentReference[oaicite:5]{index=5}
   - updateWhitelist(uint256,address[],string[]) — organizer cập nhật ví đã cọc (đến cutoff)  :contentReference[oaicite:6]{index=6}
   - placeBid(uint256,uint256) — người trong whitelist bỏ giá trong khung ACTIVE  :contentReference[oaicite:7]{index=7}
   - getAuction/getOrganizerAuctions/isWhitelistedBidder/totalAuctions — render UI  :contentReference[oaicite:8]{index=8}
   - platformFeeVIN/vinToken — đảm bảo approve VIN trước khi gọi các hàm thu phí  :contentReference[oaicite:9]{index=9}
   - UI/luồng theo tài liệu mô tả  :contentReference[oaicite:10]{index=10}
   ============================================================= */
