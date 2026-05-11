import AmarSeba from '@/components/AmarSeba';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Home() {
  return (
    <ErrorBoundary>
      <AmarSeba />
    </ErrorBoundary>
  );
}
