/* ==========================================================================
   daugia.vin — app.js (ethers v5, mobile-friendly)
   - Countdown ở đầu mỗi phiên (kể cả khi chưa kết nối ví)
   - Whitelist hiển thị rộng; mỗi ví có nút "Mở" (mở UNC nếu có)
   - Nút "Bỏ giá" hiện ngay khi vào whitelist; chỉ enable trong giờ live
   - Fix MetaMask Mobile: tránh _blank; bỏ emoji trên iOS/MM
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

  // ERC20 tối giản
  const ERC20_MIN_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];

  // ABI tối giản đủ dùng
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
      "name": "placeBid", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ], "name": "finalize", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
  ];

  const FEE_VIN = ethers.utils.parseUnits("0.001", 18); // phí 0.001 VIN
  const VN_TZ = "Asia/Bangkok";

  /* -------------------- Trạng thái & nhà cung cấp -------------------- */
  const readProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const DG_READ = new ethers.Contract(DG_ADDR, DG_ABI, readProvider);

  let web3Provider = null, signer = null, account = null;
  let DG = null, VIN = null;

  /* -------------------- Mobile helpers -------------------- */
  const UA = navigator.userAgent || "";
  const IS_IOS = /iPhone|iPad|iPod/i.test(UA);
  const IS_MMOBILE = /MetaMask/i.test(UA);
  // Mở link an toàn cho MetaMask Mobile/iOS (tránh _blank gây crash)
  function openExternal(url) {
    try {
      if (!url) return;
      if (IS_MMOBILE || IS_IOS) {
        location.href = url;            // điều hướng trực tiếp
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch {
      location.href = url;
    }
  }
  const MM_SAFE_TEXT = (s) => (IS_MMOBILE || IS_IOS) ? String(s||"").replace(/[⏳🟢🔴]/g,"") : s;

  // Ping giữ kết nối ấm
  let pingTimer = null;
  const startPing = () => { stopPing(); pingTimer = setInterval(() => readProvider.getBlockNumber().catch(() => {}), 45000); };
  const stopPing  = () => { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } };

  // Re-evaluate theo chu kỳ (mobile 10s, desktop 5s)
  let reevalTimer = null;
  const REEVAL_MS = (IS_MMOBILE || IS_IOS) ? 10000 : 5000;
  const startReevalTimer = () => { stopReevalTimer(); reevalTimer = setInterval(reevaluateAllCards, REEVAL_MS); };
  const stopReevalTimer  = () => { if (reevalTimer) { clearInterval(reevalTimer); reevalTimer = null; } };

  let connectBusy = false;

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
  const appendDong = (s) => s ? (s + " đồng") : "—";
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
    const s = d.toLocaleString("vi-VN", { timeZone: VN_TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    return s.replace(",", "");
  }
  function parseVNDateTime(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    let dd = +m[1], mm = +m[2] - 1, yyyy = +m[3], HH = +m[4], MM = +m[5];
    const ms = Date.UTC(yyyy, mm, dd, HH - 7, MM, 0); // VN = UTC+7
    return Math.floor(ms / 1000);
  }
  const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s||"").trim());
  const isUrl  = (s) => !s || /^(https?:)?\/\//i.test(String(s));

  const numOr0 = (x) => { try { return ethers.BigNumber.isBigNumber(x) ? x.toNumber() : Number(x||0); } catch { return 0; } };

  /* -------------------- Kết nối ví -------------------- */
  async function ensureChain() {
    const provider = window.ethereum;
    const chainId = await provider.request({ method: "eth_chainId" });
    if (chainId === CHAIN_ID_HEX) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e.code === 4902) await provider.request({ method: "wallet_addEthereumChain", params: [CHAIN_INFO] });
      else throw e;
    }
  }

  async function connectWallet() {
    if (connectBusy) return;
    connectBusy = true;
    try {
      if (!window.ethereum || !window.ethers) { alert("Không tìm thấy ví Web3. Hãy cài MetaMask / dùng trình duyệt ví."); return; }
      web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");

      let accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (!accounts || !accounts.length) {
        try {
          await ensureChain();
          accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        } catch (e) {
          if (e?.code === -32002) { alert("Ví đang bận xử lý yêu cầu trước. Mở ứng dụng ví, chấp thuận yêu cầu đang chờ rồi thử lại."); return; }
          if (e?.code === 4001) { return; }
          throw e;
        }
      } else {
        await ensureChain();
      }

      signer = web3Provider.getSigner();
      account = await signer.getAddress();
      DG = new ethers.Contract(DG_ADDR, DG_ABI, signer);
      VIN = new ethers.Contract(VIN_ADDR, ERC20_MIN_ABI, signer);

      els.connect.classList.add("hidden");
      els.walletInfo.classList.remove("hidden");
      els.addrShort.textContent = shortAddr(account);

      await refreshBalances();
      await updateHeaderButtons();
      await renderAuctions();
      startReevalTimer();

      window.ethereum.on && window.ethereum.on("accountsChanged", () => location.reload());
      window.ethereum.on && window.ethereum.on("chainChanged", () => location.reload());
      window.ethereum.on && window.ethereum.on("disconnect", () => location.reload());

      window.addEventListener("focus", tryWarm);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { tryWarm(); startPing(); } else { stopPing(); } });
      startPing();
    } catch (e) {
      console.error(e);
      const msg = e?.error?.message || e?.message || String(e);
      alert(/internal JSON-RPC|network|timeout/i.test(msg) ? "Kết nối mạng không ổn định. Vui lòng mở lại ví và thử lại." : msg);
    } finally {
      connectBusy = false;
    }
  }

  function disconnectWallet() {
    signer = null; account = null; DG = null; VIN = null;
    els.walletInfo.classList.add("hidden");
    els.connect.classList.remove("hidden");
    els.btnRegister.classList.add("hidden");
    els.btnOpenCreate.classList.add("hidden");
    stopPing(); stopReevalTimer();
  }

  async function tryWarm() {
    try {
      if (!window.ethereum) return;
      await window.ethereum.request({ method: "eth_chainId" });
      if (web3Provider && account) await refreshBalances();
    } catch {}
  }

  async function refreshBalances() {
    if (!account || !web3Provider || !VIN) return;
    const vicWei = await web3Provider.getBalance(account);
    els.vicBal.textContent = Number(ethers.utils.formatEther(vicWei)).toFixed(4);
    const d = await VIN.decimals().catch(() => 18);
    const vinBal = await VIN.balanceOf(account);
    els.vinBal.textContent = Number(ethers.utils.formatUnits(vinBal, d)).toFixed(4);
  }

  async function updateHeaderButtons() {
    if (!DG || !account) return;
    const isReg = await DG.isRegistered(account);
    els.btnRegister.classList.toggle("hidden", isReg);
    els.btnOpenCreate.classList.toggle("hidden", !isReg);
  }

  async function ensureFeeAllowance() {
    const allow = await VIN.allowance(account, DG_ADDR);
    if (allow.gte(FEE_VIN)) return;
    const tx = await VIN.approve(DG_ADDR, FEE_VIN);
    await tx.wait();
  }

  /* -------------------- Render danh sách -------------------- */
  async function fetchAuctionCount() {
    try { return await DG_READ.auctionCount(); }
    catch (e) { console.error("auctionCount failed:", e); return ethers.BigNumber.from(0); }
  }
  async function fetchAuction(id) {
    const a = await DG_READ.getAuction(id);
    const st = await DG_READ.getStatus(id);
    return { a, st };
  }

  async function renderAuctions() {
    els.list.textContent = "Đang tải…";
    try {
      if (!els.tpl || !els.tpl.content || !els.tpl.content.firstElementChild) {
        console.error("Template #tpl-auction không khả dụng");
        els.list.textContent = "Lỗi template. Kiểm tra lại index.html.";
        return;
      }
      const countBN = await fetchAuctionCount();
      const num = ethers.BigNumber.from(countBN || 0).toNumber();
      const ids = [];
      for (let i = num; i >= 1; i--) ids.push(i);
      els.list.innerHTML = "";
      if (!ids.length) { els.list.textContent = "Chưa có cuộc đấu giá."; return; }

      let okCount = 0;
      for (const id of ids) {
        try {
          const card = await buildCard(id);
          els.list.appendChild(card);
          okCount++;
        } catch (err) {
          console.warn(`Bỏ qua phiên #${id} vì lỗi:`, err?.message || err);
          continue;
        }
      }
      if (okCount === 0) els.list.textContent = "Không tải được danh sách.";
    } catch (e) {
      console.error(e);
      els.list.textContent = "Không tải được danh sách.";
    }
  }

  /* -------------------- Đồng hồ đếm ngược -------------------- */
  const countdownTimers = new Map(); // id -> intervalId
  function formatDHMS(ms) {
    if (ms <= 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss= s % 60;
    const hh = String(h).padStart(2,"0"), mm = String(m).padStart(2,"0"), ss2 = String(ss).padStart(2,"0");
    return d>0 ? `${d}d ${hh}:${mm}:${ss2}` : `${hh}:${mm}:${ss2}`;
  }
  function attachCountdown(node, id, startTs, endTs) {
    let cd = node.querySelector(".countdown");
    if (!cd) {
      cd = document.createElement("div");
      cd.className = "countdown";
      cd.style.margin = "6px 0 8px";
      cd.style.fontWeight = "700";
      cd.style.fontSize = "0.95rem";
      cd.style.color = "#9ddcff";
      const title = node.querySelector(".title");
      (title?.parentNode || node).insertBefore(cd, (title?.nextSibling || node.firstChild));
    }

    const old = countdownTimers.get(id);
    if (old) clearInterval(old);

    const tick = () => {
      const nowMs = Date.now();
      const startMs = startTs * 1000;
      const endMs   = endTs   * 1000;
      let text = "";
      if (nowMs < startMs) {
        text = `Con ${formatDHMS(startMs - nowMs)} den khi bat dau`;
      } else if (nowMs >= startMs && nowMs < endMs) {
        text = `Dang dien ra — con ${formatDHMS(endMs - nowMs)} den khi ket thuc`;
      } else {
        text = `Da ket thuc`;
      }
      cd.textContent = MM_SAFE_TEXT(text); // loại emoji trên iOS/MM
    };
    tick();
    const tId = setInterval(tick, 1000);
    countdownTimers.set(id, tId);
  }

  /* -------------------- Xây card -------------------- */
  const appendDong = (s) => s ? (s + " đồng") : "—";
  async function buildCard(id) {
    const { a, st } = await fetchAuction(id);
    const node = els.tpl.content.firstElementChild.cloneNode(true);
    node.id = "auction-" + id;

    const cutoffTs = numOr0(a.whitelistCutoff);
    const startTs  = numOr0(a.auctionStart);
    const endTs    = numOr0(a.auctionEnd);

    node.querySelector(".title").textContent = a.summary || `(Phiên #${id})`;
    attachCountdown(node, id, startTs, endTs);

    const body = node.querySelector(".card-body");
    node.querySelector(".detailBtn").addEventListener("click", () => {
      body.classList.toggle("hidden");
      if (!body.classList.contains("hidden")) loadWhitelistInto(node, id);
      updateCardActions(node, a, id, { cutoffTs, startTs, endTs });
    });

    node.querySelector(".snippet").textContent = " ";
    const tb = node.querySelector(".thongbao");
    const qc = node.querySelector(".quyche");
    tb.href = a.thongBaoUrl || "#"; tb.onclick = (e)=>{ if(tb.href!=="#") openExternal(tb.href); e.preventDefault(); };
    qc.href = a.quiCheUrl   || "#"; qc.onclick = (e)=>{ if(qc.href!=="#") openExternal(qc.href); e.preventDefault(); };

    node.querySelector(".time").textContent   = `${epochToVN(startTs)} → ${epochToVN(endTs)}`;
    node.querySelector(".cutoff").textContent = epochToVN(cutoffTs);

    node.querySelector(".startPrice").textContent = appendDong(fmtVND(a.startPriceVND?.toString() || "0"));
    node.querySelector(".step").textContent       = appendDong(fmtVND(a.stepVND?.toString() || "0"));

    const hasLeader = (a.currentLeader || ethers.constants.AddressZero) !== ethers.constants.AddressZero;
    node.querySelector(".current").textContent    = hasLeader ? appendDong(fmtVND(a.currentPriceVND?.toString() || "0")) : "—";
    node.querySelector(".leader").textContent     = hasLeader ? shortAddr(a.currentLeader) : "—";

    node.querySelector(".status").textContent = `Tình trạng: ${["Chưa diễn ra","Đang diễn ra","Đã kết thúc","Đã chốt"][Number(st)] ?? "—"}`;

    node.querySelector(".joinBtn").addEventListener("click", () => {
      [...els.list.children].forEach(el => { if (el !== node) el.style.display = "none"; });
      body.classList.remove("hidden");
      loadWhitelistInto(node, id);
      updateCardActions(node, a, id, { cutoffTs, startTs, endTs });
    });
    node.querySelector(".backBtn").addEventListener("click", () => { [...els.list.children].forEach(el => { el.style.display = ""; }); });

    await updateCardActions(node, a, id, { cutoffTs, startTs, endTs });
    return node;
  }

  async function updateCardActions(node, a, id, times) {
    const { cutoffTs, startTs, endTs } = times || {};
    const regBtn    = node.querySelector(".regBtn");
    const createBtn = node.querySelector(".createBtn");
    const updBtn    = node.querySelector(".updateWlBtn");
    const bidBtn    = node.querySelector(".bidBtn");

    createBtn?.classList.add("hidden");

    if (!account || !DG) {
      regBtn?.classList.add("hidden");
      updBtn?.classList.add("hidden");
      bidBtn?.classList.add("hidden");
      return;
    }

    try {
      const isReg = await DG.isRegistered(account);
      regBtn.classList.toggle("hidden", isReg);
      regBtn.onclick = onRegister;
      els.btnRegister.classList.toggle("hidden", isReg);
      els.btnOpenCreate.classList.toggle("hidden", !isReg);
    } catch {}

    const isOrg = (a.organizer || "").toLowerCase() === (account || "").toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    const canUpd = isOrg && now < (cutoffTs ?? numOr0(a.whitelistCutoff));
    updBtn?.classList.toggle("hidden", !canUpd);
    updBtn.onclick = canUpd ? (() => makeUpdateForm(node, id, (cutoffTs ?? numOr0(a.whitelistCutoff)))) : null;

    try {
      const isWL = await DG.isWhitelisted(id, account);
      const sTs = (startTs ?? numOr0(a.auctionStart));
      const eTs = (endTs   ?? numOr0(a.auctionEnd));
      const live = now >= sTs && now < eTs;

      const showBid = isWL;
      const enableBid = isWL && live;

      bidBtn?.classList.toggle("hidden", !showBid);
      bidBtn.disabled = !enableBid;
      bidBtn.title = enableBid ? "" : (isWL ? "Ngoài thời gian diễn ra phiên" : "Bạn chưa trong danh sách ví đã cọc");
      bidBtn.onclick = enableBid ? (() => onBid(id)) : null;
    } catch (e) {
      bidBtn?.classList.add("hidden");
      bidBtn.onclick = null;
    }
  }

  /* -------------------- Whitelist UI (rộng + nút MỞ xem tài liệu) -------------------- */
  function ensureWlBoxStyle(box) {
    box.style.whiteSpace = "normal";
    box.style.background = "#0d1422";
    box.style.border = "1px dashed #223049";
    box.style.borderRadius = "12px";
    box.style.padding = "12px";
    box.style.margin = "10px 0";
    box.style.maxHeight = "380px";
    box.style.overflow = "auto";
  }
  function buildWlRow(id, addr) {
    const wrap = document.createElement("div");
    wrap.style.padding = "10px 0";
    wrap.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

    const address = document.createElement("div");
    address.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    address.style.fontSize = "0.95rem";
    address.style.wordBreak = "break-all";
    address.textContent = addr;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Mở";
    btn.style.marginTop = "8px";
    btn.style.background = "linear-gradient(180deg,#60a5fa,#3b82f6)";
    btn.style.border = "none"; btn.style.fontWeight = "800";
    btn.style.padding = "8px 14px";

    btn.onclick = () => {
      const key = `unc:${id}:${addr.toLowerCase()}`;
      const unc = sessionStorage.getItem(key);
      if (unc && /^https?:\/\//i.test(unc)) {
        openExternal(unc);
      } else {
        alert("Người tạo cuộc đấu giá không cung cấp tài liệu.");
      }
      // TODO: nối tới nguồn UNC công khai (IPFS/API) khi sẵn sàng.
    };

    wrap.append(address, btn);
    return wrap;
  }

  async function loadWhitelistInto(cardNode, id) {
    const wrap = cardNode.querySelector(".wlList");
    if (!wrap) return;
    wrap.textContent = "Đang tải…";
    try {
      const list = await DG_READ.getWhitelist(id);
      wrap.innerHTML = "";
      ensureWlBoxStyle(wrap);
      if (!list || !list.length) {
        wrap.textContent = "—";
        return;
      }
      for (const addr of list) {
        wrap.appendChild(buildWlRow(id, addr));
      }
    } catch (e) {
      console.error("getWhitelist failed:", e);
      wrap.textContent = "—";
    }
  }

  /* -------------------- Form cập nhật whitelist (1 ví/lần) -------------------- */
  function makeUpdateForm(cardNode, id, cutoffSec) {
    let box = cardNode.querySelector(".wlForm");
    if (box) { box.classList.toggle("hidden"); return box; }

    box = document.createElement("div");
    box.className = "wlForm";
    box.style.marginTop = "10px";
    box.style.padding = "12px";
    box.style.border = "1px dashed #223049";
    box.style.borderRadius = "10px";
    box.style.background = "#0d1422";

    const labelAddr = document.createElement("label");
    labelAddr.style.display = "block"; labelAddr.style.marginBottom = "8px";
    labelAddr.innerHTML = `Địa chỉ ví đã đặt cọc (bắt buộc, 1 ví/lần):<br/>`;
    const inAddr = document.createElement("input");
    inAddr.type = "text"; inAddr.placeholder = "0x…"; inAddr.required = true;
    inAddr.autocomplete = "off"; inAddr.style.width = "100%";
    inAddr.style.padding = "10px"; inAddr.style.borderRadius = "8px";
    inAddr.style.border = "1px solid #223049"; inAddr.style.background = "#0f1522";
    inAddr.style.color = "#e8edf6";
    labelAddr.appendChild(inAddr);

    const labelUNC = document.createElement("label");
    labelUNC.style.display = "block"; labelUNC.style.margin = "10px 0 8px";
    labelUNC.innerHTML = `Link UNC (không bắt buộc):<br/>`;
    const inUNC = document.createElement("input");
    inUNC.type = "url"; inUNC.placeholder = "https://…";
    inUNC.style.width = "100%"; inUNC.style.padding = "10px";
    inUNC.style.borderRadius = "8px"; inUNC.style.border = "1px solid #223049";
    inUNC.style.background = "#0f1522"; inUNC.style.color = "#e8edf6";
    labelUNC.appendChild(inUNC);

    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "8px"; row.style.marginTop = "10px"; row.style.flexWrap = "wrap";

    const btnSubmit = document.createElement("button");
    btnSubmit.className = "btn";
    btnSubmit.textContent = "Cập nhật";
    btnSubmit.style.background = "linear-gradient(180deg,#22c55e,#199c49)";
    btnSubmit.style.border = "none"; btnSubmit.style.fontWeight = "800";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn ghost";
    btnCancel.textContent = "Hủy";

    row.append(btnSubmit, btnCancel);
    box.append(labelAddr, labelUNC, row);

    btnCancel.onclick = (e) => { e.preventDefault(); box.classList.add("hidden"); };

    btnSubmit.onclick = async (e) => {
      e.preventDefault();
      try {
        const addr = String(inAddr.value || "").trim();
        const unc  = String(inUNC.value || "").trim();
        if (!isAddr(addr)) { alert("Địa chỉ ví không hợp lệ."); inAddr.focus(); return; }
        if (!isUrl(unc))   { alert("UNC không hợp lệ (nếu nhập phải là URL)."); inUNC.focus(); return; }

        const now = Math.floor(Date.now() / 1000);
        if (now >= cutoffSec) { alert("Đã quá hạn cập nhật whitelist."); return; }

        const existed = await DG.isWhitelisted(id, addr);
        if (existed) { alert("Ví này đã có trong danh sách."); return; }

        await ensureFeeAllowance();
        const tx = await DG.updateWhitelist(id, [addr], [], { gasLimit: 5_000_000 });
        await tx.wait();

        try { if (unc) sessionStorage.setItem(`unc:${id}:${addr.toLowerCase()}`, unc); } catch {}

        alert("Đã cập nhật whitelist.");
        await loadWhitelistInto(cardNode, id);

        const { a } = await fetchAuction(id);
        const startTs = numOr0(a.auctionStart);
        const endTs   = numOr0(a.auctionEnd);
        await updateCardActions(cardNode, a, id, { cutoffTs: cutoffSec, startTs, endTs });

        box.classList.add("hidden");
      } catch (e) {
        console.error(e);
        alert(e?.error?.message || e?.message || "Cập nhật whitelist thất bại.");
      }
    };

    const actions = cardNode.querySelector(".actions-row") || cardNode;
    actions.after(box);
    return box;
  }

  /* -------------------- Hành động (gasLimit cao) -------------------- */
  async function guardOnlineAndChain() {
    if (!window.navigator.onLine) throw new Error("Thiết bị đang offline.");
    await ensureChain();
  }

  async function onRegister() {
    try {
      await guardOnlineAndChain();
      await ensureFeeAllowance();
      const tx = await DG.register({ gasLimit: 5_000_000 });
      await tx.wait();
      alert("Đăng ký thành công.");
      await refreshBalances();
      await updateHeaderButtons();
      await renderAuctions();
    } catch (e) {
      alert(e?.error?.message || e?.message || "Đăng ký thất bại.");
    }
  }

  function openCreateDialog() { els.dlgCreate.showModal(); }

  els.formCreate.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await guardOnlineAndChain();

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
      }, { gasLimit: 5_000_000 });
      await tx.wait();
      els.dlgCreate.close();
      alert("Đã tạo phiên.");
      await renderAuctions();
    } catch (e) {
      alert(e?.error?.message || e?.message || "Tạo phiên thất bại.");
    }
  });

  async function onBid(id) {
    try {
      await guardOnlineAndChain();
      const min = await DG.getMinNextBid(id);
      const human = fmtVND(min.toString());
      const raw = prompt(`Nhập giá (VND) ≥ ${human}:`, min.toString());
      if (raw == null) return;
      const amt = parseVNDToBN(raw);
      if (amt.lt(min)) { alert("Giá quá thấp."); return; }

      await ensureFeeAllowance();
      const tx = await DG.placeBid(id, amt, { gasLimit: 5_000_000 });
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

  async function reevaluateAllCards() {
    try {
      const cards = [...els.list.children];
      if (!cards.length) return;
      for (const node of cards) {
        const idStr = (node.id || "").replace("auction-", "");
        const id = idStr ? Number(idStr) : null;
        if (!id) continue;
        try {
          const { a } = await fetchAuction(id);
          const startTs = numOr0(a.auctionStart);
          const endTs   = numOr0(a.auctionEnd);
          const cutoffTs= numOr0(a.whitelistCutoff);
          attachCountdown(node, id, startTs, endTs); // update đồng hồ
          await updateCardActions(node, a, id, { cutoffTs, startTs, endTs });
        } catch (e) {
          console.warn("Reeval skip id", id, e?.message || e);
        }
      }
    } catch {}
  }

  /* -------------------- Khởi động -------------------- */
  document.addEventListener("DOMContentLoaded", async () => {
    els.connect?.addEventListener("click", connectWallet);
    els.disconnect?.addEventListener("click", disconnectWallet);

    els.btnRegister?.addEventListener("click", onRegister);
    els.btnOpenCreate?.addEventListener("click", openCreateDialog);

    els.btnSearch?.addEventListener("click", applyFilters);
    els.btnClear?.addEventListener("click", () => { els.search.value = ""; els.filter.value = ""; applyFilters(); });

    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length) { await connectWallet(); }
      } catch {}
    }

    await renderAuctions();
    startReevalTimer();

    if (document.visibilityState === "visible") startPing();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") startPing(); else stopPing(); });
  });
})();
