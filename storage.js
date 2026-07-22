const STORAGE_KEYS = {
  settings: "jelenletiPwaSettings",
  employees: "jelenletiPwaEmployees",
  attendanceEvents: "jelenletiPwaAttendanceEvents",
  absences: "jelenletiPwaAbsences",
  vacationAllowances: "jelenletiPwaVacationAllowances",
  autoBackup: "jelenletiPwaAutoBackup"
};

const DEFAULT_SETTINGS = {
  language: "hu",
  companyName: "Centru de sticla",
  dailyNormMinutes: 480,
  lunchBreakMinutes: 30,
  companyDays: [],
  showOvertimeData: true,
  overtimeHourlyRate: 0,
  mealVoucherDailyValue: 0,
  storageMode: "supabase"
};

let supabaseDb = null;
let cachedEmployeeRows = new Map();
let cachedAttendanceRows = new Map();
let cachedAbsenceRows = new Map();
let cachedVacationAllowanceRows = new Map();

async function initializeStorage() {
  supabaseDb = createSupabaseClient();

  appSettings = await loadSettingsAsync();
  employees = await loadEmployeesAsync();
  attendanceEvents = await loadAttendanceEventsAsync();
  absenceRecords = await loadAbsencesAsync();
  vacationAllowances = await loadVacationAllowancesAsync();

  createAutoBackup("storage-init");
}

function createSupabaseClient() {
  if (!window.supabase || !window.SUPABASE_CONFIG) {
    console.warn("Supabase kliens nem elérhető, localStorage tartalék mód aktív.");
    return null;
  }

  return window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
}

function loadSettings() {
  return loadLocalStorageValue(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}

async function loadSettingsAsync() {
  const localSettings = loadSettings();

  if (!supabaseDb) {
    return localSettings;
  }

  try {
    const { data, error } = await supabaseDb
      .from("app_settings")
      .select("settings")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data && data.settings) {
      const settings = {
        ...DEFAULT_SETTINGS,
        ...data.settings,
        storageMode: "supabase"
      };

      saveLocalStorageValue(STORAGE_KEYS.settings, settings);
      return settings;
    }

    const initialSettings = {
      ...DEFAULT_SETTINGS,
      ...localSettings,
      storageMode: "supabase"
    };

    await saveSettingsToSupabase(initialSettings);
    return initialSettings;
  } catch (error) {
    console.error("Supabase beállítás betöltési hiba:", error);
    return localSettings;
  }
}

function saveSettings(settings) {
  const normalizedSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    storageMode: "supabase"
  };

  saveLocalStorageValue(STORAGE_KEYS.settings, normalizedSettings);
  runSupabaseSave(saveSettingsToSupabase(normalizedSettings), "Beállítás mentési hiba");
  createAutoBackup("settings-save");
}

async function saveSettingsToSupabase(settings) {
  if (!supabaseDb) {
    return;
  }

  const { error } = await supabaseDb
    .from("app_settings")
    .upsert({
      id: "default",
      settings,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

function loadEmployees() {
  return loadLocalStorageValue(STORAGE_KEYS.employees, []);
}

async function loadEmployeesAsync() {
  const localEmployees = loadEmployees();

  if (!supabaseDb) {
    return localEmployees;
  }

  try {
    const { data, error } = await supabaseDb
      .from("employees")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      const remoteEmployees = data.map(mapEmployeeFromRow);
      cacheEmployeeRows(remoteEmployees.map(mapEmployeeToRow));
      saveLocalStorageValue(STORAGE_KEYS.employees, remoteEmployees);
      return remoteEmployees;
    }

    if (localEmployees.length > 0) {
      await syncEmployeesToSupabase(localEmployees);
    } else {
      cacheEmployeeRows([]);
    }

    return localEmployees;
  } catch (error) {
    console.error("Supabase dolgozó betöltési hiba:", error);
    return localEmployees;
  }
}

function saveEmployees(nextEmployees) {
  saveLocalStorageValue(STORAGE_KEYS.employees, nextEmployees);
  runSupabaseSave(syncEmployeesToSupabase(nextEmployees), "Dolgozó mentési hiba");
  createAutoBackup("employees-save");
}

async function syncEmployeesToSupabase(nextEmployees) {
  if (!supabaseDb) {
    return;
  }

  const nextRows = nextEmployees.map(mapEmployeeToRow);
  const nextIds = new Set(nextEmployees.map((employee) => employee.id));
  const idsToDelete = [...cachedEmployeeRows.keys()]
    .filter((id) => !nextIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseDb
      .from("employees")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (nextEmployees.length === 0) {
    cacheEmployeeRows([]);
    return;
  }

  const changedRows = nextRows.filter((row) => {
    return cachedEmployeeRows.get(row.id) !== JSON.stringify(row);
  });

  if (changedRows.length > 0) {
    const { error: upsertError } = await supabaseDb
      .from("employees")
      .upsert(changedRows, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  cacheEmployeeRows(nextRows);
}

function loadAttendanceEvents() {
  return loadLocalStorageValue(STORAGE_KEYS.attendanceEvents, []);
}

async function loadAttendanceEventsAsync() {
  const localEvents = loadAttendanceEvents();

  if (!supabaseDb) {
    return localEvents;
  }

  try {
    const { data, error } = await supabaseDb
      .from("attendance_events")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      const remoteEvents = data.map(mapAttendanceEventFromRow);
      cacheAttendanceRows(remoteEvents.map(mapAttendanceEventToRow));
      saveLocalStorageValue(STORAGE_KEYS.attendanceEvents, remoteEvents);
      return remoteEvents;
    }

    if (localEvents.length > 0) {
      await syncAttendanceEventsToSupabase(localEvents);
    } else {
      cacheAttendanceRows([]);
    }

    return localEvents;
  } catch (error) {
    console.error("Supabase jelenléti esemény betöltési hiba:", error);
    return localEvents;
  }
}

function saveAttendanceEvents(nextEvents) {
  saveLocalStorageValue(STORAGE_KEYS.attendanceEvents, nextEvents);
  runSupabaseSave(syncAttendanceEventsToSupabase(nextEvents), "Jelenléti esemény mentési hiba");
  createAutoBackup("attendance-save");
}

async function saveAttendanceEventsAndWait(nextEvents) {
  if (!supabaseDb) {
    throw new Error("A Supabase kapcsolat nem érhető el.");
  }

  await syncAttendanceEventsToSupabase(nextEvents);
  saveLocalStorageValue(STORAGE_KEYS.attendanceEvents, nextEvents);
  createAutoBackup("attendance-save");
}

async function syncAttendanceEventsToSupabase(nextEvents) {
  if (!supabaseDb) {
    return;
  }

  const nextRows = nextEvents.map(mapAttendanceEventToRow);
  const nextIds = new Set(nextEvents.map((event) => event.id));
  const idsToDelete = [...cachedAttendanceRows.keys()]
    .filter((id) => !nextIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseDb
      .from("attendance_events")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (nextEvents.length === 0) {
    cacheAttendanceRows([]);
    return;
  }

  const changedRows = nextRows.filter((row) => {
    return cachedAttendanceRows.get(row.id) !== JSON.stringify(row);
  });

  if (changedRows.length > 0) {
    const { error: upsertError } = await supabaseDb
      .from("attendance_events")
      .upsert(changedRows, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  cacheAttendanceRows(nextRows);
}

function cacheEmployeeRows(rows) {
  cachedEmployeeRows = new Map(rows.map((row) => [row.id, JSON.stringify(row)]));
}

function cacheAttendanceRows(rows) {
  cachedAttendanceRows = new Map(rows.map((row) => [row.id, JSON.stringify(row)]));
}

function cacheAbsenceRows(rows) {
  cachedAbsenceRows = new Map(rows.map((row) => [row.id, JSON.stringify(row)]));
}

function loadAbsences() {
  return loadLocalStorageValue(STORAGE_KEYS.absences, []);
}

async function loadAbsencesAsync() {
  const localAbsences = loadAbsences();

  if (!supabaseDb) {
    return localAbsences;
  }

  try {
    const { data, error } = await supabaseDb
      .from("absences")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) {
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      const remoteAbsences = data.map(mapAbsenceFromRow);
      cacheAbsenceRows(remoteAbsences.map(mapAbsenceToRow));
      saveLocalStorageValue(STORAGE_KEYS.absences, remoteAbsences);
      return remoteAbsences;
    }

    if (localAbsences.length > 0) {
      await syncAbsencesToSupabase(localAbsences);
    } else {
      cacheAbsenceRows([]);
    }

    return localAbsences;
  } catch (error) {
    console.error("Supabase absence load error:", error);
    return localAbsences;
  }
}

function saveAbsences(nextAbsences) {
  saveLocalStorageValue(STORAGE_KEYS.absences, nextAbsences);
  runSupabaseSave(syncAbsencesToSupabase(nextAbsences), "absence save error");
  createAutoBackup("absences-save");
}

async function syncAbsencesToSupabase(nextAbsences) {
  if (!supabaseDb) {
    return;
  }

  const nextRows = nextAbsences.map(mapAbsenceToRow);
  const nextIds = new Set(nextAbsences.map((absence) => absence.id));
  const idsToDelete = [...cachedAbsenceRows.keys()]
    .filter((id) => !nextIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseDb
      .from("absences")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (nextAbsences.length === 0) {
    cacheAbsenceRows([]);
    return;
  }

  const changedRows = nextRows.filter((row) => {
    return cachedAbsenceRows.get(row.id) !== JSON.stringify(row);
  });

  if (changedRows.length > 0) {
    const { error: upsertError } = await supabaseDb
      .from("absences")
      .upsert(changedRows, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  cacheAbsenceRows(nextRows);
}

function mapEmployeeToRow(employee) {
  return {
    id: employee.id,
    name: employee.name,
    department: employee.department || "",
    active: employee.active !== false,
    lunch_break_enabled: employee.lunchBreakEnabled !== false,
    note: employee.note || "",
    created_at: employee.createdAt || new Date().toISOString(),
    updated_at: employee.updatedAt || new Date().toISOString()
  };
}

function mapEmployeeFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    department: row.department || "",
    active: row.active !== false,
    lunchBreakEnabled: row.lunch_break_enabled !== false,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAttendanceEventToRow(event) {
  const createdAt = event.createdAt || new Date().toISOString();

  return {
    id: event.id,
    employee_id: event.employeeId,
    employee_name: event.employeeName || "",
    department: event.department || "",
    type: event.type,
    date_key: event.dateKey || createdAt.slice(0, 10),
    time_value: event.timeValue || createdAt.slice(11, 16),
    created_at: createdAt,
    source: event.source || "manual",
    note: event.note || ""
  };
}

function mapAttendanceEventFromRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || "",
    department: row.department || "",
    type: row.type,
    dateKey: row.date_key,
    timeValue: row.time_value,
    createdAt: row.created_at,
    source: row.source || "manual",
    note: row.note || ""
  };
}

function mapAbsenceToRow(absence) {
  const createdAt = absence.createdAt || new Date().toISOString();

  return {
    id: absence.id,
    employee_id: absence.employeeId,
    employee_name: absence.employeeName || "",
    department: absence.department || "",
    start_date: absence.startDate,
    end_date: absence.endDate,
    type: absence.type || "other",
    note: absence.note || "",
    created_at: createdAt,
    updated_at: absence.updatedAt || new Date().toISOString()
  };
}

function mapAbsenceFromRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || "",
    department: row.department || "",
    startDate: row.start_date,
    endDate: row.end_date,
    type: row.type || "other",
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cacheVacationAllowanceRows(rows) {
  cachedVacationAllowanceRows = new Map(rows.map((row) => [
    `${row.employee_id}:${row.year}`,
    JSON.stringify(row)
  ]));
}

function loadVacationAllowances() {
  return loadLocalStorageValue(STORAGE_KEYS.vacationAllowances, []);
}

async function loadVacationAllowancesAsync() {
  const localAllowances = loadVacationAllowances();

  if (!supabaseDb) {
    return localAllowances;
  }

  try {
    const { data, error } = await supabaseDb
      .from("vacation_allowances")
      .select("*")
      .order("year", { ascending: false });

    if (error) {
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      const remoteAllowances = data.map(mapVacationAllowanceFromRow);
      cacheVacationAllowanceRows(remoteAllowances.map(mapVacationAllowanceToRow));
      saveLocalStorageValue(STORAGE_KEYS.vacationAllowances, remoteAllowances);
      return remoteAllowances;
    }

    if (localAllowances.length > 0) {
      await syncVacationAllowancesToSupabase(localAllowances);
    } else {
      cacheVacationAllowanceRows([]);
    }

    return localAllowances;
  } catch (error) {
    console.error("Supabase szabadságkeret betöltési hiba:", error);
    return localAllowances;
  }
}

function saveVacationAllowances(nextAllowances) {
  saveLocalStorageValue(STORAGE_KEYS.vacationAllowances, nextAllowances);
  runSupabaseSave(
    syncVacationAllowancesToSupabase(nextAllowances),
    "Szabadságkeret mentési hiba"
  );
  createAutoBackup("vacation-allowances-save");
}

async function syncVacationAllowancesToSupabase(nextAllowances) {
  if (!supabaseDb) {
    return;
  }

  const nextRows = nextAllowances.map(mapVacationAllowanceToRow);
  const nextKeys = new Set(nextRows.map((row) => `${row.employee_id}:${row.year}`));
  const keysToDelete = [...cachedVacationAllowanceRows.keys()]
    .filter((key) => !nextKeys.has(key));

  for (const key of keysToDelete) {
    const [employeeId, year] = key.split(":");
    const { error: deleteError } = await supabaseDb
      .from("vacation_allowances")
      .delete()
      .eq("employee_id", employeeId)
      .eq("year", Number(year));

    if (deleteError) {
      throw deleteError;
    }
  }

  if (nextRows.length === 0) {
    cacheVacationAllowanceRows([]);
    return;
  }

  const changedRows = nextRows.filter((row) => {
    const key = `${row.employee_id}:${row.year}`;
    return cachedVacationAllowanceRows.get(key) !== JSON.stringify(row);
  });

  if (changedRows.length > 0) {
    const { error: upsertError } = await supabaseDb
      .from("vacation_allowances")
      .upsert(changedRows, { onConflict: "employee_id,year" });

    if (upsertError) {
      throw upsertError;
    }
  }

  cacheVacationAllowanceRows(nextRows);
}

function mapVacationAllowanceToRow(allowance) {
  return {
    employee_id: allowance.employeeId,
    year: Number(allowance.year),
    entitled_days: Number(allowance.entitledDays) || 0,
    carried_over_days: Number(allowance.carriedOverDays) || 0,
    updated_at: allowance.updatedAt || new Date().toISOString()
  };
}

function mapVacationAllowanceFromRow(row) {
  return {
    employeeId: row.employee_id,
    year: Number(row.year),
    entitledDays: Number(row.entitled_days) || 0,
    carriedOverDays: Number(row.carried_over_days) || 0,
    updatedAt: row.updated_at
  };
}

function loadLocalStorageValue(key, fallbackValue) {
  const savedValue = localStorage.getItem(key);

  if (!savedValue) {
    saveLocalStorageValue(key, fallbackValue);
    return Array.isArray(fallbackValue) ? [...fallbackValue] : { ...fallbackValue };
  }

  try {
    return JSON.parse(savedValue);
  } catch (error) {
    console.error("LocalStorage olvasási hiba:", error);
    return Array.isArray(fallbackValue) ? [...fallbackValue] : { ...fallbackValue };
  }
}

function saveLocalStorageValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeParseStorageValue(key, fallbackValue) {
  const savedValue = localStorage.getItem(key);

  if (!savedValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(savedValue);
  } catch (error) {
    console.error("Automatikus mentés olvasási hiba:", error);
    return fallbackValue;
  }
}

function runSupabaseSave(savePromise, contextMessage) {
  Promise.resolve(savePromise).catch((error) => {
    console.error(`Supabase ${contextMessage}:`, error);
  });
}

function createAutoBackup(reason = "auto") {
  try {
    const backupData = {
      app: "Jelenleti PWA",
      version: "2.0-supabase",
      reason: reason,
      backupCreatedAt: new Date().toISOString(),
      settings: safeParseStorageValue(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
      employees: safeParseStorageValue(STORAGE_KEYS.employees, []),
      attendanceEvents: safeParseStorageValue(STORAGE_KEYS.attendanceEvents, []),
      absences: safeParseStorageValue(STORAGE_KEYS.absences, []),
      vacationAllowances: safeParseStorageValue(STORAGE_KEYS.vacationAllowances, [])
    };

    localStorage.setItem(STORAGE_KEYS.autoBackup, JSON.stringify(backupData));
  } catch (error) {
    console.error("Automatikus biztonsági mentés hiba:", error);
  }
}

function loadAutoBackup() {
  return safeParseStorageValue(STORAGE_KEYS.autoBackup, null);
}
