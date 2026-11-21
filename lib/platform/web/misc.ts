import type { DeepLinks, Files, Haptics, LocalStore, PermissionState, PushNotifications, Purchases, Share, StatusBar } from "../types";

export class WebPush implements PushNotifications {
  isSupported() {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }
  async requestPermission(): Promise<PermissionState> {
    if (!this.isSupported()) return "unsupported";
    return (await Notification.requestPermission()) as PermissionState;
  }
  async getToken() {
    if (!this.isSupported() || Notification.permission !== "granted") return null;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? JSON.stringify(sub) : null;
  }
  async subscribe(applicationServerKey: string) {
    if (!this.isSupported() || Notification.permission !== "granted") return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      const pad = "=".repeat((4 - (applicationServerKey.length % 4)) % 4);
      const raw = atob((applicationServerKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      return JSON.stringify(sub);
    } catch { return null; }
  }
}

/** IndexedDB with an in-memory fallback (private windows, tests). */
export class WebLocalStore implements LocalStore {
  private mem = new Map<string, unknown>();
  private db: Promise<IDBDatabase | null> | null = null;

  private open(): Promise<IDBDatabase | null> {
    this.db ??= new Promise((resolve) => {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open("professor-filipe", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return this.db;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise((resolve) => {
      try {
        const req = fn(db.transaction("kv", mode).objectStore("kv"));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.mem.has(key)) return this.mem.get(key) as T;
    return ((await this.tx("readonly", (s) => s.get(key))) as T | undefined) ?? null;
  }
  async set<T>(key: string, value: T) {
    this.mem.set(key, value);
    await this.tx("readwrite", (s) => s.put(value, key));
  }
  async remove(key: string) {
    this.mem.delete(key);
    await this.tx("readwrite", (s) => s.delete(key));
  }
}

export class WebShare implements Share {
  canShare() {
    return typeof navigator !== "undefined" && (!!navigator.share || !!navigator.clipboard);
  }
  canShareFiles() {
    if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
    try { return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }); } catch { return false; }
  }
  async share(data: { title?: string; text?: string; url?: string; file?: { name: string; blob: Blob } }) {
    if (typeof navigator === "undefined") return "unavailable" as const;
    if (navigator.share) {
      try {
        const { file, ...rest } = data;
        const files = file && this.canShareFiles() ? [new File([file.blob], file.name, { type: file.blob.type || "image/png" })] : undefined;
        await navigator.share(files ? { ...rest, files } : rest);
        return "shared" as const;
      } catch {
        return "unavailable" as const;
      }
    }
    if (navigator.clipboard && data.url) {
      await navigator.clipboard.writeText(data.url);
      return "copied" as const;
    }
    return "unavailable" as const;
  }
}

export class WebFiles implements Files {
  async save(name: string, data: Blob) {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export class WebDeepLinks implements DeepLinks {
  onOpen() {
    return () => {};
  }
  currentUrl() {
    return typeof window === "undefined" ? "" : window.location.href;
  }
}

export class WebPurchases implements Purchases {
  async openCheckout(checkoutUrl: string) {
    window.location.assign(checkoutUrl);
  }
}

export class WebHaptics implements Haptics {
  impact(style: "light" | "medium" | "heavy" = "light") {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(style === "heavy" ? 30 : style === "medium" ? 20 : 10);
  }
}

export class WebStatusBar implements StatusBar {
  setStyle() {}
}
