import json
import mimetypes
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"


def ensure_data_file():
    DATA_DIR.mkdir(exist_ok=True)
    if not USERS_FILE.exists():
        USERS_FILE.write_text("[]", encoding="utf-8")


def read_users():
    ensure_data_file()
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def write_users(users):
    ensure_data_file()
    USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/health":
            self._send_json(200, {"ok": True, "message": "Servidor activo"})
            return

        file_path = self._resolve_path(path)
        if file_path is None:
            self._send_json(404, {"ok": False, "message": "No encontrado"})
            return

        if file_path.is_file():
            self._send_file(file_path)
            return

        self._send_file(ROOT / "index.html")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/register":
            self._handle_register()
            return
        if path == "/api/login":
            self._handle_login()
            return
        if path == "/api/check-user":
            self._handle_check_user()
            return
        if path == "/api/recover":
            self._handle_recover()
            return

        self._send_json(404, {"ok": False, "message": "Endpoint no encontrado"})

    def _handle_register(self):
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {"ok": False, "message": "Solicitud inválida"})
            return

        fullname = (body.get("fullname") or "").strip()
        email = (body.get("email") or "").strip()
        username = (body.get("username") or "").strip()
        password = (body.get("password") or "").strip()
        confirm_password = (body.get("confirmPassword") or "").strip()

        if not fullname or not email or not username or not password or not confirm_password:
            self._send_json(400, {"ok": False, "message": "Completa todos los campos."})
            return
        if password != confirm_password:
            self._send_json(400, {"ok": False, "message": "Las contraseñas no coinciden."})
            return

        users = read_users()
        if any(user.get("username") == username or user.get("email") == email for user in users):
            self._send_json(409, {"ok": False, "message": "Ya existe un usuario con ese correo o nombre de usuario."})
            return

        users.append({"fullname": fullname, "email": email, "username": username, "password": password})
        write_users(users)
        self._send_json(201, {"ok": True, "message": "Cuenta creada correctamente."})

    def _handle_login(self):
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {"ok": False, "message": "Solicitud inválida"})
            return

        username = (body.get("username") or "").strip()
        password = (body.get("password") or "").strip()

        if not username or not password:
            self._send_json(400, {"ok": False, "message": "Completa tus credenciales."})
            return

        users = read_users()
        is_admin = username == "admin" and password == "admin"
        user = next((u for u in users if u.get("username") == username and u.get("password") == password), None)

        if is_admin or user:
            self._send_json(200, {"ok": True, "user": {"username": username, "fullname": user.get("fullname", "Administrador") if user else "Administrador", "email": user.get("email", "admin@teknova.local") if user else "admin@teknova.local"}})
            return

        self._send_json(401, {"ok": False, "message": "Usuario o contraseña incorrectos."})

    def _handle_check_user(self):
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {"ok": False, "message": "Solicitud inválida"})
            return

        user_or_email = (body.get("userOrEmail") or "").strip()
        if not user_or_email:
            self._send_json(400, {"ok": False, "message": "Ingresa tu usuario o correo."})
            return

        users = read_users()
        user = next((u for u in users if u.get("username") == user_or_email or u.get("email") == user_or_email), None)
        if not user:
            self._send_json(404, {"ok": False, "message": "No se encontró una cuenta con ese usuario o correo."})
            return

        self._send_json(200, {"ok": True, "user": {"username": user.get("username"), "email": user.get("email")}})

    def _handle_recover(self):
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {"ok": False, "message": "Solicitud inválida"})
            return

        user_or_email = (body.get("userOrEmail") or "").strip()
        new_password = (body.get("newPassword") or "").strip()
        confirm_new_password = (body.get("confirmNewPassword") or "").strip()

        if not user_or_email or not new_password or not confirm_new_password:
            self._send_json(400, {"ok": False, "message": "Completa todos los campos."})
            return
        if new_password != confirm_new_password:
            self._send_json(400, {"ok": False, "message": "Las contraseñas no coinciden."})
            return

        users = read_users()
        user = next((u for u in users if u.get("username") == user_or_email or u.get("email") == user_or_email), None)
        if not user:
            self._send_json(404, {"ok": False, "message": "No se encontró una cuenta con ese usuario o correo."})
            return

        user["password"] = new_password
        write_users(users)
        self._send_json(200, {"ok": True, "message": "Contraseña actualizada."})

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def _resolve_path(self, path):
        if path in ("/", ""):
            return ROOT / "index.html"
        safe_path = unquote(path.lstrip("/"))
        candidate = (ROOT / safe_path).resolve()
        if ROOT in candidate.parents or candidate == ROOT:
            return candidate
        return None

    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path):
        content_type, _ = mimetypes.guess_type(str(file_path))
        if content_type is None:
            content_type = "application/octet-stream"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 3000
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Servidor corriendo en http://{host}:{port}")
    print("También accesible desde la IP local del equipo en el puerto 3000")
    server.serve_forever()
