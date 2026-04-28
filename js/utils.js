/**
 * Utility Functions
 */

// ============================================
// DOM Utilities
// ============================================

export function getElement(id) {
    return document.getElementById(id);
}

export function createElement(tag, attributes = {}, content = null) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') el.className = value;
        else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else el.setAttribute(key, value);
    }
    if (content) {
        if (typeof content === 'string') el.textContent = content;
        else if (content instanceof HTMLElement) el.appendChild(content);
    }
    return el;
}

export function show(el) { el?.classList.remove('hidden'); }
export function hide(el) { el?.classList.add('hidden'); }
export function setEnabled(el, enabled) { if (el) el.disabled = !enabled; }

// ============================================
// Math Utilities
// ============================================

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function inverseLerp(a, b, value) {
    if (a === b) return 0;
    return clamp((value - a) / (b - a), 0, 1);
}

export function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function angle(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
}

// ============================================
// Array Utilities
// ============================================

export function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ============================================
// String Utilities
// ============================================

export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatNumber(num) {
    return num.toLocaleString();
}

export function pluralize(word, count, suffix = 's') {
    return count === 1 ? word : word + suffix;
}

// ============================================
// Color Utilities
// ============================================

export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

export function hexToRgba(hex, alpha = 1) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function adjustColor(hex, percent) {
    const rgb = hexToRgb(hex);
    const factor = percent / 100;
    const adjust = (channel) => {
        const value = factor > 0
            ? Math.round(255 - (255 - channel) * (1 - factor))
            : Math.round(channel * (1 + factor));
        return clamp(value, 0, 255);
    };
    const r = adjust(rgb.r);
    const g = adjust(rgb.g);
    const b = adjust(rgb.b);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ============================================
// Timing Utilities
// ============================================

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================
// Logging
// ============================================

const LOG_PREFIX = '[FDW]';
export function log(...args) { console.log(LOG_PREFIX, ...args); }
export function warn(...args) { console.warn(LOG_PREFIX, ...args); }
export function error(...args) { console.error(LOG_PREFIX, ...args); }

// ============================================
// Starfield Generation (shared by auth & menu)
// ============================================

export function generateStars(containerId = 'stars', count = 40) {
    const container = document.getElementById(containerId);
    if (!container) return;

    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 4 + 's';

        const brightness = Math.random();
        if (brightness > 0.8) {
            star.classList.add('bright');
            star.style.opacity = 0.8 + Math.random() * 0.2;
        } else if (brightness > 0.5) {
            star.style.opacity = 0.5 + Math.random() * 0.3;
        } else {
            star.classList.add('dim');
        }

        const sizeRoll = Math.random();
        if (sizeRoll > 0.85) {
            const size = 2 + Math.random();
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.classList.add('bright');
        } else if (sizeRoll > 0.5) {
            const size = 1.2 + Math.random() * 0.8;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
        } else {
            const size = 0.7 + Math.random() * 0.5;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
        }

        if (Math.random() > 0.7) {
            star.style.animation = `starFloat ${20 + Math.random() * 40}s linear infinite`;
        }

        container.appendChild(star);
    }
}

// Expose globally for non-module script consumers
if (typeof window !== 'undefined') {
    window.FDW = window.FDW || {};
    window.FDW.generateStars = generateStars;
}
