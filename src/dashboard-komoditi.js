import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';

const DB_FOLDER = './database/';
const FILE_PREFIX = 'Data ';
const FILE_SUFFIX = '.parquet';
const MIN_SCAN_YEAR = 2000;
const MAX_SCAN_AHEAD = 20;
const TEMP_FILE_NAME = 'dashboard_temp.parquet';
const MAX_OPTION_RENDER = 250;
const FILE_PREFETCH_CONCURRENCY = 3;
const COLOR_PALETTE = [
  '#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#ef4444', '#e11d48',
  '#9333ea', '#6366f1', '#06b6d4', '#10b981', '#f97316', '#8b5cf6', '#3b82f6', '#0f766e'
];

const FILTER_META = {
  commodity: {
    suffix: 'Commodity',
    allLabel: 'Semua Komoditi',
    activeLabel: 'Komoditi'
  },
  category: {
    suffix: 'Category',
    allLabel: 'Semua Kategori',
    activeLabel: 'Kategori'
  },
  jenisKapal: {
    suffix: 'JenisKapal',
    allLabel: 'Semua Jenis Kapal',
    activeLabel: 'Jenis Kapal'
  },
  kapal: {
    suffix: 'Kapal',
    allLabel: 'Semua Kapal',
    activeLabel: 'Kapal'
  },
  berangkatKe: {
    suffix: 'BerangkatKe',
    allLabel: 'Semua Keberangkatan',
    activeLabel: 'Pelabuhan Berangkat'
  },
  tibaDari: {
    suffix: 'TibaDari',
    allLabel: 'Semua Tiba dari',
    activeLabel: 'Pelabuhan Tiba dari'
  },
  trayek: {
    suffix: 'Trayek',
    allLabel: 'Semua Trayek',
    activeLabel: 'Trayek'
  },
  jenisMuatanBongkar: {
    suffix: 'JenisMuatanBongkar',
    allLabel: 'Semua Jenis Muatan Datang',
    activeLabel: 'Muatan Datang'
  },
  jenisMuatanMuat: {
    suffix: 'JenisMuatanMuat',
    allLabel: 'Semua Jenis Muatan Berangkat',
    activeLabel: 'Muatan Berangkat'
  }
};

const FILTER_TYPES = Object.keys(FILTER_META);

const COLUMN_ALIASES = {
  kapal: ['KAPAL', 'NAMA KAPAL', 'SHIP NAME'],
  jenisKapal: ['JENIS KAPAL', 'JENISKAPAL'],
  berangkatKe: ['BERANGKAT KE', 'PELABUHAN BERANGKAT', 'BERANGKAT_KE'],
  tibaDari: ['TIBA DARI', 'PELABUHAN KEDATANGAN', 'TIBA_DARI'],
  trayek: ['TRAYEK', 'LINTASAN', 'RUTE'],
  tibaTanggal: ['TIBA TANGGAL', 'TANGGAL TIBA'],
  berangkatTanggal: ['BERANGKAT TANGGAL', 'TANGGAL BERANGKAT']
};

const DIRECT_FILTER_TYPES = ['jenisKapal', 'kapal', 'berangkatKe', 'tibaDari', 'trayek'];
const ITEM_FILTER_TYPES = ['commodity', 'category', 'jenisMuatanBongkar', 'jenisMuatanMuat'];

let db = null;
let conn = null;
let allTrips = [];
let availableFiles = [];
let availableYears = [];
let comparisonChart = null;
let trendLineChart = null;
let defaultYearStart = null;
let defaultYearEnd = null;
let filterOptions = createFilterState(() => []);
let selectedFilters = createFilterState(() => new Set());
let applyFilterSequence = 0;
let applyFilterFrame = null;
let applyFilterTimeout = null;
let currentShipTripStats = [];
let currentShipTripYears = [];
let shipTripCurrentPage = 1;
let shipTripRowsPerPage = 10;

function byId(id) {
  return document.getElementById(id);
}

function createFilterState(factory) {
  return Object.fromEntries(FILTER_TYPES.map(filterType => [filterType, factory(filterType)]));
}

function getFilterDomId(filterType, part) {
  return `filter${FILTER_META[filterType].suffix}${part}`;
}

function debounce(callback, delay = 250) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

function normalizeColumnName(value = '') {
  return String(value).toUpperCase().replace(/[_\s]/g, '');
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeLabel(value, fallback = '-') {
  const text = toText(value);
  return text || fallback;
}

function parseNumberOrZero(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateOnly(value) {
  if (!value) return '';

  const textValue = String(value).trim();
  const datePart = textValue.includes(' ') ? textValue.split(' ')[0] : textValue;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  const parsedDate = new Date(textValue);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return parsedDate.toISOString().slice(0, 10);
}

function formatNumber(value, fractionDigits = 2) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  });
}

function appendItems(target, source) {
  for (let i = 0; i < source.length; i++) {
    target.push(source[i]);
  }
}

function truncateText(text, maxLength = 24) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function showStatus(text, visible = true) {
  const statusEl = byId('status');
  const statusTextEl = byId('statusText');
  if (!statusEl || !statusTextEl) return;

  statusTextEl.textContent = text;
  if (visible) {
    statusEl.classList.remove('hidden');
  } else {
    statusEl.classList.add('hidden');
  }
}

function showError(message = '') {
  const errorEl = byId('error');
  if (!errorEl) return;

  if (!message) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    return;
  }

  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function setFieldValue(id, value) {
  const el = byId(id);
  if (el) el.value = value;
}

function setApplyFilterIndicator(isApplying) {
  const indicator = byId('applyFilterIndicator');
  if (!indicator) return;

  if (isApplying) {
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

function createColumnLookup(columns = []) {
  const lookup = new Map();
  columns.forEach(columnName => {
    const normalized = normalizeColumnName(columnName);
    if (!lookup.has(normalized)) {
      lookup.set(normalized, columnName);
    }
  });
  return lookup;
}

function readValueByAliases(row, columnLookup, aliases = []) {
  for (const alias of aliases) {
    const columnName = columnLookup.get(normalizeColumnName(alias));
    if (!columnName) continue;
    const rawValue = row[columnName];
    const textValue = toText(rawValue);
    if (textValue) return rawValue;
  }
  return '';
}

function parseDetailPayload(value) {
  if (!value) return null;

  try {
    let parsed = typeof value === 'object' ? value : JSON.parse(value);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function extractDirectionalItems(detail, direction) {
  const itemKey = direction === 'BONGKAR' ? 'BONGKAR' : 'MUAT';
  const commodityKey = direction === 'BONGKAR' ? 'KOMODITIBONGKAR' : 'KOMODITIMUAT';
  const categoryKey = direction === 'BONGKAR' ? 'JENISBONGKAR' : 'JENISMUAT';
  const tonKey = direction === 'BONGKAR' ? 'TONBONGKAR' : 'TONMUAT';
  const unitKey = direction === 'BONGKAR' ? 'UNITBONGKAR' : 'UNITMUAT';

  const sourceItems = Array.isArray(detail?.[itemKey]) ? detail[itemKey] : [];
  const output = [];

  sourceItems.forEach(rawItem => {
    const commodityRaw = toText(rawItem?.[commodityKey]);
    const categoryRaw = toText(rawItem?.[categoryKey]);
    const ton = parseNumberOrZero(rawItem?.[tonKey]);
    const unit = parseNumberOrZero(rawItem?.[unitKey]);

    if (!commodityRaw && !categoryRaw && ton === 0 && unit === 0) {
      return;
    }

    output.push({
      direction,
      commodity: commodityRaw || 'Tidak Diketahui',
      category: categoryRaw || 'Tanpa Kategori',
      ton,
      unit
    });
  });

  return output;
}

function mapRawRowToTrip(rawRow, year, columnLookup, detailColumnName) {
  const kapal = toText(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.kapal));
  const jenisKapal = toText(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.jenisKapal));
  const berangkatKe = toText(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.berangkatKe));
  const tibaDari = toText(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.tibaDari));
  const trayekRaw = toText(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.trayek));
  const tibaTanggal = parseDateOnly(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.tibaTanggal));
  const berangkatTanggal = parseDateOnly(readValueByAliases(rawRow, columnLookup, COLUMN_ALIASES.berangkatTanggal));

  const detailPayload = detailColumnName ? rawRow[detailColumnName] : null;
  const detail = parseDetailPayload(detailPayload);
  const bongkarItems = extractDirectionalItems(detail, 'BONGKAR');
  const muatItems = extractDirectionalItems(detail, 'MUAT');
  const allItems = [...bongkarItems, ...muatItems];
  const bongkarTon = bongkarItems.reduce((acc, item) => acc + item.ton, 0);
  const muatTon = muatItems.reduce((acc, item) => acc + item.ton, 0);

  const inferredTrayek = trayekRaw || [berangkatKe, tibaDari].filter(Boolean).join(' - ');

  return {
    year,
    kapal,
    jenisKapal,
    berangkatKe,
    tibaDari,
    trayek: inferredTrayek,
    tibaTanggal,
    berangkatTanggal,
    bongkarTon,
    muatTon,
    bongkarItems,
    muatItems,
    allItems
  };
}

function addOption(optionSet, value) {
  const normalized = toText(value);
  if (!normalized) return;
  optionSet.add(normalized);
}

function collectFilterOptions(trips = []) {
  const optionSets = createFilterState(() => new Set());

  trips.forEach(trip => {
    addOption(optionSets.jenisKapal, trip.jenisKapal);
    addOption(optionSets.kapal, trip.kapal);
    addOption(optionSets.berangkatKe, trip.berangkatKe);
    addOption(optionSets.tibaDari, trip.tibaDari);
    addOption(optionSets.trayek, trip.trayek);

    trip.allItems.forEach(item => {
      addOption(optionSets.commodity, item.commodity);
      addOption(optionSets.category, item.category);
      if (item.direction === 'BONGKAR') {
        addOption(optionSets.jenisMuatanBongkar, item.category);
      }
      if (item.direction === 'MUAT') {
        addOption(optionSets.jenisMuatanMuat, item.category);
      }
    });
  });

  FILTER_TYPES.forEach(filterType => {
    filterOptions[filterType] = Array.from(optionSets[filterType]).sort((a, b) => a.localeCompare(b, 'id'));
  });
}

function getYearsFromFiles(files = []) {
  return [...new Set(files.map(file => file.year))].sort((a, b) => a - b);
}

function fillYearSelects(years = []) {
  const yearStartEl = byId('yearStart');
  const yearEndEl = byId('yearEnd');

  yearStartEl.innerHTML = '';
  yearEndEl.innerHTML = '';

  years.forEach(year => {
    const optionStart = document.createElement('option');
    optionStart.value = String(year);
    optionStart.textContent = String(year);

    const optionEnd = document.createElement('option');
    optionEnd.value = String(year);
    optionEnd.textContent = String(year);

    yearStartEl.appendChild(optionStart);
    yearEndEl.appendChild(optionEnd);
  });

  if (years.length > 0) {
    defaultYearStart = years[0];
    defaultYearEnd = years[years.length - 1];
    yearStartEl.value = String(defaultYearStart);
    yearEndEl.value = String(defaultYearEnd);
  } else {
    defaultYearStart = null;
    defaultYearEnd = null;
  }
}

function clearAllSelectedFilters() {
  FILTER_TYPES.forEach(filterType => {
    selectedFilters[filterType].clear();
  });
}

function clearFilterSearchInputs() {
  FILTER_TYPES.forEach(filterType => {
    const searchInput = byId(getFilterDomId(filterType, 'Search'));
    if (searchInput) searchInput.value = '';
  });
}

function closeAllFilterPanels() {
  FILTER_TYPES.forEach(filterType => {
    const panel = byId(getFilterDomId(filterType, 'Panel'));
    const trigger = byId(getFilterDomId(filterType, 'Trigger'));

    if (panel) panel.classList.add('hidden');
    if (trigger) {
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function getRenderableOptions(filterType) {
  const searchInput = byId(getFilterDomId(filterType, 'Search'));
  const searchTerm = (searchInput?.value || '').trim().toLowerCase();
  const allValues = filterOptions[filterType] || [];
  const matchedValues = searchTerm
    ? allValues.filter(value => value.toLowerCase().includes(searchTerm))
    : allValues;

  return {
    total: allValues.length,
    matched: matchedValues.length,
    allMatchedValues: matchedValues,
    values: matchedValues.slice(0, MAX_OPTION_RENDER),
    truncated: matchedValues.length > MAX_OPTION_RENDER
  };
}

function updateFilterDisplay(filterType) {
  const labelEl = byId(getFilterDomId(filterType, 'Label'));
  const countEl = byId(getFilterDomId(filterType, 'Count'));
  const triggerEl = byId(getFilterDomId(filterType, 'Trigger'));

  if (!labelEl || !countEl || !triggerEl) return;

  const selectedSet = selectedFilters[filterType];
  const selectedCount = selectedSet.size;
  const totalCount = filterOptions[filterType]?.length || 0;

  if (selectedCount === 0) {
    labelEl.textContent = `${FILTER_META[filterType].allLabel} (${totalCount})`;
    countEl.classList.add('hidden');
    triggerEl.classList.remove('active');
    return;
  }

  const sortedSelected = Array.from(selectedSet).sort((a, b) => a.localeCompare(b, 'id'));
  if (selectedCount === 1) {
    labelEl.textContent = truncateText(sortedSelected[0], 32);
  } else {
    labelEl.textContent = `${FILTER_META[filterType].activeLabel} (${selectedCount})`;
  }

  countEl.textContent = String(selectedCount);
  countEl.classList.remove('hidden');
  triggerEl.classList.add('active');
}

function renderFilterOptions(filterType) {
  const optionsContainer = byId(getFilterDomId(filterType, 'Options'));
  if (!optionsContainer) return;

  const { matched, values, truncated } = getRenderableOptions(filterType);
  optionsContainer.innerHTML = '';

  if (matched === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = 'Tidak ada data';
    optionsContainer.appendChild(empty);
    return;
  }

  if (truncated) {
    const meta = document.createElement('div');
    meta.className = 'meta-results';
    meta.textContent = `Menampilkan ${values.length} dari ${matched} hasil. Ketik kata kunci untuk mempersempit.`;
    optionsContainer.appendChild(meta);
  }

  values.forEach(value => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.checked = selectedFilters[filterType].has(value);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedFilters[filterType].add(value);
      } else {
        selectedFilters[filterType].delete(value);
      }

      updateFilterDisplay(filterType);
      applyFiltersAndRender();
    });

    const text = document.createTextNode(value);
    label.appendChild(checkbox);
    label.appendChild(text);
    optionsContainer.appendChild(label);
  });
}

function setupSearchableFilterEvents() {
  FILTER_TYPES.forEach(filterType => {
    const trigger = byId(getFilterDomId(filterType, 'Trigger'));
    const panel = byId(getFilterDomId(filterType, 'Panel'));
    const search = byId(getFilterDomId(filterType, 'Search'));
    const selectAll = byId(getFilterDomId(filterType, 'SelectAll'));
    const clearAll = byId(getFilterDomId(filterType, 'ClearAll'));

    if (!trigger || !panel || !search || !selectAll || !clearAll) return;

    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panel.id);

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const wasOpen = !panel.classList.contains('hidden');
      closeAllFilterPanels();

      if (!wasOpen) {
        panel.classList.remove('hidden');
        trigger.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        renderFilterOptions(filterType);
        search.focus({ preventScroll: true });
      }
    });

    search.addEventListener('input', () => {
      renderFilterOptions(filterType);
    });

    selectAll.addEventListener('click', () => {
      const searchTerm = (search.value || '').trim();
      if (!searchTerm) {
        // Empty selection means "all" for this filter.
        selectedFilters[filterType].clear();
      } else {
        const { allMatchedValues } = getRenderableOptions(filterType);
        allMatchedValues.forEach(value => selectedFilters[filterType].add(value));
      }

      updateFilterDisplay(filterType);
      renderFilterOptions(filterType);
      applyFiltersAndRender();
    });

    clearAll.addEventListener('click', () => {
      selectedFilters[filterType].clear();
      updateFilterDisplay(filterType);
      renderFilterOptions(filterType);
      applyFiltersAndRender();
    });

    updateFilterDisplay(filterType);
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.excel-filter-wrapper')) {
      closeAllFilterPanels();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeAllFilterPanels();
    }
  });
}

function refreshAllFilterPanels() {
  FILTER_TYPES.forEach(filterType => {
    updateFilterDisplay(filterType);
    renderFilterOptions(filterType);
  });
}

function getSimpleFilterState() {
  return {
    yearStart: Number(byId('yearStart')?.value || defaultYearStart || 0),
    yearEnd: Number(byId('yearEnd')?.value || defaultYearEnd || 0),
    direction: byId('directionFilter')?.value || 'ALL',
    metric: byId('metricFilter')?.value || 'ton',
    topN: Number(byId('topNFilter')?.value || 8),
    tibaStart: byId('tanggalTibaStart')?.value || '',
    tibaEnd: byId('tanggalTibaEnd')?.value || '',
    berangkatStart: byId('tanggalBerangkatStart')?.value || '',
    berangkatEnd: byId('tanggalBerangkatEnd')?.value || '',
    bongkarMin: parseNullableNumber(byId('jumlahBongkarMin')?.value),
    bongkarMax: parseNullableNumber(byId('jumlahBongkarMax')?.value),
    muatMin: parseNullableNumber(byId('jumlahMuatMin')?.value),
    muatMax: parseNullableNumber(byId('jumlahMuatMax')?.value)
  };
}

function isDateInRange(dateValue, startDate, endDate) {
  if (startDate && (!dateValue || dateValue < startDate)) return false;
  if (endDate && (!dateValue || dateValue > endDate)) return false;
  return true;
}

function isNumberInRange(value, minValue, maxValue) {
  if (minValue !== null && value < minValue) return false;
  if (maxValue !== null && value > maxValue) return false;
  return true;
}

function matchesSingleSelection(filterType, value) {
  const selected = selectedFilters[filterType];
  if (selected.size === 0) return true;
  const normalized = toText(value);
  return normalized ? selected.has(normalized) : false;
}

function hasActiveItemFilter() {
  return ITEM_FILTER_TYPES.some(filterType => selectedFilters[filterType].size > 0);
}

function getMatchedItemsForTrip(trip, filters) {
  const includeBongkar = filters.direction !== 'MUAT';
  const includeMuat = filters.direction !== 'BONGKAR';
  const matchedItems = [];

  const pushIfMatch = (item, directionalFilterType) => {
    if (selectedFilters.commodity.size > 0 && !selectedFilters.commodity.has(item.commodity)) return;
    if (selectedFilters.category.size > 0 && !selectedFilters.category.has(item.category)) return;
    if (selectedFilters[directionalFilterType].size > 0 && !selectedFilters[directionalFilterType].has(item.category)) return;
    matchedItems.push(item);
  };

  if (includeBongkar) {
    trip.bongkarItems.forEach(item => pushIfMatch(item, 'jenisMuatanBongkar'));
  }

  if (includeMuat) {
    trip.muatItems.forEach(item => pushIfMatch(item, 'jenisMuatanMuat'));
  }

  return matchedItems;
}

function applyAllFilters(filters) {
  const filteredTrips = [];
  const commodityRows = [];
  const itemFilterActive = hasActiveItemFilter();

  allTrips.forEach(trip => {
    if (filters.yearStart && trip.year < filters.yearStart) return;
    if (filters.yearEnd && trip.year > filters.yearEnd) return;

    if (!matchesSingleSelection('jenisKapal', trip.jenisKapal)) return;
    if (!matchesSingleSelection('kapal', trip.kapal)) return;
    if (!matchesSingleSelection('berangkatKe', trip.berangkatKe)) return;
    if (!matchesSingleSelection('tibaDari', trip.tibaDari)) return;
    if (!matchesSingleSelection('trayek', trip.trayek)) return;

    if (!isDateInRange(trip.tibaTanggal, filters.tibaStart, filters.tibaEnd)) return;
    if (!isDateInRange(trip.berangkatTanggal, filters.berangkatStart, filters.berangkatEnd)) return;

    if (!isNumberInRange(trip.bongkarTon, filters.bongkarMin, filters.bongkarMax)) return;
    if (!isNumberInRange(trip.muatTon, filters.muatMin, filters.muatMax)) return;

    if (filters.direction === 'BONGKAR' && trip.bongkarItems.length === 0) return;
    if (filters.direction === 'MUAT' && trip.muatItems.length === 0) return;

    const matchedItems = getMatchedItemsForTrip(trip, filters);
    if ((itemFilterActive || filters.direction !== 'ALL') && matchedItems.length === 0) {
      return;
    }

    filteredTrips.push({
      ...trip,
      matchedItems
    });

    matchedItems.forEach(item => {
      commodityRows.push({
        year: trip.year,
        direction: item.direction,
        commodity: item.commodity,
        category: item.category,
        ton: item.ton,
        unit: item.unit,
        kapal: trip.kapal
      });
    });
  });

  return {
    filteredTrips,
    commodityRows
  };
}

function buildYearAxis(yearStart, yearEnd) {
  const start = Number(yearStart);
  const end = Number(yearEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || start > end) {
    return [];
  }

  const years = [];
  for (let year = start; year <= end; year++) {
    years.push(year);
  }
  return years;
}

function aggregateYearly(filteredTrips, commodityRows, yearAxis, metric) {
  const yearMap = new Map();

  const ensureYear = (year) => {
    if (!yearMap.has(year)) {
      yearMap.set(year, {
        year,
        tripCount: 0,
        ton: 0,
        unit: 0,
        commoditySet: new Set(),
        commodityMetric: new Map()
      });
    }
    return yearMap.get(year);
  };

  yearAxis.forEach(year => ensureYear(year));

  filteredTrips.forEach(trip => {
    const bucket = ensureYear(trip.year);
    bucket.tripCount += 1;
  });

  commodityRows.forEach(item => {
    const bucket = ensureYear(item.year);
    bucket.ton += item.ton;
    bucket.unit += item.unit;
    bucket.commoditySet.add(item.commodity);

    const value = metric === 'ton' ? item.ton : item.unit;
    bucket.commodityMetric.set(item.commodity, (bucket.commodityMetric.get(item.commodity) || 0) + value);
  });

  return [...yearMap.values()].sort((a, b) => a.year - b.year);
}

function getTopCommodity(commodityMetricMap) {
  const entries = [...commodityMetricMap.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { name: '-', value: 0 };
  return {
    name: entries[0][0],
    value: entries[0][1]
  };
}

function buildShipTripStats(filteredTrips) {
  const shipMap = new Map();

  filteredTrips.forEach(trip => {
    const shipName = normalizeLabel(trip.kapal, 'Tanpa Nama Kapal');
    if (!shipMap.has(shipName)) {
      shipMap.set(shipName, {
        kapal: shipName,
        tripCount: 0,
        tripsByYear: new Map()
      });
    }

    const bucket = shipMap.get(shipName);
    bucket.tripCount += 1;
    bucket.tripsByYear.set(trip.year, (bucket.tripsByYear.get(trip.year) || 0) + 1);
  });

  return [...shipMap.values()]
    .map(item => ({
      kapal: item.kapal,
      tripCount: item.tripCount,
      tripsByYear: Object.fromEntries(
        [...item.tripsByYear.entries()].sort((a, b) => a[0] - b[0])
      )
    }))
    .sort((a, b) => {
      if (b.tripCount !== a.tripCount) return b.tripCount - a.tripCount;
      return a.kapal.localeCompare(b.kapal, 'id');
    });
}

function renderYearlyTable(yearlyData) {
  const tbody = byId('yearlyTableBody');
  tbody.innerHTML = '';

  if (yearlyData.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="7" class="px-4 py-8 text-center text-slate-500">Tidak ada data untuk filter saat ini.</td>';
    tbody.appendChild(row);
    byId('tableMeta').textContent = '0 tahun';
    return;
  }

  yearlyData.forEach((yearData, index) => {
    const row = document.createElement('tr');
    row.className = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';

    row.innerHTML = `
      <td class="px-4 py-3 font-semibold text-slate-800">${yearData.year}</td>
      <td class="px-4 py-3 text-right font-medium text-slate-700">${formatNumber(yearData.tripCount, 0)}</td>
      <td class="px-4 py-3 text-right font-medium text-slate-700">${formatNumber(yearData.ton)}</td>
      `;
      // <td class="px-4 py-3 text-right font-medium text-slate-700">${formatNumber(yearData.unit, 0)}</td>
      // <td class="px-4 py-3 text-right text-slate-700">${yearData.commoditySet.size}</td>
      // <td class="px-4 py-3 text-slate-700">${topCommodity.name}</td>
      // <td class="px-4 py-3 text-right text-slate-700">${formatNumber(topCommodity.value, metric === 'ton' ? 2 : 0)}</td>

    tbody.appendChild(row);
  });

  byId('tableMeta').textContent = `${yearlyData.length} tahun`;
}

function renderShipTripTable(shipStats, options = {}) {
  const { resetPage = false, years = currentShipTripYears } = options;
  const tbody = byId('shipTripTableBody');
  const headerRow = byId('shipTripHeaderRow');
  const table = byId('shipTripTable');
  if (!tbody) return;

  if (Array.isArray(shipStats)) {
    currentShipTripStats = shipStats;
  }
  currentShipTripYears = Array.isArray(years) ? years : [];
  if (resetPage) {
    shipTripCurrentPage = 1;
  }

  if (headerRow) {
    headerRow.innerHTML = `
      <th class="px-4 py-3 text-left">Nama Kapal</th>
      <th class="px-4 py-3 text-right">Total Trip</th>
      ${currentShipTripYears.map(year => `<th class="px-4 py-3 text-right">${year}</th>`).join('')}
    `;
  }

  if (table) {
    const minWidth = 320 + (Math.max(currentShipTripYears.length, 1) * 120);
    table.style.minWidth = `${minWidth}px`;
  }

  tbody.innerHTML = '';

  const totalItems = currentShipTripStats.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / shipTripRowsPerPage));
  if (shipTripCurrentPage < 1) shipTripCurrentPage = 1;
  if (shipTripCurrentPage > totalPages) shipTripCurrentPage = totalPages;

  const startIndex = (shipTripCurrentPage - 1) * shipTripRowsPerPage;
  const endIndex = Math.min(startIndex + shipTripRowsPerPage, totalItems);
  const pageItems = currentShipTripStats.slice(startIndex, endIndex);

  if (totalItems === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="${Math.max(2 + currentShipTripYears.length, 3)}" class="px-4 py-8 text-center text-slate-500">Tidak ada data trip kapal pada filter saat ini.</td>`;
    tbody.appendChild(row);
    byId('shipTripMeta').textContent = '0 kapal';
  } else {
    pageItems.forEach((ship, index) => {
      const row = document.createElement('tr');
      row.className = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
      const yearCells = currentShipTripYears
        .map(year => `<td class="px-4 py-3 text-right text-slate-700">${formatNumber(ship.tripsByYear[year] || 0, 0)}</td>`)
        .join('');

      row.innerHTML = `
      <td class="px-4 py-3 font-medium text-slate-800">${ship.kapal}</td>
      <td class="px-4 py-3 text-right font-semibold text-slate-700">${formatNumber(ship.tripCount, 0)}</td>
      ${yearCells}
    `;

      tbody.appendChild(row);
    });

    byId('shipTripMeta').textContent = `${totalItems} kapal`;
  }

  const startEl = byId('shipTripStart');
  const endEl = byId('shipTripEnd');
  const totalEl = byId('shipTripTotal');
  const pageIndicatorEl = byId('shipTripPageIndicator');
  const prevBtn = byId('shipTripPrev');
  const nextBtn = byId('shipTripNext');

  if (startEl) startEl.textContent = totalItems === 0 ? '0' : String(startIndex + 1);
  if (endEl) endEl.textContent = String(endIndex);
  if (totalEl) totalEl.textContent = String(totalItems);
  if (pageIndicatorEl) pageIndicatorEl.textContent = `Halaman ${shipTripCurrentPage} dari ${totalPages}`;
  if (prevBtn) prevBtn.disabled = shipTripCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = shipTripCurrentPage >= totalPages;
}

function registerShipTripPaginationEvents() {
  const rowsPerPageEl = byId('shipTripRowsPerPage');
  if (rowsPerPageEl) {
    rowsPerPageEl.addEventListener('change', () => {
      const selected = Number(rowsPerPageEl.value);
      shipTripRowsPerPage = Number.isFinite(selected) && selected > 0 ? selected : 10;
      shipTripCurrentPage = 1;
      renderShipTripTable(currentShipTripStats);
    });
  }

  const prevBtn = byId('shipTripPrev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      shipTripCurrentPage -= 1;
      renderShipTripTable(currentShipTripStats);
    });
  }

  const nextBtn = byId('shipTripNext');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      shipTripCurrentPage += 1;
      renderShipTripTable(currentShipTripStats);
    });
  }
}

function buildCommodityBarDatasets(commodityRows, yearAxis, metric, topN) {
  const totalByCommodity = new Map();

  commodityRows.forEach(item => {
    const value = metric === 'ton' ? item.ton : item.unit;
    totalByCommodity.set(item.commodity, (totalByCommodity.get(item.commodity) || 0) + value);
  });

  const topCommodities = [...totalByCommodity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(entry => entry[0]);

  const yearCommodityMap = new Map();
  commodityRows.forEach(item => {
    if (!topCommodities.includes(item.commodity)) return;
    const value = metric === 'ton' ? item.ton : item.unit;
    const key = `${item.year}|${item.commodity}`;
    yearCommodityMap.set(key, (yearCommodityMap.get(key) || 0) + value);
  });

  return topCommodities.map((commodity, index) => ({
    type: 'bar',
    label: commodity,
    data: yearAxis.map(year => yearCommodityMap.get(`${year}|${commodity}`) || 0),
    backgroundColor: COLOR_PALETTE[index % COLOR_PALETTE.length],
    borderRadius: 5,
    borderSkipped: false,
    yAxisID: 'yMetric'
  }));
}

function renderComparisonChart(commodityRows, yearlyData, yearAxis, filters) {
  const emptyEl = byId('comparisonChartEmpty');
  const canvas = byId('comparisonChart');

  if (comparisonChart) {
    comparisonChart.destroy();
    comparisonChart = null;
  }

  const hasCommodityData = commodityRows.length > 0;
  if (!hasCommodityData || yearAxis.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const metricLabel = filters.metric === 'ton' ? 'Tonase (Ton)' : 'Unit';
  const barDatasets = buildCommodityBarDatasets(commodityRows, yearAxis, filters.metric, filters.topN);
  const totalMetricData = yearlyData.map(item => (filters.metric === 'ton' ? item.ton : item.unit));
  const totalTripData = yearlyData.map(item => item.tripCount);

  const datasets = [...barDatasets];

  if (filters.metric === 'ton') {
    datasets.push({
      type: 'line',
      label: `Tren Total ${metricLabel}`,
      data: totalMetricData,
      borderColor: '#0f766e',
      backgroundColor: 'rgba(15, 118, 110, 0.14)',
      borderWidth: 2.5,
      pointRadius: 3,
      tension: 0.25,
      yAxisID: 'yMetric'
    });
  }

  datasets.push({
      type: 'line',
      label: 'Tren Jumlah Trip',
      data: totalTripData,
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 3,
      tension: 0.25,
      yAxisID: 'yTrip'
    });

  comparisonChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: yearAxis,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 14,
            boxHeight: 14
          }
        },
        tooltip: {
          callbacks: {
            label: context => {
              const isTripDataset = context.dataset.yAxisID === 'yTrip';
              const digits = isTripDataset ? 0 : (filters.metric === 'ton' ? 2 : 0);
              const unitLabel = isTripDataset ? 'trip' : (filters.metric === 'ton' ? 'ton' : 'unit');
              return `${context.dataset.label}: ${formatNumber(context.parsed.y, digits)} ${unitLabel}`;
            }
          }
        }
      },
      scales: {
        yMetric: {
          beginAtZero: true,
          position: 'left',
          title: {
            display: true,
            text: metricLabel
          },
          ticks: {
            callback: value => formatNumber(value, filters.metric === 'ton' ? 2 : 0)
          }
        },
        yTrip: {
          beginAtZero: true,
          position: 'right',
          title: {
            display: true,
            text: 'Jumlah Trip'
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: value => formatNumber(value, 0)
          }
        },
        x: {
          title: {
            display: true,
            text: 'Tahun'
          }
        }
      }
    }
  });
}

function renderTrendChart(yearlyData, yearAxis, filters) {
  const emptyEl = byId('trendChartEmpty');
  const canvas = byId('trendLineChart');

  if (trendLineChart) {
    trendLineChart.destroy();
    trendLineChart = null;
  }

  const hasData = yearlyData.some(item => item.tripCount > 0 || item.ton > 0 || item.unit > 0);
  if (!hasData || yearAxis.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const metricLabel = filters.metric === 'ton' ? 'Tonase (Ton)' : 'Unit';
  const metricSeries = yearlyData.map(item => (filters.metric === 'ton' ? item.ton : item.unit));
  const tripSeries = yearlyData.map(item => item.tripCount);

  trendLineChart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: yearAxis,
      datasets: [
        {
          label: `Total ${metricLabel}`,
          data: metricSeries,
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29, 78, 216, 0.12)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: true,
          yAxisID: 'yMetric'
        },
        {
          label: 'Jumlah Trip',
          data: tripSeries,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.14)',
          borderWidth: 2.2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
          yAxisID: 'yTrip'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        yMetric: {
          beginAtZero: true,
          position: 'left',
          title: {
            display: true,
            text: metricLabel
          },
          ticks: {
            callback: value => formatNumber(value, filters.metric === 'ton' ? 2 : 0)
          }
        },
        yTrip: {
          beginAtZero: true,
          position: 'right',
          title: {
            display: true,
            text: 'Jumlah Trip'
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: value => formatNumber(value, 0)
          }
        }
      }
    }
  });
}

function updateSummary(filteredTrips, commodityRows, yearlyData, filters) {
  const totalTon = commodityRows.reduce((acc, item) => acc + item.ton, 0);
  const totalTrips = filteredTrips.length;
  const uniqueCommodities = new Set(commodityRows.map(item => item.commodity)).size;
  const uniqueShips = new Set(filteredTrips.map(trip => normalizeLabel(trip.kapal, 'Tanpa Nama Kapal'))).size;

  byId('summaryDbCount').textContent = String(availableFiles.length);

  if (filters.yearStart && filters.yearEnd) {
    const yearCount = filters.yearEnd - filters.yearStart + 1;
    byId('summaryYearCoverage').textContent = `${filters.yearStart} - ${filters.yearEnd} (${yearCount} tahun)`;
  } else {
    byId('summaryYearCoverage').textContent = '-';
  }

  byId('summaryTotalTon').textContent = formatNumber(totalTon);
  byId('summaryTotalTrips').textContent = formatNumber(totalTrips, 0);

  const activeYearRows = yearlyData.filter(item => item.tripCount > 0 || item.ton > 0 || item.unit > 0).length;
  byId('chartMeta').textContent = `${uniqueCommodities} komoditi unik | ${uniqueShips} kapal | ${activeYearRows} tahun aktif`;
}

function countActiveFilters(filters) {
  let total = FILTER_TYPES.filter(filterType => selectedFilters[filterType].size > 0).length;

  if (defaultYearStart !== null && defaultYearEnd !== null) {
    if (filters.yearStart !== defaultYearStart || filters.yearEnd !== defaultYearEnd) {
      total += 1;
    }
  }

  if (filters.direction !== 'ALL') total += 1;
  if (filters.tibaStart || filters.tibaEnd) total += 1;
  if (filters.berangkatStart || filters.berangkatEnd) total += 1;
  if (
    filters.bongkarMin !== null || filters.bongkarMax !== null ||
    filters.muatMin !== null || filters.muatMax !== null
  ) {
    total += 1;
  }

  return total;
}

function updateActiveFilterSummary(filters) {
  const chip = byId('activeFilterSummary');
  const resetBtn = byId('resetFiltersBtn');
  if (!chip || !resetBtn) return;

  const activeCount = countActiveFilters(filters);
  if (activeCount > 0) {
    chip.textContent = `${activeCount} filter aktif`;
    chip.classList.add('is-active');
  } else {
    chip.textContent = 'Belum ada filter aktif';
    chip.classList.remove('is-active');
  }

  resetBtn.disabled = activeCount === 0;
}

function applyFiltersAndRenderImmediate() {
  const filters = getSimpleFilterState();

  if (filters.yearStart && filters.yearEnd && filters.yearStart > filters.yearEnd) {
    filters.yearEnd = filters.yearStart;
    byId('yearEnd').value = String(filters.yearEnd);
  }

  const { filteredTrips, commodityRows } = applyAllFilters(filters);
  const yearAxis = buildYearAxis(filters.yearStart, filters.yearEnd);
  const yearlyData = aggregateYearly(filteredTrips, commodityRows, yearAxis, filters.metric);
  const shipTripStats = buildShipTripStats(filteredTrips);

  updateSummary(filteredTrips, commodityRows, yearlyData, filters);
  renderYearlyTable(yearlyData, filters.metric);
  renderShipTripTable(shipTripStats, { resetPage: true, years: yearAxis });
  renderComparisonChart(commodityRows, yearlyData, yearAxis, filters);
  renderTrendChart(yearlyData, yearAxis, filters);
  updateActiveFilterSummary(filters);
}

function applyFiltersAndRender() {
  const sequence = ++applyFilterSequence;
  setApplyFilterIndicator(true);

  if (applyFilterFrame !== null) {
    cancelAnimationFrame(applyFilterFrame);
    applyFilterFrame = null;
  }
  if (applyFilterTimeout !== null) {
    clearTimeout(applyFilterTimeout);
    applyFilterTimeout = null;
  }

  applyFilterFrame = requestAnimationFrame(() => {
    applyFilterFrame = null;

    // Let the browser paint loading indicator first before heavy filter computation.
    applyFilterTimeout = setTimeout(() => {
      applyFilterTimeout = null;
      if (sequence !== applyFilterSequence) return;

      try {
        applyFiltersAndRenderImmediate();
      } finally {
        if (sequence === applyFilterSequence) {
          setApplyFilterIndicator(false);
        }
      }
    }, 0);
  });
}

function resetAllFilters() {
  closeAllFilterPanels();
  clearAllSelectedFilters();
  clearFilterSearchInputs();

  if (defaultYearStart !== null && defaultYearEnd !== null) {
    setFieldValue('yearStart', String(defaultYearStart));
    setFieldValue('yearEnd', String(defaultYearEnd));
  }

  setFieldValue('directionFilter', 'ALL');
  setFieldValue('metricFilter', 'ton');
  setFieldValue('topNFilter', '8');

  setFieldValue('tanggalTibaStart', '');
  setFieldValue('tanggalTibaEnd', '');
  setFieldValue('tanggalBerangkatStart', '');
  setFieldValue('tanggalBerangkatEnd', '');
  setFieldValue('jumlahBongkarMin', '');
  setFieldValue('jumlahBongkarMax', '');
  setFieldValue('jumlahMuatMin', '');
  setFieldValue('jumlahMuatMax', '');

  refreshAllFilterPanels();
  applyFiltersAndRender();
}

function registerSimpleFilterEvents() {
  const triggerApplyIds = ['yearStart', 'yearEnd', 'directionFilter', 'metricFilter', 'topNFilter'];
  triggerApplyIds.forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener('change', applyFiltersAndRender);
  });

  const dateAndNumberIds = [
    'tanggalTibaStart', 'tanggalTibaEnd',
    'tanggalBerangkatStart', 'tanggalBerangkatEnd',
    'jumlahBongkarMin', 'jumlahBongkarMax',
    'jumlahMuatMin', 'jumlahMuatMax'
  ];

  const debouncedApply = debounce(() => applyFiltersAndRender(), 180);
  dateAndNumberIds.forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener('change', applyFiltersAndRender);
    el.addEventListener('input', debouncedApply);
  });

  const resetBtn = byId('resetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAllFilters);
  }
}

async function scanAvailableFiles() {
  const fromName = rawName => {
    const normalizedName = decodeURIComponent(String(rawName || '').trim());
    const match = normalizedName.match(/^Data\s+(\d{4})\.parquet$/i);
    if (!match) return null;

    const year = Number(match[1]);
    return {
      year,
      name: `${FILE_PREFIX}${year}${FILE_SUFFIX}`,
      path: `${DB_FOLDER}${FILE_PREFIX}${year}${FILE_SUFFIX}`
    };
  };

  try {
    const listingResponse = await fetch(DB_FOLDER, { method: 'GET' });
    if (listingResponse.ok) {
      const html = await listingResponse.text();
      const linkMatches = [...html.matchAll(/href=["']([^"']+\.parquet)["']/gi)];
      const records = [];
      const seen = new Set();

      linkMatches.forEach(match => {
        const hrefValue = match[1] || '';
        const fileName = hrefValue.split('/').pop() || '';
        const info = fromName(fileName);
        if (!info || seen.has(info.name)) return;

        seen.add(info.name);
        records.push(info);
      });

      if (records.length > 0) {
        return records.sort((a, b) => a.year - b.year);
      }
    }
  } catch (_error) {
    // Fallback to year-based probing
  }

  const maxYear = new Date().getFullYear() + MAX_SCAN_AHEAD;
  const checks = [];

  for (let year = maxYear; year >= MIN_SCAN_YEAR; year--) {
    const fileName = `${FILE_PREFIX}${year}${FILE_SUFFIX}`;
    const filePath = `${DB_FOLDER}${fileName}`;

    const check = fetch(filePath, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) return null;
        return {
          year,
          name: fileName,
          path: filePath
        };
      })
      .catch(() => null);

    checks.push(check);
  }

  const results = await Promise.all(checks);
  return results.filter(Boolean).sort((a, b) => a.year - b.year);
}

async function initDuckDb() {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
}

async function fetchFileBuffer(fileInfo) {
  const response = await fetch(fileInfo.path);
  if (!response.ok) {
    throw new Error(`Gagal mengunduh ${fileInfo.name} (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    fileInfo,
    arrayBuffer
  };
}

function getTempFileName(fileInfo) {
  return `${TEMP_FILE_NAME.replace('.parquet', '')}_${fileInfo.year}.parquet`;
}

async function prefetchFileBuffers(files, onProgress = () => {}) {
  const prefetched = new Array(files.length);
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const currentIndex = nextIndex++;
      prefetched[currentIndex] = await fetchFileBuffer(files[currentIndex]);
      completed += 1;
      onProgress(completed, files.length, files[currentIndex]);
    }
  };

  const workers = Array.from(
    { length: Math.min(FILE_PREFETCH_CONCURRENCY, files.length) },
    () => worker()
  );

  await Promise.all(workers);
  return prefetched;
}

async function extractTripsFromBuffer(fileInfo, arrayBuffer) {
  if (arrayBuffer.byteLength === 0) return [];

  const tempFileName = getTempFileName(fileInfo);
  await db.registerFileBuffer(tempFileName, new Uint8Array(arrayBuffer));
  const queryResult = await conn.query(`SELECT * FROM read_parquet('${tempFileName}')`);
  const rows = queryResult.toArray().map(row => row.toJSON());
  if (rows.length === 0) return [];

  const columns = Object.keys(rows[0]);
  const columnLookup = createColumnLookup(columns);
  const detailColumnName = columns.find(columnName => /DETAIL|BONGKAR_MUAT/i.test(String(columnName)));

  return rows.map(rawRow => mapRawRowToTrip(rawRow, fileInfo.year, columnLookup, detailColumnName));
}

async function loadAllTrips(files) {
  const loadedTrips = [];
  showStatus('Mengunduh database untuk mempercepat pemrosesan...');
  const prefetchedFiles = await prefetchFileBuffers(files, (completed, total, fileInfo) => {
    showStatus(`Mengunduh ${fileInfo.name} (${completed}/${total})...`);
  });

  for (let i = 0; i < prefetchedFiles.length; i++) {
    const { fileInfo, arrayBuffer } = prefetchedFiles[i];
    showStatus(`Memuat ${fileInfo.name} (${i + 1}/${files.length})...`);

    const fileTrips = await extractTripsFromBuffer(fileInfo, arrayBuffer);
    appendItems(loadedTrips, fileTrips);
  }

  return loadedTrips;
}

function applyLoadedDataToFilters() {
  availableYears = getYearsFromFiles(availableFiles);
  fillYearSelects(availableYears);

  collectFilterOptions(allTrips);
  clearAllSelectedFilters();
  clearFilterSearchInputs();
  refreshAllFilterPanels();
}

async function refreshDashboardData() {
  showError('');
  showStatus('Memindai file database...');

  availableFiles = await scanAvailableFiles();
  if (availableFiles.length === 0) {
    allTrips = [];
    availableYears = [];
    fillYearSelects([]);
    clearAllSelectedFilters();
    FILTER_TYPES.forEach(filterType => {
      filterOptions[filterType] = [];
    });
    refreshAllFilterPanels();
    applyFiltersAndRender();
    throw new Error('Tidak ada file Data YYYY.parquet yang ditemukan di folder database.');
  }

  showStatus('Memproses data operasional dari seluruh database...');
  allTrips = await loadAllTrips(availableFiles);

  applyLoadedDataToFilters();
  applyFiltersAndRender();
  showStatus('', false);
}

function registerGlobalActions() {
  const refreshBtn = byId('refreshDataBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        await refreshDashboardData();
      } catch (error) {
        showStatus('', false);
        showError(error.message || 'Gagal refresh data.');
      }
    });
  }
}

async function bootstrap() {
  try {
    setupSearchableFilterEvents();
    registerSimpleFilterEvents();
    registerShipTripPaginationEvents();
    registerGlobalActions();

    showStatus('Menyiapkan DuckDB...');
    await initDuckDb();
    await refreshDashboardData();
  } catch (error) {
    showStatus('', false);
    showError(error.message || 'Terjadi kesalahan saat memuat dashboard.');
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
