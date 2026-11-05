/**
 * ==============================================================================
 * ANNHI TRAVEL - HEADLESS CMS BACKEND (GOOGLE APPS SCRIPT)
 * ==============================================================================
 * Kiến trúc: Headless CMS sử dụng Google Sheets làm CSDL
 * Triển khai: Google Apps Script Web App (REST API)
 * Quyền thực thi: Execute as: "Me" | Who has access: "Anyone"
 * ==============================================================================
 */

// Cấu hình tên Sheet
const CONFIG = {
  SHEET_TOURS: 'Tours',
  SHEET_BOOKINGS: 'Bookings',
  // Nếu dùng Standalone Script, hãy điền ID Sheet vào đây.
  // Nếu dùng Container-bound Script (mở trực tiếp từ Tiện ích mở rộng > Apps Script trong Sheet), để trống ''.
  SPREADSHEET_ID: ''
};

/**
 * Hàm tiện ích lấy đối tượng Spreadsheet đang hoạt động
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Xử lý HTTP GET Request: Đọc danh sách tour từ Sheet "Tours"
 * @param {Object} e - Event parameter từ Google Apps Script
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const sheetTours = ss.getSheetByName(CONFIG.SHEET_TOURS);

    if (!sheetTours) {
      return createJsonResponse({
        status: 'error',
        message: `Không tìm thấy trang tính "${CONFIG.SHEET_TOURS}". Hãy chạy hàm setupDatabase() trước!`
      }, 404);
    }

    const data = sheetTours.getDataRange().getValues();
    
    // Nếu sheet chỉ có header hoặc rỗng
    if (data.length <= 1) {
      return createJsonResponse({
        status: 'success',
        total: 0,
        data: []
      });
    }

    // Dòng đầu tiên là Header
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const tours = [];

    // Duyệt qua các dòng dữ liệu (từ dòng 2 trở đi)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Kiểm tra dòng có dữ liệu (ít nhất có id hoặc tour_name)
      if (!row[0] && !row[1]) continue;

      const tour = {};
      headers.forEach((header, colIndex) => {
        tour[header] = row[colIndex];
      });

      // Đảm bảo kiểu dữ liệu chuẩn
      tour.id = String(tour.id || `tour-${i}`);
      tour.price = Number(tour.price) || 0;
      
      tours.push(tour);
    }

    return createJsonResponse({
      status: 'success',
      total: tours.length,
      data: tours
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Lỗi khi đọc dữ liệu từ Google Sheets: ' + error.toString()
    }, 500);
  }
}

/**
 * Xử lý HTTP POST Request: Ghi nhận thông tin đặt tour vào Sheet "Bookings"
 * @param {Object} e - Event parameter từ Google Apps Script chứa payload
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response
 */
function doPost(e) {
  // Khóa ScriptLock để ngăn chặn race condition khi nhiều khách hàng đặt cùng lúc
  const lock = LockService.getScriptLock();
  
  try {
    // Chờ tối đa 10 giây để lấy lock
    lock.waitLock(10000);

    const ss = getSpreadsheet();
    let sheetBookings = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);

    if (!sheetBookings) {
      // Tự động tạo nếu chưa có
      sheetBookings = ss.insertSheet(CONFIG.SHEET_BOOKINGS);
      sheetBookings.appendRow(['booking_id', 'tour_id', 'customer_name', 'phone', 'email', 'consent_status', 'consent_timestamp', 'date_booked']);
    }

    // 1. Phân tích cú pháp dữ liệu gửi lên (Hỗ trợ cả JSON string và form-urlencoded)
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // Fallback nếu dữ liệu gửi dạng form parameter
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const tourId = String(payload.tour_id || '').trim();
    const customerName = String(payload.customer_name || '').trim();
    const phone = String(payload.phone || '').trim();
    const email = String(payload.email || '').trim();
    const dataConsent = payload.data_consent === true || String(payload.data_consent).toLowerCase() === 'true';

    // 2. Validate dữ liệu đầu vào & Tính tuân thủ Nghị định 13/2023/NĐ-CP
    if (!tourId || !customerName || !phone) {
      return createJsonResponse({
        status: 'error',
        message: 'Dữ liệu không hợp lệ! Vui lòng cung cấp đầy đủ: tour_id, customer_name, phone.'
      }, 400);
    }

    // Nghị định 13/2023/NĐ-CP: Bắt buộc phải có sự chấp thuận của chủ thể dữ liệu trước khi xử lý
    if (!dataConsent) {
      return createJsonResponse({
        status: 'error',
        message: 'Yêu cầu bị từ chối: Khách hàng chưa xác nhận đồng ý xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.'
      }, 403);
    }

    // 3. Khởi tạo mã Booking và ngày giờ đặt (GMT+7: Việt Nam)
    const now = new Date();
    const timeCode = Utilities.formatDate(now, 'GMT+7', 'yyyyMMdd-HHmmss');
    const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 số ngẫu nhiên
    const bookingId = `BK-${timeCode}-${randomSuffix}`;
    const dateBooked = Utilities.formatDate(now, 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
    const consentTimestamp = String(payload.timestamp || dateBooked).trim();

    // 4. Thêm dòng mới vào Sheet "Bookings"
    // Cột theo quy định: booking_id, tour_id, customer_name, phone, email, consent_status, consent_timestamp, date_booked
    sheetBookings.appendRow([
      bookingId,
      tourId,
      customerName,
      phone,
      email,
      'Đồng ý (Consent Granted)',
      consentTimestamp,
      dateBooked
    ]);

    // 5. Trả về phản hồi thành công
    return createJsonResponse({
      status: 'success',
      message: 'Đặt tour thành công! Đội ngũ tư vấn sẽ liên hệ lại với bạn sớm nhất.',
      data: {
        booking_id: bookingId,
        tour_id: tourId,
        customer_name: customerName,
        date_booked: dateBooked
      }
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Lỗi máy chủ khi ghi nhận đơn đặt tour: ' + error.toString()
    }, 500);
  } finally {
    // Giải phóng lock cho các request tiếp theo
    lock.releaseLock();
  }
}

/**
 * Hàm chuẩn hóa đầu ra JSON theo đúng ContentService chuẩn REST và tương thích CORS
 * @param {Object} data - Dữ liệu trả về
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function createJsonResponse(data) {
  const jsonString = JSON.stringify(data);
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ==============================================================================
 * HÀM TIỆN ÍCH KHỞI TẠO CƠ SỞ DỮ LIỆU MẪU (CHẠY 1 LẦN DUY NHẤT)
 * ==============================================================================
 * Chọn hàm `setupDatabase` trong thanh công cụ Apps Script và nhấn "Run" (Chạy)
 * để tự động tạo 2 sheet: "Tours" và "Bookings" cùng dữ liệu mẫu ban đầu!
 */
function setupDatabase() {
  const ss = getSpreadsheet();

  // 1. Tạo Sheet "Tours"
  let sheetTours = ss.getSheetByName(CONFIG.SHEET_TOURS);
  if (!sheetTours) {
    sheetTours = ss.insertSheet(CONFIG.SHEET_TOURS);
  } else {
    sheetTours.clear(); // Xóa sạch để tạo mới
  }

  const tourHeaders = ['id', 'tour_name', 'destination', 'price', 'duration', 'image_url', 'description'];
  sheetTours.appendRow(tourHeaders);
  
  // Định dạng Header Tours
  const headerToursRange = sheetTours.getRange(1, 1, 1, tourHeaders.length);
  headerToursRange.setFontWeight('bold');
  headerToursRange.setBackground('#0284c7');
  headerToursRange.setFontColor('#ffffff');

  // Dữ liệu Tour mẫu sinh động chất lượng cao
  const sampleTours = [
    [
      'tour-01',
      'Khám Phá Đảo Ngọc Phú Quốc - Sunset Town & Cáp Treo Hòn Thơm',
      'Phú Quốc, Kiên Giang',
      4290000,
      '3 Ngày 2 Đêm',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      'Trải nghiệm cáp treo vượt biển dài nhất thế giới, lặn ngắm san hô 4 đảo và ngắm hoàng hôn rực rỡ tại Sunset Town.'
    ],
    [
      'tour-02',
      'Sapa Mờ Sương - Chinh Phục Đỉnh Fansipan Nóc Nhà Đông Dương',
      'Sapa, Lào Cai',
      3150000,
      '2 Ngày 1 Đêm',
      'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80',
      'Chiêm ngưỡng biển mây bồng bềnh, bản Cát Cát thơ mộng và trải nghiệm tàu hỏa leo núi Mường Hoa tuyệt đẹp.'
    ],
    [
      'tour-03',
      'Hành Trình Di Sản Miền Trung: Đà Nẵng - Bà Nà Hills - Phố Cổ Hội An',
      'Đà Nẵng & Quảng Nam',
      3850000,
      '4 Ngày 3 Đêm',
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
      'Check-in Cầu Vàng nổi tiếng thế giới, hòa mình vào không gian lung linh đèn lồng phố cổ và thưởng thức ẩm thực miền Trung.'
    ],
    [
      'tour-04',
      'Du Thuyền 5 Sao Vịnh Hạ Long - Kỳ Quan Thiên Nhiên Thế Giới',
      'Hạ Long, Quảng Ninh',
      2990000,
      '2 Ngày 1 Đêm',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      'Nghỉ dưỡng thượng lưu trên du thuyền vịnh Hạ Long, chèo thuyền kayak qua hang Luồn và ngắm hoàng hôn giữa vịnh biển kỳ vĩ.'
    ],
    [
      'tour-05',
      'Hà Giang Mùa Hoa Tam Giác Mạch - Chinh Phục Đèo Mã Pí Lèng',
      'Hà Giang',
      3650000,
      '3 Ngày 2 Đêm',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
      'Cung đường trekking huyền thoại, đi thuyền trên dòng sông Nho Quế màu ngọc bích hẻm Tu Sản hùng vĩ nhất Đông Nam Á.'
    ],
    [
      'tour-06',
      'Quy Nhơn - Kỳ Co - Eo Gió: Nơi Ngắm Hoàng Hôn Đẹp Nhất Việt Nam',
      'Quy Nhơn, Bình Định',
      3450000,
      '3 Ngày 2 Đêm',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      'Được mệnh danh là Maldives của Việt Nam với làn nước trong vắt, lặn ngắm rạn san hô Bãi Dứa và con đường ven biển ngoạn mục.'
    ]
  ];

  sampleTours.forEach(tour => sheetTours.appendRow(tour));
  sheetTours.autoResizeColumns(1, tourHeaders.length);

  // 2. Tạo Sheet "Bookings"
  let sheetBookings = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheetBookings) {
    sheetBookings = ss.insertSheet(CONFIG.SHEET_BOOKINGS);
  } else {
    sheetBookings.clear();
  }

  const bookingHeaders = ['booking_id', 'tour_id', 'customer_name', 'phone', 'email', 'consent_status', 'consent_timestamp', 'date_booked'];
  sheetBookings.appendRow(bookingHeaders);

  // Định dạng Header Bookings
  const headerBookingsRange = sheetBookings.getRange(1, 1, 1, bookingHeaders.length);
  headerBookingsRange.setFontWeight('bold');
  headerBookingsRange.setBackground('#059669');
  headerBookingsRange.setFontColor('#ffffff');
  sheetBookings.autoResizeColumns(1, bookingHeaders.length);

  Logger.log('Đã khởi tạo thành công cấu trúc CSDL và dữ liệu tour mẫu!');
}

