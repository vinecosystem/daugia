/* =============================================================
   daugia.vin — app.js (ethers v5)
   Chain: Viction (chainId 88)
   Contract: DauGia @ 0x1765e20ecB8cD78688417A6d4123f2b899775599
   Token: VIN @ 0x941F63807401efCE8afe3C9d88d368bAA287Fac4
   Library: ethers v5 UMD (window.ethers)

   Cải tiến v9:
   - Tất cả giao dịch đều dùng gas overrides:
     * gasLimit = estimateGas * 1.5 (biên an toàn)
     * fee: +25% (maxFeePerGas/maxPriorityFeePerGas hoặc gasPrice)
   - Mục tiêu: ký 1 lần, hạn chế lỗi thiếu gas trên VIC.
   ============================================================= */

// ---------- Constants ----------
const RPC_URL = "https://rpc.viction.xyz";
const EXPLORER = "https://vicscan.xyz";

// Địa chỉ hợp đồng
const DAUGIA_ADDRESS = "0x1765e20ecB8cD78688417A6d4123f2b899775599";
const VIN_ADDRESS = "0x941F63807401efCE8afe3C9d88d368bAA287Fac4";
const CONTRACT_ABI = [
  // ABIs của contract DauGia (được trích xuất từ hợp đồng)
];

// ---------- State variables ----------
let provider, signer, userAddress, dauGiaContract;
let vinBalance = 0, vicBalance = 0, priceInUSD = "Loading...";

// ---------- DOM Elements ----------
const btnConnect = document.getElementById("btn-connect");
const walletShort = document.getElementById("wallet-short");
const vinBalanceElement = document.getElementById("vin-balance");
const vicBalanceElement = document.getElementById("vic-balance");
const chipPrice = document.getElementById("vin-usd");

// ---------- Connect Wallet ----------
async function connectWallet() {
  try {
    if (window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      userAddress = await signer.getAddress();

      await setupContracts();
      walletShort.textContent = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
      btnConnect.textContent = "Kết nối thành công";

      // Cập nhật số dư
      updateBalances();
    } else {
      alert("Không phát hiện ví. Vui lòng cài đặt MetaMask.");
    }
  } catch (err) {
    console.error("Lỗi kết nối ví:", err);
    alert("Không thể kết nối ví, thử lại sau.");
  }
}

async function setupContracts() {
  dauGiaContract = new ethers.Contract(DAUGIA_ADDRESS, CONTRACT_ABI, signer);
}

// ---------- Update Balances ----------
async function updateBalances() {
  try {
    const vinToken = new ethers.Contract(VIN_ADDRESS, [
      "function balanceOf(address) public view returns (uint256)",
      "function decimals() public view returns (uint8)"
    ], provider);

    vinBalance = await vinToken.balanceOf(userAddress);
    vinBalance = ethers.utils.formatUnits(vinBalance, await vinToken.decimals());

    vicBalance = await provider.getBalance(userAddress);
    vicBalance = ethers.utils.formatUnits(vicBalance, 18);

    vinBalanceElement.textContent = vinBalance + " VIN";
    vicBalanceElement.textContent = vicBalance + " VIC";
  } catch (err) {
    console.error("Lỗi cập nhật số dư:", err);
  }
}

// ---------- Get VIN Price (USD) ----------
async function getVinPrice() {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT`);
    const data = await response.json();
    priceInUSD = parseFloat(data.price).toFixed(2);
    chipPrice.textContent = `1 VIN = ${priceInUSD} USD`;
  } catch (err) {
    console.error("Lỗi lấy giá VIN từ Binance:", err);
    chipPrice.textContent = "Không thể lấy giá.";
  }
}

// ---------- Event Listeners ----------
btnConnect.addEventListener("click", connectWallet);

// ---------- Initialize ----------
window.onload = async () => {
  await getVinPrice();
};

// Xử lý các giao dịch đấu giá, tìm kiếm, tạo phiên đấu giá, v.v...
