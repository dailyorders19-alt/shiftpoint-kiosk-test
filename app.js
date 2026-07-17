let appSettings = { ...DEFAULT_SETTINGS };
let employees = [];
let attendanceEvents = [];
let absenceRecords = [];
let vacationAllowances = [];
let selectedMonthlyAccountingEmployeeId = "";
let selectedVacationEmployeeId = "";
let overtimeVisibilityObserver = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof initializeStorage === "function") {
    await initializeStorage();
  }

  initApp();
});

function initApp() {
  initMenu();
  initLanguageSwitcher();
  initEmployeesPage();
  initCardsPage();
  initScannerPage();
  initAttendancePages();
  initProfilePage();
  initStatisticsPage();
  initMonthlyAccountingPage();
  initVacationTrackerPage();
  initExportPage();
  applyLanguage(appSettings.language);
  initOvertimeVisibility();
  refreshInterfaceIcons();
  fillSettingsFields();
  initDateTimePickers();
  renderDashboardSummary();
  registerServiceWorker();
  initAutoBackupOnClose();
}

function refreshInterfaceIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true",
        "stroke-width": "1.9"
      }
    });
  }
}

function initAutoBackupOnClose() {
  window.addEventListener("pagehide", () => {
    if (typeof createAutoBackup === "function") {
      createAutoBackup("app-close");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && typeof createAutoBackup === "function") {
      createAutoBackup("app-hidden");
    }
  });
}

function initMenu() {
  const menuButtons = document.querySelectorAll(".menu-btn");
  const pages = document.querySelectorAll(".page");

  menuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetPageId = button.dataset.page;

      menuButtons.forEach((item) => item.classList.remove("active"));
      pages.forEach((page) => page.classList.remove("active"));

      button.classList.add("active");

      const targetPage = document.getElementById(targetPageId);
      if (targetPage) {
        targetPage.classList.add("active");
      }

      window.scrollTo({ top: 0, behavior: "auto" });

      if (targetPageId !== "scanPage") {
        stopCameraScanner(false);
      }

      if (targetPageId === "cardsPage") {
        renderEmployeeCards();
      }

      if (targetPageId === "insidePage") {
        renderInsideList();
      }

      if (targetPageId === "attendancePage") {
        renderAttendanceList();
      }

      if (targetPageId === "profilePage") {
        renderEmployeeProfileEmployeeOptions();
        renderEmployeeProfile();
      }

      if (targetPageId === "statisticsPage") {
        renderStatisticsPage();
      }

      if (targetPageId === "monthlyAccountingPage") {
        renderMonthlyAccountingPage();
      }

      if (targetPageId === "vacationTrackerPage") {
        renderVacationTrackerPage();
      }

      if (targetPageId === "exportPage") {
        renderExportPage();
      }
    });
  });
}

function initLanguageSwitcher() {
  const languageButtons = document.querySelectorAll(".language-btn");

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedLanguage = button.dataset.lang;

      appSettings.language = selectedLanguage;
      saveSettings(appSettings);
      applyLanguage(selectedLanguage);
      applyOvertimeVisibility();
      initDateTimePickers();
      renderEmployeesTable();
      renderEmployeeCards();
      renderInsideList();
      renderAttendanceList();
      renderEmployeeProfileEmployeeOptions();
      renderEmployeeProfile();
      renderStatisticsPage();
      renderMonthlyAccountingPage();
      renderVacationTrackerPage();
      renderExportPage();
    });
  });
}

function applyLanguage(language) {
  const selectedLanguage = LANGUAGE_DATA[language] ? language : "hu";
  const texts = LANGUAGE_DATA[selectedLanguage];

  document.documentElement.lang = selectedLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (texts[key]) {
      element.textContent = texts[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;

    if (texts[key]) {
      element.placeholder = texts[key];
    }
  });

  document.querySelectorAll(".language-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === selectedLanguage);
  });
}

function t(key) {
  const selectedLanguage = LANGUAGE_DATA[appSettings.language] ? appSettings.language : "hu";
  return LANGUAGE_DATA[selectedLanguage][key] || LANGUAGE_DATA.hu[key] || key;
}

function shouldShowOvertimeData() {
  return appSettings.showOvertimeData !== false;
}

function getOvertimeVisibilityLabels() {
  return new Set([
    t("attendance.overtime"),
    t("payment.overtimeValue"),
    t("payment.overtimeRate"),
    t("statistics.mostOvertime"),
    t("settings.overtimeHourlyRate"),
    t("payment.totalPayment")
  ]);
}

function initOvertimeVisibility() {
  applyOvertimeVisibility();

  if (overtimeVisibilityObserver) {
    return;
  }

  overtimeVisibilityObserver = new MutationObserver(() => {
    applyOvertimeVisibility();
  });
  overtimeVisibilityObserver.observe(document.querySelector(".main-content"), {
    childList: true,
    subtree: true
  });
}

function applyOvertimeVisibility() {
  document.body.classList.toggle("hide-overtime-data", !shouldShowOvertimeData());
  markOvertimeDataElements(document);
}

function markOvertimeDataElements(root) {
  const labels = getOvertimeVisibilityLabels();

  root.querySelectorAll("table").forEach((table) => {
    table.querySelectorAll("tr").forEach((row) => {
      const firstCell = row.cells && row.cells[0];
      if (firstCell && labels.has(firstCell.textContent.trim())) {
        row.classList.add("overtime-data");
      }
    });

    const headerCells = [...table.querySelectorAll("thead th")];
    const overtimeIndexes = headerCells
      .map((cell, index) => labels.has(cell.textContent.trim()) ? index : -1)
      .filter((index) => index >= 0);

    overtimeIndexes.forEach((index) => {
      table.querySelectorAll("tr").forEach((row) => {
        if (row.cells && row.cells[index]) {
          row.cells[index].classList.add("overtime-data");
        }
      });
    });
  });

  root.querySelectorAll(
    ".profile-summary-card, .statistics-card, .manager-ranking, .export-summary-card"
  ).forEach((element) => {
    const label = element.querySelector("span, h4");
    if (label && labels.has(label.textContent.trim())) {
      element.classList.add("overtime-data");
    }
  });
}

function fillSettingsFields() {
  const settingsForm = document.getElementById("settingsForm");
  const companyNameInput = document.getElementById("companyNameInput");
  const dailyNormInput = document.getElementById("dailyNormInput");
  const lunchBreakInput = document.getElementById("lunchBreakInput");
  const overtimeHourlyRateInput = document.getElementById("overtimeHourlyRateInput");
  const showOvertimeDataInput = document.getElementById("showOvertimeDataInput");
  const mealVoucherDailyValueInput = document.getElementById("mealVoucherDailyValueInput");
  const storageModeInput = document.getElementById("storageModeInput");
  const settingsResetButton = document.getElementById("settingsResetButton");

  if (companyNameInput) {
    companyNameInput.value = appSettings.companyName;
  }

  if (dailyNormInput) {
    dailyNormInput.value = minutesToTime(appSettings.dailyNormMinutes);
  }

  if (lunchBreakInput) {
    lunchBreakInput.value = minutesToTime(appSettings.lunchBreakMinutes);
  }

  if (overtimeHourlyRateInput) {
    overtimeHourlyRateInput.value = Number(appSettings.overtimeHourlyRate || 0);
  }

  if (showOvertimeDataInput) {
    showOvertimeDataInput.checked = shouldShowOvertimeData();
  }

  if (mealVoucherDailyValueInput) {
    mealVoucherDailyValueInput.value = Number(appSettings.mealVoucherDailyValue || 0);
  }

  if (storageModeInput) {
    storageModeInput.value = appSettings.storageMode;
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveSettingsFromForm();
    });
  }

  if (settingsResetButton) {
    settingsResetButton.addEventListener("click", () => {
      resetSettingsToDefaults();
    });
  }
}

function saveSettingsFromForm() {
  const companyNameInput = document.getElementById("companyNameInput");
  const dailyNormInput = document.getElementById("dailyNormInput");
  const lunchBreakInput = document.getElementById("lunchBreakInput");
  const overtimeHourlyRateInput = document.getElementById("overtimeHourlyRateInput");
  const showOvertimeDataInput = document.getElementById("showOvertimeDataInput");
  const mealVoucherDailyValueInput = document.getElementById("mealVoucherDailyValueInput");

  const dailyNormMinutes = parseTimeInputToMinutes(dailyNormInput ? dailyNormInput.value : "");
  const lunchBreakMinutes = parseTimeInputToMinutes(lunchBreakInput ? lunchBreakInput.value : "");
  const overtimeHourlyRate = parseMoneyInput(overtimeHourlyRateInput ? overtimeHourlyRateInput.value : "0");
  const mealVoucherDailyValue = parseMoneyInput(mealVoucherDailyValueInput ? mealVoucherDailyValueInput.value : "0");

  if (!dailyNormMinutes || dailyNormMinutes < 60) {
    showSettingsStatus(t("settings.invalidDailyNorm"), "error");
    return;
  }

  if (!Number.isFinite(lunchBreakMinutes) || lunchBreakMinutes < 0 || lunchBreakMinutes > dailyNormMinutes) {
    showSettingsStatus(t("settings.invalidLunchBreak"), "error");
    return;
  }

  if (
    !Number.isFinite(overtimeHourlyRate) ||
    overtimeHourlyRate < 0 ||
    !Number.isFinite(mealVoucherDailyValue) ||
    mealVoucherDailyValue < 0
  ) {
    showSettingsStatus(t("settings.invalidPaymentValues"), "error");
    return;
  }

  appSettings = {
    ...appSettings,
    companyName: companyNameInput && companyNameInput.value.trim()
      ? companyNameInput.value.trim()
      : "Centru de sticla",
    dailyNormMinutes,
    lunchBreakMinutes,
    showOvertimeData: showOvertimeDataInput ? showOvertimeDataInput.checked : true,
    overtimeHourlyRate,
    mealVoucherDailyValue,
    storageMode: "supabase"
  };

  saveSettings(appSettings);
  fillSettingsValues();
  refreshAllCalculatedViews();
  applyOvertimeVisibility();
  showSettingsStatus(t("settings.saved"), "success");
}

function resetSettingsToDefaults() {
  appSettings = {
    ...appSettings,
    companyName: "Centru de sticla",
    dailyNormMinutes: 480,
    lunchBreakMinutes: 30,
    showOvertimeData: true,
    overtimeHourlyRate: 0,
    mealVoucherDailyValue: 0,
    storageMode: "supabase"
  };

  saveSettings(appSettings);
  fillSettingsValues();
  refreshAllCalculatedViews();
  applyOvertimeVisibility();
  showSettingsStatus(t("settings.resetDone"), "success");
}

function fillSettingsValues() {
  const companyNameInput = document.getElementById("companyNameInput");
  const dailyNormInput = document.getElementById("dailyNormInput");
  const lunchBreakInput = document.getElementById("lunchBreakInput");
  const overtimeHourlyRateInput = document.getElementById("overtimeHourlyRateInput");
  const showOvertimeDataInput = document.getElementById("showOvertimeDataInput");
  const mealVoucherDailyValueInput = document.getElementById("mealVoucherDailyValueInput");
  const storageModeInput = document.getElementById("storageModeInput");

  if (companyNameInput) {
    companyNameInput.value = appSettings.companyName || "Centru de sticla";
  }

  if (dailyNormInput) {
    dailyNormInput.value = minutesToTime(appSettings.dailyNormMinutes);
  }

  if (lunchBreakInput) {
    lunchBreakInput.value = minutesToTime(appSettings.lunchBreakMinutes);
  }

  if (overtimeHourlyRateInput) {
    overtimeHourlyRateInput.value = Number(appSettings.overtimeHourlyRate || 0);
  }

  if (showOvertimeDataInput) {
    showOvertimeDataInput.checked = shouldShowOvertimeData();
  }

  if (mealVoucherDailyValueInput) {
    mealVoucherDailyValueInput.value = Number(appSettings.mealVoucherDailyValue || 0);
  }

  if (storageModeInput) {
    storageModeInput.value = appSettings.storageMode || "localStorage";
  }
}

function refreshAllCalculatedViews() {
  renderEmployeeCards();
  renderInsideList();
  renderAttendanceList();
  renderEmployeeProfile();
  renderStatisticsPage();
  renderMonthlyAccountingPage();
  renderVacationTrackerPage();
  renderExportPage();
}

function parseTimeInputToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return NaN;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return NaN;
  }

  return hours * 60 + minutes;
}

function parseMoneyInput(value) {
  const normalizedValue = String(value || "0").replace(",", ".");
  const numberValue = Number(normalizedValue);

  if (!Number.isFinite(numberValue)) {
    return NaN;
  }

  return Math.round(numberValue * 100) / 100;
}

function showSettingsStatus(message, type = "info") {
  const statusBox = document.getElementById("settingsStatus");

  if (!statusBox) {
    return;
  }

  statusBox.textContent = message;
  statusBox.className = `export-status export-status-${type}`;
}

function initEmployeesPage() {
  const employeeForm = document.getElementById("employeeForm");
  const employeeResetButton = document.getElementById("employeeResetButton");

  if (!employeeForm) {
    return;
  }

  resetEmployeeForm();

  employeeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEmployeeFromForm();
  });

  if (employeeResetButton) {
    employeeResetButton.addEventListener("click", () => {
      resetEmployeeForm();
    });
  }

  renderEmployeesTable();
}

function saveEmployeeFromForm() {
  const editingIdInput = document.getElementById("employeeEditingIdInput");
  const codeInput = document.getElementById("employeeCodeInput");
  const nameInput = document.getElementById("employeeNameInput");
  const departmentInput = document.getElementById("employeeDepartmentInput");
  const activeInput = document.getElementById("employeeActiveInput");
  const lunchBreakInput = document.getElementById("employeeLunchBreakInput");
  const noteInput = document.getElementById("employeeNoteInput");

  const editingId = editingIdInput.value.trim();
  const employeeCode = codeInput.value.trim();
  const employeeName = nameInput.value.trim();
  const employeeDepartment = departmentInput.value.trim();
  const employeeActive = activeInput.checked;
  const employeeLunchBreakEnabled = lunchBreakInput ? lunchBreakInput.checked : true;
  const employeeNote = noteInput.value.trim();

  if (!employeeName) {
    alert(t("employee.nameRequired"));
    nameInput.focus();
    return;
  }

  if (editingId) {
    employees = employees.map((employee) => {
      if (employee.id !== editingId) {
        return employee;
      }

      return {
        ...employee,
        name: employeeName,
        department: employeeDepartment,
        active: employeeActive,
        lunchBreakEnabled: employeeLunchBreakEnabled,
        note: employeeNote,
        updatedAt: new Date().toISOString()
      };
    });

    saveEmployees(employees);
    alert(t("employee.updated"));
  } else {
    const newEmployee = {
      id: employeeCode,
      name: employeeName,
      department: employeeDepartment,
      active: employeeActive,
      lunchBreakEnabled: employeeLunchBreakEnabled,
      note: employeeNote,
      createdAt: new Date().toISOString()
    };

    employees.push(newEmployee);
    saveEmployees(employees);
    alert(t("employee.saved"));
  }

  resetEmployeeForm();
  renderEmployeesTable();
  renderEmployeeCards();
  renderEmployeeProfileEmployeeOptions();
  renderEmployeeProfile();
  fillAbsenceEmployeeOptions();
  renderMonthlyAccountingPage();
}

function initDateTimePickers() {
  if (typeof window.flatpickr !== "function") {
    return;
  }

  const language = appSettings.language || "hu";
  const locale = language === "hu"
    ? window.flatpickr.l10ns.hu
    : language === "ro"
      ? window.flatpickr.l10ns.ro
      : window.flatpickr.l10ns.default;

  document.querySelectorAll('input[placeholder="DD/MM/YYYY"]').forEach((input) => {
    if (input._flatpickr) {
      input._flatpickr.destroy();
    }

    window.flatpickr(input, {
      allowInput: false,
      dateFormat: "d/m/Y",
      disableMobile: true,
      locale
    });
  });

  document.querySelectorAll('input[placeholder="HH:MM"]').forEach((input) => {
    if (input._flatpickr) {
      input._flatpickr.destroy();
    }

    window.flatpickr(input, {
      allowInput: false,
      dateFormat: "H:i",
      disableMobile: true,
      enableTime: true,
      locale,
      noCalendar: true,
      time_24hr: true
    });
  });
}

function resetEmployeeForm() {
  const editingIdInput = document.getElementById("employeeEditingIdInput");
  const codeInput = document.getElementById("employeeCodeInput");
  const nameInput = document.getElementById("employeeNameInput");
  const departmentInput = document.getElementById("employeeDepartmentInput");
  const activeInput = document.getElementById("employeeActiveInput");
  const lunchBreakInput = document.getElementById("employeeLunchBreakInput");
  const noteInput = document.getElementById("employeeNoteInput");

  if (editingIdInput) {
    editingIdInput.value = "";
  }

  if (codeInput) {
    codeInput.value = generateNextEmployeeCode();
  }

  if (nameInput) {
    nameInput.value = "";
    nameInput.focus();
  }

  if (departmentInput) {
    departmentInput.value = "";
  }

  if (activeInput) {
    activeInput.checked = true;
  }

  if (lunchBreakInput) {
    lunchBreakInput.checked = true;
  }

  if (noteInput) {
    noteInput.value = "";
  }
}

function generateNextEmployeeCode() {
  let highestNumber = 0;

  employees.forEach((employee) => {
    const match = String(employee.id).match(/^EMP-(\d+)$/);

    if (match) {
      const number = Number(match[1]);
      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  });

  const nextNumber = highestNumber + 1;
  return `EMP-${String(nextNumber).padStart(3, "0")}`;
}

function renderEmployeesTable() {
  const tableBody = document.getElementById("employeeTableBody");

  if (!tableBody) {
    return;
  }

  if (employees.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">${escapeHtml(t("employees.empty"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = employees
    .map((employee) => {
      const statusText = employee.active ? t("employee.active") : t("employee.inactive");
      const statusClass = employee.active ? "status-active" : "status-inactive";
      const lunchBreakText = employee.lunchBreakEnabled !== false ? t("common.yes") : t("common.no");
      const lunchBreakClass = employee.lunchBreakEnabled !== false ? "status-active" : "status-inactive";

      return `
        <tr>
          <td><strong>${escapeHtml(employee.id)}</strong></td>
          <td>${escapeHtml(employee.name)}</td>
          <td>${escapeHtml(employee.department || "-")}</td>
          <td>
            <span class="status-badge ${statusClass}">
              ${escapeHtml(statusText)}
            </span>
          </td>
          <td>
            <span class="status-badge ${lunchBreakClass}">
              ${escapeHtml(lunchBreakText)}
            </span>
          </td>
          <td>${escapeHtml(employee.note || "-")}</td>
          <td>
            <button type="button" class="small-btn" onclick="editEmployee('${escapeHtml(employee.id)}')">
              ${escapeHtml(t("common.edit"))}
            </button>
            <button type="button" class="danger-btn" onclick="deleteEmployee('${escapeHtml(employee.id)}')">
              ${escapeHtml(t("common.delete"))}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function editEmployee(employeeId) {
  const employee = employees.find((item) => item.id === employeeId);

  if (!employee) {
    return;
  }

  const editingIdInput = document.getElementById("employeeEditingIdInput");
  const codeInput = document.getElementById("employeeCodeInput");
  const nameInput = document.getElementById("employeeNameInput");
  const departmentInput = document.getElementById("employeeDepartmentInput");
  const activeInput = document.getElementById("employeeActiveInput");
  const lunchBreakInput = document.getElementById("employeeLunchBreakInput");
  const noteInput = document.getElementById("employeeNoteInput");

  editingIdInput.value = employee.id;
  codeInput.value = employee.id;
  nameInput.value = employee.name;
  departmentInput.value = employee.department || "";
  activeInput.checked = Boolean(employee.active);

  if (lunchBreakInput) {
    lunchBreakInput.checked = employee.lunchBreakEnabled !== false;
  }

  noteInput.value = employee.note || "";

  nameInput.focus();
}

function deleteEmployee(employeeId) {
  const employee = employees.find((item) => item.id === employeeId);

  if (!employee) {
    return;
  }

  const confirmed = confirm(`${t("employee.deleteConfirm")}\n\n${employee.id} - ${employee.name}`);

  if (!confirmed) {
    return;
  }

  employees = employees.filter((item) => item.id !== employeeId);
  saveEmployees(employees);

  resetEmployeeForm();
  renderEmployeesTable();
  renderEmployeeCards();
  renderEmployeeProfileEmployeeOptions();
  renderEmployeeProfile();

  alert(t("employee.deleted"));
}

function initScannerPage() {
  const startButton = document.getElementById("startScannerButton");
  const stopButton = document.getElementById("stopScannerButton");
  const switchCameraButton = document.getElementById("switchCameraButton");
  const manualInput = document.getElementById("manualScanInput");
  const manualButton = document.getElementById("manualScanButton");
  const checkInButton = document.getElementById("scanCheckInButton");
  const checkOutButton = document.getElementById("scanCheckOutButton");
  const cancelButton = document.getElementById("scanCancelButton");

  if (checkInButton) {
    checkInButton.addEventListener("click", () => {
      startDedicatedScanner("in");
    });
  }

  if (checkOutButton) {
    checkOutButton.addEventListener("click", () => {
      startDedicatedScanner("out");
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      resetDedicatedScanner();
    });
  }

  if (startButton) {
    startButton.addEventListener("click", () => {
      startCameraScanner();
    });
  }

  if (stopButton) {
    stopButton.addEventListener("click", () => {
      stopCameraScanner();
    });
  }

  if (switchCameraButton) {
    switchCameraButton.addEventListener("click", () => {
      switchScannerCamera();
    });
  }

  function readManualCode() {
    if (!manualInput) {
      return;
    }

    const code = manualInput.value.trim();

    if (!code) {
      manualInput.focus();
      return;
    }

    handleScannedCode(code, "manual");
    manualInput.value = "";
    manualInput.focus();
  }

  if (manualButton) {
    manualButton.addEventListener("click", () => {
      readManualCode();
    });
  }

  if (manualInput) {
    manualInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        readManualCode();
      }
    });
  }

  setScannerButtons(false);

  if (typeof initializeDedicatedScanner === "function") {
    initializeDedicatedScanner();
  }
}

function initCardsPage() {
  const refreshCardsButton = document.getElementById("refreshCardsButton");
  const printCardsButton = document.getElementById("printCardsButton");
  const selectAllCardsButton = document.getElementById("selectAllCardsButton");
  const clearCardSelectionButton = document.getElementById("clearCardSelectionButton");

  if (refreshCardsButton) {
    refreshCardsButton.addEventListener("click", () => {
      renderEmployeeCards();
    });
  }

  if (printCardsButton) {
    printCardsButton.addEventListener("click", () => {
      printEmployeeCards();
    });
  }

  if (selectAllCardsButton) {
    selectAllCardsButton.addEventListener("click", () => {
      setCardSelection(true);
    });
  }

  if (clearCardSelectionButton) {
    clearCardSelectionButton.addEventListener("click", () => {
      setCardSelection(false);
    });
  }

  renderEmployeeCards();
}

function renderEmployeeCards() {
  const cardsPrintArea = document.getElementById("cardsPrintArea");

  if (!cardsPrintArea) {
    return;
  }

  const activeEmployees = employees.filter((employee) => employee.active);

  if (activeEmployees.length === 0) {
    cardsPrintArea.innerHTML = `
      <div class="empty-row">${escapeHtml(t("cards.empty"))}</div>
    `;
    return;
  }

  cardsPrintArea.innerHTML = activeEmployees
    .map((employee) => {
      return buildEmployeeCardHtml(employee);
    })
    .join("");
}

function buildEmployeeCardHtml(employee) {
  const qrUrl = buildQrImageUrl(employee.id);

  return `
    <label class="employee-card-option">
      <input class="employee-card-select" type="checkbox" value="${escapeHtml(employee.id)}" checked />

      <div class="employee-card-pair" data-employee-id="${escapeHtml(employee.id)}">
        <div class="employee-card-print employee-card-qr-side">
          <img
            class="employee-card-qr"
            src="${qrUrl}"
            alt="${escapeHtml(employee.id)}"
          />
        </div>

        <div class="employee-card-print employee-card-info-side">
          <div class="employee-card-info-rotated">
            <div class="employee-card-company">${escapeHtml(appSettings.companyName || "Centru de sticla")}</div>
            <div class="employee-card-name">${escapeHtml(employee.name)}</div>
            <div class="employee-card-code">${escapeHtml(employee.department || "-")}</div>
            <div class="employee-card-id">${escapeHtml(employee.id)}</div>
          </div>
        </div>
      </div>
    </label>
  `;
}

function buildQrImageUrl(employeeCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=1&data=${encodeURIComponent(employeeCode)}`;
}

function printEmployeeCards() {
  const cardsPrintArea = document.getElementById("cardsPrintArea");

  if (!cardsPrintArea) {
    return;
  }

  const selectedEmployeeIds = getSelectedCardEmployeeIds();
  const employeesToPrint = employees
    .filter((employee) => employee.active)
    .filter((employee) => selectedEmployeeIds.includes(employee.id));

  if (employeesToPrint.length === 0) {
    alert(t("cards.noSelection"));
    return;
  }

  const previousFrame = document.getElementById("employeeCardsPrintFrame");
  if (previousFrame) {
    previousFrame.remove();
  }

  const printFrame = document.createElement("iframe");
  printFrame.id = "employeeCardsPrintFrame";
  printFrame.title = t("cards.title");
  printFrame.style.position = "fixed";
  printFrame.style.left = "-10000px";
  printFrame.style.top = "0";
  printFrame.style.width = "1px";
  printFrame.style.height = "1px";
  printFrame.style.border = "0";
  document.body.appendChild(printFrame);

  const printDocument = printFrame.contentDocument;
  const printWindow = printFrame.contentWindow;

  if (!printDocument || !printWindow) {
    printFrame.remove();
    alert(t("cards.printError"));
    return;
  }

  printDocument.open();
  printDocument.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(t("cards.title"))}</title>
      <style>
        body {
          margin: 0;
          padding: 8mm;
          font-family: Arial, sans-serif;
          background: white;
          color: #172033;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 68mm);
          column-gap: 10mm;
          row-gap: 10mm;
          align-items: start;
        }

        .employee-card-option {
          display: block;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .employee-card-option input {
          display: none;
        }

        .employee-card-pair {
          display: grid;
          grid-template-columns: repeat(2, 32mm);
          gap: 4mm;
          position: relative;
          outline: 0.2mm dashed #94a3b8;
          outline-offset: 1.5mm;
        }

        .employee-card-pair::before {
          content: attr(data-employee-id);
          position: absolute;
          left: 0;
          top: -4.5mm;
          font-size: 5pt;
          font-weight: bold;
          color: #64748b;
        }

        .employee-card-print {
          box-sizing: border-box;
          width: 32mm;
          height: 46mm;
          border: 0.2mm solid #172033;
          border-radius: 0;
          background: white;
          padding: 0;
          break-inside: avoid;
          page-break-inside: avoid;
          position: relative;
          overflow: hidden;
        }

        .employee-card-qr-side {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .employee-card-qr-side .employee-card-qr {
          display: block;
          box-sizing: border-box;
          width: 27mm;
          height: 27mm;
          object-fit: contain;
          background: white;
          padding: 0;
          margin: 0;
        }

        .employee-card-info-rotated {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 43mm;
          height: 29mm;
          box-sizing: border-box;
          padding: 2mm;
          transform: translate(-50%, -50%) rotate(90deg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .employee-card-info-side .employee-card-company {
          max-width: 39mm;
          font-size: 6.5pt;
          font-weight: bold;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employee-card-info-side .employee-card-name {
          max-width: 39mm;
          margin-top: 2mm;
          font-size: 11pt;
          font-weight: bold;
          line-height: 1.05;
          color: #111827;
          overflow: hidden;
        }

        .employee-card-info-side .employee-card-code {
          max-width: 39mm;
          margin-top: 1.5mm;
          font-size: 7.5pt;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employee-card-info-side .employee-card-id {
          margin-top: 2mm;
          font-size: 8pt;
          font-weight: bold;
          color: #1d4ed8;
        }

        @page {
          size: A4 portrait;
          margin: 8mm;
        }
      </style>
    </head>
    <body>
      <div class="cards-grid">
        ${employeesToPrint.map((employee) => buildEmployeeCardHtml(employee)).join("")}
      </div>

    </body>
    </html>
  `);
  printDocument.close();

  let printStarted = false;
  const startPrint = () => {
    if (printStarted) {
      return;
    }

    printStarted = true;
    printWindow.focus();
    printWindow.print();
  };
  const images = Array.from(printDocument.images);

  Promise.all(images.map((image) => {
    if (image.complete) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  })).then(() => {
    setTimeout(startPrint, 250);
  });

  setTimeout(startPrint, 4000);
  printWindow.addEventListener("afterprint", () => {
    setTimeout(() => printFrame.remove(), 500);
  }, { once: true });
}

function getSelectedCardEmployeeIds() {
  return Array.from(document.querySelectorAll(".employee-card-select:checked"))
    .map((input) => input.value);
}

function setCardSelection(isSelected) {
  document.querySelectorAll(".employee-card-select").forEach((input) => {
    input.checked = isSelected;
  });
}

function initAttendancePages() {
  const attendanceDateInput = document.getElementById("attendanceDateInput");
  const attendanceViewModeInput = document.getElementById("attendanceViewModeInput");
  const attendanceSearchInput = document.getElementById("attendanceSearchInput");
  const attendanceTodayButton = document.getElementById("attendanceTodayButton");
  const refreshInsideButton = document.getElementById("refreshInsideButton");
  const printDailyAttendanceButton = document.getElementById("printDailyAttendanceButton");
  const exportDailyXlsxButton = document.getElementById("exportDailyXlsxButton");
  const printWeeklyAttendanceButton = document.getElementById("printWeeklyAttendanceButton");
  const exportWeeklyXlsxButton = document.getElementById("exportWeeklyXlsxButton");
  const printMonthlyAttendanceButton = document.getElementById("printMonthlyAttendanceButton");
  const exportMonthlyXlsxButton = document.getElementById("exportMonthlyXlsxButton");
  const attendanceEditForm = document.getElementById("attendanceEditForm");
  const attendanceEditCancelButton = document.getElementById("attendanceEditCancelButton");
  const attendanceAddArrivalButton = document.getElementById("attendanceAddArrivalButton");
  const attendanceAddDepartureButton = document.getElementById("attendanceAddDepartureButton");

  if (attendanceDateInput) {
    setDateControlValue(attendanceDateInput, getDateKey(new Date()));

    attendanceDateInput.addEventListener("change", () => {
      resetAttendanceEditForm();
      renderAttendanceList();
    });
  }

  if (attendanceViewModeInput) {
    attendanceViewModeInput.addEventListener("change", () => {
      resetAttendanceEditForm();
      renderAttendanceList();
    });
  }

  if (attendanceSearchInput) {
    attendanceSearchInput.addEventListener("input", () => {
      resetAttendanceEditForm();
      renderAttendanceList();
    });
  }

  if (attendanceTodayButton) {
    attendanceTodayButton.addEventListener("click", () => {
      if (attendanceDateInput) {
        setDateControlValue(attendanceDateInput, getDateKey(new Date()));
      }

      resetAttendanceEditForm();
      renderAttendanceList();
    });
  }

  if (printDailyAttendanceButton) {
    printDailyAttendanceButton.addEventListener("click", () => {
      exportDailyPdf();
    });
  }

  if (printWeeklyAttendanceButton) {
    printWeeklyAttendanceButton.addEventListener("click", () => {
      exportWeeklyPdf();
    });
  }

  if (exportDailyXlsxButton) {
    exportDailyXlsxButton.addEventListener("click", () => {
      exportDailyXlsx();
    });
  }

  if (exportWeeklyXlsxButton) {
    exportWeeklyXlsxButton.addEventListener("click", () => {
      exportWeeklyXlsx();
    });
  }

  if (printMonthlyAttendanceButton) {
    printMonthlyAttendanceButton.addEventListener("click", () => {
      exportMonthlyPdf();
    });
  }

  if (exportMonthlyXlsxButton) {
    exportMonthlyXlsxButton.addEventListener("click", () => {
      exportMonthlyXlsx();
    });
  }

  if (refreshInsideButton) {
    refreshInsideButton.addEventListener("click", () => {
      renderInsideList();
    });
  }

  if (attendanceEditForm) {
    attendanceEditForm.addEventListener("submit", (event) => {
      saveAttendanceEditForm(event);
    });
  }

  if (attendanceEditCancelButton) {
    attendanceEditCancelButton.addEventListener("click", () => {
      resetAttendanceEditForm();
    });
  }

  if (attendanceAddArrivalButton) {
    attendanceAddArrivalButton.addEventListener("click", () => {
      addAttendanceEditRow({ type: "in" });
    });
  }

  if (attendanceAddDepartureButton) {
    attendanceAddDepartureButton.addEventListener("click", () => {
      addAttendanceEditRow({ type: "out" });
    });
  }

  renderInsideList();
  renderAttendanceList();
}

function registerAttendanceEvent(employee, source = "camera", forcedType = null) {
  if (!employee || !employee.active) {
    return null;
  }

  const now = new Date();
  const eventType = forcedType === "in" || forcedType === "out"
    ? forcedType
    : getNextAttendanceType(employee.id, now);

  const newEvent = {
    id: `ATT-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department || "",
    type: eventType,
    source: source,
    createdAt: now.toISOString(),
    dateKey: getDateKey(now)
  };

  attendanceEvents.push(newEvent);
  saveAttendanceEvents(attendanceEvents);

  renderInsideList();
  renderAttendanceList();
  renderEmployeeProfile();
  renderStatisticsPage();
  renderMonthlyAccountingPage();

  return newEvent;
}

function getNextAttendanceType(employeeId, date = new Date()) {
  const dateKey = getDateKey(date);

  const todayEvents = attendanceEvents
    .filter((event) => event.employeeId === employeeId && event.dateKey === dateKey)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const lastEvent = todayEvents[todayEvents.length - 1];

  if (!lastEvent || lastEvent.type === "out") {
    return "in";
  }

  return "out";
}

function renderInsideList() {
  const tableBody = document.getElementById("insideTableBody");
  const summaryBox = document.getElementById("insideSummary");

  renderDashboardSummary();

  if (!tableBody) {
    return;
  }

  const latestEventsByEmployee = new Map();

  attendanceEvents
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((event) => {
      latestEventsByEmployee.set(event.employeeId, event);
    });

  const insideEmployees = employees
    .filter((employee) => employee.active)
    .map((employee) => {
      const latestEvent = latestEventsByEmployee.get(employee.id);

      return {
        employee,
        latestEvent
      };
    })
    .filter((item) => item.latestEvent && item.latestEvent.type === "in");

  if (summaryBox) {
    summaryBox.textContent = `${t("inside.summary")}: ${insideEmployees.length}`;
  }

  if (insideEmployees.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">${escapeHtml(t("inside.empty"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = insideEmployees
    .map((item) => {
      return `
        <tr>
          <td><strong>${escapeHtml(item.employee.id)}</strong></td>
          <td>${escapeHtml(item.employee.name)}</td>
          <td>${escapeHtml(item.employee.department || "-")}</td>
          <td>${escapeHtml(formatTimeFromIso(item.latestEvent.createdAt))}</td>
          <td>
            <span class="event-badge event-badge-in">
              ${escapeHtml(getAttendanceTypeLabel(item.latestEvent.type))}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAttendanceList() {
  const tableBody = document.getElementById("attendanceTableBody");
  const dateInput = document.getElementById("attendanceDateInput");
  const summaryBox = document.getElementById("attendanceSummary");

  if (!tableBody) {
    return;
  }

  const selectedDateKey = dateInput && getDateControlValue(dateInput)
    ? getDateControlValue(dateInput)
    : getDateKey(new Date());

  const searchTerm = getAttendanceSearchTerm();
  const viewMode = getAttendanceViewMode();

  if (viewMode === "weekly" || viewMode === "monthly") {
    renderPeriodAttendanceList(viewMode, selectedDateKey, searchTerm, tableBody, summaryBox);
    return;
  }

  renderDailyAttendanceList(selectedDateKey, searchTerm, tableBody, summaryBox);
}

function renderDailyAttendanceList(selectedDateKey, searchTerm, tableBody, summaryBox) {
  renderAttendanceEventTableHeader();
  renderDailySummaryHeader();
  setDailySummaryTitle("attendance.dailySummaryTitle");

  const selectedEvents = attendanceEvents
    .filter((event) => event.dateKey === selectedDateKey)
    .filter((event) => matchesAttendanceSearch(event, searchTerm))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));      

  if (summaryBox) {
    summaryBox.textContent = `${formatDisplayDate(selectedDateKey)} • ${selectedEvents.length}`;
  }

  renderOpenDayWarning(selectedDateKey, searchTerm);
  renderDailySummary(selectedDateKey, searchTerm);

  if (selectedEvents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">${escapeHtml(t("attendance.empty"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = selectedEvents
    .map((event) => {
      const employee = employees.find((item) => item.id === event.employeeId);

      const employeeName = employee
        ? employee.name
        : event.employeeName || "-";

      const department = employee
        ? employee.department || "-"
        : event.department || "-";

      const badgeClass = event.type === "in" ? "event-badge-in" : "event-badge-out";

      return `
        <tr>
          <td>${escapeHtml(formatTimeFromIso(event.createdAt))}</td>
          <td>
            <span class="event-badge ${badgeClass}">
              ${escapeHtml(getAttendanceTypeLabel(event.type))}
            </span>
          </td>
          <td><strong>${escapeHtml(event.employeeId)}</strong></td>
          <td>${escapeHtml(employeeName)}</td>
          <td>${escapeHtml(department)}</td>
          <td>${escapeHtml(getAttendanceSourceLabel(event.source))}</td>
          <td>${escapeHtml(formatDisplayDate(event.dateKey))}</td>
          <td>
            <button type="button" class="small-btn" onclick="editAttendanceEvent('${escapeHtml(event.id)}')">
              ${escapeHtml(t("common.edit"))}
            </button>
            <button type="button" class="danger-btn" onclick="deleteAttendanceEvent('${escapeHtml(event.id)}')">
              ${escapeHtml(t("common.delete"))}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderOpenDayWarning(dateKey, searchTerm = "") {
  const warningBox = document.getElementById("openDayWarningBox");

  if (!warningBox) {
    return;
  }

  const eventsForDay = attendanceEvents
    .filter((event) => event.dateKey === dateKey)
    .filter((event) => matchesAttendanceSearch(event, searchTerm))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (eventsForDay.length === 0) {
    warningBox.textContent = "";
    warningBox.classList.add("hidden");
    return;
  }

  const employeeIds = [...new Set(eventsForDay.map((event) => event.employeeId))];

  const openSummaries = employeeIds
    .map((employeeId) => {
      const employee = employees.find((item) => item.id === employeeId);
      const firstEvent = eventsForDay.find((event) => event.employeeId === employeeId);

      return calculateDailySummary({
        employeeId,
        employeeName: employee ? employee.name : firstEvent.employeeName || "-",
        department: employee ? employee.department || "-" : firstEvent.department || "-",
        dateKey
      });
    })
    .filter((summary) => summary.isOpen);

  if (openSummaries.length === 0) {
    warningBox.textContent = "";
    warningBox.classList.add("hidden");
    return;
  }

  const warningKey = openSummaries.length === 1
    ? "attendance.openDayWarningOne"
    : "attendance.openDayWarningMany";

  warningBox.textContent = t(warningKey).replace("{count}", String(openSummaries.length));
  warningBox.classList.remove("hidden");
}

function getAttendanceSearchTerm() {
  const searchInput = document.getElementById("attendanceSearchInput");

  if (!searchInput) {
    return "";
  }

  return searchInput.value.trim().toLowerCase();
}

function getAttendanceViewMode() {
  const viewModeInput = document.getElementById("attendanceViewModeInput");
  const viewMode = viewModeInput ? viewModeInput.value : "daily";

  return ["daily", "weekly", "monthly"].includes(viewMode) ? viewMode : "daily";
}

function matchesAttendanceSearch(event, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const employee = employees.find((item) => item.id === event.employeeId);

  const employeeName = employee
    ? employee.name
    : event.employeeName || "";

  const department = employee
    ? employee.department || ""
    : event.department || "";

  const searchableText = [
    event.employeeId,
    employeeName,
    department
  ].join(" ").toLowerCase();

  return searchableText.includes(searchTerm);
}

function matchesSummarySearch(summary, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const searchableText = [
    summary.employeeId,
    summary.employeeName,
    summary.department || ""
  ].join(" ").toLowerCase();

  return searchableText.includes(searchTerm);
}

function renderAttendanceEventTableHeader() {
  const headRow = document.getElementById("attendanceTableHeadRow");

  if (!headRow) {
    return;
  }

  headRow.innerHTML = [
    "attendance.time",
    "attendance.eventType",
    "attendance.code",
    "attendance.employee",
    "attendance.department",
    "attendance.source",
    "attendance.date",
    "common.actions"
  ].map((key) => `<th>${escapeHtml(t(key))}</th>`).join("");
}

function renderAttendancePeriodBreakdownHeader() {
  const headRow = document.getElementById("attendanceTableHeadRow");

  if (!headRow) {
    return;
  }

  headRow.innerHTML = [
    "attendance.date",
    "attendance.code",
    "attendance.employee",
    "attendance.department",
    "attendance.firstArrival",
    "attendance.lastDeparture",
    "attendance.rawWorked",
    "attendance.lunchDeduction",
    "attendance.netWorked",
    "attendance.overtime",
    "attendance.missing",
    "attendance.balance",
    "attendance.dayStatus"
  ].map((key) => `<th>${escapeHtml(t(key))}</th>`).join("");
}

function renderDailySummaryHeader() {
  const headRow = document.getElementById("dailySummaryTableHeadRow");

  if (!headRow) {
    return;
  }

  headRow.innerHTML = [
    "attendance.code",
    "attendance.employee",
    "attendance.department",
    "attendance.firstArrival",
    "attendance.lastDeparture",
    "attendance.rawWorked",
    "attendance.lunchDeduction",
    "attendance.netWorked",
    "attendance.overtime",
    "attendance.missing",
    "attendance.balance",
    "attendance.dayStatus"
  ].map((key) => `<th>${escapeHtml(t(key))}</th>`).join("");
}

function renderPeriodSummaryHeader() {
  const headRow = document.getElementById("dailySummaryTableHeadRow");

  if (!headRow) {
    return;
  }

  headRow.innerHTML = [
    "attendance.code",
    "attendance.employee",
    "attendance.department",
    "attendance.workDays",
    "attendance.rawWorked",
    "attendance.lunchDeduction",
    "attendance.netWorked",
    "attendance.overtime",
    "attendance.missing",
    "attendance.balance",
    "attendance.openDays"
  ].map((key) => `<th>${escapeHtml(t(key))}</th>`).join("");
}

function setDailySummaryTitle(languageKey) {
  const title = document.getElementById("dailySummaryTitle");

  if (title) {
    title.textContent = t(languageKey);
  }
}

function renderPeriodEmployeeSummary(employeeSummaries) {
  const tableBody = document.getElementById("dailySummaryTableBody");

  if (!tableBody) {
    return;
  }

  if (!employeeSummaries || employeeSummaries.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-row">${escapeHtml(t("attendance.noPeriodSummary"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = employeeSummaries
    .map((summary) => {
      const balanceClass = getBalanceClass(summary.balanceMinutes);

      return `
        <tr>
          <td><strong>${escapeHtml(summary.employeeId)}</strong></td>
          <td>${escapeHtml(summary.employeeName)}</td>
          <td>${escapeHtml(summary.department || "-")}</td>
          <td><strong>${escapeHtml(String(summary.workDays))}</strong></td>
          <td>${escapeHtml(formatDuration(summary.rawWorkedMinutes))}</td>
          <td>${escapeHtml(formatDuration(summary.lunchDeductionMinutes))}</td>
          <td><strong>${escapeHtml(formatDuration(summary.netWorkedMinutes))}</strong></td>
          <td class="balance-positive"><strong>${escapeHtml(formatDuration(summary.overtimeMinutes))}</strong></td>
          <td class="balance-negative"><strong>${escapeHtml(formatDuration(summary.missingMinutes))}</strong></td>
          <td class="${balanceClass}">
            <strong>${escapeHtml(formatSignedDuration(summary.balanceMinutes))}</strong>
          </td>
          <td><strong>${escapeHtml(String(summary.openDays))}</strong></td>
        </tr>
      `;
    })
    .join("");
}

function renderDashboardSummary() {
  const insideCountBox = document.getElementById("dashboardInsideCount");
  const todayEventsBox = document.getElementById("dashboardTodayEvents");
  const openDaysBox = document.getElementById("dashboardOpenDays");
  const activeEmployeesBox = document.getElementById("dashboardActiveEmployees");

  if (!insideCountBox && !todayEventsBox && !openDaysBox && !activeEmployeesBox) {
    return;
  }

  const todayKey = getDateKey(new Date());
  const activeEmployees = employees.filter((employee) => employee.active);
  const todayEvents = attendanceEvents.filter((event) => event.dateKey === todayKey);
  const latestEventsByEmployee = new Map();

  attendanceEvents
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((event) => {
      latestEventsByEmployee.set(event.employeeId, event);
    });

  const insideCount = activeEmployees.filter((employee) => {
    const latestEvent = latestEventsByEmployee.get(employee.id);
    return latestEvent && latestEvent.type === "in";
  }).length;

  const todayEmployeeIds = [...new Set(todayEvents.map((event) => event.employeeId))];
  const openDaysCount = todayEmployeeIds
    .map((employeeId) => {
      const employee = employees.find((item) => item.id === employeeId);
      const firstEvent = todayEvents.find((event) => event.employeeId === employeeId);

      return calculateDailySummary({
        employeeId,
        employeeName: employee ? employee.name : firstEvent.employeeName || "-",
        department: employee ? employee.department || "-" : firstEvent.department || "-",
        dateKey: todayKey
      });
    })
    .filter((summary) => summary.isOpen).length;

  if (insideCountBox) {
    insideCountBox.textContent = String(insideCount);
  }

  if (todayEventsBox) {
    todayEventsBox.textContent = String(todayEvents.length);
  }

  if (openDaysBox) {
    openDaysBox.textContent = String(openDaysCount);
  }

  if (activeEmployeesBox) {
    activeEmployeesBox.textContent = String(activeEmployees.length);
  }
}

function renderDailySummary(dateKey, searchTerm = "") {
  const tableBody = document.getElementById("dailySummaryTableBody");

  if (!tableBody) {
    return;
  }

  const eventsForDay = attendanceEvents
    .filter((event) => event.dateKey === dateKey)
    .filter((event) => matchesAttendanceSearch(event, searchTerm))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (eventsForDay.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-row">${escapeHtml(t("attendance.noSummary"))}</td>
      </tr>
    `;
    return;
  }

  const employeeIds = [...new Set(eventsForDay.map((event) => event.employeeId))];

  const summaries = employeeIds.map((employeeId) => {
    const employee = employees.find((item) => item.id === employeeId);
    const firstEvent = eventsForDay.find((event) => event.employeeId === employeeId);

    return calculateDailySummary({
      employeeId,
      employeeName: employee ? employee.name : firstEvent.employeeName || "-",
      department: employee ? employee.department || "-" : firstEvent.department || "-",
      dateKey
    });
  });

  tableBody.innerHTML = summaries
    .map((summary) => {
      const balanceClass = getBalanceClass(summary.balanceMinutes);
      const statusClass = summary.isIncomplete ? "daily-status-open" : "daily-status-closed";

      return `
        <tr>
          <td><strong>${escapeHtml(summary.employeeId)}</strong></td>
          <td>${escapeHtml(summary.employeeName)}</td>
          <td>${escapeHtml(summary.department || "-")}</td>
          <td>${escapeHtml(summary.firstArrival || "-")}</td>
          <td>${escapeHtml(summary.lastDeparture || "-")}</td>
          <td>${escapeHtml(formatDuration(summary.rawWorkedMinutes))}</td>
          <td>${escapeHtml(formatDuration(summary.lunchDeductionMinutes))}</td>
          <td><strong>${escapeHtml(formatDuration(summary.netWorkedMinutes))}</strong></td>
          <td class="balance-positive"><strong>${escapeHtml(formatDuration(summary.overtimeMinutes))}</strong></td>
          <td class="balance-negative"><strong>${escapeHtml(formatDuration(summary.missingMinutes))}</strong></td>
          <td class="${balanceClass}">
            <strong>${escapeHtml(formatSignedDuration(summary.balanceMinutes))}</strong>
          </td>
          <td>
            <span class="daily-status-badge ${statusClass}">
              ${escapeHtml(summary.statusText)}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function calculateDailySummary(summaryData) {
  const dayEvents = attendanceEvents
    .filter((event) => event.employeeId === summaryData.employeeId && event.dateKey === summaryData.dateKey)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let currentInTime = null;
  let rawWorkedMinutes = 0;
  let firstArrival = "";
  let lastDeparture = "";
  let isOpen = false;
  let hasInvalidOrder = false;

  dayEvents.forEach((event) => {
    if (event.type === "in") {
      if (!firstArrival) {
        firstArrival = formatTimeFromIso(event.createdAt);
      }

      if (currentInTime) {
        hasInvalidOrder = true;
      } else {
        currentInTime = new Date(event.createdAt);
      }

      return;
    }

    if (event.type === "out") {
      lastDeparture = formatTimeFromIso(event.createdAt);

      if (currentInTime) {
        const outTime = new Date(event.createdAt);
        rawWorkedMinutes += Math.max(0, Math.round((outTime - currentInTime) / 60000));
        currentInTime = null;
      } else {
        hasInvalidOrder = true;
      }
    }
  });

  if (currentInTime) {
    isOpen = true;

    if (summaryData.dateKey === getDateKey(new Date())) {
      rawWorkedMinutes += Math.max(0, Math.round((new Date() - currentInTime) / 60000));
    }
  }

  const employeeSettings = employees.find((item) => item.id === summaryData.employeeId);
  const lunchBreakEnabled = employeeSettings
    ? employeeSettings.lunchBreakEnabled !== false
    : true;

  const lunchDeductionMinutes = lunchBreakEnabled && rawWorkedMinutes >= 240
    ? appSettings.lunchBreakMinutes
    : 0;

  const netWorkedMinutes = Math.max(0, rawWorkedMinutes - lunchDeductionMinutes);
  const isWeekendDay = isNonWorkingDateKey(summaryData.dateKey);

  const balanceMinutes = isOpen
    ? 0
    : isWeekendDay
      ? netWorkedMinutes
      : netWorkedMinutes - appSettings.dailyNormMinutes;
  const overtimeMinutes = Math.max(0, balanceMinutes);
  const missingMinutes = Math.max(0, -balanceMinutes);

  const isIncomplete = isOpen || hasInvalidOrder;
  const statusText = isIncomplete
    ? t("attendance.statusIncomplete")
    : t("attendance.statusClosed");

  return {
    employeeId: summaryData.employeeId,
    employeeName: summaryData.employeeName,
    department: summaryData.department,
    dateKey: summaryData.dateKey,
    firstArrival,
    lastDeparture,
    rawWorkedMinutes,
    lunchDeductionMinutes,
    netWorkedMinutes,
    overtimeMinutes,
    missingMinutes,
    balanceMinutes,
    isOpen,
    hasInvalidOrder,
    isIncomplete,
    statusText
  };
}

function formatDuration(totalMinutes) {
  const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatSignedDuration(totalMinutes) {
  const safeMinutes = Number(totalMinutes) || 0;

  if (safeMinutes === 0) {
    return "00:00";
  }

  const sign = safeMinutes > 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(safeMinutes))}`;
}

function getSettingMoneyValue(settingName) {
  return Math.max(0, Number(appSettings[settingName]) || 0);
}

function formatMoneyValue(value) {
  const safeValue = Number(value) || 0;
  return `${safeValue.toFixed(2)} lei`;
}

function calculateEmployeePaymentValues(reportData) {
  const overtimeHourlyRate = getSettingMoneyValue("overtimeHourlyRate");
  const mealVoucherDailyValue = getSettingMoneyValue("mealVoucherDailyValue");

  const dailyRows = Array.isArray(reportData.dailyRows) ? reportData.dailyRows : [];
  const balanceMinutes = Number(reportData.balanceMinutes) || 0;
  const payableOvertimeMinutes = Math.max(0, balanceMinutes);
  const payableOvertimeHours = payableOvertimeMinutes / 60;

  const mealVoucherDays = dailyRows.filter((row) => {
    return Number(row.netWorkedMinutes) > 0 && !isNonWorkingDateKey(row.dateKey);
  }).length;

  const overtimeValue = payableOvertimeHours * overtimeHourlyRate;
  const mealVoucherValue = mealVoucherDays * mealVoucherDailyValue;
  const paymentTotal = overtimeValue + mealVoucherValue;

  return {
    overtimeHourlyRate,
    mealVoucherDailyValue,
    payableOvertimeMinutes,
    payableOvertimeHours,
    overtimeValue,
    mealVoucherDays,
    mealVoucherValue,
    paymentTotal
  };
}

function getBalanceClass(balanceMinutes) {
  if (balanceMinutes > 0) {
    return "balance-positive";
  }

  if (balanceMinutes < 0) {
    return "balance-negative";
  }

  return "balance-neutral";
}

function editAttendanceEvent(eventId) {
  const selectedEvent = attendanceEvents.find((item) => item.id === eventId);

  if (!selectedEvent) {
    alert(t("attendance.eventRequired"));
    return;
  }

  const editBox = document.getElementById("attendanceEditForm");
  const employeeIdInput = document.getElementById("attendanceEditEmployeeIdInput");
  const originalDateInput = document.getElementById("attendanceEditOriginalDateInput");
  const employeeNameBox = document.getElementById("attendanceEditEmployeeName");
  const dateInput = document.getElementById("attendanceEditDateInput");
  const eventsList = document.getElementById("attendanceEditEventsList");

  if (!editBox || !employeeIdInput || !originalDateInput || !employeeNameBox || !dateInput || !eventsList) {
    return;
  }

  const dayEvents = attendanceEvents
    .filter((item) => item.employeeId === selectedEvent.employeeId && item.dateKey === selectedEvent.dateKey)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const employee = employees.find((item) => item.id === selectedEvent.employeeId);

  employeeIdInput.value = selectedEvent.employeeId;
  originalDateInput.value = selectedEvent.dateKey;
  employeeNameBox.textContent = employee ? `${employee.name} (${employee.id})` : selectedEvent.employeeName || selectedEvent.employeeId;
  setDateControlValue(dateInput, selectedEvent.dateKey);
  renderAttendanceEditRows(dayEvents);

  editBox.classList.remove("hidden");
  editBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderAttendanceEditRows(events) {
  const eventsList = document.getElementById("attendanceEditEventsList");

  if (!eventsList) {
    return;
  }

  eventsList.innerHTML = "";

  events.forEach((item) => {
    addAttendanceEditRow({
      eventId: item.id,
      type: item.type,
      time: formatTimeFromIso(item.createdAt)
    });
  });
}

function addAttendanceEditRow({ eventId = "", type = "in", time = "" } = {}) {
  const eventsList = document.getElementById("attendanceEditEventsList");

  if (!eventsList) {
    return;
  }

  const row = document.createElement("div");
  row.className = "attendance-edit-row";
  row.dataset.eventId = eventId;

  row.innerHTML = `
    <select class="attendance-edit-type" aria-label="${escapeHtml(t("attendance.eventType"))}">
      <option value="in" ${type === "in" ? "selected" : ""}>${escapeHtml(t("attendance.in"))}</option>
      <option value="out" ${type === "out" ? "selected" : ""}>${escapeHtml(t("attendance.out"))}</option>
    </select>
    <input class="attendance-edit-time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${escapeHtml(time)}" />
    <button type="button" class="danger-btn" data-action="remove-attendance-row">${escapeHtml(t("common.delete"))}</button>
  `;

  const removeButton = row.querySelector('[data-action="remove-attendance-row"]');
  const timeInput = row.querySelector(".attendance-edit-time");

  if (removeButton) {
    removeButton.addEventListener("click", () => {
      row.remove();
    });
  }

  eventsList.appendChild(row);
  setTimeControlValue(timeInput, time);
}

function getAttendanceEditRows() {
  const eventsList = document.getElementById("attendanceEditEventsList");

  if (!eventsList) {
    return [];
  }

  return Array.from(eventsList.querySelectorAll(".attendance-edit-row")).map((row) => {
    const typeInput = row.querySelector(".attendance-edit-type");
    const timeInput = row.querySelector(".attendance-edit-time");

    return {
      eventId: row.dataset.eventId || "",
      type: typeInput ? typeInput.value : "in",
      time: timeInput ? timeInput.value.trim() : ""
    };
  });
}

function saveAttendanceEditForm(event) {
  event.preventDefault();

  const employeeIdInput = document.getElementById("attendanceEditEmployeeIdInput");
  const originalDateInput = document.getElementById("attendanceEditOriginalDateInput");
  const dateInput = document.getElementById("attendanceEditDateInput");

  if (!employeeIdInput || !originalDateInput || !dateInput) {
    return;
  }

  const employeeId = employeeIdInput.value.trim();
  const originalDateKey = originalDateInput.value.trim();
  const dateKey = getDateControlValue(dateInput);
  const editRows = getAttendanceEditRows();

  if (!employeeId || !dateKey || editRows.length === 0) {
    alert(t("attendance.eventRequired"));
    return;
  }

  const invalidRow = editRows.find((row) => {
    return !row.time || !isValidTimeValue(row.time) || !["in", "out"].includes(row.type);
  });

  if (invalidRow) {
    alert(t("attendance.invalidTimeFormat"));
    return;
  }

  const employee = employees.find((item) => item.id === employeeId);
  const referenceEvent = attendanceEvents.find((item) => item.employeeId === employeeId && item.dateKey === originalDateKey)
    || attendanceEvents.find((item) => item.employeeId === employeeId);

  if (!employee && !referenceEvent) {
    alert(t("attendance.eventRequired"));
    return;
  }

  const now = new Date().toISOString();
  const oldDayKey = originalDateKey || dateKey;

  attendanceEvents = attendanceEvents.filter((item) => !(item.employeeId === employeeId && item.dateKey === oldDayKey));

  editRows
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach((row) => {
      const createdAt = buildIsoFromDateAndTime(dateKey, row.time, now);

      attendanceEvents.push({
        id: row.eventId || `ATT-${Date.now()}-${row.type}-${Math.random().toString(16).slice(2)}`,
        employeeId,
        employeeName: employee ? employee.name : referenceEvent.employeeName || "",
        department: employee ? employee.department || "" : referenceEvent.department || "",
        type: row.type,
        source: "manual",
        createdAt,
        dateKey,
        updatedAt: now
      });
    });

  saveAttendanceEvents(attendanceEvents);
  resetAttendanceEditForm();
  renderInsideList();
  renderAttendanceList();
  renderEmployeeProfile();
  renderStatisticsPage();
  renderMonthlyAccountingPage();

  alert(t("attendance.eventUpdated"));
}

function deleteAttendanceEvent(eventId) {
  const event = attendanceEvents.find((item) => item.id === eventId);

  if (!event) {
    alert(t("attendance.eventRequired"));
    return;
  }

  const employeeName = event.employeeName || event.employeeId;
  const eventText = `${formatDisplayDate(event.dateKey)} ${formatTimeFromIso(event.createdAt)} - ${getAttendanceTypeLabel(event.type)}`;

  const confirmed = confirm(`${t("attendance.deleteConfirm")}\n\n${employeeName}\n${eventText}`);

  if (!confirmed) {
    return;
  }

  attendanceEvents = attendanceEvents.filter((item) => item.id !== eventId);
  saveAttendanceEvents(attendanceEvents);

  resetAttendanceEditForm();
  renderInsideList();
  renderAttendanceList();
  renderEmployeeProfile();
  renderStatisticsPage();
  renderMonthlyAccountingPage();

  alert(t("attendance.eventDeleted"));
}

function resetAttendanceEditForm() {
  const editBox = document.getElementById("attendanceEditForm");
  const employeeIdInput = document.getElementById("attendanceEditEmployeeIdInput");
  const arrivalIdInput = document.getElementById("attendanceEditArrivalIdInput");
  const departureIdInput = document.getElementById("attendanceEditDepartureIdInput");
  const originalDateInput = document.getElementById("attendanceEditOriginalDateInput");
  const employeeNameBox = document.getElementById("attendanceEditEmployeeName");
  const dateInput = document.getElementById("attendanceEditDateInput");
  const eventsList = document.getElementById("attendanceEditEventsList");

  [employeeIdInput, arrivalIdInput, departureIdInput, originalDateInput].forEach((input) => {
    if (input) input.value = "";
  });

  if (employeeNameBox) employeeNameBox.textContent = "-";

  if (dateInput) {
    dateInput.value = "";
  }

  if (eventsList) {
    eventsList.innerHTML = "";
  }

  if (editBox) {
    editBox.classList.add("hidden");
  }
}
function buildIsoFromDateAndTime(dateKey, timeValue, originalIsoDate) {
  const dateParts = String(dateKey).split("-").map(Number);
  const timeParts = String(timeValue).split(":").map(Number);

  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  const hours = timeParts[0];
  const minutes = timeParts[1];

  const originalDate = originalIsoDate ? new Date(originalIsoDate) : new Date();
  const seconds = originalDate.getSeconds();

  const newDate = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  return newDate.toISOString();
}

function getAttendanceTypeLabel(type) {
  return type === "in" ? t("attendance.in") : t("attendance.out");
}

function getAttendanceSourceLabel(source) {
  return source === "manual" ? t("scan.sourceManual") : t("scan.sourceCamera");
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
  const parts = String(dateKey).split("-");

  if (parts.length !== 3) {
    return dateKey;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function parseDisplayDateInput(value) {
  const textValue = String(value || "").trim();
  const isoMatch = textValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const displayMatch = textValue.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  const year = isoMatch ? Number(isoMatch[1]) : displayMatch ? Number(displayMatch[3]) : 0;
  const month = isoMatch ? Number(isoMatch[2]) : displayMatch ? Number(displayMatch[2]) : 0;
  const day = isoMatch ? Number(isoMatch[3]) : displayMatch ? Number(displayMatch[1]) : 0;

  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDateControlValue(input) {
  return input ? parseDisplayDateInput(input.value) : "";
}

function setDateControlValue(input, dateKey) {
  if (input) {
    if (input._flatpickr) {
      input._flatpickr.setDate(dateKey || "", false, "Y-m-d");
    } else {
      input.value = dateKey ? formatDisplayDate(dateKey) : "";
    }
  }
}

function isValidTimeValue(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function setTimeControlValue(input, timeValue) {
  if (!input) {
    return;
  }

  if (input._flatpickr) {
    input._flatpickr.setDate(timeValue || "", false, "H:i");
  } else {
    input.value = timeValue || "";
  }
}

function isWeekendDateKey(dateKey) {
  const parts = String(dateKey).split("-").map(Number);

  if (parts.length !== 3) {
    return false;
  }

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  const date = new Date(year, month - 1, day);
  const dayNumber = date.getDay();

  return dayNumber === 0 || dayNumber === 6;
}

function getCompanyDays() {
  return Array.isArray(appSettings.companyDays) ? appSettings.companyDays : [];
}

function getCompanyDay(dateKey) {
  return getCompanyDays().find((item) => {
    const startDate = item.startDate || item.date;
    const endDate = item.endDate || item.date;
    return startDate <= dateKey && endDate >= dateKey;
  }) || null;
}

function isNonWorkingDateKey(dateKey) {
  return isWeekendDateKey(dateKey) || Boolean(getCompanyDay(dateKey));
}

function formatTimeFromIso(isoDate) {
  const date = new Date(isoDate);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function initProfilePage() {
  const employeeSearchInput = document.getElementById("profileEmployeeSearchInput");
  const employeeSelect = document.getElementById("profileEmployeeSelect");
  const monthInput = document.getElementById("profileMonthInput");
  const refreshButton = document.getElementById("profileRefreshButton");
  const profilePrintPdfButton = document.getElementById("profilePrintPdfButton");
  const profileExportXlsxButton = document.getElementById("profileExportXlsxButton");

  if (monthInput) {
    monthInput.value = getMonthKey(new Date());

    monthInput.addEventListener("change", () => {
      renderEmployeeProfile();
    });
  }

  if (employeeSearchInput) {
    employeeSearchInput.addEventListener("input", () => {
      renderEmployeeProfileEmployeeOptions();
      renderEmployeeProfile();
    });
  }

  if (employeeSelect) {
    employeeSelect.addEventListener("change", () => {
      renderEmployeeProfile();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      renderEmployeeProfileEmployeeOptions();
      renderEmployeeProfile();
    });
  }

  if (profilePrintPdfButton) {
    profilePrintPdfButton.addEventListener("click", () => {
      exportEmployeePdf();
    });
  }

  if (profileExportXlsxButton) {
    profileExportXlsxButton.addEventListener("click", () => {
      exportEmployeeXlsx();
    });
  }

  renderEmployeeProfileEmployeeOptions();
  renderEmployeeProfile();
}

function renderEmployeeProfileEmployeeOptions() {
  const employeeSelect = document.getElementById("profileEmployeeSelect");
  const employeeSearchInput = document.getElementById("profileEmployeeSearchInput");

  if (!employeeSelect) {
    return;
  }

  const currentValue = employeeSelect.value;
  const searchText = employeeSearchInput
    ? employeeSearchInput.value.trim().toLowerCase()
    : "";

  if (employees.length === 0) {
    employeeSelect.innerHTML = `
      <option value="">${escapeHtml(t("profile.noEmployees"))}</option>
    `;
    return;
  }

  const filteredEmployees = employees.filter((employee) => {
    const searchableText = [
      employee.id,
      employee.name,
      employee.department || ""
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchText);
  });

  if (filteredEmployees.length === 0) {
    employeeSelect.innerHTML = `
      <option value="">${escapeHtml(t("profile.noSearchResults"))}</option>
    `;
    return;
  }

  employeeSelect.innerHTML = `
    <option value="">${escapeHtml(t("profile.selectEmployee"))}</option>
    ${filteredEmployees
      .map((employee) => {
        const statusText = employee.active ? t("employee.active") : t("employee.inactive");

        return `
          <option value="${escapeHtml(employee.id)}">
            ${escapeHtml(employee.id)} - ${escapeHtml(employee.name)} (${escapeHtml(statusText)})
          </option>
        `;
      })
      .join("")}
  `;

  if (currentValue && filteredEmployees.some((employee) => employee.id === currentValue)) {
    employeeSelect.value = currentValue;
    return;
  }

  const firstActiveEmployee = filteredEmployees.find((employee) => employee.active);
  employeeSelect.value = firstActiveEmployee ? firstActiveEmployee.id : filteredEmployees[0].id;
}

function renderEmployeeProfile() {
  const employeeSelect = document.getElementById("profileEmployeeSelect");
  const monthInput = document.getElementById("profileMonthInput");
  const selectedTitle = document.getElementById("profileSelectedTitle");
  const summaryCards = document.getElementById("profileSummaryCards");
  const tableBody = document.getElementById("profileDailySummaryTableBody");
  const eventRowsTableBody = document.getElementById("profileEventRowsTableBody");

  if (!employeeSelect || !monthInput || !summaryCards || !tableBody || !eventRowsTableBody) {
    return;
  }

  if (!monthInput.value) {
    monthInput.value = getMonthKey(new Date());
  }

  const employeeId = employeeSelect.value;
  const monthKey = monthInput.value;
  const employee = employees.find((item) => item.id === employeeId);

  if (!employee) {
    if (selectedTitle) {
      selectedTitle.textContent = "-";
    }

    summaryCards.innerHTML = "";
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">${escapeHtml(t("profile.noData"))}</td>
      </tr>
    `;
    eventRowsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">${escapeHtml(t("profile.noEvents"))}</td>
      </tr>
    `;
    return;
  }

  if (selectedTitle) {
    selectedTitle.textContent = `${employee.name} • ${formatMonthDisplay(monthKey)}`;
  }

  const monthEvents = attendanceEvents
    .filter((event) => event.employeeId === employeeId && String(event.dateKey).startsWith(monthKey))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (monthEvents.length === 0) {
    const emptyPaymentValues = calculateEmployeePaymentValues({
      dailyRows: [],
      balanceMinutes: 0
    });

    summaryCards.innerHTML = `
      <div class="profile-summary-card">
        <span>${escapeHtml(t("profile.workDays"))}</span>
        <strong>0</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("profile.totalWorked"))}</span>
        <strong>00:00</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("attendance.overtime"))}</span>
        <strong class="balance-positive">00:00</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("payment.overtimeValue"))}</span>
        <strong class="balance-positive">${escapeHtml(formatMoneyValue(emptyPaymentValues.overtimeValue))}</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("payment.mealVoucherDays"))}</span>
        <strong>0</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("payment.mealVoucherValue"))}</span>
        <strong>${escapeHtml(formatMoneyValue(emptyPaymentValues.mealVoucherValue))}</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("payment.totalPayment"))}</span>
        <strong>${escapeHtml(formatMoneyValue(emptyPaymentValues.paymentTotal))}</strong>
      </div>

      <div class="profile-summary-card">
        <span>${escapeHtml(t("profile.openDays"))}</span>
        <strong>0</strong>
      </div>
    `;

    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">${escapeHtml(t("profile.noData"))}</td>
      </tr>
    `;
    eventRowsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">${escapeHtml(t("profile.noEvents"))}</td>
      </tr>
    `;
    return;
  }

  const dayKeys = [...new Set(monthEvents.map((event) => event.dateKey))].sort();

  const summaries = dayKeys.map((dateKey) => {
    return calculateDailySummary({
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department || "-",
      dateKey
    });
  });

  const totalRawMinutes = summaries.reduce((sum, item) => sum + item.rawWorkedMinutes, 0);
  const totalLunchMinutes = summaries.reduce((sum, item) => sum + item.lunchDeductionMinutes, 0);
  const totalNetMinutes = summaries.reduce((sum, item) => sum + item.netWorkedMinutes, 0);
  const openDays = summaries.filter((item) => item.isOpen).length;
  const totalOvertimeMinutes = summaries.reduce((sum, item) => sum + item.overtimeMinutes, 0);
  const totalBalanceMinutes = summaries.reduce((sum, item) => sum + item.balanceMinutes, 0);
  const remainingMissingMinutes = Math.max(0, -totalBalanceMinutes);
  const balanceClass = getBalanceClass(totalBalanceMinutes);

  const paymentValues = calculateEmployeePaymentValues({
    dailyRows: summaries,
    balanceMinutes: totalBalanceMinutes
  });

  summaryCards.innerHTML = `
    <div class="profile-summary-card">
      <span>${escapeHtml(t("profile.workDays"))}</span>
      <strong>${escapeHtml(String(summaries.length))}</strong>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("profile.totalWorked"))}</span>
      <strong>${escapeHtml(formatDuration(totalNetMinutes))}</strong>
      <small>${escapeHtml(t("attendance.rawWorked"))}: ${escapeHtml(formatDuration(totalRawMinutes))}</small>
      <small>${escapeHtml(t("attendance.lunchDeduction"))}: ${escapeHtml(formatDuration(totalLunchMinutes))}</small>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("attendance.overtime"))}</span>
      <strong class="balance-positive">${escapeHtml(formatDuration(paymentValues.payableOvertimeMinutes))}</strong>
      <small>${escapeHtml(t("payment.overtimeRate"))}: ${escapeHtml(formatMoneyValue(paymentValues.overtimeHourlyRate))}</small>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("payment.overtimeValue"))}</span>
      <strong class="balance-positive">${escapeHtml(formatMoneyValue(paymentValues.overtimeValue))}</strong>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("attendance.missing"))}</span>
      <strong class="balance-negative">${escapeHtml(formatDuration(remainingMissingMinutes))}</strong>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("profile.totalBalance"))}</span>
      <strong class="${balanceClass}">${escapeHtml(formatSignedDuration(totalBalanceMinutes))}</strong>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("payment.mealVoucherDays"))}</span>
      <strong>${escapeHtml(String(paymentValues.mealVoucherDays))}</strong>
      <small>${escapeHtml(t("payment.mealVoucherDailyValue"))}: ${escapeHtml(formatMoneyValue(paymentValues.mealVoucherDailyValue))}</small>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("payment.mealVoucherValue"))}</span>
      <strong>${escapeHtml(formatMoneyValue(paymentValues.mealVoucherValue))}</strong>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("payment.totalPayment"))}</span>
      <strong>${escapeHtml(formatMoneyValue(paymentValues.paymentTotal))}</strong>
    </div>

    <div class="profile-summary-card">
      <span>${escapeHtml(t("profile.openDays"))}</span>
      <strong>${escapeHtml(String(openDays))}</strong>
    </div>
  `;

  tableBody.innerHTML = summaries
    .map((summary) => {
      const rowBalanceClass = getBalanceClass(summary.balanceMinutes);
      const statusClass = summary.isIncomplete ? "daily-status-open" : "daily-status-closed";

      return `
        <tr>
          <td>${escapeHtml(formatDisplayDate(summary.dateKey))}</td>
          <td>${escapeHtml(summary.firstArrival || "-")}</td>
          <td>${escapeHtml(summary.lastDeparture || "-")}</td>
          <td>${escapeHtml(formatDuration(summary.rawWorkedMinutes))}</td>
          <td>${escapeHtml(formatDuration(summary.lunchDeductionMinutes))}</td>
          <td><strong>${escapeHtml(formatDuration(summary.netWorkedMinutes))}</strong></td>
          <td class="balance-positive"><strong>${escapeHtml(formatDuration(summary.overtimeMinutes))}</strong></td>
          <td class="balance-negative"><strong>${escapeHtml(formatDuration(summary.missingMinutes))}</strong></td>
          <td class="${rowBalanceClass}">
            <strong>${escapeHtml(formatSignedDuration(summary.balanceMinutes))}</strong>
          </td>
          <td>
            <span class="daily-status-badge ${statusClass}">
              ${escapeHtml(summary.statusText)}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  renderEmployeeProfileEventRows(monthEvents, eventRowsTableBody);
}

function renderEmployeeProfileEventRows(profileEvents, tableBody) {
  if (!tableBody) {
    return;
  }

  if (!profileEvents || profileEvents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">${escapeHtml(t("profile.noEvents"))}</td>
      </tr>
    `;
    return;
  }

  const eventIndexesByDate = new Map();

  tableBody.innerHTML = profileEvents
    .map((event) => {
      const currentIndex = (eventIndexesByDate.get(event.dateKey) || 0) + 1;
      eventIndexesByDate.set(event.dateKey, currentIndex);

      const badgeClass = event.type === "in" ? "event-badge-in" : "event-badge-out";

      return `
        <tr>
          <td>${escapeHtml(formatDisplayDate(event.dateKey))}</td>
          <td><strong>${escapeHtml(String(currentIndex))}</strong></td>
          <td>${escapeHtml(formatTimeFromIso(event.createdAt))}</td>
          <td>
            <span class="event-badge ${badgeClass}">
              ${escapeHtml(getAttendanceTypeLabel(event.type))}
            </span>
          </td>
          <td>${escapeHtml(getAttendanceSourceLabel(event.source))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPeriodAttendanceList(viewMode, selectedDateKey, searchTerm, tableBody, summaryBox) {
  const warningBox = document.getElementById("openDayWarningBox");

  if (warningBox) {
    warningBox.textContent = "";
    warningBox.classList.add("hidden");
  }

  const reportData = viewMode === "weekly"
    ? getWeeklyAttendanceReportData(selectedDateKey)
    : getMonthlyAttendanceReportData(selectedDateKey);

  const startKey = viewMode === "weekly" ? reportData.weekStartKey : reportData.monthStartKey;
  const endKey = viewMode === "weekly" ? reportData.weekEndKey : reportData.monthEndKey;
  const filteredDailyRows = reportData.dailyRows.filter((summary) => matchesSummarySearch(summary, searchTerm));
  const filteredEmployeeSummaries = reportData.employeeSummaries.filter((summary) => matchesSummarySearch(summary, searchTerm));

  renderAttendancePeriodBreakdownHeader();
  renderPeriodSummaryHeader();
  setDailySummaryTitle("attendance.periodSummaryTitle");

  if (summaryBox) {
    const labelKey = viewMode === "weekly" ? "attendance.viewWeekly" : "attendance.viewMonthly";
    summaryBox.textContent = `${t(labelKey)}: ${formatDisplayDate(startKey)} - ${formatDisplayDate(endKey)} • ${filteredDailyRows.length}`;
  }

  if (filteredDailyRows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="13" class="empty-row">${escapeHtml(t("attendance.noPeriodRows"))}</td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = filteredDailyRows
      .map((summary) => {
        const balanceClass = getBalanceClass(summary.balanceMinutes);
        const statusClass = summary.isIncomplete ? "daily-status-open" : "daily-status-closed";

        return `
          <tr>
            <td>${escapeHtml(formatDisplayDate(summary.dateKey))}</td>
            <td><strong>${escapeHtml(summary.employeeId)}</strong></td>
            <td>${escapeHtml(summary.employeeName)}</td>
            <td>${escapeHtml(summary.department || "-")}</td>
            <td>${escapeHtml(summary.firstArrival || "-")}</td>
            <td>${escapeHtml(summary.lastDeparture || "-")}</td>
            <td>${escapeHtml(formatDuration(summary.rawWorkedMinutes))}</td>
            <td>${escapeHtml(formatDuration(summary.lunchDeductionMinutes))}</td>
            <td><strong>${escapeHtml(formatDuration(summary.netWorkedMinutes))}</strong></td>
            <td class="balance-positive"><strong>${escapeHtml(formatDuration(summary.overtimeMinutes))}</strong></td>
            <td class="balance-negative"><strong>${escapeHtml(formatDuration(summary.missingMinutes))}</strong></td>
            <td class="${balanceClass}">
              <strong>${escapeHtml(formatSignedDuration(summary.balanceMinutes))}</strong>
            </td>
            <td>
              <span class="daily-status-badge ${statusClass}">
                ${escapeHtml(summary.statusText)}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  renderPeriodEmployeeSummary(filteredEmployeeSummaries);
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatMonthDisplay(monthKey) {
  const parts = String(monthKey).split("-");

  if (parts.length !== 2) {
    return monthKey;
  }

  return `${parts[1]}/${parts[0]}`;
}

function initStatisticsPage() {
  const statisticsDateInput = document.getElementById("statisticsDateInput");
  const statisticsTodayButton = document.getElementById("statisticsTodayButton");
  const statisticsRefreshButton = document.getElementById("statisticsRefreshButton");

  if (statisticsDateInput) {
    setDateControlValue(statisticsDateInput, getDateKey(new Date()));

    statisticsDateInput.addEventListener("change", () => {
      renderStatisticsPage();
    });
  }

  if (statisticsTodayButton) {
    statisticsTodayButton.addEventListener("click", () => {
      if (statisticsDateInput) {
        setDateControlValue(statisticsDateInput, getDateKey(new Date()));
      }

      renderStatisticsPage();
    });
  }

  if (statisticsRefreshButton) {
    statisticsRefreshButton.addEventListener("click", () => {
      renderStatisticsPage();
    });
  }

  renderStatisticsPage();
}

function renderStatisticsPage() {
  const statisticsDateInput = document.getElementById("statisticsDateInput");
  const statisticsCards = document.getElementById("statisticsCards");
  const attentionTableBody = document.getElementById("statisticsAttentionTableBody");
  const tableBody = document.getElementById("statisticsDailyTableBody");
  const upcomingAbsenceBody = document.getElementById("statisticsUpcomingAbsenceBody");
  const monthlyLeadersBox = document.getElementById("statisticsMonthlyLeaders");

  if (!statisticsCards || !attentionTableBody || !tableBody || !upcomingAbsenceBody || !monthlyLeadersBox) {
    return;
  }

  const selectedDateKey = statisticsDateInput && getDateControlValue(statisticsDateInput)
    ? getDateControlValue(statisticsDateInput)
    : getDateKey(new Date());

  const dayEvents = attendanceEvents
    .filter((event) => event.dateKey === selectedDateKey)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const activeEmployees = employees
    .filter((employee) => employee.active)
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "hu"));
  const todayKey = getDateKey(new Date());
  const selectedDayIsNonWorking = isNonWorkingDateKey(selectedDateKey);

  const overviewRows = activeEmployees.map((employee) => {
    const employeeEvents = dayEvents.filter((event) => event.employeeId === employee.id);
    const absences = getAbsencesForEmployeeInRange(employee.id, selectedDateKey, selectedDateKey);
    const summary = employeeEvents.length > 0
      ? calculateDailySummary({
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department || "-",
          dateKey: selectedDateKey
        })
      : null;
    const issues = [];
    let statusKey = "statistics.statusNoEntry";
    let statusClass = "overview-status-neutral";

    if (absences.length > 0) {
      statusKey = "statistics.statusAbsent";
      statusClass = "overview-status-absence";
    }

    if (summary) {
      statusKey = summary.isOpen ? "statistics.statusInside" : "statistics.statusLeft";
      statusClass = summary.isOpen ? "overview-status-inside" : "overview-status-left";
    }

    if (summary && summary.hasInvalidOrder) {
      issues.push(t("statistics.invalidOrder"));
    }

    if (summary && absences.length > 0) {
      issues.push(t("statistics.absenceConflict"));
    }

    if (summary && summary.isOpen && selectedDateKey < todayKey) {
      issues.push(t("statistics.forgottenDeparture"));
    }

    if (!summary && absences.length === 0 && !selectedDayIsNonWorking && selectedDateKey <= todayKey) {
      statusKey = "statistics.statusNotArrived";
      statusClass = "overview-status-warning";
      issues.push(t("statistics.noArrivalOrAbsence"));
    }

    if (!summary && absences.length === 0 && selectedDayIsNonWorking) {
      statusKey = "statistics.statusDayOff";
      statusClass = "overview-status-neutral";
    }

    return {
      employee,
      summary,
      absences,
      issues,
      statusKey,
      statusClass
    };
  });

  const arrivedCount = overviewRows.filter((row) => row.summary).length;
  const insideCount = overviewRows.filter((row) => row.summary && row.summary.isOpen).length;
  const leftCount = overviewRows.filter((row) => row.summary && !row.summary.isOpen).length;
  const absentCount = overviewRows.filter((row) => row.absences.length > 0 && !row.summary).length;
  const notArrivedCount = overviewRows.filter((row) => row.statusKey === "statistics.statusNotArrived").length;
  const attentionRows = overviewRows.filter((row) => row.issues.length > 0);

  statisticsCards.innerHTML = `
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.activeEmployees"))}</span>
      <strong>${escapeHtml(String(activeEmployees.length))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.arrived"))}</span>
      <strong>${escapeHtml(String(arrivedCount))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.currentlyInside"))}</span>
      <strong>${escapeHtml(String(insideCount))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.leftToday"))}</span>
      <strong>${escapeHtml(String(leftCount))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.absentToday"))}</span>
      <strong>${escapeHtml(String(absentCount))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.notArrived"))}</span>
      <strong>${escapeHtml(String(notArrivedCount))}</strong>
    </div>
    <div class="statistics-card overview-attention-card">
      <span>${escapeHtml(t("statistics.needsAttention"))}</span>
      <strong>${escapeHtml(String(attentionRows.length))}</strong>
    </div>
  `;

  attentionTableBody.innerHTML = attentionRows.length === 0
    ? `
      <tr>
        <td colspan="5" class="empty-row">${escapeHtml(t("statistics.noIssues"))}</td>
      </tr>
    `
    : attentionRows.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.employee.id)}</strong></td>
        <td>${escapeHtml(row.employee.name)}</td>
        <td>${escapeHtml(row.employee.department || "-")}</td>
        <td><span class="overview-status ${row.statusClass}">${escapeHtml(t(row.statusKey))}</span></td>
        <td class="overview-issue">${escapeHtml(row.issues.join("; "))}</td>
      </tr>
    `).join("");

  if (overviewRows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">${escapeHtml(t("statistics.noData"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = overviewRows
    .map((row) => `
        <tr>
          <td><strong>${escapeHtml(row.employee.id)}</strong></td>
          <td>${escapeHtml(row.employee.name)}</td>
          <td>${escapeHtml(row.employee.department || "-")}</td>
          <td>${escapeHtml(row.summary ? row.summary.firstArrival || "-" : "-")}</td>
          <td>${escapeHtml(row.summary ? row.summary.lastDeparture || "-" : "-")}</td>
          <td><strong>${escapeHtml(row.summary ? formatDuration(row.summary.netWorkedMinutes) : "00:00")}</strong></td>
          <td><span class="overview-status ${row.statusClass}">${escapeHtml(t(row.statusKey))}</span></td>
        </tr>
      `)
    .join("");

  renderStatisticsUpcomingAbsences(selectedDateKey, upcomingAbsenceBody);
  renderStatisticsMonthlyLeaders(selectedDateKey, monthlyLeadersBox);
}

function addDaysToDateKey(dateKey, dayCount) {
  const parts = String(dateKey).split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + dayCount);
  return getDateKey(date);
}

function renderStatisticsUpcomingAbsences(selectedDateKey, tableBody) {
  const endKey = addDaysToDateKey(selectedDateKey, 7);
  const upcoming = absenceRecords
    .filter((absence) => dateRangesOverlap(absence.startDate, absence.endDate, selectedDateKey, endKey))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (upcoming.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">${escapeHtml(t("statistics.noUpcomingAbsences"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = upcoming.map((absence) => `
    <tr>
      <td>${escapeHtml(absence.employeeName || absence.employeeId)}</td>
      <td>${escapeHtml(formatDisplayDate(absence.startDate))}</td>
      <td>${escapeHtml(formatDisplayDate(absence.endDate))}</td>
      <td>${escapeHtml(getAbsenceTypeLabel(absence.type))}</td>
    </tr>
  `).join("");
}

function renderStatisticsMonthlyLeaders(selectedDateKey, box) {
  const monthRows = buildMonthlyAccountingRows(getMonthKey(new Date(`${selectedDateKey}T12:00:00`)));
  const overtimeRows = monthRows
    .filter((row) => row.overtimeMinutes > 0)
    .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
    .slice(0, 5);
  const missingRows = monthRows
    .filter((row) => row.missingMinutes > 0)
    .sort((a, b) => b.missingMinutes - a.missingMinutes)
    .slice(0, 5);

  box.innerHTML = `
    <div class="manager-ranking">
      <h4>${escapeHtml(t("statistics.mostOvertime"))}</h4>
      ${renderManagerRankingRows(overtimeRows, "overtimeMinutes", "balance-positive")}
    </div>
    <div class="manager-ranking">
      <h4>${escapeHtml(t("statistics.mostMissing"))}</h4>
      ${renderManagerRankingRows(missingRows, "missingMinutes", "balance-negative")}
    </div>
  `;
}

function renderManagerRankingRows(rows, valueKey, valueClass) {
  if (rows.length === 0) {
    return `<p class="empty-ranking">${escapeHtml(t("statistics.noRankingData"))}</p>`;
  }

  return rows.map((row, index) => `
    <div class="manager-ranking-row">
      <span>${index + 1}. ${escapeHtml(row.employeeName)}</span>
      <strong class="${valueClass}">${escapeHtml(formatDuration(row[valueKey]))}</strong>
    </div>
  `).join("");
}

function getCurrentlyInsideCount() {
  const latestEventsByEmployee = new Map();

  attendanceEvents
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((event) => {
      latestEventsByEmployee.set(event.employeeId, event);
    });

  return employees
    .filter((employee) => employee.active)
    .filter((employee) => {
      const latestEvent = latestEventsByEmployee.get(employee.id);
      return latestEvent && latestEvent.type === "in";
    }).length;
}

function initMonthlyAccountingPage() {
  const monthInput = document.getElementById("monthlyAccountingMonthInput");
  const searchInput = document.getElementById("monthlyAccountingSearchInput");
  const refreshButton = document.getElementById("monthlyAccountingRefreshButton");
  const absenceForm = document.getElementById("absenceForm");
  const absenceStartDateInput = document.getElementById("absenceStartDateInput");
  const absenceEndDateInput = document.getElementById("absenceEndDateInput");
  const companyDayForm = document.getElementById("companyDayForm");
  const companyDayStartDateInput = document.getElementById("companyDayStartDateInput");
  const companyDayEndDateInput = document.getElementById("companyDayEndDateInput");

  if (monthInput) {
    monthInput.value = getMonthKey(new Date());
    monthInput.addEventListener("change", () => {
      fillAbsenceEmployeeOptions();
      renderMonthlyAccountingPage();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderMonthlyAccountingPage();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      renderMonthlyAccountingPage();
    });
  }

  if (absenceStartDateInput && absenceEndDateInput) {
    absenceStartDateInput.addEventListener("change", () => {
      const startDate = getDateControlValue(absenceStartDateInput);
      const endDate = getDateControlValue(absenceEndDateInput);
      if (startDate && (!endDate || endDate < startDate)) {
        setDateControlValue(absenceEndDateInput, startDate);
      }
    });
  }

  if (absenceForm) {
    absenceForm.addEventListener("submit", (event) => {
      saveAbsenceFromForm(event);
    });
  }

  if (companyDayStartDateInput && companyDayEndDateInput) {
    setDateControlValue(companyDayStartDateInput, getDateKey(new Date()));
    setDateControlValue(companyDayEndDateInput, getDateKey(new Date()));
    companyDayStartDateInput.addEventListener("change", () => {
      const startDate = getDateControlValue(companyDayStartDateInput);
      const endDate = getDateControlValue(companyDayEndDateInput);
      if (startDate && (!endDate || endDate < startDate)) {
        setDateControlValue(companyDayEndDateInput, startDate);
      }
    });
  }

  if (companyDayForm) {
    companyDayForm.addEventListener("submit", (event) => {
      saveCompanyDayFromForm(event);
    });
  }

  fillAbsenceEmployeeOptions();
  renderMonthlyAccountingPage();
}

function renderMonthlyAccountingPage() {
  const tableBody = document.getElementById("monthlyAccountingTableBody");
  const cardsBox = document.getElementById("monthlyAccountingCards");

  if (!tableBody || !cardsBox) {
    return;
  }

  const monthKey = getMonthlyAccountingMonthKey();
  const searchTerm = getMonthlyAccountingSearchTerm();
  const rows = buildMonthlyAccountingRows(monthKey)
    .filter((row) => matchesMonthlyAccountingSearch(row, searchTerm));

  renderMonthlyAccountingCards(rows, cardsBox);
  renderMonthlyAccountingTable(rows, tableBody);
  renderMonthlyAbsenceTable(monthKey);
  renderCompanyDaysTable(monthKey);

  if (!selectedMonthlyAccountingEmployeeId && rows.length > 0) {
    selectedMonthlyAccountingEmployeeId = rows[0].employeeId;
  }

  renderMonthlyAccountingDetail(monthKey, selectedMonthlyAccountingEmployeeId);
}

function saveCompanyDayFromForm(event) {
  event.preventDefault();

  const startDateInput = document.getElementById("companyDayStartDateInput");
  const endDateInput = document.getElementById("companyDayEndDateInput");
  const typeInput = document.getElementById("companyDayTypeInput");
  const noteInput = document.getElementById("companyDayNoteInput");
  const startDate = getDateControlValue(startDateInput);
  const endDate = getDateControlValue(endDateInput);

  if (!startDate || !endDate || endDate < startDate) {
    alert(t("calendar.invalid"));
    return;
  }

  const nextCompanyDays = getCompanyDays().slice();
  nextCompanyDays.push({
    id: `CD-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startDate,
    endDate,
    type: typeInput ? typeInput.value : "day_off",
    note: noteInput ? noteInput.value.trim() : ""
  });
  nextCompanyDays.sort((a, b) => {
    return String(a.startDate || a.date).localeCompare(String(b.startDate || b.date));
  });

  appSettings = {
    ...appSettings,
    companyDays: nextCompanyDays
  };
  saveSettings(appSettings);

  if (noteInput) {
    noteInput.value = "";
  }

  refreshAllCalculatedViews();
  renderMonthlyAccountingPage();
}

function deleteCompanyDay(companyDayId) {
  if (!confirm(t("calendar.deleteConfirm"))) {
    return;
  }

  appSettings = {
    ...appSettings,
    companyDays: getCompanyDays().filter((item) => {
      const itemId = item.id || `legacy-${item.date}`;
      return itemId !== companyDayId;
    })
  };
  saveSettings(appSettings);
  refreshAllCalculatedViews();
  renderMonthlyAccountingPage();
}

function renderCompanyDaysTable(monthKey) {
  const tableBody = document.getElementById("companyDaysTableBody");

  if (!tableBody) {
    return;
  }

  const monthRange = getMonthRangeFromDateKey(`${monthKey}-01`);
  const monthDays = getCompanyDays().filter((item) => {
    const startDate = item.startDate || item.date;
    const endDate = item.endDate || item.date;
    return dateRangesOverlap(startDate, endDate, monthRange.startKey, monthRange.endKey);
  });

  if (monthDays.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">${escapeHtml(t("calendar.empty"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = monthDays.map((item) => {
    const startDate = item.startDate || item.date;
    const endDate = item.endDate || item.date;
    const itemId = item.id || `legacy-${item.date}`;
    const typeKey = item.type === "vacation" ? "vacation" : "dayOff";

    return `
    <tr>
      <td>${escapeHtml(formatDisplayDate(startDate))}</td>
      <td>${escapeHtml(formatDisplayDate(endDate))}</td>
      <td>${escapeHtml(t(`calendar.${typeKey}`))}</td>
      <td>${escapeHtml(item.note || "-")}</td>
      <td>
        <button type="button" class="danger-btn" onclick="deleteCompanyDay('${escapeHtml(itemId)}')">
          ${escapeHtml(t("common.delete"))}
        </button>
      </td>
    </tr>
  `;
  }).join("");
}

function getMonthlyAccountingMonthKey() {
  const monthInput = document.getElementById("monthlyAccountingMonthInput");
  return monthInput && monthInput.value ? monthInput.value : getMonthKey(new Date());
}

function getMonthlyAccountingSearchTerm() {
  const searchInput = document.getElementById("monthlyAccountingSearchInput");
  return searchInput ? searchInput.value.trim().toLowerCase() : "";
}

function buildMonthlyAccountingRows(monthKey) {
  const selectedDateKey = `${monthKey}-01`;
  const monthlyData = getMonthlyAttendanceReportData(selectedDateKey);
  const summaryByEmployee = new Map(monthlyData.employeeSummaries.map((summary) => [summary.employeeId, summary]));
  const dailyRowsByEmployee = new Map();

  monthlyData.dailyRows.forEach((row) => {
    if (!dailyRowsByEmployee.has(row.employeeId)) {
      dailyRowsByEmployee.set(row.employeeId, []);
    }

    dailyRowsByEmployee.get(row.employeeId).push(row);
  });

  return employees
    .filter((employee) => employee.active)
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "hu"))
    .map((employee) => {
      const summary = summaryByEmployee.get(employee.id) || createEmptyMonthlySummary(employee);
      const employeeDailyRows = dailyRowsByEmployee.get(employee.id) || [];
      const absenceSummary = calculateEmployeeAbsenceSummary(employee.id, monthlyData.monthStartKey, monthlyData.monthEndKey);
      const mealVoucherDays = employeeDailyRows.filter((row) => Number(row.netWorkedMinutes) > 0 && !isNonWorkingDateKey(row.dateKey)).length;
      const payableOvertimeMinutes = Math.max(0, Number(summary.balanceMinutes) || 0);
      const overtimeValue = (payableOvertimeMinutes / 60) * getSettingMoneyValue("overtimeHourlyRate");
      const mealVoucherValue = mealVoucherDays * getSettingMoneyValue("mealVoucherDailyValue");

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department || "-",
        workDays: summary.workDays || 0,
        openDays: summary.openDays || 0,
        netWorkedMinutes: summary.netWorkedMinutes || 0,
        overtimeMinutes: payableOvertimeMinutes,
        missingMinutes: Math.max(0, -(Number(summary.balanceMinutes) || 0)),
        balanceMinutes: summary.balanceMinutes || 0,
        mealVoucherDays,
        mealVoucherValue,
        overtimeValue,
        absenceSummary
      };
    });
}

function createEmptyMonthlySummary(employee) {
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department || "-",
    workDays: 0,
    openDays: 0,
    rawWorkedMinutes: 0,
    lunchDeductionMinutes: 0,
    netWorkedMinutes: 0,
    overtimeMinutes: 0,
    missingMinutes: 0,
    balanceMinutes: 0
  };
}

function matchesMonthlyAccountingSearch(row, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  return [
    row.employeeId,
    row.employeeName,
    row.department || ""
  ].join(" ").toLowerCase().includes(searchTerm);
}

function renderMonthlyAccountingCards(rows, cardsBox) {
  const totalWorkDays = rows.reduce((sum, row) => sum + row.workDays, 0);
  const totalNetMinutes = rows.reduce((sum, row) => sum + row.netWorkedMinutes, 0);
  const totalOvertimeMinutes = rows.reduce((sum, row) => sum + row.overtimeMinutes, 0);
  const totalOvertimeValue = rows.reduce((sum, row) => sum + row.overtimeValue, 0);
  const totalMealVoucherValue = rows.reduce((sum, row) => sum + row.mealVoucherValue, 0);
  const totalAbsenceDays = rows.reduce((sum, row) => sum + row.absenceSummary.totalDays, 0);

  cardsBox.innerHTML = `
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.activeEmployees"))}</span>
      <strong>${escapeHtml(String(rows.length))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("attendance.workDays"))}</span>
      <strong>${escapeHtml(String(totalWorkDays))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("statistics.totalWorked"))}</span>
      <strong>${escapeHtml(formatDuration(totalNetMinutes))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("attendance.overtime"))}</span>
      <strong class="balance-positive">${escapeHtml(formatDuration(totalOvertimeMinutes))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("payment.overtimeValue"))}</span>
      <strong>${escapeHtml(formatMoneyValue(totalOvertimeValue))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("payment.mealVoucherValue"))}</span>
      <strong>${escapeHtml(formatMoneyValue(totalMealVoucherValue))}</strong>
    </div>
    <div class="statistics-card">
      <span>${escapeHtml(t("absence.totalDays"))}</span>
      <strong>${escapeHtml(String(totalAbsenceDays))}</strong>
    </div>
  `;
}

function renderMonthlyAccountingTable(rows, tableBody) {
  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-row">${escapeHtml(t("monthly.noRows"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      const isSelected = row.employeeId === selectedMonthlyAccountingEmployeeId;
      const absenceText = formatAbsenceSummary(row.absenceSummary);

      return `
        <tr class="${isSelected ? "selected-row" : ""}">
          <td><strong>${escapeHtml(row.employeeId)}</strong></td>
          <td>${escapeHtml(row.employeeName)}</td>
          <td>${escapeHtml(row.department || "-")}</td>
          <td><strong>${escapeHtml(String(row.workDays))}</strong></td>
          <td><strong>${escapeHtml(formatDuration(row.netWorkedMinutes))}</strong></td>
          <td class="balance-positive"><strong>${escapeHtml(formatDuration(row.overtimeMinutes))}</strong></td>
          <td><strong>${escapeHtml(formatMoneyValue(row.overtimeValue))}</strong></td>
          <td>${escapeHtml(String(row.mealVoucherDays))}</td>
          <td><strong>${escapeHtml(formatMoneyValue(row.mealVoucherValue))}</strong></td>
          <td>${escapeHtml(absenceText)}</td>
          <td>${escapeHtml(String(row.openDays))}</td>
          <td>
            <button type="button" class="small-btn" onclick="selectMonthlyAccountingEmployee('${escapeHtml(row.employeeId)}')">
              ${escapeHtml(t("monthly.details"))}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function selectMonthlyAccountingEmployee(employeeId) {
  selectedMonthlyAccountingEmployeeId = employeeId;
  renderMonthlyAccountingPage();
}

function renderMonthlyAccountingDetail(monthKey, employeeId) {
  const title = document.getElementById("monthlyAccountingDetailTitle");
  const tableBody = document.getElementById("monthlyAccountingDetailTableBody");

  if (!tableBody) {
    return;
  }

  const employee = employees.find((item) => item.id === employeeId);

  if (!employee) {
    if (title) {
      title.textContent = "-";
    }

    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">${escapeHtml(t("monthly.selectEmployee"))}</td>
      </tr>
    `;
    return;
  }

  if (title) {
    title.textContent = `${employee.name} • ${formatMonthDisplay(monthKey)}`;
  }

  const monthRange = getMonthRangeFromDateKey(`${monthKey}-01`);
  const dateKeys = getDateKeysBetween(monthRange.startKey, monthRange.endKey);
  const employeeAbsences = getAbsencesForEmployeeInRange(employee.id, monthRange.startKey, monthRange.endKey);

  tableBody.innerHTML = dateKeys
    .map((dateKey) => {
      const dayEvents = attendanceEvents.filter((event) => event.employeeId === employee.id && event.dateKey === dateKey);
      const dayAbsences = employeeAbsences.filter((absence) => dateRangeContains(absence.startDate, absence.endDate, dateKey));

      if (dayEvents.length === 0 && dayAbsences.length === 0) {
        return "";
      }

      const summary = dayEvents.length > 0
        ? calculateDailySummary({
            employeeId: employee.id,
            employeeName: employee.name,
            department: employee.department || "-",
            dateKey
          })
        : null;

      const statusText = dayAbsences.length > 0
        ? dayAbsences.map((absence) => getAbsenceTypeLabel(absence.type)).join(", ")
        : summary ? summary.statusText : "-";

      return `
        <tr>
          <td>${escapeHtml(formatDisplayDate(dateKey))}</td>
          <td>${escapeHtml(summary ? summary.firstArrival || "-" : "-")}</td>
          <td>${escapeHtml(summary ? summary.lastDeparture || "-" : "-")}</td>
          <td><strong>${escapeHtml(summary ? formatDuration(summary.netWorkedMinutes) : "00:00")}</strong></td>
          <td class="balance-positive"><strong>${escapeHtml(summary ? formatDuration(summary.overtimeMinutes) : "00:00")}</strong></td>
          <td class="balance-negative"><strong>${escapeHtml(summary ? formatDuration(summary.missingMinutes) : "00:00")}</strong></td>
          <td>${escapeHtml(dayAbsences.length > 0 ? dayAbsences.map((absence) => getAbsenceTypeLabel(absence.type)).join(", ") : "-")}</td>
          <td>${escapeHtml(statusText)}</td>
        </tr>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!tableBody.innerHTML) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">${escapeHtml(t("monthly.noDetails"))}</td>
      </tr>
    `;
  }
}

function fillAbsenceEmployeeOptions() {
  const select = document.getElementById("absenceEmployeeSelect");

  if (!select) {
    return;
  }

  const activeEmployees = employees
    .filter((employee) => employee.active)
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "hu"));

  select.innerHTML = [
    ...activeEmployees
    .map((employee) => {
      return `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.name)} (${escapeHtml(employee.id)})</option>`;
    }),
    `<option value="__all__">${escapeHtml(t("absence.allActiveEmployees"))}</option>`
  ].join("");
}

function saveAbsenceFromForm(event) {
  event.preventDefault();

  const employeeSelect = document.getElementById("absenceEmployeeSelect");
  const startDateInput = document.getElementById("absenceStartDateInput");
  const endDateInput = document.getElementById("absenceEndDateInput");
  const typeInput = document.getElementById("absenceTypeInput");
  const noteInput = document.getElementById("absenceNoteInput");

  const selectedEmployeeId = employeeSelect ? employeeSelect.value : "";
  const selectedEmployees = selectedEmployeeId === "__all__"
    ? employees.filter((item) => item.active)
    : employees.filter((item) => item.id === selectedEmployeeId);
  const startDate = getDateControlValue(startDateInput);
  const endDate = getDateControlValue(endDateInput);

  if (selectedEmployees.length === 0 || !startDate || !endDate || endDate < startDate) {
    alert(t("absence.invalid"));
    return;
  }

  const now = new Date().toISOString();
  selectedEmployees.forEach((employee, index) => {
    absenceRecords.push({
      id: `ABS-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department || "",
      startDate,
      endDate,
      type: typeInput ? typeInput.value : "other",
      note: noteInput ? noteInput.value.trim() : "",
      createdAt: now,
      updatedAt: now
    });
  });
  saveAbsences(absenceRecords);

  if (noteInput) {
    noteInput.value = "";
  }

  selectedMonthlyAccountingEmployeeId = selectedEmployees[0].id;
  renderMonthlyAccountingPage();
  renderVacationTrackerPage();
}

function deleteAbsence(absenceId) {
  const absence = absenceRecords.find((item) => item.id === absenceId);

  if (!absence) {
    return;
  }

  if (!confirm(t("absence.deleteConfirm"))) {
    return;
  }

  absenceRecords = absenceRecords.filter((item) => item.id !== absenceId);
  saveAbsences(absenceRecords);
  renderMonthlyAccountingPage();
  renderVacationTrackerPage();
}

function renderMonthlyAbsenceTable(monthKey) {
  const tableBody = document.getElementById("monthlyAbsenceTableBody");

  if (!tableBody) {
    return;
  }

  const monthRange = getMonthRangeFromDateKey(`${monthKey}-01`);
  const monthAbsences = absenceRecords
    .filter((absence) => dateRangesOverlap(absence.startDate, absence.endDate, monthRange.startKey, monthRange.endKey))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (monthAbsences.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">${escapeHtml(t("absence.empty"))}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = monthAbsences
    .map((absence) => {
      return `
        <tr>
          <td>${escapeHtml(absence.employeeName || absence.employeeId)}</td>
          <td>${escapeHtml(absence.department || "-")}</td>
          <td>${escapeHtml(formatDisplayDate(absence.startDate))}</td>
          <td>${escapeHtml(formatDisplayDate(absence.endDate))}</td>
          <td>${escapeHtml(getAbsenceTypeLabel(absence.type))}</td>
          <td>${escapeHtml(absence.note || "-")}</td>
          <td>
            <button type="button" class="danger-btn" onclick="deleteAbsence('${escapeHtml(absence.id)}')">
              ${escapeHtml(t("common.delete"))}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function calculateEmployeeAbsenceSummary(employeeId, startKey, endKey) {
  const counts = {
    sick: 0,
    vacation: 0,
    excused: 0,
    unexcused: 0,
    unpaid: 0,
    other: 0,
    totalDays: 0
  };

  const daysByType = new Map();
  const allDays = new Set();

  getAbsencesForEmployeeInRange(employeeId, startKey, endKey).forEach((absence) => {
    const days = getDateKeysBetween(
      absence.startDate < startKey ? startKey : absence.startDate,
      absence.endDate > endKey ? endKey : absence.endDate
    );

    const type = counts[absence.type] !== undefined ? absence.type : "other";
    
    if (!daysByType.has(type)) {
      daysByType.set(type, new Set());
    }
    
    days.forEach((day) => {
      daysByType.get(type).add(day);
      allDays.add(day);
    });
  });

  daysByType.forEach((days, type) => {
    counts[type] = days.size;
  });
  
  counts.totalDays = allDays.size;

  return counts;
}

function getAbsencesForEmployeeInRange(employeeId, startKey, endKey) {
  return absenceRecords.filter((absence) => {
    return absence.employeeId === employeeId && dateRangesOverlap(absence.startDate, absence.endDate, startKey, endKey);
  });
}

function dateRangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

function dateRangeContains(startKey, endKey, dateKey) {
  return startKey <= dateKey && endKey >= dateKey;
}

function formatAbsenceSummary(absenceSummary) {
  if (!absenceSummary || absenceSummary.totalDays === 0) {
    return "0";
  }

  return [
    absenceSummary.sick > 0 ? `${t("absence.sickShort")}: ${absenceSummary.sick}` : "",
    absenceSummary.vacation > 0 ? `${t("absence.vacationShort")}: ${absenceSummary.vacation}` : "",
    absenceSummary.excused > 0 ? `${t("absence.excusedShort")}: ${absenceSummary.excused}` : "",
    absenceSummary.unexcused > 0 ? `${t("absence.unexcusedShort")}: ${absenceSummary.unexcused}` : "",
    absenceSummary.unpaid > 0 ? `${t("absence.unpaidShort")}: ${absenceSummary.unpaid}` : "",
    absenceSummary.other > 0 ? `${t("absence.otherShort")}: ${absenceSummary.other}` : ""
  ].filter(Boolean).join(" • ");
}

function initVacationTrackerPage() {
  const yearInput = document.getElementById("vacationYearInput");
  const searchInput = document.getElementById("vacationSearchInput");
  const departmentSelect = document.getElementById("vacationDepartmentSelect");
  const refreshButton = document.getElementById("vacationRefreshButton");
  const allowanceForm = document.getElementById("vacationAllowanceForm");

  if (yearInput) {
    yearInput.value = String(new Date().getFullYear());
    yearInput.addEventListener("change", () => {
      fillVacationEmployeeOptions();
      loadVacationAllowanceForm();
      renderVacationTrackerPage();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderVacationTrackerPage);
  }

  if (departmentSelect) {
    departmentSelect.addEventListener("change", renderVacationTrackerPage);
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", renderVacationTrackerPage);
  }

  if (allowanceForm) {
    allowanceForm.addEventListener("submit", saveVacationAllowanceFromForm);
  }

  const employeeSelect = document.getElementById("vacationEmployeeSelect");
  if (employeeSelect) {
    employeeSelect.addEventListener("change", loadVacationAllowanceForm);
  }

  fillVacationDepartmentOptions();
  fillVacationEmployeeOptions();
  loadVacationAllowanceForm();
  renderVacationTrackerPage();
}

function getVacationTrackerYear() {
  const yearInput = document.getElementById("vacationYearInput");
  const year = Number(yearInput ? yearInput.value : new Date().getFullYear());
  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : new Date().getFullYear();
}

function fillVacationDepartmentOptions() {
  const select = document.getElementById("vacationDepartmentSelect");

  if (!select) {
    return;
  }

  const selectedValue = select.value;
  const departments = [...new Set(employees
    .map((employee) => String(employee.department || "").trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "hu"));

  select.innerHTML = [
    `<option value="">${escapeHtml(t("vacation.allDepartments"))}</option>`,
    ...departments.map((department) => {
      return `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`;
    })
  ].join("");

  select.value = departments.includes(selectedValue) ? selectedValue : "";
}

function fillVacationEmployeeOptions() {
  const select = document.getElementById("vacationEmployeeSelect");

  if (!select) {
    return;
  }

  const selectedValue = select.value;
  const sortedEmployees = employees.filter((employee) => employee.active).sort((a, b) => {
    return String(a.name).localeCompare(String(b.name), "hu");
  });

  if (sortedEmployees.length === 0) {
    select.innerHTML = `<option value="">${escapeHtml(t("profile.noEmployees"))}</option>`;
    return;
  }

  select.innerHTML = sortedEmployees.map((employee) => {
    return `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.name)} (${escapeHtml(employee.id)})</option>`;
  }).join("");
  select.value = sortedEmployees.some((employee) => employee.id === selectedValue)
    ? selectedValue
    : sortedEmployees[0].id;
}

function getVacationAllowance(employeeId, year) {
  return vacationAllowances.find((item) => {
    return item.employeeId === employeeId && Number(item.year) === Number(year);
  }) || null;
}

function loadVacationAllowanceForm() {
  const employeeSelect = document.getElementById("vacationEmployeeSelect");
  const entitledInput = document.getElementById("vacationEntitledDaysInput");
  const carriedInput = document.getElementById("vacationCarriedDaysInput");
  const allowance = getVacationAllowance(
    employeeSelect ? employeeSelect.value : "",
    getVacationTrackerYear()
  );

  if (entitledInput) {
    entitledInput.value = String(allowance ? allowance.entitledDays : 0);
  }

  if (carriedInput) {
    carriedInput.value = String(allowance ? allowance.carriedOverDays : 0);
  }
}

function saveVacationAllowanceFromForm(event) {
  event.preventDefault();

  const employeeSelect = document.getElementById("vacationEmployeeSelect");
  const entitledInput = document.getElementById("vacationEntitledDaysInput");
  const carriedInput = document.getElementById("vacationCarriedDaysInput");
  const employeeId = employeeSelect ? employeeSelect.value : "";
  const year = getVacationTrackerYear();
  const entitledDays = Number(entitledInput ? entitledInput.value : 0);
  const carriedOverDays = Number(carriedInput ? carriedInput.value : 0);

  if (!employeeId || !Number.isFinite(entitledDays) || !Number.isFinite(carriedOverDays)
    || entitledDays < 0 || carriedOverDays < 0) {
    showVacationStatus(t("vacation.invalidAllowance"), "error");
    return;
  }

  const updatedAt = new Date().toISOString();
  const existingIndex = vacationAllowances.findIndex((item) => {
    return item.employeeId === employeeId && Number(item.year) === year;
  });
  const nextAllowance = {
    employeeId,
    year,
    entitledDays,
    carriedOverDays,
    updatedAt
  };

  if (existingIndex >= 0) {
    vacationAllowances[existingIndex] = nextAllowance;
  } else {
    vacationAllowances.push(nextAllowance);
  }

  saveVacationAllowances(vacationAllowances);
  selectedVacationEmployeeId = employeeId;
  showVacationStatus(t("vacation.saved"), "success");
  renderVacationTrackerPage();
}

function showVacationStatus(message, type) {
  const status = document.getElementById("vacationStatus");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = `status-message ${type || ""}`.trim();
}

function getVacationWorkdayKeys(absence, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  if (absence.type !== "vacation"
    || !dateRangesOverlap(absence.startDate, absence.endDate, yearStart, yearEnd)) {
    return [];
  }

  const startKey = absence.startDate < yearStart ? yearStart : absence.startDate;
  const endKey = absence.endDate > yearEnd ? yearEnd : absence.endDate;
  return getDateKeysBetween(startKey, endKey).filter((dateKey) => !isNonWorkingDateKey(dateKey));
}

function buildVacationTrackerRows(year) {
  const todayKey = getDateKey(new Date());

  return employees.filter((employee) => employee.active).map((employee) => {
    const allowance = getVacationAllowance(employee.id, year);
    const vacationRecords = absenceRecords
      .filter((absence) => absence.employeeId === employee.id && absence.type === "vacation")
      .filter((absence) => dateRangesOverlap(absence.startDate, absence.endDate, `${year}-01-01`, `${year}-12-31`))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const workdayKeys = [...new Set(vacationRecords.flatMap((absence) => {
      return getVacationWorkdayKeys(absence, year);
    }))].sort();
    const usedDays = workdayKeys.filter((dateKey) => dateKey <= todayKey).length;
    const bookedDays = workdayKeys.filter((dateKey) => dateKey > todayKey).length;
    const entitledDays = allowance ? Number(allowance.entitledDays) || 0 : 0;
    const carriedOverDays = allowance ? Number(allowance.carriedOverDays) || 0 : 0;
    const availableDays = entitledDays + carriedOverDays;
    const nextDateKey = workdayKeys.find((dateKey) => dateKey > todayKey) || "";

    return {
      employee,
      entitledDays,
      carriedOverDays,
      availableDays,
      usedDays,
      bookedDays,
      remainingDays: availableDays - usedDays - bookedDays,
      nextDateKey,
      vacationRecords
    };
  });
}

function renderVacationTrackerPage() {
  const tableBody = document.getElementById("vacationTableBody");
  const cardsBox = document.getElementById("vacationSummaryCards");

  if (!tableBody || !cardsBox) {
    return;
  }

  fillVacationDepartmentOptions();
  const year = getVacationTrackerYear();
  const searchInput = document.getElementById("vacationSearchInput");
  const departmentSelect = document.getElementById("vacationDepartmentSelect");
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const selectedDepartment = departmentSelect ? departmentSelect.value : "";
  const rows = buildVacationTrackerRows(year).filter((row) => {
    const matchesSearch = !searchTerm || [
      row.employee.id,
      row.employee.name,
      row.employee.department || ""
    ].join(" ").toLowerCase().includes(searchTerm);
    const matchesDepartment = !selectedDepartment || row.employee.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  }).sort((a, b) => String(a.employee.name).localeCompare(String(b.employee.name), "hu"));

  renderVacationSummaryCards(rows, cardsBox);
  renderVacationTrackerTable(rows, tableBody);

  if (!selectedVacationEmployeeId && rows.length > 0) {
    selectedVacationEmployeeId = rows[0].employee.id;
  }

  if (!rows.some((row) => row.employee.id === selectedVacationEmployeeId)) {
    selectedVacationEmployeeId = rows.length > 0 ? rows[0].employee.id : "";
  }

  renderVacationDetails(year, selectedVacationEmployeeId);
  refreshInterfaceIcons();
}

function renderVacationSummaryCards(rows, cardsBox) {
  const totalAvailable = rows.reduce((sum, row) => sum + row.availableDays, 0);
  const totalUsed = rows.reduce((sum, row) => sum + row.usedDays, 0);
  const totalBooked = rows.reduce((sum, row) => sum + row.bookedDays, 0);
  const totalRemaining = rows.reduce((sum, row) => sum + row.remainingDays, 0);

  cardsBox.innerHTML = `
    <div class="statistics-card"><span>${escapeHtml(t("statistics.activeEmployees"))}</span><strong>${escapeHtml(String(rows.length))}</strong></div>
    <div class="statistics-card"><span>${escapeHtml(t("vacation.available"))}</span><strong>${escapeHtml(formatDayCount(totalAvailable))}</strong></div>
    <div class="statistics-card"><span>${escapeHtml(t("vacation.used"))}</span><strong>${escapeHtml(formatDayCount(totalUsed))}</strong></div>
    <div class="statistics-card"><span>${escapeHtml(t("vacation.booked"))}</span><strong>${escapeHtml(formatDayCount(totalBooked))}</strong></div>
    <div class="statistics-card"><span>${escapeHtml(t("vacation.remaining"))}</span><strong class="${totalRemaining < 0 ? "balance-negative" : "balance-positive"}">${escapeHtml(formatDayCount(totalRemaining))}</strong></div>
  `;
}

function renderVacationTrackerTable(rows, tableBody) {
  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="11" class="empty-row">${escapeHtml(t("vacation.noRows"))}</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map((row) => {
    const remainingClass = row.remainingDays < 0 ? "balance-negative" : "balance-positive";
    const selectedClass = row.employee.id === selectedVacationEmployeeId ? "selected-row" : "";

    return `
      <tr class="${selectedClass}">
        <td><strong>${escapeHtml(row.employee.id)}</strong></td>
        <td>${escapeHtml(row.employee.name)}</td>
        <td>${escapeHtml(row.employee.department || "-")}</td>
        <td>${escapeHtml(formatDayCount(row.entitledDays))}</td>
        <td>${escapeHtml(formatDayCount(row.carriedOverDays))}</td>
        <td><strong>${escapeHtml(formatDayCount(row.availableDays))}</strong></td>
        <td>${escapeHtml(formatDayCount(row.usedDays))}</td>
        <td>${escapeHtml(formatDayCount(row.bookedDays))}</td>
        <td class="${remainingClass}"><strong>${escapeHtml(formatDayCount(row.remainingDays))}</strong></td>
        <td>${escapeHtml(row.nextDateKey ? formatDisplayDate(row.nextDateKey) : "-")}</td>
        <td>
          <button type="button" class="small-btn" onclick="editVacationAllowance('${escapeHtml(row.employee.id)}')">${escapeHtml(t("common.edit"))}</button>
          <button type="button" class="secondary-btn small-btn" onclick="selectVacationEmployee('${escapeHtml(row.employee.id)}')">${escapeHtml(t("monthly.details"))}</button>
        </td>
      </tr>
    `;
  }).join("");
}

function formatDayCount(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function editVacationAllowance(employeeId) {
  const employeeSelect = document.getElementById("vacationEmployeeSelect");

  if (employeeSelect) {
    employeeSelect.value = employeeId;
  }

  selectedVacationEmployeeId = employeeId;
  loadVacationAllowanceForm();
  renderVacationTrackerPage();
  document.getElementById("vacationAllowanceForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function selectVacationEmployee(employeeId) {
  selectedVacationEmployeeId = employeeId;
  renderVacationTrackerPage();
}

function renderVacationDetails(year, employeeId) {
  const title = document.getElementById("vacationDetailTitle");
  const tableBody = document.getElementById("vacationDetailTableBody");

  if (!tableBody) {
    return;
  }

  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) {
    if (title) {
      title.textContent = "-";
    }
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHtml(t("vacation.selectEmployee"))}</td></tr>`;
    return;
  }

  if (title) {
    title.textContent = `${employee.name} • ${year}`;
  }

  const todayKey = getDateKey(new Date());
  const records = absenceRecords
    .filter((absence) => absence.employeeId === employeeId && absence.type === "vacation")
    .filter((absence) => dateRangesOverlap(absence.startDate, absence.endDate, `${year}-01-01`, `${year}-12-31`))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHtml(t("vacation.noDetails"))}</td></tr>`;
    return;
  }

  tableBody.innerHTML = records.map((absence) => {
    const workdays = getVacationWorkdayKeys(absence, year).length;
    const statusKey = absence.endDate < todayKey
      ? "usedStatus"
      : absence.startDate > todayKey ? "bookedStatus" : "currentStatus";

    return `
      <tr>
        <td>${escapeHtml(formatDisplayDate(absence.startDate))}</td>
        <td>${escapeHtml(formatDisplayDate(absence.endDate))}</td>
        <td><strong>${escapeHtml(formatDayCount(workdays))}</strong></td>
        <td>${escapeHtml(t(`vacation.${statusKey}`))}</td>
        <td>${escapeHtml(absence.note || "-")}</td>
      </tr>
    `;
  }).join("");
}

function getAbsenceTypeLabel(type) {
  const key = `absence.${type}`;
  return t(key);
}

function initExportPage() {
  const exportJsonButton = document.getElementById("exportJsonButton");
  const importJsonButton = document.getElementById("importJsonButton");
  const restoreAutoBackupButton = document.getElementById("restoreAutoBackupButton");
  const importJsonFileInput = document.getElementById("importJsonFileInput");

  if (exportJsonButton) {
    exportJsonButton.addEventListener("click", () => {
      exportJsonBackup();
      renderExportPage();
    });
  }

  if (importJsonButton && importJsonFileInput) {
    importJsonButton.addEventListener("click", () => {
      importJsonFileInput.value = "";
      importJsonFileInput.click();
    });

    importJsonFileInput.addEventListener("change", () => {
      const selectedFile = importJsonFileInput.files[0];

      if (!selectedFile) {
        showExportStatus(t("export.importNoFile"), "error");
        return;
      }

      importJsonBackup(selectedFile);
    });
  }

  if (restoreAutoBackupButton) {
    restoreAutoBackupButton.addEventListener("click", () => {
      restoreAutoBackupData();
    });
  }

  renderExportPage();
}

function renderExportPage() {
  const summaryCards = document.getElementById("exportSummaryCards");

  if (!summaryCards) {
    return;
  }

  summaryCards.innerHTML = `
    <div class="export-summary-card">
      <span>${escapeHtml(t("export.summarySettings"))}</span>
      <strong>1</strong>
    </div>

    <div class="export-summary-card">
      <span>${escapeHtml(t("export.summaryEmployees"))}</span>
      <strong>${escapeHtml(String(employees.length))}</strong>
    </div>

    <div class="export-summary-card">
      <span>${escapeHtml(t("export.summaryEvents"))}</span>
      <strong>${escapeHtml(String(attendanceEvents.length))}</strong>
    </div>
  `;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (location.protocol === "file:") {
    console.log("Service worker file:// módban nem indul. Ez nem hiba.");
    return;
  }

  navigator.serviceWorker
    .register("sw.js")
    .then(() => {
      console.log("Service worker regisztrálva.");
    })
    .catch((error) => {
      console.warn("Service worker regisztráció sikertelen:", error);
    });
}


