(function () {
  'use strict';

  /* -------------------- Cấu hình mạng / địa chỉ -------------------- */
  const RPC_URL     = "https://rpc.viction.xyz";
  const CHAIN_IDHEX = "0x58"; // 88
  const EXPLORER    = "https://vicscan.xyz";

  const CONTRACT_ADDR = "0x44DeC3CBdF3448F05f082050aBC9697d8224f511";
  const VIN_ADDR      = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";

  /* -------------------- ABI cần thiết (nhúng trực tiếp) -------------------- */
  const DAUGIA_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"BidTooLow","type":"error"},{"inputs":[],"name":"FeeNotPaid","type":"error"},{"inputs":[],"name":"FinalizedAlready","type":"error"},{"inputs":[],"name":"ImmutableDocs","type":"error"},{"inputs":[],"name":"InvalidSchedule","type":"error"},{"inputs":[],"name":"NotLive","type":"error"},{"inputs":[],"name":"NotOrganizer","type":"error"},{"inputs":[],"name":"NotRegistered","type":"error"},{"inputs":[],"name":"NotWhitelisted","type":"error"},{"inputs":[],"name":"WhitelistClosed","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"organizer","type":"address"},{"indexed":false,"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},{"indexed":false,"internalType":"uint40","name":"start","type":"uint40"},{"indexed":false,"internalType":"uint40","name":"end","type":"uint40"},{"indexed":false,"internalType":"uint128","name":"startPriceVND","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"stepVND","type":"uint128"},{"indexed":false,"internalType":"string","name":"thongBaoUrl","type":"string"},{"indexed":false,"internalType":"string","name":"quiCheUrl","type":"string"}],"name":"AuctionCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"bidder","type":"address"},{"indexed":false,"internalType":"uint128","name":"amountVND","type":"uint128"},{"indexed":false,"internalType":"uint40","name":"ts","type":"uint40"}],"name":"BidPlaced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint128","name":"priceVND","type":"uint128"},{"indexed":false,"internalType":"uint40","name":"ts","type":"uint40"},{"indexed":false,"internalType":"bool","name":"success","type":"bool"}],"name":"Finalized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"Registered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"address[]","name":"added","type":"address[]"},{"indexed":false,"internalType":"address[]","name":"removed","type":"address[]"}],"name":"WhitelistUpdated","type":"event"},{"inputs":[],"name":"FEE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"VIN","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"auctionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"string","name":"summary","type":"string"},{"internalType":"string","name":"thongBaoUrl","type":"string"},{"internalType":"string","name":"quiCheUrl","type":"string"},{"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},{"internalType":"uint40","name":"auctionStart","type":"uint40"},{"internalType":"uint40","name":"auctionEnd","type":"uint40"},{"internalType":"uint128","name":"startPriceVND","type":"uint128"},{"internalType":"uint128","name":"stepVND","type":"uint128"}],"internalType":"struct DauGia.AuctionInit","name":"a","type":"tuple"}],"name":"createAuction","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"feeReceiver","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"finalize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getAuction","outputs":[{"components":[{"internalType":"address","name":"organizer","type":"address"},{"internalType":"string","name":"summary","type":"string"},{"internalType":"string","name":"thongBaoUrl","type":"string"},{"internalType":"string","name":"quiCheUrl","type":"string"},{"internalType":"uint40","name":"whitelistCutoff","type":"uint40"},{"internalType":"uint40","name":"auctionStart","type":"uint40"},{"internalType":"uint40","name":"auctionEnd","type":"uint40"},{"internalType":"uint128","name":"startPriceVND","type":"uint128"},{"internalType":"uint128","name":"stepVND","type":"uint128"},{"internalType":"uint128","name":"currentPriceVND","type":"uint128"},{"internalType":"address","name":"currentLeader","type":"address"},{"internalType":"bool","name":"finalized","type":"bool"},{"internalType":"bool","name":"success","type":"bool"}],"internalType":"struct DauGia.Auction","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getMinNextBid","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getStatus","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getWhitelist","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"user","type":"address"}],"name":"isWhitelisted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint128","name":"amountVND","type":"uint128"}],"name":"placeBid","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address[]","name":"addrs","type":"address[]"},{"internalType":"address[]","name":"removes","type":"address[]"}],"name":"updateWhitelist","outputs":[],"stateMutability":"nonpayable","type":"function"}]; // Chèn ABI hợp đồng DauGia tại đây
  const VIN_ABI = [];    // Chèn ABI hợp đồng VIN tại đây

  /* -------------------- Trạng thái runtime -------------------- */
  let ethersRef = window.ethers;
  let readProvider = new ethersRef.providers.JsonRpcProvider(RPC_URL);
  let web3Provider = null, signer = null, userAddress = null;
  let vin = new ethersRef.Contract(VIN_ADDR, VIN_ABI, readProvider);
  let dauGia = new ethersRef.Contract(CONTRACT_ADDR, DAUGIA_ABI, readProvider);
  let FEE_CACHE = ethersRef.BigNumber.from("1000000000000000"); // fallback 0.001 VIN

  let auctionCache = [];
  const timers = new Map();

  /* -------------------- DOM -------------------- */
  const elList        = document.getElementById('auctions-list');
  const tplCard       = document.getElementById('tpl-auction');

  const btnConnect    = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const walletInfo    = document.getElementById('wallet-info');
  const addrShort     = document.getElementById('addr-short');
  const vinBalEl      = document.getElementById('vin-balance');
  const vicBalEl      = document.getElementById('vic-balance');

  const btnRegister   = document.getElementById('btn-register');
  const btnOpenCreate = document.getElementById('btn-open-create');

  const createDialog  = document.getElementById('createDialog');
  const createForm    = document.getElementById('createForm');

  const searchInput   = document.getElementById('searchInput');
  const statusFilter  = document.getElementById('statusFilter');
  const searchBtn     = document.getElementById('searchBtn');
  const clearBtn      = document.getElementById('clearSearchBtn');

  /* -------------------- Tiện ích định dạng -------------------- */
  // Hàm định dạng cho VND (đơn vị đồng) với dấu chấm phân cách hàng nghìn
  const fmtVND = (n) => {
    const s = (BigInt(n)).toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " đồng";
  };

  // Giờ Việt Nam (GMT+7)
  const fmtTimeVN = (sec) => {
    const d = new Date((Number(sec) + 7 * 60 * 60) * 1000); // Chuyển sang giờ Việt Nam
    return `${d2(d.getDate())}/${d2(d.getMonth()+1)}/${d.getFullYear()} ${d2(d.getHours())}:${d2(d.getMinutes())}`;
  };

  // Định dạng lại thời gian 24h và dd/mm/yyyy
  const fmtTs = (sec) => fmtTimeVN(sec);

  // Sửa múi giờ của đồng hồ đếm ngược
  const fmtCountdown = (msLeft) => {
    if (msLeft <= 0) return "00:00:00";
    const sec = Math.floor(msLeft / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${d2(h)}:${d2(m)}:${d2(s)}`;
  };

  // Định dạng giờ, ngày
  const d2 = (x) => (x < 10 ? '0' + x : '' + x);

  /* -------------------- Gas helpers -------------------- */
  async function gasOverrides() {
    const gp = await (web3Provider || readProvider).getGasPrice();
    return { gasPrice: gp.mul(2) };
  }

  async function withGasLimit(txReqPromise) {
    const txReq = await txReqPromise;
    try {
      const est = await (web3Provider || readProvider).estimateGas(txReq);
      txReq.gasLimit = est.mul(2);
    } catch {}
    try {
      const gp = await (web3Provider || readProvider).getGasPrice();
      txReq.gasPrice = gp.mul(2);
    } catch {}
    return signer.sendTransaction(txReq);
  }

  /* -------------------- Fee/Allowance VIN -------------------- */
  async function refreshFee() {
    try {
      const fee = await dauGia.FEE();
      if (fee && fee.gt(0)) FEE_CACHE = fee;
    } catch {}
  }

  async function payFeeOnce() {
    const allowance = await vin.allowance(userAddress, CONTRACT_ADDR);
    if (allowance.lt(FEE_CACHE)) {
      const tx = await vin.populateTransaction.approve(CONTRACT_ADDR, FEE_CACHE);
      const sent = await withGasLimit(Promise.resolve(tx));
      await sent.wait();
    }
  }

  /* -------------------- Kết nối ví -------------------- */
  async function ensureChain() {
    const eth = window.ethereum;
    if (!eth) throw new Error("Vui lòng cài MetaMask.");
    const chainId = await eth.request({ method: 'eth_chainId' });
    if (chainId !== CHAIN_IDHEX) {
      try {
        await eth.request({ method:'wallet_switchEthereumChain', params:[{ chainId: CHAIN_IDHEX }] });
      } catch (e) {
        if (e?.code === 4902) {
          await eth.request({ method:'wallet_addEthereumChain', params:[{
            chainId: CHAIN_IDHEX,
            chainName: "Viction Mainnet",
            nativeCurrency: { name:"VIC", symbol:"VIC", decimals:18 },
            rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER]
          }]});
        } else { throw e; }
      }
    }
  }

  async function connectWallet() {
    try {
      await ensureChain();
      web3Provider = new ethersRef.providers.Web3Provider(window.ethereum, 'any');
      await web3Provider.send('eth_requestAccounts', []);
      signer = web3Provider.getSigner();
      userAddress = (await signer.getAddress()).toLowerCase();
      vin = new ethersRef.Contract(VIN_ADDR, VIN_ABI, signer);
      dauGia = new ethersRef.Contract(CONTRACT_ADDR, DAUGIA_ABI, signer);
      await refreshFee();

      addrShort.textContent = shortAddr(userAddress);
      walletInfo.classList.remove('hidden');
      btnConnect.classList.add('hidden');

      await refreshBalances();
      const reg = await dauGia.isRegistered(userAddress);
      btnRegister.classList.toggle('hidden', !!reg);
      btnOpenCreate.classList.toggle('hidden', !reg);

      refreshAllCardsActionState();
    } catch (e) {
      alert("Kết nối ví thất bại: " + (e?.message || e));
    }
  }

  function disconnectWallet() {
    web3Provider = null; signer = null; userAddress = null;
    vin = new ethersRef.Contract(VIN_ADDR, VIN_ABI, readProvider);
    dauGia = new ethersRef.Contract(CONTRACT_ADDR, DAUGIA_ABI, readProvider);
    walletInfo.classList.add('hidden'); btnConnect.classList.remove('hidden');
    btnRegister.classList.add('hidden'); btnOpenCreate.classList.add('hidden');
    vinBalEl.textContent="0.0000"; vicBalEl.textContent="0.0000";
    refreshAllCardsActionState();
  }

  async function refreshBalances() {
    if (!web3Provider || !userAddress) return;
    try {
      const [vinBal, vicBal] = await Promise.all([
        vin.balanceOf(userAddress),
        web3Provider.getBalance(userAddress),
      ]);
      vinBalEl.textContent = fmtVND(vinBal.toString());
      vicBalEl.textContent = fmtVND(vicBal.toString());
    } catch {}
  }

  /* -------------------- Tải danh sách phiên -------------------- */
  async function loadAuctions() {
    try {
      elList.textContent = "Đang tải…";
      const total = Number((await dauGia.auctionCount()).toString());
      const items = [];
      for (let id = total; id >= 1; id--) {
        const [a, status, minNext] = await Promise.all([
          dauGia.getAuction(id),
          dauGia.getStatus(id),
          dauGia.getMinNextBid(id),
        ]);
        items.push({ id, a, status: Number(status), minNext: minNext.toString() });
      }
      auctionCache = items;
      renderList(items);
    } catch (e) {
      elList.textContent = "Lỗi tải dữ liệu: " + (e?.message || e);
    }
  }

  /* -------------------- Render danh sách -------------------- */
  function stopAllTimers(){ for (const [id,t] of timers) { clearInterval(t); timers.delete(id); } }
  function renderList(items) {
    stopAllTimers(); elList.innerHTML = "";
    if (!items.length) { elList.textContent = "Chưa có cuộc đấu giá."; return; }
    for (const it of items) elList.appendChild(buildCard(it));
  }

  function buildCard(it) {
    const { id, a, status, minNext } = it;
    const clone = document.importNode(tplCard.content, true);
    const root  = clone.querySelector('.card');

    const titleEl   = clone.querySelector('.title');
    const detailBtn = clone.querySelector('.detailBtn');
    const body      = clone.querySelector('.card-body');
    const snippetEl = clone.querySelector('.snippet');
    const thongBaoA = clone.querySelector('.thongbao');
    const quyCheA   = clone.querySelector('.quyche');

    const timeEl    = clone.querySelector('.time');
    const cutoffEl  = clone.querySelector('.cutoff');
    const startEl   = clone.querySelector('.startPrice');
    const stepEl    = clone.querySelector('.step');
    const currentEl = clone.querySelector('.current');
    const leaderEl  = clone.querySelector('.leader');

    const wlDetails = clone.querySelector('.wl');
    const wlPre     = clone.querySelector('.wlList');

    const joinBtn   = clone.querySelector('.joinBtn');
    const backBtn   = clone.querySelector('.backBtn');

    const regBtn    = clone.querySelector('.regBtn');
    const createBtn = clone.querySelector('.createBtn');
    const updWlBtn  = clone.querySelector('.updateWlBtn');
    const bidBtn    = clone.querySelector('.bidBtn');
    const statusEl  = clone.querySelector('.status');

    titleEl.textContent = `#${id} — ${a.summary || '(Không tiêu đề)'}`;
    snippetEl.textContent = a.summary || '';

    thongBaoA.href = a.thongBaoUrl || '#';
    quyCheA.href   = a.quiCheUrl   || '#';

    timeEl.textContent   = `${fmtTs(a.auctionStart)} → ${fmtTs(a.auctionEnd)}`;
    cutoffEl.textContent = fmtTs(a.whitelistCutoff);
    startEl.textContent  = fmtVND(a.startPriceVND.toString());
    stepEl.textContent   = fmtVND(a.stepVND.toString());

    const showCurrent = () => {
      const cp = a.currentPriceVND.toString();
      const mm = it.minNext;
      currentEl.textContent = (cp === "0") ? "—" : `${fmtVND(cp)} (tối thiểu kế tiếp: ${fmtVND(mm)})`;
      leaderEl.textContent  = a.currentLeader && a.currentLeader !== ethersRef.constants.AddressZero
        ? shortAddr(a.currentLeader) : '—';
    };
    showCurrent();

    const refreshStatusLine = () => {
      const now = Date.now(), nowSec = Math.floor(now/1000);
      let s = Number(status);
      if (a.finalized) s = 3;
      else if (nowSec < Number(a.auctionStart)) s = 0;
      else if (nowSec >= Number(a.auctionEnd)) s = 2;
      else s = 1;

      if (s===0) statusEl.textContent = `Chưa diễn ra — Bắt đầu sau ${fmtCountdown(Number(a.auctionStart)*1000 - now)}`;
      else if (s===1) statusEl.textContent = `Đang diễn ra — Còn ${fmtCountdown(Number(a.auctionEnd)*1000 - now)}`;
      else if (s===2) statusEl.textContent = `Đã kết thúc — Chờ chốt`;
      else statusEl.textContent = a.success
          ? `Đã chốt — Winner: ${shortAddr(a.currentLeader)} với giá ${fmtVND(a.currentPriceVND.toString())}`
          : `Đã chốt — Không có người thắng`;

      updateActionVisibility(root, id, a, s);
    };

    const startTimer = () => {
      if (timers.has(id)) return;
      const t = setInterval(refreshCardData, 1000);
      timers.set(id, t);
    };
    const stopTimer = () => {
      const t = timers.get(id); if (t) { clearInterval(t); timers.delete(id); }
    };

    let lastRefreshAt = 0;
    async function refreshCardData() {
      try {
        refreshStatusLine();
        const now = Date.now(); if (now - lastRefreshAt < 7000) return;
        lastRefreshAt = now;
        const [a2, st2, min2] = await Promise.all([
          dauGia.getAuction(id),
          dauGia.getStatus(id),
          dauGia.getMinNextBid(id),
        ]);
        Object.assign(a, a2); it.minNext = min2.toString();
        showCurrent();
      } catch {}
    }

    // Lazy load danh sách ví
    wlDetails.addEventListener('toggle', async () => {
      if (!wlDetails.open) return;
      wlPre.textContent = "Đang tải…";
      try {
        const addrs = await dauGia.getWhitelist(id);
        // Ghép link UNC từ 2 nguồn: URL JSON (công khai) & local map (cục bộ)
        const mapLocal = JSON.parse(localStorage.getItem(`uncMap:${id}`) || "{}");
        let mapRemote = null;
        const uncUrl = localStorage.getItem(`uncMapUrl:${id}`);
        if (uncUrl) {
          try { mapRemote = await (await fetch(uncUrl, { cache:'no-store' })).json(); } catch {}
        }
        const getLink = (addr) => {
          const k = addr.toLowerCase();
          return (mapRemote && mapRemote[k]) ? mapRemote[k] : (mapLocal[k] || null);
        };

        if (!addrs.length) {
          wlPre.textContent = "(Chưa có ví trong whitelist)";
        } else {
          const parts = [];
          for (const a1 of addrs) {
            const link = getLink(a1);
            const line = a1.toLowerCase() + (link ? `\n→ <a href="${link}" target="_blank" rel="noopener">Open UNC</a>` : "");
            parts.push(line);
          }
          wlPre.innerHTML = parts.join("\n\n");
        }
      } catch (e) {
        wlPre.textContent = "Lỗi tải whitelist: " + (e?.message || e);
      }
    });

    function openDetail() {
      body.classList.remove('hidden');
      for (const el of document.querySelectorAll('#auctions-list > .card')) {
        if (el !== root) el.classList.add('hidden');
      }
      startTimer(); refreshCardData();
    }
    function closeDetail() {
      body.classList.add('hidden');
      for (const el of document.querySelectorAll('#auctions-list > .card')) {
        el.classList.remove('hidden');
      }
      stopTimer();
    }
    detailBtn.addEventListener('click', openDetail);
    joinBtn.addEventListener('click', openDetail);
    backBtn.addEventListener('click', closeDetail);

    async function updateActionVisibility(container, id, a, sNow) {
      const isConn = !!userAddress;
      const reg = isConn ? await dauGia.isRegistered(userAddress) : false;
      const isOrg = isConn ? (a.organizer && a.organizer.toLowerCase() === userAddress) : false;
      const nowSec = Math.floor(Date.now()/1000);

      regBtn.classList.toggle('hidden', !isConn || reg);
      createBtn.classList.toggle('hidden', !isConn || !reg);

      const canUpdWl = isConn && isOrg && (nowSec < Number(a.whitelistCutoff)) && !a.finalized;
      updWlBtn.classList.toggle('hidden', !canUpdWl);

      let canBid = false;
      if (isConn && sNow===1 && !a.finalized) {
        try { canBid = await dauGia.isWhitelisted(id, userAddress); } catch {}
      }
      bidBtn.classList.toggle('hidden', !canBid);
    }

    // Đăng ký
    regBtn.addEventListener('click', async () => {
      if (!signer) return alert("Vui lòng kết nối ví.");
      try {
        await refreshFee();
        await payFeeOnce();
        const tx = await dauGia.populateTransaction.register();
        const sent = await withGasLimit(Promise.resolve(tx));
        await sent.wait();
        alert("Đăng ký thành công.");
        btnRegister.classList.add('hidden'); btnOpenCreate.classList.remove('hidden');
        refreshAllCardsActionState();
      } catch (e) { alert("Đăng ký thất bại: " + (e?.message || e)); }
    });

    // Tạo cuộc đấu giá (mở dialog chung)
    createBtn.addEventListener('click', () => createDialog.showModal());

    // Cập nhật whitelist TỪNG NGƯỜI + UNC
    updWlBtn.addEventListener('click', async () => {
      if (!signer) return alert("Vui lòng kết nối ví.");
      // Menu đơn giản
      const mode = prompt(
        "Chọn thao tác:\n1) Thêm/Gắn UNC cho 1 ví\n2) Gỡ 1 ví khỏi whitelist\n3) Dán URL JSON mapping công khai (tuỳ chọn)\n(ấn Cancel để thoát)"
      );
      if (!mode) return;

      const mapKey = `uncMap:${id}`;
      const urlKey = `uncMapUrl:${id}`;
      const map = JSON.parse(localStorage.getItem(mapKey) || "{}");

      try {
        if (mode.trim()==="1") {
          const addr = prompt("Nhập ĐỊA CHỈ ví (0x...) — hàng trên:");
          if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) return alert("Địa chỉ không hợp lệ.");
          const link = prompt("Nhập LINK UNC (tùy chọn) — hàng dưới:\nVí dụ: https://ipfs.io/ipfs/bafy...");

          await refreshFee(); await payFeeOnce();
          const tx = await dauGia.populateTransaction.updateWhitelist(id, [addr.trim()], []);
          const sent = await withGasLimit(Promise.resolve(tx)); await sent.wait();

          if (link && link.trim()) map[addr.trim().toLowerCase()] = link.trim();
          localStorage.setItem(mapKey, JSON.stringify(map));
          alert("Đã thêm ví vào whitelist" + (link ? " và gắn UNC." : "."));

          if (document.body.contains(wlPre) && wlDetails.open) wlDetails.dispatchEvent(new Event('toggle'));
        }
        else if (mode.trim()==="2") {
          const addr = prompt("Nhập ĐỊA CHỈ ví cần gỡ:");
          if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) return alert("Địa chỉ không hợp lệ.");

          await refreshFee(); await payFeeOnce();
          const tx = await dauGia.populateTransaction.updateWhitelist(id, [], [addr.trim()]);
          const sent = await withGasLimit(Promise.resolve(tx)); await sent.wait();

          delete map[addr.trim().toLowerCase()];
          localStorage.setItem(mapKey, JSON.stringify(map));
          alert("Đã gỡ ví khỏi whitelist.");

          if (document.body.contains(wlPre) && wlDetails.open) wlDetails.dispatchEvent(new Event('toggle'));
        }
        else if (mode.trim()==="3") {
          const url = prompt("Dán URL JSON mapping UNC công khai ({\"0xaddr\": \"https://ipfs.io/ipfs/...\"}):");
          if (!url) return;
          localStorage.setItem(urlKey, url.trim());
          alert("Đã lưu URL JSON mapping UNC cho phiên #" + id);
          if (document.body.contains(wlPre) && wlDetails.open) wlDetails.dispatchEvent(new Event('toggle'));
        }
      } catch (e) {
        alert("Cập nhật whitelist thất bại: " + (e?.message || e));
      }
    });

    // Bỏ giá
    bidBtn.addEventListener('click', async () => {
      if (!signer) return alert("Vui lòng kết nối ví.");
      try {
        const minNextBid = (await dauGia.getMinNextBid(id)).toString();
        const s = prompt(`Nhập mức giá (VND, số nguyên). Tối thiểu: ${fmtVND(minNextBid)}`, minNextBid);
        if (!s) return;
        const clean = s.replace(/[^\d]/g, ''); if (!clean) return alert("Giá không hợp lệ.");
        const amount = ethersRef.BigNumber.from(clean);
        const cmpMin = ethersRef.BigNumber.from(minNextBid);
        if (amount.lt(cmpMin)) return alert("Giá thấp hơn mức tối thiểu.");

        await refreshFee(); await payFeeOnce();
        const tx = await dauGia.populateTransaction.placeBid(id, amount);
        const sent = await withGasLimit(Promise.resolve(tx)); await sent.wait();
        alert("Bỏ giá thành công.");

        const a2 = await dauGia.getAuction(id);
        Object.assign(a, a2); showCurrent();
      } catch (e) { alert("Bỏ giá thất bại: " + (e?.message || e)); }
    });

    // Khởi tạo lần đầu
    refreshStatusLine();
    return root;
  }

  function refreshAllCardsActionState() {
    for (const card of document.querySelectorAll('#auctions-list > .card')) {
      const detail = card.querySelector('.card-body');
      if (!detail || detail.classList.contains('hidden')) continue;
      const btn = card.querySelector('.detailBtn'); if (btn) { btn.click(); btn.click(); }
    }
  }

  /* -------------------- Tìm kiếm / Lọc -------------------- */
  function applySearchFilter() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const st = statusFilter.value; // '', '0','1','2','3'
    let arr = auctionCache.slice();
    if (q) {
      arr = arr.filter(it => {
        const org = (it.a.organizer || '').toLowerCase();
        const sum = (it.a.summary || '').toLowerCase();
        return sum.includes(q) || org.includes(q);
      });
    }
    if (st !== '') arr = arr.filter(it => String(it.status) === st);
    renderList(arr);
  }

  /* -------------------- Dialog tạo phiên -------------------- */
  if (createForm) {
    createForm.addEventListener('submit', e => e.preventDefault());
    btnOpenCreate?.addEventListener('click', () => {
      if (!userAddress) return alert("Vui lòng kết nối ví & đăng ký trước.");
      createDialog.showModal();
    });

    createDialog.querySelector('button[value="confirm"]').addEventListener('click', async () => {
      if (!signer) { alert("Vui lòng kết nối ví."); return; }
      const summary   = document.getElementById('fSummary').value.trim();
      const thongBao  = document.getElementById('fThongBao').value.trim();
      const quiChe    = document.getElementById('fQuiChe').value.trim();
      const cutoffStr = document.getElementById('fCutoff').value.trim();
      const startStr  = document.getElementById('fStart').value.trim();
      const endStr    = document.getElementById('fEnd').value.trim();
      const startVND  = document.getElementById('fStartPrice').value.trim().replace(/[^\d]/g, '');
      const stepVND   = document.getElementById('fStep').value.trim().replace(/[^\d]/g, '');

      try {
        if (!summary) throw new Error("Thiếu mô tả ngắn gọn.");
        if (summary.length > 280) throw new Error("Mô tả quá 280 ký tự.");
        if (!thongBao || !quiChe) throw new Error("Thiếu link Thông báo/Quy chế.");
        if (!isIpfsHttp(thongBao) || !isIpfsHttp(quiChe)) throw new Error("Link tài liệu phải có dạng https://ipfs.io/ipfs/<CID>.");

        const cutoff = parseLocalDateTime(cutoffStr);
        const start  = parseLocalDateTime(startStr);
        const end    = parseLocalDateTime(endStr);
        if (!(cutoff <= start && start < end)) throw new Error("Lịch không hợp lệ (cutoff ≤ start < end).");
        if (!startVND || !stepVND) throw new Error("Thiếu giá khởi điểm / bước giá.");

        await refreshFee(); await payFeeOnce();
        const tx = await dauGia.populateTransaction.createAuction({
          summary,
          thongBaoUrl: thongBao,
          quiCheUrl: quiChe,
          whitelistCutoff: cutoff,
          auctionStart: start,
          auctionEnd: end,
          startPriceVND: ethersRef.BigNumber.from(startVND),
          stepVND: ethersRef.BigNumber.from(stepVND),
        });
        const sent = await withGasLimit(Promise.resolve(tx));
        await sent.wait();
        alert("Tạo phiên thành công.");
        createDialog.close();
        await loadAuctions();
      } catch (e) { alert("Tạo phiên thất bại: " + (e?.message || e)); }
    });

    createDialog.querySelector('button[value="cancel"]').addEventListener('click', () => createDialog.close());
  }

  /* -------------------- Sự kiện UI chung -------------------- */
  btnConnect?.addEventListener('click', connectWallet);
  btnDisconnect?.addEventListener('click', disconnectWallet);
  btnRegister?.addEventListener('click', () => {
    alert("Hãy mở chi tiết một phiên để đăng ký hoặc tạo phiên mới (sẽ kiểm tra trạng thái).");
  });

  searchBtn?.addEventListener('click', applySearchFilter);
  clearBtn?.addEventListener('click', () => { searchInput.value=""; statusFilter.value=""; applySearchFilter(); });

  if (window.ethereum) {
    window.ethereum.on?.('accountsChanged', () => {
      if (!window.ethereum.selectedAddress) disconnectWallet(); else connectWallet();
    });
    window.ethereum.on?.('chainChanged', () => window.location.reload());
  }

  /* -------------------- Khởi động -------------------- */
  (async function start() {
    try {
      await loadAuctions();
      setInterval(async () => {
        try {
          for (const it of auctionCache) it.status = Number(await dauGia.getStatus(it.id));
          applySearchFilter();
        } catch {}
      }, 30000);
    } catch (e) { elList.textContent = "Lỗi khởi tạo: " + (e?.message || e); }
  })();

})();
