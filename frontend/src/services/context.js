import React, {createContext, useState} from 'react';
import PropTypes from 'prop-types';
import { getDarkTheme } from '../utilities';


const IbutsuContext = createContext({primaryType: 'project'});

const IbutsuContextProvider = (props) => {
    const [primaryType, setPrimaryType] = useState();
    const [primaryObject, setPrimaryObject] = useState();
    const [defaultDashboard, setDefaultDashboard] = useState();
    const [darkTheme, setDarkTheme] = useState(getDarkTheme());

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
                setDarkTheme: setDarkTheme
            }}>
                {props.children}
        </IbutsuContext.Provider>
    );
}

IbutsuContextProvider.propTypes = {
    children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
}

export {IbutsuContext, IbutsuContextProvider};
