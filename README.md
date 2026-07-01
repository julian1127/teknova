# Teknova Local Server

Este proyecto ya está preparado para correr como una página completa con servidor local de autenticación.

## Cómo ejecutar el servidor

Desde la carpeta del proyecto:

```bash
cd "/home/julian/Escritorio/mi proyecto"
python3 server.py
```

Entonces abre el sitio en tu navegador:

```text
http://127.0.0.1:3000
```

## Acceso desde otro dispositivo en la misma red

Usa la IP local de tu equipo en vez de `127.0.0.1`. Por ejemplo:

```text
http://192.168.100.19:3000
```

Comprueba con este comando si el servidor está activo:

```bash
curl http://192.168.100.19:3000/api/health
```

Si el otro dispositivo no se conecta, asegúrate de que:

- el móvil/PC está en la misma red Wi-Fi
- el router no tenga aislamiento de clientes habilitado
- el puerto `3000` no esté bloqueado por firewall

## Ejecución automática al arrancar el equipo

Para que el servidor arranque siempre con el sistema, instala el servicio `systemd` (requiere permisos de administrador):

```bash
sudo cp "/home/julian/Escritorio/mi proyecto/teknova.service" /etc/systemd/system/teknova.service
sudo systemctl daemon-reload
sudo systemctl enable --now teknova.service
```

Después revisa el estado con:

```bash
sudo systemctl status teknova.service
```

## Alternativa rápida sin service

Si no quieres usar `systemd`, ejecuta este script en segundo plano:

```bash
cd "/home/julian/Escritorio/mi proyecto"
./start_server.sh &
```

El servidor quedará activo y escribirá logs en `/tmp/teknova-server.log`.
