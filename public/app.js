document.addEventListener('DOMContentLoaded', event => {
    const app = firebase.app();
    console.log(app);

    const db = firebase.firestore();

    const myPost = db.collection('posts').doc('firstpost');

    myPost.onSnapshot((doc) => {
        const data = doc.data();
        console.log("Current data: ", data);
        const titleDiv = document.getElementById('title');
        if (titleDiv && data && data.title) {
            titleDiv.innerText = `title: ${data.title}`;
        }
    });
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