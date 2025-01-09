import React, {createContext, useState} from 'react';
import PropTypes from 'prop-types';


const IbutsuContext = createContext({primaryType: 'project'});

const IbutsuContextProvider = (props) => {
    const [primaryType, setPrimaryType] = useState();
    const [primaryObject, setPrimaryObject] = useState();
    const [defaultDashboard, setDefaultDashboard] = useState();

    return (
        <IbutsuContext.Provider
            value={{
                primaryType: primaryType,
                setPrimaryType: setPrimaryType,
                primaryObject: primaryObject,
                setPrimaryObject: setPrimaryObject,
                defaultDashboard: defaultDashboard,
                setDefaultDashboard: setDefaultDashboard,
            }}>
                {props.children}
        </IbutsuContext.Provider>
    );
}

IbutsuContextProvider.propTypes = {
    children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
}

export {IbutsuContext, IbutsuContextProvider};
