// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

// ============================================================
//  Tipo de cambio (Hacienda CR)
//  - getExchangeRate(): obtiene los datos (con cache en JS)
//  - loadExchangeRate(): pinta los datos en el widget ExchangeRate.cshtml
// ============================================================

const EXCHANGE_RATE_URL = "https://api.hacienda.go.cr/indicadores/tc";
const EXCHANGE_RATE_CACHE_KEY = "paw.exchangeRate.v1";
const EXCHANGE_RATE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Cache nivel 1: en memoria (vive mientras no se recargue la pagina).
// Tambien guarda la promesa en curso para no disparar dos fetch a la vez.
let exchangeRateMemory = null;      // { timestamp, data }
let exchangeRateInFlight = null;    // Promise

// Cache nivel 2: localStorage (sobrevive a la navegacion entre paginas MVC).
function readExchangeRateCache() {
    if (exchangeRateMemory) {
        return exchangeRateMemory;
    }
    try {
        const raw = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
        if (raw) {
            exchangeRateMemory = JSON.parse(raw);
        }
    } catch (e) {
        console.warn("No se pudo leer el cache del tipo de cambio", e);
    }
    return exchangeRateMemory;
}

function writeExchangeRateCache(data) {
    exchangeRateMemory = { timestamp: Date.now(), data: data };
    try {
        localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify(exchangeRateMemory));
    } catch (e) {
        console.warn("No se pudo guardar el cache del tipo de cambio", e);
    }
}

/**
 * Devuelve { data, fromCache, stale, timestamp }.
 * - Si hay cache vigente (< TTL) no hace ninguna peticion.
 * - Si la peticion falla y hay cache vencido, lo devuelve marcado como stale.
 * - forceRefresh = true ignora el cache.
 */
async function getExchangeRate(forceRefresh = false) {
    const cached = readExchangeRateCache();
    const isFresh = cached && (Date.now() - cached.timestamp) < EXCHANGE_RATE_TTL_MS;

    if (!forceRefresh && isFresh) {
        return { data: cached.data, fromCache: true, stale: false, timestamp: cached.timestamp };
    }

    if (exchangeRateInFlight) {
        return exchangeRateInFlight;
    }

    exchangeRateInFlight = (async () => {
        try {
            // GET simple, sin headers personalizados, para evitar preflight CORS.
            const response = await fetch(EXCHANGE_RATE_URL, { method: "GET", redirect: "follow" });
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            const data = await response.json();
            writeExchangeRateCache(data);
            return { data: data, fromCache: false, stale: false, timestamp: exchangeRateMemory.timestamp };
        } catch (error) {
            console.error("Error consultando el tipo de cambio", error);
            if (cached) {
                return { data: cached.data, fromCache: true, stale: true, timestamp: cached.timestamp };
            }
            throw error;
        } finally {
            exchangeRateInFlight = null;
        }
    })();

    return exchangeRateInFlight;
}

function formatColones(value) {
    return new Intl.NumberFormat("es-CR", {
        style: "currency",
        currency: "CRC",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatUsd(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    }).format(value);
}

// "2026-10-04" -> "04/10/2026" (sin pasar por Date para evitar corrimientos de zona horaria)
function formatRateDate(value) {
    if (!value) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : value;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

async function loadExchangeRate(forceRefresh = false) {
    const widget = document.getElementById("exchange-rate-widget");
    if (!widget) return;

    widget.classList.add("is-loading");
    widget.classList.remove("has-error");
    setText("fx-status", "Actualizando...");

    try {
        const result = await getExchangeRate(forceRefresh);
        const d = result.data;

        setText("fx-usd-buy", formatColones(d.dolar.compra.valor));
        setText("fx-usd-sell", formatColones(d.dolar.venta.valor));
        setText("fx-usd-date", "Al " + formatRateDate(d.dolar.venta.fecha));

        setText("fx-eur-crc", formatColones(d.euro.colones));
        setText("fx-eur-usd", formatUsd(d.euro.dolares));
        setText("fx-eur-date", "Al " + formatRateDate(d.euro.fecha));

        const time = new Date(result.timestamp).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
        if (result.stale) {
            widget.classList.add("is-stale");
            setText("fx-status", "Sin conexion, datos de las " + time);
        } else {
            widget.classList.remove("is-stale");
            setText("fx-status", (result.fromCache ? "Cache · " : "En linea · ") + time);
        }
    } catch (error) {
        widget.classList.add("has-error");
        setText("fx-status", "No se pudo cargar el tipo de cambio");
    } finally {
        widget.classList.remove("is-loading");
    }
}

function initExchangeRateWidget() {
    const widget = document.getElementById("exchange-rate-widget");
    if (!widget) return;

    const toggle = document.getElementById("fx-toggle");
    const refresh = document.getElementById("fx-refresh");

    if (toggle) {
        toggle.addEventListener("click", () => {
            const collapsed = widget.classList.toggle("is-collapsed");
            toggle.setAttribute("aria-expanded", String(!collapsed));
            toggle.textContent = collapsed ? "+" : "–";
        });
    }
    if (refresh) {
        refresh.addEventListener("click", () => loadExchangeRate(true));
    }

    loadExchangeRate();
}

document.addEventListener("DOMContentLoaded", initExchangeRateWidget);
