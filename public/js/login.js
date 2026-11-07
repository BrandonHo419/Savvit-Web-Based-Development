
const form = document.getElementById('form');
const usernameInput = document.getElementById('username-input');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('login-pass');
const repeatedPasswordInput = document.getElementById('signup-repeatedPass');
const errorMessage = document.getElementById('error-message');

function getSignupErrors(password, repeatedPassword, email) {
    let errors = [];

    if (password !== repeatedPassword) {
        errors.push('Password does not match repeated password.');
    }
    if (password.length < 8) {
        errors.push('Password must have at least 8 characters.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errors.push('Invalid email format.');
    }

    return errors;
}

const submitButton = form.querySelector('[type="submit"]');
let csrfRequest;

function getCsrfToken() {
    if (!csrfRequest) {
        csrfRequest = fetch('/users/csrf', { credentials: 'same-origin', cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Unable to prepare the form. Please retry.');
                const result = await response.json();
                if (typeof result.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(result.csrfToken)) {
                    throw new Error('Unable to prepare the form. Please retry.');
                }
                return result.csrfToken;
            })
            .finally(() => { csrfRequest = undefined; });
    }
    return csrfRequest;
}

// Preload on form opening and share any in-flight bootstrap with submission.
getCsrfToken().catch(error => { errorMessage.innerText = error.message; });

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitButton.disabled) return;
    if (usernameInput) {
        const errors = getSignupErrors(passwordInput.value, repeatedPasswordInput.value, emailInput.value);
        if (errors.length) { errorMessage.innerText = errors.join(' '); return; }
    }
    submitButton.disabled = true;
    errorMessage.innerText = '';
    try {
        const csrfToken = await getCsrfToken();
        const body = { email: emailInput.value, password: passwordInput.value };
        if (usernameInput) body.username = usernameInput.value;
        const response = await fetch(usernameInput ? '/users/signup' : '/users/login', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify(body)
        });
        if (response.status === 403) throw new Error('Your form session changed or expired. Please submit again.');
        if (response.status === 401 && !usernameInput) throw new Error('Incorrect email or password.');
        if (!response.ok) throw new Error(await response.text() || 'Unable to complete this request.');
        const result = await response.json();
        window.location.href = result.redirect;
    } catch (error) {
        errorMessage.innerText = error.message || 'Unable to connect. Please retry.';
    } finally {
        submitButton.disabled = false;
    }
});
