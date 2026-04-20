import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';

// --- KONFIGURASI FOLDER ---
const DB_FOLDER = './database/';
const STATS_FILENAME = 'statistik.parquet';

// --- KONFIGURASI SCANNING OTOMATIS ---
// Script akan mengecek ketersediaan file dari tahun ini + 1 mundur sampai tahun min_year
const MIN_SCAN_YEAR = 2019;
const MAX_SCAN_YEAR = new Date().getFullYear();

let currentDbUrl = '';
const statsDbUrl = DB_FOLDER + STATS_FILENAME;

// Mapping Kode Pelabuhan
const portCodes = {
  "Surabaya": "IDSUB", "Banjarmasin": "IDBDJ", "Balikpapan": "IDBPN", "Kumai": "IDKUM",
  "Sampit": "IDSMQ", "Makassar": "IDMAK", "Lembar": "IDLBR", "Labuan Bajo": "IDLBO",
  "Maumere": "IDMOF", "Ende": "IDENE", "Kupang": "IDKOE", "Waingapu": "IDWGP",
  "Semarang": "IDSRG", "Ketapang Kalbar": "IDKTG", "Parepare": "IDPAP",
  "Baubau": "IDBAU", "Batulicin": "IDKBU", "Donggala": "IDDGL",
  "Pontianak": "IDPNK", "Selayar": "IDSLR", "Palembang": "IDPLM", "Jakarta": "IDJKT",
  "Pangkal Balam": "IDPGX", "Tanjung Pandan": "IDTJQ", "Sunda Kelapa": "IDSKL",
  "Marunda": "IDMRA", "CALANG"	: "IDCLG", "KUALA LANGSA"	: "IDKUA", "LHOKSEUMAWE"	: "IDLSW", "MALAHAYATI"	: "IDMLH", "MEULABOH"	: "IDMEQ", "SABANG"	: "IDSBG", "SINABANG"	: "IDSNG", "Singkil"	: "IDSNL", "SUSOH, SUMATRA"	: "IDSUS", "TAPAKTUAN, SUMATRA"	: "IDTPK", "BENOA"	: "IDBOA", "CELUKAN BAWANG"	: "IDCEB", "GILIMANUK, BALI"	: "IDGIL", "Nusa Penida (Mentigi)"	: "IDNPE", "PADANG BAI"	: "IDPBI", "BANTEN"	: "IDBTN", "Karangantu"	: "IDKNU", "LABUHAN"	: "IDLAJ", "BENGKULU"	: "IDBKS", "Bintuhan/Linau"	: "IDLBI", "Malakoni/P. Enggano"	: "IDMKI", "KEPULAUAN SERIBU"	: "IDKSB", "Marunda"	: "IDMRA", "Muara Angke"	: "IDMKA", "SUNDA KELAPA"	: "IDSKL", "TANJUNG PRIOK"	: "IDJKT", "ANGGREK"	: "IDAGK", "GORONTALO"	: "IDGTO", "Kwandang"	: "IDKWG", "Tilamuta"	: "IDTAA", "Kuala Mendahara"	: "IDKME", "KUALA TUNGKAL"	: "IDKTK", "MUARA SABAK"	: "IDMSK", "NIPAH PANJANG"	: "IDNIJ", "TALANG DUKUH"	: "IDDJB", "CIREBON"	: "IDCBN", "Indramayu"	: "IDIRU", "Pangandaran"	: "IDPAN", "PATIMBAN"	: "IDPMB", "Pelabuhan Ratu"	: "IDPRA", "BATANG"	: "IDBTG", "CILACAP"	: "IDCXP", "JEPARA"	: "IDJEP", "Juwana"	: "IDJWA", "Karimun Jawa"	: "IDKJA", "TANJUNG EMAS, SEMARANG"	: "IDSRG", "TEGAL"	: "IDTEG", "BANYUWANGI /TANJUNG WANGI"	: "IDBJU", "Bawean"	: "IDBWN", "BRANTA/SUMENEP"	: "IDSNP", "BRONDONG"	: "IDBNQ", "GRESIK"	: "IDGRE", "KALIANGET"	: "IDKAT", "KETAPANG"	: "IDKTG", "MASALEMBO"	: "IDMSI", "PANARUKAN"	: "IDPRN", "PROBOLINGGO"	: "IDPRO", "REMBANG"	: "IDREM", "Sapeken"	: "IDSPN", "Sapudi"	: "IDSPI", "TANJUNG PERAK"	: "IDSUB", "Telaga Biru"	: "IDTGU", "KENDAWANGAN"	: "IDKDW", "Padang tikar"	: "IDPTA", "Paloh/Sakura"	: "IDPAH", "PONTIANAK"	: "IDPNK", "Sintete"	: "IDSNE", "TELOK MELANO"	: "IDTMO", "BANJARMASIN"	: "IDBDJ", "KINTAP"	: "IDKNP", "KOTABARU - BATULICIN"	: "IDKBU", "SATUI"	: "IDSTU", "KUMAI"	: "IDKUM", "PANGKALAN BUN"	: "IDPKN", "PULANG PISAU/KUALA KAPUAS"	: "IDPPS", "Rangga Ilung"	: "IDRGG", "SAMPIT"	: "IDSMQ", "Sukamara"	: "IDSAA", "TELUK SIGINTUNG"	: "IDTTN", "BALIKPAPAN"	: "IDBPN", "BONTANG"	: "IDBXT", "Kuala Semboja"	: "IDKSA", "SAMARINDA"	: "IDSRI", "SANGATTA"	: "IDSGQ", "SANGKULIRANG, KALIMANTAN"	: "IDSKI", "TANA PASER"	: "IDTHR", "Tanjung Redep"	: "IDTRE", "TANJUNG SANTAN"	: "IDTSX", "BUNYU"	: "IDBYQ", "NUNUKAN"	: "IDNNX", "Sungai Nyamuk"	: "IDSNY", "TANJUNG SELOR"	: "IDTJS", "TARAKAN"	: "IDTRK", "MANGGAR"	: "IDMAN", "MUNTOK"	: "IDMUO", "PANGKAL BALAM, BANGKA"	: "IDPGX", "Sadai"	: "IDSDI", "SUNGAI SELAN"	: "IDSSL", "TANJUNG PANDAN"	: "IDTJQ", "BATAM"	: "IDBTM", "DABO, SINGKEP ISL"	: "IDDAS", "KIJANG"	: "IDKID", "Senayang"	: "IDSAG", "TANJUNG BALAI KARIMUN"	: "IDTJB", "TANJUNG PINANG"	: "IDTNJ", "TANJUNG UBAN"	: "IDTAN", "TAREMPA"	: "IDTMP", "BAKAUHENI"	: "IDBAI", "Kota Agung"	: "IDKAG", "Labuhan Maringgai"	: "IDLMA", "Manggala/Menggala"	: "IDMGA", "MESUJI"	: "IDMSJ", "PANJANG"	: "IDPNJ", "BADAS"	: "IDPBB", "BENETE"	: "IDBEN", "BIMA"	: "IDBMU", "CALABAI"	: "IDCLI", "Labuhan Lombok"	: "IDLLO", "LEMBAR"	: "IDLBR", "PEMENANG"	: "IDMEN", "SAPE"	: "IDSPE", "Atapupu"	: "IDAAU", "BAA"	: "IDBRO", "Baranusa"	: "IDBAA", "ENDE"	: "IDENE", "KALABAHI"	: "IDKBH", "KUPANG"	: "IDKOE", "LABUAN BAJO"	: "IDLBO", "LARANTUKA"	: "IDLKA", "LEWOLEBA"	: "IDLWE", "Marapokot"	: "IDMOT", "MAUMERE"	: "IDMOF", "REO"	: "IDREO", "Seba"	: "IDSEA", "Waikelo"	: "IDWIO", "WAINGAPU"	: "IDWGP", "Wini"	: "IDWII", "BAGAN SIAPI-API"	: "IDBII", "BENGKALIS"	: "IDBKI", "DUMAI"	: "IDDUM", "KUALA CINAKU"	: "IDRGT", "KUALA ENOK"	: "IDENO", "KUALA GAUNG"	: "IDKGQ", "Panipahan"	: "IDPIN", "PEKANBARU"	: "IDPKU", "SELAT PANJANG"	: "IDSPA", "SUNGAI GUNTUNG, SUMATRA"	: "IDSUQ", "TANJUNG BUTON"	: "IDBUT", "Tanjung Medang"	: "IDTMD", "TEMBILAHAN"	: "IDTLN", "Belang-Belang"	: "IDBBM", "MAJENE, SV"	: "IDMAJ", "MAMUJU"	: "IDMJU", "Tanjung Silopo/Polewali"	: "IDPEI", "Bajoe"	: "IDBAE", "Bulukumba/Lappe'e"	: "IDBBE", "GARONGKONG"	: "IDGNG", "Jeneponto/Bunging"	: "IDJEO", "Maccini Baji"	: "IDMII", "MAKASSAR"	: "IDMAK", "MALILI"	: "IDMLI", "PALOPO, SULAWESI"	: "IDPPO", "PARE-PARE"	: "IDPAP", "Pattirobajo"	: "IDPIO", "PULAU JAMPEA"	: "IDPJA", "SELAYAR"	: "IDSLR", "Sinjai/Larea-rea"	: "IDSLA", "Siwa/Bangsalae"	: "IDSWA", "AMPANA"	: "IDAPN", "BANGGAI"	: "IDBGG", "BUNGKU"	: "IDBNU", "BUNTA"	: "IDBUD", "KOLONODALE"	: "IDKNL", "Leok"	: "IDLEK", "LUWUK"	: "IDLUW", "Ogoamas"	: "IDOOS", "PAGIMANA"	: "IDPGM", "Parigi"	: "IDPRI", "POSO, SULAWESI"	: "IDPSJ", "TELUK PALU"	: "IDPTL", "TOLITOLI"	: "IDTLI", "BAU-BAU"	: "IDBAU", "KENDARI"	: "IDKDI", "KOLAKA"	: "IDKOL", "Lapuko"	: "IDLPO", "Molawe"	: "IDMLW", "POMALAA, SULAWESI"	: "IDPUM", "RAHA"	: "IDRAQ", "WANCI"	: "IDWCI", "AMURANG"	: "IDTZD", "BITUNG"	: "IDBIT", "Kotabunan"	: "IDKAN", "Labuhan Uki"	: "IDLUK", "Likupang"	: "IDLUG", "MANADO"	: "IDMDC", "Melonguane"	: "IDMGE", "TAHUNA"	: "IDTHA", "Ulu Siau"	: "IDUSI", "MUARA SIBERUT"	: "IDMSB", "SIKAKAP"	: "IDSIK", "SIUBAN"	: "IDSON", "TELUK BAYUR"	: "IDTBR", "PALEMBANG"	: "IDPLM", "Sungai Lumpur"	: "IDSLU", "Barus"	: "IDBRS", "Batahan"	: "IDBTX", "BELAWAN"	: "IDBLW", "GUNUNG SITOLI"	: "IDGNS", "KUALATANJUNG"	: "IDKTJ", "Lahewa"	: "IDLHA", "PANGKALAN SUSU"	: "IDPKS", "Pulau Tello"	: "IDPTE", "SIBOLGA"	: "IDSLG", "Sirombu"	: "IDSRU", "TANJUNG BALAI ASAHAN"	: "IDTSH", "Tanjung Beringin"	: "IDTBE", "Teluk Dalam"	: "IDTDA", "Teluk Leidong"	: "IDLIG", "Tg. Sarang Elang"	: "IDSEL"
};

const routeList = [
  "Balikpapan - Donggala", "Balikpapan - Parepare", "Balikpapan - Surabaya", "Banjarmasin - Surabaya", "Batulicin - Makassar",
  "Batulicin - Parepare", "Baubau - Makassar", "Baubau - Selayar", "Donggala - Balikpapan", "Ende - Kupang",
  "Jakarta - Palembang", "Jakarta - Tanjung Pandan", "Ketapang Kalbar - Semarang", "Kumai - Semarang", "Kumai - Surabaya",
  "Labuan Bajo - Ende", "Labuan Bajo - Maumere", "Labuan Bajo - Surabaya", "Lembar - Surabaya", "Lembar - Waingapu",
  "Makassar - Batulicin", "Makassar - Baubau", "Makassar - Selayar", "Makassar - Surabaya", "Marunda - Palembang",
  "Marunda - Pangkal Balam", "Maumere - Labuan Bajo", "Palembang - Jakarta", "Palembang - Marunda", "Palembang - Pangkal Balam",
  "Palembang - Sunda Kelapa", "Palembang - Surabaya", "Palembang - Tanjung Pandan", "Pangkal Balam - Jakarta",
  "Pangkal Balam - Marunda", "Pangkal Balam - Palembang", "Pangkal Balam - Sunda Kelapa", "Pangkal Balam - Tanjung Pandan", "Parepare - Balikpapan",
  "Parepare - Batulicin", "Pontianak - Semarang", "Sampit - Semarang", "Sampit - Surabaya", "Selayar - Baubau",
  "Selayar - Makassar", "Semarang - Ketapang Kalbar", "Semarang - Kumai", "Semarang - Pontianak", "Semarang - Sampit",
  "Sunda Kelapa - Palembang", "Sunda Kelapa - Pangkal Balam", "Surabaya - Balikpapan", "Surabaya - Banjarmasin", "Surabaya - Kumai",
  "Surabaya - Labuan Bajo", "Surabaya - Lembar", "Surabaya - Makassar", "Surabaya - Palembang", "Surabaya - Sampit",
  "Tanjung Pandan - Jakarta", "Tanjung Pandan - Palembang", "Tanjung Pandan - Pangkal Balam", "Waingapu - Kupang", "Jakarta - Pangkal Balam",


];

const FILTER_META = {
  kapal: { suffix: 'Kapal', allLabel: 'Semua Kapal', activeLabel: 'Kapal', source: 'column', column: 'KAPAL' },
  pelabuhan: { suffix: 'Pelabuhan', allLabel: 'Semua Pelabuhan', activeLabel: 'Pelabuhan', source: 'column', column: 'INAPORT CODE', isPort: true },
  berangkatKe: { suffix: 'BerangkatKe', allLabel: 'Semua Keberangkatan', activeLabel: 'Keberangkatan', source: 'column', column: 'BERANGKAT KE' },
  tibaDari: { suffix: 'TibaDari', allLabel: 'Semua Kedatangan', activeLabel: 'Kedatangan', source: 'column', column: 'TIBA DARI' },
  jenisKapal: { suffix: 'JenisKapal', allLabel: 'Semua Jenis Kapal', activeLabel: 'Jenis Kapal', source: 'column', column: 'JENIS KAPAL' },
  trayek: { suffix: 'Trayek', allLabel: 'Semua Trayek', activeLabel: 'Trayek', source: 'column', column: 'TRAYEK' },
  muatanBongkar: { suffix: 'MuatanBongkar', allLabel: 'Semua Muatan Datang', activeLabel: 'Muatan Datang', source: 'detailCommodity', direction: 'BONGKAR' },
  muatanMuat: { suffix: 'MuatanMuat', allLabel: 'Semua Muatan Berangkat', activeLabel: 'Muatan Berangkat', source: 'detailCommodity', direction: 'MUAT' }
};
const FILTER_TYPES = Object.keys(FILTER_META);
const MAX_FILTER_OPTION_RENDER = 250;
const DETAIL_EXPORT_COLUMNS = ['BONGKAR_KOMODITI', 'BONGKAR_JENIS', 'BONGKAR_TON', 'BONGKAR_M3', 'BONGKAR_UNIT', 'MUAT_KOMODITI', 'MUAT_JENIS', 'MUAT_TON', 'MUAT_M3', 'MUAT_UNIT'];
const DATE_FIELD_IDS = {
  tibaStart: 'tanggalTibaStart',
  tibaEnd: 'tanggalTibaEnd',
  berangkatStart: 'tanggalBerangkatStart',
  berangkatEnd: 'tanggalBerangkatEnd'
};
const TONNAGE_FIELD_IDS = {
  bongkarMin: 'jumlahBongkarMin',
  bongkarMax: 'jumlahBongkarMax',
  muatMin: 'jumlahMuatMin',
  muatMax: 'jumlahMuatMax'
};
const DATE_FILTER_GROUPS = {
  tiba: {
    label: 'Tanggal Kedatangan',
    ids: [DATE_FIELD_IDS.tibaStart, DATE_FIELD_IDS.tibaEnd]
  },
  berangkat: {
    label: 'Tanggal Keberangkatan',
    ids: [DATE_FIELD_IDS.berangkatStart, DATE_FIELD_IDS.berangkatEnd]
  }
};
const TONNAGE_FILTER_GROUPS = {
  bongkar: {
    label: 'Muatan Kedatangan',
    ids: [TONNAGE_FIELD_IDS.bongkarMin, TONNAGE_FIELD_IDS.bongkarMax]
  },
  muat: {
    label: 'Muatan Keberangkatan',
    ids: [TONNAGE_FIELD_IDS.muatMin, TONNAGE_FIELD_IDS.muatMax]
  }
};

function createFilterState(factory) {
  return Object.fromEntries(FILTER_TYPES.map(filterType => [filterType, factory(filterType)]));
}

function getFilterDomId(filterType, part) {
  return `filter${FILTER_META[filterType].suffix}${part}`;
}

function normalizeColumnName(value = '') {
  return String(value).toUpperCase().replace(/[_\s]/g, '');
}

function findColumnIndex(expectedName) {
  const normalizedExpected = normalizeColumnName(expectedName);
  return dbColumns.findIndex(col => normalizeColumnName(col) === normalizedExpected);
}

function getColumnIndexes() {
  const indexes = {};
  FILTER_TYPES.forEach(filterType => {
    const meta = FILTER_META[filterType];
    if (meta.source === 'column') {
      indexes[filterType] = findColumnIndex(meta.column);
    }
  });

  indexes.tibaTanggal = findColumnIndex('TIBA TANGGAL');
  indexes.berangkatTanggal = findColumnIndex('BERANGKAT TANGGAL');
  indexes.inaportCode = findColumnIndex('INAPORT CODE');
  indexes.tibaDariCode = findColumnIndex('TIBA DARI CODE');
  indexes.detail = dbColumns.findIndex(col => isDetailColumn(col));
  return indexes;
}

function parseDetailPayload(value) {
  if (!value) return null;

  try {
    let parsed = typeof value === 'object' ? value : JSON.parse(value);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function isDetailColumn(columnName = '') {
  const upper = columnName.toUpperCase();
  return upper.includes('DETAIL') || upper.includes('BONGKAR_MUAT');
}

let db = null;
let conn = null;
let allData = [];
let filteredData = [];
let dbColumns = [];
let isStatsLoaded = false;
let currentPage = 1;
let rowsPerPage = 10;
let xlsxModule = null;
let xlsxModulePromise = null;
const rowDetailCache = new WeakMap();

// Excel-like filter state management
let filterOptions = createFilterState(() => []);
let selectedFilters = createFilterState(() => new Set());
let allFilterOptions = createFilterState(() => []);

// Reverse mapping: code -> name
const codeToPort = {};
Object.entries(portCodes).forEach(([name, code]) => {
  codeToPort[code] = name;
});

// Helper function to format port display: "Surabaya (IDSUB)"
function formatPortDisplay(code) {
  if (!code) return '-';
  const name = codeToPort[code] || code;
  return `${name} (${code})`;
}

function getDisplayValue(filterType, value) {
  return FILTER_META[filterType].isPort ? formatPortDisplay(value) : value;
}

function parseDateOnly(value) {
  if (!value) return null;
  const stringValue = String(value).trim();
  const datePart = stringValue.includes(' ') ? stringValue.split(' ')[0] : stringValue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

function safeParseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function debounce(callback, delay = 250) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

function truncateText(text, maxLength = 28) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function formatNumberForChip(value) {
  const parsed = safeParseNumber(value);
  if (parsed === null) return null;
  return parsed.toLocaleString('id-ID');
}

function formatDateRangeChip(label, startValue, endValue) {
  if (startValue && endValue) return `${label}: ${startValue} - ${endValue}`;
  if (startValue) return `${label}: >= ${startValue}`;
  if (endValue) return `${label}: <= ${endValue}`;
  return '';
}

function formatNumberRangeChip(label, minValue, maxValue) {
  const minLabel = formatNumberForChip(minValue);
  const maxLabel = formatNumberForChip(maxValue);
  if (minLabel && maxLabel) return `${label}: ${minLabel} - ${maxLabel} ton`;
  if (minLabel) return `${label}: >= ${minLabel} ton`;
  if (maxLabel) return `${label}: <= ${maxLabel} ton`;
  return '';
}

function sumDetailTonnage(items = [], tonField) {
  return items.reduce((total, item) => total + (safeParseNumber(item?.[tonField]) || 0), 0);
}

function getRowDetailSummary(row, columnIndexes = getColumnIndexes()) {
  if (rowDetailCache.has(row)) {
    return rowDetailCache.get(row);
  }

  const detail = columnIndexes.detail !== -1 ? parseDetailPayload(row[columnIndexes.detail]) : null;
  const bongkarItems = Array.isArray(detail?.BONGKAR) ? detail.BONGKAR : [];
  const muatItems = Array.isArray(detail?.MUAT) ? detail.MUAT : [];
  const summary = {
    detail,
    bongkarKomoditi: bongkarItems.map(item => String(item?.KOMODITIBONGKAR || '').trim()).filter(Boolean),
    muatKomoditi: muatItems.map(item => String(item?.KOMODITIMUAT || '').trim()).filter(Boolean),
    bongkarTon: sumDetailTonnage(bongkarItems, 'TONBONGKAR'),
    muatTon: sumDetailTonnage(muatItems, 'TONMUAT')
  };

  rowDetailCache.set(row, summary);
  return summary;
}

function getRowFilterValues(filterType, row, columnIndexes = getColumnIndexes()) {
  const meta = FILTER_META[filterType];

  if (meta.source === 'column') {
    const colIdx = columnIndexes[filterType];
    if (colIdx === -1) return [];
    const value = String(row[colIdx] || '').trim();
    return value ? [value] : [];
  }

  const detailSummary = getRowDetailSummary(row, columnIndexes);
  if (meta.direction === 'BONGKAR') return detailSummary.bongkarKomoditi;
  if (meta.direction === 'MUAT') return detailSummary.muatKomoditi;
  return [];
}

function doesRowMatchOptionFilter(filterType, row, columnIndexes = getColumnIndexes()) {
  const selectedValues = selectedFilters[filterType];
  if (!selectedValues || selectedValues.size === 0) return true;

  const rowValues = getRowFilterValues(filterType, row, columnIndexes);
  if (rowValues.length === 0) return false;
  return rowValues.some(value => selectedValues.has(value));
}

function doesRowMatchDateFilters(row, columnIndexes = getColumnIndexes()) {
  const tibaDate = parseDateOnly(columnIndexes.tibaTanggal !== -1 ? row[columnIndexes.tibaTanggal] : null);
  const berangkatDate = parseDateOnly(columnIndexes.berangkatTanggal !== -1 ? row[columnIndexes.berangkatTanggal] : null);
  const tibaStart = document.getElementById(DATE_FIELD_IDS.tibaStart)?.value || '';
  const tibaEnd = document.getElementById(DATE_FIELD_IDS.tibaEnd)?.value || '';
  const berangkatStart = document.getElementById(DATE_FIELD_IDS.berangkatStart)?.value || '';
  const berangkatEnd = document.getElementById(DATE_FIELD_IDS.berangkatEnd)?.value || '';

  if (tibaStart && (!tibaDate || tibaDate < tibaStart)) return false;
  if (tibaEnd && (!tibaDate || tibaDate > tibaEnd)) return false;
  if (berangkatStart && (!berangkatDate || berangkatDate < berangkatStart)) return false;
  if (berangkatEnd && (!berangkatDate || berangkatDate > berangkatEnd)) return false;
  return true;
}

function doesRowMatchTonnageFilters(row, columnIndexes = getColumnIndexes()) {
  const detailSummary = getRowDetailSummary(row, columnIndexes);
  const bongkarMin = safeParseNumber(document.getElementById(TONNAGE_FIELD_IDS.bongkarMin)?.value);
  const bongkarMax = safeParseNumber(document.getElementById(TONNAGE_FIELD_IDS.bongkarMax)?.value);
  const muatMin = safeParseNumber(document.getElementById(TONNAGE_FIELD_IDS.muatMin)?.value);
  const muatMax = safeParseNumber(document.getElementById(TONNAGE_FIELD_IDS.muatMax)?.value);

  if (bongkarMin !== null && detailSummary.bongkarTon < bongkarMin) return false;
  if (bongkarMax !== null && detailSummary.bongkarTon > bongkarMax) return false;
  if (muatMin !== null && detailSummary.muatTon < muatMin) return false;
  if (muatMax !== null && detailSummary.muatTon > muatMax) return false;
  return true;
}

function countActiveFilters(isRouteFilterActive = false) {
  const selectedCount = FILTER_TYPES.filter(filterType => selectedFilters[filterType].size > 0).length;
  const searchCount = document.getElementById('searchInput')?.value?.trim() ? 1 : 0;
  const routeCount = isRouteFilterActive ? 1 : 0;
  const dateCount = Object.values(DATE_FILTER_GROUPS).filter(group =>
    group.ids.some(id => document.getElementById(id)?.value)
  ).length;
  const tonnageCount = Object.values(TONNAGE_FILTER_GROUPS).filter(group =>
    group.ids.some(id => document.getElementById(id)?.value)
  ).length;
  return selectedCount + searchCount + routeCount + dateCount + tonnageCount;
}

function closeAllFilterPanels() {
  FILTER_TYPES.forEach(filterType => {
    const panel = document.getElementById(getFilterDomId(filterType, 'Panel'));
    const trigger = document.getElementById(getFilterDomId(filterType, 'Trigger'));
    if (panel) {
      panel.classList.add('hidden');
    }
    if (trigger) {
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function updateActiveFilterSummary(activeFilterCount) {
  const summaryChip = document.getElementById('activeFilterSummary');
  if (!summaryChip) return;

  if (activeFilterCount > 0) {
    summaryChip.textContent = `${activeFilterCount} filter aktif`;
    summaryChip.classList.add('is-active');
  } else {
    summaryChip.textContent = 'Belum ada filter aktif';
    summaryChip.classList.remove('is-active');
  }
}

function updateClearFiltersButtonState(activeFilterCount) {
  const clearBtn = document.getElementById('clearAllFiltersBtn');
  if (clearBtn) {
    clearBtn.disabled = activeFilterCount === 0;
  }
}

function updateFilterPanelMeta(filterType, visibleCount = filterOptions[filterType]?.length || 0) {
  const selectedStat = document.getElementById(getFilterDomId(filterType, 'SelectedStat'));
  const visibleStat = document.getElementById(getFilterDomId(filterType, 'VisibleStat'));
  const selectedCount = selectedFilters[filterType]?.size || 0;
  const normalizedVisible = Number.isFinite(visibleCount) ? visibleCount : 0;

  if (selectedStat) {
    selectedStat.textContent = `${selectedCount} dipilih`;
  }
  if (visibleStat) {
    visibleStat.textContent = `${normalizedVisible} opsi`;
  }
}

function clearOptionFilter(filterType) {
  if (!selectedFilters[filterType]) return;

  selectedFilters[filterType].clear();
  const searchInput = document.getElementById(getFilterDomId(filterType, 'Search'));
  if (searchInput) {
    searchInput.value = '';
  }

  populateExcelFilter(filterType, filterOptions[filterType], filterOptions[filterType].length);
  updateFilterDisplay(filterType);
}

function clearDateGroup(groupKey) {
  const group = DATE_FILTER_GROUPS[groupKey];
  if (!group) return;
  group.ids.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
}

function clearTonnageGroup(groupKey) {
  const group = TONNAGE_FILTER_GROUPS[groupKey];
  if (!group) return;
  group.ids.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
}

function getRouteSelectionLabel() {
  const selectElement = document.getElementById('routeSelect');
  if (!selectElement || !selectElement.value) return '';
  return selectElement.options[selectElement.selectedIndex]?.text || '';
}

function renderActiveFilterChips(isRouteFilterActive = false) {
  const chipsContainer = document.getElementById('activeFilterChips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = '';
  const chips = [];

  const searchValue = document.getElementById('searchInput')?.value?.trim() || '';
  if (searchValue) {
    chips.push({
      label: `Kata kunci: \"${truncateText(searchValue, 24)}\"`,
      action: 'clear-search'
    });
  }

  const routeLabel = getRouteSelectionLabel();
  if (isRouteFilterActive && routeLabel) {
    chips.push({
      label: `Lintasan: ${truncateText(routeLabel, 28)}`,
      action: 'clear-route'
    });
  }

  FILTER_TYPES.forEach(filterType => {
    const selected = Array.from(selectedFilters[filterType] || []);
    if (selected.length === 0) return;

    const preview = getDisplayValue(filterType, selected[0]);
    const moreLabel = selected.length > 1 ? ` (+${selected.length - 1})` : '';
    chips.push({
      label: `${FILTER_META[filterType].activeLabel}: ${truncateText(preview, 24)}${moreLabel}`,
      action: 'clear-option-filter',
      filterType
    });
  });

  Object.entries(DATE_FILTER_GROUPS).forEach(([groupKey, group]) => {
    const [startId, endId] = group.ids;
    const startValue = document.getElementById(startId)?.value || '';
    const endValue = document.getElementById(endId)?.value || '';
    const label = formatDateRangeChip(group.label, startValue, endValue);
    if (!label) return;

    chips.push({
      label,
      action: 'clear-date-group',
      groupKey
    });
  });

  Object.entries(TONNAGE_FILTER_GROUPS).forEach(([groupKey, group]) => {
    const [minId, maxId] = group.ids;
    const minValue = document.getElementById(minId)?.value || '';
    const maxValue = document.getElementById(maxId)?.value || '';
    const label = formatNumberRangeChip(group.label, minValue, maxValue);
    if (!label) return;

    chips.push({
      label,
      action: 'clear-tonnage-group',
      groupKey
    });
  });

  if (chips.length === 0) {
    chipsContainer.classList.add('hidden');
    return;
  }

  chips.forEach(chipDef => {
    const chip = document.createElement('span');
    chip.className = 'active-filter-chip';

    const chipLabel = document.createElement('span');
    chipLabel.textContent = chipDef.label;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove';
    removeBtn.dataset.action = chipDef.action;
    if (chipDef.filterType) {
      removeBtn.dataset.filterType = chipDef.filterType;
    }
    if (chipDef.groupKey) {
      removeBtn.dataset.groupKey = chipDef.groupKey;
    }
    removeBtn.setAttribute('aria-label', `Hapus ${chipDef.label}`);
    removeBtn.textContent = 'x';

    chip.appendChild(chipLabel);
    chip.appendChild(removeBtn);
    chipsContainer.appendChild(chip);
  });

  chipsContainer.classList.remove('hidden');
}

function handleActiveFilterChipClick(event) {
  const removeBtn = event.target.closest('button[data-action]');
  if (!removeBtn) return;

  const action = removeBtn.dataset.action;
  if (action === 'clear-search') {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
  } else if (action === 'clear-route') {
    const routeSelect = document.getElementById('routeSelect');
    if (routeSelect) routeSelect.selectedIndex = 0;
  } else if (action === 'clear-option-filter') {
    clearOptionFilter(removeBtn.dataset.filterType);
  } else if (action === 'clear-date-group') {
    clearDateGroup(removeBtn.dataset.groupKey);
  } else if (action === 'clear-tonnage-group') {
    clearTonnageGroup(removeBtn.dataset.groupKey);
  } else {
    return;
  }

  performSearch();
}

// Extract distinct values from loaded data
function extractDistinctValues(dataSource = null) {
  const sourceData = dataSource || allData;
  if (!sourceData || sourceData.length === 0 || !dbColumns) return;

  console.log('Extracting from data count:', sourceData.length);

  const columnIndexes = getColumnIndexes();

  console.log('Column indices:', columnIndexes);

  const distinctValues = createFilterState(() => new Set());

  sourceData.forEach(row => {
    FILTER_TYPES.forEach(filterType => {
      getRowFilterValues(filterType, row, columnIndexes).forEach(value => distinctValues[filterType].add(value));
    });
  });

  FILTER_TYPES.forEach(filterType => {
    filterOptions[filterType] = Array.from(distinctValues[filterType]).sort();
    allFilterOptions[filterType] = [...filterOptions[filterType]];
  });

  console.log('Filter options extracted:', Object.fromEntries(FILTER_TYPES.map(filterType => [filterType, filterOptions[filterType].length])));

  FILTER_TYPES.forEach(filterType => {
    populateExcelFilter(filterType, filterOptions[filterType], filterOptions[filterType].length);
  });
}

// Populate Excel-like filter dropdown
function populateExcelFilter(filterType, values, totalCount = null) {
  const optionsContainer = document.getElementById(getFilterDomId(filterType, 'Options'));
  if (!optionsContainer) return;

  const selectAllButton = document.getElementById(getFilterDomId(filterType, 'SelectAll'));
  const clearAllButton = document.getElementById(getFilterDomId(filterType, 'ClearAll'));

  optionsContainer.innerHTML = '';
  const labelCount = totalCount !== null ? totalCount : (filterOptions[filterType]?.length || 0);
  const matchedCount = values.length;
  const renderValues = values.slice(0, MAX_FILTER_OPTION_RENDER);
  const isTruncated = matchedCount > MAX_FILTER_OPTION_RENDER;

  if (selectAllButton) {
    selectAllButton.disabled = matchedCount === 0;
  }
  if (clearAllButton) {
    clearAllButton.disabled = matchedCount === 0 && selectedFilters[filterType].size === 0;
  }

  if (matchedCount === 0) {
    optionsContainer.innerHTML = '<div class="no-results">Tidak ada data</div>';
    updateFilterPanelMeta(filterType, 0);
    updateFilterTotalCount(filterType, labelCount);
    return;
  }

  if (isTruncated) {
    const meta = document.createElement('div');
    meta.className = 'meta-results';
    meta.textContent = `Menampilkan ${renderValues.length} dari ${matchedCount} hasil. Ketik kata kunci untuk mempersempit.`;
    optionsContainer.appendChild(meta);
  }

  renderValues.forEach(value => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.dataset.filterType = filterType;

    const displayValue = getDisplayValue(filterType, value);
    const text = document.createTextNode(displayValue);

    checkbox.addEventListener('change', () => handleFilterChange(filterType));

    // Re-check if previously selected
    if (selectedFilters[filterType].has(value)) {
      checkbox.checked = true;
    }

    label.appendChild(checkbox);
    label.appendChild(text);
    optionsContainer.appendChild(label);
  });

  updateFilterPanelMeta(filterType, matchedCount);
  updateFilterTotalCount(filterType, labelCount);
}

// Update filter total count display
function updateFilterTotalCount(filterType, total) {
  const label = document.getElementById(getFilterDomId(filterType, 'Label'));
  if (!label) return;
  const meta = FILTER_META[filterType];
  const hasSelection = selectedFilters[filterType].size > 0;
  label.textContent = `${hasSelection ? meta.activeLabel : meta.allLabel} (${total})`;
}

// Handle filter change
function handleFilterChange(filterType) {
  const optionsContainer = document.getElementById(getFilterDomId(filterType, 'Options'));
  if (!optionsContainer) return;
  const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');

  selectedFilters[filterType].clear();
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedFilters[filterType].add(cb.value);
    }
  });

  updateFilterDisplay(filterType);
  performSearch();
}

// Update filter display (label and badge)
function updateFilterDisplay(filterType) {
  const badge = document.getElementById(getFilterDomId(filterType, 'Count'));
  const trigger = document.getElementById(getFilterDomId(filterType, 'Trigger'));
  if (!badge || !trigger) return;

  const count = selectedFilters[filterType].size;
  const totalOptions = filterOptions[filterType].length;

  updateFilterTotalCount(filterType, totalOptions);
  updateFilterPanelMeta(filterType);

  if (count === 0) {
    badge.classList.add('hidden');
    trigger.classList.remove('active');
  } else {
    badge.textContent = count;
    badge.classList.remove('hidden');
    trigger.classList.add('active');
  }
}

// Setup filter event listeners
function setupFilterEventListeners() {
  FILTER_TYPES.forEach(filterType => {
    const trigger = document.getElementById(getFilterDomId(filterType, 'Trigger'));
    const panel = document.getElementById(getFilterDomId(filterType, 'Panel'));
    const search = document.getElementById(getFilterDomId(filterType, 'Search'));
    const selectAll = document.getElementById(getFilterDomId(filterType, 'SelectAll'));
    const clearAll = document.getElementById(getFilterDomId(filterType, 'ClearAll'));

    if (!trigger || !panel || !search || !selectAll || !clearAll) return;

    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panel.id);

    if (!panel.querySelector('.dropdown-panel-header')) {
      const panelHeader = document.createElement('div');
      panelHeader.className = 'dropdown-panel-header';

      const title = document.createElement('span');
      title.className = 'panel-title';
      title.textContent = FILTER_META[filterType].activeLabel;

      const stat = document.createElement('span');
      stat.className = 'panel-stat';

      const selectedStat = document.createElement('span');
      selectedStat.id = getFilterDomId(filterType, 'SelectedStat');
      selectedStat.textContent = '0 dipilih';

      const visibleStat = document.createElement('span');
      visibleStat.id = getFilterDomId(filterType, 'VisibleStat');
      visibleStat.textContent = '0 opsi';

      stat.appendChild(selectedStat);
      stat.appendChild(visibleStat);
      panelHeader.appendChild(title);
      panelHeader.appendChild(stat);
      panel.insertBefore(panelHeader, search);
    }

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !panel.classList.contains('hidden');

      closeAllFilterPanels();

      if (!isOpen) {
        panel.classList.remove('hidden');
        trigger.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        search.focus({ preventScroll: true });
      }
    });

    // Search within options
    search.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filtered = filterOptions[filterType].filter(value => {
        const displayValue = getDisplayValue(filterType, value);
        return displayValue.toLowerCase().includes(searchTerm);
      });
      populateExcelFilter(filterType, filtered, filterOptions[filterType].length);
    });

    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllFilterPanels();
        trigger.focus();
      }
    });

    // Select all
    selectAll.addEventListener('click', () => {
      const searchTerm = (search.value || '').toLowerCase();
      if (!searchTerm) {
        // Empty state means no explicit selection: all options are included.
        selectedFilters[filterType].clear();
      } else {
        const matchedValues = filterOptions[filterType].filter(value => {
          const displayValue = getDisplayValue(filterType, value);
          return displayValue.toLowerCase().includes(searchTerm);
        });
        matchedValues.forEach(value => selectedFilters[filterType].add(value));
      }

      const filtered = searchTerm
        ? filterOptions[filterType].filter(value => getDisplayValue(filterType, value).toLowerCase().includes(searchTerm))
        : filterOptions[filterType];
      populateExcelFilter(filterType, filtered, filterOptions[filterType].length);
      updateFilterDisplay(filterType);
      performSearch();
    });

    // Clear all
    clearAll.addEventListener('click', () => {
      const searchTerm = (search.value || '').toLowerCase();
      if (!searchTerm) {
        selectedFilters[filterType].clear();
      } else {
        const matchedValues = filterOptions[filterType].filter(value => {
          const displayValue = getDisplayValue(filterType, value);
          return displayValue.toLowerCase().includes(searchTerm);
        });
        matchedValues.forEach(value => selectedFilters[filterType].delete(value));
      }

      const filtered = searchTerm
        ? filterOptions[filterType].filter(value => getDisplayValue(filterType, value).toLowerCase().includes(searchTerm))
        : filterOptions[filterType];
      populateExcelFilter(filterType, filtered, filterOptions[filterType].length);
      updateFilterDisplay(filterType);
      performSearch();
    });

    updateFilterPanelMeta(filterType, filterOptions[filterType]?.length || 0);
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.excel-filter-wrapper')) {
      closeAllFilterPanels();
    }
  });

  // Close dropdowns on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllFilterPanels();
    }
  });

  [...Object.values(DATE_FIELD_IDS), ...Object.values(TONNAGE_FIELD_IDS)].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', performSearch);
      input.addEventListener('input', performSearch);
    }
  });

  const chipsContainer = document.getElementById('activeFilterChips');
  if (chipsContainer) {
    chipsContainer.addEventListener('click', handleActiveFilterChipClick);
  }

  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  if (clearAllFiltersBtn) {
    clearAllFiltersBtn.addEventListener('click', resetSearch);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  initRouteOptions();
  setupFilterEventListeners();

  // 1. Scan dulu file apa saja yang ada
  await scanAvailableFiles();

  // 2. Baru inisialisasi Database
  initDuckDB();
});

// --- FUNGSI DETEKSI FILE OTOMATIS ---
async function scanAvailableFiles() {
  const select = document.getElementById('yearSelect');
  select.innerHTML = '<option>Sedang memindai file...</option>';
  select.disabled = true;

  const availableFiles = [];
  const checkPromises = [];

  // Loop range tahun untuk dicek (Parallel requests agar cepat)
  for (let year = MAX_SCAN_YEAR; year >= MIN_SCAN_YEAR; year--) {
    const fileName = `Data ${year}.parquet`;
    const filePath = `${DB_FOLDER}${fileName}`;

    // Buat Promise pengecekan
    const check = fetch(filePath, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          return { year: year, path: filePath, name: fileName };
        }
        return null;
      })
      .catch(() => null); // Abaikan error (misal file tidak ada)

    checkPromises.push(check);
  }

  // Tunggu semua pengecekan selesai
  const results = await Promise.all(checkPromises);

  // Filter hanya yang ditemukan (tidak null) & urutkan descending
  const foundFiles = results.filter(r => r !== null).sort((a, b) => b.year - a.year);

  select.innerHTML = ''; // Kosongkan

  if (foundFiles.length > 0) {
    foundFiles.forEach(file => {
      const option = document.createElement('option');
      option.value = file.path;
      option.textContent = `Data Tahun ${file.year}`;
      select.appendChild(option);
    });

    // Set default ke yang paling baru
    select.selectedIndex = 0;
    currentDbUrl = select.value;
    select.disabled = false;
  } else {
    const option = document.createElement('option');
    option.textContent = "Tidak ada file database ditemukan";
    select.appendChild(option);
  }
}

async function initDuckDB() {
  try {
    // Cek jika URL kosong (tidak ada file ditemukan)
    if (!currentDbUrl) return;

    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    conn = await db.connect();

    await loadStatisticsDb();
    await autoLoadDatabase();

  } catch (err) {
    showError("Gagal Inisialisasi DuckDB: " + err.message);
  }
}

async function loadStatisticsDb() {
  try {
    const response = await fetch(statsDbUrl);
    if (!response.ok) throw new Error("File statistik.parquet tidak ditemukan");

    const arrayBuffer = await response.arrayBuffer();
    await db.registerFileBuffer('temp_stats.parquet', new Uint8Array(arrayBuffer));
    await conn.query(`DROP TABLE IF EXISTS stats_table`);
    await conn.query(`CREATE TABLE stats_table AS SELECT * FROM read_parquet('temp_stats.parquet')`);

    isStatsLoaded = true;
  } catch (e) {
    console.warn("Gagal load statistik (Mungkin file belum ada di folder database):", e);
  }
}

async function autoLoadDatabase() {
  showLoading(true, `Mengunduh ${currentDbUrl}...`);
  hideError();

  document.getElementById('table-wrapper').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');
  document.getElementById('summary-stats').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');

  try {
    if (!db || !conn) return;

    const response = await fetch(currentDbUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) throw new Error("File kosong (0 bytes).");

    showLoading(true, "Membangun Tabel Data...");

    await db.registerFileBuffer('temp_source.parquet', new Uint8Array(arrayBuffer));
    await conn.query(`DROP TABLE IF EXISTS my_table`);
    await conn.query(`CREATE TABLE my_table AS SELECT * FROM read_parquet('temp_source.parquet')`);

    const result = await conn.query(`SELECT * FROM my_table`);
    const arrowJson = result.toArray().map(r => r.toJSON());

    if (arrowJson.length > 0) {
      dbColumns = Object.keys(arrowJson[0]);
      allData = arrowJson.map(row => {
        return dbColumns.map(col => {
          let val = row[col];
          if (typeof val === 'bigint') return val.toString();
          return val;
        });
      });
    } else {
      dbColumns = [];
      allData = [];
    }

    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('advanced-filters').classList.remove('hidden');
    extractDistinctValues();
    resetSearch();

  } catch (err) {
    showError(`Gagal memuat data: <br>${err.message}`);
    document.getElementById('empty-state').classList.remove('hidden');
  } finally {
    showLoading(false);
  }
}

document.getElementById('yearSelect').addEventListener('change', (e) => {
  currentDbUrl = e.target.value;
  autoLoadDatabase();
});

document.getElementById('searchBtn').addEventListener('click', performSearch);
document.getElementById('resetBtn').addEventListener('click', resetSearch);
document.getElementById('routeSelect').addEventListener('change', performSearch);
const debouncedSearch = debounce(() => performSearch(), 280);
document.getElementById('searchInput').addEventListener('input', debouncedSearch);
document.getElementById('rowsPerPage').addEventListener('change', (e) => {
  rowsPerPage = parseInt(e.target.value);
  currentPage = 1;
  renderCurrentPage();
});
document.getElementById('btnPrev').addEventListener('click', () => changePage(-1));
document.getElementById('btnNext').addEventListener('click', () => changePage(1));
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});
document.getElementById('exportBtn').addEventListener('click', exportFilteredToXLSX);

async function loadXLSXModule() {
  // XLSX sudah dimuat via <script> tag di <head>
  if (window.XLSX) {
    xlsxModule = window.XLSX;
    return xlsxModule;
  }

  // Fallback: coba muat ulang jika belum ada
  if (xlsxModule) return xlsxModule;
  if (!xlsxModulePromise) {
    xlsxModulePromise = new Promise((resolve, reject) => {
      if (window.XLSX) {
        resolve(window.XLSX);
        return;
      }

      const existingScript = document.getElementById('xlsx-cdn-script');
      const script = existingScript || document.createElement('script');
      script.src = './xlsx.full.min.js'; // Local fallback
      script.id = 'xlsx-cdn-script';
      script.async = true;
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('Pustaka XLSX tidak dapat dimuat. Silakan unduh xlsx.full.min.js dari https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js dan letakkan di folder yang sama dengan index.html.'));
      if (!existingScript) {
        document.head.appendChild(script);
      }
    });
  }

  try {
    xlsxModule = await xlsxModulePromise;
    if (!xlsxModule) throw new Error('Objek XLSX tidak ditemukan setelah script dimuat.');
    return xlsxModule;
  } catch (err) {
    err.isXLSXLoadError = true;
    showError(`Gagal memuat pustaka XLSX: ${err.message}`);
    throw err;
  }
}

function initRouteOptions() {
  const select = document.getElementById('routeSelect');
  routeList.forEach(route => {
    const parts = route.split(" - ");
    if (parts.length === 2) {
      const origin = parts[0];
      const destination = parts[1];
      const originCode = portCodes[origin];
      const destCode = portCodes[destination];
      if (destCode && originCode) {
        const optionValue = `${destCode}|${originCode}`;
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = route;
        select.appendChild(option);
      }
    }
  });
}

function renderHeader(columns) {
  const thead = document.getElementById('table-headers');
  thead.innerHTML = '';
  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-b border-gray-700";
    th.innerText = col.replace(/_/g, ' ');
    thead.appendChild(th);
  });
}

function performSearch() {
  const textInput = document.getElementById('searchInput').value.toUpperCase();
  const routeInput = document.getElementById('routeSelect').value;
  const columnIndexes = getColumnIndexes();

  const summaryDiv = document.getElementById('summary-stats');
  const tableWrapper = document.getElementById('table-wrapper');
  const emptyState = document.getElementById('empty-state');

  summaryDiv.classList.remove('hidden');
  const selectedText = getRouteSelectionLabel() || 'Semua Lintasan';
  const routeNameElement = document.getElementById('summary-route-name');
  if (routeNameElement) routeNameElement.textContent = selectedText;

  const yearMatch = currentDbUrl.match(/(\d{4})/);
  const selectedYear = yearMatch ? yearMatch[0] : '';
  const statsYearElement = document.getElementById('stats-year-display');
  if (statsYearElement) statsYearElement.textContent = selectedYear;

  let routeDestCode = "";
  let routeOriginCode = "";
  let isRouteFilterActive = false;

  if (routeInput && routeInput !== "") {
    const parts = routeInput.split('|');
    if (parts.length === 2) {
      routeDestCode = parts[0];
      routeOriginCode = parts[1];
      const idxInaport = columnIndexes.inaportCode;
      const idxTibaDari = columnIndexes.tibaDariCode;
      if (idxInaport !== -1 && idxTibaDari !== -1) {
        isRouteFilterActive = true;
      }
    }
  }

  filteredData = allData.filter(row => {
    const matchesText = textInput === "" || row.some(cell => String(cell).toUpperCase().includes(textInput));
    
    let matchesRoute = true;
    if (isRouteFilterActive) {
      const cellInaport = String(row[columnIndexes.inaportCode] || "").toUpperCase();
      const cellOrigin = String(row[columnIndexes.tibaDariCode] || "").toUpperCase();
      matchesRoute = (cellInaport === routeDestCode) && (cellOrigin === routeOriginCode);
    }

    const matchesOptionFilters = FILTER_TYPES.every(filterType => doesRowMatchOptionFilter(filterType, row, columnIndexes));
    const matchesDateFilters = doesRowMatchDateFilters(row, columnIndexes);
    const matchesTonnageFilters = doesRowMatchTonnageFilters(row, columnIndexes);

    return matchesText && matchesRoute && matchesOptionFilters && matchesDateFilters && matchesTonnageFilters;
  });

  // Calculate statistics from filtered data
  calculateAndRenderSummary();

  currentPage = 1;
  if (dbColumns.length > 0) renderHeader(dbColumns);
  renderCurrentPage();

  const topCountEl = document.getElementById('db-filtered-count');
  const bottomCountEl = document.getElementById('db-filtered-count-bottom');
  const tableCountEl = document.getElementById('table-total-count');
  if (topCountEl) topCountEl.innerText = filteredData.length;
  if (bottomCountEl) bottomCountEl.innerText = filteredData.length;
  if (tableCountEl) tableCountEl.innerText = filteredData.length;
  const exportBtn = document.getElementById('exportBtn');
  const exportTooltip = document.getElementById('exportTooltip');
  const activeFilterCount = countActiveFilters(isRouteFilterActive);
  const hasFilter = activeFilterCount > 0;
  const isDisabled = !hasFilter || filteredData.length === 0;
  if (exportBtn) {
    exportBtn.disabled = isDisabled;
  }
  if (exportTooltip) {
    if (!hasFilter) {
      exportTooltip.textContent = 'Terapkan minimal satu filter sebelum ekspor';
    } else if (filteredData.length === 0) {
      exportTooltip.textContent = 'Tidak ada data yang cocok untuk diekspor';
    } else {
      exportTooltip.textContent = 'Ekspor hasil filter ke XLSX';
    }
    exportTooltip.style.display = isDisabled ? 'block' : 'none';
  }

  updateActiveFilterSummary(activeFilterCount);
  updateClearFiltersButtonState(activeFilterCount);
  renderActiveFilterChips(isRouteFilterActive);

  if (filteredData.length > 0) {
    tableWrapper.classList.remove('hidden');
    emptyState.classList.add('hidden');
  } else {
    tableWrapper.classList.add('hidden');
    if (allData.length > 0) {
      emptyState.classList.remove('hidden');
      document.querySelector('#empty-state h3').innerText = "Data tidak ditemukan";
    } else {
      emptyState.classList.remove('hidden');
    }
  }

  // Update filter options dynamically based on current filtered data
  // This makes filters interactive - options update based on what's currently visible
  updateDynamicFilterOptions();
}

// Update filter options dynamically based on current data and filters
function updateDynamicFilterOptions() {
  const textInput = document.getElementById('searchInput').value.toUpperCase();
  const routeInput = document.getElementById('routeSelect').value;
  const columnIndexes = getColumnIndexes();

  // Build base filtered data (text + route, no excel filters)
  let baseFilteredData = allData;

  // Apply text filter
  if (textInput !== "") {
    baseFilteredData = baseFilteredData.filter(row => 
      row.some(cell => String(cell).toUpperCase().includes(textInput))
    );
  }

  // Apply route filter
  if (routeInput && routeInput !== "") {
    const parts = routeInput.split('|');
    if (parts.length === 2) {
      const routeDestCode = parts[0];
      const routeOriginCode = parts[1];
      
      baseFilteredData = baseFilteredData.filter(row => {
        const cellInaport = String(row[columnIndexes.inaportCode] || "").toUpperCase();
        const cellOrigin = String(row[columnIndexes.tibaDariCode] || "").toUpperCase();
        return (cellInaport === routeDestCode) && (cellOrigin === routeOriginCode);
      });
    }
  }

  // Now update each filter's options based on the OTHER filters (not itself)
  FILTER_TYPES.forEach(filterType => updateFilterOptionsForType(filterType, baseFilteredData, columnIndexes));
}

function updateFilterOptionsForType(filterType, baseData, columnIndexes = getColumnIndexes()) {
  const dataForThisFilter = baseData.filter(row => {
    const matchesOtherFilters = FILTER_TYPES.every(otherFilterType => {
      if (otherFilterType === filterType) return true;
      return doesRowMatchOptionFilter(otherFilterType, row, columnIndexes);
    });

    return matchesOtherFilters
      && doesRowMatchDateFilters(row, columnIndexes)
      && doesRowMatchTonnageFilters(row, columnIndexes);
  });

  const valueSet = new Set();
  dataForThisFilter.forEach(row => {
    getRowFilterValues(filterType, row, columnIndexes).forEach(value => valueSet.add(value));
  });

  const newOptions = Array.from(valueSet).sort((a, b) => a.localeCompare(b, 'id'));
  filterOptions[filterType] = newOptions;
  allFilterOptions[filterType] = [...newOptions];
  populateExcelFilter(filterType, newOptions, newOptions.length);
  updateFilterDisplay(filterType);
}

// Update filter options based on route selection (DEPRECATED - now using updateDynamicFilterOptions)
function updateFilterOptionsBasedOnRoute(destCode, originCode) {
  const idxInaport = dbColumns.indexOf("INAPORT CODE");
  const idxTibaDari = dbColumns.indexOf("TIBA DARI CODE");

  // Filter allData based on route only (ignore excel filters)
  const routeFilteredData = allData.filter(row => {
    const cellInaport = String(row[idxInaport] || "").toUpperCase();
    const cellOrigin = String(row[idxTibaDari] || "").toUpperCase();
    return (cellInaport === destCode) && (cellOrigin === originCode);
  });

  // Extract distinct values from route-filtered data
  extractDistinctValues(routeFilteredData);
}

async function exportFilteredToXLSX() {
  if (filteredData.length === 0) {
    alert('Tidak ada data hasil filter untuk diekspor.');
    return;
  }

  try {
    const XLSX = await loadXLSXModule();

    // Cari index kolom DETAIL_BONGKAR_MUAT
    const detailColIndex = dbColumns.findIndex(col =>
      col.toUpperCase().includes("DETAIL") || col.toUpperCase().includes("BONGKAR_MUAT")
    );

    // Buat header baru - ganti kolom DETAIL dengan kolom BONGKAR dan MUAT
    // Cutoff at column AR (index 43) - only include columns A to AQ
    const maxColumns = 43; // Column AR onwards will be cut off
    let newHeaders = [];
    let colCount = 0;

        for (let idx = 0; idx < dbColumns.length && colCount < maxColumns; idx++) {
          const col = dbColumns[idx];
          if (idx === detailColIndex) {
            for (const bmCol of DETAIL_EXPORT_COLUMNS) {
              if (colCount < maxColumns) {
                newHeaders.push(bmCol);
                colCount++;
          }
        }
      } else {
        newHeaders.push(col);
        colCount++;
      }
    }

    // Transform data - setiap item BONGKAR/MUAT jadi baris terpisah
    const rows = [];
    const merges = []; // Array untuk menyimpan info merge cells
    let currentRow = 1; // Mulai dari baris 1 (baris 0 adalah header)

    // Tentukan kolom mana yang perlu di-merge (kolom non-detail)
    const nonDetailColIndices = [];
    let headerIdx = 0;
    for (let idx = 0; idx < dbColumns.length && headerIdx < maxColumns; idx++) {
      if (idx === detailColIndex) {
        headerIdx += Math.min(10, maxColumns - headerIdx); // 5 kolom BONGKAR + 5 kolom MUAT
      } else {
        nonDetailColIndices.push(headerIdx);
        headerIdx++;
      }
    }

    filteredData.forEach(row => {
      let detail = null;
      let bongkarItems = [];
      let muatItems = [];

      if (detailColIndex !== -1) {
        detail = row[detailColIndex];
        if (detail) {
          try {
            if (typeof detail === 'string') detail = JSON.parse(detail);
            if (typeof detail === 'string') detail = JSON.parse(detail);
            bongkarItems = detail.BONGKAR || [];
            muatItems = detail.MUAT || [];
          } catch (e) { }
        }
      }

      // Tentukan jumlah baris yang diperlukan (max dari BONGKAR dan MUAT, minimal 1)
      const numRows = Math.max(bongkarItems.length, muatItems.length, 1);
      const startRow = currentRow;

      for (let i = 0; i < numRows; i++) {
        const entry = {};
        let hIdx = 0;

        for (let idx = 0; idx < dbColumns.length && hIdx < newHeaders.length; idx++) {
          const col = dbColumns[idx];
          if (idx === detailColIndex) {
            // Isi kolom BONGKAR
            const bItem = bongkarItems[i] || {};
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = bItem.KOMODITIBONGKAR || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = bItem.JENISBONGKAR || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = bItem.TONBONGKAR || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = bItem.M3BONGKAR || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = bItem.UNITBONGKAR || '-';

            // Isi kolom MUAT
            const mItem = muatItems[i] || {};
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = mItem.KOMODITIMUAT || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = mItem.JENISMUAT || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = mItem.TONMUAT || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = mItem.M3MUAT || '-';
            if (hIdx < newHeaders.length) entry[newHeaders[hIdx++]] = mItem.UNITMUAT || '-';
          } else {
            let value = row[idx];
            if (value && typeof value === 'object') {
              try {
                value = JSON.stringify(value);
              } catch (err) {
                value = String(value);
              }
            }
            // Hanya isi data di baris pertama, baris selanjutnya kosong untuk kolom non-detail
            entry[newHeaders[hIdx++]] = (i === 0) ? (value ?? '-') : '';
          }
        }

        rows.push(entry);
        currentRow++;
      }

      // Tambahkan merge untuk kolom non-detail jika numRows > 1
      if (numRows > 1) {
        nonDetailColIndices.filter(colIdx => colIdx < maxColumns).forEach(colIdx => {
          merges.push({
            s: { r: startRow, c: colIdx }, // start: row, col
            e: { r: startRow + numRows - 1, c: colIdx } // end: row, col
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: newHeaders });

    // Set the worksheet range to only include columns up to maxColumns
    const lastCol = newHeaders.length - 1;
    const lastRow = rows.length; // +1 for header is already included in json_to_sheet
    worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });

    // Set default column width to 100 pixels (approximately 14 characters in Excel)
    const colWidth = 14; // ~100 pixels
    worksheet['!cols'] = newHeaders.map(() => ({ wch: colWidth }));

    // Apply merge cells
    if (merges.length > 0) {
      worksheet['!merges'] = merges;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    // Get filter info
    const yearMatch = currentDbUrl.match(/(\d{4})/);
    const selectedYear = yearMatch ? yearMatch[0] : 'Semua Tahun';
    const routeSelect = document.getElementById('routeSelect');
    const routeLabel = routeSelect.value ? routeSelect.options[routeSelect.selectedIndex].text : 'Semua Lintasan';
    const searchQuery = document.getElementById('searchInput')?.value?.trim() || '';

    // Create Statistics sheet
    const statsData = [
      ['STATISTIK LINTASAN'],
      [],
      ['FILTER', 'Nilai'],
      ['Tahun', selectedYear],
      ['Lintasan', routeLabel],
      ['Pencarian', searchQuery || '-'],
      [],
      ['RINGKASAN', 'Nilai'],
      ['Jumlah Data', filteredData.length],
      ['Tonase Komoditi (TON)', document.getElementById('stat-ton-bongkar')?.textContent || '0'],
      [],
      ['KENDARAAN', 'Unit'],
      ['Sepeda Motor', document.getElementById('stat-motor')?.textContent || '0'],
      ['Mobil', document.getElementById('stat-mobil')?.textContent || '0'],
      ['Truk Sedang', document.getElementById('stat-truk-sedang')?.textContent || '0'],
      ['Truk Besar', document.getElementById('stat-truk-besar')?.textContent || '0'],
      ['Tronton', document.getElementById('stat-tronton')?.textContent || '0'],
      ['Alat Berat', document.getElementById('stat-alat-berat')?.textContent || '0'],
      ['Trailer', document.getElementById('stat-trailer')?.textContent || '0']
    ];

    const statsWorksheet = XLSX.utils.aoa_to_sheet(statsData);
    statsWorksheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'Statistik');

    const safeRoute = routeLabel
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
    const fileName = `inaport_${selectedYear}_${safeRoute}_filtered.xlsx`;

    XLSX.writeFile(workbook, fileName);
  } catch (err) {
    if (!err?.isXLSXLoadError) {
      showError(`Gagal mengekspor data: ${err.message}`);
    }
  }
}

function calculateAndRenderSummary() {
  const mapping = {
    'stat-motor': 'SEPEDA MOTOR', 'stat-mobil': 'MOBIL', 'stat-truk-sedang': 'TRUK SEDANG',
    'stat-truk-besar': 'TRUK BESAR', 'stat-tronton': 'TRONTON', 'stat-trailer': 'TRAILER',
    'stat-alat-berat': 'ALAT BERAT', 'stat-ton-bongkar': 'TONASE KOMODITI BONGKAR',
    'stat-ton-kendaraan': 'TONASE KENDARAAN'
  };
  const fmt = (n) => n ? Number(n).toLocaleString('id-ID') : '0';

  // Vehicle classification lists
  const SEPEDA_MOTOR = [
    'SEPEDA MOTOR', 'MOTOR', 'MOTOR (2 RODA)', 'Motor', 'SEPEDAMOTOR', 'motor', 'sepeda motor', 'GOL II - SEPEDA MOTOR <500CC',
    'GOL III - SEPEDA MOTOR >500CC', 'KENDARAAN BERMOTOR RODA DUA (U', 'KENDARAAN BERMOTOR RODA DUA', 'KENDARAAAN BERMOTOR RODA DUA',
    'Sepeda Motor', 'MOTOR TRAIL', 'S. MOTOR', 's. motor', 'SEPEDA  MOTOR', 'SEPDA MOTOR', 'SEPEDA MOTOR s/d 750CC (GOL II)',
    'MOTOR VIXION', 'SPD MOTOR', 'MOTOR HONDA', 'MOTOR SATRIA FU', 'MOTORCYCLE', 'Barang pindahan (Motor)', 'KENDARAAN BERMOTOR RODA DUA (UNIT)',
    'MOTORO', 'SEPEDA MOTOR s/d 750 CC', 'Gol II - Sepeda Motor', 'MOTOR (PENUMPANGAN)', 'SEPEDAMOTOR DAN ALATNYA', 'Sepedamotor dan alatnya',
    'KENDARAAN GOLONGAN II', 'kendaraan gol II', 'KENDARAAN GOL II', 'KENDARAAN GOLOGNGAN II', 'KENDARAAAN GOLONGAN II', 'KENDARAAN GOL.II',
    'KENDRAAN GOLONGAN II', 'KENDARAAN GOLONAGN II', 'Kendaraan golongan II', 'Kendaraan Golongan II', 'KENDARAAN BERMOTOR LAINNYA (M3'
  ];
  const MOBIL = [
    'MOBIL', 'MOBIL KECIL', 'MOBIL KECIL (4 RODA)', 'Mobil', 'GOL IV BRG - MOBIL BARANG', 'GOL IV PNP - MOBIL SEDAN', 'MOBIL SEDANG (4 RODA)',
    'MOBIL KELUARGA', 'MOBIL BESAR', 'MOBIL DOUBLE CABIN', 'MOBIL (PENUMPANG)', 'MOBIL BARANG', 'mobil', 'MOBIL (RO-RO)', 'MOBIL ESTRADA',
    'MOBIL HILUX', 'MOBIL BOX', 'KENDARAAN GOLONGAN III', 'kendaraan gol III', 'KENDARAAN GOL III', 'KENDARAAN GOLOGNGAN III',
    'KENDARAAAN GOLONGAN III', 'KENDARAAN GOLONAGN III', 'CAMRY/PAJERO/ALPHARD >1500CC (GOL III.B)', 'SEDAN/JEEP/MINIBUS s/d 1500CC (GOL III.A)',
    'CAMRY/PAJERO/ALPHARD >1500CC (GOL III.B', 'SEDAN/JEEP/MINIBUS s/d 2000CC (GOL III.A)',
    'CAMRY/PAJERO/ALPHARD >2000CC (GOL III.B', 'Gol IV A - Sedan, Jeep dan sejenisnya', 'Gol IV B - Kendaraan Kecil Barang', 'Kendaraan Golongan III', 'KENDARAAAN BERMOTOR RODA EMPAT', 'KENDARAAN BERMOTOR RODA EMPAT'
  ];
  const TRUK_SEDANG = [
    'TRUK DUTRO', 'TRUK SEDANG 16 s/d 20 TON/M3 (PENUMPANG)', 'TRUK SEDANG', 'Truk sedang', 'TRUK KECIL', 'Truk Kecil', 'TRUK FUSO',
    'TRUK PS', 'GOL V BRG - TRUK SEDANG', 'TRUK TS', 'TRUK ECIL', 'MOBIL TRUCK', 'TRUK SEDANG LONG CHASIS MAX 8M (GOL IV.B)',
    'TRUK SEDANG LONG CHASIS MAX 8M (GOL IV.B) ISI', 'Truk Sedang', 'Gol V B - Truk Sedang', 'Truk dan Bus 28 s/d 33 Ton/M3 (VHC)',
    'Truk dan Bus < 28 Ton/M3 (VHC)', 'KENDARAAN GOLONGAN IV', 'kendaraan gol IV', 'KENDARAAN GOL IV', 'GOL V PNP - BUS SEDANG',
    'GOL V PNP - BUS KECIL', 'KENDARAAN GOLOGNGAN IV', 'KENDARAAAN GOLONGAN IV', 'KENDARAAN GOL IVB', 'KENDARAAN GOL IVA',
    'KENDARAAN GOL.IVA', 'KENDARAAN GOL.IVB', 'KENDARAAN GOLONAGN IV', 'TRUK/BUS SEDANG MAX 6M (GOL IV.A) ISI',
    'TRUK/BUS SEDANG MAX 6M (GOL IV.A)', 'TRUK/BUS SEDANG MAX 6M (GOL IV.A', 'KENDARAAN GOLONGAN IVA', 'KENDARAAN GOLONGAN IVB',
    'KENDARAAN GOLONGAN  IV', 'Kendaraan golongan IV', 'kendaraan gol iv', '"TRUK/BUS SEDANG MAX 6M (GOL IV.A) ISI"',
    'TRUK/BUS SEDANG MAX 6M (GOL IV.A) Isi', 'TRUK/BUS SEDANG MAX 6M (GOL IV.A) IS', 'Kendaraan Golongan IV', 'MOBILTRUK/BUS',
    'TRUK/BUS SEDANG (4-6 RODA)', 'TRUK', 'TRUKFUSO', 'TRUCK SEDANG', 'TRUCK', 'TRUCK KECIL', 'Truck Sedang', 'TRUCK BEKAS',
    'TRUCK SEDANG 4 RODA', 'TRUCK SEDANG 6 RODA', 'TRUCK BOX', 'Truck Kecil', 'Truck Kecil Besar'
  ];
  const TRUK_BESAR = [
    'DUMP TRUCK', 'DUMP TRUCK MIXER', 'DUMP TRUCK SANY', 'TRUK BESAR', 'DUMP TRUCK KOMATSU', 'DUMP TRUK KOMATSU 400', 'DUMP TRUK KOMATSU MDL HD785-7 & GENERAL CARGO',
    'GOL VI BRG - TRUK BESAR', 'GOL VII BRG - TRUK BESAR', 'Truk besar', 'Truk Besar', 'Dump Truck', 'Dump Truck Sany - SYZ380',
    'TRUK BESAR LONG CHASIS MAX 10M (GOL V.B) ISI', 'Manhauler Truck', 'VESEL DUMP TRUCK', 'TRUK  BESAR', 'TRUK BESAR LONG CHASIS MAX 10M (GOL V.B)',
    'Gol VI B - Truk Besar', 'Truk dan Bus 33 s/d 40 Ton/M3 (VHC)', 'KENDARAAN GOLONGAN V', 'KENDARAAN GOLONGAN VB', 'kendaraan gol V',
    'KENDARAAN GOL V', 'GOL VI PNP - BUS BESAR', 'GOL VII PNP - BUS BESAR', 'KENDARAAN GOLOGNGAN V', 'KENDARAAAN GOLONGAN V',
    'KENDARAAN GOL VB', 'KENDARAAN GOL VA', 'KENDARAAN GOL.VB', 'TRUK/BUS BESAR MAX 8M (GOL V.A) ISI', 'Kendaraan golongan V',
    'kendaraan gol v', 'TRUK/BUS BESAR MAX 8M (GOL V.A)', 'Kendaraan Golongan V', 'MOBIL TANGKI', 'MOBIL WATER TANK', 'MOBIL TRUK', 'MOBILASPHAL', 'TRUK/BUS BESAR (6 RODA)',
    'TRUK TANGKI', 'TRUK/BUS BESAR MAX 6M (ISI)', 'TRUK/BUS BESAR MAX 8M', 'TRUCK BESAR', 'DUMPTRUCK SANY', 'TRUCK DUMB', 'Truck Besar', 'DUMPTRUCK (SANY)', 'DUMPTRUCK SANY (RTL 451 DT)',
    'DUMPTRUCK SANY (RTL 460 DT)', 'DUMPTRUCK SANY (RTL 463 DT)', 'DUMPTRUCK SANY (RTL 464 DT)', 'DUMPTRUCK SANY (RTL 475 DT)', 'DUMPTRUCK SANY (RTL 488 DT)', 'DUMPTRUCK SANY (RTL 502 DT)',
    'DUMPTRUCK SANY (RTL 507 DT)', 'DUMPTRUCK SANY (RTL 518 DT)', 'DUMPTRUCK SANY (RTL 542 DT)', 'DUMPTRUCK SANY (RTL 571 DT)', 'DUMPTRUCK SANY (RTL 573 DT)', 'DUMPTRUCK SANY (RTL 576 DT)',
    'Truck Tangki', 'DUMP-TRUCK', 'TRUCK BERSAR', 'Dump-Truck', 'DUMPTRUCK', 'DUMP -TRUCK'

  ];
  const TRONTON = [
    'TRUK TRONTON', 'TRUK MIXER', 'GOL VII - TRUK TRONTON', 'Lube Truck', 'ANFO TRUCK', 'HEAD TRUCK', 'SEMEN BAG VIA TRUCK',
    'TRUCK TRONTON', 'TRONTON', 'GOL VII BRG - TRONTON', 'Tronton', 'GOL VII - TRONTON', 'TRONTON STANDARD MAX 10M (GOL VI.A',
    'TRONTONE', 'TRONTON STANDARD MAX 10M (GOL VI.A)', 'TRONTON LONG CHASIS MAX 13M (GOL VI.B)', 'TRONTON STANDARD MAX 10M (GOL VI.A) ISI',
    'Gol VII - Tronton', 'TRUCK TRONTON BERMUATAN', 'KENDARAAN GOLONGAN VI', 'KENDARAAN GOLONGAN VIB', 'kendaraan gol VI',
    'KENDARAAN GOL VI', 'KENDARAAN GOLOGNGAN VI', 'KENDARAAAN GOLONGAN VI', 'KENDARAAN GOL VIB', 'KENDARAAN GOL VIA',
    'KENDARAAN GOL.VIB', 'KENDARAAN GOLONGAN VIA', 'Kendaraan golongan VI', 'kendaraan gol vi', 'Kendaraan Golongan VI', 'MOBIL LOGGING', 'MOBIL MIXER',
    'HEADTRUK', 'TRUCK MIXER', 'TRUCK TERONTON', 'HEADTRUCK', 'TRUCKCHASIS'

  ];
  const ALAT_BERAT = [
    'ALAT BERAT / TRUK 40 s/d 50 TON/M3', 'ALAT BERAT / TRUK s/d 28 TON/M3', 'ALAT BERAT / TRUK S/D 28 TON/M3', 'ALAT BERAT / TRUK s/d 28TON/M3',
    'ALAT BERAT / TRUK 33 s/d 40 TON/M3', 'ALAT BERAT / TRUK s/d 28 TON/M2', 'ALAT BERAT / TRUK 28 s/d 33 TON/M3',
    'ALAT BERAT / TRUK 50 s/d 120 TON/M3 (PENUMPANG)', 'ALAT BERAT', 'ALAT BERAT & AKSESORIS', 'ALAT BERAT & CARGOES',
    'ALAT BERAT DA BESI BETON', 'Alat Berat', 'ALAT BERAT & CONTAINER', 'ALAT BERAT / MATERIAL', 'ALAT BERAT AND GENERAL CARGO',
    'alat berat', 'Alat Berat < 28 Ton/M3 (VHC)', 'TRUCK, ALAT BERAT , DLL', 'ALAT BERAT DAN EQUIPMENT', 'ALAT BERAT CRANE',
    'ALAT BERAT & KENDARAAN', 'ALAT BERAT EXAVATOR', 'ALAT BERAT (GOL VII.A)', 'ALAT BERAT DAN GRABS', 'ALAT BERAT BECO',
    'Alat Berat > 50 Ton/M3 (VHC)', 'Alat Berat > 120 Ton/M3 (VHC)', 'KENDARAAN GOLONGAN VII', 'KENDARAAN GOL VII',
    'KENDARAAN GOL.VII', 'Kendaraan Golongan VII', 'DUMP TRUCK,EXCAVATOR,DOZER,COMPATOR,MOTOR GREADER,BAN MOBIL',
    'MOTOR GRADER', 'MOTOR GREDER', 'MOBIL LV,DUMP TRUCK,EXCAVATOR', 'MOBIL CRANE', 'TRUCK CRANE', 'Harbour Mobile Crane',
    'mobil crane', 'ALAT BERAT, DUMP TRUK & GENERAL CARGO', 'GENERAL CARGO TRUCK LOSSING'

  ];
  const TRAILER = [
    'GOL IX - TRUK TRAILER PANJANG >16 M', 'GOL VIII - TRUK TRAILER PANJANG >12 M', 'GOL VII - TRUK TRAILER PANJANG <12 M',
    'KENDARAAN GOLONGAN VIII', 'KENDARAAN GOL VIII', 'KENDARAAN GOL.VIII', 'LCL-MOBIL-MOTOR', 'KENDARAAN GOLONGAN IX'
  ];
  const VALID_JENIS_BONGKAR = ['Bag Cargo', 'Unitized', 'Break Bulk', '0'];
  const VALID_JENIS_KAPAL = [
    'CAR CARRIER', 'CAR FERRY', 'CONTAINER SHIP', 'FERRY', 'GENERAL CARGO', 'KAPAL CARGO PENUMPANGAN',
    'KAPAL CRUISE', 'KAPAL LANDING CRAFT TANK (LCT)', 'KAPAL MULTI PURPOSE', 'KAPAL PENUMPANG TRADISIONAL',
    'PASSENGER', 'PASSENGER FERRY', 'PASSENGER HSC - A', 'PASSENGER HSC - B', 'RO-RO CARGO',
    'RO-RO FERRY', 'RO-RO PENUMPANG DAN BARANG', 'MOTORIZED SAILING / LAYAR MOTOR',
    'TONGKANG / BARGE', 'TONGKANG GELADAK (DECK BARGE)'
  ];

  // Initialize counters
  let stats = {
    'stat-motor': 0, 'stat-mobil': 0, 'stat-truk-sedang': 0,
    'stat-truk-besar': 0, 'stat-tronton': 0, 'stat-trailer': 0,
    'stat-alat-berat': 0, 'stat-ton-bongkar': 0, 'stat-ton-kendaraan': 0
  };
  let totalBongkarTonase = 0; // ALL bongkar tonnage from filtered data

  // Get column indices
  const detailColIndex = dbColumns.findIndex(col =>
    col.toUpperCase().includes("DETAIL") || col.toUpperCase().includes("BONGKAR_MUAT")
  );
  const jenisKapalIndex = dbColumns.findIndex(col => {
    const upper = col.toUpperCase().replace(/[_\s]/g, '');
    return upper.includes("JENISKAPAL");
  });

  // Process ALL filtered data
  filteredData.forEach(row => {
    if (detailColIndex === -1) return;

    const detail = parseDetailPayload(row[detailColIndex]);
    if (!detail) return;

    // Check if this row has a valid jenis kapal (for vehicle counting only)
    const jenisKapal = jenisKapalIndex !== -1 ? (row[jenisKapalIndex] || '') : '';
    const isValidJenisKapal = VALID_JENIS_KAPAL.includes(jenisKapal);

    const bongkarItems = detail.BONGKAR || [];

    bongkarItems.forEach(item => {
      const jenisBongkar = item.JENISBONGKAR || '';
      const komoditi = item.KOMODITIBONGKAR || '';
      const unit = parseInt(item.UNITBONGKAR) || 0;
      const tonase = parseFloat(item.TONBONGKAR) || 0;

      // Add ALL bongkar tonnage (no filters)
      totalBongkarTonase += tonase;

      // Only count vehicles if JENIS KAPAL and JENIS BONGKAR are valid
      if (isValidJenisKapal && VALID_JENIS_BONGKAR.includes(jenisBongkar)) {
        if (SEPEDA_MOTOR.includes(komoditi)) {
          stats['stat-motor'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        } else if (MOBIL.includes(komoditi)) {
          stats['stat-mobil'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        } else if (TRUK_SEDANG.includes(komoditi)) {
          stats['stat-truk-sedang'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        } else if (TRUK_BESAR.includes(komoditi)) {
          stats['stat-truk-besar'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        } else if (TRONTON.includes(komoditi)) {
          stats['stat-tronton'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        } else if (ALAT_BERAT.includes(komoditi)) {
          stats['stat-alat-berat'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        } else if (TRAILER.includes(komoditi)) {
          stats['stat-trailer'] += unit;
          stats['stat-ton-kendaraan'] += tonase;
        }
      }
    });
  });

  // TONASE KOMODITI = ALL bongkar tonnage - vehicle tonnage
  stats['stat-ton-bongkar'] = totalBongkarTonase - stats['stat-ton-kendaraan'];

  // Update UI
  Object.keys(mapping).forEach(key => {
    const el = document.getElementById(key);
    if (el) el.textContent = fmt(stats[key] || 0);
  });
}

function resetSearch() {
  closeAllFilterPanels();
  document.getElementById('searchInput').value = '';
  document.getElementById('routeSelect').selectedIndex = 0;

  FILTER_TYPES.forEach(filterType => {
    selectedFilters[filterType].clear();
    document.getElementById(getFilterDomId(filterType, 'Search')).value = '';
  });

  Object.values(DATE_FIELD_IDS).forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });

  Object.values(TONNAGE_FIELD_IDS).forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });

  // Uncheck all checkboxes
  document.querySelectorAll('.options-list input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  FILTER_TYPES.forEach(filterType => {
    updateFilterDisplay(filterType);
    populateExcelFilter(filterType, allFilterOptions[filterType]);
  });

  performSearch();
}

function renderCurrentPage() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const pageData = filteredData.slice(startIndex, endIndex);

  pageData.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50';
    row.forEach((cell, i) => {
      const td = document.createElement('td');
      td.className = "px-6 py-4 whitespace-nowrap border-b border-gray-100 text-gray-700 align-top";
      if (isDetailColumn(dbColumns[i])) {
        td.innerHTML = formatDetailJSON(cell);
      } else {
        td.textContent = cell !== null && cell !== undefined ? cell : '-';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  document.getElementById('start-row').innerText = totalItems === 0 ? 0 : startIndex + 1;
  document.getElementById('end-row').innerText = endIndex;
  document.getElementById('page-indicator').innerText = `Halaman ${currentPage} dari ${totalPages || 1}`;
  document.getElementById('btnPrev').disabled = currentPage <= 1;
  document.getElementById('btnNext').disabled = currentPage >= totalPages;
}

function changePage(direction) {
  currentPage += direction;
  renderCurrentPage();
}

function formatDetailJSON(jsonInput) {
  if (!jsonInput) return '<span class="text-gray-400">-</span>';
  const data = parseDetailPayload(jsonInput);
  if (!data) {
    return `<span class="text-gray-500 text-xs truncate max-w-[200px] inline-block">${jsonInput}</span>`;
  }

  let html = '<div class="flex flex-col gap-3 min-w-[300px] max-w-[500px]">';
  let hasContent = false;
  if (data.BONGKAR && Array.isArray(data.BONGKAR) && data.BONGKAR.length > 0) {
    hasContent = true;
    html += `<div class="bg-green-50 p-2 rounded border border-green-200 shadow-sm"><div class="flex items-center gap-1 mb-1"><span class="text-xs font-bold text-green-800 bg-green-200 px-2 py-0.5 rounded">BONGKAR</span></div><table class="w-full sub-table bg-white"><thead><tr><th>Komoditi</th><th>Jenis</th><th class="text-right">Ton</th><th class="text-right">Unit</th></tr></thead><tbody>${data.BONGKAR.map(item => `<tr><td class="font-medium text-gray-700">${item.KOMODITIBONGKAR || '-'}</td><td class="text-xs text-gray-500">${item.JENISBONGKAR || '-'}</td><td class="text-right font-mono">${item.TONBONGKAR || '0'}</td><td class="text-right font-mono">${item.UNITBONGKAR || '0'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (data.MUAT && Array.isArray(data.MUAT) && data.MUAT.length > 0) {
    hasContent = true;
    html += `<div class="bg-blue-50 p-2 rounded border border-blue-200 shadow-sm"><div class="flex items-center gap-1 mb-1"><span class="text-xs font-bold text-blue-800 bg-blue-200 px-2 py-0.5 rounded">MUAT</span></div><table class="w-full sub-table bg-white"><thead><tr><th>Komoditi</th><th>Jenis</th><th class="text-right">Ton</th><th class="text-right">Unit</th></tr></thead><tbody>${data.MUAT.map(item => `<tr><td class="font-medium text-gray-700">${item.KOMODITIMUAT || '-'}</td><td class="text-xs text-gray-500">${item.JENISMUAT || '-'}</td><td class="text-right font-mono">${item.TONMUAT || '0'}</td><td class="text-right font-mono">${item.UNITMUAT || '0'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  html += '</div>';
  return hasContent ? html : '<span class="text-gray-400 italic">-</span>';
}

function showLoading(isLoading, text = "Memproses...") {
  const el = document.getElementById('status');
  document.getElementById('status-text').innerText = text;
  if (isLoading) el.classList.remove('hidden'); else el.classList.add('hidden');
}

function showError(msg) {
  const el = document.getElementById('error');
  el.innerHTML = `<strong>Error:</strong> ${msg}`;
  el.classList.remove('hidden');
}
function hideError() { document.getElementById('error').classList.add('hidden'); }

