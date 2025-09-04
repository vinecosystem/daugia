// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DauGia.sol
 * - Mạng: VIC (Viction, chainId 88)
 * - Phí nền tảng: thu bằng token VIN (ERC20) cho mỗi thao tác on-chain (trừ finalize)
 * - Hợp đồng KHÔNG nắm giữ tiền đấu giá; mọi thanh toán/cọc xử lý off-chain. On-chain chỉ minh bạch:
 *   whitelist ví đã cọc, lịch sử đặt giá, kết quả thắng cuộc.
 *
 * TÍNH NĂNG CHÍNH
 * - Đăng ký tổ chức (bất kỳ ai): trả phí (VIN) + gas (VIC)
 * - Tạo cuộc đấu giá: lưu thông số & CID IPFS mô tả chi tiết (mô tả dài ≤ 20,000 ký tự lưu off-chain)
 * - Cập nhật whitelist ví đã đặt cọc (đến hạn cutoff)
 * - Bỏ giá (bid): chỉ ví trong whitelist & trong khung giờ phiên; giá >= current + minIncrement
 * - Kết thúc (finalize): ai cũng gọi được; công bố winner hoặc thất bại
 *
 * LƯU Ý DAPP
 * - Ai cũng xem được tất cả dữ liệu mà KHÔNG cần kết nối ví (read-only provider).
 * - Mô tả dài nhập xuống dòng/format thoải mái vì lưu trên IPFS (CID ở on-chain).
 */

/// @notice Chuẩn ERC20 tối giản
interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @notice SafeERC20 tối giản, xử lý token không chuẩn trả về không-boolean
library SafeERC20 {
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "VIN_TRANSFER_FAILED");
    }
}

/// @notice Ownable tối giản (admin chỉ để chỉnh phí/feeReceiver/vinToken)
abstract contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed from, address indexed to);
    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        owner = newOwner;
        emit OwnershipTransferred(msg.sender, newOwner);
    }
}

/// @notice ReentrancyGuard tối giản
abstract contract ReentrancyGuard {
    uint256 private constant _ENTERED = 2;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private _status = _NOT_ENTERED;
    modifier nonReentrant() {
        require(_status == _NOT_ENTERED, "REENTRANT");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

contract DauGia is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ====== Errors (revert reasons) ======
    error PLATFORM_FEE_REQUIRED();
    error AUCTION_NOT_STARTED();
    error AUCTION_ENDED();
    error BIDDER_NOT_WHITELISTED();
    error BID_TOO_LOW();
    error WHITELIST_CUTOFF();
    error NOT_ORGANIZER();
    error INVALID_TIME_ORDER();
    error ALREADY_FINALIZED();

    // ====== Events ======
    event OrganizerRegistered(address indexed organizer, string profileCID);
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed organizer,
        string auctionDetailCID
    );
    event WhitelistUpdated(
        uint256 indexed auctionId,
        address indexed organizer,
        address[] added,
        string[] uncProofCIDs // optional; có thể rỗng
    );
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amountVND,
        uint256 timestamp
    );
    /// reasonCode: 1 = NO_WHITELIST, 2 = NO_BIDS
    event AuctionFailed(uint256 indexed auctionId, uint8 reasonCode);
    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPriceVND,
        uint256 timestamp
    );

    // ====== Cấu hình phí VIN ======
    IERC20 public vinToken;              // địa chỉ token VIN trên VIC
    address public feeReceiver;          // nơi nhận phí
    uint256 public platformFeeVIN;       // số VIN phải trả mỗi thao tác (tương ứng ~1 USD, do admin set)

    // ====== Đăng ký tổ chức ======
    mapping(address => bool) public registeredOrganizer;
    mapping(address => string) public organizerProfileCID; // thông tin hành chính (IPFS), tùy chọn

    // ====== Đấu giá ======
    struct Auction {
        address organizer;

        // Mốc thời gian (UNIX, giây)
        uint64 startView;       // bắt đầu xem tài sản
        uint64 endView;         // kết thúc xem tài sản
        uint64 depositStart;    // bắt đầu nhận tiền cọc (thông tin)
        uint64 depositCutoff;   // HẠN CUỐI cập nhật whitelist
        uint64 auctionStart;    // bắt đầu phiên
        uint64 auctionEnd;      // kết thúc phiên

        // Giá & cọc (đơn vị: VND, hiển thị/minh bạch)
        uint256 startingPriceVND;
        uint256 minIncrementVND;
        uint256 depositAmountVND;

        // Trạng thái bid
        uint256 currentPriceVND;   // mặc định = startingPriceVND
        address highestBidder;

        // Kết thúc
        bool finalized;
        bool failed;

        // Whitelist
        uint256 whitelistCount;

        // IPFS chi tiết (mô tả dài, ảnh, tài liệu pháp lý, bank info...) -> lưu ở đây CID
        string auctionDetailCID;
    }

    uint256 public totalAuctions;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => bool)) public isWhitelisted;
    mapping(address => uint256[]) private _organizerAuctions; // phục vụ tra cứu theo ví organizer

    // ====== Constructor ======
    constructor(address vinToken_, address feeReceiver_, uint256 platformFeeVIN_) {
        require(vinToken_ != address(0) && feeReceiver_ != address(0), "ZERO_ADDR");
        vinToken = IERC20(vinToken_);
        feeReceiver = feeReceiver_;
        platformFeeVIN = platformFeeVIN_;
    }

    // ====== Admin update fee config ======
    function setPlatformFeeVIN(uint256 newFee) external onlyOwner {
        platformFeeVIN = newFee;
    }

    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "ZERO_ADDR");
        feeReceiver = newReceiver;
    }

    function setVinToken(address newVin) external onlyOwner {
        require(newVin != address(0), "ZERO_ADDR");
        vinToken = IERC20(newVin);
    }

    // ====== Helpers ======
    function _collectFee() internal {
        if (platformFeeVIN > 0) {
            // yêu cầu caller đã approve VIN cho contract
            vinToken.safeTransferFrom(msg.sender, feeReceiver, platformFeeVIN);
        } else {
            revert PLATFORM_FEE_REQUIRED(); // platformFeeVIN không được để 0 trong cấu hình
        }
    }

    // ====== API Đăng ký tổ chức ======
    function registerOrganizer(string calldata profileCID) external nonReentrant {
        _collectFee();
        registeredOrganizer[msg.sender] = true;      // cho phép tạo phiên
        organizerProfileCID[msg.sender] = profileCID; // lưu thông tin tuỳ chọn
        emit OrganizerRegistered(msg.sender, profileCID);
    }

    // ====== API Tạo cuộc đấu giá ======
    function createAuction(
        uint64 startView,
        uint64 endView,
        uint64 depositStart,
        uint64 depositCutoff,
        uint64 auctionStart,
        uint64 auctionEnd,
        uint256 startingPriceVND,
        uint256 minIncrementVND,
        uint256 depositAmountVND,
        string calldata auctionDetailCID
    ) external nonReentrant returns (uint256 auctionId) {
        require(registeredOrganizer[msg.sender], "NOT_REGISTERED");
        // Kiểm tra logic thời gian:
        // startView <= endView <= depositCutoff <= auctionStart < auctionEnd
        if (!(startView <= endView &&
              endView <= depositCutoff &&
              depositCutoff <= auctionStart &&
              auctionStart < auctionEnd)) {
            revert INVALID_TIME_ORDER();
        }
        require(minIncrementVND > 0, "MIN_INCREMENT_ZERO");

        _collectFee();

        auctionId = ++totalAuctions;
        Auction storage a = auctions[auctionId];
        a.organizer = msg.sender;
        a.startView = startView;
        a.endView = endView;
        a.depositStart = depositStart;
        a.depositCutoff = depositCutoff;
        a.auctionStart = auctionStart;
        a.auctionEnd = auctionEnd;

        a.startingPriceVND = startingPriceVND;
        a.minIncrementVND = minIncrementVND;
        a.depositAmountVND = depositAmountVND;

        a.currentPriceVND = startingPriceVND; // giá hiện tại ban đầu = giá khởi điểm
        a.auctionDetailCID = auctionDetailCID;

        _organizerAuctions[msg.sender].push(auctionId);

        emit AuctionCreated(auctionId, msg.sender, auctionDetailCID);
    }

    // ====== API Cập nhật whitelist (đến hạn cutoff) ======
    function updateWhitelist(
        uint256 auctionId,
        address[] calldata bidders,
        string[] calldata uncProofCIDs // optional; có thể rỗng hoặc cùng độ dài với bidders
    ) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (msg.sender != a.organizer) revert NOT_ORGANIZER();
        if (block.timestamp > a.depositCutoff) revert WHITELIST_CUTOFF();

        _collectFee();

        // Cho phép uncProofCIDs trống ([]) hoặc bằng độ dài bidders[]
        if (uncProofCIDs.length != 0) {
            require(uncProofCIDs.length == bidders.length, "UNC_LEN_MISMATCH");
        }

        // Chỉ cộng whitelistCount nếu địa chỉ mới
        address[] memory actuallyAdded = new address[](bidders.length);
        uint256 addedCount = 0;
        for (uint256 i = 0; i < bidders.length; i++) {
            address b = bidders[i];
            if (b != address(0) && !isWhitelisted[auctionId][b]) {
                isWhitelisted[auctionId][b] = true;
                a.whitelistCount += 1;
                actuallyAdded[addedCount++] = b;
            }
        }

        // Thu gọn mảng actuallyAdded theo addedCount
        address[] memory added;
        if (addedCount == actuallyAdded.length) {
            added = actuallyAdded;
        } else {
            added = new address[](addedCount);
            for (uint256 j = 0; j < addedCount; j++) {
                added[j] = actuallyAdded[j];
            }
        }

        emit WhitelistUpdated(auctionId, a.organizer, added, uncProofCIDs);
    }

    // ====== API Bỏ giá (bid) ======
    function placeBid(uint256 auctionId, uint256 bidAmountVND) external nonReentrant {
        Auction storage a = auctions[auctionId];

        if (block.timestamp < a.auctionStart) revert AUCTION_NOT_STARTED();
        if (block.timestamp >= a.auctionEnd) revert AUCTION_ENDED();
        if (!isWhitelisted[auctionId][msg.sender]) revert BIDDER_NOT_WHITELISTED();

        // Tính mức tối thiểu hợp lệ
        uint256 minValidBid = a.currentPriceVND + a.minIncrementVND;
        if (bidAmountVND < minValidBid) revert BID_TOO_LOW();

        _collectFee();

        // Cập nhật trạng thái dẫn đầu
        a.currentPriceVND = bidAmountVND;
        a.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, bidAmountVND, block.timestamp);
    }

    // ====== API Kết thúc (ai cũng có thể gọi) ======
    function finalize(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.finalized) revert ALREADY_FINALIZED();
        if (block.timestamp < a.auctionEnd) revert AUCTION_NOT_STARTED(); // sử dụng lại cho "chưa đến thời điểm kết thúc"

        a.finalized = true;

        // Thất bại nếu không có whitelist hoặc không có bid hợp lệ
        if (a.whitelistCount == 0) {
            a.failed = true;
            emit AuctionFailed(auctionId, 1); // NO_WHITELIST
            return;
        }
        if (a.highestBidder == address(0)) {
            a.failed = true;
            emit AuctionFailed(auctionId, 2); // NO_BIDS
            return;
        }

        // Thành công
        emit AuctionFinalized(auctionId, a.highestBidder, a.currentPriceVND, block.timestamp);
    }

    // ====== Views tiện ích ======
    function getAuction(uint256 auctionId)
        external
        view
        returns (
            address organizer,
            uint64 startView,
            uint64 endView,
            uint64 depositStart,
            uint64 depositCutoff,
            uint64 auctionStart,
            uint64 auctionEnd,
            uint256 startingPriceVND,
            uint256 minIncrementVND,
            uint256 depositAmountVND,
            uint256 currentPriceVND,
            address highestBidder,
            bool finalized,
            bool failed,
            string memory auctionDetailCID
        )
    {
        Auction storage a = auctions[auctionId];
        organizer = a.organizer;
        startView = a.startView;
        endView = a.endView;
        depositStart = a.depositStart;
        depositCutoff = a.depositCutoff;
        auctionStart = a.auctionStart;
        auctionEnd = a.auctionEnd;
        startingPriceVND = a.startingPriceVND;
        minIncrementVND = a.minIncrementVND;
        depositAmountVND = a.depositAmountVND;
        currentPriceVND = a.currentPriceVND;
        highestBidder = a.highestBidder;
        finalized = a.finalized;
        failed = a.failed;
        auctionDetailCID = a.auctionDetailCID;
    }

    function isWhitelistedBidder(uint256 auctionId, address bidder) external view returns (bool) {
        return isWhitelisted[auctionId][bidder];
    }

    /// @notice 0:PENDING, 1:ACTIVE, 2:ENDED, 3:FINALIZED, 4:FAILED
    function getStatus(uint256 auctionId) external view returns (uint8) {
        Auction storage a = auctions[auctionId];
        if (a.finalized) {
            return a.failed ? 4 : 3;
        }
        if (block.timestamp < a.auctionStart) return 0;
        if (block.timestamp < a.auctionEnd) return 1;
        return 2;
    }

    function getOrganizerAuctions(address organizer) external view returns (uint256[] memory) {
        return _organizerAuctions[organizer];
    }

    // ====== Helper: phiên bản contract ======
    function version() external pure returns (string memory) {
        return "DauGia_v1.0.0";
    }
}

