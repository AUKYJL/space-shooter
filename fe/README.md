# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Telegram Mini App

This project supports running as a Telegram Mini App.

- SDKs: `@twa-dev/sdk` and `@telegram-apps/sdk-react`
- Init hook: `src/shared/lib/telegram/useTelegramWebApp.ts`
  - Calls `init()`, then `WebApp.ready()` + `WebApp.expand()`
  - On mobile devices: best-effort `WebApp.requestFullscreen()` + `WebApp.disableVerticalSwipes()`
- Local dev: most features work in a normal browser, but fullscreen/vertical-swipe behavior and haptics are only reliable inside Telegram on a real device.

## Gameplay UI Notes

### Backend Integration (Dev)

Frontend talks to the NestJS backend in `be/` via TanStack Query + axios.

- Configure API base URL in `fe/.env.local`:
  - `VITE_API_BASE_URL=http://localhost:4000`
- Run backend:
  - `cd be && npm run start:dev`
- Run frontend:
  - `cd fe && npm run dev`
- Open:
  - `http://localhost:5173/login-dev` → enter any username → login

Notes:
- Auth uses `Authorization: Bearer <token>` (stored in Zustand `sessionStore`).
- Gameplay per-frame logic remains in Pixi runtime; React only orchestrates screens and backend calls.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
