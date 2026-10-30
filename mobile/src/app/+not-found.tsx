import { Link, Stack } from 'expo-router';

import { EmptyState } from '../components/EmptyState';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState icon="leaf-outline" title="This page doesn't exist">
        <Link href="/">Go to the scanner</Link>
      </EmptyState>
    </>
  );
}
