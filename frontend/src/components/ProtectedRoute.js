import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { AuthService } from '../services/auth';

const ProtectedRoute = ({ children, requireSuperAdmin = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthService.isLoggedIn();
        setIsAuthenticated(authenticated);

        if (authenticated && requireSuperAdmin) {
          const superAdmin = await AuthService.isSuperAdmin();
          setIsSuperAdmin(superAdmin);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [requireSuperAdmin]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireSuperAdmin: PropTypes.bool,
};

export default ProtectedRoute;
