/* =============================================================
   daugia.vin — app.js (ethers v5 UMD)
   Chain: Viction (VIC, chainId 88), Explorer: vicscan.xyz
   Token: VIN (ERC-20, 18 decimals)

   Mục tiêu:
   - Trạng thái chưa kết nối: hiển thị giá VIN (theo VICUSDT*100), ô tìm kiếm, danh sách đấu giá.
   - Trạng thái đã kết nối: hiện địa chỉ, số dư VIC/VIN, nút Đăng ký 1 USD bằng VIN, mở form tạo đấu giá.
   - Thao tác thẻ đấu giá: Tham gia (filter UI), Bỏ giá (ví đã đặt cọc), Cập nhật ví đã đặt cọc (creator).
   - Khả năng “tự dò ABI”: thử nhiều tên hàm phổ biến để tương thích hợp đồng (anh chỉ cần cập nhật AUCTION_ABI
     hoặc CHOOSE_MAP bên dưới cho đúng thực tế nếu có khác tên).

   Lưu ý:
   - Nếu chưa có ABI chính xác: app vẫn chạy UI/Wallet, nhưng gọi on-chain có thể fail. Xem log & cập nhật map.
   ============================================================= */

/* ==================== Cấu hình & biến toàn cục ==================== */
const CFG = window.DAUGIA_CFG || {};
const {
  CHAIN_ID_HEX = "0x58",
  RPC_URL      = "https://rpc.viction.xyz",
  EXPLORER     = "https://vicscan.xyz",
  AUCTION_ADDR = "",
  VIN_ADDR     = ""
} = CFG;

// Ethers v5 UMD
const { ethers } = window;

// Provider & signer
let roProvider;       // read-only (JSON-RPC)
let provider;         // Web3Provider (sau khi connect)
let signer;           // signer
let userAddress = ""; // địa chỉ ví đang kết nối

// Contracts
let vin;              // ERC20 VIN (read & write)
let auction;          // Hợp đồng Đấu giá (read & write)
let auctionRead;      // Hợp đồng Đấu giá (read-only)

// Trạng thái giá
let vinUsdCache = null;     // số (float) USD / VIN
let vicUsdCache = null;     // số (float) USD / VIC

// Dữ liệu đấu giá (bộ nhớ tạm để render)
let AUCTIONS = [];          // [{id, creator, start, end, depoDeadline, startPrice, step, currentPrice, content, media}]
let CURRENT_FILTER = "all"; // all | upcoming | live | ended
let CURRENT_QUERY  = "";    // từ khoá tìm kiếm

/* =============================================================
   ABI: ERC-20 VIN (tối thiểu cho balance/allowance/approve/decimals)
   ============================================================= */
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

/* =============================================================
   ABI đấu giá (dạng superset). App sẽ thử nhiều hàm phổ biến:
   - Đăng ký: isRegistered(addr) / registered(addr) / registrations(addr)
              register() / register(uint256 vinAmount)
   - Lấy danh sách: getAuctionCount() + auctions(i) / getAuction(i)
                    listAuctions(offset,limit)
   - Tạo mới: createAuction(...) / publishAuction(...) / openAuction(...)
   - Bỏ giá: bid(id, amount) / placeBid(id, amount)
   - Cập nhật ví đặt cọc: updateDepositors(id, address[]) / setDepositors(...)
   Anh có ABI thật thì thay AUCTION_ABI bằng ABI của anh để gọi chính xác.
   ============================================================= */
const AUCTION_ABI = [
  // ------- đăng ký -------
  "function isRegistered(address) view returns (bool)",
  "function registered(address) view returns (bool)",
  "function registrations(address) view returns (bool)",
  "function register()",
  "function register(uint256 vinAmount)",

  // ------- tổng & lấy item -------
  "function getAuctionCount() view returns (uint256)",
  "function getAuction(uint256) view returns (tuple(address creator,uint64 start,uint64 end,uint64 depositClose,uint256 startPrice,uint256 minStep,uint256 currentPrice,string content,string media))",
  "function auctions(uint256) view returns (tuple(address creator,uint64 start,uint64 end,uint64 depositClose,uint256 startPrice,uint256 minStep,uint256 currentPrice,string content,string media))",
  "function listAuctions(uint256 offset,uint256 limit) view returns (tuple(uint256 id,address creator,uint64 start,uint64 end,uint64 depositClose,uint256 startPrice,uint256 minStep,uint256 currentPrice,string content,string media)[])",

  // ------- tạo mới -------
  "function createAuction(uint64 start,uint64 end,uint64 depositClose,uint256 startPrice,uint256 minStep,string content,string media)",
  "function publishAuction(uint64 start,uint64 end,uint64 depositClose,uint256 startPrice,uint256 minStep,string content,string media)",
  "function openAuction(uint64 start,uint64 end,uint64 depositClose,uint256 startPrice,uint256 minStep,string content,string media)",

  // ------- đấu giá -------
  "function bid(uint256 auctionId, uint256 price)",
  "function placeBid(uint256 auctionId, uint256 price)",

  // ------- cập nhật ví đã đặt cọc (creator) -------
  "function updateDepositors(uint256 auctionId, address[] calldata addrs)",
  "function setDepositors(uint256 auctionId, address[] calldata addrs)",

  // ------- view phụ (nếu có) -------
  "function isDepositor(uint256 auctionId, address user) view returns (bool)",
  "function ownerOf(uint256 auctionId) view returns (address)"
];

/* =============================================================
   Map ưu tiên hàm (tự dò) — nếu hợp đồng anh dùng tên khác,
   sửa CHOOSE_MAP bên dưới cho khớp.
   ============================================================= */
const CHOOSE_MAP = {
  view_isRegistered: ["isRegistered", "registered", "registrations"],
  write_register:    ["register(uint256)", "register"],

  view_count:        ["getAuctionCount"],
  view_itemIdx:      ["auctions", "getAuction"],
  view_list:         ["listAuctions"],

  write_create:      ["createAuction", "publishAuction", "openAuction"],

  write_bid:         ["bid", "placeBid"],

  write_setDepos:    ["updateDepositors", "setDepositors"],

  view_isDepositor:  ["isDepositor"]
};

/* ==================== Helpers DOM ==================== */
const $ = (id) => document.getElementById(id);

/* ==================== DOM refs ==================== */
const connectBtn     = $("connectBtn");
const addrShortEl    = $("addrShort");
const balancesBar    = $("balancesBar");
const vicBalEl       = $("vicBalance");
const vinBalEl       = $("vinBalance");
const walletArea     = $("walletArea");
const createForm     = $("createForm");
const openCreateForm = $("openCreateForm");
const btnRegister    = $("btnRegister");
const registerStatus = $("registerStatus");
const btnPublish     = $("btnPublish");
const publishStatus  = $("publishStatus");
const searchInput    = $("searchQuery");
const btnSearch      = $("btnSearch");
const filterStateSel = $("filterState");
const btnReload      = $("btnReload");
const auctionGrid    = $("auctionGrid");
const paginationBox  = $("pagination");
const pageInfo       = $("pageInfo");
const prevPageBtn    = $("prevPage");
const nextPageBtn    = $("nextPage");

const updModal       = $("updateDepositorsModal");
const updClose       = $("updDepoClose");
const updInput       = $("updDepositorsInput");
const updConfirm     = $("updDepositorsConfirm");
const updStatus      = $("updDepositorsStatus");

const walletAddrFull = $("walletAddrFull");

/* =============================================================
   Khởi tạo provider read-only để ai chưa kết nối vẫn xem được
   ============================================================= */
roProvider = new ethers.providers.JsonRpcProvider(RPC_URL);

/* =============================================================
   Tiện ích: chuỗi / BigNumber / format
   ============================================================= */
// Rút gọn địa chỉ ví
function shortAddr(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
// Đổi số -> BigNumber wei theo 18 decimals
function toWei18(n) {
  return ethers.utils.parseUnits(String(n), 18);
}
// Wei -> số thập phân (string)
function fromWei18(bn) {
  try { return ethers.utils.formatUnits(bn, 18); } catch { return "0"; }
}
// thời gian hiện tại (s)
const nowSec = () => Math.floor(Date.now() / 1000);

// Định dạng ngày giờ
function fmtTime(tsSec) {
  if (!tsSec) return "—";
  const d = new Date(tsSec * 1000);
  return d.toLocaleString();
}

/* =============================================================
   Tính giá: VIN/USD theo VICUSDT*100
   - Ưu tiên đọc từ index.html (span#vinUsd), nếu fail thì fetch lại
   ============================================================= */
async function getVinUsd() {
  // đọc từ DOM nếu có
  const el = $("vinUsd");
  if (el && el.textContent && el.textContent !== "Loading price..." && el.textContent !== "N/A") {
    const val = parseFloat(el.textContent);
    if (isFinite(val) && val > 0) {
      vinUsdCache = val;
      vicUsdCache = val / 100; // vì 1 VIN = 100 VIC
      return val;
    }
  }
  // fetch fallback
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT", { cache:"no-store" });
    const data = await res.json();
    const vic = parseFloat(data.price || "0");
    if (vic > 0) {
      vicUsdCache = vic;
      vinUsdCache = vic * 100;
      if (el) el.textContent = vinUsdCache.toFixed(2);
      return vinUsdCache;
    }
  } catch {}
  // cuối cùng
  vinUsdCache = null;
  return null;
}

/* =============================================================
   Chain helpers: ensure chain 88, request switch
   ============================================================= */
async function ensureChain() {
  if (!window.ethereum) return;
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId && chainId.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return true;

  // switch
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }]
    });
    return true;
  } catch (e) {
    // nếu chưa có chain -> add
    if (e && e.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CHAIN_ID_HEX,
            chainName: "Viction",
            nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER]
          }]
        });
        return true;
      } catch (e2) {
        console.warn("add chain failed", e2);
        return false;
      }
    }
    console.warn("switch chain failed", e);
    return false;
  }
}

/* =============================================================
   Gas policy: tăng ~25% cho an toàn
   ============================================================= */
async function gasOverrides() {
  try {
    const feeData = await (provider || roProvider).getFeeData();
    // VIC thường legacy gasPrice
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      const bump = ethers.BigNumber.from(25); // +25%
      const hundred = ethers.BigNumber.from(100);
      const maxFee = feeData.maxFeePerGas.mul(hundred.add(bump)).div(hundred);
      const maxPrio = feeData.maxPriorityFeePerGas.mul(hundred.add(bump)).div(hundred);
      return { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPrio };
    }
    if (feeData.gasPrice) {
      const gp = feeData.gasPrice.mul(125).div(100);
      return { gasPrice: gp };
    }
  } catch {}
  return {}; // fallback
}

/* =============================================================
   Khởi tạo contract instances
   ============================================================= */
function bindContracts(signerOrProvider) {
  vin = new ethers.Contract(VIN_ADDR, ERC20_ABI, signerOrProvider);
  auction = new ethers.Contract(AUCTION_ADDR, AUCTION_ABI, signerOrProvider);
}
function bindReadOnly() {
  auctionRead = new ethers.Contract(AUCTION_ADDR, AUCTION_ABI, roProvider);
}

/* =============================================================
   Dò & gọi hàm động theo tên ưu tiên trong CHOOSE_MAP
   ============================================================= */
function pickFunc(contract, keys) {
  for (const k of keys) {
    if (contract.interface.functions[k]) return k;
    // Cho phép dạng không đầy đủ (ví dụ "register" vs "register()")
    const found = Object.keys(contract.interface.functions).find(sig => sig.split("(")[0] === k);
    if (found) return found;
  }
  return null;
}

async function tryViewRegistered(addr) {
  const key = pickFunc(auctionRead, CHOOSE_MAP.view_isRegistered);
  if (!key) return null;
  try { return await auctionRead[key](addr); } catch { return null; }
}

async function tryRegister(vinAmountWei) {
  const fn = pickFunc(auction, CHOOSE_MAP.write_register);
  if (!fn) throw new Error("Hợp đồng không có hàm register*");
  const ov = await gasOverrides();
  try {
    // Thử truyền amount nếu chữ ký nhận 1 tham số
    if (fn.includes("(uint256")) {
      const tx = await auction[fn](vinAmountWei, ov);
      return await tx.wait();
    }
    // Không tham số
    const tx = await auction[fn](ov);
    return await tx.wait();
  } catch (e) {
    console.error("register failed", e);
    throw e;
  }
}

async function tryGetCount() {
  const fn = pickFunc(auctionRead, CHOOSE_MAP.view_count);
  if (!fn) return null;
  try { return (await auctionRead[fn]()).toNumber(); } catch { return null; }
}

async function tryGetItemByIndex(i) {
  const fn = pickFunc(auctionRead, CHOOSE_MAP.view_itemIdx);
  if (!fn) return null;
  try { return await auctionRead[fn](i); } catch { return null; }
}

async function tryList(offset, limit) {
  const fn = pickFunc(auctionRead, CHOOSE_MAP.view_list);
  if (!fn) return null;
  try { return await auctionRead[fn](offset, limit); } catch { return null; }
}

async function tryCreateAuction(payload) {
  const fn = pickFunc(auction, CHOOSE_MAP.write_create);
  if (!fn) throw new Error("Hợp đồng không có hàm tạo cuộc đấu giá (create/publish/open)");
  const { start, end, depoDeadline, startPriceWei, stepWei, content, media } = payload;
  const ov = await gasOverrides();
  try {
    const tx = await auction[fn](start, end, depoDeadline, startPriceWei, stepWei, content, media, ov);
    return await tx.wait();
  } catch (e) {
    console.error("create auction failed", e);
    throw e;
  }
}

async function tryBid(auctionId, priceWei) {
  const fn = pickFunc(auction, CHOOSE_MAP.write_bid);
  if (!fn) throw new Error("Hợp đồng không có hàm bid/placeBid");
  const ov = await gasOverrides();
  try {
    const tx = await auction[fn](auctionId, priceWei, ov);
    return await tx.wait();
  } catch (e) {
    console.error("bid failed", e);
    throw e;
  }
}

async function trySetDepositors(auctionId, addrs) {
  const fn = pickFunc(auction, CHOOSE_MAP.write_setDepos);
  if (!fn) throw new Error("Hợp đồng không có hàm updateDepositors/setDepositors");
  const ov = await gasOverrides();
  try {
    const tx = await auction[fn](auctionId, addrs, ov);
    return await tx.wait();
  } catch (e) {
    console.error("set depositors failed", e);
    throw e;
  }
}

async function tryIsDepositor(auctionId, addr) {
  const fn = pickFunc(auctionRead, CHOOSE_MAP.view_isDepositor);
  if (!fn) return null;
  try { return await auctionRead[fn](auctionId, addr); } catch { return null; }
}

/* =============================================================
   Wallet: connect / disconnect / balances
   ============================================================= */
async function connectWallet() {
  if (!window.ethereum) {
    alert("Vui lòng cài MetaMask / ví EVM để tiếp tục.");
    return;
  }
  const ok = await ensureChain();
  if (!ok) return;

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  // bind contracts (write)
  bindContracts(signer);
  // bind read
  bindReadOnly();

  // UI
  connectBtn.textContent = "Ngắt kết nối";
  connectBtn.dataset.state = "connected";
  addrShortEl.textContent = shortAddr(userAddress);
  addrShortEl.hidden = false;
  walletAddrFull.textContent = userAddress;
  balancesBar.hidden = false;
  walletArea.hidden = false;

  // balances
  await refreshBalances();

  // đăng ký?
  await refreshRegisterState();

  // open create form button
  openCreateForm.onclick = () => { createForm.hidden = !createForm.hidden; };

  // sự kiện chain/account
  setupWalletListeners();
}

function disconnectWallet() {
  // MetaMask không có API disconnect; ta dọn state & reload UI
  provider = undefined;
  signer = undefined;
  userAddress = "";
  connectBtn.textContent = "Kết nối ví";
  connectBtn.dataset.state = "disconnected";
  addrShortEl.hidden = true;
  walletArea.hidden = true;
  balancesBar.hidden = true;
  // Giữ danh sách đấu giá & search vẫn xem được
}

function setupWalletListeners() {
  if (!window.ethereum) return;
  window.ethereum.removeAllListeners?.("accountsChanged");
  window.ethereum.removeAllListeners?.("chainChanged");

  window.ethereum.on("accountsChanged", async (accs) => {
    if (!accs || !accs.length) { disconnectWallet(); return; }
    userAddress = ethers.utils.getAddress(accs[0]);
    signer = provider.getSigner();
    bindContracts(signer);
    await refreshBalances();
    await refreshRegisterState();
  });

  window.ethereum.on("chainChanged", async () => {
    // refresh để đồng bộ chain
    window.location.reload();
  });
}

async function refreshBalances() {
  try {
    const vicWei = await (provider || roProvider).getBalance(userAddress);
    const vinWei = await vin.balanceOf(userAddress);
    vicBalEl.textContent = parseFloat(ethers.utils.formatEther(vicWei)).toFixed(4);
    vinBalEl.textContent = parseFloat(fromWei18(vinWei)).toFixed(4);
  } catch (e) {
    console.warn("refreshBalances", e);
  }
}

/* =============================================================
   Đăng ký 1 USD bằng VIN
   - Tính 1 USD / (VIN USD) => vinAmount
   - approve nếu allowance thiếu
   - gọi register*(vinAmount?) theo chữ ký tìm được
   ============================================================= */
async function refreshRegisterState() {
  if (!userAddress) return;
  registerStatus.textContent = "";
  btnRegister.hidden = true; // mặc định ẩn, chỉ hiện nếu chưa đăng ký

  const reg = await tryViewRegistered(userAddress);
  if (reg === null) {
    // Không có hàm view — để nút đăng ký hiện, vì contract có thể auto-check trong register()
    btnRegister.hidden = false;
    return;
  }
  if (reg === true) {
    btnRegister.hidden = true;
  } else {
    btnRegister.hidden = false;
  }
}

async function handleRegister() {
  try {
    btnRegister.disabled = true;
    registerStatus.textContent = "Đang tính phí 1 USD bằng VIN…";
    const usdPerVin = await getVinUsd();
    if (!usdPerVin || usdPerVin <= 0) throw new Error("Không lấy được giá VIN/USD");
    const vinNeeded = 1 / usdPerVin; // 1 USD -> bao nhiêu VIN
    const vinWei = toWei18(vinNeeded.toFixed(18));

    // ensure allowance
    const allowance = await vin.allowance(userAddress, AUCTION_ADDR);
    if (allowance.lt(vinWei)) {
      registerStatus.textContent = "Đang approve VIN…";
      const ov = await gasOverrides();
      const approveWei = vinWei.mul(120).div(100); // dư 20%
      const tx = await vin.approve(AUCTION_ADDR, approveWei, ov);
      await tx.wait();
    }

    registerStatus.textContent = "Đang đăng ký…";
    await tryRegister(vinWei);
    registerStatus.textContent = "Đăng ký thành công.";
    btnRegister.hidden = true;
  } catch (e) {
    console.error(e);
    registerStatus.textContent = "Đăng ký thất bại: " + (e?.data?.message || e?.message || "Unknown");
  } finally {
    btnRegister.disabled = false;
  }
}

/* =============================================================
   Tạo cuộc đấu giá
   ============================================================= */
async function handlePublish() {
  try {
    btnPublish.disabled = true;
    publishStatus.textContent = "Đang xử lý…";

    // đọc form
    const startTime = $("startTime").value ? Math.floor(new Date($("startTime").value).getTime()/1000) : 0;
    const endTime   = $("endTime").value   ? Math.floor(new Date($("endTime").value).getTime()/1000)   : 0;
    const depoClose = $("depositCloseTime").value ? Math.floor(new Date($("depositCloseTime").value).getTime()/1000) : 0;

    const startPrice = parseFloat($("startPrice").value || "0");
    const minStep    = parseFloat($("minBidStep").value || "0");
    const content    = $("auctionContent").value || "";
    const media      = $("mediaLinks").value || "";

    if (!startTime || !endTime || endTime <= startTime) throw new Error("Thời gian chưa hợp lệ");
    if (!startPrice || startPrice <= 0) throw new Error("Giá khởi điểm chưa hợp lệ");
    if (!minStep || minStep <= 0) throw new Error("Bước giá chưa hợp lệ");
    if (content.length > 20000) throw new Error("Nội dung vượt 20.000 ký tự");

    // Phí đăng 1 USD VIN (tương tự đăng ký) — nhiều hợp đồng sẽ chỉ cần approve và gọi create
    const usdPerVin = await getVinUsd();
    if (!usdPerVin || usdPerVin <= 0) throw new Error("Không lấy được giá VIN/USD");
    const vinNeed = 1 / usdPerVin;
    const vinWeiNeed = toWei18(vinNeed.toFixed(18));
    const alw = await vin.allowance(userAddress, AUCTION_ADDR);
    if (alw.lt(vinWeiNeed)) {
      publishStatus.textContent = "Đang approve VIN (phí đăng 1 USD)…";
      const ov = await gasOverrides();
      const txA = await vin.approve(AUCTION_ADDR, vinWeiNeed.mul(120).div(100), ov);
      await txA.wait();
    }

    // gọi create
    const payload = {
      start: startTime,
      end: endTime,
      depoDeadline: depoClose || startTime, // nếu không nhập thì lấy startTime
      startPriceWei: toWei18(startPrice.toFixed(18)),
      stepWei: toWei18(minStep.toFixed(18)),
      content, media
    };

    publishStatus.textContent = "Đang đăng cuộc đấu giá…";
    await tryCreateAuction(payload);

    publishStatus.textContent = "Đăng thành công. Đang tải lại danh sách…";
    createForm.hidden = true;
    await loadAuctions();
  } catch (e) {
    console.error(e);
    publishStatus.textContent = "Đăng thất bại: " + (e?.data?.message || e?.message || "Unknown");
  } finally {
    btnPublish.disabled = false;
  }
}

/* =============================================================
   Tải danh sách đấu giá:
   - Ưu tiên listAuctions(offset,limit)
   - Nếu không có, gọi getAuctionCount() + getAuction(i) / auctions(i)
   ============================================================= */
async function loadAuctions() {
  AUCTIONS = [];
  auctionGrid.innerHTML = "";
  pageInfo.textContent = "—";
  paginationBox.hidden = true;

  try {
    // 1) thử listAuctions
    let items = await tryList(0, 200); // tối đa 200 item
    if (!items) {
      // 2) thử count + itemIdx
      const n = await tryGetCount();
      if (typeof n === "number" && n > 0) {
        const arr = [];
        for (let i = 0; i < Math.min(n, 200); i++) {
          const it = await tryGetItemByIndex(i);
          if (it) {
            // gắn id = i nếu struct không có id
            arr.push({ id: i, ...it });
          }
        }
        items = arr;
      }
    }

    if (!items || !items.length) {
      // Không lấy được — hiển thị note thay vì crash
      auctionGrid.innerHTML = `<div class="card muted">Chưa lấy được danh sách từ hợp đồng (thiếu ABI chính xác). Vẫn có thể sử dụng các chức năng ví & tạo đấu giá; vui lòng cập nhật ABI map nếu cần.</div>`;
      return;
    }

    // Chuẩn hoá dữ liệu để render
    AUCTIONS = items.map((raw, idx) => normalizeAuction(raw, idx));

    // Render
    renderAuctions();
  } catch (e) {
    console.error("loadAuctions", e);
    auctionGrid.innerHTML = `<div class="card muted">Lỗi tải danh sách: ${e?.message || "Unknown"}.</div>`;
  }
}

// Chuẩn hoá struct -> object thống nhất
function normalizeAuction(raw, idxFallback) {
  // raw có thể là array hoặc object. Cố gắng map các field phổ biến.
  // Các tên dự kiến: creator,start,end,depositClose,startPrice,minStep,currentPrice,content,media
  const r = {};

  // id
  r.id = Number(raw.id || raw.auctionId || idxFallback);

  // creator
  r.creator = raw.creator || raw.owner || raw.seller || (raw[0] || "0x0000000000000000000000000000000000000000");

  // times
  r.start = Number(raw.start || raw.startTime || raw[1] || 0);
  r.end   = Number(raw.end   || raw.endTime   || raw[2] || 0);
  r.depoDeadline = Number(raw.depositClose || raw.depositDeadline || raw[3] || 0);

  // prices (BigNumber)
  r.startPriceWei   = raw.startPrice   || raw[4] || ethers.BigNumber.from(0);
  r.minStepWei      = raw.minStep      || raw.minBidStep || raw[5] || ethers.BigNumber.from(0);
  r.currentPriceWei = raw.currentPrice || raw[6] || ethers.BigNumber.from(0);

  // strings
  r.content = raw.content || raw.description || raw[7] || "";
  r.media   = raw.media   || raw.uri || raw[8] || "";

  // derived
  r.startPrice = parseFloat(fromWei18(r.startPriceWei));
  r.minStep    = parseFloat(fromWei18(r.minStepWei));
  r.currentPrice = parseFloat(fromWei18(r.currentPriceWei));

  return r;
}

/* =============================================================
   Render danh sách theo filter & search
   ============================================================= */
function getStatus(a) {
  const now = nowSec();
  if (now < a.start) return "upcoming";
  if (now >= a.start && now <= a.end) return "live";
  return "ended";
}
function statusLabel(key) {
  return key === "upcoming" ? "Chưa diễn ra" : key === "live" ? "Đang diễn ra" : "Đã kết thúc";
}

function renderAuctions() {
  const tpl = $("auctionCardTpl");
  auctionGrid.innerHTML = "";

  const usdPerVin = vinUsdCache;

  const q = CURRENT_QUERY.trim().toLowerCase();
  const filtered = AUCTIONS.filter(a => {
    // filter state
    const st = getStatus(a);
    if (CURRENT_FILTER !== "all" && st !== CURRENT_FILTER) return false;
    // search
    if (!q) return true;
    const hay = [
      a.creator?.toLowerCase() || "",
      a.content?.toLowerCase() || "",
      a.media?.toLowerCase() || "",
      String(a.id)
    ].join("|");
    return hay.includes(q);
  });

  for (const a of filtered) {
    const node = tpl.content.cloneNode(true);
    const root = node.querySelector(".auction-card");
    root.dataset.id = a.id;

    root.querySelector(".title").textContent = `#${a.id}`;
    root.querySelector(".creator").textContent = shortAddr(a.creator);
    root.querySelector(".start").textContent   = fmtTime(a.start);
    root.querySelector(".end").textContent     = fmtTime(a.end);
    root.querySelector(".deposit-deadline").textContent = fmtTime(a.depoDeadline);

    root.querySelector(".start-price").textContent = isFinite(a.startPrice) ? a.startPrice : "—";
    root.querySelector(".step").textContent        = isFinite(a.minStep) ? a.minStep : "—";
    root.querySelector(".current-price").textContent = isFinite(a.currentPrice) ? a.currentPrice : "—";

    // USD quy đổi
    const usd = (isFinite(a.currentPrice) && usdPerVin) ? (a.currentPrice * usdPerVin) : null;
    root.querySelector(".current-usd").textContent = (usd && isFinite(usd)) ? usd.toFixed(2) : "—";

    // content
    root.querySelector(".desc").textContent = a.content || "";

    // status
    const st = getStatus(a);
    const badge = root.querySelector(".status");
    badge.textContent = statusLabel(st);

    // --- Action buttons ---
    const joinBtn = root.querySelector(".join-btn");
    const bidInput = root.querySelector(".bid-input");
    const bidBtn   = root.querySelector(".bid-btn");
    const updBtn   = root.querySelector(".update-depositors-btn");

    joinBtn.onclick = () => focusAuction(a.id);
    bidBtn.onclick  = () => onBidClick(a.id, bidInput);
    updBtn.onclick  = () => openUpdateDepositors(a.id);

    // Ẩn nút theo trạng thái & quyền cơ bản
    if (st !== "live") {
      bidInput.disabled = true; bidBtn.disabled = true;
    }
    // Nếu chưa kết nối ví: không cho bid/update
    if (!userAddress) {
      bidInput.disabled = true; bidBtn.disabled = true; updBtn.disabled = true;
    }
    auctionGrid.appendChild(root);
  }

  pageInfo.textContent = `Tổng: ${filtered.length}`;
}

/* Chỉ hiển thị 1 cuộc đấu giá đã chọn (Tham gia) */
function focusAuction(id) {
  const cards = auctionGrid.querySelectorAll(".auction-card");
  cards.forEach(c => {
    c.style.display = (String(c.dataset.id) === String(id)) ? "flex" : "none";
  });
}

/* Bỏ giá */
async function onBidClick(auctionId, inputEl) {
  if (!userAddress) { alert("Vui lòng kết nối ví trước."); return; }
  const a = AUCTIONS.find(x => String(x.id) === String(auctionId));
  if (!a) { alert("Không tìm thấy cuộc đấu giá."); return; }

  const price = parseFloat(inputEl.value || "0");
  if (!price || price <= 0) { alert("Nhập giá VIN hợp lệ."); return; }

  // Kiểm tra bước giá tối thiểu nếu có dữ liệu
  if (isFinite(a.currentPrice) && isFinite(a.minStep)) {
    const minRequired = (a.currentPrice || a.startPrice) + a.minStep;
    if (price < minRequired) {
      alert(`Giá phải ≥ ${minRequired} VIN.`);
      return;
    }
  }

  try {
    inputEl.disabled = true;
    const priceWei = toWei18(price.toFixed(18));
    // (tuỳ hợp đồng) nếu cần approve để thu phí/đặt cọc khi bid, có thể thêm approve tại đây.

    await tryBid(auctionId, priceWei);
    alert("Đặt giá thành công.");
    await loadAuctions();
  } catch (e) {
    console.error(e);
    alert("Bỏ giá thất bại: " + (e?.data?.message || e?.message || "Unknown"));
  } finally {
    inputEl.disabled = false;
  }
}

/* Mở modal cập nhật ví đã đặt cọc (creator) */
function openUpdateDepositors(auctionId) {
  updModal.dataset.auctionId = String(auctionId);
  updStatus.textContent = "";
  updInput.value = "";
  updModal.setAttribute("aria-hidden", "false");
}
function closeUpdateDepositors() {
  updModal.setAttribute("aria-hidden", "true");
}

/* Xác nhận cập nhật ví đã đặt cọc */
async function confirmUpdateDepositors() {
  if (!userAddress) { alert("Vui lòng kết nối ví."); return; }
  const auctionId = Number(updModal.dataset.auctionId || "0");
  if (!auctionId && auctionId !== 0) { alert("Thiếu auctionId."); return; }

  const raw = updInput.value.trim();
  if (!raw) { alert("Vui lòng dán danh sách địa chỉ."); return; }
  // tách theo , hoặc xuống dòng, lọc trống
  const parts = raw.split(/[\s,;]+/g).map(s => s.trim()).filter(Boolean);
  const addrs = [];
  for (const p of parts) {
    try { addrs.push(ethers.utils.getAddress(p)); } catch {}
  }
  if (!addrs.length) { alert("Không có địa chỉ hợp lệ."); return; }

  try {
    updConfirm.disabled = true;
    updStatus.textContent = "Đang cập nhật on-chain…";
    await trySetDepositors(auctionId, addrs);
    updStatus.textContent = "Cập nhật thành công.";
    setTimeout(closeUpdateDepositors, 800);
  } catch (e) {
    console.error(e);
    updStatus.textContent = "Lỗi: " + (e?.data?.message || e?.message || "Unknown");
  } finally {
    updConfirm.disabled = false;
  }
}

/* =============================================================
   Sự kiện UI
   ============================================================= */
connectBtn.addEventListener("click", async () => {
  if (connectBtn.dataset.state === "connected") {
    disconnectWallet();
  } else {
    await connectWallet();
  }
});

btnRegister.addEventListener("click", handleRegister);
btnPublish.addEventListener("click", handlePublish);

btnReload.addEventListener("click", loadAuctions);

filterStateSel.addEventListener("change", (e) => {
  CURRENT_FILTER = e.target.value;
  renderAuctions();
});

btnSearch.addEventListener("click", () => {
  CURRENT_QUERY = searchInput.value || "";
  renderAuctions();
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { CURRENT_QUERY = searchInput.value || ""; renderAuctions(); }
});

// Modal cập nhật depositors
updClose.addEventListener("click", closeUpdateDepositors);
updConfirm.addEventListener("click", confirmUpdateDepositors);
updModal.addEventListener("click", (e) => {
  if (e.target === updModal) closeUpdateDepositors();
});

/* =============================================================
   Khởi động khi mở trang
   ============================================================= */
(async function boot() {
  // Chuẩn bị contract read-only (để load danh sách khi chưa kết nối)
  bindReadOnly();
  bindContracts(roProvider); // vin read-only để tra decimals/allowance nếu cần

  // Tải danh sách
  await getVinUsd(); // để có giá quy đổi USD khi render
  await loadAuctions();

  // Thử auto-connect (nếu ví đã cho phép trước đó)
  if (window.ethereum && window.ethereum.selectedAddress) {
    try { await connectWallet(); } catch (e) {}
  }
})();
