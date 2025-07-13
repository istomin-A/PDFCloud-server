// config/db.js
import sql from 'mssql/msnodesqlv8.js';

const config = {
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=localhost\\SQLEXPRESS;Database=PDFCloud;Trusted_Connection=Yes;'
};

// экспортируем пул соединений
const poolPromise = sql.connect(config)
    .then(pool => {
        console.log('MSSQL подключение установлено');
        return pool;
    })
    .catch(err => {
        console.error('Ошибка подключения к MSSQL:', err);
    });

export { sql, poolPromise };