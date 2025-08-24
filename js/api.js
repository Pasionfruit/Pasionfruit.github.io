
// --- FIREBASE FIRESTORE SETUP ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBa9EfqxvYRfWT4LikWSAnexo80DqJzICw",
  authDomain: "abepasion-90edd.firebaseapp.com",
  projectId: "abepasion-90edd",
  storageBucket: "abepasion-90edd.firebasestorage.app",
  messagingSenderId: "25428321460",
  appId: "1:25428321460:web:ee0ad15f679e08dcf663e1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Example: Add data to a Firestore collection
export async function addData(collectionName, data) {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
}

// Example: Get all data from a Firestore collection
export async function getData(collectionName) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error("Error getting documents: ", e);
    throw e;
  }
}

// --- PREVIOUS GOOGLE SHEETS API CODE (COMMENTED OUT FOR REFERENCE) ---
/*
// API Configuration
const CONFIG = {
  baseUrl: "https://script.google.com/macros/s/AKfycbxTMCxr-agTpxD-gqs5OGiCOujtIIuxMtwEu08ms_KTM8u3ZAWCDEl8vRCUCDtEjH7g/exec",
  endpoints: {
    goals: "Goals",
    food: "Food", 
    money: "Money",
    travel: "Travel"
  }
};

class SheetsAPI {
  static async fetchData(sheet, options = {}) { /* ... */ }
  static async postData(sheet, data) { /* ... */ }
  static async getAllData() { /* ... */ }
}
// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, SheetsAPI };
}
*/
