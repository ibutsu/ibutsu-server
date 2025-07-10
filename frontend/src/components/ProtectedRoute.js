import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { AuthService } from '../services/auth';

const ProtectedRoute = ({ children, requireSuperAdmin = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading, false = not authenticated, true = authenticated
  const [isSuperAdmin, setIsSuperAdmin] = useState(null); // null = loading/unknown, false = not super admin, true = super admin
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthService.isLoggedIn();
        setIsAuthenticated(authenticated);

        if (authenticated && requireSuperAdmin) {
          const superAdmin = await AuthService.isSuperAdmin();
          setIsSuperAdmin(superAdmin);
        } else if (authenticated && !requireSuperAdmin) {
          // If we don't require super admin, set it to true to avoid blocking
          setIsSuperAdmin(true);
        } else {
          // Not authenticated, set super admin to false
          setIsSuperAdmin(false);
        }
      } catch (error) {
        console.error('ProtectedRoute: Auth check failed:', error);
        setIsAuthenticated(false);
        setIsSuperAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [requireSuperAdmin]);

  if (isLoading || isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && (isSuperAdmin === null || isSuperAdmin === false)) {
    if (isSuperAdmin === null) {
      return <div>Loading...</div>;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireSuperAdmin: PropTypes.bool,
};

export default ProtectedRoute;
