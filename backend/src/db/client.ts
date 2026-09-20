import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;

export const db = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  types: {
    // DATE columns are calendar days, not instants. postgres.js parses them to
    // a JS Date at UTC midnight by default, which serialises to an ISO
    // timestamp ("2026-09-14T00:00:00.000Z") that clients can't treat as a
    // day key. Keep them as plain 'YYYY-MM-DD' strings end to end.
    dateOnly: {
      to: 1082,
      from: [1082],
      serialize: (x: string) => x,
      parse: (x: string) => x,
    },
  },
});

export default db;
