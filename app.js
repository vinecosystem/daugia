<!-- app.js -->
<script>
/* =============================================================
   daugia.vin — app.js (ethers v5)
   Chain: Viction (VIC, chainId 88)
   Contracts:
     - VIN (ERC20): 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
     - DauGia     : 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Behavior:
     - Chưa kết nối ví: CHỈ hiển thị: Connect, Hướng dẫn, ô tìm kiếm, Theo dõi/Xóa
     - Kết nối thành công: hiện địa chỉ ví + số dư VIC/VIN
         • Nếu CHƯA đăng ký: hiện nút "Đăng ký"
         • Nếu ĐÃ đăng ký : ẩn "Đăng ký", hiện "Tạo cuộc đấu giá"
     - Đăng ký: thu ~1 USD bằng VIN (tính từ VICUSDT; so sánh với platformFeeVIN)
   ============================================================= */

/* ---------- Constants ---------- */
const CHAIN_ID_DEC = 88;
const CHAIN_ID_HEX = "0x58";
const RPC_URL      = "https://rpc.viction.xyz";
const EXPLORER     = "https://vicscan.xyz";

const VIN_ADDR   = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";
const DAUGIA_ADDR= "0x1765e20ecB8cD78688417A6d4123f2b899775599";

const BINANCE_VICUSDT = "https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT";

/* ---------- Minimal ABIs ---------- */
// ERC20: balanceOf, decimals, symbol, allowance, approve
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];

// DauGia: các view + registerOrganizer
// Tham chiếu từ ABI bạn đã cung cấp (rút gọn cho client) 
// - platformFeeVIN()            view -> uint256
// - registeredOrganizer(addr)   view -> bool
// - registerOrganizer(string)   nonpayable
const DAUGIA_ABI = [
  "function platformFeeVIN() view returns (uint256)",
  "function registeredOrganizer(address) view returns (bool)",
  "function registerOrganizer(string profileCID) nonpayable",
  "function getOrganizerAuctions(address) view returns (uint256[])"
];

/* ---------- State ---------- */
let provider, web3Provider, signer;
let vinRead, dauGiaRead, vinWrite, dauGiaWrite;
let userAddress = null;
let vinDecimals = 18;
let vinSymbol = "VIN";

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const elBtnConnect    = $("btn-connect");
const elBtnDisconnect = $("btn-disconnect");
const elWalletChip    = $("wallet-chip");
const elWalletAddr    = $("wallet-address");
const elBalVIC        = $("bal-vic");
const elBalVIN        = $("bal-vin");

const elBtnRegister   = $("btn-register");
const elMenuCreate    = $("menu-create");

const elVinPriceText  = $("vin-price");
const elToast         = $("toast");

// Search / follow controls (hiển thị mọi trạng thái theo index.html)
const elInpOrganizer  = $("inp-organizer");
const elBtnSearch     = $("btn-search");
const elBtnFollowAdd  = $("btn-follow-add");
const elBtnFollowClear= $("btn-follow-clear");

/* ---------- Utils ---------- */
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
const setHidden = (el, hidden=true)=> { if (!el) return; el.classList.toggle("hidden", !!hidden); };
const shortAddr = (a)=> a ? (a.slice(0,6)+"…"+a.slice(-4)) : "";
const fmt = (n, d=4)=> Number(n).toLocaleString(undefined,{maximumFractionDigits:d});

function showToast(msg, ms=3800){
  if(!elToast) return;
  elToast.textContent = msg;
  setHidden(elToast, false);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> setHidden(elToast,true), ms);
}

async function ensureChain(){
  if(!window.ethereum) return;
  const chainId = await window.ethereum.request({ method:"eth_chainId" });
  if(chainId !== CHAIN_ID_HEX){
    // cố gắng switch, nếu chưa có thì add
    try{
      await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: CHAIN_ID_HEX }] });
    }catch(switchErr){
      if(switchErr.code === 4902 || String(switchErr.message||"").includes("not added")){
        await window.ethereum.request({
          method:"wallet_addEthereumChain",
          params:[{
            chainId: CHAIN_ID_HEX,
            chainName: "Viction",
            nativeCurrency: { name:"VIC", symbol:"VIC", decimals:18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER]
          }]
        });
      }else{
        throw switchErr;
      }
    }
  }
}

/* ---------- Price helpers ---------- */
// 1 VIN = 100 * VIC (USD)
async function fetchVinUsd(){
  try{
    const r = await fetch(BINANCE_VICUSDT, { cache:"no-store" });
    const j = await r.json();
    const vicUsd = parseFloat(j?.price);
    if(!isFinite(vicUsd) || vicUsd<=0) throw new Error("No VIC price");
    const vinUsd = vicUsd * 100;
    if(elVinPriceText) elVinPriceText.textContent = `1 VIN = ${vinUsd.toFixed(2)} USD`;
    return vinUsd;
  }catch(e){
    if(elVinPriceText) elVinPriceText.textContent = "Price unavailable";
    return null;
  }
}

/* ---------- Provider / Contracts ---------- */
function getReadonlyProvider(){
  return new ethers.providers.JsonRpcProvider(RPC_URL);
}

function attachContracts(p){
  vinRead   = new ethers.Contract(VIN_ADDR, ERC20_ABI, p);
  dauGiaRead= new ethers.Contract(DAUGIA_ADDR, DAUGIA_ABI, p);
}

function attachWriteContracts(signer){
  vinWrite   = new ethers.Contract(VIN_ADDR, ERC20_ABI, signer);
  dauGiaWrite= new ethers.Contract(DAUGIA_ADDR, DAUGIA_ABI, signer);
}

/* ---------- UI State ---------- */
function renderDisconnected(){
  setHidden(elBtnConnect, false);
  setHidden(elBtnDisconnect, true);
  setHidden(elWalletChip, true);

  // menu theo yêu cầu
  setHidden(elBtnRegister, true);
  setHidden(elMenuCreate, true);
}

function renderConnectedBase(){
  setHidden(elBtnConnect, true);
  setHidden(elBtnDisconnect, false);
  setHidden(elWalletChip, false);
}

async function renderConnectedDynamic(){
  if(!userAddress) return;

  // Balances
  const [vicWei, vinBalBn, dec, sym] = await Promise.all([
    web3Provider.getBalance(userAddress),
    vinRead.balanceOf(userAddress),
    vinRead.decimals().catch(()=>18),
    vinRead.symbol().catch(()=> "VIN")
  ]);
  vinDecimals = dec || 18;
  vinSymbol   = sym || "VIN";

  const vic = ethers.utils.formatEther(vicWei);
  const vin = ethers.utils.formatUnits(vinBalBn, vinDecimals);

  elWalletAddr.textContent = shortAddr(userAddress);
  elBalVIC.textContent = `VIC: ${fmt(vic,4)}`;
  elBalVIN.textContent = `${vinSymbol}: ${fmt(vin,4)}`;

  // Organizer status
  const isReg = await dauGiaRead.registeredOrganizer(userAddress);
  if(isReg){
    setHidden(elBtnRegister, true);
    setHidden(elMenuCreate, false);
  }else{
    setHidden(elBtnRegister, false);
    setHidden(elMenuCreate, true);
  }
}

/* ---------- Connect / Disconnect ---------- */
async function connectWallet(){
  if(!window.ethereum){
    showToast("Chưa phát hiện ví. Hãy cài MetaMask và thử lại.");
    return;
  }
  try{
    await ensureChain();
    web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await web3Provider.send("eth_requestAccounts", []);
    signer = web3Provider.getSigner();
    userAddress = await signer.getAddress();

    renderConnectedBase();
    attachContracts(web3Provider);
    attachWriteContracts(signer);

    await fetchVinUsd();                  // cập nhật giá
    await renderConnectedDynamic();       // số dư + trạng thái đăng ký

    // lắng nghe thay đổi
    window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    window.ethereum.removeListener?.("chainChanged", onChainChanged);
    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);
  }catch(e){
    console.error(e);
    showToast("Kết nối ví thất bại.");
  }
}

function disconnectWallet(){
  // MetaMask không cho ngắt programmatically; ta chỉ reset UI.
  userAddress = null;
  signer = null;
  web3Provider = null;
  attachContracts(provider); // quay về read-only
  renderDisconnected();
  showToast("Đã ngắt kết nối (UI).");
}

async function onAccountsChanged(accs){
  if(!accs || accs.length===0){ disconnectWallet(); return; }
  userAddress = ethers.utils.getAddress(accs[0]);
  renderConnectedBase();
  attachContracts(web3Provider);
  attachWriteContracts(signer);
  await renderConnectedDynamic();
}
async function onChainChanged(chainId){
  if(chainId !== CHAIN_ID_HEX){
    showToast("Sai mạng. Đang chuyển về Viction…");
    await sleep(500);
    disconnectWallet();
  }else{
    await renderConnectedDynamic();
  }
}

/* ---------- Register (pay ~1 USD in VIN) ---------- */
async function handleRegister(){
  if(!signer || !userAddress){ showToast("Hãy kết nối ví trước."); return; }
  try{
    // 1) Lấy giá VIN ≈ USD và phí cấu hình trên contract
    const [vinUsd, platformFeeBn] = await Promise.all([
      fetchVinUsd(),                         // có thể null nếu lỗi API
      dauGiaRead.platformFeeVIN()            // uint256 VIN (đơn vị token, đã theo decimals)
    ]);

    // 2) Tính VIN ~ 1 USD (nếu có giá)
    let needVinBn = platformFeeBn; // fallback: contract là chuẩn
    if(vinUsd && vinUsd>0){
      // amount VIN để ~1 USD: 1 / vinUsd
      const needVin = 1 / vinUsd;
      needVinBn = ethers.utils.parseUnits(needVin.toFixed(vinDecimals+4), vinDecimals); // thêm chút precision
    }

    // 3) So sánh với platformFeeVIN
    const delta = platformFeeBn.sub(needVinBn).abs();
    const warn = delta.gt(platformFeeBn.div(20)); // lệch >5% thì cảnh báo
    if(warn){
      showToast("Cảnh báo: Phí on-chain khác 1 USD ước tính. Sẽ dùng phí do hợp đồng quy định.");
    }

    // 4) Kiểm tra allowance & approve chính xác platformFeeVIN cho hợp đồng DauGia
    const cur = await vinRead.allowance(userAddress, DAUGIA_ADDR);
    if(cur.lt(platformFeeBn)){
      const txA = await vinWrite.approve(DAUGIA_ADDR, platformFeeBn);
      showToast("Đang gửi approve VIN…");
      await txA.wait();
    }

    // 5) Gọi registerOrganizer(profileCID)
    // Hiện tại chưa có form profile → truyền rỗng "": bạn có thể cập nhật sau.
    const tx = await dauGiaWrite.registerOrganizer("");
    showToast("Đang đăng ký…");
    await tx.wait();

    showToast("Đăng ký thành công!");
    await renderConnectedDynamic();
  }catch(e){
    console.error(e);
    let msg = "Đăng ký thất bại.";
    const s = String(e?.message||"");
    if(s.includes("PLATFORM_FEE_REQUIRED")) msg = "Cấu hình phí không hợp lệ (contract).";
    if(s.includes("user rejected")) msg = "Bạn đã huỷ giao dịch.";
    showToast(msg);
  }
}

/* ---------- Init ---------- */
async function init(){
  // Read-only by default
  provider = getReadonlyProvider();
  attachContracts(provider);

  // Giá VIN trên header
  fetchVinUsd();
  setInterval(fetchVinUsd, 60000);

  // Nút/handlers
  elBtnConnect?.addEventListener("click", connectWallet);
  elBtnDisconnect?.addEventListener("click", disconnectWallet);
  elBtnRegister?.addEventListener("click", handleRegister);

  // Mặc định chưa kết nối
  renderDisconnected();

  // Nếu người dùng đã từng cho phép site connect, thử tự phát hiện tài khoản
  if(window.ethereum){
    try{
      const accounts = await window.ethereum.request({ method:"eth_accounts" });
      const curChain = await window.ethereum.request({ method:"eth_chainId" }).catch(()=>null);
      if(accounts && accounts.length>0 && curChain===CHAIN_ID_HEX){
        // gắn provider ghi + signer nhưng KHÔNG gọi eth_requestAccounts (không bật popup)
        web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
        signer = web3Provider.getSigner();
        userAddress = ethers.utils.getAddress(accounts[0]);
        attachContracts(web3Provider);
        attachWriteContracts(signer);
        renderConnectedBase();
        await renderConnectedDynamic();
        window.ethereum.on?.("accountsChanged", onAccountsChanged);
        window.ethereum.on?.("chainChanged", onChainChanged);
      }
    }catch{} 
  }
}

// Khởi động
document.addEventListener("DOMContentLoaded", init);
</script>
