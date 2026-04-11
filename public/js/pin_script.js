


// const input = document.getElementById('picture');

// input.addEventListener('change', (event) => {
//   const file = event.target.files[0];
//   if (file) {
//     const reader = new FileReader();
//     reader.onload = function() {
//         // result of readasDataURL
//         document.getElementById("pin_image").src = reader.result;
//     };
//     // reading the file
//     reader.readAsDataURL(file);
//   }
//   input.value = '';
// // so when you select the same Image, it will identify the eventlistener as a change
// });

document.getElementById('picture').addEventListener('change', (event) => {
    if (event.target.files && event.target.files[0]) {

        if (/image\/*/.test(event.target.files[0].type)) {

            const reader = new FileReader();

            reader.onload = function () {
                document.querySelector('.pin_image img').src = reader.result;
            };

            reader.readAsDataURL(event.target.files[0]);
        }
    }

    document.getElementById('picture').value = '';
});
