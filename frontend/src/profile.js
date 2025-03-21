import React from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import UserProfile from './pages/profile/user';
import UserTokens from './pages/profile/tokens';
import './app.css';
import ProfilePage from './components/profile-page';


const Profile = () => (
  <Routes>
    <Route path="" element={<ProfilePage/>}>
      <Route path="user" element={<UserProfile/>} />
      <Route path="tokens" element={<UserTokens/>} />
      <Route path="*" element={<Navigate to="user" replace />}/>
    </Route>
  </Routes>
);

Profile.propTypes = {};

export default Profile;
