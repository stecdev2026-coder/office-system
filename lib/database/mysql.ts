import 'server-only';
import { createPool, type Pool } from 'mysql2/promise';
const state = globalThis as typeof globalThis & { officeMySqlPool?: Pool };
export function mysqlPool() {
  if (!process.env.MYSQL_PASSWORD) throw new Error('MYSQL_NOT_CONFIGURED');
  if (!state.officeMySqlPool) state.officeMySqlPool = createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'office_app',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'office_trial',
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    waitForConnections: true,
    queueLimit: 200,
    connectTimeout: 5000,
    timezone: 'Z',
    charset: 'utf8mb4',
    multipleStatements: false,
  });
  return state.officeMySqlPool;
}
