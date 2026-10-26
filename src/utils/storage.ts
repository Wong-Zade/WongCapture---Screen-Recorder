import { RecordedClip } from '../types';

const DB_NAME = 'wincapture_clips_db';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveClipToDB(clip: RecordedClip): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Save serializable clip data (blob can be stored in IndexedDB natively)
    const item = {
      id: clip.id,
      title: clip.title,
      timestamp: clip.timestamp,
      duration: clip.duration,
      blob: clip.blob,
      thumbnailUrl: clip.thumbnailUrl,
      format: clip.format,
      sizeBytes: clip.sizeBytes,
      width: clip.width,
      height: clip.height,
      fps: clip.fps,
    };

    store.put(item);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save clip to IndexedDB:', err);
  }
}

export async function getAllClipsFromDB(): Promise<RecordedClip[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const records = request.result || [];
        const clips: RecordedClip[] = records.map((r: any) => ({
          ...r,
          url: URL.createObjectURL(r.blob),
        }));
        // Sort newest first
        clips.sort((a, b) => b.timestamp - a.timestamp);
        resolve(clips);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to get clips from IndexedDB:', err);
    return [];
  }
}

export async function deleteClipFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete clip from IndexedDB:', err);
  }
}

export async function updateClipTitleInDB(id: string, newTitle: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const item = request.result;
      if (item) {
        item.title = newTitle;
        store.put(item);
      }
    };
  } catch (err) {
    console.warn('Failed to update clip title in DB:', err);
  }
}
