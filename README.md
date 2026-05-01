# Culto presentation PoC (React + Vite)

Church worship presentation app (song library, culto builder, operator + projection).

## Scripts

```bash
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Presenter mode (multi-monitor)

**Iniciar proyección** uses Chromium’s [Window Management API](https://developer.chrome.com/docs/web-platform/window-management/) to open `/projection` on the external display when two or more screens are detected. Requires **Chrome / Edge / Brave** (or another Chromium browser).

- **HTTPS** is required in production; `http://localhost` works for local development.
- The browser may prompt once for **window management** permission.

Fallbacks (single display, unsupported browser, or denied permission) open a normal tab and show a short notice in the operator panel.

---

## React + Vite template

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
