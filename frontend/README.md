# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

# React Frontend – Schnelle Hilfe bei "react-scripts: command not found"

**Wenn das Frontend nicht startet, führe GENAU diese Schritte im frontend-Ordner aus:**

```bash
rm -rf node_modules package-lock.json
npm install react-scripts@5.0.1 --save-dev
npm install
npm start
```

**Prüfe danach:**
- Node-Version: `node -v` (empfohlen: 18.x oder 20.x)
- Existiert `node_modules/.bin/react-scripts`? (`ls node_modules/.bin/react-scripts`)

**Wenn es immer noch nicht geht:**
- Starte Terminal/IDE neu.
- Prüfe, ob du im richtigen Ordner bist (`pwd`).
- Prüfe Schreibrechte im Projektordner.

---

## Schnelle Hilfe: react-scripts: command not found

**Das Problem:**  
- Du benutzt Node.js 22.x (siehe `node -v`).
- `react-scripts@5.0.1` wird mit Node.js 22.x NICHT installiert (steht in der package.json von react-scripts).
- Deshalb fehlt `node_modules/.bin/react-scripts` und `npm start` funktioniert nicht.

**Die Lösung:**  
1. **Node.js auf Version 18.x oder 20.x wechseln!**
   - [Node.js LTS 20.x Download](https://nodejs.org/en/download)
   - Oder mit nvm (wenn installiert):
     ```bash
     nvm install 20
     nvm use 20
     node -v   # Muss v20.x.x anzeigen
     ```

2. **Danach im frontend-Ordner:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm start
   ```

**Erklärung:**  
- Mit Node.js 22.x wird react-scripts nicht installiert, weil es nicht unterstützt wird.
- Mit Node.js 18.x oder 20.x funktioniert alles wie erwartet.

---

# Fehler: react-scripts fehlt in node_modules/.bin

**Ursache:**  
Node.js 22 wird von `react-scripts@5.0.1` (und Create React App allgemein) NICHT unterstützt.  
Das führt dazu, dass react-scripts nicht installiert wird und im Build fehlt.

**Lösung:**  
1. **Node.js auf Version 18.x oder 20.x wechseln!**  
   Empfohlen: [Node.js LTS 20.x](https://nodejs.org/en/download)

   Beispiel mit nvm:
   ```bash
   nvm install 20
   nvm use 20
   node -v   # Muss v20.x.x anzeigen
   ```

2. **Danach im frontend-Ordner:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm start
   ```

**Erklärung:**  
react-scripts wird mit Node 22 nicht installiert, weil es in der package.json von react-scripts explizit ausgeschlossen ist.  
Mit Node 18 oder 20 funktioniert alles wie erwartet.

---

# Fehler: Node.js Version zu hoch – nvm nicht installiert

**Du hast keine nvm (Node Version Manager) installiert.**

## Lösungsmöglichkeiten

### 1. Node.js manuell auf Version 18.x oder 20.x downgraden

- Gehe auf https://nodejs.org/en/download
- Lade die **LTS-Version** (empfohlen: 20.x) für dein Betriebssystem herunter und installiere sie.
- Danach im Terminal prüfen:
  ```bash
  node -v
  # Muss v20.x.x oder v18.x.x anzeigen
  ```

### 2. nvm installieren (empfohlen für Entwickler)

- Installiere nvm mit folgendem Befehl (macOS/Linux):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```
- Starte das Terminal neu.
- Dann:
  ```bash
  nvm install 20
  nvm use 20
  node -v
  ```

**Danach:**  
Im frontend-Ordner:
```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

---

## WICHTIG: npm start nur im richtigen Ordner!

**Fehlerursache:**  
Du hast `npm start` im falschen Ordner (`/Users/A105227786/Documents/projects/sL/pTght`) ausgeführt.  
Dort gibt es **kein** `package.json`. Deshalb kommt der Fehler:

```
Could not read package.json: Error: ENOENT: no such file or directory, open '/Users/A105227786/Documents/projects/sL/pTght/package.json'
```

**Lösung:**  
1. Wechsle in den frontend-Ordner:
   ```bash
   cd frontend
   ```

2. Starte das Frontend:
   ```bash
   npm start
   ```

**Nur im Ordner `/Users/A105227786/Documents/projects/sL/pTght/frontend` funktioniert der Start!**

---

## Original Create React App Hinweise

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
