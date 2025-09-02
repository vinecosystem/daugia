/* =============================================================
   daugia.vin — app.js
   Chain: Viction (VIC, chainId 88)
   Contract: DauGia @ 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Token: VIN @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
   Library: ethers v5 UMD (window.ethers)

   Chức năng:
   - Kết nối ví MetaMask
   - Hiển thị số dư VIC, VIN
   - Tìm kiếm / theo dõi ví tạo đấu giá
   - Hiển thị danh sách đấu giá (read-only, ví dụ)
   ============================================================= */

// ---------- Cấu hình ----------
const { CHAIN_ID_HEX, RPC_URL, EXPLORER, AUCTION_ADDR, VIN_ADDR } = window.DGV_CONFIG;

let provider, signer, userAddress;
let vinContract, auctionContract;
let vinDecimals = 18;

// ---------- ABI cơ bản ----------
const vinAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
const auctionAbi = [
  "function getAllAuctions() view returns (tuple(uint256 id,address creator,uint256 startPrice,uint256 highestBid,address highestBidder,bool active)[])"
];

// ---------- Khởi tạo ----------
window.onload = async () => {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
  } else {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }
  vinContract = new ethers.Contract(VIN_ADDR, vinAbi, provider);
  auctionContract = new ethers.Contract(AUCTION_ADDR, auctionAbi, provider);
  await loadVinPrice();
  renderWatchList();
};

// ---------- Kết nối ví ----------
async function connectWallet() {
  try {
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    document.getElementById("accountShort").textContent = shorten(userAddress);
    document.getElementById("linkVicScan").href = `${EXPLORER}/address/${userAddress}`;
    await updateBalances();
    await setupContracts();
    document.getElementById("networkName").textContent = "Viction";
  } catch (err) {
    console.error("Lỗi connect:", err);
  }
}
document.getElementById("btnConnect").addEventListener("click", connectWallet);

// ---------- Setup contract ----------
async function setupContracts() {
  vinContract = new ethers.Contract(VIN_ADDR, vinAbi, signer || provider);
  auctionContract = new ethers.Contract(AUCTION_ADDR, auctionAbi, signer || provider);
}

// ---------- Hiển thị số dư ----------
async function updateBalances() {
  try {
    const vicBal = await provider.getBalance(userAddress);
    document.getElementById("vicBalance").textContent = ethers.utils.formatEther(vicBal);

    vinDecimals = await vinContract.decimals();
    const vinBal = await vinContract.balanceOf(userAddress);
    document.getElementById("vinBalance").textContent = ethers.utils.formatUnits(vinBal, vinDecimals);
  } catch (err) {
    console.error("Lỗi balances:", err);
  }
}

// ---------- Lấy giá VIN theo USD ----------
async function loadVinPrice() {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT");
    const data = await res.json();
    const vicPrice = parseFloat(data.price);
    const vinPrice = vicPrice * 100; // 1 VIN = 100 VIC
    document.getElementById("vinUsdValue").textContent = vinPrice.toFixed(2);
  } catch (err) {
    document.getElementById("vinUsdValue").textContent = "—";
  }
}

// ---------- Tìm kiếm ----------
document.getElementById("btnSearch").addEventListener("click", async () => {
  const addr = document.getElementById("inputCreator").value.trim();
  if (!ethers.utils.isAddress(addr)) {
    alert("Địa chỉ không hợp lệ!");
    return;
  }
  alert("Đang tìm cuộc đấu giá của: " + addr);
});

// ---------- Theo dõi ----------
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
    item.innerHTML = `
      <span>${shorten(addr)}</span>
      <a href="${EXPLORER}/address/${addr}" target="_blank">VicScan</a>
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

// ---------- Tiện ích ----------
function shorten(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "—";
}
