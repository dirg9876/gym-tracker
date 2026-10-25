import { registerHooks } from "node:module";
export const storage = new Map();
export const secureStorage = new Map();
globalThis.__offlineTestStorage = storage;
globalThis.__secureTestStorage = secureStorage;
const mockStorage = "data:text/javascript," + encodeURIComponent(`
  const fault = (operation, key, phase) => globalThis.__storageFault?.({ operation, key, phase });
  export default {
    async getItem(key) { fault('getItem', key, 'before'); return globalThis.__offlineTestStorage.get(key) ?? null; },
    async setItem(key, value) {
      fault('setItem', key, 'before');
      globalThis.__offlineTestStorage.set(key, value);
      fault('setItem', key, 'after');
    },
    async removeItem(key) {
      fault('removeItem', key, 'before');
      globalThis.__offlineTestStorage.delete(key);
      fault('removeItem', key, 'after');
    },
    async getAllKeys() { return [...globalThis.__offlineTestStorage.keys()]; },
    async multiGet(keys) { return keys.map(key => [key, globalThis.__offlineTestStorage.get(key) ?? null]); },
    async multiSet(entries) {
      for (const [key, value] of entries) {
        fault('multiSet', key, 'before');
        globalThis.__offlineTestStorage.set(key, value);
        fault('multiSet', key, 'after');
        if (globalThis.__failMultiSetOnce) {
          globalThis.__failMultiSetOnce = false;
          throw new Error('Simulated interrupted write');
        }
      }
    },
    async multiRemove(keys) {
      for (const key of keys) {
        fault('multiRemove', key, 'before');
        globalThis.__offlineTestStorage.delete(key);
        fault('multiRemove', key, 'after');
        if (globalThis.__failMultiRemoveOnce) {
          globalThis.__failMultiRemoveOnce = false;
          throw new Error('Simulated interrupted removal');
        }
      }
    }
  };
`);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (["./equipmentSettings", "./trainingInsights", "./exerciseReplacement", "./trainingAnalysis", "./trainingPrediction", "./dailyWorkout", "./adaptiveWorkout", "./relatedLoads", "./bodyWeight", "./exerciseOutlook", "./exerciseAnatomy", "./muscleWorkload", "./setEditing", "./format", "./workoutRecap"].includes(specifier)) return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    if (specifier === "expo-secure-store") return {
      url: "data:text/javascript," + encodeURIComponent(`
        export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
        export async function getItemAsync(key) { await globalThis.__secureStorageFault?.('get', key); return globalThis.__secureTestStorage.get(key) ?? null; }
        export async function setItemAsync(key, value) { await globalThis.__secureStorageFault?.('set', key); globalThis.__secureTestStorage.set(key, value); }
        export async function deleteItemAsync(key) { await globalThis.__secureStorageFault?.('delete', key); globalThis.__secureTestStorage.delete(key); }
      `), shortCircuit: true,
    };
    if (specifier === "expo-crypto") return {
      url: "data:text/javascript," + encodeURIComponent(`
        import { createHash } from 'node:crypto';
        export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
        export async function digestStringAsync(algorithm, value) { return createHash('sha256').update(value).digest('hex'); }
      `), shortCircuit: true,
    };
    if (["./progressStorage", "./progressBackup", "./automaticBackupState", "./workoutMeasurement", "./workoutTemplates", "./workoutDraft", "./exerciseStandards", "./levelProgress", "./trainingCoach", "./aiCoachContext", "./aiCoachConnection", "./aiCoachCredentials", "./aiCoachPlan", "./coachApi", "./coachMonth"].includes(specifier)) return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    return specifier === "@react-native-async-storage/async-storage"
      ? { url: mockStorage, shortCircuit: true }
      : nextResolve(specifier, context);
  },
});
const { offlineApiFetch } = await import("../lib/offlineApi.ts");

export const request = (url, method = "GET", body) => offlineApiFetch({
  input: url, url, method, headers: new Headers(),
  options: { body: body === undefined ? undefined : JSON.stringify(body) },
});
