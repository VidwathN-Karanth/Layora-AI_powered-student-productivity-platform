import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, isFirebaseConfigured } from '@/lib/firebaseClient';
import { doc, deleteDoc } from 'firebase/firestore';

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete Firestore user data.
    // NOTE: We do NOT delete the Clerk account here because doing so causes
    // the client-side signOut() to hang (the session references a deleted account).
    // Firestore data deletion is the critical step — the Clerk account can be
    // left intact so signOut() completes cleanly and redirects properly.
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'user_states', userId);
      await deleteDoc(docRef);
      console.log(`Purge: Deleted Firestore document for user ${userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Purge failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
