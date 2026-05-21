const CACHE_DB_NAME = 'inaport-client-database-cache';
const CACHE_DB_VERSION = 1;
const FILE_STORE_NAME = 'files';

let cacheDbPromise = null;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openCacheDb() {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (cacheDbPromise) return cacheDbPromise;

  cacheDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        db.createObjectStore(FILE_STORE_NAME, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cache database sedang digunakan oleh tab lain.'));
  });

  return cacheDbPromise;
}

async function withFileStore(mode, callback) {
  const db = await openCacheDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, mode);
    const store = transaction.objectStore(FILE_STORE_NAME);
    let requestResult;

    transaction.oncomplete = () => resolve(requestResult);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    const request = callback(store);
    request.onsuccess = () => {
      requestResult = request.result;
    };
    request.onerror = () => reject(request.error);
  });
}

async function readCacheRecord(cacheKey) {
  try {
    return await withFileStore('readonly', store => store.get(cacheKey));
  } catch (error) {
    console.warn('Gagal membaca cache browser:', error);
    return null;
  }
}

async function writeCacheRecord(record) {
  try {
    await withFileStore('readwrite', store => store.put(record));
    return true;
  } catch (error) {
    console.warn('Gagal menyimpan cache browser:', error);
    return false;
  }
}

function getCacheKey(path) {
  try {
    const baseUrl = globalThis.location?.href;
    return baseUrl ? new URL(path, baseUrl).href : path;
  } catch (_error) {
    return path;
  }
}

function getFileName(fileInfo, path) {
  if (typeof fileInfo === 'object' && fileInfo?.name) return fileInfo.name;

  try {
    const url = new URL(path, globalThis.location?.href);
    return decodeURIComponent(url.pathname.split('/').pop() || path);
  } catch (_error) {
    return decodeURIComponent(String(path).split('/').pop() || path);
  }
}

function normalizeHeader(value) {
  return value ? String(value).trim() : '';
}

function metadataFromResponse(response) {
  return {
    etag: normalizeHeader(response.headers.get('etag')),
    lastModified: normalizeHeader(response.headers.get('last-modified')),
    contentLength: normalizeHeader(response.headers.get('content-length'))
  };
}

function mergeMetadata(primary = {}, fallback = {}) {
  return {
    etag: normalizeHeader(primary.etag || fallback.etag),
    lastModified: normalizeHeader(primary.lastModified || fallback.lastModified),
    contentLength: normalizeHeader(primary.contentLength || fallback.contentLength)
  };
}

function createFingerprint(metadata = {}) {
  return [
    normalizeHeader(metadata.etag),
    normalizeHeader(metadata.lastModified),
    normalizeHeader(metadata.contentLength)
  ].filter(Boolean).join('|');
}

function attachFingerprint(metadata = {}) {
  const normalized = mergeMetadata(metadata);
  return {
    ...normalized,
    fingerprint: createFingerprint(normalized)
  };
}

export async function fetchRemoteFileMetadata(path) {
  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-cache' });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        validationUnavailable: response.status === 405 || response.status === 501,
        metadata: null
      };
    }

    const metadata = attachFingerprint(metadataFromResponse(response));
    return {
      ok: true,
      status: response.status,
      validationUnavailable: !metadata.fingerprint,
      metadata
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      validationUnavailable: true,
      metadata: null,
      error
    };
  }
}

function getRecordFingerprint(record) {
  return record?.metadata?.fingerprint || record?.fingerprint || '';
}

function canUseCachedRecord(record, remote) {
  if (!record?.arrayBuffer || record.arrayBuffer.byteLength === 0) return false;

  if (remote.ok && remote.metadata?.fingerprint) {
    return getRecordFingerprint(record) === remote.metadata.fingerprint;
  }

  return Boolean(remote.error || remote.validationUnavailable);
}

async function downloadArrayBuffer(path, name, fallbackMetadata = null) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Gagal mengunduh ${name} (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const metadata = attachFingerprint(mergeMetadata(metadataFromResponse(response), fallbackMetadata));

  return {
    arrayBuffer,
    metadata
  };
}

export async function fetchCachedArrayBuffer(fileInfo) {
  const path = typeof fileInfo === 'string' ? fileInfo : fileInfo?.path;
  if (!path) throw new Error('Path database tidak valid.');

  const name = getFileName(fileInfo, path);
  const cacheKey = getCacheKey(path);
  const cachedRecord = await readCacheRecord(cacheKey);
  const remote = await fetchRemoteFileMetadata(path);

  if (cachedRecord && canUseCachedRecord(cachedRecord, remote)) {
    const source = remote.ok ? 'cache' : 'cache-stale';
    return {
      fileInfo: typeof fileInfo === 'object' ? fileInfo : { path, name },
      arrayBuffer: cachedRecord.arrayBuffer,
      metadata: cachedRecord.metadata || null,
      source,
      cacheKey
    };
  }

  const wasInvalidated = Boolean(
    cachedRecord &&
    remote.ok &&
    remote.metadata?.fingerprint &&
    getRecordFingerprint(cachedRecord) !== remote.metadata.fingerprint
  );
  const downloaded = await downloadArrayBuffer(path, name, remote.metadata);
  const cacheStored = await writeCacheRecord({
    cacheKey,
    path,
    name,
    metadata: downloaded.metadata,
    fingerprint: downloaded.metadata.fingerprint,
    arrayBuffer: downloaded.arrayBuffer,
    savedAt: new Date().toISOString()
  });

  return {
    fileInfo: typeof fileInfo === 'object' ? fileInfo : { path, name },
    arrayBuffer: downloaded.arrayBuffer,
    metadata: downloaded.metadata,
    source: wasInvalidated ? 'network-updated' : 'network',
    wasInvalidated,
    cacheStored,
    cacheKey
  };
}
