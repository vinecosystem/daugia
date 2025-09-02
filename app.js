/* =============================================================
   daugia.vin — app.js (Full)
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Token: VIN    @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
   Library: ethers v5 UMD (window.ethers)

   Tính năng:
   - Kết nối ví, auto reconnect, auto switch chain VIC (88)
   - Thêm mạng VIC, thêm token VIN
   - Hiển thị số dư VIC/VIN, giá VIN theo USD (VIC/USDT * 100)
   - Watchlist địa chỉ creator, tìm kiếm nhanh
   - Render danh sách đấu giá (getAllAuctions)
   - Tạo đấu giá (createAuction/startAuction...) — linh hoạt
   - Đặt giá (bid/placeBid/makeBid...) — linh hoạt, auto-approve VIN
   - Đăng ký/cọc (register/stake/enroll...) — nếu hợp đồng có
   - Gas-safe: ước lượng gas, nhân hệ số an toàn
   ============================================================= */

/* ------------------ Cấu hình cố định ------------------ */
const { CHAIN_ID_HEX, RPC_URL, EXPLORER, AUCTION_ADDR, VIN_ADDR } = window.DGV_CONFIG;

let provider, signer, userAddress;
let vinContract, auctionContract;
let vinDecimals = 18;

/* ------------------ ABI cơ bản & linh hoạt ------------------ */
// ERC20 (VIN)
const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Auction (tối thiểu)
const auctionBaseAbi = [
  // danh sách đấu giá
  "function getAllAuctions() view returns (tuple(uint256 id,address creator,uint256 startPrice,uint256 highestBid,address highestBidder,bool active)[])"
];

// Các biến thể tên hàm (không phải hợp đồng nào cũng giống)
const auctionFlexibleAbi = [
  // tạo đấu giá
  "function createAuction(uint256 startPrice) returns (uint256)",
  "function createAuction(uint256 startPrice,uint256 duration) returns (uint256)",
  "function startAuction(uint256 startPrice) returns (uint256)",
  "function startAuction(uint256 startPrice,uint256 duration) returns (uint256)",
  // đặt giá
  "function bid(uint256 auctionId,uint256 amount)",
  "function placeBid(uint256 auctionId,uint256 amount)",
  "function makeBid(uint256 auctionId,uint256 amount)",
  // đăng ký/cọc
  "function register()",
  "function stake()",
  "function enroll()"
];

// Gộp ABI (không lỗi dù hàm không tồn tại, chỉ cần gọi try/catch khi dùng)
const auctionAbi = [...auctionBaseAbi, ...auctionFlexibleAbi];

/* ------------------ Khởi tạo trang ------------------ */
window.onload = async () => {
  // Provider
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
  } else {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }

  // Contracts (read-only lúc đầu)
  vinContract = new ethers.Contract(VIN_ADDR, erc20Abi, provider);
  auctionContract = new ethers.Contract(AUCTION_ADDR, auctionAbi, provider);

  // Giá VIN & watchlist
  await loadVinPrice().catch(()=>{});
  renderWatchList();

  // Tạo panel hành động (UI động, không cần đổi index.html)
  injectActionPanel();

  // Tự kết nối nếu đã cấp quyền
  tryAutoConnect();

  // Render danh sách đấu giá (read-only)
  renderAuctions().catch(()=>{});
};

/* ------------------ Kết nối ví / Chain ------------------ */
async function connectWallet() {
  try {
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    // gắn lại contracts với signer
    vinContract     = new ethers.Contract(VIN_ADDR, erc20Abi, signer);
    auctionContract = new ethers.Contract(AUCTION_ADDR, auctionAbi, signer);

    // đảm bảo chain VIC
    await ensureVicChain();

    // UI
    document.getElementById("accountShort").textContent = shorten(userAddress);
    document.getElementById("linkVicScan").href = `${EXPLORER}/address/${userAddress}`;
    document.getElementById("networkName").textContent = "Viction (88)";

    await updateBalances().catch(()=>{});
    await renderAuctions().catch(()=>{});
  } catch (err) {
    console.error("Lỗi connect:", err);
    alert("Kết nối ví thất bại. Vui lòng thử lại.");
  }
}
document.getElementById("btnConnect").addEventListener("click", connectWallet);

// Auto reconnect nếu đã có tài khoản
async function tryAutoConnect() {
  if (!window.ethereum) return;
  const accounts = await provider.listAccounts();
  if (accounts && accounts.length) {
    await connectWallet();
  }
}

// Lắng nghe thay đổi tài khoản/chain
if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", async () => {
    try { await connectWallet(); } catch (_) {}
  });
  window.ethereum.on?.("chainChanged", () => {
    // reload để đồng bộ provider/signer hoàn toàn
    window.location.reload();
  });
}

// Đảm bảo chain VIC
async function ensureVicChain() {
  if (!window.ethereum) return;
  try {
    const net = await provider.getNetwork();
    if (net.chainId !== 88) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }]
      });
    }
  } catch (err) {
    // nếu chưa add chain
    if (err?.code === 4902) {
      await addVicNetwork();
    } else {
      console.warn("ensureVicChain:", err);
    }
  }
}

/* ------------------ Thêm mạng & token ------------------ */
async function addVicNetwork() {
  if (!window.ethereum) return alert("Vui lòng dùng MetaMask để thêm mạng VIC.");
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_ID_HEX,
        chainName: "Viction",
        rpcUrls: [RPC_URL],
        nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 },
        blockExplorerUrls: [EXPLORER]
      }]
    });
  } catch (e) {
    console.error("addVicNetwork error:", e);
  }
}

async function addVinToken() {
  if (!window.ethereum) return alert("Vui lòng dùng MetaMask để thêm token.");
  try {
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: VIN_ADDR,
          symbol: "VIN",
          decimals: vinDecimals || 18,
          image: window.location.origin + "/vin128.png"
        }
      }
    });
  } catch (e) {
    console.error("addVinToken error:", e);
  }
}

document.getElementById("btnAddNetwork")?.addEventListener("click", (e) => {
  e.preventDefault(); addVicNetwork();
});
document.getElementById("btnAddToken")?.addEventListener("click", (e) => {
  e.preventDefault(); addVinToken();
});

/* ------------------ Số dư & Giá ------------------ */
async function updateBalances() {
  if (!userAddress) return;
  try {
    const vicBal = await provider.getBalance(userAddress);
    document.getElementById("vicBalance").textContent = ethers.utils.formatEther(vicBal);

    vinDecimals = await vinContract.decimals().catch(()=>18);
    const vinBal = await vinContract.balanceOf(userAddress);
    document.getElementById("vinBalance").textContent = ethers.utils.formatUnits(vinBal, vinDecimals);
  } catch (err) {
    console.error("Lỗi balances:", err);
  }
}

// Giá VIN theo USD (VIC/USDT * 100 VIC)
async function loadVinPrice() {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT");
    const data = await res.json();
    const vicPrice = parseFloat(data.price);
    if (!isFinite(vicPrice)) throw new Error("No VIC price");
    const vinPrice = vicPrice * 100; // 1 VIN = 100 VIC
    document.getElementById("vinUsdValue").textContent = vinPrice.toFixed(2);
  } catch {
    document.getElementById("vinUsdValue").textContent = "—";
  }
}

/* ------------------ Tìm kiếm & Watchlist ------------------ */
document.getElementById("btnSearch").addEventListener("click", () => {
  const addr = document.getElementById("inputCreator").value.trim();
  if (!ethers.utils.isAddress(addr)) {
    alert("Địa chỉ không hợp lệ!");
    return;
  }
  // Ở bản đầy đủ, bạn có thể gọi contract để lọc theo creator.
  alert("Đang tìm cuộc đấu giá của: " + addr);
});

function getWatchList() {
  return JSON.parse(localStorage.getItem("watchList") || "[]");
}

function setWatchList(arr) {
  localStorage.setItem("watchList", JSON.stringify(arr));
  renderWatchList();
}

function renderWatchList() {
  const list = getWatchList();
  const container = document.getElementById("watchList");
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class="empty">Chưa có mục nào. Hãy thêm bằng nút “Theo dõi”.</div>`;
    return;
  }
  list.forEach(addr => {
    const item = document.createElement("div");
    item.className = "watch-item";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.padding = "8px 0";
    item.innerHTML = `
      <span>${shorten(addr)}</span>
      <a href="${EXPLORER}/address/${addr}" target="_blank" rel="noreferrer">VicScan</a>
    `;
    container.appendChild(item);
  });
}

document.getElementById("btnFollow").addEventListener("click", () => {
  const addr = document.getElementById("inputCreator").value.trim();
  if (!ethers.utils.isAddress(addr)) return alert("Địa chỉ không hợp lệ!");
  let list = getWatchList();
  if (!list.includes(addr)) {
    list.push(addr);
    setWatchList(list);
  }
});

document.getElementById("btnUnfollow").addEventListener("click", () => {
  const addr = document.getElementById("inputCreator").value.trim();
  let list = getWatchList();
  list = list.filter(a => a.toLowerCase() !== addr.toLowerCase());
  setWatchList(list);
});

/* ------------------ Render danh sách đấu giá ------------------ */
async function renderAuctions() {
  const wrap = document.getElementById("auctionList");
  if (!wrap) return;
  wrap.innerHTML = `<div class="skeleton">Đang tải dữ liệu…</div>`;

  try {
    const data = await auctionContract.getAllAuctions();
    if (!data || !data.length) {
      wrap.innerHTML = `<div class="empty">Chưa có cuộc đấu giá nào đang mở.</div>`;
      return;
    }

    vinDecimals = await vinContract.decimals().catch(()=>18);

    wrap.innerHTML = "";
    data.forEach(a => {
      const id            = a.id?.toString?.() ?? a[0]?.toString?.() ?? "-";
      const creator       = a.creator ?? a[1] ?? "0x";
      const startPriceRaw = a.startPrice ?? a[2] ?? "0";
      const highestBidRaw = a.highestBid ?? a[3] ?? "0";
      const highestBidder = a.highestBidder ?? a[4] ?? "0x";
      const active        = (a.active ?? a[5]) ? true : false;

      const startPrice = ethers.utils.formatUnits(startPriceRaw, vinDecimals);
      const highestBid = ethers.utils.formatUnits(highestBidRaw, vinDecimals);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-head">
          <h4>Cuộc đấu giá #${id}</h4>
          <p class="muted">Trạng thái: ${active ? "Đang mở" : "Đã đóng"}</p>
        </div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:6px">
            <div><strong>Người tạo:</strong> ${shorten(creator)} &nbsp; <a href="${EXPLORER}/address/${creator}" target="_blank">VicScan</a></div>
            <div><strong>Giá khởi điểm:</strong> ${startPrice} VIN</div>
            <div><strong>Giá cao nhất:</strong> ${highestBid} VIN</div>
            <div><strong>Người đang dẫn:</strong> ${/^0x0{40}$/i.test(highestBidder) ? "—" : shorten(highestBidder)}</div>
          </div>
        </div>
        <div class="card-foot">
          <button class="btn" data-bid data-id="${id}">Đặt giá (Bid)</button>
          <a class="btn ghost" href="${EXPLORER}/address/${AUCTION_ADDR}" target="_blank" rel="noreferrer">Hợp đồng</a>
        </div>
      `;
      wrap.appendChild(card);
    });

    // gán sự kiện bid cho từng thẻ
    wrap.querySelectorAll("[data-bid]").forEach(btn => {
      btn.addEventListener("click", () => openBidModal(btn.getAttribute("data-id")));
    });
  } catch (err) {
    console.error("renderAuctions error:", err);
    wrap.innerHTML = `<div class="empty">Không thể tải danh sách đấu giá (kiểm tra ABI/hợp đồng).</div>`;
  }
}

/* ------------------ Panel hành động (UI động) ------------------ */
function injectActionPanel() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.right = "16px";
  panel.style.bottom = "16px";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "10px";
  panel.style.zIndex = "20";

  const btnCreate = document.createElement("button");
  btnCreate.className = "btn primary";
  btnCreate.textContent = "Tạo đấu giá";
  btnCreate.onclick = openCreateModal;

  const btnRegister = document.createElement("button");
  btnRegister.className = "btn";
  btnRegister.textContent = "Đăng ký / Cọc";
  btnRegister.onclick = tryRegister;

  panel.appendChild(btnCreate);
  panel.appendChild(btnRegister);
  document.body.appendChild(panel);
}

/* ------------------ Modal helpers ------------------ */
function openCreateModal() {
  const modal = basicModal(`
    <h3>Tạo đấu giá</h3>
    <div class="row">
      <label>Giá khởi điểm (VIN):</label>
      <input id="m_startPrice" type="number" min="0" step="0.000000000000000001" placeholder="vd: 10" />
    </div>
    <div class="row">
      <label>Thời gian (giây, tùy chọn):</label>
      <input id="m_duration" type="number" min="0" step="1" placeholder="vd: 1800" />
    </div>
    <div class="actions">
      <button id="m_ok" class="btn primary">Tạo</button>
      <button id="m_cancel" class="btn">Hủy</button>
    </div>
  `);

  modal.querySelector("#m_cancel").onclick = () => modal.remove();
  modal.querySelector("#m_ok").onclick = async () => {
    const startPrice = modal.querySelector("#m_startPrice").value.trim();
    const duration   = modal.querySelector("#m_duration").value.trim();
    try {
      await createAuctionFlow(startPrice, duration);
      modal.remove();
      setTimeout(()=>renderAuctions(), 1200);
    } catch (e) {
      alert("Tạo đấu giá thất bại. Xem console để biết chi tiết.");
      console.error(e);
    }
  };
}

function openBidModal(auctionId = "") {
  const modal = basicModal(`
    <h3>Đặt giá (Bid)</h3>
    <div class="row">
      <label>ID cuộc đấu giá:</label>
      <input id="b_id" type="number" min="0" step="1" value="${auctionId || ""}" />
    </div>
    <div class="row">
      <label>Số VIN muốn bid:</label>
      <input id="b_amount" type="number" min="0" step="0.000000000000000001" placeholder="vd: 12.5" />
    </div>
    <div class="actions">
      <button id="b_ok" class="btn primary">Xác nhận</button>
      <button id="b_cancel" class="btn">Hủy</button>
    </div>
  `);

  modal.querySelector("#b_cancel").onclick = () => modal.remove();
  modal.querySelector("#b_ok").onclick = async () => {
    const id  = modal.querySelector("#b_id").value.trim();
    const amt = modal.querySelector("#b_amount").value.trim();
    try {
      await bidFlow(id, amt);
      modal.remove();
      setTimeout(()=>renderAuctions(), 1200);
    } catch (e) {
      alert("Bid thất bại. Xem console để biết chi tiết.");
      console.error(e);
    }
  };
}

function basicModal(innerHTML) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "50";

  const box = document.createElement("div");
  box.style.background = "var(--bg-card)";
  box.style.border = "1px solid var(--border)";
  box.style.borderRadius = "12px";
  box.style.minWidth = "320px";
  box.style.maxWidth = "92vw";
  box.style.padding = "16px";
  box.style.boxShadow = "0 12px 40px rgba(0,0,0,.5)";
  box.innerHTML = `
    <div class="modal-inner" style="display:flex;flex-direction:column;gap:12px">
      ${innerHTML}
    </div>
    <style>
      .modal-inner label{display:block;margin-bottom:6px;color:var(--text-soft)}
      .modal-inner input{
        width:100%;padding:10px;border:1px solid var(--border);
        border-radius:10px;background:var(--bg);color:var(--text)
      }
      .modal-inner .row{display:flex;flex-direction:column;gap:6px}
      .modal-inner .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
    </style>
  `;

  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

/* ------------------ Flows: create / bid / register ------------------ */
// Gas helper (v5): ước lượng rồi nhân biên
async function sendTxWithBuffer(populateTxFn, overrides = {}) {
  const txReq = await populateTxFn();
  // Merge overrides (nếu có)
  Object.assign(txReq, overrides);

  // Ước lượng gas
  const gasEstimate = await signer.estimateGas(txReq);
  txReq.gasLimit = gasEstimate.mul(ethers.BigNumber.from(125)).div(100); // +25%

  // Phí (EIP-1559 hoặc gasPrice)
  try {
    const feeData = await provider.getFeeData();
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      txReq.maxFeePerGas = feeData.maxFeePerGas.mul(125).div(100); // +25%
      txReq.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(125).div(100);
    } else if (feeData.gasPrice) {
      txReq.gasPrice = feeData.gasPrice.mul(125).div(100);
    }
  } catch {}

  const tx = await signer.sendTransaction(txReq);
  return await tx.wait();
}

// Đảm bảo allowance VIN đủ cho spender (AUCTION_ADDR)
async function ensureAllowanceVIN(requiredAmountWei) {
  const allowance = await vinContract.allowance(userAddress, AUCTION_ADDR);
  if (allowance.gte(requiredAmountWei)) return;

  const toApprove = requiredAmountWei;
  const populate = async () =>
    vinContract.populateTransaction.approve(AUCTION_ADDR, toApprove);

  const receipt = await sendTxWithBuffer(populate);
  return receipt;
}

// Tạo đấu giá
async function createAuctionFlow(startPriceVin, durationSec) {
  if (!signer) await connectWallet();

  // chuyển VIN → wei
  vinDecimals = await vinContract.decimals().catch(()=>18);
  const priceWei = ethers.utils.parseUnits(String(startPriceVin || "0"), vinDecimals);

  // dò tên hàm tạo
  const createCandidates = [
    { name: "createAuction", args: [priceWei] },
    { name: "createAuction", args: [priceWei, ethers.BigNumber.from(String(durationSec || 0))] },
    { name: "startAuction",  args: [priceWei] },
    { name: "startAuction",  args: [priceWei, ethers.BigNumber.from(String(durationSec || 0))] },
  ];

  const contract = auctionContract.connect(signer);
  let lastErr;

  for (const c of createCandidates) {
    if (!contract[c.name]) continue;
    try {
      const populate = async () => contract.populateTransaction[c.name](...c.args);
      const receipt = await sendTxWithBuffer(populate);
      alert(`Tạo đấu giá thành công! Tx: ${receipt.transactionHash.slice(0,10)}…`);
      return receipt;
    } catch (e) {
      lastErr = e;
      // thử biến thể tiếp theo
    }
  }
  console.error("createAuctionFlow error:", lastErr);
  throw lastErr || new Error("Không tìm thấy hàm tạo đấu giá phù hợp.");
}

// Đặt giá (Bid)
async function bidFlow(auctionId, amountVin) {
  if (!signer) await connectWallet();

  vinDecimals = await vinContract.decimals().catch(()=>18);
  const amountWei = ethers.utils.parseUnits(String(amountVin || "0"), vinDecimals);

  // Bảo đảm allowance
  await ensureAllowanceVIN(amountWei);

  const bidCandidates = [
    { name: "bid",      args: [ethers.BigNumber.from(String(auctionId)), amountWei] },
    { name: "placeBid", args: [ethers.BigNumber.from(String(auctionId)), amountWei] },
    { name: "makeBid",  args: [ethers.BigNumber.from(String(auctionId)), amountWei] },
  ];

  const contract = auctionContract.connect(signer);
  let lastErr;

  for (const c of bidCandidates) {
    if (!contract[c.name]) continue;
    try {
      const populate = async () => contract.populateTransaction[c.name](...c.args);
      const receipt = await sendTxWithBuffer(populate);
      alert(`Bid thành công! Tx: ${receipt.transactionHash.slice(0,10)}…`);
      return receipt;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("bidFlow error:", lastErr);
  throw lastErr || new Error("Không tìm thấy hàm đặt giá phù hợp.");
}

// Đăng ký / Cọc (nếu hợp đồng có)
async function tryRegister() {
  if (!signer) await connectWallet();
  const contract = auctionContract.connect(signer);
  const candidates = ["register", "stake", "enroll"];
  let lastErr;

  for (const name of candidates) {
    if (!contract[name]) continue;
    try {
      const populate = async () => contract.populateTransaction[name]();
      const receipt = await sendTxWithBuffer(populate);
      alert(`Thành công: ${name}. Tx: ${receipt.transactionHash.slice(0,10)}…`);
      return receipt;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) {
    console.error("tryRegister error:", lastErr);
    alert("Hợp đồng có thể không yêu cầu đăng ký/cọc hoặc tên hàm khác.");
  } else {
    alert("Không tìm thấy hàm đăng ký/cọc trên hợp đồng.");
  }
}

/* ------------------ Tiện ích nhỏ ------------------ */
function shorten(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "—";
}
