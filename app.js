/* =========================================================================
   daugia.vin — app.js
   - Kết nối ví (Viction, chainId 88)
   - Đọc/ghi smart contract DauGia (đã verify)
   - Hiển thị danh sách phiên, tìm kiếm, và các nút hành động theo vai trò
   - 4 hành động thu phí VIN (0.001 VIN): register/create/updateWhitelist/placeBid
   - finalize: miễn phí (chưa đưa nút, có thể thêm sau)
   ======================================================================= */

(() => {
  // ===== Cấu hình mạng & địa chỉ =====
  const CHAIN_ID_HEX = "0x58"; // 88
  const RPC_URL = "https://rpc.viction.xyz";
  const EXPLORER = "https://vicscan.xyz";
  const CONTRACT_ADDR = "0x44DeC3CBdF3448F05f082050aBC9697d8224f511";
  const VIN_ADDR = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";
  const FEE = 10n ** 15n; // 0.001 * 1e18 (VIN decimals 18)

  // ===== ABI tối thiểu cần dùng =====
  const ABI = [
    // writes
    {"inputs":[],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"components":[{"internalType":"string","name":"summary","type":"string"},{"internalType":"string","name":"thongBaoUrl","type":"string"},{"internalType":"string","name":"quiCheUrl","type":"string"},{"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},{"internalType":"uint40","name":"auctionStart","type":"uint40"},{"internalType":"uint40","name":"auctionEnd","type":"uint40"},{"internalType":"uint128","name":"startPriceVND","type":"uint128"},{"internalType":"uint128","name":"stepVND","type":"uint128"}],"internalType":"struct DauGia.AuctionInit","name":"a","type":"tuple"}],"name":"createAuction","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address[]","name":"addrs","type":"address[]"},{"internalType":"address[]","name":"removes","type":"address[]"}],"name":"updateWhitelist","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint128","name":"amountVND","type":"uint128"}],"name":"placeBid","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"finalize","outputs":[],"stateMutability":"nonpayable","type":"function"},
    // views
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getAuction","outputs":[{"components":[{"internalType":"address","name":"organizer","type":"address"},{"internalType":"string","name":"summary","type":"string"},{"internalType":"string","name":"thongBaoUrl","type":"string"},{"internalType":"string","name":"quiCheUrl","type":"string"},{"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},{"internalType":"uint40","name":"auctionStart","type":"uint40"},{"internalType":"uint40","name":"auctionEnd","type":"uint40"},{"internalType":"uint128","name":"startPriceVND","type":"uint128"},{"internalType":"uint128","name":"stepVND","type":"uint128"},{"internalType":"uint128","name":"currentPriceVND","type":"uint128"},{"internalType":"address","name":"currentLeader","type":"address"},{"internalType":"bool","name":"finalized","type":"bool"},{"internalType":"bool","name":"success","type":"bool"}],"internalType":"struct DauGia.Auction","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getStatus","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getMinNextBid","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getWhitelist","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"auctionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
  ];

  const ERC20_ABI = [
    {"constant":true,"inputs":[{"name":"a","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
    {"constant":true,"inputs":[{"name":"o","type":"address"},{"name":"s","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"s","type":"address"},{"name":"v","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
  ];

  // ===== Ethers Providers (đọc + ghi) =====
  let readProvider = new ethers.JsonRpcProvider(RPC_URL);
  let browserProvider = null;   // ethers.BrowserProvider
  let signer = null;

  // ===== Contract instances =====
  const readDauGia = new ethers.Contract(CONTRACT_ADDR, ABI, readProvider);
  const readVIN = new ethers.Contract(VIN_ADDR, ERC20_ABI, readProvider);
  let writeDauGia = null;
  let writeVIN = null;

  // ===== DOM =====
  const el = (id) => document.getElementById(id);
  const auctionsList = el("auctionsList");
  const connectBtn = el("connectBtn");
  const registerBtn = el("registerBtn");
  const createBtn = el("createAuctionBtn");
  const accountInfo = el("accountInfo");
  const accountAddrSpan = el("accountAddr");
  const vinBalSpan = el("vinBal");
  const vicBalSpan = el("vicBal");
  const contractLink = el("contractLink");

  const searchInput = el("searchInput");
  const statusFilter = el("statusFilter");
  const searchBtn = el("searchBtn");
  const clearSearchBtn = el("clearSearchBtn");

  const createDialog = el("createDialog");
  const createForm = el("createForm");
  const fSummary = el("fSummary");
  const fThongBao = el("fThongBao");
  const fQuiChe = el("fQuiChe");
  const fCutoff = el("fCutoff");
  const fStart = el("fStart");
  const fEnd = el("fEnd");
  const fStartPrice = el("fStartPrice");
  const fStep = el("fStep");

  // Gắn link explorer cho hợp đồng
  if (contractLink) contractLink.href = `${EXPLORER}/address/${CONTRACT_ADDR}#code`;

  // ===== Helpers =====
  const shortAddr = (a) => (a && a.startsWith("0x") ? a.slice(0, 6) + "…" + a.slice(-4) : a);

  function formatVND(n) {
    // n: BigInt | number | string digits
    let s = typeof n === "bigint" ? n.toString() : ("" + n).replace(/\D/g, "");
    if (!s) return "0";
    let out = "";
    let c = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      out = s[i] + out;
      c++;
      if (c === 3 && i !== 0) {
        out = "." + out;
        c = 0;
      }
    }
    return out;
  }

  const parseVND = (s) => {
    if (typeof s !== "string") s = String(s ?? "");
    const digits = s.replace(/\D/g, "");
    if (!digits) return 0n;
    return BigInt(digits);
  };

  function epochToVN(ts) {
    // hiển thị dd/mm/yyyy hh:mm (24h) theo múi giờ người dùng
    const d = new Date(Number(ts) * 1000);
    const pad = (x) => String(x).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseVNDateTime(s) {
    // "dd/mm/yyyy hh:mm" -> epoch seconds (BigInt)
    if (!s) return 0n;
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return 0n;
    const dd = Number(m[1]), mm = Number(m[2]) - 1, yyyy = Number(m[3]);
    const hh = Number(m[4]), min = Number(m[5]);
    const dt = new Date(yyyy, mm, dd, hh, min, 0, 0);
    return BigInt(Math.floor(dt.getTime() / 1000));
  }

  const statusText = (st) => ({
    0: "Chưa diễn ra",
    1: "Đang diễn ra",
    2: "Đã kết thúc",
    3: "Đã chốt"
  })[Number(st)] ?? "Không rõ";

  async function ensureOnViction() {
    if (!window.ethereum) return false;
    const current = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
    if (current === CHAIN_ID_HEX) return true;
    // Thử switch, nếu chưa có thì add
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
      return true;
    } catch (e) {
      if (e && e.code === 4902) {
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
        return true;
      }
      return false;
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Không tìm thấy ví. Hãy cài đặt và bật MetaMask/Wallet.");
      return;
    }
    const ok = await ensureOnViction();
    if (!ok) {
      alert("Không chuyển sang mạng Viction được.");
      return;
    }
    browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send("eth_requestAccounts", []);
    signer = await browserProvider.getSigner();
    writeDauGia = new ethers.Contract(CONTRACT_ADDR, ABI, signer);
    writeVIN = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer);
    await refreshAccountUI();
    await renderAuctions(); // để hiện đúng các nút theo vai trò
  }

  async function refreshAccountUI() {
    if (!signer) {
      connectBtn.classList.remove("hidden");
      accountInfo.classList.add("hidden");
      registerBtn.classList.add("hidden");
      createBtn.classList.add("hidden");
      return;
    }
    const addr = await signer.getAddress();
    accountAddrSpan.textContent = shortAddr(addr);
    connectBtn.classList.add("hidden");
    accountInfo.classList.remove("hidden");

    const [vicBalWei, vinBal] = await Promise.all([
      browserProvider.getBalance(addr),
      readVIN.balanceOf(addr)
    ]);
    vicBalSpan.textContent = Number(ethers.formatEther(vicBalWei)).toFixed(4);
    vinBalSpan.textContent = Number(ethers.formatUnits(vinBal, 18)).toFixed(4);

    const reg = await readDauGia.isRegistered(addr);
    if (reg) {
      registerBtn.classList.add("hidden");
      createBtn.classList.remove("hidden");
    } else {
      registerBtn.classList.remove("hidden");
      createBtn.classList.add("hidden");
    }
  }

  async function ensureAllowance(min) {
    const owner = await signer.getAddress();
    const current = await writeVIN.allowance(owner, CONTRACT_ADDR);
    if (current >= min) return;
    const tx = await writeVIN.approve(CONTRACT_ADDR, min);
    await tx.wait();
  }

  // ===== Render danh sách phiên =====
  async function loadAllAuctions() {
    const count = await readDauGia.auctionCount();
    const out = [];
    for (let i = 1n; i <= count; i++) {
      const [a, st] = await Promise.all([
        readDauGia.getAuction(i),
        readDauGia.getStatus(i)
      ]);
      out.push({ id: i, a, st });
    }
    return out;
  }

  function filterAuctions(data) {
    const q = (searchInput.value || "").trim().toLowerCase();
    const st = statusFilter.value;
    return data.filter(({ a, st: s }) => {
      let ok = true;
      if (q) {
        const inSummary = (a.summary || "").toLowerCase().includes(q);
        const inOrg = (a.organizer || "").toLowerCase().includes(q);
        ok = inSummary || inOrg;
      }
      if (ok && st !== "") {
        ok = String(Number(s)) === st;
      }
      return ok;
    });
  }

  function buildCard({ id, a, st }, account) {
    const tpl = document.getElementById("auctionCardTpl");
    const node = tpl.content.firstElementChild.cloneNode(true);

    node.dataset.id = String(id);

    const title = node.querySelector(".title");
    title.textContent = a.summary || "(không có mô tả)";

    const detailBtn = node.querySelector(".detailBtn");
    const cardBody = node.querySelector(".card-body");

    const snippet = node.querySelector(".snippet");
    snippet.textContent = "Xem ‘Thông báo đấu giá’ và ‘Quy chế đấu giá’ để biết chi tiết.";

    const thongBaoA = node.querySelector(".thongbao");
    thongBaoA.href = a.thongBaoUrl;
    const quiCheA = node.querySelector(".quiche");
    quiCheA.href = a.quiCheUrl;

    node.querySelector(".time").textContent =
      `${epochToVN(a.auctionStart)} → ${epochToVN(a.auctionEnd)}`;
    node.querySelector(".cutoff").textContent = epochToVN(a.whitelistCutoff);
    node.querySelector(".startPrice").textContent = formatVND(a.startPriceVND) + " VND";
    node.querySelector(".step").textContent = formatVND(a.stepVND) + " VND";
    node.querySelector(".current").textContent =
      (a.currentLeader === "0x0000000000000000000000000000000000000000")
        ? "(chưa có)"
        : (formatVND(a.currentPriceVND) + " VND");
    node.querySelector(".leader").textContent =
      (a.currentLeader === "0x0000000000000000000000000000000000000000")
        ? "(chưa có)"
        : shortAddr(a.currentLeader);

    const statusDiv = node.querySelector(".status");
    statusDiv.textContent = `Tình trạng: ${statusText(st)} • Tổ chức: ${shortAddr(a.organizer)}`;

    // Nút hành động:
    const joinBtn = node.querySelector(".joinBtn");
    const backBtn = node.querySelector(".backBtn");
    const regBtn = node.querySelector(".regBtn");
    const createBtnCard = node.querySelector(".createBtn");
    const updateWlBtn = node.querySelector(".updateWlBtn");
    const bidBtn = node.querySelector(".bidBtn");

    // Mặc định: ai cũng xem được
    joinBtn.addEventListener("click", () => {
      cardBody.classList.remove("hidden");
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      // lười tải whitelist: nạp khi mở chi tiết
      loadWhitelistInto(node, id);
    });
    backBtn.addEventListener("click", () => {
      cardBody.classList.add("hidden");
    });
    detailBtn.addEventListener("click", () => {
      cardBody.classList.toggle("hidden");
      if (!cardBody.classList.contains("hidden")) {
        loadWhitelistInto(node, id);
      }
    });

    // Nếu chưa kết nối ví: ẩn nút phụ thuộc ví
    if (!account) {
      regBtn.classList.add("hidden");
      createBtnCard.classList.add("hidden");
      updateWlBtn.classList.add("hidden");
      bidBtn.classList.add("hidden");
      return node;
    }

    // Đã kết nối: hiển thị nút theo trạng thái đăng ký & vai trò
    (async () => {
      const [reg, isWL] = await Promise.all([
        readDauGia.isRegistered(account),
        readDauGia.isWhitelisted(id, account)
      ]);
      if (reg) {
        regBtn.classList.add("hidden");
        createBtnCard.classList.remove("hidden");
      } else {
        regBtn.classList.remove("hidden");
        createBtnCard.classList.add("hidden");
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      const isOrganizer = a.organizer.toLowerCase() === account.toLowerCase();

      // Cập nhật whitelist: chỉ chủ phiên, trước cutoff
      if (isOrganizer && now < a.whitelistCutoff) {
        updateWlBtn.classList.remove("hidden");
        updateWlBtn.addEventListener("click", () => onUpdateWhitelist(id));
      } else {
        updateWlBtn.classList.add("hidden");
      }

      // Bỏ giá: không phải chủ, phải thuộc whitelist và đang trong [start,end)
      if (!isOrganizer && isWL && now >= a.auctionStart && now < a.auctionEnd) {
        bidBtn.classList.remove("hidden");
        bidBtn.addEventListener("click", () => onBid(id));
      } else {
        bidBtn.classList.add("hidden");
      }

      // Đăng ký trong card (nếu muốn thao tác nhanh)
      regBtn.addEventListener("click", onRegister);
      createBtnCard.addEventListener("click", openCreateDialog);
    })();

    return node;
  }

  async function loadWhitelistInto(cardNode, id) {
    const wrap = cardNode.querySelector(".wlList");
    if (!wrap || wrap.dataset.loaded === "1") return;
    wrap.textContent = "Đang tải danh sách ví…";
    try {
      const list = await readDauGia.getWhitelist(id);
      if (!list || !list.length) {
        wrap.textContent = "(chưa có)";
      } else {
        wrap.innerHTML = list.map(a => `<code>${shortAddr(a)}</code>`).join(" · ");
      }
      wrap.dataset.loaded = "1";
    } catch (e) {
      wrap.textContent = "Không tải được danh sách.";
    }
  }

  async function renderAuctions() {
    auctionsList.innerHTML = "Đang tải…";
    try {
      const all = await loadAllAuctions();
      const account = signer ? (await signer.getAddress()) : null;
      const filtered = filterAuctions(all);

      auctionsList.innerHTML = "";
      if (!filtered.length) {
        auctionsList.textContent = "Không có phiên phù hợp.";
        return;
      }
      filtered.forEach(item => {
        auctionsList.appendChild(buildCard(item, account));
      });
    } catch (e) {
      auctionsList.textContent = "Lỗi tải danh sách phiên.";
      console.error(e);
    }
  }

  // ===== Sự kiện toàn cục =====
  connectBtn?.addEventListener("click", connectWallet);

  registerBtn?.addEventListener("click", onRegister);

  createBtn?.addEventListener("click", openCreateDialog);

  searchBtn?.addEventListener("click", renderAuctions);
  clearSearchBtn?.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "";
    renderAuctions();
  });

  // ===== Hành động =====
  async function onRegister() {
    if (!signer) return connectWallet();
    try {
      await ensureOnViction();
      await ensureAllowance(FEE);
      const tx = await writeDauGia.register();
      await tx.wait();
      alert("Đăng ký thành công.");
      await refreshAccountUI();
    } catch (e) {
      alert("Đăng ký thất bại: " + (e?.shortMessage || e?.message || e));
    }
  }

  function openCreateDialog() {
    if (!signer) return connectWallet();
    createDialog.showModal();
  }

  createForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!signer) return connectWallet();
    try {
      const summary = (fSummary.value || "").trim();
      const thongBaoUrl = (fThongBao.value || "").trim();
      const quiCheUrl = (fQuiChe.value || "").trim();
      const cutoff = parseVNDateTime(fCutoff.value);
      const start = parseVNDateTime(fStart.value);
      const end = parseVNDateTime(fEnd.value);
      const startPrice = parseVND(fStartPrice.value);
      const step = parseVND(fStep.value);

      if (!summary || !thongBaoUrl || !quiCheUrl) throw new Error("Thiếu dữ liệu bắt buộc.");
      if (!(0n < cutoff && cutoff <= start && start < end)) throw new Error("Thời gian không hợp lệ.");
      if (!(startPrice > 0n && step > 0n)) throw new Error("Giá khởi điểm/bước giá phải > 0.");

      await ensureOnViction();
      await ensureAllowance(FEE);

      const tx = await writeDauGia.createAuction({
        summary,
        thongBaoUrl,
        quiCheUrl,
        whitelistCutoff: cutoff,
        auctionStart: start,
        auctionEnd: end,
        startPriceVND: startPrice,
        stepVND: step
      });
      const rc = await tx.wait();
      // ethers v6: không nhất thiết trả id trong logs; render lại là đủ
      createDialog.close();
      alert("Đã tạo phiên đấu giá thành công.");
      await renderAuctions();
    } catch (e) {
      alert("Tạo phiên thất bại: " + (e?.shortMessage || e?.message || e));
    }
  });

  async function onUpdateWhitelist(id) {
    if (!signer) return connectWallet();
    try {
      const addsRaw = prompt("Nhập địa chỉ ví cần THÊM (phân tách dấu phẩy), để trống nếu không thêm:", "");
      const remRaw = prompt("Nhập địa chỉ ví cần GỠ (phân tách dấu phẩy), để trống nếu không gỡ:", "");
      const addrs = (addsRaw || "")
        .split(",")
        .map(s => s.trim())
        .filter(s => /^0x[a-fA-F0-9]{40}$/.test(s));
      const removes = (remRaw || "")
        .split(",")
        .map(s => s.trim())
        .filter(s => /^0x[a-fA-F0-9]{40}$/.test(s));

      await ensureOnViction();
      await ensureAllowance(FEE);
      const tx = await writeDauGia.updateWhitelist(id, addrs, removes);
      await tx.wait();
      alert("Đã cập nhật whitelist.");
      await renderAuctions();
    } catch (e) {
      alert("Cập nhật whitelist lỗi: " + (e?.shortMessage || e?.message || e));
    }
  }

  async function onBid(id) {
    if (!signer) return connectWallet();
    try {
      const min = await readDauGia.getMinNextBid(id);
      const tip = `Mức tối thiểu hiện tại: ${formatVND(min)} VND.\nNhập giá bạn muốn bỏ (VND, số nguyên, có thể gõ 100.000.000):`;
      const raw = prompt(tip, "");
      const amount = parseVND(raw);
      if (amount < min) throw new Error("Giá quá thấp (nhỏ hơn mức tối thiểu).");

      await ensureOnViction();
      await ensureAllowance(FEE);
      const tx = await writeDauGia.placeBid(id, amount);
      await tx.wait();
      alert("Đã bỏ giá thành công.");
      await renderAuctions();
    } catch (e) {
      if (String(e).includes("BidTooLow")) {
        alert("Giá quá thấp. Hãy nhập giá ≥ mức tối thiểu.");
      } else {
        alert("Bỏ giá thất bại: " + (e?.shortMessage || e?.message || e));
      }
    }
  }

  // ===== Khởi động =====
  (async function init() {
    try {
      await renderAuctions();
      // Nếu user đã kết nối ví trước đó, cố gắng hiện thông tin
      if (window.ethereum) {
        window.ethereum.on?.("accountsChanged", async () => {
          signer = null;
          browserProvider = null;
          writeDauGia = null;
          writeVIN = null;
          await connectWallet();
        });
        window.ethereum.on?.("chainChanged", async () => {
          location.reload();
        });
      }
    } catch (e) {
      console.error(e);
    }
  })();
})();
