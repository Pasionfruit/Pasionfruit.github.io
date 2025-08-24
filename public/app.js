document.addEventListener('DOMContentLoaded', event => {
    const app = firebase.app();
    console.log(app);
});

function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log(`Hello ${user.displayName}`);
            document.body.innerHTML = `<h1>Welcome, ${user.displayName}!</h1>`;
        })
        .catch((error) => {
            console.error("Error during login", error);
        });
}