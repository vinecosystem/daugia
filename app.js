// ======= Kết nối ví và thông tin người dùng =======
let provider;
let signer;
let userAddress;
let vinToken;
let dauGiaContract;
let auctionList = [];

// Các selectors DOM
const connectBtn = document.getElementById("connectBtn");
const walletBox = document.getElementById("walletBox");
const registerBtn = document.getElementById("registerBtn");
const createBtn = document.getElementById("createBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const vinPriceChip = document.getElementById("vinPriceChip");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const auctionListContainer = document.getElementById("auctionList");
const focusOne = document.getElementById("focusOne");
const focusContainer = document.getElementById("focusContainer");

// ======= Các hàm hỗ trợ =======
const getVinPriceInUSD = async () => {
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=VICUSDT");
    const data = await response.json();
    const vicPrice = parseFloat(data.price);
    if (isNaN(vicPrice)) throw new Error("Invalid VIC price");
    const vinPrice = vicPrice * 100;
    vinPriceChip.textContent = `1 VIN = ${vinPrice.toFixed(2)} USD`;
  } catch (error) {
    vinPriceChip.textContent = "1 VIN = Loading price...";
  }
};

// ======= Kết nối ví và lấy thông tin =======
const connectWallet = async () => {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    // Tạo instances của contract và token
    vinToken = new ethers.Contract(
      "0x941F63807401efCE8afe3C9d88d368bAA287Fac4", // Địa chỉ token VIN
      [{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
      provider
    );
    dauGiaContract = new ethers.Contract(
      "0x1765e20ecB8cD78688417A6d4123f2b899775599", // Địa chỉ hợp đồng đấu giá
      [
        {
          "constant": true,
          "inputs": [{"internalType": "uint256", "name": "auctionId", "type": "uint256"}],
          "name": "getAuction",
          "outputs": [
            {"internalType": "address", "name": "organizer", "type": "address"},
            {"internalType": "uint64", "name": "startView", "type": "uint64"},
            {"internalType": "uint64", "name": "endView", "type": "uint64"},
            {"internalType": "uint64", "name": "depositStart", "type": "uint64"},
            {"internalType": "uint64", "name": "depositCutoff", "type": "uint64"},
            {"internalType": "uint64", "name": "auctionStart", "type": "uint64"},
            {"internalType": "uint64", "name": "auctionEnd", "type": "uint64"},
            {"internalType": "uint256", "name": "startingPriceVND", "type": "uint256"},
            {"internalType": "uint256", "name": "minIncrementVND", "type": "uint256"},
            {"internalType": "uint256", "name": "depositAmountVND", "type": "uint256"},
            {"internalType": "uint256", "name": "currentPriceVND", "type": "uint256"},
            {"internalType": "address", "name": "highestBidder", "type": "address"},
            {"internalType": "bool", "name": "finalized", "type": "bool"},
            {"internalType": "bool", "name": "failed", "type": "bool"},
            {"internalType": "string", "name": "auctionDetailCID", "type": "string"}
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [{"internalType": "uint64", "name": "startView", "type": "uint64"}],
          "name": "createAuction",
          "outputs": [{"internalType": "uint256", "name": "auctionId", "type": "uint256"}],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {"internalType": "uint256", "name": "auctionId", "type": "uint256"},
            {"internalType": "address", "name": "bidder", "type": "address"}
          ],
          "name": "placeBid",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      signer
    );
    // Cập nhật ví và tài sản
    await updateWalletInfo();
    walletBox.classList.remove("hidden");
    connectBtn.classList.add("hidden");
    checkRegistration();
  }
};

// ======= Cập nhật ví và số dư =======
const updateWalletInfo = async () => {
  const vinBalance = await vinToken.balanceOf(userAddress);
  const vicBalance = await provider.getBalance(userAddress);
  document.getElementById("accountShort").textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
  document.getElementById("balVIN").textContent = `VIN: ${ethers.utils.formatUnits(vinBalance, 18)}`;
  document.getElementById("balVIC").textContent = `VIC: ${ethers.utils.formatEther(vicBalance)}`;
};

// ======= Kiểm tra xem ví đã đăng ký chưa =======
const checkRegistration = async () => {
  const isRegistered = await dauGiaContract.registeredOrganizer(userAddress);
  if (isRegistered) {
    createBtn.classList.remove("hidden");
    registerBtn.classList.add("hidden");
  } else {
    createBtn.classList.add("hidden");
    registerBtn.classList.remove("hidden");
  }
};

// ======= Đăng ký ví =======
const registerWallet = async () => {
  // Thu phí 0.001 VIN khi đăng ký ví
  const tx = await dauGiaContract.registerOrganizer("profileCID here", { value: ethers.utils.parseUnits("0.001", 18) });
  await tx.wait();
  registerBtn.classList.add("hidden");
  createBtn.classList.remove("hidden");
};

// ======= Tạo cuộc đấu giá =======
const createAuction = async () => {
  // Thu phí 0.001 VIN khi tạo cuộc đấu giá
  const tx = await dauGiaContract.createAuction(
    Math.floor(Date.now() / 1000) + 3600, // startView
    Math.floor(Date.now() / 1000) + 7200, // endView
    Math.floor(Date.now() / 1000) + 10800, // depositStart
    Math.floor(Date.now() / 1000) + 14400, // depositCutoff
    Math.floor(Date.now() / 1000) + 21600, // auctionStart
    Math.floor(Date.now() / 1000) + 28800, // auctionEnd
    ethers.utils.parseUnits("1", 18), // startingPriceVND
    ethers.utils.parseUnits("0.1", 18), // minIncrementVND
    ethers.utils.parseUnits("0.5", 18), // depositAmountVND
    "auctionDetailCID here", // auctionDetailCID
    { value: ethers.utils.parseUnits("0.001", 18) } // phí 0.001 VIN
  );
  await tx.wait();
  alert("Auction created!");
};

// ======= Cập nhật ví cho người đã cọc =======
const updateDepositors = async () => {
  // Cập nhật ví đã cọc
  const tx = await dauGiaContract.updateWhitelist(currentAuctionId, [userAddress], ["uncProofCID here"], { value: ethers.utils.parseUnits("0.001", 18) });
  await tx.wait();
  alert("Depositors updated!");
};

// ======= Bỏ giá =======
const placeBid = async (auctionId, bidAmount) => {
  // Thực hiện bỏ giá
  const tx = await dauGiaContract.placeBid(auctionId, bidAmount, { value: ethers.utils.parseUnits("0.001", 18) });
  await tx.wait();
  alert("Bid placed successfully!");
};

// ======= Tìm kiếm và lọc các cuộc đấu giá =======
searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.toLowerCase();
  auctionList = await dauGiaContract.getAuctionList();
  const filteredAuctions = auctionList.filter(auction => auction.title.toLowerCase().includes(query));
  renderAuctions(filteredAuctions);
});

// ======= Render các cuộc đấu giá =======
const renderAuctions = (auctions) => {
  auctionListContainer.innerHTML = "";
  auctions.forEach(auction => {
    const auctionCard = document.createElement("div");
    auctionCard.classList.add("auction-card");
    auctionCard.innerHTML = `
      <h2>${auction.title}</h2>
      <p>${auction.summary}</p>
      <button class="btn">View Details</button>
    `;
    auctionListContainer.appendChild(auctionCard);
  });
};

// ======= Khởi tạo và kết nối ví =======
connectBtn.addEventListener("click", connectWallet);
registerBtn.addEventListener("click", registerWallet);
createBtn.addEventListener("click", createAuction);
disconnectBtn.addEventListener("click", () => {
  window.location.reload();
});

// ======= Load thông tin giá VIN khi trang tải =======
window.onload = () => {
  // Không cần xử lý giá VIN ở đây vì đã xử lý trong index.html
};
