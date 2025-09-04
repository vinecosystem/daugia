# daugia.vin — Bản mô tả sản phẩm (Product Spec)

> **Mục tiêu:** Nền tảng đấu giá **minh bạch – công bằng – đơn giản** cho người Việt, chạy hoàn toàn bằng **smart contract trên Viction (VIC)**.  
> **Nguyên tắc:** Nền tảng **không thu/giữ tiền đặt cọc** hay **tiền bán tài sản**. Chỉ cung cấp cơ chế tổ chức một phiên đấu giá minh bạch (tạo phiên, danh sách ví đã cọc, bỏ giá, chốt phiên).

---

## 1) Sản phẩm trông như thế nào sau khi hoàn thành?

### 1.1. Khi **chưa kết nối ví**
- **Header** (trên cùng):
  - **Logo + Slogan** bên trái: `daugia.vin — minh bạch trên blockchain`.
  - Bên phải có nút **“Kết nối ví”** và một chip nhỏ hiển thị **`1 VIN ≈ X.XX USD`** (làm tròn 2 số thập phân).
- **Thanh tìm kiếm** kiểu Google:
  - 1 ô nhập từ khóa (tìm theo **mô tả ngắn** hoặc **địa chỉ ví tổ chức**).
  - Nhấn **Enter** để tìm, có nút **X** để xóa từ khóa. Có thể có bộ lọc nhanh: *Chưa diễn ra / Đang diễn ra / Đã kết thúc*.
- **Danh sách cuộc đấu giá** (bố cục **1 cột** cả trên máy tính & điện thoại):
  - Mỗi cuộc đấu giá là một **thẻ (card)** cao, hiển thị:
    - **Mô tả ngắn (≤ 280 ký tự)** và nút **“Chi tiết”** để mở rộng.
    - Khi mở chi tiết:
      - **Khối nội dung** (trái): trích đoạn *Thông báo đấu giá* (kèm nút **“Mở toàn văn”** đi đến liên kết tài liệu).
      - **Khối thông tin** (phải): *Thời gian đấu giá*, *Hạn cập nhật ví đã cọc*, *Giá khởi điểm*, *Bước giá*, *Danh sách ví đã cọc* (hiển thị rút gọn, có nút **Xem thêm**).
    - **Thanh trạng thái**: *Chưa diễn ra* / *Đang diễn ra* / *Đã kết thúc* / *Đã chốt*; kèm **Giá hiện thời** và **Ví đang dẫn** (nếu có).
    - **Nút dưới cùng** (ai cũng thấy): **“Tham gia”** (chuyển sang chế độ chỉ xem phiên đó) và **“Trở về danh sách”**.
- **Footer** (cuối trang):
  - Liên kết: **Hợp đồng đấu giá**, **VIN Token**, **Swap VIN/VIC**, **Hướng dẫn**.
  - Dòng tuyên bố ngắn gọn:  
    > ⚖️ Giao diện phi tập trung — mọi logic & quỹ do smart contract trên **Viction** kiểm soát.  
    > Nền tảng **không thu tiền cọc** và **không giữ tiền bán tài sản**; chỉ tạo cơ chế đấu giá **minh bạch & công bằng**.

### 1.2. Khi **đã kết nối ví**
- **Header**:
  - Thay nút “Kết nối ví” bằng **địa chỉ ví rút gọn** và **số dư**: `VIN` và `VIC` (làm tròn 4 số thập phân, ví dụ `1.0001`).
  - Nếu ví **chưa đăng ký**: hiện nút **“Đăng ký (0.001 VIN)”**.  
    Nếu ví **đã đăng ký**: hiện nút **“Tạo cuộc đấu giá”**.
- **Trong mỗi card cuộc đấu giá**:
  - Nếu **chủ phiên** (ví tạo phiên) và **trước hạn cutoff** → thấy nút **“Cập nhật ví đã cọc”**.
  - Nếu **ví của bạn có trong whitelist** và **phiên đang diễn ra** → thấy nút **“Bỏ giá”** (nhập số VND, UI sẽ hiển thị *Giá tối thiểu hợp lệ kế tiếp*).
  - Sau khi **chốt phiên** → hiển thị **Ví trúng** & **Giá trúng**.

---

## 2) Hành trình người dùng (3 phút là hiểu)

1. **Xem danh sách** (không cần ví) → bấm **Chi tiết** để xem tài liệu gốc: *Thông báo đấu giá* & *Quy chế đấu giá*.
2. **Kết nối ví**:
   - Nếu **chưa đăng ký**: bấm **Đăng ký (0.001 VIN)** → từ nay ví này được phép tạo phiên/thao tác.
   - Nếu **đã đăng ký**: có nút **Tạo cuộc đấu giá**.
3. **Tạo cuộc đấu giá** (7 trường nhập – 6 bắt buộc):
   - **Mô tả ngắn** (≤ 280 ký tự) — *bắt buộc*.
   - **Thông báo đấu giá – `thongBaoUrl`** — *bắt buộc* (link tài liệu; để trên Pinata/Pitana).
   - **Quy chế đấu giá – `quiCheUrl`** — *bắt buộc* (link tài liệu).
   - **Thời gian đấu giá** (bắt đầu & kết thúc) — *bắt buộc* (UI nhập `dd/mm/yyyy` + giờ 24h).
   - **Hạn cập nhật ví đã cọc** (*whitelist cutoff*) — *bắt buộc* (sau mốc này **khóa** cập nhật danh sách ví).
   - **Giá khởi điểm (VND)** — *bắt buộc* (UI hiển thị `100.000.000` thay vì `100000000`).
   - **Bước giá (VND)** — *bắt buộc*.
   - Bấm **Đăng** → ký ví & thu **0.001 VIN** → phiên xuất hiện trong danh sách.
4. **Cập nhật ví đã cọc** (chủ phiên, *trước cutoff*): thêm/bớt địa chỉ ví → đảm bảo chỉ người đã cọc mới có nút **Bỏ giá**.
5. **Bỏ giá** (chỉ ví trong whitelist, *khi phiên đang diễn ra*):
   - Quy tắc: **Giá mới ≥ Giá hiện thời + Bước giá**.
   - Nếu 2 người “nhập cùng 1 giá”, giao dịch nào vào blockchain **trước** sẽ **thắng**; giao dịch đến **sau** sẽ **bị từ chối** (chuẩn on-chain).
6. **Chốt phiên** (*finalize*, ai cũng bấm được, **không thu phí**):
   - Nếu có bỏ giá hợp lệ → công bố **Ví trúng** & **Giá trúng**.
   - Nếu **không có bỏ giá** → phiên **thất bại**.

---

## 3) Quy tắc rõ ràng (để không tranh luận lại)

- **Phí nền tảng**: **0.001 VIN** cho 4 hành động thay đổi trạng thái:
  1) Đăng ký (mỗi ví **chỉ 1 lần**), 2) Tạo phiên, 3) Cập nhật whitelist, 4) Bỏ giá.  
  **Finalize** miễn phí để khuyến khích chốt.
- **Ví nhận phí**: **ví deployer** (nhận trực tiếp), **không thay đổi**.
- **Đơn vị đấu giá**: **VND (đồng)** → lưu **số nguyên**, **không** có thập phân.
- **Thời gian** (UI `dd/mm/yyyy` + 24h, contract lưu epoch giây):  
  `now < whitelistCutoff ≤ auctionStart < auctionEnd`
- **Tài liệu**: `thongBaoUrl` & `quiCheUrl` là **bắt buộc** và **bất biến** sau khi tạo (đảm bảo minh bạch).
- **Whitelist**: chỉ **chủ phiên** cập nhật, **trước cutoff**; có thể *add/remove* để sửa sai, sau cutoff **khóa vĩnh viễn**.
- **Bỏ giá**: chỉ trong khoảng **[start, end)** và chỉ cho ví trong whitelist.
- **Hiển thị VIN≈USD**: chỉ là **thông tin tham khảo** (lấy VIC/USDT×100), **không** ảnh hưởng on-chain.

---

## 4) Những gì **không** làm (phạm vi ngoài sản phẩm)
- Không thu/giữ tiền đặt cọc hay tiền bán tài sản.
- Không xử lý thanh toán/hoàn tiền/ủy nhiệm chi.
- Không cho phép sửa **tài liệu gốc** sau khi tạo phiên (nếu cần, có thể thêm tài liệu đính chính ở tương lai; bản gốc vẫn giữ nguyên).

---

## 5) Từ ngữ dễ hiểu
- **Whitelist**: Danh sách ví **được phép** bỏ giá (đã đặt cọc theo quy chế; nền tảng chỉ ghi nhận do **chủ phiên** cập nhật).
- **Cutoff**: Hạn chót **khóa** cập nhật whitelist để đảm bảo minh bạch trước giờ đấu giá.
- **Finalize** (*chốt phiên*): Công bố kết quả sau khi kết thúc thời gian đấu giá.

---

## 6) Yêu cầu kỹ thuật cốt lõi (dev đọc là code được ngay)

### 6.1. Chuỗi & token
- **Network**: Viction Mainnet, Chain ID `88`, RPC `https://rpc.viction.xyz`, Explorer `https://vicscan.xyz`.
- **VIN** (token phí): `0x941F63807401efCE8afe3C9d88d368bAA287Fac4`, **decimals 18**.
- **VIC** (gas): **decimals 18**.

### 6.2. Hợp đồng (tên dự kiến `DauGia`)
- **Phí VIN mỗi hành động**: `FEE = 0.001 * 10^18`.
- **feeReceiver**: địa chỉ deployer (bất biến).
- **Cấu trúc phiên** (tóm lược):
```solidity
struct Auction {
  address organizer;
  string  summary;           // ≤ 280 ký tự
  string  thongBaoUrl;       // ≤ 512 ký tự, bất biến
  string  quiCheUrl;         // ≤ 512 ký tự, bất biến
  uint40  whitelistCutoff;   // epoch seconds
  uint40  auctionStart;      // epoch seconds
  uint40  auctionEnd;        // epoch seconds
  uint128 startPriceVND;     // VND
  uint128 stepVND;           // VND
  uint128 currentPriceVND;   // VND
  address currentLeader;     // ví đang dẫn
  bool    finalized;         // đã chốt
  bool    success;           // có người thắng hay thất bại
}
````

**Hàm ghi:**

* `register()` — thu **0.001 VIN** (mỗi ví **1 lần**).
* `createAuction(AuctionInit)` — thu **0.001 VIN**.
* `updateWhitelist(uint256 id, address[] addrs, address[] removes)` — thu **0.001 VIN**; chỉ **organizer**; chỉ **trước cutoff**; giới hạn **≤ 200** địa chỉ/lần để an toàn gas.
* `placeBid(uint256 id, uint128 amountVND)` — thu **0.001 VIN**; chỉ **whitelist**; chỉ trong **\[start, end)**; điều kiện `amountVND ≥ currentPrice + step`.
* `finalize(uint256 id)` — **miễn phí**; ai cũng gọi được sau `auctionEnd`.

**Hàm view/UI:**

* `isRegistered(address user) → bool`
* `getAuction(uint256 id) → Auction`
* `isWhitelisted(uint256 id, address user) → bool`
* `getMinNextBid(uint256 id) → uint128` (trả về `currentPrice + step`, hoặc `startPrice` nếu chưa có bid)
* `getStatus(uint256 id) → uint8` (`0: NotStarted, 1: Live, 2: Ended, 3: Finalized`)

**Sự kiện:**

```solidity
event Registered(address user);
event AuctionCreated(
  uint256 indexed id, address indexed organizer,
  uint40 whitelistCutoff, uint40 start, uint40 end,
  uint128 startPriceVND, uint128 stepVND,
  string thongBaoUrl, string quiCheUrl
);
event WhitelistUpdated(uint256 indexed id, address[] added, address[] removed);
event BidPlaced(uint256 indexed id, address indexed bidder, uint128 amountVND, uint40 ts);
event Finalized(uint256 indexed id, address winner, uint128 priceVND, uint40 ts, bool success);
```

**Ràng buộc/lỗi (gợi ý):**

* Thời gian: `InvalidSchedule`, `WhitelistClosed`
* Phí VIN: `FeeNotPaid` (thiếu/allowance không đủ)
* Bỏ giá: `BidTooLow`, `NotWhitelisted`, `NotLive`
* Đã chốt: `FinalizedAlready`
* Sửa tài liệu: `ImmutableDocs`

### 6.3. Frontend (3 file tĩnh)

* **`index.html`** — giao diện & bố cục 1 cột, responsive.
* **`style.css`** — tối giản, chữ rõ, nút lớn, dễ bấm trên mobile.
* **`app.js`** — dùng `ethers.js`; logic:

  * Kết nối ví, lấy số dư VIN/VIC (hiển thị 4 số thập phân).
  * Lấy **VIC/USDT** từ **Binance API**, nhân 100 → hiển thị `1 VIN ≈ X.XX USD`.
  * Tìm kiếm kiểu Google (lọc theo từ khóa + trạng thái).
  * Hiển thị danh sách phiên, trạng thái, nút theo vai trò.
  * Trước 4 hành động ký ví (**đăng ký / tạo phiên / cập nhật whitelist / bỏ giá**):

    * Đảm bảo `approve` VIN đủ **0.001 VIN**.
    * **Gas policy “mượt”**: `gasLimit = estimateGas × 2.0` (fallback cao); nếu EIP-1559, cộng \~**+25%** `maxFeePerGas` và `maxPriorityFeePerGas`.
  * Trước khi ký **bỏ giá**: gọi `getMinNextBid()` để disable nút nếu < mức tối thiểu.

---

## 7) Kiểm thử & chấp nhận (Acceptance Checklist)

* [ ] Tạo phiên hợp lệ (đủ 7 trường, 2 URL bắt buộc; ràng buộc thời gian đúng).
* [ ] Cập nhật whitelist *trước cutoff* (thêm/bớt), *sau cutoff* bị khóa.
* [ ] Bỏ giá:

  * [ ] Giá đủ điều kiện (≥ min) → **thành công**.
  * [ ] Giá thấp hơn min → **bị từ chối** (thông báo rõ).
  * [ ] Hai giao dịch “cùng giá” → giao dịch vào **trước** thắng; giao dịch vào sau **bị từ chối**.
* [ ] Chốt phiên (`finalize`):

  * [ ] Có bid → hiển thị **Ví trúng** & **Giá trúng**.
  * [ ] Không có bid → phiên **thất bại**.
* [ ] Giao diện:

  * [ ] Danh sách 1 cột (desktop & mobile), nội dung dài đọc thoải mái.
  * [ ] Tìm kiếm kiểu Google hoạt động mượt.
  * [ ] Header hiển thị đúng số dư & giá VIN≈USD.
  * [ ] Nút theo vai trò hiển thị đúng (Đăng ký/Tạo phiên/Cập nhật ví đã cọc/Bỏ giá).
* [ ] Phí:

  * [ ] 4 hành động đều thu **0.001 VIN** về ví deployer.
  * [ ] `finalize` không thu phí.
* [ ] Không có đường tắt để sửa **thông báo/quy chế** sau khi tạo.

---

## 8) Cách phối hợp triển khai (bạn không cần biết code)

1. Bạn thuê **AWS (Ubuntu)**.
2. Mình gửi **từng lệnh một** (cài Node/Hardhat, cấu hình `.env`, deploy, verify…).

   * Bạn chạy lệnh → **chụp màn hình** trả lại → mình đưa **lệnh tiếp theo**.
3. Sau khi deploy & verify xong, mình bàn giao **ABI.json** và lần lượt 3 file **`index.html`** → **`style.css`** → **`app.js`** (mỗi lần một file để bạn copy).
4. Bạn đẩy lên GitHub Pages trỏ domain **daugia.vin** → **sử dụng ngay**.

---

## 9) Ghi chú cuối

* **Ngôn ngữ UI**: 100% **Tiếng Việt**.
* **Định dạng thời gian UI**: 24h; **dd/mm/yyyy**.
* **Độ dài**: `summary ≤ 280` ký tự; URL ≤ `512` ký tự.
* **VIN & VIC** đều **18 thập phân**. VND lưu **số nguyên** (không thập phân).

