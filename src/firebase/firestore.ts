import { getFirestore, collection } from 'firebase/firestore'

const db = getFirestore()
const colRef = collection(db, 'users')

