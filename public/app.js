import firebase from "firebase/compat/app";

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
        })
        .catch((error) => {
            console.error("Error during login", error);
        });
}

export { googleLogin };
