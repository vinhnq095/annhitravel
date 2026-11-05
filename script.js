/**
 * ==============================================================================
 * ANNHI TRAVEL - CLIENT-SIDE CONTROLLER (script.js)
 * ==============================================================================
 * Kiến trúc: Vanilla JavaScript ES6+ (WHATWG Fetch API, Async/Await)
 * Kết nối: Google Apps Script Web App (Headless CMS - Google Sheets)
 * Tính năng:
 *   1. Fetch dữ liệu Tours (GET) & Render Grid Layout linh hoạt
 *   2. Tìm kiếm / Lọc tour tức thì (Client-side Search)
 *   3. Điều khiển Modal Form Đặt Tour tương ứng theo Tour ID
 *   4. Xử lý gửi đơn đặt tour (POST) giải quyết vấn đề CORS & 302 Redirect của Google
 *   5. Hệ thống Toast Notification thông báo trạng thái Loading / Success / Error
 * ==============================================================================
 */

"use strict";

/* ================= 1. CẤU HÌNH HỆ THỐNG (CONFIG) ================= */
const CONFIG = {
  /**
   * Thay thế URL dưới đây bằng Web App URL của bạn sau khi Deploy Google Apps Script:
   * Ví dụ: 'https://script.google.com/macros/s/AKfycbx.../exec'
   */
  API_URL:
    "https://script.google.com/macros/s/AKfycbyX8UPK5hw4fF0gNdncxR5otO3rYAQjF-6porEnwV6arIyKuLuSeGLwVQTXqe6gmb_XLQ/exec",

  // Thời gian tự tắt thông báo Toast (milliseconds)
  TOAST_DURATION: 4500,

  // Dữ liệu mẫu dự phòng (Hiển thị ngay khi người dùng chưa kịp cấu hình API_URL)
  FALLBACK_TOURS: [
    {
      id: "tour-01",
      tour_name: "Khám Phá Đảo Ngọc Phú Quốc - Sunset Town & Cáp Treo Hòn Thơm",
      destination: "Phú Quốc, Kiên Giang",
      price: 4290000,
      duration: "3 Ngày 2 Đêm",
      image_url:
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      description:
        "Trải nghiệm cáp treo vượt biển dài nhất thế giới, lặn ngắm san hô 4 đảo và ngắm hoàng hôn rực rỡ tại Sunset Town.",
    },
    {
      id: "tour-02",
      tour_name: "Sapa Mờ Sương - Chinh Phục Đỉnh Fansipan Nóc Nhà Đông Dương",
      destination: "Sapa, Lào Cai",
      price: 3150000,
      duration: "2 Ngày 1 Đêm",
      image_url:
        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80",
      description:
        "Chiêm ngưỡng biển mây bồng bềnh, bản Cát Cát thơ mộng và trải nghiệm tàu hỏa leo núi Mường Hoa tuyệt đẹp.",
    },
    {
      id: "tour-03",
      tour_name:
        "Hành Trình Di Sản Miền Trung: Đà Nẵng - Bà Nà Hills - Phố Cổ Hội An",
      destination: "Đà Nẵng & Quảng Nam",
      price: 3850000,
      duration: "4 Ngày 3 Đêm",
      image_url:
        "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80",
      description:
        "Check-in Cầu Vàng nổi tiếng thế giới, hòa mình vào không gian lung linh đèn lồng phố cổ và thưởng thức ẩm thực miền Trung.",
    },
    {
      id: "tour-04",
      tour_name: "Du Thuyền 5 Sao Vịnh Hạ Long - Kỳ Quan Thiên Nhiên Thế Giới",
      destination: "Hạ Long, Quảng Ninh",
      price: 2990000,
      duration: "2 Ngày 1 Đêm",
      image_url:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      description:
        "Nghỉ dưỡng thượng lưu trên du thuyền vịnh Hạ Long, chèo thuyền kayak qua hang Luồn và ngắm hoàng hôn giữa vịnh biển kỳ vĩ.",
    },
    {
      id: "tour-05",
      tour_name: "Hà Giang Mùa Hoa Tam Giác Mạch - Chinh Phục Đèo Mã Pí Lèng",
      destination: "Hà Giang",
      price: 3650000,
      duration: "3 Ngày 2 Đêm",
      image_url:
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
      description:
        "Cung đường trekking huyền thoại, đi thuyền trên dòng sông Nho Quế màu ngọc bích hẻm Tu Sản hùng vĩ nhất Đông Nam Á.",
    },
    {
      id: "tour-06",
      tour_name:
        "Quy Nhơn - Kỳ Co - Eo Gió: Nơi Ngắm Hoàng Hôn Đẹp Nhất Việt Nam",
      destination: "Quy Nhơn, Bình Định",
      price: 3450000,
      duration: "3 Ngày 2 Đêm",
      image_url:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      description:
        "Được mệnh danh là Maldives của Việt Nam với làn nước trong vắt, lặn ngắm rạn san hô Bãi Dứa và con đường ven biển ngoạn mục.",
    },
  ],
};

/* ================= 2. QUẢN LÝ TRẠNG THÁI ỨNG DỤNG (STATE) ================= */
const state = {
  allTours: [],
  filteredTours: [],
  selectedTour: null,
  isLoading: false,
  isSubmitting: false,
};

/* ================= 3. CACHE DOM ELEMENTS ================= */
const DOM = {
  // Tour Views
  toursGrid: document.getElementById("toursGrid"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  emptyState: document.getElementById("emptyState"),
  errorMessage: document.getElementById("errorMessage"),
  retryBtn: document.getElementById("retryBtn"),
  tourCount: document.getElementById("tourCount"),

  // Search & Filter
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),

  // Modal & Form
  bookingModal: document.getElementById("bookingModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  bookingForm: document.getElementById("bookingForm"),
  submitBookingBtn: document.getElementById("submitBookingBtn"),

  // Form Inputs
  tourIdInput: document.getElementById("tourIdInput"),
  customerNameInput: document.getElementById("customerNameInput"),
  phoneInput: document.getElementById("phoneInput"),
  emailInput: document.getElementById("emailInput"),

  // Form Errors
  nameError: document.getElementById("nameError"),
  phoneError: document.getElementById("phoneError"),
  emailError: document.getElementById("emailError"),

  // Modal Preview Fields
  previewTourImg: document.getElementById("previewTourImg"),
  previewTourName: document.getElementById("previewTourName"),
  previewTourDuration: document.getElementById("previewTourDuration"),
  previewTourPrice: document.getElementById("previewTourPrice"),

  // Toast
  toastContainer: document.getElementById("toastContainer"),
};

/* ================= 4. KHỞI TẠO ỨNG DỤNG (INITIALIZATION) ================= */
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

/**
 * Khởi động luồng ứng dụng và gán sự kiện toàn cục
 */
function initApp() {
  bindEvents();
  loadTours();
}

/**
 * Đăng ký tất cả các Event Listeners
 */
function bindEvents() {
  // Tìm kiếm
  DOM.searchInput.addEventListener("input", handleSearch);
  DOM.searchBtn.addEventListener("click", handleSearch);
  DOM.clearSearchBtn.addEventListener("click", () => {
    DOM.searchInput.value = "";
    handleSearch();
  });

  // Nút Thử lại khi tải lỗi
  DOM.retryBtn.addEventListener("click", loadTours);

  // Đóng Modal (Nút X, Nút Hủy, Click Backdrop, Phím Escape)
  DOM.modalCloseBtn.addEventListener("click", closeBookingModal);
  DOM.modalCancelBtn.addEventListener("click", closeBookingModal);
  DOM.modalBackdrop.addEventListener("click", closeBookingModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !DOM.bookingModal.classList.contains("hidden")) {
      closeBookingModal();
    }
  });

  // Submit Form Đặt Tour
  DOM.bookingForm.addEventListener("submit", handleBookingSubmit);

  // Xóa thông báo lỗi khi người dùng gõ phím
  DOM.customerNameInput.addEventListener("input", () =>
    clearFieldError(DOM.customerNameInput, DOM.nameError),
  );
  DOM.phoneInput.addEventListener("input", () =>
    clearFieldError(DOM.phoneInput, DOM.phoneError),
  );
  DOM.emailInput.addEventListener("input", () =>
    clearFieldError(DOM.emailInput, DOM.emailError),
  );
}

/* ================= 5. MODULE FETCH & RENDER DANH SÁCH TOUR ================= */

/**
 * Tải danh sách Tour từ Google Apps Script (GET Request)
 */
async function loadTours() {
  setLoadingState(true);

  // Kiểm tra nếu người dùng chưa điền URL thật
  const isDefaultUrl =
    !CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_DEPLOYMENT_ID");

  if (isDefaultUrl) {
    console.info(
      "[Annhi Travel] Đang sử dụng dữ liệu tour mẫu dự phòng (Chưa cấu hình API_URL thật).",
    );
    setTimeout(() => {
      state.allTours = [...CONFIG.FALLBACK_TOURS];
      state.filteredTours = [...state.allTours];
      renderTours(state.filteredTours);
      setLoadingState(false);
      showToast(
        "Đang chạy dữ liệu mẫu",
        "Hãy cập nhật URL Web App trong script.js sau khi deploy Google Apps Script!",
        "info",
      );
    }, 600);
    return;
  }

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Mã phản hồi HTTP: ${response.status}`);
    }

    const result = await response.json();

    if (result.status === "success" && Array.isArray(result.data)) {
      state.allTours = result.data;
      state.filteredTours = [...state.allTours];
      renderTours(state.filteredTours);
    } else {
      throw new Error(
        result.message || "Cấu trúc dữ liệu trả về từ API không hợp lệ.",
      );
    }
  } catch (error) {
    console.error("[Fetch Tours Error]:", error);
    showErrorState(
      "Không thể kết nối đến máy chủ Google Apps Script: " + error.message,
    );
  } finally {
    setLoadingState(false);
  }
}

/**
 * Render danh sách tour ra DOM
 * @param {Array<Object>} tours
 */
function renderTours(tours) {
  // Cập nhật số lượng tour
  DOM.tourCount.textContent = `Hiển thị ${tours.length} tour du lịch`;

  if (!tours || tours.length === 0) {
    DOM.toursGrid.classList.add("hidden");
    DOM.emptyState.classList.remove("hidden");
    return;
  }

  DOM.emptyState.classList.add("hidden");
  DOM.toursGrid.classList.remove("hidden");

  // Tạo HTML các thẻ Tour
  const cardsHtml = tours
    .map((tour) => {
      const formattedPrice = formatCurrency(tour.price);
      const safeName = escapeHtml(tour.tour_name);
      const safeDest = escapeHtml(tour.destination || "Việt Nam");
      const safeDesc = escapeHtml(
        tour.description || "Hành trình tuyệt vời đang chờ đón bạn.",
      );
      const safeDuration = escapeHtml(tour.duration || "Linh hoạt");
      const imageUrl =
        tour.image_url ||
        "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80";

      return `
      <article class="tour-card" data-tour-id="${escapeHtml(tour.id)}">
        <div class="tour-thumbnail-wrap">
          <img 
            src="${imageUrl}" 
            alt="${safeName}" 
            class="tour-img" 
            loading="lazy"
            onerror="this.src='https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80'"
          />
          <div class="tour-dest-tag">
            <i class="fa-solid fa-location-dot"></i> ${safeDest}
          </div>
          <div class="tour-duration-badge">
            <i class="fa-regular fa-clock"></i> ${safeDuration}
          </div>
        </div>

        <div class="tour-card-body">
          <h3 class="tour-title" title="${safeName}">${safeName}</h3>
          <p class="tour-description">${safeDesc}</p>

          <div class="tour-card-footer">
            <div class="tour-price-group">
              <span class="price-label">Giá trọn gói</span>
              <span class="tour-price">${formattedPrice} <small>/ khách</small></span>
            </div>

            <button 
              type="button" 
              class="btn btn-primary btn-book-tour" 
              data-tour-id="${escapeHtml(tour.id)}"
              aria-label="Đặt tour ${safeName}"
            >
              <i class="fa-solid fa-paper-plane"></i> Đặt Ngay
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  DOM.toursGrid.innerHTML = cardsHtml;

  // Gắn sự kiện "Đặt Ngay" cho tất cả các nút vừa render
  const bookButtons = DOM.toursGrid.querySelectorAll(".btn-book-tour");
  bookButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const tourId = e.currentTarget.getAttribute("data-tour-id");
      const tour = state.allTours.find((t) => String(t.id) === String(tourId));
      if (tour) {
        openBookingModal(tour);
      }
    });
  });
}

/**
 * Xử lý tìm kiếm tour theo từ khóa
 */
function handleSearch() {
  const keyword = DOM.searchInput.value.trim().toLowerCase();

  if (!keyword) {
    state.filteredTours = [...state.allTours];
  } else {
    state.filteredTours = state.allTours.filter((tour) => {
      const name = (tour.tour_name || "").toLowerCase();
      const dest = (tour.destination || "").toLowerCase();
      const desc = (tour.description || "").toLowerCase();
      return (
        name.includes(keyword) ||
        dest.includes(keyword) ||
        desc.includes(keyword)
      );
    });
  }

  renderTours(state.filteredTours);
}

/* ================= 6. MODULE MODAL FORM & ĐẶT TOUR ================= */

/**
 * Mở Modal đặt tour và điền thông tin tour đã chọn
 * @param {Object} tour
 */
function openBookingModal(tour) {
  state.selectedTour = tour;

  // Gán thông tin tour vào Modal Preview
  DOM.tourIdInput.value = tour.id;
  DOM.previewTourName.textContent = tour.tour_name;
  DOM.previewTourName.title = tour.tour_name;
  DOM.previewTourDuration.innerHTML = `<i class="fa-regular fa-clock"></i> ${escapeHtml(tour.duration || "")}`;
  DOM.previewTourPrice.textContent = formatCurrency(tour.price);
  DOM.previewTourImg.src =
    tour.image_url ||
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=400&q=80";
  DOM.previewTourImg.alt = tour.tour_name;

  // Reset form & lỗi cũ
  resetFormErrors();
  DOM.bookingForm.reset();
  DOM.tourIdInput.value = tour.id;

  // Hiển thị Modal & khóa cuộn trang
  DOM.bookingModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Tự động focus vào ô nhập tên
  setTimeout(() => DOM.customerNameInput.focus(), 100);
}

/**
 * Đóng Modal đặt tour
 */
function closeBookingModal() {
  if (state.isSubmitting) return; // Không đóng khi đang gửi request

  DOM.bookingModal.classList.add("hidden");
  document.body.style.overflow = "";
  state.selectedTour = null;
  resetFormErrors();
}

/**
 * Xử lý sự kiện Submit Form Đặt Tour
 * @param {Event} e
 */
async function handleBookingSubmit(e) {
  e.preventDefault();

  if (state.isSubmitting) return;

  // 1. Thu thập dữ liệu Form
  const formData = {
    tour_id: DOM.tourIdInput.value.trim(),
    customer_name: DOM.customerNameInput.value.trim(),
    phone: DOM.phoneInput.value.trim(),
    email: DOM.emailInput.value.trim(),
  };

  // 2. Validate dữ liệu
  const isValid = validateBookingForm(formData);
  if (!isValid) return;

  // 3. Kích hoạt trạng thái Loading trên Button
  setSubmittingState(true);

  // Kiểm tra nếu đang chạy URL mẫu mặc định
  const isDefaultUrl =
    !CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_DEPLOYMENT_ID");

  if (isDefaultUrl) {
    // Giả lập gửi thành công nếu chưa cấu hình backend thật
    setTimeout(() => {
      setSubmittingState(false);
      closeBookingModal();
      showToast(
        "Đặt tour thành công (Mô phỏng)!",
        `Mã giữ chỗ: BK-SIMULATED-01. Hãy cấu hình API_URL thật để ghi vào Google Sheet!`,
        "success",
      );
    }, 1200);
    return;
  }

  try {
    /**
     * LƯU Ý KỸ THUẬT QUAN TRỌNG VỀ CORS VỚI GOOGLE APPS SCRIPT:
     * - Khi gửi POST với `Content-Type: application/json`, trình duyệt sẽ kích hoạt Preflight OPTIONS request.
     * - Google Apps Script Web App KHÔNG hỗ trợ phương thức OPTIONS -> Gây lỗi CORS!
     * - Giải pháp chuẩn công nghiệp:
     *   Sử dụng `Content-Type: text/plain;charset=utf-8` kết hợp chuỗi JSON stringify.
     *   Trình duyệt coi đây là "Simple Request", KHÔNG gửi OPTIONS, và tự động xử lý chuyển hướng 302 Redirect của Google.
     *   Tại Backend Apps Script, `JSON.parse(e.postData.contents)` vẫn đọc dữ liệu JSON hoàn hảo!
     */
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.status === "success") {
      const bookingId = result.data ? result.data.booking_id : "";
      showToast(
        "Đặt tour thành công!",
        `Mã đơn: ${bookingId}. Đội ngũ Annhi Travel sẽ liên hệ lại với bạn sớm nhất!`,
        "success",
      );
      closeBookingModal();
    } else {
      throw new Error(result.message || "Không thể ghi nhận đơn đặt tour.");
    }
  } catch (error) {
    console.error("[Submit Booking Error]:", error);

    /**
     * Trường hợp hiếm gặp: Trình duyệt chặn đọc response do strict redirect policy
     * Ta thông báo rõ ràng cho người dùng kiểm tra lại kết nối.
     */
    showToast(
      "Đặt tour thất bại!",
      error.message ||
        "Đã có lỗi xảy ra khi gửi thông tin lên hệ thống. Vui lòng thử lại!",
      "error",
    );
  } finally {
    setSubmittingState(false);
  }
}

/**
 * Validate thông tin khách hàng đặt tour
 * @param {Object} data
 * @returns {boolean}
 */
function validateBookingForm(data) {
  let valid = true;
  resetFormErrors();

  // Validate Tên
  if (!data.customer_name) {
    setFieldError(
      DOM.customerNameInput,
      DOM.nameError,
      "Vui lòng nhập họ và tên của bạn.",
    );
    valid = false;
  } else if (data.customer_name.length < 2) {
    setFieldError(
      DOM.customerNameInput,
      DOM.nameError,
      "Họ và tên tối thiểu từ 2 ký tự trở lên.",
    );
    valid = false;
  }

  // Validate Số điện thoại (Định dạng Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)
  const phoneRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
  if (!data.phone) {
    setFieldError(
      DOM.phoneInput,
      DOM.phoneError,
      "Vui lòng nhập số điện thoại liên hệ.",
    );
    valid = false;
  } else if (!phoneRegex.test(data.phone.replace(/\s+/g, ""))) {
    setFieldError(
      DOM.phoneInput,
      DOM.phoneError,
      "Số điện thoại không hợp lệ (Ví dụ: 0912345678).",
    );
    valid = false;
  }

  // Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email) {
    setFieldError(
      DOM.emailInput,
      DOM.emailError,
      "Vui lòng nhập email nhận xác nhận.",
    );
    valid = false;
  } else if (!emailRegex.test(data.email)) {
    setFieldError(
      DOM.emailInput,
      DOM.emailError,
      "Địa chỉ email không đúng định dạng.",
    );
    valid = false;
  }

  return valid;
}

/* ================= 7. TIỆN ÍCH TRỢ GIÚP (HELPERS & UI STATES) ================= */

/**
 * Bật/tắt trạng thái tải dữ liệu
 * @param {boolean} isLoading
 */
function setLoadingState(isLoading) {
  state.isLoading = isLoading;
  if (isLoading) {
    DOM.loadingState.classList.remove("hidden");
    DOM.toursGrid.classList.add("hidden");
    DOM.errorState.classList.add("hidden");
    DOM.emptyState.classList.add("hidden");
    DOM.tourCount.textContent = "Đang tải dữ liệu tour...";
  } else {
    DOM.loadingState.classList.add("hidden");
  }
}

/**
 * Hiển thị màn hình báo lỗi khi fetch thất bại
 * @param {string} message
 */
function showErrorState(message) {
  DOM.loadingState.classList.add("hidden");
  DOM.toursGrid.classList.add("hidden");
  DOM.emptyState.classList.add("hidden");
  DOM.errorState.classList.remove("hidden");
  DOM.errorMessage.textContent = message;
  DOM.tourCount.textContent = "Lỗi kết nối";
}

/**
 * Bật/tắt trạng thái đang gửi form
 * @param {boolean} isSubmitting
 */
function setSubmittingState(isSubmitting) {
  state.isSubmitting = isSubmitting;
  const btnText = DOM.submitBookingBtn.querySelector(".btn-text");
  const btnLoading = DOM.submitBookingBtn.querySelector(".btn-loading");

  if (isSubmitting) {
    DOM.submitBookingBtn.disabled = true;
    btnText.classList.add("hidden");
    btnLoading.classList.remove("hidden");
  } else {
    DOM.submitBookingBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnLoading.classList.add("hidden");
  }
}

/**
 * Hiển thị lỗi dưới input
 */
function setFieldError(inputEl, errorEl, message) {
  inputEl.classList.add("is-invalid");
  errorEl.textContent = message;
}

/**
 * Xóa lỗi dưới input
 */
function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove("is-invalid");
  errorEl.textContent = "";
}

/**
 * Xóa sạch lỗi trong modal
 */
function resetFormErrors() {
  clearFieldError(DOM.customerNameInput, DOM.nameError);
  clearFieldError(DOM.phoneInput, DOM.phoneError);
  clearFieldError(DOM.emailInput, DOM.emailError);
}

/**
 * Hiển thị thông báo Toast đẹp mắt
 * @param {string} title
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(title, message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconHtml = '<i class="fa-solid fa-circle-check"></i>';
  if (type === "error") {
    iconHtml = '<i class="fa-solid fa-circle-xmark"></i>';
  } else if (type === "info") {
    iconHtml = '<i class="fa-solid fa-circle-info"></i>';
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconHtml}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  DOM.toastContainer.appendChild(toast);

  // Tự động xóa sau thời gian quy định
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, CONFIG.TOAST_DURATION);
}

/**
 * Định dạng số tiền sang chuẩn tiền tệ Việt Nam (VNĐ)
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(num);
}

/**
 * Chống XSS injection an toàn
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
