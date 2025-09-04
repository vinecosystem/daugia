/* ==========================================================================
   daugia.vin — app.js (ethers v5, kết nối ví mượt, ABI tối giản nhúng sẵn)
   Hợp đồng DauGia @ 0x44DeC3CBdF3448F05f082050aBC9697d8224f511
   ========================================================================== */
(function () {
  'use strict';

  /* -------------------- Cấu hình mạng / địa chỉ -------------------- */
  const RPC_URL = "https://rpc.viction.xyz";
  const CHAIN_ID_HEX = "0x58"; // 88
  const CHAIN_INFO = {
    chainId: CHAIN_ID_HEX,
    chainName: "Viction Mainnet",
    nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 },
    rpcUrls: [RPC_URL],
    blockExplorerUrls: ["https://vicscan.xyz"],
  };

  const DG_ADDR  = "0x44DeC3CBdF3448F05f082050aBC9697d8224f511";
  const VIN_ADDR = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";
  const ERC20_MIN_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];

  // === ABI TỐI GIẢN CHO DAP ===
  const DG_ABI = [
    { "inputs": [], "name": "auctionCount", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [ { "components": [
        { "internalType": "string",  "name": "summary",         "type": "string"  },
        { "internalType": "string",  "name": "thongBaoUrl",     "type": "string"  },
        { "internalType": "string",  "name": "quiCheUrl",       "type": "string"  },
        { "internalType": "uint40",  "name": "whitelistCutoff", "type": "uint40"  },
        { "internalType": "uint40",  "name": "auctionStart",    "type": "uint40"  },
        { "internalType": "uint40",  "name": "auctionEnd",      "type": "uint40"  },
        { "internalType": "uint128", "name": "startPriceVND",   "type": "uint128" },
        { "internalType": "uint128", "name": "stepVND",         "type": "uint128" }
      ], "internalType": "struct DauGia.AuctionInit", "name": "a", "type": "tuple" } ],
      "name": "createAuction", "outputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ],
      "stateMutability": "nonpayable", "type": "function"
    },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ],
      "name": "getAuction",
      "outputs": [ { "components": [
          { "internalType": "address", "name": "organizer",       "type": "address" },
          { "internalType": "string",  "name": "summary",         "type": "string"  },
          { "internalType": "string",  "name": "thongBaoUrl",     "type": "string"  },
          { "internalType": "string",  "name": "quiCheUrl",       "type": "string"  },
          { "internalType": "uint40",  "name": "whitelistCutoff", "type": "uint40"  },
          { "internalType": "uint40",  "name": "auctionStart",    "type": "uint40"  },
          { "internalType": "uint40",  "name": "auctionEnd",      "type": "uint40"  },
          { "internalType": "uint128", "name": "startPriceVND",   "type": "uint128" },
          { "internalType": "uint128", "name": "stepVND",         "type": "uint128" },
          { "internalType": "uint128", "name": "currentPriceVND", "type": "uint128" },
          { "internalType": "address", "name": "currentLeader",   "type": "address" },
          { "internalType": "bool",    "name": "finalized",       "type": "bool"    },
          { "internalType": "bool",    "name": "success",         "type": "bool"    }
        ], "internalType": "struct DauGia.Auction", "name": "", "type": "tuple" } ],
      "stateMutability": "view", "type": "function"
    },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ], "name": "getStatus",     "outputs": [ { "internalType": "uint8",   "name": "", "type": "uint8"   } ], "stateMutability": "view", "type": "function" },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ], "name": "getWhitelist",  "outputs": [ { "internalType": "address[]", "name": "", "type": "address[]" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [ { "internalType": "address", "name": "user", "type": "address" } ], "name": "isRegistered","outputs": [ { "internalType": "bool",   "name": "", "type": "bool"   } ], "stateMutability": "view", "type": "function" },
    { "inputs": [ { "internalType": "uint256", "name": "id",   "type": "uint256" }, { "internalType": "address", "name": "user", "type": "address" } ], "name": "isWhitelisted", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [ { "internalType": "uint256", "name": "id",   "type": "uint256" } ], "name": "getMinNextBid","outputs": [ { "internalType": "uint128", "name": "", "type": "uint128" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "register", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "address[]", "name": "addrs", "type": "address[]" }, { "internalType": "address[]", "name": "removes", "type": "address[]" } ],
      "name": "updateWhitelist", "outputs": [], "stateMutability": "nonpayable", "type": "function"
    },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "uint128", "name": "amountVND", "type": "uint128" } ],
      "name": "placeBid", "outputs": [], "stateMutability": "nonpayable", "type": "function"
    },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ], "name": "finalize", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
  ];

  // Phí 0.001 VIN (18 decimals)
  const FEE_VIN = ethers.utils.parseUnits("0.001", 18);

  // Múi giờ Việt Nam
  const VN_TZ = "Asia/Bangkok";

  /* -------------------- Trạng thái -------------------- */
  let readProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  let web3Provider = null;    // ethers.providers.Web3Provider
  let signer = null;
  let account = null;

  let DG = null;              // Contract đọc/ghi
  let VIN = null;

  /* -------------------- DOM -------------------- */
  const $ = (id) => document.getElementById(id);
  const els = {
    connect: $("btn-connect"),
    disconnect: $("btn-disconnect"),
    walletInfo: $("wallet-info"),
    addrShort: $("addr-short"),
    vinBal: $("vin-balance"),
    vicBal: $("vic-balance"),

    btnRegister: $("btn-register"),
    btnOpenCreate: $("btn-open-create"),

    list: $("auctions-list"),
    tpl: $("tpl-auction"),

    search: $("searchInput"),
    filter: $("statusFilter"),
    btnSearch: $("searchBtn"),
    btnClear: $("clearSearchBtn"),

    dlgCreate: $("createDialog"),
    formCreate: $("createForm"),
    fSummary: $("fSummary"),
    fThongBao: $("fThongBao"),
    fQuiChe: $("fQuiChe"),
    fCutoff: $("fCutoff"),
    fStart: $("fStart"),
    fEnd: $("fEnd"),
    fStartPrice: $("fStartPrice"),
    fStep: $("fStep"),
  };

  /* -------------------- Tiện ích -------------------- */
  const shortAddr = (a) => a ? (a.slice(0, 6) + "…" + a.slice(-4)) : "";
  function fmtVND(x) {
    const s = (typeof x === "string") ? x.replace(/\D/g, "") :
              ethers.BigNumber.isBigNumber(x) ? x.toString() :
              String(x ?? "").replace(/\D/g, "");
    if (!s) return "0";
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function parseVNDToBN(s) {
    const digits = String(s ?? "").replace(/\D/g, "");
    return digits ? ethers.BigNumber.from(digits) : ethers.BigNumber.from(0);
  }
  function epochToVN(sec) {
    const d = new Date(sec * 1000);
    const s = d.toLocaleString("vi-VN", {
      timeZone: VN_TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
    return s.replace(",", "");
  }
  function parseVNDateTime(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    let dd = +m[1], mm = +m[2] - 1, yyyy = +m[3], HH = +m[4], MM = +m[5];
    // VN = UTC+7 => UTC = VN - 7
    const ms = Date.UTC(yyyy, mm, dd, HH - 7, MM, 0);
    return Math.floor(ms / 1000);
  }

  /* -------------------- Kết nối ví -------------------- */
  async function ensureChain() {
    const provider = window.ethereum;
    const chainId = await provider.request({ method: "eth_chainId" });
    if (chainId === CHAIN_ID_HEX) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e.code === 4902) {
        await provider.request({ method: "wallet_addEthereumChain", params: [CHAIN_INFO] });
      } else {
        throw e;
      }
    }
  }

  async function connectWallet() {
    if (!window.ethereum || !window.ethers) {
      alert("Không tìm thấy ví Web3. Hãy cài MetaMask / dùng trình duyệt ví.");
      return;
    }
    web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await ensureChain();
    await web3Provider.send("eth_requestAccounts", []);
    signer = web3Provider.getSigner();
    account = await signer.getAddress();

    DG = new ethers.Contract(DG_ADDR, DG_ABI, signer);
    VIN = new ethers.Contract(VIN_ADDR, ERC20_MIN_ABI, signer);

    // UI header
    els.connect.classList.add("hidden");
    els.walletInfo.classList.remove("hidden");
    els.addrShort.textContent = shortAddr(account);

    await refreshBalances();
    await updateHeaderButtons();
    await renderAuctions(); // để hiện đúng nút theo vai trò

    // Sự kiện ví
    window.ethereum.on && window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on && window.ethereum.on("chainChanged", () => location.reload());
  }

  function disconnectWallet() {
    // Với EVM wallet trên web, không có API "disconnect". Ta chỉ reset UI.
    signer = null; account = null; DG = null; VIN = null;
    els.walletInfo.classList.add("hidden");
    els.connect.classList.remove("hidden");
    els.btnRegister.classList.add("hidden");
    els.btnOpenCreate.classList.add("hidden");
  }

  async function refreshBalances() {
    if (!account) return;
    const vicWei = await web3Provider.getBalance(account);
    els.vicBal.textContent = Number(ethers.utils.formatEther(vicWei)).toFixed(4);

    const d = await VIN.decimals().catch(() => 18);
    const vinBal = await VIN.balanceOf(account);
    els.vinBal.textContent = Number(ethers.utils.formatUnits(vinBal, d)).toFixed(4);
  }

  async function updateHeaderButtons() {
    if (!DG || !account) return;
    const isReg = await DG.isRegistered(account);
    if (isReg) {
      els.btnRegister.classList.add("hidden");
      els.btnOpenCreate.classList.remove("hidden");
    } else {
      els.btnRegister.classList.remove("hidden");
      els.btnOpenCreate.classList.add("hidden");
    }
  }

  async function ensureFeeAllowance() {
    const allow = await VIN.allowance(account, DG_ADDR);
    if (allow.gte(FEE_VIN)) return;
    const tx = await VIN.approve(DG_ADDR, FEE_VIN);
    await tx.wait();
  }

  /* -------------------- Danh sách đấu giá -------------------- */
  const DG_READ = new ethers.Contract(DG_ADDR, DG_ABI, readProvider);

  async function fetchAuctionCount() {
    try { return await DG_READ.auctionCount(); } catch { return ethers.BigNumber.from(0); }
  }
  async function fetchAuction(id) {
    const [a, st] = await Promise.all([DG_READ.getAuction(id), DG_READ.getStatus(id)]);
    return { a, st };
  }

  async function renderAuctions() {
    els.list.textContent = "Đang tải…";
    try {
      const count = await fetchAuctionCount();
      const num = ethers.BigNumber.from(count).toNumber();
      const ids = [];
      for (let i = num; i >= 1; i--) ids.push(i);

      els.list.innerHTML = "";
      if (!ids.length) { els.list.textContent = "Chưa có cuộc đấu giá."; return; }

      for (const id of ids) {
        const node = await buildCard(id);
        els.list.appendChild(node);
      }
    } catch (e) {
      console.error(e);
      els.list.textContent = "Không tải được danh sách.";
    }
  }

  async function buildCard(id) {
    const { a, st } = await fetchAuction(id);
    const node = els.tpl.content.firstElementChild.cloneNode(true);

    // Tiêu đề / chi tiết
    node.querySelector(".title").textContent = a.summary || `(Phiên #${id})`;
    const body = node.querySelector(".card-body");
    node.querySelector(".detailBtn").addEventListener("click", () => {
      body.classList.toggle("hidden");
      if (!body.classList.contains("hidden")) loadWhitelistInto(node, id);
    });

    // Nội dung / links
    node.querySelector(".snippet").textContent = " ";
    const linkTB = node.querySelector(".thongbao");
    const linkQC = node.querySelector(".quyche");
    linkTB.href = a.thongBaoUrl;
    linkQC.href = a.quiCheUrl;

    node.querySelector(".time").textContent = `${epochToVN(a.auctionStart)} → ${epochToVN(a.auctionEnd)}`;
    node.querySelector(".cutoff").textContent = epochToVN(a.whitelistCutoff);
    node.querySelector(".startPrice").textContent = fmtVND(a.startPriceVND.toString());
    node.querySelector(".step").textContent = fmtVND(a.stepVND.toString());
    node.querySelector(".current").textContent = a.currentLeader === ethers.constants.AddressZero ? "—" : fmtVND(a.currentPriceVND.toString());
    node.querySelector(".leader").textContent  = a.currentLeader === ethers.constants.AddressZero ? "—" : shortAddr(a.currentLeader);

    node.querySelector(".status").textContent = `Tình trạng: ${["Chưa diễn ra","Đang diễn ra","Đã kết thúc","Đã chốt"][Number(st)] ?? "—"}`;

    // Join / Back
    node.querySelector(".joinBtn").addEventListener("click", () => {
      [...els.list.children].forEach(el => { if (el !== node) el.style.display = "none"; });
      body.classList.remove("hidden");
      loadWhitelistInto(node, id);
    });
    node.querySelector(".backBtn").addEventListener("click", () => {
      [...els.list.children].forEach(el => { el.style.display = ""; });
    });

    // Nút theo vai trò (khi đã kết nối ví)
    const regBtn   = node.querySelector(".regBtn");
    const createBtn= node.querySelector(".createBtn");
    const updBtn   = node.querySelector(".updateWlBtn");
    const bidBtn   = node.querySelector(".bidBtn");

    if (!account || !DG) {
      regBtn.classList.add("hidden");
      createBtn.classList.add("hidden");
      updBtn.classList.add("hidden");
      bidBtn.classList.add("hidden");
    } else {
      (async () => {
        const isReg = await DG.isRegistered(account);
        regBtn.classList.toggle("hidden", isReg);
        createBtn.classList.toggle("hidden", !isReg);

        const isOrg = a.organizer.toLowerCase() === account.toLowerCase();
        const now = Math.floor(Date.now() / 1000);

        // Cập nhật whitelist: chỉ organizer, trước cutoff
        const canUpd = isOrg && now < a.whitelistCutoff;
        updBtn.classList.toggle("hidden", !canUpd);
        if (canUpd) {
          updBtn.addEventListener("click", () => onUpdateWhitelist(id));
        }

        // Bỏ giá: không phải organizer, trong whitelist, trong [start, end)
        const isWL = await DG.isWhitelisted(id, account);
        const canBid = !isOrg && isWL && now >= a.auctionStart && now < a.auctionEnd;
        bidBtn.classList.toggle("hidden", !canBid);
        if (canBid) {
          bidBtn.addEventListener("click", () => onBid(id));
        }

        // Đăng ký trong card
        regBtn.addEventListener("click", onRegister);
        createBtn.addEventListener("click", openCreateDialog);
      })();
    }

    return node;
  }

  async function loadWhitelistInto(cardNode, id) {
    const wrap = cardNode.querySelector(".wlList");
    if (!wrap || wrap.dataset.loaded === "1") return;
    wrap.textContent = "Đang tải…";
    try {
      const list = await DG_READ.getWhitelist(id);
      wrap.textContent = (list && list.length) ? list.join("\n") : "—";
      wrap.dataset.loaded = "1";
    } catch {
      wrap.textContent = "—";
    }
  }

  /* -------------------- Hành động -------------------- */
  async function onRegister() {
    try {
      await ensureFeeAllowance();
      const tx = await DG.register({ gasLimit: 300000 });
      await tx.wait();
      alert("Đăng ký thành công.");
      await refreshBalances();
      await updateHeaderButtons();
    } catch (e) {
      alert(e?.error?.message || e?.message || "Đăng ký thất bại.");
    }
  }

  function openCreateDialog() {
    els.dlgCreate.showModal();
  }

  els.formCreate.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const summary = (els.fSummary.value || "").trim();
      const thongBao = (els.fThongBao.value || "").trim();
      const quiChe   = (els.fQuiChe.value || "").trim();
      const cutoff   = parseVNDateTime(els.fCutoff.value);
      const start    = parseVNDateTime(els.fStart.value);
      const end      = parseVNDateTime(els.fEnd.value);
      const startPrice = parseVNDToBN(els.fStartPrice.value);
      const step       = parseVNDToBN(els.fStep.value);

      if (!summary || !thongBao || !quiChe) throw new Error("Thiếu dữ liệu bắt buộc.");
      if (!(cutoff && start && end)) throw new Error("Định dạng thời gian không đúng (dd/mm/yyyy hh:mm).");
      const now = Math.floor(Date.now() / 1000);
      if (!(now < cutoff && cutoff <= start && start < end)) throw new Error("Thứ tự thời gian không hợp lệ.");
      if (startPrice.lte(0) || step.lte(0)) throw new Error("Giá khởi điểm/bước giá phải > 0.");

      await ensureFeeAllowance();
      const tx = await DG.createAuction({
        summary: summary,
        thongBaoUrl: thongBao,
        quiCheUrl: quiChe,
        whitelistCutoff: cutoff,
        auctionStart: start,
        auctionEnd: end,
        startPriceVND: startPrice,
        stepVND: step
      }, { gasLimit: 800000 });
      await tx.wait();
      els.dlgCreate.close();
      alert("Đã tạo phiên.");
      await renderAuctions();
    } catch (e) {
      alert(e?.error?.message || e?.message || "Tạo phiên thất bại.");
    }
  });

  async function onUpdateWhitelist(id) {
    try {
      const addRaw = prompt("Nhập địa chỉ cần THÊM (phân tách bằng dấu phẩy):", "");
      const remRaw = prompt("Nhập địa chỉ cần GỠ (phân tách bằng dấu phẩy, có thể bỏ trống):", "");
      const addrs = (addRaw || "").split(",").map(s => s.trim()).filter(Boolean);
      const rems  = (remRaw || "").split(",").map(s => s.trim()).filter(Boolean);

      await ensureFeeAllowance();
      const tx = await DG.updateWhitelist(id, addrs, rems, { gasLimit: 900000 });
      await tx.wait();
      alert("Đã cập nhật whitelist.");
      await renderAuctions();
    } catch (e) {
      alert(e?.error?.message || e?.message || "Cập nhật whitelist thất bại.");
    }
  }

  async function onBid(id) {
    try {
      const min = await DG.getMinNextBid(id);
      const human = fmtVND(min.toString());
      const raw = prompt(`Nhập giá (VND) ≥ ${human}:`, min.toString());
      if (raw == null) return;
      const amt = parseVNDToBN(raw);
      if (amt.lt(min)) { alert("Giá quá thấp."); return; }

      await ensureFeeAllowance();
      const tx = await DG.placeBid(id, amt, { gasLimit: 600000 });
      await tx.wait();
      alert("Đã bỏ giá.");
      await renderAuctions();
    } catch (e) {
      alert(e?.error?.message || e?.message || "Bỏ giá thất bại.");
    }
  }

  /* -------------------- Tìm kiếm -------------------- */
  function applyFilters() {
    const q = (els.search.value || "").trim().toLowerCase();
    const st = els.filter.value;
    [...els.list.children].forEach(card => {
      const title = card.querySelector(".title")?.textContent?.toLowerCase() || "";
      const status = card.querySelector(".status")?.textContent || "";
      let ok = !q || title.includes(q);
      if (ok && st !== "") {
        const m = { "0": "Chưa diễn ra", "1": "Đang diễn ra", "2": "Đã kết thúc", "3": "Đã chốt" };
        ok = status.includes(m[st]);
      }
      card.style.display = ok ? "" : "none";
    });
  }

  /* -------------------- Khởi động -------------------- */
  document.addEventListener("DOMContentLoaded", async () => {
    // Kết nối ví
    els.connect?.addEventListener("click", connectWallet);
    els.disconnect?.addEventListener("click", disconnectWallet);

    // Header actions
    els.btnRegister?.addEventListener("click", onRegister);
    els.btnOpenCreate?.addEventListener("click", openCreateDialog);

    // Tìm kiếm
    els.btnSearch?.addEventListener("click", applyFilters);
    els.btnClear?.addEventListener("click", () => {
      els.search.value = ""; els.filter.value = ""; applyFilters();
    });

    // Auto detect tài khoản đã kết nối
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length) {
          await connectWallet();
        }
      } catch {}
    }

    // Luôn tải danh sách để người chưa kết nối vẫn xem được
    await renderAuctions();
  });
})();
