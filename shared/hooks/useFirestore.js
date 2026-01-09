// Custom Hook for Firestore Document
// Works on both React Native and React Web
import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

/**
 * useDocument Hook
 * Fetches and listens to a Firestore document
 * 
 * Usage:
 * import { db } from '../firebaseConfig'; // Mobile
 * import { db } from '../shared/firebaseConfig.web'; // Web
 * import { useDocument } from '../shared/hooks/useFirestore';
 * 
 * const { data, loading, error } = useDocument(db, 'users', userId);
 */
export const useDocument = (db, collectionName, documentId, realtime = false) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, collectionName, documentId);

    if (realtime) {
      // Real-time listener
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setData({ id: docSnap.id, ...docSnap.data() });
            setError(null);
          } else {
            setData(null);
            setError('Document not found');
          }
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching document:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      // One-time fetch
      getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            setData({ id: docSnap.id, ...docSnap.data() });
            setError(null);
          } else {
            setData(null);
            setError('Document not found');
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching document:', err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [db, collectionName, documentId, realtime]);

  return { data, loading, error };
};

/**
 * useCollection Hook
 * Fetches and listens to a Firestore collection
 * 
 * Usage:
 * import { db } from '../firebaseConfig';
 * import { useCollection } from '../shared/hooks/useFirestore';
 * import { query, where, orderBy, limit } from 'firebase/firestore';
 * 
 * const q = query(collection(db, 'posts'), where('userId', '==', currentUserId), orderBy('createdAt', 'desc'), limit(10));
 * const { data, loading, error } = useCollection(db, q);
 */
export const useCollection = (db, firestoreQuery, realtime = false) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firestoreQuery) {
      setLoading(false);
      return;
    }

    if (realtime) {
      // Real-time listener
      const unsubscribe = onSnapshot(
        firestoreQuery,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setData(docs);
          setError(null);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching collection:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      // One-time fetch
      import('firebase/firestore').then(({ getDocs }) => {
        getDocs(firestoreQuery)
          .then((snapshot) => {
            const docs = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setData(docs);
            setError(null);
            setLoading(false);
          })
          .catch((err) => {
            console.error('Error fetching collection:', err);
            setError(err.message);
            setLoading(false);
          });
      });
    }
  }, [firestoreQuery, realtime]);

  return { data, loading, error };
};
