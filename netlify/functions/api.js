const { getStore } = require('@netlify/blobs');

const MEMORY_USERS_KEY = '__teknovaUsers__';

function getMemoryUsers() {
  if (!globalThis[MEMORY_USERS_KEY]) {
    globalThis[MEMORY_USERS_KEY] = [];
  }
  return globalThis[MEMORY_USERS_KEY];
}

async function readUsers() {
  const memoryUsers = getMemoryUsers();

  try {
    const store = getStore({ name: 'teknova-users' });
    const data = await store.get('users.json');
    if (data) {
      const parsedUsers = JSON.parse(data);
      if (Array.isArray(parsedUsers)) {
        memoryUsers.splice(0, memoryUsers.length, ...parsedUsers);
        return parsedUsers;
      }
    }
  } catch (error) {
    // Fallback al almacenamiento en memoria si Netlify Blobs no está disponible.
  }

  return memoryUsers;
}

async function writeUsers(users) {
  const memoryUsers = getMemoryUsers();
  memoryUsers.splice(0, memoryUsers.length, ...users);

  try {
    const store = getStore({ name: 'teknova-users' });
    await store.set('users.json', JSON.stringify(users, null, 2));
  } catch (error) {
    // Si Netlify Blobs no está disponible, se mantiene en memoria para esta instancia.
  }
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

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  if (typeof event.body === 'object') {
    return event.body;
  }

  if (event.isBase64Encoded) {
    try {
      return JSON.parse(Buffer.from(event.body, 'base64').toString('utf8'));
    } catch (error) {
      return {};
    }
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    try {
      return JSON.parse(decodeURIComponent(event.body));
    } catch (decodeError) {
      return {};
    }
  }
}

function getEndpoint(event) {
  const rawPath = event.path || event.rawUrl || '';
  const normalizedPath = rawPath.replace(/^\/\.netlify\/functions\/api/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);
  return pathParts[pathParts.length - 1] || '';
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  const endpoint = getEndpoint(event);

  if (event.httpMethod === 'POST' && endpoint === 'register') {
    try {
      const body = parseBody(event);
      const { fullname, email, username, password, confirmPassword } = body;

      if (!fullname || !email || !username || !password || !confirmPassword) {
        return jsonResponse(400, { ok: false, message: 'Completa todos los campos.' });
      }
      if (password !== confirmPassword) {
        return jsonResponse(400, { ok: false, message: 'Las contraseñas no coinciden.' });
      }

      const users = await readUsers();
      const existing = users.find(user => user.username === username || user.email === email);
      if (existing) {
        return jsonResponse(409, { ok: false, message: 'Ya existe un usuario con ese correo o nombre de usuario.' });
      }

      users.push({ fullname, email, username, password });
      await writeUsers(users);
      return jsonResponse(201, { ok: true, message: 'Cuenta creada correctamente.' });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (event.httpMethod === 'POST' && endpoint === 'login') {
    try {
      const body = parseBody(event);
      const { username, password } = body;

      if (!username || !password) {
        return jsonResponse(400, { ok: false, message: 'Completa tus credenciales.' });
      }

      const users = await readUsers();
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
      const body = parseBody(event);
      const userOrEmail = (body.userOrEmail || '').trim();
      if (!userOrEmail) {
        return jsonResponse(400, { ok: false, message: 'Ingresa tu usuario o correo.' });
      }

      const users = await readUsers();
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
      const body = parseBody(event);
      const { userOrEmail, newPassword, confirmNewPassword } = body;

      if (!userOrEmail || !newPassword || !confirmNewPassword) {
        return jsonResponse(400, { ok: false, message: 'Completa todos los campos.' });
      }
      if (newPassword !== confirmNewPassword) {
        return jsonResponse(400, { ok: false, message: 'Las contraseñas no coinciden.' });
      }

      const users = await readUsers();
      const user = users.find(item => item.username === userOrEmail || item.email === userOrEmail);
      if (!user) {
        return jsonResponse(404, { ok: false, message: 'No se encontró una cuenta con ese usuario o correo.' });
      }

      user.password = newPassword;
      await writeUsers(users);
      return jsonResponse(200, { ok: true, message: 'Contraseña actualizada.' });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  if (event.httpMethod === 'POST' && endpoint === 'delete-user') {
    try {
      const body = parseBody(event);
      const userOrEmail = (body.userOrEmail || body.email || '').trim();

      if (!userOrEmail) {
        return jsonResponse(400, { ok: false, message: 'Ingresa el usuario o correo a eliminar.' });
      }

      const users = await readUsers();
      const filteredUsers = users.filter(user => user.username !== userOrEmail && user.email !== userOrEmail);

      if (filteredUsers.length === users.length) {
        return jsonResponse(404, { ok: false, message: 'No se encontró la cuenta indicada.' });
      }

      await writeUsers(filteredUsers);
      return jsonResponse(200, { ok: true, message: 'Cuenta eliminada correctamente.' });
    } catch (error) {
      return jsonResponse(400, { ok: false, message: 'Solicitud inválida.' });
    }
  }

  return jsonResponse(404, { ok: false, message: 'Endpoint no encontrado.' });
};
