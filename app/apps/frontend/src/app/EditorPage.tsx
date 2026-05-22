import { useParams } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <AppProvider projectId={projectId}>
      <Layout />
    </AppProvider>
  );
}
