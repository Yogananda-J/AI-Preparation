import { Navigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';

/**
 * Route guard component to protect authenticated routes
 */
const RequireAuth = ({ children }) => {
  const location = useLocation();
  const isAuthed = authService.isAuthenticated();

  if (!isAuthed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

export default RequireAuth;
