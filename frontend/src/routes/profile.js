import { Navigate, Route, Routes } from 'react-router';

import UserProfile from '../pages/user-profile';
import UserTokens from '../pages/user-tokens';
import '../app.css';
import ProfilePage from './profile-page';

const Profile = () => (
  <Routes>
    <Route path="" element={<ProfilePage />}>
      <Route path="user" element={<UserProfile />} />
      <Route path="tokens" element={<UserTokens />} />
      {/* Absolute target avoids relative-splat resolution ambiguity (see admin.js) */}
      <Route path="*" element={<Navigate to="/profile/user" replace />} />
    </Route>
  </Routes>
);

export default Profile;
