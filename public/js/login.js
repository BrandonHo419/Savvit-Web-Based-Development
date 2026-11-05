
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

form.addEventListener('submit', (e) => {
    e.preventDefault();
    let errors = [];

    if (usernameInput) { // In Sign Up Page
        errors = getSignupErrors(
            passwordInput.value,
            repeatedPasswordInput.value,
            emailInput.value
        );

        // If there are errors
        if (errors.length > 0) {
            errorMessage.innerText = errors.join(" ");
            return;
        }

        const xhttp = new XMLHttpRequest();

        xhttp.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
    const response = JSON.parse(this.responseText);

    localStorage.setItem('csrfToken', response.csrfToken);

    window.location.href = response.redirect;
} else {
    errorMessage.innerText = this.responseText;
}
            }
        };

        // Initiate connection
        xhttp.open("POST", "/users/signup", true);

        xhttp.setRequestHeader("Content-type", "application/json");
        const csrfToken = localStorage.getItem('csrfToken');
        if (csrfToken) {
            xhttp.setRequestHeader('X-CSRF-TOKEN', csrfToken);
        }

        xhttp.send(JSON.stringify({
            username: usernameInput.value,
            email: emailInput.value,
            password: passwordInput.value
        }));
    } else { // Else in Login Page
        const xhttp = new XMLHttpRequest();

        xhttp.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    const response = JSON.parse(this.responseText);

                    localStorage.setItem('csrfToken', response.csrfToken);

                    window.location.href = response.redirect;
            } else {
                    errorMessage.innerText = this.responseText;
            }
            }
        };

        // Initiate connection
        xhttp.open("POST", "/users/login", true);

        xhttp.setRequestHeader("Content-type", "application/json");

        xhttp.send(JSON.stringify({
            email: emailInput.value,
            password: passwordInput.value
        }));
    }
});
