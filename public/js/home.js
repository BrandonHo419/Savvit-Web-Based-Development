const xhttp = new XMLHttpRequest();

xhttp.onreadystatechange = function () {
    if (this.readyState === 4) {
        if (this.status !== 200) {
            window.location.href = "/login.html";
        }
    }
};

// Initiate connection
xhttp.open("GET", "/users/home", true);

xhttp.send();
