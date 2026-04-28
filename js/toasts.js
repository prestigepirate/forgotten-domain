/**
 * Toast Notification System
 *
 * Fixed-position toast notifications for game events:
 * crafting, summoning, combat results, errors.
 */

let toastContainer = null;

/**
 * Create the toast container (fixed position, top-right).
 * Idempotent — safe to call multiple times.
 */
export function createToastContainer() {
    if (toastContainer) return toastContainer;

    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
}

/**
 * Show a toast notification.
 *
 * @param {string} message - Display text
 * @param {'info'|'success'|'warning'|'error'} type - Visual style
 * @param {number} duration - Milliseconds before auto-dismiss (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Progress bar that shrinks over duration
    const progressBar = document.createElement('div');
    progressBar.className = 'toast-progress-bar';
    progressBar.style.animationDuration = `${duration}ms`;
    toast.appendChild(progressBar);

    toastContainer.appendChild(toast);

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
        dismissToast(toast);
    }, duration);

    // Click to dismiss early
    toast.addEventListener('click', () => {
        clearTimeout(dismissTimer);
        dismissToast(toast);
    });

    return toast;
}

/**
 * Dismiss a toast with slide-out animation, then remove from DOM.
 */
export function dismissToast(toast) {
    if (!toast || toast.dataset.dismissing) return;
    toast.dataset.dismissing = 'true';
    toast.classList.add('toast-dismissing');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 300);
}

/**
 * Remove all toasts immediately.
 */
export function clearAllToasts() {
    if (!toastContainer) return;
    toastContainer.innerHTML = '';
}
