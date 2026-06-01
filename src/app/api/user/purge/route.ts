import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db, isFirebaseConfigured } from '@/lib/firebaseClient';
import { doc, deleteDoc } from 'firebase/firestore';

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Delete Firestore user data
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'user_states', userId);
      await deleteDoc(docRef);
      console.log(`Purge: Deleted Firestore document for user ${userId}`);
    }

    // 2. Delete the Clerk user account
    const client = await clerkClient();
    await client.users.deleteUser(userId);
    console.log(`Purge: Deleted Clerk user account ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Purge failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
