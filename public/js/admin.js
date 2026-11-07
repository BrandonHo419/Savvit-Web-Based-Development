import { apiFetch, getSession } from './api.js';

document.addEventListener("DOMContentLoaded", () => {
    const toggleButtonAdd = document.getElementById('toggleBtnAdd');
    const addUserFormAdd = document.getElementById('singleUserFormAdd');
    const delUserFormDel = document.getElementById('singleUserFormDel');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const roleInput = document.getElementById('role');
    const deleteInput = document.getElementById('delete');
    const errorMessage = document.getElementById('error-message');
    const deleteMessage = document.getElementById('del-message');

    function retrieveUserTable() {
        const tbody = document.querySelector('tbody');
        tbody.innerHTML = "";
        const profileRequest = new XMLHttpRequest();
        // Creates rows of user data
        profileRequest.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    const users = JSON.parse(this.responseText);
                    for (let i = 0; i < users.length; i++) {
                        const row = document.createElement('tr');
                        tbody.appendChild(row);
                        const user_id = document.createElement('td');
                        user_id.innerText = users[i].user_id;
                        row.appendChild(user_id);
                        const username = document.createElement('td');
                        username.innerText = users[i].username;
                        row.appendChild(username);
                        const email = document.createElement('td');
                        email.innerText = users[i].email;
                        row.appendChild(email);
                        const avatar_url = document.createElement('td');
                        avatar_url.innerText = users[i].avatar_url;
                        row.appendChild(avatar_url);
                        const role = document.createElement('td');
                        role.innerText = users[i].role;
                        row.appendChild(role);
                        const date_created = document.createElement('td');
                        // eslint-disable-next-line prefer-destructuring
                        date_created.innerText = users[i].created_at.split('T')[0];
                        row.appendChild(date_created);
                    }
                } else if (this.status === 401) {
                    window.location.href = "/login.html";
                }
            }
        };

        // Initiate connection
        profileRequest.open("GET", "/users/user_info", true);

        profileRequest.send();
    }

    const adminContent = document.getElementById('adminContent');

    // Make an AJAX request to check if user is authenticated & admin
    const checkAdminRequest = new XMLHttpRequest();
    checkAdminRequest.onreadystatechange = function () {
        if (this.readyState === 4) {
            if (this.status === 200) {
                const user = JSON.parse(this.responseText);
                if (user.role === 'admin') {
                    // User is admin, show the content
                    adminContent.style.display = 'block';
                    // Now you can call your retrieveUserTable() and other init code here
                    retrieveUserTable();
                } else {
                    // Not admin, redirect to home or login
                    window.location.href = "/login.html";
                }
            } else {
                // Not authenticated, redirect to login
                window.location.href = "/login.html";
            }
        }
    };

    checkAdminRequest.open("GET", "/users/profile", true);
    checkAdminRequest.send();

    toggleButtonAdd.addEventListener("click", () => {
        if (addUserFormAdd.style.display === 'none') {
            addUserFormAdd.style.display = 'block';
        } else {
            addUserFormAdd.style.display = 'none';
        }
    });

    // Refresh the session immediately before admin mutations; never replay failures.
    async function submitAdmin(form, message, url, body, onSuccess) {
        if (form.dataset.pending === 'true') return;
        form.dataset.pending = 'true';
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        message.innerText = '';
        try {
            const session = await getSession({ refresh: true });
            if (!session) { window.location.href = '/login.html'; return; }
            const response = await apiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            if (!response.ok) throw new Error(await response.text() || 'Unable to complete this action.');
            onSuccess();
            retrieveUserTable();
        } catch (error) {
            message.innerText = error.message || 'Unable to complete this action. Please retry.';
        } finally {
            form.dataset.pending = 'false';
            button.disabled = false;
        }
    }

    addUserFormAdd.addEventListener('submit', (event) => {
        event.preventDefault();
        return submitAdmin(addUserFormAdd, errorMessage, '/users/admin_add_user', {
            username: usernameInput.value, email: emailInput.value,
            password: passwordInput.value, role: roleInput.value
        }, () => {
            addUserFormAdd.reset();
            addUserFormAdd.style.display = 'none';
        });
    });

    delUserFormDel.addEventListener('submit', (event) => {
        event.preventDefault();
        return submitAdmin(delUserFormDel, deleteMessage, '/users/admin_del_user', {
            user_id: deleteInput.value
        }, () => delUserFormDel.reset());
    });

    /*
    const image_input = document.querySelector("#imageButton"); // This is the image button which is invisible
    const profileIcon = document.querySelector("#profileIcon"); // This is profile icon

    profileIcon.addEventListener("click", () => { // If profile clicked
        image_input.click(); // Simulate click on the hidden file input
    });

    image_input.addEventListener("change", function () { // When image button clicked do this
        const reader = new FileReader();
        reader.addEventListener("load", () => { // When imaged loaded function runs
            const uploaded_image = reader.result; // Stores image
            const icon = document.querySelector(".fa-solid.fa-circle-user"); // Finds user icon, this is where image set to
            icon.style.backgroundImage = `url(${uploaded_image})`; // Sets image to icon
            icon.style.backgroundSize = "cover"; // Doesn't stretch image
            icon.style.backgroundPosition = "center";
            icon.style.color = "transparent"; // Hides background image
        });
        reader.readAsDataURL(this.files[0]);
    });
    */

});
