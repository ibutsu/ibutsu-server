import React from 'react';


import { Navigate, Route, Routes } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';

import { UserProfile } from './pages/profile/user';
import { UserTokens } from './pages/profile/tokens';
import './app.css';
import ElementWrapper from './components/elementWrapper';
import ProfilePage from './components/profile-page';


const Profile = () => {
  // TODO useEffect instead of eventEmitter
  const eventEmitter = new EventEmitter();

  return (
    <Routes>
      <Route path="" element={<ProfilePage eventEmitter={eventEmitter}/>}>
        <Route path="user" element={<ElementWrapper routeElement={UserProfile} eventEmitter={eventEmitter} />} />
        <Route path="tokens" element={<ElementWrapper routeElement={UserTokens} eventEmitter={eventEmitter} />} />
        <Route path="*" element={<Navigate to="user" replace />}/>
      </Route>
    </Routes>
  );
}

Profile.propTypes = {

};

export default Profile;
