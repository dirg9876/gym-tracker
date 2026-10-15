export type LedgerDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...bindings: (string | number | null)[]): Record<string, unknown> | undefined;
    run(...bindings: (string | number | null)[]): unknown;
  };
  transaction<T>(action: () => T): T;
};

export class CoachHttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export class SqlCoachLedger {
  private db: LedgerDatabase;
  private limitNanoUsd: number;
  private now: () => number;
  constructor(database: LedgerDatabase, limitNanoUsd = 5_000_000_000, now = () => Date.now()) {
    this.limitNanoUsd = limitNanoUsd;
    this.now = now;
    if (!Number.isSafeInteger(limitNanoUsd) || limitNanoUsd <= 0 || limitNanoUsd > 5_000_000_000) throw new Error("Invalid coach budget");
    this.db = database;
    this.db.exec(`CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, month TEXT NOT NULL,
        created INTEGER NOT NULL, status TEXT NOT NULL,
        reserve INTEGER NOT NULL, cost INTEGER, result TEXT
      );`);
  }
  budget() {
    const row = this.db.prepare("SELECT COALESCE(SUM(cost),0) AS used, COALESCE(SUM(CASE WHEN cost IS NULL THEN reserve ELSE 0 END),0) AS reserved FROM requests WHERE month=?").get(this.month()) as { used: number; reserved: number };
    return { limitUsd: this.limitNanoUsd / 1e9, usedUsd: row.used / 1e9, reservedUsd: row.reserved / 1e9 };
  }
  reserve(id: string, fingerprint: string, reserve: number): string | null {
    if (!Number.isSafeInteger(reserve) || reserve <= 0) throw new Error("Invalid cost reservation");
    return this.db.transaction(() => {
      const existing = this.db.prepare("SELECT * FROM requests WHERE id=?").get(id) as { fingerprint: string; status: string; result: string } | undefined;
      if (existing && existing.fingerprint !== fingerprint) throw new CoachHttpError(409, "Идентификатор запроса уже использован для других данных.");
      const cached = this.db.prepare("SELECT result FROM requests WHERE fingerprint=? AND status='completed' AND month=? LIMIT 1").get(fingerprint, this.month()) as { result: string } | undefined;
      if (cached) return cached.result;
      if (existing) throw new CoachHttpError(409, "Запрос уже обработан или его результат неизвестен. Повтор возможен только новым действием.");
      if (this.db.prepare("SELECT id FROM requests WHERE fingerprint=? AND status='pending' LIMIT 1").get(fingerprint)) throw new CoachHttpError(409, "Такой анализ уже выполняется. Дождитесь ответа.");
      const recent = this.db.prepare("SELECT count(*) AS n FROM requests WHERE created>?").get(this.now() - 60000) as { n: number };
      if (recent.n >= 6) throw new CoachHttpError(429, "Слишком много запросов. Подождите минуту.");
      const pending = this.db.prepare("SELECT count(*) AS n FROM requests WHERE status='pending'").get() as { n: number };
      if (pending.n >= 2) throw new CoachHttpError(409, "Дождитесь завершения текущих запросов.");
      const budget = this.budget();
      if (Math.round((budget.usedUsd + budget.reservedUsd) * 1e9) + reserve > this.limitNanoUsd) throw new CoachHttpError(402, "Месячный лимит ИИ исчерпан. Дневник продолжает работать.");
      this.db.prepare("INSERT INTO requests(id,fingerprint,month,created,status,reserve) VALUES(?,?,?,?,?,?)").run(id, fingerprint, this.month(), this.now(), "pending", reserve);
      return null;
    });
  }
  complete(id: string, cost: number, result: string | null) {
    if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("Invalid actual usage");
    this.db.prepare("UPDATE requests SET status=?,cost=?,result=? WHERE id=? AND status='pending'").run(result ? "completed" : "failed", cost, result, id);
  }
  storeValidated(id: string, result: string) {
    this.db.prepare("UPDATE requests SET status='completed',result=? WHERE id=? AND status='failed' AND cost IS NOT NULL").run(result, id);
  }
  fail(id: string) {
    // A lost upstream acknowledgement is not evidence of zero spend.
    this.db.prepare("UPDATE requests SET status='failed' WHERE id=? AND status='pending'").run(id);
  }
  recoverInterrupted() { this.db.prepare("UPDATE requests SET status='failed' WHERE status='pending'").run(); }
  private month() { return new Date(this.now()).toISOString().slice(0, 7); }
}
