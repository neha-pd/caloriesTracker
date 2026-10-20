export type Row = { kind: string; id: string; owner: string; value: any };
export class Store {
  rows: Map<string, Row>;
  dirty = new Map<string, Row | null>();
  constructor(rows: Row[] = []) {
    this.rows = new Map(
      rows.map((r) => [this.key(r.kind, r.id), structuredCloneJson(r)]),
    );
  }
  key(kind: string, id: string) {
    return kind + ":" + id;
  }
  get(kind: string, id: string) {
    return this.rows.get(this.key(kind, id));
  }
  list(kind: string, owner: string) {
    return [...this.rows.values()]
      .filter((r) => r.kind === kind && r.owner === owner)
      .map((r) => r.value);
  }
  put(kind: string, id: string, owner: string, value: any) {
    const r = { kind, id, owner, value: structuredCloneJson(value) },
      k = this.key(kind, id);
    this.rows.set(k, r);
    this.dirty.set(k, r);
    return r.value;
  }
  remove(kind: string, id: string) {
    const k = this.key(kind, id);
    this.rows.delete(k);
    this.dirty.set(k, null);
  }
  removeOwner(owner: string) {
    for (const r of this.rows.values())
      if (r.owner === owner) this.remove(r.kind, r.id);
  }
}
export const structuredCloneJson = <T>(v: T): T =>
  JSON.parse(JSON.stringify(v));
export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
