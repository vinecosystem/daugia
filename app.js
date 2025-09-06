/* ==========================================================================
   daugia.vin — app.js (ethers v5)
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ 0x44DeC3CBdF3448F05f082050aBC9697d8224f511
   Token:    VIN    @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4

   Yêu cầu UI:
   - Giờ 24h; Ngày dd/mm/yyyy; GMT+7 (Asia/Bangkok)
   - Đơn vị: VND (đồng, số nguyên); hiển thị phân tách dấu chấm
   - Không cần ví vẫn xem/tìm kiếm/lọc danh sách
   - 4 hành động có phí 0.001 VIN: register / create / updateWhitelist / placeBid
   - Finalize miễn phí (ai cũng bấm); (UI sẽ tự hiện nút khi đủ điều kiện)
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
    blockExplorerUrls: ["https://vicscan.xyz"]
  };

  const ADDR = {
    DAUGIA: "0x44DeC3CBdF3448F05f082050aBC9697d8224f511",
    VIN:    "0x941F63807401efCE8afe3C9d88d368bAA287Fac4"
  };

  // Phí VIN: 0.001 VIN = 1e15 wei (VIN)
  const FEE_WEI = "1000000000000000";

  /* -------------------- ABI (tối thiểu, đã chọn lọc) -------------------- */
  // ABI hợp đồng DauGia (rút gọn cho các hàm cần dùng)
  const DAUGIA_ABI = [
    // read
    {"inputs":[],"name":"auctionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getAuction","outputs":[{"components":[
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
    ],"internalType":"struct DauGia.Auction","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getWhitelist","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getMinNextBid","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getStatus","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    // write
    {"inputs":[],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"components":[
      {"internalType":"string","name":"summary","type":"string"},
      {"internalType":"string","name":"thongBaoUrl","type":"string"},
      {"internalType":"string","name":"quiCheUrl","type":"string"},
      {"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},
      {"internalType":"uint40","name":"auctionStart","type":"uint40"},
      {"internalType":"uint40","name":"auctionEnd","type":"uint40"},
      {"internalType":"uint128","name":"startPriceVND","type":"uint128"},
      {"internalType":"uint128","name":"stepVND","type":"uint128"}
    ],"internalType":"struct DauGia.AuctionInit","name":"a","type":"tuple"}],"name":"createAuction","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address[]","name":"addrs","type":"address[]"},{"internalType":"address[]","name":"removes","type":"address[]"}],"name":"updateWhitelist","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint128","name":"amountVND","type":"uint128"}],"name":"placeBid","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"finalize","outputs":[],"stateMutability":"nonpayable","type":"function"}
  ];

  // ABI token VIN (ERC20 cơ bản dùng balance/allowance/approve)
  const ERC20_ABI = [
    {"constant":true,"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function","stateMutability":"view"},
    {"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function","stateMutability":"view"},
    {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function","stateMutability":"nonpayable"},
    {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function","stateMutability":"view"}
  ];

  /* -------------------- Biến DOM -------------------- */
  const el = {
    vinUsdChip: document.getElementById('vinPriceUsd'),
    btnConnect: document.getElementById('btn-connect'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    walletInfo: document.getElementById('wallet-info'),
    addrShort: document.getElementById('addr-short'),
    balVIN: document.getElementById('vin-balance'),
    balVIC: document.getElementById('vic-balance'),
    btnRegister: document.getElementById('btn-register'),
    btnOpenCreate: document.getElementById('btn-open-create'),
    list: document.getElementById('auctions-list'),
    searchInput: document.getElementById('searchInput'),
    statusFilter: document.getElementById('statusFilter'),
    searchBtn: document.getElementById('searchBtn'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    tplAuction: document.getElementById('tpl-auction'),
    // Dialog tạo phiên
    createDlg: document.getElementById('createDialog'),
    createForm: document.getElementById('createForm'),
    fSummary: document.getElementById('fSummary'),
    fThongBao: document.getElementById('fThongBao'),
    fQuiChe: document.getElementById('fQuiChe'),
    fCutoff: document.getElementById('fCutoff'),
    fStart: document.getElementById('fStart'),
    fEnd: document.getElementById('fEnd'),
    fStartPrice: document.getElementById('fStartPrice'),
    fStep: document.getElementById('fStep'),
  };

  /* -------------------- Trạng thái runtime -------------------- */
  let providerRead = new ethers.providers.JsonRpcProvider(RPC_URL);
  let web3Provider = null;  // khi kết nối ví
  let signer = null;
  let account = null;

  const dauGiaRead = new ethers.Contract(ADDR.DAUGIA, DAUGIA_ABI, providerRead);
  const vinRead = new ethers.Contract(ADDR.VIN, ERC20_ABI, providerRead);

  /* -------------------- Tiện ích định dạng -------------------- */
  const tzOffsetMinutes = 7 * 60; // GMT+7
  const fmtAddr = (a) => a ? (a.slice(0,6) + "…" + a.slice(-4)) : "—";
  const fmtVND = (n) => {
    try {
      const s = String(n|0);
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " đồng";
    } catch { return "—"; }
  };
  const toEpoch = (ddmmyyyyHHmm) => {
    // "dd/mm/yyyy hh:mm" -> epoch giây theo GMT+7
    const m = ddmmyyyyHHmm.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) throw new Error("Sai định dạng thời gian (dd/mm/yyyy hh:mm)");
    const [_, dd, mm, yyyy, HH, II] = m;
    const dt = new Date(Date.UTC(+yyyy, +mm-1, +dd, +HH, +II, 0));
    // trừ offset để ra epoch "theo GMT+7" như người dùng nhập
    return Math.floor(dt.getTime()/1000) - tzOffsetMinutes*60;
  };
  const fmtEpoch = (sec) => {
    if (!sec) return "—";
    const t = (sec + tzOffsetMinutes*60) * 1000;
    const d = new Date(t);
    const dd = String(d.getUTCDate()).padStart(2,'0');
    const mm = String(d.getUTCMonth()+1).padStart(2,'0');
    const yyyy = d.getUTCFullYear();
    const HH = String(d.getUTCHours()).padStart(2,'0');
    const II = String(d.getUTCMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${HH}:${II} GMT+7`;
  };

  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

  /* -------------------- Đồng hồ đếm ngược cho mỗi cuộc đấu giá -------------------- */
  function updateCountdown(auctionEnd, countdownEl) {
    const endTime = new Date(auctionEnd * 1000);
    const interval = setInterval(() => {
      const now = new Date();
      const remaining = endTime - now;
      if (remaining <= 0) {
        clearInterval(interval);
        countdownEl.textContent = "Đã kết thúc";
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        countdownEl.textContent = `${minutes}m ${seconds}s`;
      }
    }, 1000);
  }

  /* -------------------- Kết nối ví -------------------- */
  async function ensureChain() {
    if (!window.ethereum) throw new Error("Vui lòng cài MetaMask");
    const cid = await window.ethereum.request({ method: 'eth_chainId' });
    if (cid !== CHAIN_ID_HEX) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [CHAIN_INFO] });
        } else { throw e; }
      }
    }
  }

  async function connect() {
    await ensureChain();
    web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await web3Provider.send("eth_requestAccounts", []);
    signer = web3Provider.getSigner();
    account = await signer.getAddress();

    // UI
    el.walletInfo.classList.remove('hidden');
    el.btnConnect.classList.add('hidden');
    el.addrShort.textContent = fmtAddr(account);

    // Đăng ký/ Tạo cuộc đấu giá (tùy trạng thái)
    refreshRegisterCreateButtons();

    // Cập nhật số dư
    await refreshBalances();

    // Tải lại danh sách để hiển thị các nút theo vai trò
    await loadAndRenderAuctions();

    // Lắng nghe đổi account/chain
    window.ethereum.on('accountsChanged', () => location.reload());
    window.ethereum.on('chainChanged', () => location.reload());
  }

  function disconnect() {
    // Chỉ là UI (DApp không thể ngắt MetaMask), reset biến runtime
    web3Provider = null; signer = null; account = null;
    el.walletInfo.classList.add('hidden');
    el.btnConnect.classList.remove('hidden');
    el.btnRegister.classList.add('hidden');
    el.btnOpenCreate.classList.add('hidden');
    el.addrShort.textContent = "0x…";
    el.balVIN.textContent = "0.0000";
    el.balVIC.textContent = "0.0000";
    loadAndRenderAuctions(); // render lại ở chế độ khách
  }

  async function refreshBalances() {
    if (!account) return;
    try {
      const vinBal = await vinRead.balanceOf(account);
      const vicBal = await web3Provider.getBalance(account);
      el.balVIN.textContent = ethers.utils.formatUnits(vinBal, 18).slice(0,10);
      el.balVIC.textContent = ethers.utils.formatUnits(vicBal, 18).slice(0,10);
    } catch {}
  }

  async function refreshRegisterCreateButtons() {
    if (!account) return;
    try {
      const reg = await dauGiaRead.isRegistered(account);
      if (reg) {
        el.btnRegister.classList.add('hidden');
        el.btnOpenCreate.classList.remove('hidden');
      } else {
        el.btnRegister.classList.remove('hidden');
        el.btnOpenCreate.classList.add('hidden');
      }
    } catch {}
  }

  /* -------------------- Gọi write với gas “mượt” -------------------- */
  async function sendTx(contract, method, args=[]) {
    // Ước lượng gas
    const est = await contract.estimateGas[method](...args).catch(()=>ethers.BigNumber.from("250000"));
    const gasLimit = est.mul(ethers.BigNumber.from(2)); // ×2 cho chắc
    // EIP-1559 (hỗ trợ nếu có)
    let overrides = { gasLimit };
    try {
      const feeData = await web3Provider.getFeeData();
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        overrides.maxFeePerGas = feeData.maxFeePerGas.mul(125).div(100);
        overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(125).div(100);
      }
    } catch {}
    const tx = await contract[method](...args, overrides);
    return await tx.wait();
  }

  /* -------------------- Tải & render danh sách phiên -------------------- */
  let allAuctions = [];  // cache: [{id, auct, wl, status, minNext}, ...]

  async function loadAuctions() {
    const count = (await dauGiaRead.auctionCount()).toNumber();
    const arr = [];
    for (let id = count; id >= 1; id--) {
      const auct = await dauGiaRead.getAuction(id);
      const status = await dauGiaRead.getStatus(id);
      let wl = [];
      try { wl = await dauGiaRead.getWhitelist(id); } catch {}

      let minNext = 0n;
      try { minNext = BigInt(await dauGiaRead.getMinNextBid(id)); } catch {}
      arr.push({ id, auct, wl, status, minNext });
    }
    allAuctions = arr;
  }

  function matchFilter(item, keyword, statusVal) {
    const kw = (keyword||"").toLowerCase().trim();
    const sOk = !statusVal || String(item.status) === String(statusVal);
    if (!kw) return sOk;
    const sum = (item.auct.summary||"").toLowerCase();
    const org = (item.auct.organizer||"").toLowerCase();
    return sOk && (sum.includes(kw) || org.includes(kw));
  }

  function renderAuctions() {
    const kw = el.searchInput.value;
    const st = el.statusFilter.value;

    if (!allAuctions.length) {
      el.list.textContent = "Chưa có cuộc đấu giá.";
      return;
    }
    el.list.innerHTML = "";

    allAuctions.filter(it => matchFilter(it, kw, st))
      .forEach(it => el.list.appendChild(renderCard(it)));
  }

  function renderCard(item) {
    const node = document.importNode(el.tplAuction.content, true);
    const card = node.querySelector('.card');

    const titleEl = node.querySelector('.title');
    const detailBtn = node.querySelector('.detailBtn');
    const body = node.querySelector('.card-body');

    const snippetEl = node.querySelector('.snippet');
    const linkTB = node.querySelector('a.thongbao');
    const linkQC = node.querySelector('a.quyche');

    const timeEl = node.querySelector('.time');
    const cutoffEl = node.querySelector('.cutoff');
    const startPriceEl = node.querySelector('.startPrice');
    const stepEl = node.querySelector('.step');
    const currentEl = node.querySelector('.current');
    const leaderEl = node.querySelector('.leader');
    const wlPre = node.querySelector('.wlList');

    const joinBtn = node.querySelector('.joinBtn');
    const backBtn = node.querySelector('.backBtn');
    const regBtn = node.querySelector('.regBtn');
    const createBtn = node.querySelector('.createBtn');
    const updWlBtn = node.querySelector('.updateWlBtn');
    const bidBtn = node.querySelector('.bidBtn');
    const statusEl = node.querySelector('.status');
    const countdownEl = node.querySelector('.countdown');  // Thêm div cho countdown

    const a = item.auct;

    // Tiêu đề ngắn lấy từ summary (cắt gọn)
    titleEl.textContent = (a.summary || "").slice(0, 80) || `Cuộc đấu giá #${item.id}`;
    snippetEl.textContent = (a.summary || "").trim();

    // Link tài liệu
    linkTB.href = a.thongBaoUrl || "#";
    linkQC.href = a.quiCheUrl || "#";

    // Thời gian & giá
    timeEl.textContent = `${fmtEpoch(a.auctionStart)} → ${fmtEpoch(a.auctionEnd)}`;
    cutoffEl.textContent = fmtEpoch(a.whitelistCutoff);
    startPriceEl.textContent = fmtVND(a.startPriceVND.toString());
    stepEl.textContent = fmtVND(a.stepVND.toString());
    currentEl.textContent = a.currentPriceVND.toString() === "0" ? "—" : fmtVND(a.currentPriceVND.toString());
    leaderEl.textContent = a.currentLeader && a.currentLeader !== ethers.constants.AddressZero ? fmtAddr(a.currentLeader) : "—";

    // Whitelist hiển thị danh sách (rút gọn tự nhiên nhờ <pre>)
    wlPre.textContent = (item.wl && item.wl.length) ? item.wl.join("\n") : "—";

    // Trạng thái
    const statusMap = {
      0: "Chưa diễn ra",
      1: "Đang diễn ra",
      2: "Đã kết thúc (chờ chốt)",
      3: "Đã chốt"
    };
    statusEl.textContent = `Tình trạng: ${statusMap[item.status] || "—"} · Mã phiên #${item.id}`;

    // Đồng hồ đếm ngược
    if (countdownEl) {
      updateCountdown(a.auctionEnd, countdownEl);
    }

    // Mặc định ẩn chi tiết
    body.classList.add('hidden');
    detailBtn.addEventListener('click', () => {
      body.classList.toggle('hidden');
    });

    // Nút mặc định (ai cũng thấy)
    joinBtn.addEventListener('click', () => {
      // cuộn đến card, mở chi tiết
      body.classList.remove('hidden');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    backBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Nút điều kiện theo vai trò/ thời gian
    if (account) {
      // Đăng ký / Tạo phiên (nhân bản header logic cho card-view)
      dauGiaRead.isRegistered(account).then(reg => {
        reg ? createBtn.classList.remove('hidden') : regBtn.classList.remove('hidden');
      });

      // Chủ phiên trước cutoff → hiện Update WL
      if (String(a.organizer).toLowerCase() === String(account).toLowerCase()
          && Number(a.whitelistCutoff.toString()) > Math.floor(Date.now()/1000) ) {
        updWlBtn.classList.remove('hidden');
        updWlBtn.addEventListener('click', ()=> doUpdateWhitelist(item.id));
      }

      // Nếu phiên đang diễn ra & ví trong whitelist → hiện “Bỏ giá”
      const now = Math.floor(Date.now()/1000);
      const live = now >= Number(a.auctionStart) && now < Number(a.auctionEnd);
      const inWL = (item.wl || []).some(x => String(x).toLowerCase() === String(account).toLowerCase());
      if (live && inWL) {
        bidBtn.classList.remove('hidden');
        const minNext = item.minNext ? Number(item.minNext) : 0;
        bidBtn.addEventListener('click', ()=> doPlaceBid(item.id, minNext));
      }

      // Nếu đã hết thời gian nhưng chưa chốt → hiện nút Finalize (tạo nút động)
      if (item.status === 2) {
        const finalizeBtn = document.createElement('button');
        finalizeBtn.className = "btn danger";
        finalizeBtn.textContent = "Chốt phiên";
        finalizeBtn.addEventListener('click', ()=> doFinalize(item.id));
        body.querySelector('.actions-row').appendChild(finalizeBtn);
      }
    }

    // Hành động đăng ký/ tạo phiên trong card (mirror header)
    regBtn.addEventListener('click', doRegister);
    createBtn.addEventListener('click', () => {
      el.createDlg.showModal();
    });

    return node;
  }

  async function loadAndRenderAuctions() {
    el.list.textContent = "Đang tải…";
    try {
      await loadAuctions();
      renderAuctions();
    } catch (e) {
      console.error(e);
      el.list.textContent = "Lỗi tải danh sách.";
    }
  }

  /* -------------------- Gán sự kiện header / search -------------------- */
  el.btnConnect?.addEventListener('click', connect);
  el.btnDisconnect?.addEventListener('click', disconnect);
  el.btnRegister?.addEventListener('click', doRegister);

  el.btnOpenCreate?.addEventListener('click', () => el.createDlg.showModal());

  el.createForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitter = ev.submitter?.value || "";
    if (submitter === "confirm") {
      try {
        await doCreateAuction();
      } catch (e) {
        alert(e?.data?.message || e?.error?.message || e?.message || "Giao dịch thất bại");
      }
    } else {
      el.createDlg.close();
    }
  });

  // Tìm kiếm
  el.searchBtn?.addEventListener('click', renderAuctions);
  el.clearSearchBtn?.addEventListener('click', () => {
    el.searchInput.value = "";
    el.statusFilter.value = "";
    renderAuctions();
  });
  el.searchInput?.addEventListener('keydown', (e)=> {
    if (e.key === "Enter") renderAuctions();
  });
  el.statusFilter?.addEventListener('change', renderAuctions);

  /* -------------------- Khởi động -------------------- */
  (async function init() {
    await loadAndRenderAuctions();
  })();
})();
