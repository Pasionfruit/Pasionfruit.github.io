document.addEventListener('DOMContentLoaded', event => {
    const app = firebase.app();
    console.log(app);

    
});

function updatePost(event) {
    const db = firebase.firestore();
    const myPost = db.collection('posts').doc('firstpost');

    const newTitle = event.target.value;
    myPost.set({ title: newTitle }, { merge: true })
        .then(() => {
            console.log("Post updated successfully");
        })
        .catch((error) => {
            console.error("Error updating post: ", error);
        });
}

function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log(`Hello ${user.displayName}`);
            // Show a welcome message in a specific element
            let welcomeDiv = document.getElementById('welcome');
            if (!welcomeDiv) {
                welcomeDiv = document.createElement('div');
                welcomeDiv.id = 'welcome';
                document.body.prepend(welcomeDiv);
            }
            welcomeDiv.innerText = `Welcome, ${user.displayName}!`;

            // Show Firestore data in the 'title' div
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
        })
        .catch((error) => {
            console.error("Error during login", error);
        });
}