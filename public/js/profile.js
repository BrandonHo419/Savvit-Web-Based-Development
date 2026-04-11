document.addEventListener("DOMContentLoaded", () => {
    const image_input = document.querySelector("#imageButton"); // This is the image button which is invisible
    const profileIcon = document.querySelector("#profileIcon"); // This is profile icon
    const userName = document.getElementById('username');
    const userEmail = document.getElementById('email');
    const logOutButton = document.getElementById('logOutButton');

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

    const profileRequest = new XMLHttpRequest();

    profileRequest.onreadystatechange = function () {
        if (this.readyState === 4) {
            if (this.status === 200) {
                // do sum
                const profileData = JSON.parse(this.responseText);
                userName.innerText = userName.innerText + profileData.username;
                userEmail.innerText = userEmail.innerText + profileData.email;
            } else {
                window.location.href = "/login.html";
            }
        }
    };

    // Initiate connection
    profileRequest.open("GET", "/users/profile", true);

    profileRequest.send();

    logOutButton.addEventListener("click", () => { // If log out clicked
        const xhttp = new XMLHttpRequest();

        xhttp.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    window.location.href = "/login.html";
                }
            }
        };

        // Initiate connection
        xhttp.open("GET", "/users/logout", true);

        xhttp.send();
    });
});
