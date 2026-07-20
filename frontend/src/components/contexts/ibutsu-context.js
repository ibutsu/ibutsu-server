import { createContext, useState } from 'react';
import { getDarkTheme } from '../../utilities';

const IbutsuContext = createContext({ primaryType: 'project' });

const IbutsuContextProvider = (props) => {
  const [primaryType, setPrimaryType] = useState();
  const [primaryObject, setPrimaryObject] = useState();
  const [defaultDashboard, setDefaultDashboard] = useState();
  const [darkTheme, setDarkTheme] = useState(() => getDarkTheme());

  return (
    <IbutsuContext.Provider
      value={{
        primaryType: primaryType,
        setPrimaryType: setPrimaryType,
        primaryObject: primaryObject,
        setPrimaryObject: setPrimaryObject,
        defaultDashboard: defaultDashboard,
        setDefaultDashboard: setDefaultDashboard,
        darkTheme: darkTheme,
        setDarkTheme: setDarkTheme,
      }}
    >
      {props.children}
    </IbutsuContext.Provider>
  );
};

export { IbutsuContext, IbutsuContextProvider };
