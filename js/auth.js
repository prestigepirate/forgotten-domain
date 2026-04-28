/**
 * Authentication Client - Login/Register
 */

import { generateStars } from './utils.js';

const API_URL = 'http://localhost:3000/api';

// ============================================
// Login Form Handler
// ============================================

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    console.log('Attempting login for:', username, 'API URL:', API_URL);

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        console.log('Response status:', response.status);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        console.log('Login successful, storing token');

        // Store token and user info
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect to main menu
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    }
}

// ============================================
// Register Form Handler
// ============================================

async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const displayName = document.getElementById('register-display-name').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    successEl.classList.add('hidden');
    successEl.textContent = '';

    // Validate passwords match
    if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('hidden');
        return;
    }

    // Validate username
    if (username.length < 3 || username.length > 20) {
        errorEl.textContent = 'Username must be 3-20 characters';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password,
                displayName: displayName || username
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Store token and user info
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Show success and redirect
        successEl.textContent = 'Account created! Redirecting...';
        successEl.classList.remove('hidden');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    }
}

// ============================================
// Check Auth State on Load
// ============================================

function checkAuthState() {
    const token = localStorage.getItem('auth_token');
    if (token) {
        // User is logged in - could redirect to menu
        console.log('User already logged in');
    }
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    generateStars();
    checkAuthState();

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});
