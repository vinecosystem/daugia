# Hướng dẫn sử dụng nền tảng **Daugia.vin**

**daugia.vin** là nền tảng đấu giá **minh bạch** trên blockchain **Viction** (EVM, chainId 88), giúp các tổ chức và cá nhân tạo và tham gia đấu giá **công bằng, minh bạch** mà không cần phải lo lắng về việc kiểm toán hay chứng minh tính minh bạch.

Mọi quy tắc, tiền đặt cọc, và kết quả đấu giá đều được **hợp đồng thông minh** trên blockchain điều khiển. Nền tảng **daugia.vin** không cần **bên thứ ba giám sát**, không giữ tiền bán tài sản hay tiền đặt cọc, mà chỉ cung cấp một cơ chế đấu giá minh bạch.

---

## 1) Khái niệm cơ bản

- **VIC**: đồng tiền gốc (native coin) của mạng **Viction**, dùng để **trả phí gas** khi ký giao dịch trên mạng blockchain này.
- **VIN**: token **ERC-20** trên **Viction** (18 chữ số thập phân), dùng để trả phí nền tảng **0.001 VIN** cho các thao tác như đăng ký, tạo phiên đấu giá, cập nhật whitelist và bỏ giá.
- **Ví MetaMask**: là ví điện tử giúp bạn lưu trữ **private key** (chìa khoá riêng), thực hiện ký giao dịch và tương tác với các hợp đồng thông minh trên blockchain. Khuyến nghị sử dụng **MetaMask** trên **trình duyệt** hoặc **ứng dụng điện thoại**.

---

## 2) Chuẩn bị ví (MetaMask)

### 2.1 Cài đặt MetaMask
Để sử dụng **daugia.vin**, bạn cần cài đặt ví **MetaMask**:
- **Máy tính**: Cài tiện ích mở rộng **MetaMask** cho **Chrome**, **Brave** hoặc **Edge**.
- **Điện thoại**: Cài ứng dụng **MetaMask** trên **iOS** hoặc **Android**.

### 2.2 Tạo ví mới
1. Mở **MetaMask** → chọn **Tạo ví mới**.
2. Đặt mật khẩu **mạnh** cho ứng dụng.
3. **Ghi lại 12/24 từ khoá bảo mật** (Seed Phrase). Đây là cách duy nhất để khôi phục ví, **không chụp ảnh**, **không lưu trên cloud**.
4. Xác nhận lại thứ tự từ khoá, hoàn tất.

### 2.3 Nhập lại ví đã có
Nếu bạn đã có ví MetaMask, bạn có thể nhập ví bằng cách:
1. Chọn **Import wallet** → nhập **12/24 từ khoá bảo mật** theo đúng thứ tự.
2. Đặt mật khẩu cho ứng dụng mới.

> **Lưu ý quan trọng**: Không chia sẻ **Seed Phrase** với bất kỳ ai, và không nhập vào trang web không đáng tin cậy.

### 2.4 Bảo mật & kế hoạch thừa kế ví
- **Không ai ngoài bạn** được phép biết **Seed Phrase** của ví khi bạn còn sống.
- Gợi ý cách bảo mật:
  - **Viết seed phrase vào sổ giấy/thép** và **niêm phong** để trong **két sắt**.
  - **Chia đôi seed phrase** và giữ ở các địa điểm khác nhau, chỉ người thân sau khi bạn qua đời mới có thể tìm thấy và ghép lại.
  - Đảm bảo **không chia sẻ Seed Phrase qua chat, email**.

---

## 3) Thêm mạng Viction và token VIN vào ví MetaMask

### 3.1 Thêm mạng Viction
1. Mở **MetaMask** → chọn **Cài đặt** → **Mạng** → **Thêm mạng**.
2. Nhập thông tin sau:
   - **Tên mạng**: Viction Mainnet
   - **URL RPC**: `https://rpc.viction.xyz`
   - **Chain ID**: `88`
   - **Ký hiệu đồng tiền**: `VIC`
   - **Explorer**: `https://vicscan.xyz`
   
Lưu lại và chọn **Viction** khi kết nối với dApp.

### 3.2 Thêm token VIN
1. Vào **MetaMask** → **Import Tokens** → **Custom Token**.
2. Nhập thông tin token VIN:
   - **Địa chỉ token**: `0x941F63807401efCE8afe3C9d88d368bAA287Fac4`
   - **Biểu tượng**: `VIN`
   - **Số thập phân**: `18`
3. Bấm **Add Token** để thêm vào ví.

---

## 4) Mua và nạp VIC, VIN

### 4.1 Mua VIC và VIN
- **Mua VIC**: Bạn có thể mua VIC trên các sàn giao dịch như **Binance** hoặc **MEXC**.
- **Mua VIN**: Bạn bạn có VIC trong ví bấm link swap vin/vic trên nền tảng để đổi vic lấy vin ngay trên ví.

### 4.2 Rút VIC về ví MetaMask
Sau khi mua VIC, bạn cần **rút** về ví MetaMask để sử dụng:
1. Tại **Binance/MEXC** → chọn **Rút tiền**.
2. Chọn **mạng Viction** (VIC) và nhập **địa chỉ ví MetaMask**.
3. **Xác nhận** và kiểm tra **số dư VIC** trong MetaMask.

---

## 5) Sử dụng **daugia.vin**

### 5.1 Kết nối ví
1. Truy cập **daugia.vin** trên trình duyệt.
2. Bấm **Kết nối ví**, chọn **MetaMask** và cho phép **kết nối**.

### 5.2 Đăng ký
- Sau khi kết nối ví, bấm **Đăng ký** (một lần duy nhất) để hệ thống yêu cầu **ký giao dịch** và thu phí **0.001 VIN**.

### 5.3 Tạo cuộc đấu giá
1. Bấm **Tạo cuộc đấu giá**.
2. Điền thông tin:
   - **Mô tả tài sản** (≤ 280 ký tự).
   - **Link Thông báo** (bắt buộc), **Link Quy chế** (bắt buộc): tạo tài khoản miễn phí trên https://pinata.cloud (miễn phí) sau đó soạn thông báo đấu giá, qui chế đấu giá thành file pdf cập nhật file lấy link dán vào.
   - **Thời gian** đấu giá: **Bắt đầu** và **Kết thúc** (định dạng 24h, GMT+7).
   - **Giá khởi điểm** và **Bước giá** (đồng).
3. Ký giao dịch và **nộp phí**.

### 5.4 Cập nhật danh sách ví đã đặt cọc
- Bấm **Cập nhật ví đã đặt cọc** để thêm ví cho người đã đặt cọc, khi đó ví của họ mới hiện nút bỏ giá để tham gia đấu giá  
- Ký giao dịch và thu **0.001 VIN**.

### 5.5 Bỏ giá
- Khi cuộc đấu giá bắt đầu, bạn có thể **bỏ giá** nếu ví của bạn có trong whitelist và chưa hết thời gian.
- Mỗi lần bỏ giá, bạn phải **đặt giá cao hơn giá hiện tại** (theo bước giá).
- Mức giá hợp lệ:
   - Nếu **chưa có người dẫn**: >= **Giá khởi điểm**.
   - Nếu **đã có người dẫn**: >= **(Giá hiện tại + Bước giá)**.

### 5.6 Chốt phiên
- Sau khi đấu giá kết thúc, người tổ chức hoặc bất kỳ ai cũng có thể **chốt phiên**.
- **Chốt phiên** không thu phí **0.001 VIN** (chỉ phí gas VIC).

---

## 6) Lỗi thường gặp & cách xử lý

- **“Request already pending”**: Nếu ví báo lỗi khi thao tác, mở ứng dụng **MetaMask**, xử lý yêu cầu chờ và thử lại.  
- **“InvalidSchedule”**: Kiểm tra thời gian nhập có đúng không (theo múi giờ GMT+7).  
- **“BidTooLow”**: Giá bỏ thấp hơn mức tối thiểu (giá khởi điểm hoặc giá hiện tại + bước giá).  
- **“FeeNotPaid”**: Bạn cần đảm bảo ví MetaMask đã **approve** 0.001 VIN trước khi thực hiện thao tác.

---

## 7) Các câu hỏi thường gặp (FAQ)

**Q: Vì sao phải dùng 2 đồng tiền VIC và VIN?**  
A: **VIC** là phí gas (dùng để ký giao dịch trên blockchain Viction), còn **VIN** là phí nền tảng (dùng để trả phí cho hệ thống khi thực hiện các hành động như đăng ký, tạo phiên, bỏ giá).

**Q: Hai người có thể cùng một mức giá?**  
A: Không, nếu có hai người cùng bỏ giá, người bỏ giá **trước** sẽ trở thành người dẫn đầu.

**Q: Tài liệu (Thông báo/Quy chế) có sửa được không?**  
A: Không. Sau khi tạo phiên đấu giá, thông báo và quy chế **không thể sửa đổi** nữa để đảm bảo tính minh bạch.

**Q: Tốc độ giao dịch bỏ thế nào? có bị nghẽn không**  
A: Mạng vic phí gas vô cùng rẻ chỉ 0.0001 vic và tốc độ không quá 15 giây hoàn thành giao dịch bỏ giá.

---

## 8) Lưu ý pháp lý
- Bạn cần **tuân thủ các quy định pháp lý** của Việt Nam và những yêu cầu liên quan đến tiền mã hoá khi sử dụng nền tảng **daugia.vin**.
- Mọi giao dịch liên quan đến tiền mã hoá đều có **rủi ro**. Bạn cần **tự chịu trách nhiệm** đối với quyết định của mình.

---

Chúc bạn sử dụng nền tảng **daugia.vin** thành công và có những trải nghiệm đấu giá minh bạch, công bằng, và dễ sử dụng.
