function getSelectedAttendanceDateKey() {
  const attendanceDateInput = document.getElementById("attendanceDateInput");

  return attendanceDateInput && getDateControlValue(attendanceDateInput)
    ? getDateControlValue(attendanceDateInput)
    : getDateKey(new Date());
}

function getDailyAttendanceReportData(selectedDateKey) {
  const dayEvents = attendanceEvents
    .filter((event) => event.dateKey === selectedDateKey)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const employeeIds = [...new Set(dayEvents.map((event) => event.employeeId))];

  const dailyRows = employeeIds.map((employeeId) => {
    const employee = employees.find((item) => item.id === employeeId);
    const firstEvent = dayEvents.find((event) => event.employeeId === employeeId);

    return calculateDailySummary({
      employeeId,
      employeeName: employee ? employee.name : firstEvent.employeeName || "-",
      department: employee ? employee.department || "-" : firstEvent.department || "-",
      dateKey: selectedDateKey
    });
  });

  return {
    dateKey: selectedDateKey,
    dailyRows: sortAttendanceRowsByEmployee(dailyRows),
    employeeSummaries: dailyRows
  };
}

function sortAttendanceRowsByEmployee(rows) {
  return [...rows].sort((a, b) => {
    const nameCompare = String(a.employeeName).localeCompare(String(b.employeeName), "hu");

    if (nameCompare !== 0) {
      return nameCompare;
    }

    return String(a.dateKey).localeCompare(String(b.dateKey));
  });
}

function getAttendanceReportHeaders() {
  return [
    t("attendance.date"),
    t("attendance.employee"),
    t("attendance.department"),
    t("attendance.firstArrival"),
    t("attendance.lastDeparture"),
    t("attendance.rawWorked"),
    t("print.awayTime")
  ];
}

function getAttendanceReportRowValues(summary) {
  return [
    formatDisplayDate(summary.dateKey),
    summary.employeeName,
    summary.department || "-",
    summary.firstArrival || "-",
    summary.lastDeparture || "-",
    formatDuration(summary.rawWorkedMinutes),
    formatDuration(summary.missingMinutes)
  ];
}

function buildAttendanceReportRowsHtml(rows, emptyTextKey) {
  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="7" class="empty-row">${escapeHtml(t(emptyTextKey))}</td>
      </tr>
    `;
  }

  return sortAttendanceRowsByEmployee(rows)
    .map((summary) => {
      const values = getAttendanceReportRowValues(summary);

      return `
        <tr>
          ${values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
        </tr>
      `;
    })
    .join("");
}

function exportAttendanceReportPdf(options) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert(t("print.printError"));
    return;
  }

  const rows = sortAttendanceRowsByEmployee(options.rows);
  const headers = getAttendanceReportHeaders();
  const rowsHtml = buildAttendanceReportRowsHtml(rows, options.emptyTextKey);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(t(options.titleKey))}</title>

      <style>
        body {
          margin: 0;
          padding: 18px;
          font-family: Arial, sans-serif;
          color: #111827;
          background: white;
          font-size: 12px;
        }

        h1 {
          margin: 0 0 8px;
          text-align: center;
          font-size: 22px;
        }

        .print-header {
          border: 1.5px solid #6b7280;
          padding: 10px;
          margin-bottom: 16px;
        }

        .print-header-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 5px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        th,
        td {
          border: 1.5px solid #6b7280;
          padding: 6px;
          text-align: left;
          vertical-align: top;
        }

        th {
          background: #e5e7eb;
          font-weight: bold;
        }

        .empty-row {
          text-align: center;
          color: #6b7280;
        }

        .small-text {
          color: #374151;
          font-size: 11px;
        }

        @page {
          size: A4 portrait;
          margin: 10mm;
        }
      </style>
    </head>

    <body>
      <h1>${escapeHtml(t(options.titleKey))}</h1>

      <div class="print-header">
        <div class="print-header-row">
          <div>
            <strong>${escapeHtml(t("print.company"))}:</strong>
            ${escapeHtml(appSettings.companyName || "Centru de sticla")}
          </div>

          <div>
            <strong>${escapeHtml(t(options.rangeLabelKey))}:</strong>
            ${escapeHtml(options.rangeText)}
          </div>
        </div>

        <div class="print-header-row small-text">
          <div>
            <strong>${escapeHtml(t("print.generatedAt"))}:</strong>
            ${escapeHtml(formatDisplayDate(getDateKey(new Date())))} ${escapeHtml(formatTimeFromIso(new Date().toISOString()))}
          </div>

          <div>
            <strong>${escapeHtml(t("statistics.employeesWithEvents"))}:</strong>
            ${escapeHtml(String(options.employeeCount))}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
          </tr>
        </thead>

        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
          }, 500);
        };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function exportAttendanceReportXlsx(options) {
  const rows = [];

  rows.push([t(options.titleKey)]);
  rows.push([t("print.company"), appSettings.companyName || "Centru de sticla"]);
  rows.push([t(options.rangeLabelKey), options.rangeText]);
  rows.push([
    t("print.generatedAt"),
    `${formatDisplayDate(getDateKey(new Date()))} ${formatTimeFromIso(new Date().toISOString())}`
  ]);
  rows.push([t("statistics.employeesWithEvents"), String(options.employeeCount)]);
  rows.push([]);
  rows.push(getAttendanceReportHeaders());

  const reportRows = sortAttendanceRowsByEmployee(options.rows);

  if (reportRows.length === 0) {
    rows.push([t(options.emptyTextKey)]);
  } else {
    reportRows.forEach((summary) => {
      rows.push(getAttendanceReportRowValues(summary));
    });
  }

  const xlsxBlob = createSimpleXlsxBlob(rows, t(options.titleKey));

  downloadBlobFile(xlsxBlob, options.fileName);
  alert(t("export.xlsxSaved"));
}
function exportDailyPdf() {
  const selectedDateKey = getSelectedAttendanceDateKey();
  const dailyData = getDailyAttendanceReportData(selectedDateKey);

  exportAttendanceReportPdf({
    titleKey: "print.dailyAttendanceTitle",
    rangeLabelKey: "attendance.date",
    rangeText: formatDisplayDate(selectedDateKey),
    rows: dailyData.dailyRows,
    employeeCount: dailyData.employeeSummaries.length,
    emptyTextKey: "print.noSummary"
  });
}
function exportDailyXlsx() {
  try {
    const selectedDateKey = getSelectedAttendanceDateKey();
    const dailyData = getDailyAttendanceReportData(selectedDateKey);

    exportAttendanceReportXlsx({
      titleKey: "print.dailyAttendanceTitle",
      rangeLabelKey: "attendance.date",
      rangeText: formatDisplayDate(selectedDateKey),
      rows: dailyData.dailyRows,
      employeeCount: dailyData.employeeSummaries.length,
      emptyTextKey: "print.noSummary",
      fileName: `jelenleti-napi-lista-${selectedDateKey}.xlsx`
    });
  } catch (error) {
    console.error("XLSX export hiba:", error);
    alert(t("export.xlsxError"));
  }
}
function createSimpleXlsxBlob(rows, sheetName) {
  const files = buildSimpleXlsxFiles(prepareRowsForOvertimeVisibility(rows), sheetName);
  const zipContent = createZipFile(files);

  return new Blob([zipContent], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function getHiddenOvertimeExportLabels() {
  return new Set([
    t("attendance.overtime"),
    t("payment.overtimeValue"),
    t("payment.overtimeRate"),
    t("statistics.mostOvertime"),
    t("payment.totalPayment")
  ]);
}

function prepareRowsForOvertimeVisibility(rows) {
  if (typeof shouldShowOvertimeData !== "function" || shouldShowOvertimeData()) {
    return rows;
  }

  const labels = getHiddenOvertimeExportLabels();
  let hiddenIndexes = [];

  return rows.reduce((result, row) => {
    const cells = Array.isArray(row) ? row : [];

    if (cells.length === 0) {
      hiddenIndexes = [];
      result.push(cells);
      return result;
    }

    if (cells.length <= 2 && labels.has(String(cells[0] || "").trim())) {
      return result;
    }

    const headerHiddenIndexes = cells
      .map((cell, index) => labels.has(String(cell || "").trim()) ? index : -1)
      .filter((index) => index >= 0);

    if (headerHiddenIndexes.length > 0) {
      hiddenIndexes = headerHiddenIndexes;
    } else if (cells.length === 1) {
      hiddenIndexes = [];
    }

    result.push(cells.filter((cell, index) => !hiddenIndexes.includes(index)));
    return result;
  }, []);
}

function removeHiddenOvertimeFromPrintDocument(printDocument) {
  if (typeof shouldShowOvertimeData !== "function" || shouldShowOvertimeData()) {
    return;
  }

  const labels = getHiddenOvertimeExportLabels();

  printDocument.querySelectorAll("table").forEach((table) => {
    table.querySelectorAll("tr").forEach((row) => {
      const firstCell = row.cells && row.cells[0];
      if (row.cells.length <= 2 && firstCell && labels.has(firstCell.textContent.trim())) {
        row.remove();
      }
    });

    const headers = [...table.querySelectorAll("thead th")];
    const indexes = headers
      .map((cell, index) => labels.has(cell.textContent.trim()) ? index : -1)
      .filter((index) => index >= 0)
      .sort((a, b) => b - a);

    indexes.forEach((index) => {
      table.querySelectorAll("tr").forEach((row) => {
        if (row.cells && row.cells[index]) {
          row.deleteCell(index);
        }
      });
    });
  });
}

function buildSimpleXlsxFiles(rows, sheetName) {
  const safeSheetName = String(sheetName || "Sheet1")
    .replace(/[\\/?*\[\]:]/g, " ")
    .slice(0, 31) || "Sheet1";

  return [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXmlValue(safeSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      path: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
    },
    {
      path: "xl/worksheets/sheet1.xml",
      content: buildWorksheetXml(rows)
    }
  ];
}

function buildWorksheetXml(rows) {
  const rowsXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cellsXml = row
        .map((cellValue, columnIndex) => {
          return buildWorksheetCell(cellValue, rowNumber, columnIndex + 1);
        })
        .join("");

      return `<row r="${rowNumber}">${cellsXml}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="10" width="20" customWidth="1"/>
  </cols>
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

function buildWorksheetCell(value, rowNumber, columnNumber) {
  const cellReference = `${getExcelColumnName(columnNumber)}${rowNumber}`;
  const cellText = escapeXmlValue(value === null || value === undefined ? "" : value);

  return `<c r="${cellReference}" t="inlineStr"><is><t xml:space="preserve">${cellText}</t></is></c>`;
}

function getExcelColumnName(columnNumber) {
  let columnName = "";
  let currentNumber = columnNumber;

  while (currentNumber > 0) {
    const remainder = (currentNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    currentNumber = Math.floor((currentNumber - 1) / 26);
  }

  return columnName;
}

function escapeXmlValue(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function downloadBlobFile(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  URL.revokeObjectURL(downloadUrl);
}

function encodeUtf8(value) {
  return new TextEncoder().encode(String(value));
}

function createZipFile(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encodeUtf8(file.path);
    const contentBytes = encodeUtf8(file.content);
    const crc = calculateCrc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, contentBytes.length);
    writeUint32(localHeader, 22, contentBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, contentBytes.length);
    writeUint32(centralHeader, 24, contentBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);

  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 4, 0);
  writeUint16(endRecord, 6, 0);
  writeUint16(endRecord, 8, files.length);
  writeUint16(endRecord, 10, files.length);
  writeUint32(endRecord, 12, centralDirectorySize);
  writeUint32(endRecord, 16, offset);
  writeUint16(endRecord, 20, 0);

  return concatUint8Arrays([...localParts, ...centralParts, endRecord]);
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
}

function writeUint16(array, offset, value) {
  array[offset] = value & 0xff;
  array[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(array, offset, value) {
  array[offset] = value & 0xff;
  array[offset + 1] = (value >>> 8) & 0xff;
  array[offset + 2] = (value >>> 16) & 0xff;
  array[offset + 3] = (value >>> 24) & 0xff;
}

let xlsxCrcTable = null;

function calculateCrc32(bytes) {
  if (!xlsxCrcTable) {
    xlsxCrcTable = buildCrc32Table();
  }

  let crc = 0 ^ -1;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ xlsxCrcTable[(crc ^ bytes[index]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

function buildCrc32Table() {
  const table = [];

  for (let index = 0; index < 256; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
}

function exportWeeklyPdf() {
  const selectedDateKey = getSelectedAttendanceDateKey();
  const weeklyData = getWeeklyAttendanceReportData(selectedDateKey);

  exportAttendanceReportPdf({
    titleKey: "print.weeklyAttendanceTitle",
    rangeLabelKey: "print.weekRange",
    rangeText: `${formatDisplayDate(weeklyData.weekStartKey)} - ${formatDisplayDate(weeklyData.weekEndKey)}`,
    rows: weeklyData.dailyRows,
    employeeCount: weeklyData.employeeSummaries.length,
    emptyTextKey: "print.noWeeklySummary"
  });
}
function getWeeklyAttendanceReportData(selectedDateKey) {
  const weekRange = getWeekRangeFromDateKey(selectedDateKey);
  const weekDateKeys = getDateKeysBetween(weekRange.startKey, weekRange.endKey);

  const dailyRows = [];
  const employeeSummaryMap = new Map();

  weekDateKeys.forEach((dateKey) => {
    const eventsForDay = attendanceEvents
      .filter((event) => event.dateKey === dateKey)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const employeeIds = [...new Set(eventsForDay.map((event) => event.employeeId))];

    employeeIds.forEach((employeeId) => {
      const employee = employees.find((item) => item.id === employeeId);
      const firstEvent = eventsForDay.find((event) => event.employeeId === employeeId);

      const dailySummary = calculateDailySummary({
        employeeId,
        employeeName: employee ? employee.name : firstEvent.employeeName || "-",
        department: employee ? employee.department || "-" : firstEvent.department || "-",
        dateKey
      });

      dailyRows.push(dailySummary);

      if (!employeeSummaryMap.has(employeeId)) {
        employeeSummaryMap.set(employeeId, {
          employeeId,
          employeeName: dailySummary.employeeName,
          department: dailySummary.department,
          workDays: 0,
          openDays: 0,
          rawWorkedMinutes: 0,
          lunchDeductionMinutes: 0,
          netWorkedMinutes: 0,
          overtimeMinutes: 0,
          missingMinutes: 0,
          balanceMinutes: 0
        });
      }

      const weeklySummary = employeeSummaryMap.get(employeeId);

      weeklySummary.workDays += 1;
      weeklySummary.rawWorkedMinutes += dailySummary.rawWorkedMinutes;
      weeklySummary.lunchDeductionMinutes += dailySummary.lunchDeductionMinutes;
      weeklySummary.netWorkedMinutes += dailySummary.netWorkedMinutes;
      weeklySummary.overtimeMinutes += dailySummary.overtimeMinutes;
      weeklySummary.missingMinutes += dailySummary.missingMinutes;
      weeklySummary.balanceMinutes += dailySummary.balanceMinutes;

      if (dailySummary.isOpen) {
        weeklySummary.openDays += 1;
      }
    });
  });

  const employeeSummaries = Array.from(employeeSummaryMap.values())
    .map((summary) => ({
      ...summary,
      overtimeMinutes: Math.max(0, summary.balanceMinutes),
      missingMinutes: Math.max(0, -summary.balanceMinutes)
    }))
    .sort((a, b) => {
      return String(a.employeeName).localeCompare(String(b.employeeName), "hu");
    });

  dailyRows.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }

    return String(a.employeeName).localeCompare(String(b.employeeName), "hu");
  });

  return {
    weekStartKey: weekRange.startKey,
    weekEndKey: weekRange.endKey,
    weekDateKeys,
    dailyRows,
    employeeSummaries
  };
}

function getWeekRangeFromDateKey(dateKey) {
  const date = buildDateFromDateKey(dateKey);
  const dayNumber = date.getDay();
  const diffToMonday = dayNumber === 0 ? -6 : 1 - dayNumber;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startKey: getDateKey(monday),
    endKey: getDateKey(sunday)
  };
}

function getDateKeysBetween(startDateKey, endDateKey) {
  const dateKeys = [];
  const currentDate = buildDateFromDateKey(startDateKey);
  const endDate = buildDateFromDateKey(endDateKey);

  while (currentDate <= endDate) {
    dateKeys.push(getDateKey(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateKeys;
}

function buildDateFromDateKey(dateKey) {
  const parts = String(dateKey).split("-").map(Number);

  if (parts.length !== 3) {
    return new Date();
  }

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  return new Date(year, month - 1, day);
}

function exportWeeklyXlsx() {
  try {
    const selectedDateKey = getSelectedAttendanceDateKey();
    const weeklyData = getWeeklyAttendanceReportData(selectedDateKey);

    exportAttendanceReportXlsx({
      titleKey: "print.weeklyAttendanceTitle",
      rangeLabelKey: "print.weekRange",
      rangeText: `${formatDisplayDate(weeklyData.weekStartKey)} - ${formatDisplayDate(weeklyData.weekEndKey)}`,
      rows: weeklyData.dailyRows,
      employeeCount: weeklyData.employeeSummaries.length,
      emptyTextKey: "print.noWeeklySummary",
      fileName: `jelenleti-heti-lista-${weeklyData.weekStartKey}-${weeklyData.weekEndKey}.xlsx`
    });
  } catch (error) {
    console.error("Heti XLSX export hiba:", error);
    alert(t("export.xlsxError"));
  }
}
function exportMonthlyPdf() {
  const selectedDateKey = getSelectedAttendanceDateKey();
  const monthlyData = getMonthlyAttendanceReportData(selectedDateKey);
  const monthKey = String(selectedDateKey).slice(0, 7);
  const monthTitle = `${formatDisplayDate(monthlyData.monthStartKey)} - ${formatDisplayDate(monthlyData.monthEndKey)}`;
  const employeeList = employees
    .filter((employee) => employee.active)
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "hu"));

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert(t("print.printError"));
    return;
  }

  const headers = getAttendanceReportHeaders();
  const employeePagesHtml = employeeList.length === 0
    ? `
      <section class="employee-print-page">
        <h1>${escapeHtml(monthTitle)}</h1>
        <p class="empty-row">${escapeHtml(t("employees.empty"))}</p>
      </section>
    `
    : employeeList.map((employee) => {
      const employeeData = getEmployeeMonthlyReportData(employee.id, monthKey);
      const rowsHtml = buildAttendanceReportRowsHtml(employeeData.dailyRows, "print.employeeNoData");
      const summaryRowsHtml = `
        <tr>
          <td>${escapeHtml(t("profile.workDays"))}</td>
          <td><strong>${escapeHtml(String(employeeData.workDays))}</strong></td>
        </tr>
        <tr>
          <td>${escapeHtml(t("attendance.rawWorked"))}</td>
          <td><strong>${escapeHtml(formatDuration(employeeData.rawWorkedMinutes))}</strong></td>
        </tr>
        <tr>
          <td>${escapeHtml(t("attendance.netWorked"))}</td>
          <td><strong>${escapeHtml(formatDuration(employeeData.netWorkedMinutes))}</strong></td>
        </tr>
        <tr>
          <td>${escapeHtml(t("payment.mealVoucherDays"))}</td>
          <td><strong>${escapeHtml(String(employeeData.mealVoucherDays))}</strong></td>
        </tr>
        <tr>
          <td>${escapeHtml(t("payment.mealVoucherValue"))}</td>
          <td><strong>${escapeHtml(formatMoneyValue(employeeData.mealVoucherValue))}</strong></td>
        </tr>
        <tr>
          <td>${escapeHtml(t("attendance.missing"))}</td>
          <td class="balance-negative"><strong>${escapeHtml(formatDuration(employeeData.missingMinutes))}</strong></td>
        </tr>
        <tr>
          <td>${escapeHtml(t("attendance.balance"))}</td>
          <td class="${getBalanceClass(employeeData.balanceMinutes)}">
            <strong>${escapeHtml(formatSignedDuration(employeeData.balanceMinutes))}</strong>
          </td>
        </tr>
      `;

      return `
        <section class="employee-print-page">
          <div class="employee-page-header">
            <h1>${escapeHtml(monthTitle)}</h1>
            <h2>${escapeHtml(employee.name)}</h2>
            <div class="employee-meta">
              <span><strong>${escapeHtml(t("attendance.code"))}:</strong> ${escapeHtml(employee.id)}</span>
              <span><strong>${escapeHtml(t("attendance.department"))}:</strong> ${escapeHtml(employee.department || "-")}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <h3>${escapeHtml(t("print.employeeSummary"))}</h3>
          <table class="summary-table">
            <tbody>
              ${summaryRowsHtml}
            </tbody>
          </table>
        </section>
      `;
    }).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(t("print.monthlyAttendanceTitle"))}</title>

      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          color: #111827;
          background: white;
          font-size: 11px;
        }

        .employee-print-page {
          box-sizing: border-box;
          min-height: 277mm;
          padding: 12mm;
          page-break-after: always;
          break-after: page;
        }

        .employee-print-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }

        .employee-page-header {
          border: 1.5px solid #6b7280;
          padding: 10px;
          margin-bottom: 12px;
          text-align: center;
        }

        h1 {
          margin: 0 0 6px;
          font-size: 20px;
        }

        h2 {
          margin: 0 0 8px;
          font-size: 17px;
        }

        h3 {
          margin: 16px 0 6px;
          font-size: 14px;
        }

        .employee-meta {
          display: flex;
          justify-content: center;
          gap: 18px;
          flex-wrap: wrap;
          color: #374151;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        th,
        td {
          border: 1.2px solid #6b7280;
          padding: 5px;
          text-align: left;
          vertical-align: top;
        }

        th {
          background: #e5e7eb;
          font-weight: bold;
        }

        .summary-table {
          max-width: 360px;
        }

        .empty-row {
          text-align: center;
          color: #6b7280;
        }

        .balance-positive {
          color: #166534;
        }

        .balance-negative {
          color: #991b1b;
        }

        .balance-neutral {
          color: #374151;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }
      </style>
    </head>

    <body>
      ${employeePagesHtml}

      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
          }, 500);
        };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
function getMonthlyAttendanceReportData(selectedDateKey) {
  const monthRange = getMonthRangeFromDateKey(selectedDateKey);
  const monthDateKeys = getDateKeysBetween(monthRange.startKey, monthRange.endKey);

  const dailyRows = [];
  const employeeSummaryMap = new Map();

  monthDateKeys.forEach((dateKey) => {
    const eventsForDay = attendanceEvents
      .filter((event) => event.dateKey === dateKey)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const employeeIds = [...new Set(eventsForDay.map((event) => event.employeeId))];

    employeeIds.forEach((employeeId) => {
      const employee = employees.find((item) => item.id === employeeId);
      const firstEvent = eventsForDay.find((event) => event.employeeId === employeeId);

      const dailySummary = calculateDailySummary({
        employeeId,
        employeeName: employee ? employee.name : firstEvent.employeeName || "-",
        department: employee ? employee.department || "-" : firstEvent.department || "-",
        dateKey
      });

      dailyRows.push(dailySummary);

      if (!employeeSummaryMap.has(employeeId)) {
        employeeSummaryMap.set(employeeId, {
          employeeId,
          employeeName: dailySummary.employeeName,
          department: dailySummary.department,
          workDays: 0,
          openDays: 0,
          rawWorkedMinutes: 0,
          lunchDeductionMinutes: 0,
          netWorkedMinutes: 0,
          overtimeMinutes: 0,
          missingMinutes: 0,
          balanceMinutes: 0
        });
      }

      const monthlySummary = employeeSummaryMap.get(employeeId);

      monthlySummary.workDays += 1;
      monthlySummary.rawWorkedMinutes += dailySummary.rawWorkedMinutes;
      monthlySummary.lunchDeductionMinutes += dailySummary.lunchDeductionMinutes;
      monthlySummary.netWorkedMinutes += dailySummary.netWorkedMinutes;
      monthlySummary.overtimeMinutes += dailySummary.overtimeMinutes;
      monthlySummary.missingMinutes += dailySummary.missingMinutes;
      monthlySummary.balanceMinutes += dailySummary.balanceMinutes;

      if (dailySummary.isOpen) {
        monthlySummary.openDays += 1;
      }
    });
  });

  const employeeSummaries = Array.from(employeeSummaryMap.values())
    .map((summary) => ({
      ...summary,
      overtimeMinutes: Math.max(0, summary.balanceMinutes),
      missingMinutes: Math.max(0, -summary.balanceMinutes)
    }))
    .sort((a, b) => {
      return String(a.employeeName).localeCompare(String(b.employeeName), "hu");
    });

  dailyRows.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }

    return String(a.employeeName).localeCompare(String(b.employeeName), "hu");
  });

  return {
    monthStartKey: monthRange.startKey,
    monthEndKey: monthRange.endKey,
    monthDateKeys,
    dailyRows,
    employeeSummaries
  };
}

function getMonthRangeFromDateKey(dateKey) {
  const date = buildDateFromDateKey(dateKey);

  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startKey: getDateKey(firstDay),
    endKey: getDateKey(lastDay)
  };
}

function exportMonthlyXlsx() {
  try {
    const selectedDateKey = getSelectedAttendanceDateKey();
    const monthKey = String(selectedDateKey).slice(0, 7);
    const monthRange = getMonthRangeFromDateKey(`${monthKey}-01`);
    const monthText = `${formatDisplayDate(monthRange.startKey)} - ${formatDisplayDate(monthRange.endKey)}`;
    const employeeList = employees
      .filter((employee) => employee.active)
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "hu"));

    const rows = [];

    rows.push([t("print.monthlyAttendanceTitle")]);
    rows.push([t("print.company"), appSettings.companyName || "Centru de sticla"]);
    rows.push([t("print.monthRange"), monthText]);
    rows.push([
      t("print.generatedAt"),
      `${formatDisplayDate(getDateKey(new Date()))} ${formatTimeFromIso(new Date().toISOString())}`
    ]);
    rows.push([t("statistics.employeesWithEvents"), String(employeeList.length)]);
    rows.push([]);

    if (employeeList.length === 0) {
      rows.push([t("employees.empty")]);
    } else {
      employeeList.forEach((employee, index) => {
        const employeeData = getEmployeeMonthlyReportData(employee.id, monthKey);

        if (index > 0) {
          rows.push([]);
          rows.push([]);
        }

        rows.push([monthText]);
        rows.push([t("attendance.employee"), employee.name]);
        rows.push([t("attendance.code"), employee.id]);
        rows.push([t("attendance.department"), employee.department || "-"]);
        rows.push([]);
        rows.push(getAttendanceReportHeaders());

        if (employeeData.dailyRows.length === 0) {
          rows.push([t("print.employeeNoData")]);
        } else {
          employeeData.dailyRows.forEach((summary) => {
            rows.push(getAttendanceReportRowValues(summary));
          });
        }

        rows.push([]);
        rows.push([t("print.employeeSummary")]);
        rows.push([t("profile.workDays"), String(employeeData.workDays)]);
        rows.push([t("attendance.rawWorked"), formatDuration(employeeData.rawWorkedMinutes)]);
        rows.push([t("attendance.netWorked"), formatDuration(employeeData.netWorkedMinutes)]);
        rows.push([t("payment.mealVoucherDays"), String(employeeData.mealVoucherDays)]);
        rows.push([t("payment.mealVoucherValue"), formatMoneyValue(employeeData.mealVoucherValue)]);
        rows.push([t("attendance.missing"), formatDuration(employeeData.missingMinutes)]);
        rows.push([t("attendance.balance"), formatSignedDuration(employeeData.balanceMinutes)]);
      });
    }

    const fileName = `jelenleti-havi-lista-${monthKey}.xlsx`;
    const xlsxBlob = createSimpleXlsxBlob(rows, t("print.monthlyAttendanceTitle"));

    downloadBlobFile(xlsxBlob, fileName);
    alert(t("export.xlsxSaved"));
  } catch (error) {
    console.error("Havi XLSX export hiba:", error);
    alert(t("export.xlsxError"));
  }
}
function exportEmployeePdf() {
  const employeeSelect = document.getElementById("profileEmployeeSelect");
  const monthInput = document.getElementById("profileMonthInput");

  if (!employeeSelect || !monthInput) {
    return;
  }

  const employeeId = employeeSelect.value;
  const monthKey = monthInput.value || getMonthKey(new Date());
  const employee = employees.find((item) => item.id === employeeId);

  if (!employee) {
    alert(t("profile.selectEmployee"));
    return;
  }

  const employeeData = getEmployeeMonthlyReportData(employee.id, monthKey);

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert(t("print.printError"));
    return;
  }

  const summaryRowsHtml = `
    <tr>
      <td>${escapeHtml(t("profile.workDays"))}</td>
      <td><strong>${escapeHtml(String(employeeData.workDays))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("attendance.rawWorked"))}</td>
      <td><strong>${escapeHtml(formatDuration(employeeData.rawWorkedMinutes))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("attendance.lunchDeduction"))}</td>
      <td><strong>${escapeHtml(formatDuration(employeeData.lunchDeductionMinutes))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("attendance.netWorked"))}</td>
      <td><strong>${escapeHtml(formatDuration(employeeData.netWorkedMinutes))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("attendance.overtime"))}</td>
      <td class="balance-positive"><strong>${escapeHtml(formatDuration(employeeData.payableOvertimeMinutes))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("payment.overtimeRate"))}</td>
      <td><strong>${escapeHtml(formatMoneyValue(employeeData.overtimeHourlyRate))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("payment.overtimeValue"))}</td>
      <td class="balance-positive"><strong>${escapeHtml(formatMoneyValue(employeeData.overtimeValue))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("payment.mealVoucherDailyValue"))}</td>
      <td><strong>${escapeHtml(formatMoneyValue(employeeData.mealVoucherDailyValue))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("payment.mealVoucherDays"))}</td>
      <td><strong>${escapeHtml(String(employeeData.mealVoucherDays))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("payment.mealVoucherValue"))}</td>
      <td><strong>${escapeHtml(formatMoneyValue(employeeData.mealVoucherValue))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("payment.totalPayment"))}</td>
      <td><strong>${escapeHtml(formatMoneyValue(employeeData.paymentTotal))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("attendance.missing"))}</td>
      <td class="balance-negative"><strong>${escapeHtml(formatDuration(employeeData.missingMinutes))}</strong></td>
    </tr>

    <tr>
      <td>${escapeHtml(t("attendance.balance"))}</td>
      <td class="${getBalanceClass(employeeData.balanceMinutes)}">
        <strong>${escapeHtml(formatSignedDuration(employeeData.balanceMinutes))}</strong>
      </td>
    </tr>

    <tr>
      <td>${escapeHtml(t("profile.openDays"))}</td>
      <td><strong>${escapeHtml(String(employeeData.openDays))}</strong></td>
    </tr>
  `;

  const dailyRowsHtml = employeeData.dailyRows.length === 0
    ? `
      <tr>
        <td colspan="10" class="empty-row">${escapeHtml(t("print.employeeNoData"))}</td>
      </tr>
    `
    : employeeData.dailyRows
        .map((summary) => {
          const balanceClass = getBalanceClass(summary.balanceMinutes);

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
              <td class="${balanceClass}">
                <strong>${escapeHtml(formatSignedDuration(summary.balanceMinutes))}</strong>
              </td>
              <td>${escapeHtml(summary.statusText)}</td>
            </tr>
          `;
        })
        .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(t("print.employeeAttendanceTitle"))}</title>

      <style>
        body {
          margin: 0;
          padding: 18px;
          font-family: Arial, sans-serif;
          color: #111827;
          background: white;
          font-size: 12px;
        }

        h1 {
          margin: 0 0 8px;
          text-align: center;
          font-size: 22px;
        }

        h2 {
          margin: 22px 0 8px;
          font-size: 16px;
        }

        .print-header {
          border: 1.5px solid #6b7280;
          padding: 10px;
          margin-bottom: 16px;
        }

        .print-header-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 5px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        th,
        td {
          border: 1.5px solid #6b7280;
          padding: 6px;
          text-align: left;
          vertical-align: top;
        }

        th {
          background: #e5e7eb;
          font-weight: bold;
        }

        .empty-row {
          text-align: center;
          color: #6b7280;
        }

        .small-text {
          color: #374151;
          font-size: 11px;
        }

        .balance-positive {
          color: #166534;
        }

        .balance-negative {
          color: #991b1b;
        }

        .balance-neutral {
          color: #374151;
        }

        @page {
          size: A4 portrait;
          margin: 10mm;
        }
      </style>
    </head>

    <body>
      <h1>${escapeHtml(t("print.employeeAttendanceTitle"))}</h1>

      <div class="print-header">
        <div class="print-header-row">
          <div>
            <strong>${escapeHtml(t("print.company"))}:</strong>
            ${escapeHtml(appSettings.companyName || "Centru de sticla")}
          </div>

          <div>
            <strong>${escapeHtml(t("print.employeePeriod"))}:</strong>
            ${escapeHtml(formatDisplayDate(employeeData.monthStartKey))}
            -
            ${escapeHtml(formatDisplayDate(employeeData.monthEndKey))}
          </div>
        </div>

        <div class="print-header-row">
          <div>
            <strong>${escapeHtml(t("attendance.employee"))}:</strong>
            ${escapeHtml(employee.name)}
          </div>

          <div>
            <strong>${escapeHtml(t("attendance.code"))}:</strong>
            ${escapeHtml(employee.id)}
          </div>
        </div>

        <div class="print-header-row">
          <div>
            <strong>${escapeHtml(t("attendance.department"))}:</strong>
            ${escapeHtml(employee.department || "-")}
          </div>

          <div>
            <strong>${escapeHtml(t("employee.status"))}:</strong>
            ${escapeHtml(employee.active ? t("employee.active") : t("employee.inactive"))}
          </div>
        </div>

        <div class="print-header-row small-text">
          <div>
            <strong>${escapeHtml(t("print.generatedAt"))}:</strong>
            ${escapeHtml(formatDisplayDate(getDateKey(new Date())))} ${escapeHtml(formatTimeFromIso(new Date().toISOString()))}
          </div>
        </div>
      </div>

      <h2>${escapeHtml(t("print.employeeSummary"))}</h2>

      <table>
        <tbody>
          ${summaryRowsHtml}
        </tbody>
      </table>

      <h2>${escapeHtml(t("print.employeeDailyBreakdown"))}</h2>

      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("attendance.date"))}</th>
            <th>${escapeHtml(t("attendance.firstArrival"))}</th>
            <th>${escapeHtml(t("attendance.lastDeparture"))}</th>
            <th>${escapeHtml(t("attendance.rawWorked"))}</th>
            <th>${escapeHtml(t("attendance.lunchDeduction"))}</th>
            <th>${escapeHtml(t("attendance.netWorked"))}</th>
            <th>${escapeHtml(t("attendance.overtime"))}</th>
            <th>${escapeHtml(t("attendance.missing"))}</th>
            <th>${escapeHtml(t("attendance.balance"))}</th>
            <th>${escapeHtml(t("attendance.dayStatus"))}</th>
          </tr>
        </thead>

        <tbody>
          ${dailyRowsHtml}
        </tbody>
      </table>

      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
          }, 500);
        };
      <\/script>
    </body>
    </html>
  `);

  removeHiddenOvertimeFromPrintDocument(printWindow.document);
  printWindow.document.close();
}

function getEmployeeMonthlyReportData(employeeId, monthKey) {
  const employee = employees.find((item) => item.id === employeeId);
  const safeMonthKey = monthKey || getMonthKey(new Date());
  const monthRange = getMonthRangeFromDateKey(`${safeMonthKey}-01`);
  const monthDateKeys = getDateKeysBetween(monthRange.startKey, monthRange.endKey);

  const dailyRows = [];

  monthDateKeys.forEach((dateKey) => {
    const eventsForDay = attendanceEvents
      .filter((event) => event.employeeId === employeeId && event.dateKey === dateKey)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (eventsForDay.length === 0) {
      return;
    }

    const firstEvent = eventsForDay[0];

    const dailySummary = calculateDailySummary({
      employeeId,
      employeeName: employee ? employee.name : firstEvent.employeeName || "-",
      department: employee ? employee.department || "-" : firstEvent.department || "-",
      dateKey
    });

    dailyRows.push(dailySummary);
  });

  const rawWorkedMinutes = dailyRows.reduce((sum, item) => sum + item.rawWorkedMinutes, 0);
  const lunchDeductionMinutes = dailyRows.reduce((sum, item) => sum + item.lunchDeductionMinutes, 0);
  const netWorkedMinutes = dailyRows.reduce((sum, item) => sum + item.netWorkedMinutes, 0);
  const overtimeMinutes = dailyRows.reduce((sum, item) => sum + item.overtimeMinutes, 0);
  const openDays = dailyRows.filter((item) => item.isOpen).length;
  const workDays = dailyRows.length;
  const balanceMinutes = dailyRows.reduce((sum, item) => sum + item.balanceMinutes, 0);
  const missingMinutes = Math.max(0, -balanceMinutes);

  const paymentValues = calculateEmployeePaymentValues({
    dailyRows,
    balanceMinutes
  });

  return {
    employeeId,
    monthKey: safeMonthKey,
    monthStartKey: monthRange.startKey,
    monthEndKey: monthRange.endKey,
    dailyRows,
    workDays,
    openDays,
    rawWorkedMinutes,
    lunchDeductionMinutes,
    netWorkedMinutes,
    overtimeMinutes,
    missingMinutes,
    balanceMinutes,
    ...paymentValues
  };
}

function exportEmployeeXlsx() {
  try {
    const employeeSelect = document.getElementById("profileEmployeeSelect");
    const monthInput = document.getElementById("profileMonthInput");

    if (!employeeSelect || !monthInput) {
      return;
    }

    const employeeId = employeeSelect.value;
    const monthKey = monthInput.value || getMonthKey(new Date());
    const employee = employees.find((item) => item.id === employeeId);

    if (!employee) {
      alert(t("profile.selectEmployee"));
      return;
    }

    const employeeData = getEmployeeMonthlyReportData(employee.id, monthKey);

    const rows = [];

    rows.push([t("print.employeeAttendanceTitle")]);
    rows.push([t("print.company"), appSettings.companyName || "Centru de sticla"]);
    rows.push([
      t("print.employeePeriod"),
      `${formatDisplayDate(employeeData.monthStartKey)} - ${formatDisplayDate(employeeData.monthEndKey)}`
    ]);
    rows.push([t("attendance.employee"), employee.name]);
    rows.push([t("attendance.code"), employee.id]);
    rows.push([t("attendance.department"), employee.department || "-"]);
    rows.push([t("employee.status"), employee.active ? t("employee.active") : t("employee.inactive")]);
    rows.push([
      t("print.generatedAt"),
      `${formatDisplayDate(getDateKey(new Date()))} ${formatTimeFromIso(new Date().toISOString())}`
    ]);
    rows.push([]);

    rows.push([t("print.employeeSummary")]);
    rows.push([t("profile.workDays"), String(employeeData.workDays)]);
    rows.push([t("attendance.rawWorked"), formatDuration(employeeData.rawWorkedMinutes)]);
    rows.push([t("attendance.lunchDeduction"), formatDuration(employeeData.lunchDeductionMinutes)]);
    rows.push([t("attendance.netWorked"), formatDuration(employeeData.netWorkedMinutes)]);
    rows.push([t("attendance.overtime"), formatDuration(employeeData.payableOvertimeMinutes)]);
    rows.push([t("payment.overtimeRate"), formatMoneyValue(employeeData.overtimeHourlyRate)]);
    rows.push([t("payment.overtimeValue"), formatMoneyValue(employeeData.overtimeValue)]);
    rows.push([t("payment.mealVoucherDailyValue"), formatMoneyValue(employeeData.mealVoucherDailyValue)]);
    rows.push([t("payment.mealVoucherDays"), String(employeeData.mealVoucherDays)]);
    rows.push([t("payment.mealVoucherValue"), formatMoneyValue(employeeData.mealVoucherValue)]);
    rows.push([t("payment.totalPayment"), formatMoneyValue(employeeData.paymentTotal)]);
    rows.push([t("attendance.missing"), formatDuration(employeeData.missingMinutes)]);
    rows.push([t("attendance.balance"), formatSignedDuration(employeeData.balanceMinutes)]);
    rows.push([t("profile.openDays"), String(employeeData.openDays)]);
    rows.push([]);

    rows.push([t("print.employeeDailyBreakdown")]);
    rows.push([
      t("attendance.date"),
      t("attendance.firstArrival"),
      t("attendance.lastDeparture"),
      t("attendance.rawWorked"),
      t("attendance.lunchDeduction"),
      t("attendance.netWorked"),
      t("attendance.overtime"),
      t("attendance.missing"),
      t("attendance.balance"),
      t("attendance.dayStatus")
    ]);

    if (employeeData.dailyRows.length === 0) {
      rows.push([t("print.employeeNoData")]);
    } else {
      employeeData.dailyRows.forEach((summary) => {
        rows.push([
          formatDisplayDate(summary.dateKey),
          summary.firstArrival || "-",
          summary.lastDeparture || "-",
          formatDuration(summary.rawWorkedMinutes),
          formatDuration(summary.lunchDeductionMinutes),
          formatDuration(summary.netWorkedMinutes),
          formatDuration(summary.overtimeMinutes),
          formatDuration(summary.missingMinutes),
          formatSignedDuration(summary.balanceMinutes),
          summary.statusText
        ]);
      });
    }

    const safeEmployeeName = String(employee.name || employee.id)
      .replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 40);

    const fileName = `jelenleti-szemely-${employee.id}-${safeEmployeeName}-${monthKey}.xlsx`;
    const xlsxBlob = createSimpleXlsxBlob(rows, t("print.employeeAttendanceTitle"));

    downloadBlobFile(xlsxBlob, fileName);
    alert(t("export.xlsxSaved"));
  } catch (error) {
    console.error("Személy XLSX export hiba:", error);
    alert(t("export.xlsxError"));
  }
}

function exportJsonBackup() {
  try {
    const backupData = {
      appName: "Jelenléti PWA",
      appKey: "jelenleti-pwa",
      version: "2.1",
      exportedAt: new Date().toISOString(),
      settings: appSettings,
      employees: employees,
      attendanceEvents: attendanceEvents,
      absences: Array.isArray(absenceRecords) ? absenceRecords : [],
      vacationAllowances: Array.isArray(vacationAllowances) ? vacationAllowances : []
    };

    const jsonText = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonText], {
      type: "application/json;charset=utf-8"
    });

    const fileName = `jelenleti-pwa-mentes-${getBackupDateString()}.json`;
    const downloadUrl = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(downloadUrl);

    showExportStatus(t("export.saved"), "success");
  } catch (error) {
    console.error("JSON export hiba:", error);
    showExportStatus(t("export.importError"), "error");
  }
}

function importJsonBackup(file) {
  if (!file) {
    showExportStatus(t("export.importNoFile"), "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    try {
      const parsedData = JSON.parse(event.target.result);

      if (!isValidBackupData(parsedData)) {
        showExportStatus(t("export.importInvalid"), "error");
        return;
      }

      const confirmed = confirm(t("export.importConfirm"));

      if (!confirmed) {
        return;
      }

      appSettings = {
        ...DEFAULT_SETTINGS,
        ...parsedData.settings
      };

      employees = Array.isArray(parsedData.employees)
        ? parsedData.employees
        : [];

      attendanceEvents = Array.isArray(parsedData.attendanceEvents)
        ? parsedData.attendanceEvents
        : [];

      absenceRecords = Array.isArray(parsedData.absences)
        ? parsedData.absences
        : [];

      vacationAllowances = Array.isArray(parsedData.vacationAllowances)
        ? parsedData.vacationAllowances
        : [];

      saveSettings(appSettings);
      saveEmployees(employees);
      saveAttendanceEvents(attendanceEvents);
      saveAbsences(absenceRecords);
      saveVacationAllowances(vacationAllowances);

      refreshAppAfterImport();

      showExportStatus(t("export.importSuccess"), "success");
    } catch (error) {
      console.error("JSON import hiba:", error);
      showExportStatus(t("export.importError"), "error");
    }
  };

  reader.onerror = function () {
    showExportStatus(t("export.importError"), "error");
  };

  reader.readAsText(file, "UTF-8");
}

function restoreAutoBackupData() {
  try {
    if (typeof loadAutoBackup !== "function") {
      showExportStatus(t("backup.restoreMissing"), "error");
      return;
    }

    const autoBackup = loadAutoBackup();

    if (!autoBackup) {
      showExportStatus(t("backup.restoreMissing"), "error");
      return;
    }

    if (!Array.isArray(autoBackup.employees) || !Array.isArray(autoBackup.attendanceEvents)) {
      showExportStatus(t("backup.restoreInvalid"), "error");
      return;
    }

    const confirmed = confirm(t("backup.restoreConfirm"));

    if (!confirmed) {
      return;
    }

    appSettings = {
      ...DEFAULT_SETTINGS,
      ...autoBackup.settings
    };

    employees = Array.isArray(autoBackup.employees)
      ? autoBackup.employees
      : [];

    attendanceEvents = Array.isArray(autoBackup.attendanceEvents)
      ? autoBackup.attendanceEvents
      : [];

    absenceRecords = Array.isArray(autoBackup.absences)
      ? autoBackup.absences
      : [];

    vacationAllowances = Array.isArray(autoBackup.vacationAllowances)
      ? autoBackup.vacationAllowances
      : [];

    saveSettings(appSettings);
    saveEmployees(employees);
    saveAttendanceEvents(attendanceEvents);
    saveAbsences(absenceRecords);
    saveVacationAllowances(vacationAllowances);

    refreshAppAfterImport();

    showExportStatus(t("backup.restoreSuccess"), "success");
  } catch (error) {
    console.error("Automatikus mentés visszaállítási hiba:", error);
    showExportStatus(t("backup.restoreError"), "error");
  }
}

function isValidBackupData(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (data.appKey !== "jelenleti-pwa") {
    return false;
  }

  if (!Array.isArray(data.employees)) {
    return false;
  }

  if (!Array.isArray(data.attendanceEvents)) {
    return false;
  }

  return true;
}

function refreshAppAfterImport() {
  applyLanguage(appSettings.language);
  fillSettingsFields();

  renderEmployeesTable();
  renderEmployeeCards();
  renderInsideList();
  renderAttendanceList();

  if (typeof renderEmployeeProfileEmployeeOptions === "function") {
    renderEmployeeProfileEmployeeOptions();
  }

  if (typeof renderEmployeeProfile === "function") {
    renderEmployeeProfile();
  }

  if (typeof renderStatisticsPage === "function") {
    renderStatisticsPage();
  }

  if (typeof fillAbsenceEmployeeOptions === "function") {
    fillAbsenceEmployeeOptions();
  }

  if (typeof renderMonthlyAccountingPage === "function") {
    renderMonthlyAccountingPage();
  }

  if (typeof fillVacationEmployeeOptions === "function") {
    fillVacationEmployeeOptions();
  }

  if (typeof renderVacationTrackerPage === "function") {
    renderVacationTrackerPage();
  }

  if (typeof renderExportPage === "function") {
    renderExportPage();
  }
}

function showExportStatus(message, type = "info") {
  const statusBox = document.getElementById("exportStatus");

  if (!statusBox) {
    return;
  }

  statusBox.textContent = message;
  statusBox.className = `export-status export-status-${type}`;
}

function getBackupDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}-${hours}-${minutes}`;
}



