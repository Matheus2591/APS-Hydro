export type LocalStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};

// As gravações ficam em ordem; flush permite aguardar o disco antes de enviar à API.
export function createStorageQueue(storage: LocalStorage) {
  let writeQueue: Promise<unknown> = Promise.resolve();
  let lastWrite: Promise<unknown> = Promise.resolve();
  let readError: unknown;
  return {
    async getItem(key: string) {
      await writeQueue;
      try {
        const value = await storage.getItem(key);
        readError = undefined;
        return value;
      } catch (error) {
        readError = error;
        throw error;
      }
    },
    setItem(key: string, value: string) {
      lastWrite = writeQueue.then(() => {
        if (readError) throw readError;
        return storage.setItem(key, value);
      });
      writeQueue = lastWrite.catch(() => undefined);
      return writeQueue;
    },
    removeItem(key: string) {
      lastWrite = writeQueue.then(() => storage.removeItem(key));
      writeQueue = lastWrite.catch(() => undefined);
      return writeQueue;
    },
    flush: () => lastWrite,
    blockWrites: (error: unknown) => {
      readError = error;
    },
  };
}
