import express from 'express';
import cors from 'cors';
import { sql, poolPromise } from './config/connectDb.js';
import { addUser } from './config/userOperations.js';
import multer from 'multer';


const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const PORT = 3000;

app.use(cors());

app.use(express.json());

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
    try {
        const users = await poolPromise;
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Создать нового пользователя (POST)
app.post('/api/users', async (req, res) => {
    try {
        const newUser = req.body;
        const addedUser = await addUser(newUser);
        res.status(201).json(addedUser);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка при создании пользователя' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await poolPromise;  // берём уже подключённый пул
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT id, password FROM users WHERE username = @username');

        if (result.recordset.length === 0) {
            return res.json({ success: false, message: 'Пользователь не найден' });
        }

        const user = result.recordset[0];

        if (user.password === password) {
            return res.json({ success: true, message: 'Успешный вход', userId: user.id });
        } else {
            return res.json({ success: false, message: 'Неверный пароль' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/adminLogin', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .query(`
        SELECT Id, Username
        FROM AdminUsers
        WHERE Username = @username AND Password = @password
      `);

        if (result.recordset.length === 0) {
            return res.json({ success: false, message: 'Неверный логин или пароль' });
        }

        const admin = result.recordset[0];
        return res.json({ success: true, message: 'Вход успешен', admin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
        const pool = await poolPromise;
        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname;

        await pool.request()
            .input('FileName', sql.NVarChar(sql.MAX), fileName)
            .input('FileData', sql.VarBinary(sql.MAX), fileBuffer)
            .query(`
                INSERT INTO Documents (FileName, FileData, UploadedAt)
                VALUES (@FileName, @FileData, GETDATE())
            `);

        res.json({ success: true, message: 'Файл успешно загружен в таблицу Documents' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка при загрузке PDF' });
    }
});

app.get('/api/pdf/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const id = req.params.id;

        const result = await pool.request()
            .input('DocumentId', sql.Int, id)
            .query('SELECT FileName, FileData FROM Documents WHERE DocumentId = @DocumentId');

        if (result.recordset.length === 0) {
            return res.status(404).send('Документ не найден');
        }

        const file = result.recordset[0];

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${file.FileName}"`,
        });

        res.send(file.FileData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при получении PDF');
    }
});


app.get('/api/pdf/:id/download', async (req, res) => {
    const pool = await poolPromise;
    const id = req.params.id;

    const result = await pool.request()
        .input('DocumentId', sql.Int, id)
        .query('SELECT FileName, FileData FROM Documents WHERE DocumentId = @DocumentId');

    if (result.recordset.length === 0) {
        return res.status(404).send('Документ не найден');
    }

    const file = result.recordset[0];

    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file.FileName}"`,
    });

    res.send(file.FileData);
});


app.get('/api/documents', async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .query('SELECT DocumentId, FileName, UploadedAt FROM Documents ORDER BY UploadedAt DESC');

        res.json(result.recordset); // Массив документов с метаданными
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка при получении списка документов' });
    }
});

app.post('/api/admin/add-user', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Нужны username и password' });
        }

        const pool = await poolPromise;

        await pool.request()
            .input('Username', sql.NVarChar, username)
            .input('Password', sql.NVarChar, password)
            .query(`
                INSERT INTO Users (Username, Password)
                VALUES (@Username, @Password)
            `);

        res.json({ success: true, message: 'Пользователь добавлен' });
    } catch (err) {
        console.error(err);

        if (err.originalError?.info?.number === 2627) {
            return res.status(409).json({ success: false, message: 'Пользователь уже существует' });
        }

        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.delete('/api/admin/delete-user/:username', async (req, res) => {
    try {
        const username = req.params.username;

        if (!username) {
            return res.status(400).json({ success: false, message: 'Username обязателен' });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('Username', sql.NVarChar, username)
            .query(`DELETE FROM Users WHERE Username = @Username`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }

        res.json({ success: true, message: `Пользователь "${username}" удалён` });

    } catch (err) {
        console.error('Ошибка при удалении пользователя:', err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.put('/api/admin/update-user/:username', async (req, res) => {
    try {
        const oldUsername = req.params.username;
        const { newUsername, newPassword } = req.body;

        if (!oldUsername) {
            return res.status(400).json({ success: false, message: 'Username обязателен' });
        }

        if (!newUsername && !newPassword) {
            return res.status(400).json({ success: false, message: 'Нужно хотя бы новое имя или новый пароль' });
        }

        const pool = await poolPromise;

        // Формируем запрос обновления в зависимости от переданных данных
        let query = 'UPDATE Users SET ';
        const inputs = [];

        if (newUsername) {
            query += 'Username = @newUsername';
            inputs.push({ name: 'newUsername', value: newUsername });
        }
        if (newPassword) {
            if (inputs.length) query += ', ';
            query += 'Password = @newPassword';
            inputs.push({ name: 'newPassword', value: newPassword });
        }
        query += ' WHERE Username = @oldUsername';

        const request = pool.request();
        request.input('oldUsername', sql.NVarChar, oldUsername);
        inputs.forEach(input => request.input(input.name, sql.NVarChar, input.value));

        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }

        res.json({ success: true, message: 'Данные пользователя обновлены' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.get('/api/users/search', async (req, res) => {
    const { login } = req.query;

    if (!login) {
        return res.status(400).json({ success: false, message: 'Не указан параметр login' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Login', sql.NVarChar, `%${login}%`)
            .query(`
                SELECT id, Username, password
                FROM Users
                WHERE Username LIKE @Login
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка при поиске' });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'API работает' });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});