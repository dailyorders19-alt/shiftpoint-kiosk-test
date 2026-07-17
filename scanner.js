let scannerStream = null;
let scannerLoopTimer = null;
let scannerDetector = null;
let scannerLastCode = "";
let scannerLastCodeAt = 0;
let scannerRequestedType = null;
let scannerResetTimer = null;
let scannerProcessing = false;
let scannerFacingMode = "environment";
let kioskInputTimer = null;

function isDedicatedScannerMode() {
  return document.body.classList.contains("scan-only-app");
}

function isAutoKioskMode() {
  return document.body.classList.contains("kiosk-app");
}

function initializeDedicatedScanner() {
  if (!isDedicatedScannerMode()) {
    return;
  }

  if (isAutoKioskMode()) {
    initializeAutoKioskScanner();
    return;
  }

  resetDedicatedScanner();
}

function initializeAutoKioskScanner() {
  scannerFacingMode = "user";
  scannerRequestedType = null;
  scannerProcessing = false;
  scannerLastCode = "";
  scannerLastCodeAt = 0;

  setupKioskUsbScanner();
  updateKioskClock();
  setInterval(updateKioskClock, 1000);
  startCameraScanner();
}

function startDedicatedScanner(type) {
  if (!isDedicatedScannerMode()) {
    return;
  }

  if (scannerResetTimer) {
    clearTimeout(scannerResetTimer);
    scannerResetTimer = null;
  }

  scannerRequestedType = type === "out" ? "out" : "in";
  scannerProcessing = false;
  scannerLastCode = "";
  scannerLastCodeAt = 0;

  const actionPanel = document.getElementById("scanActionPanel");
  const activePanel = document.getElementById("scanActivePanel");
  const confirmationPanel = document.getElementById("scanConfirmationPanel");
  const actionTitle = document.getElementById("scanActionTitle");
  const resultBox = document.getElementById("scannerResult");

  if (actionPanel) actionPanel.classList.add("hidden");
  if (activePanel) activePanel.classList.remove("hidden");
  if (confirmationPanel) confirmationPanel.classList.add("hidden");
  if (actionTitle) {
    actionTitle.textContent = t(scannerRequestedType === "in" ? "scan.scanForIn" : "scan.scanForOut");
  }
  if (resultBox) {
    resultBox.className = "scan-result hidden";
    resultBox.innerHTML = "";
  }

  startCameraScanner();
}

function resetDedicatedScanner() {
  if (!isDedicatedScannerMode()) {
    return;
  }

  if (isAutoKioskMode()) {
    resetAutoKioskScanner();
    return;
  }

  stopCameraScanner(false);

  if (scannerResetTimer) {
    clearTimeout(scannerResetTimer);
    scannerResetTimer = null;
  }

  scannerRequestedType = null;
  scannerProcessing = false;
  scannerLastCode = "";
  scannerLastCodeAt = 0;

  const actionPanel = document.getElementById("scanActionPanel");
  const activePanel = document.getElementById("scanActivePanel");
  const confirmationPanel = document.getElementById("scanConfirmationPanel");

  if (actionPanel) actionPanel.classList.remove("hidden");
  if (activePanel) activePanel.classList.add("hidden");
  if (confirmationPanel) confirmationPanel.className = "scan-kiosk-confirmation hidden";
}

async function startCameraScanner() {
  const video = document.getElementById("scannerVideo");
  const cameraBox = document.getElementById("scannerCameraBox");

  if (!video) {
    return;
  }

  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showScannerMessage(t("scan.secureContextError"), "error");
    return;
  }

  if (!("BarcodeDetector" in window)) {
    showScannerMessage(t("scan.barcodeUnsupported"), "error");
    return;
  }

  try {
    stopCameraScanner(false);

    scannerDetector = new BarcodeDetector({ formats: ["qr_code"] });

    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: scannerFacingMode }
      },
      audio: false
    });

    video.srcObject = scannerStream;
    await video.play();

    if (cameraBox) {
      cameraBox.classList.add("active");
    }

    setScannerButtons(true);
    showScannerMessage(t("scan.cameraRunning"), "info");
    scanCameraFrame();
  } catch (error) {
    console.error("Kamera indítási hiba:", error);
    stopCameraScanner(false);
    showScannerMessage(t("scan.cameraError"), "error");
  }
}

function stopCameraScanner(showMessage = true) {
  const video = document.getElementById("scannerVideo");
  const cameraBox = document.getElementById("scannerCameraBox");

  if (scannerLoopTimer) {
    clearTimeout(scannerLoopTimer);
    scannerLoopTimer = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  scannerDetector = null;

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (cameraBox) {
    cameraBox.classList.remove("active");
  }

  setScannerButtons(false);

  if (showMessage) {
    showScannerMessage(t("scan.cameraStopped"), "info");
  }
}

function scanCameraFrame() {
  const video = document.getElementById("scannerVideo");

  if (!scannerStream || !scannerDetector || !video) {
    return;
  }

  if (video.readyState >= 2) {
    scannerDetector
      .detect(video)
      .then((codes) => {
        if (codes && codes.length > 0 && codes[0].rawValue) {
          handleScannedCode(codes[0].rawValue, "camera");
        }
      })
      .catch((error) => {
        console.warn("QR olvasási hiba:", error);
      });
  }

  scannerLoopTimer = setTimeout(scanCameraFrame, 350);
}

function handleScannedCode(code, source = "camera") {
  const cleanCode = String(code || "").trim();

  if (!cleanCode) {
    return;
  }

  const dedicatedMode = isDedicatedScannerMode();
  const autoKioskMode = isAutoKioskMode();

  if (dedicatedMode && !autoKioskMode && (!scannerRequestedType || scannerProcessing)) {
    return;
  }

  if (autoKioskMode && scannerProcessing) {
    return;
  }

  const now = Date.now();

  if (cleanCode === scannerLastCode && now - scannerLastCodeAt < 2500) {
    return;
  }

  scannerLastCode = cleanCode;
  scannerLastCodeAt = now;

  const employeeList = typeof employees !== "undefined" ? employees : [];
  const employee = employeeList.find((item) => item.id === cleanCode);

  const resultBox = document.getElementById("scannerResult");

  if (!resultBox) {
    return;
  }

  if (!employee) {
    resultBox.className = "scan-result scan-result-error";
    resultBox.innerHTML = `
      <strong>${escapeHtml(t("scan.unknownCode"))}</strong>
      <span>${escapeHtml(cleanCode)}</span>
    `;
    showScannerMessage(t("scan.codeNotFound"), "error");
    return;
  }

  if (!employee.active) {
    resultBox.className = "scan-result scan-result-warning";
    resultBox.innerHTML = `
      <strong>${escapeHtml(employee.name)}</strong>
      <span>${escapeHtml(employee.id)} • ${escapeHtml(employee.department || "-")}</span>
      <span>${escapeHtml(t("employee.inactive"))}</span>
    `;
    showScannerMessage(t("attendance.inactiveNotSaved"), "error");
    return;
  }

  if (dedicatedMode) {
    scannerProcessing = true;

    if (!autoKioskMode) {
      const expectedType = getNextAttendanceType(employee.id, new Date());

      if (expectedType !== scannerRequestedType) {
        stopCameraScanner(false);
        showDedicatedScanConfirmation(
          employee,
          scannerRequestedType === "in" ? t("scan.alreadyCheckedIn") : t("scan.alreadyCheckedOut"),
          "warning"
        );
        scheduleDedicatedScannerReset();
        return;
      }
    }
  }

  const savedEvent = registerAttendanceEvent(employee, source, dedicatedMode && !autoKioskMode ? scannerRequestedType : null);
  const sourceText = source === "manual"
    ? t("scan.sourceManual")
    : source === "usb"
      ? t("scan.sourceUsb")
      : t("scan.sourceCamera");

  if (autoKioskMode && savedEvent) {
    if (source === "camera") {
      stopCameraScanner(false);
    }

    showDedicatedScanConfirmation(
      employee,
      savedEvent.type === "in" ? t("kiosk.checkedIn") : t("kiosk.checkedOut"),
      savedEvent.type === "in" ? "in" : "out",
      formatTimeFromIso(savedEvent.createdAt)
    );
    scheduleDedicatedScannerReset();
    return;
  }

  const statusText = employee.active ? t("employee.active") : t("employee.inactive");
  const eventText = savedEvent
    ? `${getAttendanceTypeLabel(savedEvent.type)} • ${formatTimeFromIso(savedEvent.createdAt)}`
    : "";

  resultBox.className = "scan-result scan-result-success";

    resultBox.innerHTML = `
    <strong>${escapeHtml(employee.name)}</strong>
    <span>${escapeHtml(employee.id)} • ${escapeHtml(employee.department || "-")}</span>
    <span>${escapeHtml(statusText)} • ${escapeHtml(sourceText)}</span>
    <span class="scan-event-line">${escapeHtml(eventText)}</span>
  `;

  if (source === "camera") {
    stopCameraScanner(false);
  }

  if (dedicatedMode && savedEvent) {
    showDedicatedScanConfirmation(
      employee,
      savedEvent.type === "in" ? t("scan.checkedIn") : t("scan.checkedOut"),
      savedEvent.type === "in" ? "in" : "out",
      formatTimeFromIso(savedEvent.createdAt)
    );
    scheduleDedicatedScannerReset();
    return;
  }

  if (savedEvent && savedEvent.type === "in") {
    showScannerMessage(t("attendance.savedIn"), "success");
  } else {
    showScannerMessage(t("attendance.savedOut"), "success");
  }
}

function showScannerMessage(message, type = "info") {
  const statusBox = document.getElementById("scannerStatus");

  if (!statusBox) {
    return;
  }

  statusBox.textContent = message;
  statusBox.className = `scanner-status scanner-status-${type}`;
}

function setScannerButtons(isRunning) {
  const startButton = document.getElementById("startScannerButton");
  const stopButton = document.getElementById("stopScannerButton");
  const switchButton = document.getElementById("switchCameraButton");

  if (startButton) {
    startButton.disabled = isRunning;
  }

  if (stopButton) {
    stopButton.disabled = !isRunning;
  }

  if (switchButton) {
    switchButton.textContent = t(scannerFacingMode === "user" ? "scan.switchToBackCamera" : "scan.switchToFrontCamera");
  }
}

function switchScannerCamera() {
  scannerFacingMode = scannerFacingMode === "user" ? "environment" : "user";

  if (scannerStream) {
    startCameraScanner();
    return;
  }

  setScannerButtons(false);
}

function showDedicatedScanConfirmation(employee, title, type, timeText = "") {
  const activePanel = document.getElementById("scanActivePanel");
  const confirmationPanel = document.getElementById("scanConfirmationPanel");
  const titleBox = document.getElementById("scanConfirmationTitle");
  const nameBox = document.getElementById("scanConfirmationName");
  const timeBox = document.getElementById("scanConfirmationTime");

  if (activePanel) activePanel.classList.add("hidden");
  if (confirmationPanel) {
    confirmationPanel.className = `scan-kiosk-confirmation scan-kiosk-confirmation-${type}`;
  }
  if (titleBox) titleBox.textContent = title;
  if (nameBox) nameBox.textContent = `${employee.name} (${employee.id})`;
  if (timeBox) timeBox.textContent = timeText;
}

function scheduleDedicatedScannerReset() {
  if (scannerResetTimer) {
    clearTimeout(scannerResetTimer);
  }

  scannerResetTimer = setTimeout(() => {
    resetDedicatedScanner();
  }, 4000);
}

function resetAutoKioskScanner() {
  const activePanel = document.getElementById("scanActivePanel");
  const confirmationPanel = document.getElementById("scanConfirmationPanel");
  const resultBox = document.getElementById("scannerResult");

  scannerProcessing = false;

  if (activePanel) activePanel.classList.remove("hidden");
  if (confirmationPanel) confirmationPanel.className = "scan-kiosk-confirmation hidden";
  if (resultBox) {
    resultBox.className = "scan-result hidden";
    resultBox.innerHTML = "";
  }

  showScannerMessage(t("kiosk.readyText"), "info");
  focusKioskScannerInput();

  if (!scannerStream) {
    startCameraScanner();
  }
}

function setupKioskUsbScanner() {
  const input = document.getElementById("kioskScannerInput");

  if (!input) {
    return;
  }

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    readKioskScannerInput();
  });

  input.addEventListener("input", () => {
    if (kioskInputTimer) {
      clearTimeout(kioskInputTimer);
    }

    kioskInputTimer = setTimeout(readKioskScannerInput, 120);
  });

  document.addEventListener("click", focusKioskScannerInput);
  focusKioskScannerInput();
}

function readKioskScannerInput() {
  const input = document.getElementById("kioskScannerInput");

  if (!input) {
    return;
  }

  const code = input.value.trim();
  input.value = "";

  if (code) {
    handleScannedCode(code, "usb");
  }

  focusKioskScannerInput();
}

function focusKioskScannerInput() {
  const input = document.getElementById("kioskScannerInput");

  if (input) {
    input.focus({ preventScroll: true });
  }
}

function updateKioskClock() {
  const clock = document.getElementById("kioskClock");

  if (!clock) {
    return;
  }

  clock.textContent = new Date().toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
