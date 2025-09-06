<script>
/* ==========================================================================
   daugia.vin — app.js (ethers v5, stable build)
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ DG_ADDR
   Token: VIN @ VIN_ADDR
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

  // Địa chỉ đã dùng trong tài liệu của bạn
  const DG_ADDR  = "0x44DeC3CBdF3448F05f082050aBC9697d8224f511"; // DauGia
  const VIN_ADDR = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4"; // VIN (18d)

  // ABI DauGia (rút gọn đúng hàm dùng)
  const DG_ABI = [
    {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[],"name":"auctionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"components":[
      {"internalType":"string","name":"summary","type":"string"},
      {"internalType":"string","name":"thongBaoUrl","type":"string"},
      {"internalType":"string","name":"quiCheUrl","type":"string"},
      {"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},
      {"internalType":"uint40","name":"auctionStart","type":"uint40"},
      {"internalType":"uint40","name":"auctionEnd","type":"uint40"},
      {"internalType":"uint128","name":"startPriceVND","type":"uint128"},
      {"internalType":"uint128","name":"stepVND","type":"uint128"}
    ],"internalType":"struct DauGia.AuctionInit","name":"a","type":"tuple"}],
     "name":"createAuction","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
     "stateMutability":"nonpayable","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
     "name":"getAuction","outputs":[{"components":[
      {"internalType":"address","name":"organizer","type":"address"},
      {"internalType":"string","name":"summary","type":"string"},
      {"internalType":"string","name":"thongBaoUrl","type":"string"},
      {"internalType":"string","name":"quiCheUrl","type":"string"},
      {"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},
      {"internalType":"uint40","name":"auctionStart","type":"uint40"},
      {"internalType":"uint40","name":"auctionEnd","type":"uint40"},
      {"internalType":"uint128","name":"startPriceVND","type":"uint128"},
      {"internalType":"uint128","name":"stepVND","type":"uint128"},
      {"internalType":"uint128","name":"currentPriceVND","type":"uint128"},
      {"internalType":"address","name":"currentLeader","type":"address"},
      {"internalType":"bool","name":"finalized","type":"bool"},
      {"internalType":"bool","name":"success","type":"bool"}
    ],"internalType":"struct DauGia.Auction","name":"","type":"tuple"}],
     "stateMutability":"view","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
     "name":"getStatus","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],
     "stateMutability":"view","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
     "name":"getMinNextBid","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],
     "stateMutability":"view","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
     "name":"getWhitelist","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],
     "stateMutability":"view","type":"function"
    },
    {"inputs":[{"internalType":"address","name":"user","type":"address"}],
     "name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],
     "stateMutability":"view","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"user","type":"address"}],
     "name":"isWhitelisted","outputs":[{"internalType":"bool","name":"","type":"bool"}],
     "stateMutability":"view","type":"function"
    },
    {"inputs":[],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address[]","name":"addrs","type":"address[]"},{"internalType":"address[]","name":"removes","type":"address[]"}],
     "name":"updateWhitelist","outputs":[],"stateMutability":"nonpayable","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint128","name":"amountVND","type":"uint128"}],
     "name":"placeBid","outputs":[],"stateMutability":"nonpayable","type":"function"
    },
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
     "name":"finalize","outputs":[],"stateMutability":"nonpayable","type":"function"
    },
    {"inputs":[],"name":"FEE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
  ];

  // ERC20 tối giản
  const ERC20_MIN_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];

  const FEE_VIN = ethers.utils.parseUnits("0.001", 18);
  const VN_TZ = "Asia/Bangkok";

  /* -------------------- Provider & Contracts -------------------- */
  const readProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const DG_READ = new ethers.Contract(DG_ADDR, DG_ABI, readProvider);

  let web3Provider = null, signer = null, account = null;
  let DG = null, VIN = null;

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

  /* -------------------- Helpers -------------------- */
  const UA = navigator.userAgent || "";
  const IS_IOS = /iPhone|iPad|iPod/i.test(UA);
  const IS_MMOBILE = /MetaMask/i.test(UA);
  function setSmartLink(a, url) {
    if (!a) return;
    if (!url) {
      a.removeAttribute("href");
      a.classList.add("disabled");
      return;
    }
    a.href = url;
    if (IS_MMOBILE || IS_IOS) { a.target = "_self"; a.removeAttribute("rel"); }
    else { a.target = "_blank"; a.rel = "noopener"; }
  }
  const shortAddr = (a) => a ? (a.slice(0,6) + "…" + a.slice(-4)) : "";
  function fmtVND(x) {
    const s = (typeof x === "string") ? x.replace(/\D/g,"") :
              ethers.BigNumber.isBigNumber(x) ? x.toString() :
              String(x ?? "").replace(/\D/g,"");
    if (!s) return "0";
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function parseVNDToBN(s) {
    const digits = String(s ?? "").replace(/\D/g, "");
    return digits ? ethers.BigNumber.from(digits) : ethers.BigNumber.from(0);
  }
  function epochToVN(sec) {
    const d = new Date(sec * 1000);
    const s = d.toLocaleString("vi-VN", { timeZone: VN_TZ, hour12: false,
      year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
    return s.replace(",", "");
  }
  function parseVNDateTime(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    let dd=+m[1], mm=+m[2]-1, yyyy=+m[3], HH=+m[4], MM=+m[5];
    const ms = Date.UTC(yyyy, mm, dd, HH - 7, MM, 0); // VN=UTC+7
    return Math.floor(ms/1000);
  }
  const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s||"").trim());
  function statusLabel(st) {
    // 0: BeforeStart, 1: Live, 2: Ended, 3: Finalized  (suy diễn từ UI)
    const map = ["Chưa diễn ra","Đang diễn ra","Đã kết thúc","Đã chốt"];
    return map[Number(st)] ?? String(st);
  }

  /* -------------------- Kết nối ví -------------------- */
  async function ensureChain() {
    const provider = window.ethereum;
    const chainId = await provider.request({ method: "eth_chainId" });
    if (chainId === CHAIN_ID_HEX) return;
    try {
      await provider.request({ method:"wallet_switchEthereumChain", params:[{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e.code === 4902) {
        await provider.request({ method:"wallet_addEthereumChain", params:[CHAIN_INFO] });
      } else { throw e; }
    }
  }

  let connectBusy = false;
  async function connectWallet() {
    if (connectBusy) return;
    connectBusy = true;
    try {
      if (!window.ethereum || !window.ethers) {
        alert("Không tìm thấy ví Web3. Hãy cài MetaMask / dùng trình duyệt ví."); return;
      }
      web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");

      let accounts = await window.ethereum.request({ method:"eth_accounts" });
      if (!accounts || !accounts.length) {
        try {
          await ensureChain();
          accounts = await window.ethereum.request({ method:"eth_requestAccounts" });
        } catch (e) {
          if (e?.code === -32002) { alert("Ví đang bận xử lý yêu cầu trước. Mở ứng dụng ví, chấp thuận yêu cầu đang chờ rồi thử lại."); return; }
          if (e?.code === 4001) { return; } // user rejected
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

      // Reload on account/chain changes (đơn giản, ổn định)
      window.ethereum.on && window.ethereum.on("accountsChanged", () => location.reload());
      window.ethereum.on && window.ethereum.on("chainChanged", () => location.reload());
      window.ethereum.on && window.ethereum.on("disconnect", () => location.reload());
    } catch (e) {
      console.error(e);
      const msg = e?.error?.message || e?.message || String(e);
      alert(/internal JSON-RPC|network|timeout/i.test(msg)
        ? "Kết nối mạng không ổn định. Vui lòng mở lại ví và thử lại."
        : msg);
    } finally { connectBusy = false; }
  }

  function disconnectWallet() {
    signer = null; account = null; DG = null; VIN = null;
    els.walletInfo.classList.add("hidden");
    els.connect.classList.remove("hidden");
    els.btnRegister.classList.add("hidden");
    els.btnOpenCreate.classList.add("hidden");
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

  /* -------------------- Load & render danh sách -------------------- */
  async function fetchAuctionCount() {
    try { return await DG_READ.auctionCount(); }
    catch (e) { console.error("auctionCount failed:", e); return ethers.BigNumber.from(0); }
  }
  async function fetchAuction(id) {
    const a = await DG_READ.getAuction(id);
    const st = await DG_READ.getStatus(id);
    return { a, st };
  }

  // Countdown
  const countdownTimers = new Map(); // id -> intervalId
  function formatDHMS(ms) {
    if (ms <= 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400)/3600);
    const m = Math.floor((s % 3600)/60);
    const ss= s % 60;
    const hh=String(h).padStart(2,"0"), mm=String(m).padStart(2,"0"), ss2=String(ss).padStart(2,"0");
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
      const startMs = Number(startTs) * 1000;
      const endMs   = Number(endTs)   * 1000;
      let text = "";
      if (nowMs < startMs) text = `Còn ${formatDHMS(startMs - nowMs)} đến khi bắt đầu`;
      else if (nowMs >= startMs && nowMs < endMs) text = `Đang diễn ra — còn ${formatDHMS(endMs - nowMs)} đến khi kết thúc`;
      else text = `Đã kết thúc`;
      cd.textContent = text;
    };
    tick();
    const t = setInterval(tick, 1000);
    countdownTimers.set(id, t);
  }

  async function buildCard(id) {
    if (!els.tpl || !els.tpl.content || !els.tpl.content.firstElementChild) {
      throw new Error("Template #tpl-auction không khả dụng. Kiểm tra index.html.");
    }
    const { a, st } = await fetchAuction(id);
    const node = els.tpl.content.firstElementChild.cloneNode(true);

    // Title & status
    node.querySelector(".title").textContent = a.summary || `Phiên #${id}`;
    node.querySelector(".status").textContent = statusLabel(st);

    // Info block
    node.querySelector(".organizer").textContent = shortAddr(a.organizer);
    node.querySelector(".start").textContent = epochToVN(a.auctionStart);
    node.querySelector(".end").textContent   = epochToVN(a.auctionEnd);
    node.querySelector(".cutoff").textContent= epochToVN(a.whitelistCutoff);
    node.querySelector(".startPrice").textContent = fmtVND(a.startPriceVND);
    node.querySelector(".step").textContent  = fmtVND(a.stepVND);
    node.querySelector(".current").textContent = fmtVND(a.currentPriceVND);
    node.querySelector(".leader").textContent = a.currentLeader && a.currentLeader !== ethers.constants.AddressZero
      ? shortAddr(a.currentLeader) : "—";

    // Docs
    const openTB = node.querySelector(".open-thongbao");
    const openQC = node.querySelector(".open-quiche");
    setSmartLink(openTB, a.thongBaoUrl || "");
    setSmartLink(openQC, a.quiCheUrl || "");

    // Whitelist (rút gọn)
    const wlBox = node.querySelector(".wlList");
    try {
      const wl = await DG_READ.getWhitelist(id);
      const sample = wl.slice(0, 12).map(shortAddr).join(", ");
      wlBox.textContent = wl.length ? (wl.length > 12 ? (sample + ` … (+${wl.length-12})`) : sample) : "—";
    } catch { wlBox.textContent = "—"; }

    // Countdown
    attachCountdown(node, id, a.auctionStart, a.auctionEnd);

    // Buttons visibility theo quyền & trạng thái
    const btnBid   = node.querySelector(".btn-bid");
    const btnWL    = node.querySelector(".btn-wl");
    const btnFinal = node.querySelector(".btn-finalize");

    const isOwner = account && account.toLowerCase() === a.organizer.toLowerCase();
    const now = Math.floor(Date.now()/1000);
    const beforeCutoff = now < Number(a.whitelistCutoff);
    const live = now >= Number(a.auctionStart) && now < Number(a.auctionEnd);
    const ended = now >= Number(a.auctionEnd);
    const finalized = Boolean(a.finalized);

    // WL button: chỉ chủ phiên trước cutoff
    btnWL.classList.toggle("hidden", !(isOwner && beforeCutoff));

    // Bid button: cần ví trong WL + đang diễn ra + chưa finalized
    let showBid = false;
    if (account && live && !finalized) {
      try {
        showBid = await DG_READ.isWhitelisted(id, account);
      } catch { showBid = false; }
    }
    btnBid.classList.toggle("hidden", !showBid);

    // Finalize: sau khi kết thúc và chưa finalized (ai cũng bấm được)
    btnFinal.classList.toggle("hidden", !(ended && !finalized));

    // Bind hành động
    btnBid?.addEventListener("click", async () => {
      try {
        if (!DG) return alert("Hãy kết nối ví trước.");
        const minBn = await DG.getMinNextBid(id);
        const min = ethers.BigNumber.from(minBn).toString();
        const v = prompt(`Nhập giá VND (>= ${fmtVND(min)})`, fmtVND(min));
        if (v == null) return;
        const amount = parseVNDToBN(v);
        if (amount.lt(minBn)) return alert("Giá nhập thấp hơn mức tối thiểu.");
        await ensureFeeAllowance();
        const tx = await DG.placeBid(id, amount);
        await tx.wait();
        alert("Đã bỏ giá thành công.");
        await renderAuctions();
        await refreshBalances();
      } catch (e) {
        console.error(e);
        alert(e?.error?.message || e?.message || "Bỏ giá thất bại.");
      }
    });

    btnWL?.addEventListener("click", async () => {
      try {
        if (!DG) return alert("Hãy kết nối ví trước.");
        const addLine = prompt("Nhập danh sách ví thêm (mỗi ví cách nhau bởi dấu phẩy). Bỏ trống nếu không có.");
        const rmLine  = prompt("Nhập danh sách ví xoá (mỗi ví cách nhau bởi dấu phẩy). Bỏ trống nếu không có.");
        const addrs = (addLine||"").split(",").map(s=>s.trim()).filter(isAddr);
        const removes = (rmLine||"").split(",").map(s=>s.trim()).filter(isAddr);
        if (!addrs.length && !removes.length) return;
        await ensureFeeAllowance();
        const tx = await DG.updateWhitelist(id, addrs, removes);
        await tx.wait();
        alert("Đã cập nhật whitelist.");
        await renderAuctions();
      } catch (e) {
        console.error(e);
        alert(e?.error?.message || e?.message || "Cập nhật whitelist thất bại.");
      }
    });

    btnFinal?.addEventListener("click", async () => {
      try {
        if (!DG) return alert("Hãy kết nối ví trước.");
        const tx = await DG.finalize(id);
        await tx.wait();
        alert("Đã chốt phiên.");
        await renderAuctions();
      } catch (e) {
        console.error(e);
        alert(e?.error?.message || e?.message || "Chốt phiên thất bại.");
      }
    });

    return node;
  }

  async function renderAuctions() {
    els.list.textContent = "Đang tải…";
    try {
      const countBN = await fetchAuctionCount();
      const total = ethers.BigNumber.from(countBN || 0).toNumber();
      els.list.innerHTML = "";
      if (total === 0) { els.list.textContent = "Chưa có cuộc đấu giá."; return; }

      // Lấy bộ lọc
      const kw = String(els.search?.value || "").trim().toLowerCase();
      const stFilter = String(els.filter?.value || "all");

      // hiển thị từ mới → cũ
      let rendered = 0;
      for (let id = total; id >= 1; id--) {
        try {
          const { a, st } = await fetchAuction(id);

          // filter theo trạng thái
          if (stFilter !== "all") {
            const label = statusLabel(st);
            if ((stFilter === "before" && label !== "Chưa diễn ra") ||
                (stFilter === "live"   && label !== "Đang diễn ra") ||
                (stFilter === "ended"  && label !== "Đã kết thúc") ||
                (stFilter === "final"  && label !== "Đã chốt")) continue;
          }

          // filter theo từ khoá
          if (kw) {
            const org = (a.organizer || "").toLowerCase();
            const sum = (a.summary || "").toLowerCase();
            if (!(org.includes(kw) || sum.includes(kw))) continue;
          }

          const node = await buildCard(id);
          els.list.appendChild(node);
          rendered++;
        } catch (err) {
          console.warn(`Bỏ qua phiên #${id}:`, err?.message || err);
        }
      }
      if (rendered === 0) els.list.textContent = "Không có phiên phù hợp.";
    } catch (e) {
      console.error(e);
      els.list.textContent = "Không tải được danh sách.";
    }
  }

  /* -------------------- Đăng ký & Tạo phiên -------------------- */
  async function onRegister() {
    try {
      if (!DG) return alert("Hãy kết nối ví trước.");
      await ensureFeeAllowance();
      const tx = await DG.register();
      await tx.wait();
      alert("Đăng ký thành công.");
      await updateHeaderButtons();
      await refreshBalances();
    } catch (e) {
      console.error(e);
      alert(e?.error?.message || e?.message || "Đăng ký thất bại.");
    }
  }

  function openCreateDialog() {
    if (!els.dlgCreate) return alert("Thiếu dialog tạo phiên.");
    els.formCreate.reset();
    els.dlgCreate.showModal?.();
  }

  async function submitCreate(e) {
    e?.preventDefault?.();
    try {
      if (!DG) return alert("Hãy kết nối ví trước.");

      const summary = String(els.fSummary.value || "").trim();
      const thongBaoUrl = String(els.fThongBao.value || "").trim();
      const quiCheUrl   = String(els.fQuiChe.value || "").trim();
      const cutoff = parseVNDateTime(String(els.fCutoff.value||"").trim());
      const start  = parseVNDateTime(String(els.fStart.value ||"").trim());
      const end    = parseVNDateTime(String(els.fEnd.value   ||"").trim());
      const startPrice = parseVNDToBN(els.fStartPrice.value);
      const step       = parseVNDToBN(els.fStep.value);

      if (!summary || !thongBaoUrl || !quiCheUrl) return alert("Thiếu mô tả / link tài liệu.");
      if (!cutoff || !start || !end) return alert("Sai định dạng thời gian (dd/mm/yyyy HH:MM).");
      if (Number(cutoff) <= Math.floor(Date.now()/1000)) return alert("Cutoff phải lớn hơn thời điểm hiện tại.");
      if (!(cutoff <= start && start < end)) return alert("Lịch không hợp lệ: cutoff ≤ start < end.");
      if (startPrice.lte(0) || step.lte(0)) return alert("Giá khởi điểm & bước giá phải > 0.");

      await ensureFeeAllowance();

      const a = {
        summary,
        thongBaoUrl,
        quiCheUrl,
        whitelistCutoff: cutoff,
        auctionStart: start,
        auctionEnd: end,
        startPriceVND: startPrice,
        stepVND: step,
      };
      const tx = await DG.createAuction(a);
      await tx.wait();
      alert("Đã tạo phiên đấu giá.");
      els.dlgCreate.close?.();
      await renderAuctions();
    } catch (e) {
      console.error(e);
      alert(e?.error?.message || e?.message || "Tạo phiên thất bại.");
    }
  }

  /* -------------------- Tìm kiếm -------------------- */
  function onSearch() { renderAuctions(); }
  function onClear() { if (els.search) els.search.value = ""; if (els.filter) els.filter.value = "all"; renderAuctions(); }

  /* -------------------- Gán sự kiện -------------------- */
  function bindEvents() {
    els.connect?.addEventListener("click", connectWallet);
    els.disconnect?.addEventListener("click", disconnectWallet);
    els.btnRegister?.addEventListener("click", onRegister);
    els.btnOpenCreate?.addEventListener("click", openCreateDialog);
    els.formCreate?.addEventListener("submit", submitCreate);

    els.btnSearch?.addEventListener("click", onSearch);
    els.btnClear?.addEventListener("click", onClear);
    els.search?.addEventListener("keydown", (e) => { if (e.key === "Enter") onSearch(); });
    els.filter?.addEventListener("change", onSearch);
  }

  /* -------------------- Khởi chạy -------------------- */
  async function init() {
    bindEvents();
    await renderAuctions(); // tải được cả khi chưa kết nối ví
  }

  document.addEventListener("DOMContentLoaded", init);
})();
</script>
