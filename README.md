# Mô Tả Chi Tiết Nền Tảng DauGia.vin

**daugia.vin** là nền tảng đấu giá minh bạch và công bằng, phục vụ người dùng tại Việt Nam, sử dụng công nghệ blockchain **Viction (VIC)**. Mục tiêu của nền tảng là tạo ra các cuộc đấu giá minh bạch, nơi thông tin được công khai và không có sự can thiệp của bất kỳ tổ chức trung gian nào. Nền tảng này không thu tiền đặt cọc hay tiền bán tài sản mà chỉ thực hiện việc tạo ra các cuộc đấu giá minh bạch, giúp công chúng có thể tham gia và theo dõi các cuộc đấu giá một cách rõ ràng và công bằng.

## Các Thành Phần Chính Của Nền Tảng

### 1. Người Dùng
Người dùng có thể tham gia vào nền tảng mà không cần kết nối ví, nhưng nếu muốn thực hiện các hành động như đăng ký tài khoản, tạo cuộc đấu giá, bỏ giá, họ sẽ cần kết nối ví MetaMask, chuyển mạng viction (https://rpc.viction.xyz) (https://vicscan.xyz) (chain ID 0x58 or 88) (Symbol: VIC); trong ví cần có VIC để trả gas và VIN để trả phí. 

#### Mỗi người dùng có thể thực hiện các thao tác sau:
- **Đăng ký tài khoản**: Mỗi ví chỉ cần trả **0.001 VIN** duy nhất để đăng ký tài khoản trên nền tảng.
- **Tạo cuộc đấu giá**: Người dùng đã đăng ký có thể tạo cuộc đấu giá mới.
- **Tham gia đấu giá**: Người dùng có thể tham gia vào các cuộc đấu giá đang diễn ra bằng cách bỏ giá.
- **Cập nhật danh sách ví đã đặt cọc**: Chỉ có chủ cuộc đấu giá mới có quyền này.

---

### 2. Các Mẫu Thông Tin Cần Nhập Khi Tạo Cuộc Đấu Giá
Khi tạo một cuộc đấu giá, tổ chức (người tạo cuộc đấu giá) sẽ điền vào một mẫu với các thông tin bắt buộc và tùy chọn như sau:

1. **Mô Tả Ngắn Gọn Tài Sản Đấu Giá** (Bắt buộc):
   - Mô tả ngắn gọn về tài sản đấu giá sẽ được hiển thị ngay trên đầu mỗi cuộc đấu giá. Ví dụ: Căn nhà số X đường giải phóng hà nội. Diện tích đất 60 m2; diện tích xây dựng 150 m2; giấy tờ pháp lý: sổ đỏ.

2. **Thông Báo Đấu Giá** (Bắt buộc):
   - Đây là **link** tới tài liệu qui thông báo đấu giá của cuộc đấu giá. thông báo này được chuẩn bị và lưu trữ trên Pitana, và chỉ cần **dán link vào đây**.

3. **Qui Chế Đấu Giá** (Bắt buộc):
   - Đây là **link** tới tài liệu qui chế đấu giá của cuộc đấu giá. Quy chế này được chuẩn bị và lưu trữ trên Pitana, và chỉ cần **dán link vào đây**.

4. **Thời Gian Đấu Giá** (Bắt buộc):
   - Thời gian **bắt đầu** và **kết thúc** của cuộc đấu giá phải được khai báo bằng định dạng **dd/mm/yyyy và giờ 24h**. Điều này sẽ giúp hệ thống xác định thời gian bắt đầu và kết thúc của cuộc đấu giá.

5. **Thời Gian Cập Nhật Ví Đã Đặt Cọc** (Bắt buộc):
   - Thời gian **cập nhật ví đã đặt cọc**: Địa chỉ ví của người tham gia đấu giá sẽ được người tổ chức cập nhật trước khi thời gian **cutoff** kết thúc.

6. **Giá Khởi Điểm** (Bắt buộc):
   - Mức **giá khởi điểm** của tài sản đấu giá (được nhập dưới dạng VND), và phần giá này sẽ được **hiển thị với dấu chấm** phân cách số (ví dụ: 100.000.000 VND).

7. **Bước Giá** (Bắt buộc):
   - **Bước giá tối thiểu**: Số tiền mà mỗi người tham gia phải bỏ giá cao hơn người trước ít nhất **1 bước giá**.

---

### 3. Quy Trình Tạo Cuộc Đấu Giá
- Sau khi nhập đầy đủ các thông tin, người tổ chức sẽ bấm **nút “Đăng”**.
- Hệ thống sẽ gọi **ký ví** và thu **0.001 VIN** để tạo cuộc đấu giá.
- Cuộc đấu giá sẽ được tạo thành công và hiển thị trên nền tảng.

---

### 4. Các Nút và Quyền Hạn
- **Nút “Tham Gia”**: Mọi người dùng đều có thể tham gia cuộc đấu giá, dù chưa kết nối ví.
- **Nút “Trở về danh sách”**: Quay lại danh sách các cuộc đấu giá.
- **Nút “Đăng Ký”**: Nếu ví chưa đăng ký tài khoản, nút này sẽ hiển thị và yêu cầu thanh toán phí **0.001 VIN** để đăng ký tài khoản.
- **Nút “Tạo Cuộc Đấu Giá”**: Sau khi đăng ký thành công, người dùng có thể tạo cuộc đấu giá mới.
- **Nút “Bỏ Giá”**: Nếu người dùng đã đăng ký và có trong danh sách whitelist, họ sẽ thấy nút này để tham gia đấu giá.
- **Nút “Cập Nhật Ví Đã Đặt Cọc”**: Chủ cuộc đấu giá có thể cập nhật danh sách ví đã đặt cọc, nhưng chỉ trong thời gian quy định.

---

### 5. Các Thông Tin Hiển Thị Trong Mỗi Cuộc Đấu Giá
- **Mô Tả Tài Sản**: Hiển thị mô tả ngắn gọn tài sản đấu giá.
- **Thông Báo Đấu Giá**: Hiển thị thông tin chi tiết về cuộc đấu giá từ thông báo mà người tạo đã cung cấp.
- **Thời Gian Đấu Giá**: Hiển thị thời gian bắt đầu và kết thúc của cuộc đấu giá.
- **Danh Sách Ví Đã Đặt Cọc**: Hiển thị những ví đã tham gia và được người tổ chức thêm vào whitelist.
- **Giá Hiện Tại**: Hiển thị giá hiện tại của tài sản trong cuộc đấu giá.
- **Ví Đang Dẫn**: Hiển thị ví đang đặt giá cao nhất.
- **Nút Tham Gia / Trở Về**: Cung cấp cho người dùng khả năng tham gia hoặc quay lại danh sách các cuộc đấu giá.

---

### 6. Minh Bạch và Công Bằng
- Nền tảng sẽ minh bạch toàn bộ các cuộc đấu giá, cho phép người dùng **xem chi tiết các cuộc đấu giá** mà không cần phải kết nối ví. Mọi thông tin về giá, thời gian đấu giá, ví đã đặt cọc đều được công khai và không thể thay đổi.
- Mọi hành động trên nền tảng, từ đăng ký đến tạo đấu giá, đều yêu cầu thanh toán phí **0.001 VIN**, giúp đảm bảo tính công bằng và không có sự lạm dụng.

---

## **Giao Diện Nền Tảng DauGia.vin**

### **1. Giao Diện Khi Người Dùng Chưa Kết Nối Ví**
Khi người dùng chưa kết nối ví, giao diện của nền tảng sẽ bao gồm các phần sau:

#### **1.1. Header (Phần Đầu Trang)**
- **Logo và Câu Slogan Trình Duyệt**:
  - Logo nền tảng **DauGia.vin** và câu slogan hiển thị trên tiêu đề trình duyệt:  
    **DauGia.vin - Minh bạch trên blockchain**
  
- **Logo và Câu Slogan Trang Web**:
  - Logo **DauGia.vin** sẽ hiển thị ở góc trái trang web, kèm theo câu slogan **“DauGia.vin - Minh bạch trên blockchain”**.
  
- **Nút “Kết Nối Ví”**:
  - Nút này sẽ hiển thị ở góc phải của header khi người dùng chưa kết nối ví.
  
- **Hiển Thị Giá VIN Theo USD**:
  - Cạnh nút “Kết Nối Ví” sẽ là hiển thị giá **VIN theo USD**.  
  Ví dụ: **1 VIN = 22.67 USD** (làm tròn 2 chữ số thập phân).

#### **1.2. Thanh Tìm Kiếm (Search Bar)**
- **Ô Tìm Kiếm**: Cho phép người dùng tìm kiếm các cuộc đấu giá theo từ khóa.

#### **1.3. Hiển Thị Các Cuộc Đấu Giá**
- Các cuộc đấu giá sẽ được hiển thị dưới dạng **2 cột** và **2 hàng**:
  - **Hàng đầu tiên**: **Tóm tắt ngắn gọn tài sản đấu giá** và **nút Chi Tiết**.
  - **Hàng thứ hai**: **Thông tin chi tiết** của cuộc đấu giá.
  Mỗi cuộc đấu giá sẽ có hai nút **Tham Gia** và **Trở về danh sách**.

#### **1.4. Footer (Chân Trang)**
- **Liên Kết Hợp Đồng**, **VIN Token**, **Swap VIN/VIC**, **Hướng Dẫn**.

---

### **2. Giao Diện Khi Người Dùng Đã Kết Nối Ví**
Khi người dùng đã kết nối ví, giao diện sẽ có thêm thông tin ví của người dùng và các chức năng khác như sau:

#### **2.1. Header (Phần Đầu Trang)**
- **Hiển Thị Địa Chỉ Ví và Số Dư**:
  - Sau khi người dùng kết nối ví, địa chỉ ví và số dư VIN và VIC sẽ được hiển thị ở header.

- **Nút “Đăng Ký” và “Tạo Cuộc Đấu Giá”**:
  - Nếu ví chưa đăng ký: nút **Đăng Ký** sẽ hiển thị và yêu cầu người dùng thanh toán phí **0.001 VIN** để đăng ký tài khoản.
  - Sau khi ví đã đăng ký: nút **Tạo Cuộc Đấu Giá** sẽ hiển thị thay cho nút Đăng Ký.

#### **2.2. Hiển Thị Các Cuộc Đấu Giá**
- Giao diện hiển thị các cuộc đấu giá tương tự như khi chưa kết nối ví, nhưng có thêm một số nút và chức năng:
  - **Nút “Cập Nhật Ví Đã Cọc”**: Nếu ví là chủ cuộc đấu giá, nút này sẽ cho phép cập nhật danh sách ví đã đặt cọc.
  - **Nút “Bỏ Giá”**: Nếu ví đã đăng ký và có trong danh sách whitelist, người dùng sẽ thấy nút này để bỏ giá vào cuộc đấu giá.

#### **2.3. Footer (Chân Trang)**
- Footer sẽ giống như khi chưa kết nối ví, nhưng có thêm phần **Địa Chỉ Ví và Số Dư**.

---

### **Kết Luận**
Bản mô tả này cung cấp thông tin đầy đủ và chi tiết về giao diện nền tảng **daugia.vin** khi người dùng **chưa kết nối ví** và khi **đã kết nối ví**. Những thông tin này sẽ giúp chúng ta xây dựng hợp đồng thông minh và DApp dễ dàng và chính xác.

---

### **Cách Cập Nhật Lên GitHub**
Bạn có thể sao chép và dán nội dung này vào file **`README.md`** của dự án trên GitHub. Các phần tiêu đề được đánh dấu bằng dấu `#`, giúp phân loại các mục để dễ dàng theo dõi.
