import * as SQLite from 'expo-sqlite';

export type Conta = {
    ID_CT: number;
    DESCRICAO_CT: string;
    VALOR_CT: number;
    VENCIMENTO_CT: string; // AAAA-MM-DD
    PAGO_CT: number; // 0 ou 1
};

// Abre (ou cria) o banco de dados local
async function Banco() {
    return SQLite.openDatabaseAsync('ContasAPagar.db');
}

async function createTable(db: SQLite.SQLiteDatabase) {
    await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS CONTA (
            ID_CT INTEGER PRIMARY KEY AUTOINCREMENT,
            DESCRICAO_CT VARCHAR(100) NOT NULL,
            VALOR_CT REAL NOT NULL,
            VENCIMENTO_CT TEXT NOT NULL,
            PAGO_CT INTEGER NOT NULL DEFAULT 0
        );
    `);
}

async function insertConta(db: SQLite.SQLiteDatabase, descricao: string, valor: number, vencimento: string, pago: number) {
    await db.runAsync(
        'INSERT INTO CONTA (DESCRICAO_CT, VALOR_CT, VENCIMENTO_CT, PAGO_CT) VALUES (?, ?, ?, ?)',
        descricao, valor, vencimento, pago);
}

// Paginação: LIMIT/OFFSET direto no SQLite
async function selectContasPagina(db: SQLite.SQLiteDatabase, pagina: number, porPagina: number) {
    return db.getAllAsync<Conta>(
        'SELECT * FROM CONTA ORDER BY VENCIMENTO_CT ASC, ID_CT ASC LIMIT ? OFFSET ?',
        porPagina, (pagina - 1) * porPagina);
}

async function countContas(db: SQLite.SQLiteDatabase) {
    const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM CONTA');
    return row?.total ?? 0;
}

async function updateConta(db: SQLite.SQLiteDatabase, id: number, descricao: string, valor: number, vencimento: string, pago: number) {
    await db.runAsync(
        'UPDATE CONTA SET DESCRICAO_CT = ?, VALOR_CT = ?, VENCIMENTO_CT = ?, PAGO_CT = ? WHERE ID_CT = ?',
        descricao, valor, vencimento, pago, id);
}

async function deleteConta(db: SQLite.SQLiteDatabase, id: number) {
    await db.runAsync('DELETE FROM CONTA WHERE ID_CT = ?', id);
}

export { Banco, createTable, insertConta, selectContasPagina, countContas, updateConta, deleteConta };
