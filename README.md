# Keweke · Gestor de Presupuestos

Aplicación web para presupuestos audiovisuales. Un único fichero HTML — sin servidor, sin backend.

## Configuración (5 minutos)

### 1. Google Cloud Console

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/)
2. Crea un proyecto → **APIs & Services → Library**
3. Activa **Google Sheets API** y **Google Drive API**
4. Ve a **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Tipo: **Web application**
   - Authorized JavaScript origins:
     ```
     https://TU-USUARIO.github.io
     ```
5. Copia el **Client ID**

### 2. Editar index.html

Abre `index.html` y en las líneas del principio cambia:

```javascript
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // ← Pega aquí tu Client ID
```

### 3. Activar GitHub Pages

1. Sube el fichero a un repositorio de GitHub
2. Settings → Pages → Source: **main branch / root**
3. La app estará en `https://unairosende.github.io/Keweke-Presupuestos-2/`

---

No necesitas Vercel, ni Node.js, ni servidor. Solo GitHub.
