# 📑 Mô tả trang — daugia.vin

## 1. Trang chủ
- **Logo & tiêu đề:** `daugia.vin — Đấu giá minh bạch trên Blockchain`
- **Nút chính:**
  - 🔗 **Kết nối ví** (MetaMask, mạng VIC)
  - 📝 **Đăng ký**:  
    - Bất kỳ ai cũng có thể đăng ký.  
    - Khi bấm: ký ví, trả gas VIC + phí **1 USD bằng VIN**.  
    - Sau khi đăng ký: ví được quyền **tạo cuộc đấu giá**.

---

## 2. Tạo cuộc đấu giá
Sau khi đăng ký, ví sẽ thấy nút **“Tạo cuộc đấu giá”**.  

Khi bấm, hệ thống mở **mẫu chuẩn** để khai báo thông tin cuộc đấu giá:

1. **Thông tin đơn vị tổ chức**
   - Tên đơn vị (bắt buộc)  
   - Địa chỉ (tùy chọn)
   - Số điện thoại (tùy chọn)
   - Email (tùy chọn)  
   - Website (tùy chọn)  
   - Mã số thuế / Giấy phép ĐKKD (tùy chọn)

2. **Bên bán tài sản**
   - Tên đơn vị (bắt buộc)  
   - Địa chỉ (tùy chọn)
   - Số điện thoại (tùy chọn)
   - Email (tùy chọn)  
   - Website (tùy chọn)  
   - Mã số thuế / Giấy phép ĐKKD (tùy chọn)
     
3. **Mô tả tài sản**
   - Tiêu đề (≤200 ký tự)  
   - Mô tả chi tiết (tối đa 20.000 ký tự)  
   - Địa điểm tài sản  
   - Ảnh minh họa (IPFS URL/CID, tùy chọn)  
   - Tài liệu pháp lý (IPFS URL/CID, tùy chọn)

4. **Thời gian xem tài sản**: từ – đến (GMT+7)

5. **Thời gian nộp tiền đặt cọc**: từ – đến (GMT+7)

6. **Giá khởi điểm** (VND)

7. **Bước giá tối thiểu** (VND)

8. **Mức tiền đặt cọc** (VND)

9. **Hạn cuối cập nhật ví đã đặt cọc** (datetime GMT+7)

10. **Thông tin tài khoản nhận tiền đặt cọc**
    - Tên chủ tài khoản  
    - Số tài khoản ngân hàng  
    - Tên ngân hàng  
    - Nội dung chuyển khoản (mặc định: “Tên + địa chỉ ví VIC”)

11. **Thời gian phiên đấu giá**: ngày giờ **bắt đầu – kết thúc** (GMT+7)

➡️ Sau khi điền xong → bấm **Ký & Đăng**  
- MetaMask mở xác nhận.  
- Trả gas VIC + phí 1 USD VIN.  
- Hệ thống ghi dữ liệu **on-chain** + lưu chi tiết **IPFS**.  
- Cuộc đấu giá hiển thị công khai.

---

## 3. Sau khi tạo xong một cuộc đấu giá
Mỗi cuộc đấu giá hiển thị:

### Thông tin chung
- Tiêu đề & mô tả tài sản  
- Ảnh & tài liệu IPFS  
- Thông tin tổ chức & bên bán  

### Thời gian
- Khung xem tài sản  
- Khung nộp cọc  
- Phiên đấu giá (start–end)  
- Hạn cập nhật whitelist  
- Đồng hồ đếm ngược  

### Giá
- Giá khởi điểm  
- Bước giá  
- Mức tiền cọc  
- Giá hiện thời  
- Giá trúng (sau khi kết thúc)  

### Danh sách & trạng thái
- Danh sách ví đã cọc (whitelist)  
- Ví đang dẫn đầu  
- Ví trúng cuộc (sau khi kết thúc)  
- Lịch sử đặt giá (thời gian – ví – số tiền, log on-chain)  

### Nút chức năng
- **Người tham gia**:  
  - “Bỏ giá” (chỉ hoạt động khi ví thuộc whitelist + phiên ACTIVE)
- **Người tổ chức**:  
  - “Cập nhật ví đã đặt cọc” (chỉ organizer, đến cutoff)

---

## 4. Giao diện trang web khi người dùng chưa kết nối ví
- Thanh điều hướng phía trên để ghim các thành phần cần thiết  
- logo và câu slogan: Đấu giá minh bạch trên Blockchain
- Giá vin hiện theo USD (kiểu hiện 1 VIN = 23.45 USD)
- ô tìm kiếm và nút tìm bên cạnh: người dùng nhập thông tin cần tìm để tìm cuộc đấu giá mình quan tâm
- nút kết nối ví
- Màn hình chính là danh sách các cuộc đấu giá (nếu các cuộc đấu giá đã được tạo sẽ hiện)
- Thanh điều hướng phía chân trang để các link: hợp đồng thông minh đấu giá, hướng dẫn, vin token; swap vin/vic
---

## 5. giao diện trang web khi người dùng kết nối ví thanh công
- Thêm các yếu tố sau so với giao diện chưa kết nối
  - nút "đăng ký": nếu ví đó chưa đăng ký sẽ có nút đăng ký hiện ra; nếu ví đó đã đăng ký thì có nút "tạo cuộc đấu giá" nghĩa là kiểm tra ví đó chưa đăng ký thì nút đăng ký hiện ra họ đăng ký trả 1$ trả bằng vin thì có thông báo đăng ký thành công và khi đó có nút "tạo cuộc đấu giá" hiện ra.  
-   hiện địa chỉ ví, số dư vin, vic
- như vậy màn hình giao diện khi kết nối ví thành công sẽ có thêm thông tin ví, số dư vin, vic và nút kết nối thay bằng ngắt kết nối và nút "đăng ký" hiện ra; nếu ví đó đã đăngký thì nút "tạo cuộc đấu giá" sẽ hiện ra

---

## 6. Hành vi & thông báo
- Mọi thao tác (đăng ký, tạo cuộc đấu giá, cập nhật ví của người tham ra đấu giá đã đặt cọc, bỏ giá) → đều cần ký ví, trả gas VIC + phí 1 USD VIN.  
- **Luật bỏ giá:**  
  - Mức đặt giá ≥ (giá hiện tại + bước giá).  
- **Thông báo gợi ý:**
  - ⏳ Trước giờ: `Phiên đấu giá chưa bắt đầu.`  
  - ⏹ Sau giờ: `Cuộc đấu giá đã kết thúc.`  
  - 🚫 Không whitelist: `Ví của bạn chưa được xác nhận đặt cọc.`  
  - ⚠️ Sai giá: `Giá bạn đặt quá thấp. Tối thiểu: {minValidBid}.`  
  - ❌ Không ai tham gia: `Đấu giá thất bại, không có người tham gia.`  
  - ✅ Thành công: `Đặt giá thành công {bidAmount}. Bạn đang dẫn đầu.`

---

## 7. Minh bạch & tốc độ
- Whitelist, bid, kết quả → **log on-chain công khai**.  
- Không hạn chế spam / cooldown / anti-sniping.  
- Ai xác nhận giao dịch **trước** thì dẫn đầu.  
- UI mặc định gợi ý **Max gas speed** khi gửi bid.

---

## ✅ Tóm tắt
- **Đăng ký**: ai cũng có thể, 1 USD VIN.  
- **Tạo phiên**: điền mẫu chuẩn → ký & đăng → công bố on-chain.  
- **Chi tiết phiên**: minh bạch thông tin, giá, ví đã cọc, lịch sử bid.  
- **Tham gia**: chỉ ví đã cọc được bỏ giá.  
- **Kết thúc**: công bố ví thắng + giá trúng, hoặc thất bại nếu không ai tham gia.  

như vậy khi người dùng đã đăng ký thì sẽ có nút "tạo cuộc đấu giá" họ bấm nút này một mẫu chuẩn sẽ hiện ra họ khai báo xong bấm nút đăng gọi ký ví thì cuộc đấu giá sẽ hiện ra và ai cũng có thể xem và đọc được. dưới mỗi cuộc đấu giá sẽ có 2 nút là "bỏ giá" dành cho người đã đặt cọc và nút "cập nhật ví của người đã cọc" nút này dành cho người tạo cuộc đấu giá để cập nhật ví cho người đã đặt cọc. người dùng chỉ bấm được nút bỏ giá khi người tạo cuộc đấu giá cập nhật ví của họ lên.
