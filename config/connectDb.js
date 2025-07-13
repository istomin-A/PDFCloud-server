// config/db.js
import sql from 'mssql';

const config = {
    user: 'CloudSA0a679907',
    password: 'ABer2f5e.wr',
    server: 'pdfcloud.database.windows.net',
    database: 'PDFCloud',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
}

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