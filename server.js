const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const usersFile = path.join(dataDir, 'users.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, '[]', 'utf8');
  }
}

function readUsers() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeUsers(users) {
  ensureDataFile();
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/register' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { fullname, email, username, password, confirmPassword } = body;

      if (!fullname || !email || !username || !password || !confirmPassword) {
        return sendJson(res, 400, { ok: false, message: 'Completa todos los campos.' });
      }

      if (password !== confirmPassword) {
        return sendJson(res, 400, { ok: false, message: 'Las contraseñas no coinciden.' });
      }

      const users = readUsers();
      const existing = users.find(user => user.username === username || user.email === email);
      if (existing) {
        return sendJson(res, 409, { ok: false, message: 'Ya existe un usuario con ese correo o nombre de usuario.' });
      }

      users.push({ fullname, email, username, password });
      writeUsers(users);
      return sendJson(res, 201, { ok: true, message: 'Cuenta creada correctamente.' });
    } catch (error) {
      return sendJson(res, 400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, password } = body;

      if (!username || !password) {
        return sendJson(res, 400, { ok: false, message: 'Completa tus credenciales.' });
      }

      const users = readUsers();
      const isAdmin = username === 'admin' && password === 'admin';
      const user = users.find(item => item.username === username && item.password === password);

      if (isAdmin || user) {
        return sendJson(res, 200, { ok: true, user: { username, fullname: user?.fullname || 'Administrador', email: user?.email || 'admin@teknova.local' } });
      }

      return sendJson(res, 401, { ok: false, message: 'Usuario o contraseña incorrectos.' });
    } catch (error) {
      return sendJson(res, 400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (pathname === '/api/recover' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { userOrEmail, newPassword, confirmNewPassword } = body;

      if (!userOrEmail || !newPassword || !confirmNewPassword) {
        return sendJson(res, 400, { ok: false, message: 'Completa todos los campos.' });
      }

      if (newPassword !== confirmNewPassword) {
        return sendJson(res, 400, { ok: false, message: 'Las contraseñas no coinciden.' });
      }

      const users = readUsers();
      const user = users.find(item => item.username === userOrEmail || item.email === userOrEmail);
      if (!user) {
        return sendJson(res, 404, { ok: false, message: 'No se encontró una cuenta con ese usuario o correo.' });
      }

      user.password = newPassword;
      writeUsers(users);
      return sendJson(res, 200, { ok: true, message: 'Contraseña actualizada.' });
    } catch (error) {
      return sendJson(res, 400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, message: 'Servidor activo' });
  }

  let filePath = path.join(rootDir, pathname);
  if (pathname.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath);
  }

  const fallbackPath = path.join(rootDir, 'index.html');
  return sendFile(res, fallbackPath);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
