import { offlineApiFetch } from "./offlineApi";

export async function coachRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  return await offlineApiFetch({ input: url, url, method, headers: new Headers(), options: { body: body === undefined ? undefined : JSON.stringify(body) } }) as T;
}
