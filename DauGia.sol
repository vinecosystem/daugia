/ SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * DauGia.vin — Hợp đồng đấu giá minh bạch cho người Việt trên Viction.
 * - Không thu/giữ tiền cọc hay tiền bán tài sản.
 * - Thu phí nền tảng 0.001 VIN cho các hành động: register/create/updateWhitelist/placeBid (finalize miễn phí).
 * - Giá đấu & bước giá dùng VND (đồng) — số nguyên, không thập phân.
 * - Tài liệu (thongBaoUrl, quiCheUrl) là bắt buộc và bất biến sau khi tạo.
 */
contract DauGia {
    // ====== Lỗi tuỳ chỉnh (gas-efficient) ======
    error NotRegistered();
    error InvalidSchedule();
    error ImmutableDocs();
    error NotOrganizer();
    error WhitelistClosed();
    error NotLive();
    error FinalizedAlready();
    error NotWhitelisted();
    error BidTooLow();
    error FeeNotPaid();

    // ====== Sự kiện ======
    event Registered(address indexed user);
    event AuctionCreated(
        uint256 indexed id,
        address indexed organizer,
        uint40 whitelistCutoff,
        uint40 start,
        uint40 end,
        uint128 startPriceVND,
        uint128 stepVND,
        string thongBaoUrl,
        string quiCheUrl
    );
    event WhitelistUpdated(uint256 indexed id, address[] added, address[] removed);
    event BidPlaced(uint256 indexed id, address indexed bidder, uint128 amountVND, uint40 ts);
    event Finalized(uint256 indexed id, address winner, uint128 priceVND, uint40 ts, bool success);

    // ====== Tham số hệ thống ======
    // VIN token (18 decimals) — địa chỉ cố định trên Viction mainnet
    IERC20 public constant VIN = IERC20(0x941F63807401efCE8afe3C9d88d368bAA287Fac4);
    // Phí 0.001 VIN = 1e15 wei (VIN)
    uint256 public constant FEE = 1e15;

    address public immutable feeReceiver; // ví deployer nhận phí VIN

    // ====== Kiểu dữ liệu ======
    struct Auction {
        address organizer;
        string  summary;           // ≤ 280 bytes (UI chịu trách nhiệm validate ký tự)
        string  thongBaoUrl;       // ≤ 512 bytes, bất biến
        string  quiCheUrl;         // ≤ 512 bytes, bất biến
        uint40  whitelistCutoff;   // epoch seconds
        uint40  auctionStart;      // epoch seconds
        uint40  auctionEnd;        // epoch seconds
        uint128 startPriceVND;     // VND (số nguyên)
        uint128 stepVND;           // VND (số nguyên)
        uint128 currentPriceVND;   // VND (số nguyên)
        address currentLeader;     // ví đang dẫn (address(0) nếu chưa có)
        bool    finalized;         // đã chốt chưa
        bool    success;           // true nếu có người thắng khi finalize
    }

    struct AuctionInit {
        string  summary;
        string  thongBaoUrl;
        string  quiCheUrl;
        uint40  whitelistCutoff;
        uint40  auctionStart;
        uint40  auctionEnd;
        uint128 startPriceVND;
        uint128 stepVND;
    }

    // ====== Trạng thái ======
    uint256 public auctionCount;
    mapping(uint256 => Auction) private _auctions;

    // Whitelist: mapping + mảng + index để add/remove O(1)
    mapping(uint256 => mapping(address => bool)) private _isWhitelisted;
    mapping(uint256 => address[]) private _whitelistList;
    mapping(uint256 => mapping(address => uint256)) private _whitelistIndexPlus1;

    mapping(address => bool) public isRegistered;

    // ====== Khởi tạo ======
    constructor() {
        feeReceiver = msg.sender;
    }

    // ====== Modifiers ======
    modifier onlyOrganizer(uint256 id) {
        if (_auctions[id].organizer != msg.sender) revert NotOrganizer();
        _;
    }

    // ====== Hàm nội bộ ======
    function _collectFee(address payer) internal {
        // Yêu cầu người gọi đã approve đủ VIN trước trên frontend
        bool ok = VIN.transferFrom(payer, feeReceiver, FEE);
        if (!ok) revert FeeNotPaid();
    }

    function _addWhitelist(uint256 id, address a) internal {
        if (_isWhitelisted[id][a]) return;
        _isWhitelisted[id][a] = true;
        _whitelistList[id].push(a);
        _whitelistIndexPlus1[id][a] = _whitelistList[id].length; // index+1
    }

    function _removeWhitelist(uint256 id, address a) internal {
        if (!_isWhitelisted[id][a]) return;
        _isWhitelisted[id][a] = false;

        uint256 idxPlus1 = _whitelistIndexPlus1[id][a];
        if (idxPlus1 != 0) {
            uint256 idx = idxPlus1 - 1;
            uint256 last = _whitelistList[id].length - 1;
            if (idx != last) {
                address lastAddr = _whitelistList[id][last];
                _whitelistList[id][idx] = lastAddr;
                _whitelistIndexPlus1[id][lastAddr] = idx + 1;
            }
            _whitelistList[id].pop();
            _whitelistIndexPlus1[id][a] = 0;
        }
    }

    // ====== API công khai ======

    // Đăng ký (mỗi ví 1 lần) — thu 0.001 VIN
    function register() external {
        if (isRegistered[msg.sender]) revert();
        _collectFee(msg.sender);
        isRegistered[msg.sender] = true;
        emit Registered(msg.sender);
    }

    // Tạo cuộc đấu giá — thu 0.001 VIN
    function createAuction(AuctionInit calldata a) external returns (uint256 id) {
        if (!isRegistered[msg.sender]) revert NotRegistered();

        // Ràng buộc thời gian: now < cutoff ≤ start < end
        uint40 nowTs = uint40(block.timestamp);
        if (!(nowTs < a.whitelistCutoff && a.whitelistCutoff <= a.auctionStart && a.auctionStart < a.auctionEnd)) {
            revert InvalidSchedule();
        }
        // Ràng buộc giá
        require(a.startPriceVND > 0 && a.stepVND > 0, "InvalidPrice");

        // Tài liệu bất biến phải có
        require(bytes(a.thongBaoUrl).length > 0 && bytes(a.quiCheUrl).length > 0, "DocsRequired");

        _collectFee(msg.sender);

        id = ++auctionCount;
        Auction storage s = _auctions[id];
        s.organizer        = msg.sender;
        s.summary          = a.summary;
        s.thongBaoUrl      = a.thongBaoUrl;
        s.quiCheUrl        = a.quiCheUrl;
        s.whitelistCutoff  = a.whitelistCutoff;
        s.auctionStart     = a.auctionStart;
        s.auctionEnd       = a.auctionEnd;
        s.startPriceVND    = a.startPriceVND;
        s.stepVND          = a.stepVND;
        // currentPriceVND = 0; currentLeader = address(0); finalized=false; success=false

        emit AuctionCreated(
            id, msg.sender,
            a.whitelistCutoff, a.auctionStart, a.auctionEnd,
            a.startPriceVND, a.stepVND, a.thongBaoUrl, a.quiCheUrl
        );
    }

    // Cập nhật whitelist (trước cutoff) — thu 0.001 VIN
    function updateWhitelist(uint256 id, address[] calldata addrs, address[] calldata removes)
        external
        onlyOrganizer(id)
    {
        Auction storage s = _auctions[id];
        if (uint40(block.timestamp) >= s.whitelistCutoff) revert WhitelistClosed();

        // Giới hạn an toàn gas: tối đa 200 địa chỉ mỗi lần (gợi ý)
        require(addrs.length <= 200 && removes.length <= 200, "TooMany");

        _collectFee(msg.sender);

        for (uint256 i = 0; i < addrs.length; i++) {
            _addWhitelist(id, addrs[i]);
        }
        for (uint256 j = 0; j < removes.length; j++) {
            _removeWhitelist(id, removes[j]);
        }
        emit WhitelistUpdated(id, addrs, removes);
    }

    // Bỏ giá (chỉ whitelist, trong [start,end)) — thu 0.001 VIN
    function placeBid(uint256 id, uint128 amountVND) external {
        Auction storage s = _auctions[id];

        uint40 nowTs = uint40(block.timestamp);
        if (!(nowTs >= s.auctionStart && nowTs < s.auctionEnd)) revert NotLive();
        if (!_isWhitelisted[id][msg.sender]) revert NotWhitelisted();

        uint128 minNext = getMinNextBid(id);
        if (amountVND < minNext) revert BidTooLow();

        _collectFee(msg.sender);

        s.currentPriceVND = amountVND;
        s.currentLeader = msg.sender;

        emit BidPlaced(id, msg.sender, amountVND, uint40(block.timestamp));
    }

    // Chốt phiên (ai cũng gọi được, miễn phí), sau auctionEnd
    function finalize(uint256 id) external {
        Auction storage s = _auctions[id];
        if (s.finalized) revert FinalizedAlready();
        if (uint40(block.timestamp) < s.auctionEnd) revert NotLive(); // tái dùng NotLive cho "chưa đến giờ chốt"

        s.finalized = true;
        if (s.currentLeader != address(0)) {
            s.success = true;
        } else {
            s.success = false;
        }
        emit Finalized(id, s.currentLeader, s.currentPriceVND, uint40(block.timestamp), s.success);
    }

    // ====== View helpers ======

    // Lấy thông tin phiên
    function getAuction(uint256 id) external view returns (Auction memory) {
        return _auctions[id];
    }

    // Kiểm tra 1 ví trong whitelist
    function isWhitelisted(uint256 id, address user) external view returns (bool) {
        return _isWhitelisted[id][user];
    }

    // Trả về mức giá tối thiểu hợp lệ kế tiếp
    function getMinNextBid(uint256 id) public view returns (uint128) {
        Auction storage s = _auctions[id];
        if (s.currentLeader == address(0)) {
            return s.startPriceVND;
        } else {
            unchecked {
                return s.currentPriceVND + s.stepVND;
            }
        }
    }

    // 0: NotStarted, 1: Live, 2: Ended, 3: Finalized
    function getStatus(uint256 id) external view returns (uint8) {
        Auction storage s = _auctions[id];
        if (s.finalized) return 3;
        uint40 nowTs = uint40(block.timestamp);
        if (nowTs < s.auctionStart) return 0;
        if (nowTs >= s.auctionEnd) return 2;
        return 1;
    }

    // Lấy danh sách whitelist (có thể dài; dùng chủ yếu cho UI nhỏ/lọc trang)
    function getWhitelist(uint256 id) external view returns (address[] memory) {
        return _whitelistList[id];
    }
}
