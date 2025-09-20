import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import matchLeagueFavicon from './images/MatchLeague2.png';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// set the browser tab title
try {
  document.title = 'Match League';
  // set favicon to the provided repo image; replace existing if present
  const setFavicon = (href) => {
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.type = 'image/png';
    link.href = href;
  };
  setFavicon(matchLeagueFavicon);
} catch (e) {
  // in non-browser environments (build/test) this may fail; ignore
}
