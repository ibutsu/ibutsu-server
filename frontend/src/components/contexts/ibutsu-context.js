import { createContext, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { getDarkTheme } from '../../utilities';

const IbutsuContext = createContext({ primaryType: 'project' });

const IbutsuContextProvider = (props) => {
  const [primaryType, setPrimaryType] = useState();
  const [primaryObject, setPrimaryObject] = useState();
  const [defaultDashboard, setDefaultDashboard] = useState();
  const [darkTheme, setDarkTheme] = useState(getDarkTheme());

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      primaryType,
      setPrimaryType,
      primaryObject,
      setPrimaryObject,
      defaultDashboard,
      setDefaultDashboard,
      darkTheme,
      setDarkTheme,
    }),
    [
      primaryType,
      setPrimaryType,
      primaryObject,
      setPrimaryObject,
      defaultDashboard,
      setDefaultDashboard,
      darkTheme,
      setDarkTheme,
    ],
  );

  return (
    <IbutsuContext.Provider value={contextValue}>
      {props.children}
    </IbutsuContext.Provider>
  );
};

IbutsuContextProvider.propTypes = {
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export { IbutsuContext, IbutsuContextProvider };
