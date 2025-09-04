// app.js
(() => {
  // ====== HẰNG SỐ MẠNG & HỢP ĐỒNG ======
  const CONTRACT_ADDR = "0x44DeC3CBdF3448F05f082050aBC9697d8224f511";
  const VIN_ADDR      = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4"; // 18 decimals
  const CHAIN_ID_HEX  = "0x58"; // 88
  const CHAIN_PARAMS  = {
    chainId: CHAIN_ID_HEX,
    chainName: "Viction Mainnet",
    nativeCurrency: { name: "VIC", symbol: "VIC", decimals: 18 },
    rpcUrls: ["https://rpc.viction.xyz"],
    blockExplorerUrls: ["https://vicscan.xyz"]
  };

  // Phí nền tảng 0.001 VIN
  const FEE_VIN = ethers.parseUnits("0.001", 18);

  // ERC20 ABI tối thiểu
  const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];

  // ABI rút gọn theo hợp đồng triển khai
  const DG_ABI = [
    "function VIN() view returns (address)",
    "function FEE() view returns (uint256)",
    "function feeReceiver() view returns (address)",

    "function auctionCount() view returns (uint256)",
    "function getAuction(uint256 id) view returns (tuple(address organizer,string summary,string thongBaoUrl,string quiCheUrl,uint40 whitelistCutoff,uint40 auctionStart,uint40 auctionEnd,uint128 startPriceVND,uint128 stepVND,uint128 currentPriceVND,address currentLeader,bool finalized,bool success))",
    "function getWhitelist(uint256 id) view returns (address[])",
    "function getStatus(uint256 id) view returns (uint8)",
    "function getMinNextBid(uint256 id) view returns (uint128)",

    "function isRegistered(address) view returns (bool)",
    "function isWhitelisted(uint256 id,address user) view returns (bool)",

    "function register()",
    "function createAuction((string summary,string thongBaoUrl,string quiCheUrl,uint40 whitelistCutoff,uint40 auctionStart,uint40 auctionEnd,uint128 startPriceVND,uint128 stepVND) a) returns (uint256 id)",
    "function updateWhitelist(uint256 id,address[] addrs,address[] removes)",
    "function placeBid(uint256 id,uint128 amountVND)",
    "function finalize(uint256 id)"
  ];

  // ====== BIẾN TOÀN CỤC UI/WEB3 ======
  let provider, signer, account, chainId;
  let dg, vin; // contract instances

  // ====== TRỢ GIÚP THỜI GIAN VIỆT NAM (GMT+7) ======
  const tz = "Asia/Bangkok";
  function epochToVN(sec){
    return new Date(sec*1000).toLocaleString("vi-VN", { timeZone: tz, hour12:false });
  }
  // dd/mm/yyyy hh:mm (giờ 24), trả về epoch giây GMT+7
  function parseVN(text){
    // "dd/mm/yyyy hh:mm"
    const m = String(text||"").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if(!m) return null;
    let [_, dd, mm, yyyy, HH, MM] = m.map(Number);
    // Lấy thời điểm theo Asia/Bangkok bằng cách tạo đối tượng Date ở UTC rồi trừ offset -7h
    const d = new Date(Date.UTC(yyyy, mm-1, dd, HH-7, MM, 0)); // giờ VN = UTC+7 => UTC = VN-7
    return Math.floor(d.getTime()/1000);
  }

  // Định dạng số VND có dấu chấm ngăn cách
  const fmtVND = (n) => (n==null? "-" : n.toLocaleString("vi-VN"));

  // ====== TRỢ GIÚP DOM ======
  const $ = (id) => document.getElementById(id);
  const qs = (sel, el=document) => el.querySelector(sel);

  const elConnect = $("connectBtn");
  const elAcc = $("accountInfo");
  const elAddr = $("accountAddr");
  const elVin = $("vinBal");
  const elVic = $("vicBal");
  const elReg = $("registerBtn");
  const elCreateBtn = $("createAuctionBtn");
  const elList = $("auctionsList");
  const elTpl = $("auctionCardTpl");
  const elDialog = $("createDialog");
  const elForm = $("createForm");

  // ====== KẾT NỐI VÍ ======
  async function ensureProvider(){
    if(!window.ethereum){
      alert("Không tìm thấy ví Web3. Hãy cài MetaMask (desktop) hoặc mở trang trong trình duyệt ví (di động).");
      return null;
    }
    try{
      provider = new ethers.BrowserProvider(window.ethereum);
      chainId = (await provider.getNetwork()).chainId;
      // Switch hoặc Add chain 88
      if (chainId !== 88n) {
        try{
          await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: CHAIN_ID_HEX }] });
        }catch(e){
          if (e && (e.code === 4902 || e.message?.includes("Unrecognized chain"))) {
            await window.ethereum.request({ method:"wallet_addEthereumChain", params:[CHAIN_PARAMS] });
          } else {
            throw e;
          }
        }
      }
      return provider;
    }catch(e){
      console.error(e);
      alert("Không thể khởi tạo provider: " + (e.message||e));
      return null;
    }
  }

  async function connectWallet(){
    const p = await ensureProvider();
    if(!p) return;
    try{
      await p.send("eth_requestAccounts", []);
      signer = await p.getSigner();
      account = await signer.getAddress();
      chainId = (await p.getNetwork()).chainId;

      // Instances
      dg = new ethers.Contract(CONTRACT_ADDR, DG_ABI, signer);
      vin = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer);

      // UI header
      elConnect.classList.add("hidden");
      elAcc.classList.remove("hidden");
      elAddr.textContent = account;

      // Balances
      const [vicBalRaw, vinBalRaw] = await Promise.all([
        p.getBalance(account),
        vin.balanceOf(account)
      ]);
      elVic.textContent = Number(ethers.formatUnits(vicBalRaw, 18)).toFixed(4);
      elVin.textContent = Number(ethers.formatUnits(vinBalRaw, 18)).toFixed(4);

      // Đăng ký / Tạo cuộc đấu giá
      const registered = await dg.isRegistered(account);
      if (registered) {
        elReg.classList.add("hidden");
        elCreateBtn.classList.remove("hidden");
      } else {
        elReg.classList.remove("hidden");
        elCreateBtn.classList.add("hidden");
      }

      // Lắng nghe thay đổi tài khoản/chain
      window.ethereum.on?.("accountsChanged", () => location.reload());
      window.ethereum.on?.("chainChanged", () => location.reload());

      // Làm mới danh sách (để show nút theo vai trò)
      await loadAuctions();
    }catch(e){
      console.error(e);
      alert("Kết nối ví thất bại: " + (e.message||e));
    }
  }

  // ====== PHÍ VIN: APPROVE 0.001 VIN MỖI HÀNH ĐỘNG ======
  async function ensureFeeApproved(spender){
    const allow = await vin.allowance(account, spender);
    if (allow >= FEE_VIN) return;
    const tx = await vin.approve(spender, FEE_VIN, { gasLimit: 200000 });
    await tx.wait();
  }

  // ====== TẢI DANH SÁCH PHIÊN ======
  async function loadAuctions(){
    try{
      const count = await (dg ? dg.auctionCount() : new ethers.Contract(CONTRACT_ADDR, DG_ABI, new ethers.JsonRpcProvider("https://rpc.viction.xyz")).auctionCount());
      elList.innerHTML = "";
      if (count === 0n){
        elList.innerHTML = `<div class="empty">Chưa có cuộc đấu giá nào.</div>`;
        return;
      }
      for (let i = Number(count); i >= 1; i--){
        await renderAuction(i);
      }
    }catch(e){
      console.error(e);
      elList.innerHTML = `<div class="empty">Không tải được danh sách phiên.</div>`;
    }
  }

  function fill(el, sel, text){ qs(sel, el).textContent = text; }

  async function renderAuction(id){
    const prov = provider || new ethers.JsonRpcProvider("https://rpc.viction.xyz");
    const read = new ethers.Contract(CONTRACT_ADDR, DG_ABI, prov);
    const a = await read.getAuction(id);

    const node = elTpl.content.firstElementChild.cloneNode(true);
    qs(".title", node).textContent = a.summary || `(Phiên #${id})`;
    qs(".detailBtn", node).onclick = () => qs(".card-body", node).classList.toggle("hidden");

    fill(node, ".time", `${epochToVN(Number(a.auctionStart))} → ${epochToVN(Number(a.auctionEnd))}`);
    fill(node, ".cutoff", epochToVN(Number(a.whitelistCutoff)));
    fill(node, ".startPrice", fmtVND(Number(a.startPriceVND)));
    fill(node, ".step", fmtVND(Number(a.stepVND)));
    fill(node, ".current", a.currentPriceVND>0n ? fmtVND(Number(a.currentPriceVND)) : "—");
    fill(node, ".leader", a.currentLeader !== ethers.ZeroAddress ? a.currentLeader : "—");

    const linkTB = qs(".thongbao", node);
    const linkQC = qs(".quiche", node);
    linkTB.href = a.thongBaoUrl; linkQC.href = a.quiCheUrl;

    const wlBox = qs(".wlList", node);
    wlBox.textContent = "Đang tải…";
    read.getWhitelist(id).then(list=>{
      wlBox.textContent = (list && list.length) ? list.join("\n") : "Chưa có địa chỉ nào.";
    }).catch(()=> wlBox.textContent = "—");

    // Nút hành động (phụ thuộc ví)
    const btnJoin = qs(".joinBtn", node);
    const btnBack = qs(".backBtn", node);
    const btnReg  = qs(".regBtn", node);
    const btnCreate = qs(".createBtn", node);
    const btnUpd = qs(".updateWlBtn", node);
    const btnBid = qs(".bidBtn", node);
    const status = qs(".status", node);

    btnJoin.onclick = () => {
      // “Tham gia” => chỉ focus vào thẻ này (ẩn các thẻ khác)
      [...elList.children].forEach(c => { if(c!==node) c.style.display="none"; });
    };
    btnBack.onclick = () => {
      [...elList.children].forEach(c => c.style.display="");
    };

    const now = Math.floor(Date.now()/1000);
    const st = await read.getStatus(id);
    const stText = ["Chưa diễn ra","Đang diễn ra","Đã kết thúc","Đã chốt"][Number(st)] || "—";
    status.textContent = `Tình trạng: ${stText}`;

    if (account){
      // Vai trò của ví hiện thời
      const isOrg = (String(a.organizer).toLowerCase() === account.toLowerCase());
      const registered = await dg.isRegistered(account);

      // Đăng ký/Tạo
      btnReg.classList.toggle("hidden", registered);
      btnCreate.classList.toggle("hidden", !registered);

      // Organizer: cập nhật whitelist trước cutoff
      const canUpd = isOrg && now < Number(a.whitelistCutoff);
      btnUpd.classList.toggle("hidden", !canUpd);
      btnUpd.onclick = async () => {
        try{
          await ensureFeeApproved(CONTRACT_ADDR);
          const add = prompt("Dán danh sách địa chỉ (cách nhau bởi dấu phẩy) cần THÊM vào whitelist:", "");
          const rem = prompt("Dán danh sách địa chỉ (cách nhau bởi dấu phẩy) cần GỠ khỏi whitelist (có thể để trống):", "");
          const addrs = (add||"").split(",").map(s=>s.trim()).filter(Boolean);
          const removes = (rem||"").split(",").map(s=>s.trim()).filter(Boolean);
          const tx = await dg.updateWhitelist(id, addrs, removes, { gasLimit: 800000 });
          alert("Đang gửi giao dịch cập nhật whitelist…");
          await tx.wait();
          alert("Cập nhật whitelist thành công!");
          await renderRefresh(node, id);
        }catch(e){ alert("Lỗi cập nhật whitelist: " + (e.reason||e.message||e)); }
      };

      // Bỏ giá: chỉ whitelist, chỉ khi đang diễn ra, organizer KHÔNG có nút bỏ giá
      const isWL = await read.isWhitelisted(id, account);
      const canBid = !isOrg && isWL && (now >= Number(a.auctionStart) && now < Number(a.auctionEnd));
      btnBid.classList.toggle("hidden", !canBid);
      btnBid.onclick = async () => {
        try{
          const minNext = await read.getMinNextBid(id);
          const humanMin = Number(minNext);
          const val = prompt(`Nhập giá bỏ (VND) ≥ ${fmtVND(humanMin)}:`, humanMin ? String(humanMin) : "");
          if(!val) return;
          const amount = BigInt(val);
          if (amount < minNext) { alert("Giá quá thấp."); return; }
          await ensureFeeApproved(CONTRACT_ADDR);
          const tx = await dg.placeBid(id, amount, { gasLimit: 800000 });
          alert("Đang gửi giao dịch bỏ giá…");
          await tx.wait();
          alert("Bỏ giá thành công!");
          await renderRefresh(node, id);
        }catch(e){ alert("Lỗi bỏ giá: " + (e.reason||e.message||e)); }
      };
    } else {
      // Chưa kết nối ví: chỉ có Join/Back (giữ nguyên)
    }

    elList.appendChild(node);
  }

  async function renderRefresh(node, id){
    // Refresh nhanh các ô quan trọng sau giao dịch
    const prov = provider || new ethers.JsonRpcProvider("https://rpc.viction.xyz");
    const read = new ethers.Contract(CONTRACT_ADDR, DG_ABI, prov);
    const a = await read.getAuction(id);
    fill(node, ".current", a.currentPriceVND>0n ? fmtVND(Number(a.currentPriceVND)) : "—");
    fill(node, ".leader", a.currentLeader !== ethers.ZeroAddress ? a.currentLeader : "—");
    const st = await read.getStatus(id);
    const stText = ["Chưa diễn ra","Đang diễn ra","Đã kết thúc","Đã chốt"][Number(st)] || "—";
    qs(".status", node).textContent = `Tình trạng: ${stText}`;
  }

  // ====== ĐĂNG KÝ & TẠO PHIÊN ======
  async function handleRegister(){
    if(!signer) return alert("Vui lòng kết nối ví trước.");
    try{
      await ensureFeeApproved(CONTRACT_ADDR);
      const tx = await dg.register({ gasLimit: 300000 });
      alert("Đang gửi giao dịch đăng ký…");
      await tx.wait();
      alert("Đăng ký thành công!");
      await connectWallet(); // reload UI state
    }catch(e){ alert("Lỗi đăng ký: " + (e.reason||e.message||e)); }
  }

  async function handleOpenCreate(){
    if(!signer) return alert("Vui lòng kết nối ví trước.");
    elDialog.showModal();
  }

  elForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try{
      const summary   = $("fSummary").value.trim();
      const thongBao  = $("fThongBao").value.trim();
      const quiChe    = $("fQuiChe").value.trim();
      const cutoffSec = parseVN($("fCutoff").value.trim());
      const startSec  = parseVN($("fStart").value.trim());
      const endSec    = parseVN($("fEnd").value.trim());
      const startPrice= BigInt(($("fStartPrice").value||"").replace(/\D/g,""));
      const step      = BigInt(($("fStep").value||"").replace(/\D/g,""));

      if (!cutoffSec || !startSec || !endSec) throw new Error("Ngày giờ không đúng định dạng dd/mm/yyyy hh:mm");
      if (!(cutoffSec > Math.floor(Date.now()/1000))) throw new Error("Hạn whitelist phải lớn hơn hiện tại");
      if (!(cutoffSec <= startSec && startSec < endSec)) throw new Error("Thứ tự thời gian không hợp lệ");
      if (startPrice <= 0n || step <= 0n) throw new Error("Giá khởi điểm & bước giá phải > 0");

      await ensureFeeApproved(CONTRACT_ADDR);

      const a = {
        summary: summary,
        thongBaoUrl: thongBao,
        quiCheUrl: quiChe,
        whitelistCutoff: cutoffSec,
        auctionStart: startSec,
        auctionEnd: endSec,
        startPriceVND: startPrice,
        stepVND: step
      };
      const tx = await dg.createAuction(a, { gasLimit: 800000 });
      alert("Đang gửi giao dịch tạo phiên…");
      const rcpt = await tx.wait();
      alert("Tạo phiên thành công!");
      elDialog.close();
      await loadAuctions();
    }catch(e){
      alert("Lỗi tạo phiên: " + (e.reason||e.message||e));
    }
  });

  // ====== GẮN SỰ KIỆN NÚT ======
  $("connectBtn")?.addEventListener("click", connectWallet);
  $("registerBtn")?.addEventListener("click", handleRegister);
  $("createAuctionBtn")?.addEventListener("click", handleOpenCreate);

  // Bộ lọc tìm kiếm (client-side cơ bản)
  $("searchBtn")?.addEventListener("click", ()=>{
    const kw = ($("searchInput").value||"").trim().toLowerCase();
    const st = $("statusFilter").value;
    [...elList.children].forEach(card=>{
      const title = qs(".title", card).textContent.toLowerCase();
      const okKW = !kw || title.includes(kw);
      let okST = true;
      if (st !== ""){
        const sText = qs(".status", card).textContent;
        const map = {"0":"Chưa diễn ra","1":"Đang diễn ra","2":"Đã kết thúc","3":"Đã chốt"};
        okST = sText.includes(map[st]);
      }
      card.style.display = (okKW && okST) ? "" : "none";
    });
  });
  $("clearSearchBtn")?.addEventListener("click", ()=>{
    $("searchInput").value = "";
    $("statusFilter").value = "";
    [...elList.children].forEach(card=> card.style.display="");
  });

  // ====== KHỞI TẠO ======
  // Tải danh sách để người chưa kết nối vẫn xem được
  loadAuctions();

})();
