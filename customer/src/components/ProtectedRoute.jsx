import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  // Check if user is logged in
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Check if email is verified
  if (!currentUser.emailVerified) {
    return <Navigate to="/verify-email" />;
  }

  // If all checks pass, render the children
  return children;
}

export default ProtectedRoute;