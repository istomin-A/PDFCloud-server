import { sql, poolPromise } from './connectDb.js';

async function addUser(user) {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('username', sql.NVarChar, user.username)
            .input('password', sql.NVarChar, user.password)
            .query(`
                INSERT INTO Users (username, password)
                VALUES (@username, @password);
                SELECT SCOPE_IDENTITY() AS id;
            `);

        const insertedId = result.recordset[0].id;

        return {
            id: insertedId,
            username: user.username,
            password: user.password
        };
    } catch (err) {
        console.error('Ошибка при добавлении пользователя в БД:', err);
        throw err;
    }
}

export { addUser }