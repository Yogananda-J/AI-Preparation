import AppRouter from './router';
import './index.css';

/**
 * Main App component
 * Entry point for the AI-Based Coding Skill Enhancer application
 */
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppRouter />
    </div>
  );
}

export default App;
