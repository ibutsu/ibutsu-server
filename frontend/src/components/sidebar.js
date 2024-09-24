
import React, { useContext, useState } from "react";
import PropTypes from 'prop-types';

import { Link } from 'react-router-dom';
import { IbutsuContext } from "../services/context";
import {  PageSidebar,
    PageSidebarBody,
    Nav,
    NavList,
    } from '@patternfly/react-core';
import { HttpClient } from "../services/http";
import { Settings } from "../settings";


const IbutsuSidebar = (props) => {
    const context = useContext(IbutsuContext);
    const [views, setViews] = useState();
    props.eventEmitter.on('projectChange', (project) => {
        setProjectViews(project);
    })
    // TODO: useEffect for view reset on project change


    function setProjectViews(project) {
        const { primaryObject } = context;
        const targetProject = project ?? primaryObject;
        if (!targetProject) {return;}

        let params = {'filter': ['type=view', 'navigable=true']};

        // read selected project from location
        params['filter'].push('project_id=' + targetProject.id);

        HttpClient.get([Settings.serverUrl, 'widget-config'], params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
            //debugger; //eslint-disable-line no-debugger

            data.widgets.forEach(widget => {
            if (targetProject) {
                widget.params['project'] = targetProject.id;
            }
            else {
                delete widget.params['project'];
            }
            });
            setViews(data.widgets)})
        .catch(error => console.log(error));
        }

    const { primaryType, primaryObject } = context;
    if ( primaryType == 'project' && primaryObject  ) {
        if (! views ) {setProjectViews(primaryObject);}
        return (
        <PageSidebar theme="dark" >
            <PageSidebarBody>
                <Nav theme="dark" aria-label="Nav">
                    <NavList>
                        <li className="pf-v5-c-nav__item">
                            <Link to="dashboard" className="pf-v5-c-nav__link">Dashboard</Link>
                        </li>
                        <li className="pf-v5-c-nav__item">
                            <Link to="runs/" className="pf-v5-c-nav__link">Runs</Link>
                        </li>
                        <li className="pf-v5-c-nav__item">
                            <Link to="results/" className="pf-v5-c-nav__link">Test Results</Link>
                        </li>
                        <li className="pf-v5-c-nav__item">
                            <Link to="reports/" className="pf-v5-c-nav__link">Report Builder</Link>
                        </li>
                        {views && views.map(view => (
                            view.widget !== "jenkins-analysis-view" && (
                            <li className="pf-v5-c-nav__item" key={view.id}>
                            <Link to={`view/${view.id}`} className="pf-v5-c-nav__link">{view.title}</Link>
                            </li>
                            )
                        ))}
                    </NavList>
                </Nav>
            </PageSidebarBody>
        </PageSidebar>
        );
    }
};

IbutsuSidebar.propTypes = {
    eventEmitter: PropTypes.object,
};

export default IbutsuSidebar;
