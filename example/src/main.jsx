import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';

// No <React.StrictMode> here: its dev-only double-invoke of effects would call POST /auth/transaction
// twice per mount (harmless in production - StrictMode's double-invoke never runs there - but it makes
// this dev harness's network log noisy and, on localhost's near-zero latency, can create two real
// transactions before the SDK's AbortController-based guard has a chance to win the race).
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
