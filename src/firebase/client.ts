import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyD-SDrMa8lfH_n_dlrZCy4Zw0gb2hW5BbI",
    authDomain: "main-website-398409.firebaseapp.com",
    databaseURL: "https://main-website-398409-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "main-website-398409",
    storageBucket: "main-website-398409.firebasestorage.app",
    messagingSenderId: "1015274416743",
    appId: "1:1015274416743:web:d3bac272f7b8f52c3b02c2",
    measurementId: "G-22CZGX6KFV"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
