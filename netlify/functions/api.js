const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
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

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  const pathParts = event.path.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];

  if (event.httpMethod === 'POST' && endpoint === 'register') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { fullname, email, username, password, confirmPassword } = body;

      if (!fullname || !email || !username || !password || !confirmPassword) {
        return jsonResponse(400, { ok: false, message: 'Completa todos los campos.' });
      }
      if (password !== confirmPassword) {
        return jsonResponse(400, { ok: false, message: 'Las contraseñas no coinciden.' });
      }

      const users = readUsers();
      const existing = users.find(user => user.username === username || user.email === email);
      if (existing) {
        return jsonResponse(409, { ok: false, message: 'Ya existe un usuario con ese correo o nombre de usuario.' });
      }

      users.push({ fullname, email, username, password });
      writeUsers(users);
      return jsonResponse(201, { ok: true, message: 'Cuenta creada correctamente.' });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (event.httpMethod === 'POST' && endpoint === 'login') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { username, password } = body;

      if (!username || !password) {
        return jsonResponse(400, { ok: false, message: 'Completa tus credenciales.' });
      }

      const users = readUsers();
      const isAdmin = username === 'admin' && password === 'admin';
      const user = users.find(item => item.username === username && item.password === password);

      if (isAdmin || user) {
        return jsonResponse(200, { ok: true, user: { username, fullname: user?.fullname || 'Administrador', email: user?.email || 'admin@teknova.local' } });
      }

      return jsonResponse(401, { ok: false, message: 'Usuario o contraseña incorrectos.' });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (event.httpMethod === 'POST' && endpoint === 'check-user') {
    try {
      const body = JSON.parse(event.body || '{}');
      const userOrEmail = (body.userOrEmail || '').trim();
      if (!userOrEmail) {
        return jsonResponse(400, { ok: false, message: 'Ingresa tu usuario o correo.' });
      }

      const users = readUsers();
      const user = users.find(item => item.username === userOrEmail || item.email === userOrEmail);
      if (!user) {
        return jsonResponse(404, { ok: false, message: 'No se encontró una cuenta con ese usuario o correo.' });
      }

      return jsonResponse(200, { ok: true, user: { username: user.username, email: user.email } });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (event.httpMethod === 'POST' && endpoint === 'recover') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { userOrEmail, newPassword, confirmNewPassword } = body;

      if (!userOrEmail || !newPassword || !confirmNewPassword) {
        return jsonResponse(400, { ok: false, message: 'Completa todos los campos.' });
      }
      if (newPassword !== confirmNewPassword) {
        return jsonResponse(400, { ok: false, message: 'Las contraseñas no coinciden.' });
      }

      const users = readUsers();
      const user = users.find(item => item.username === userOrEmail || item.email === userOrEmail);
      if (!user) {
        return jsonResponse(404, { ok: false, message: 'No se encontró una cuenta con ese usuario o correo.' });
      }

      user.password = newPassword;
      writeUsers(users);
      return jsonResponse(200, { ok: true, message: 'Contraseña actualizada.' });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  return jsonResponse(404, { ok: false, message: 'Endpoint no encontrado.' });
};
