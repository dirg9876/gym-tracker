import { DatabaseSync } from "node:sqlite";
import { SqlCoachLedger, type LedgerDatabase } from "./ledgerCore.ts";
export { CoachHttpError } from "./ledgerCore.ts";

export class CoachLedger extends SqlCoachLedger {
  private database: DatabaseSync;
  constructor(filename: string, limitNanoUsd = 5_000_000_000, now = () => Date.now()) {
    const database = new DatabaseSync(filename);
    database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    const backend: LedgerDatabase = {
      exec: sql => { database.exec(sql); },
      prepare: sql => database.prepare(sql),
      transaction: action => {
        database.exec("BEGIN IMMEDIATE");
        try { const result = action(); database.exec("COMMIT"); return result; }
        catch (error) { database.exec("ROLLBACK"); throw error; }
      },
    };
    try { super(backend, limitNanoUsd, now); } catch (error) { database.close(); throw error; }
    this.database = database;
  }
  close() { this.database.close(); }
}
