import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Card, CardBody, CardFooter, Text } from '@patternfly/react-core';
import { Editor } from '@monaco-editor/react';
import DownloadButton from './download-button';
import { Settings } from '../settings';
import { HttpClient } from '../services/http';


const ArtifactTab = (props) => {
  const {artifact, } = props;

  const [blob, setBlob] = useState();
  const [blobType, setBlobType ]= useState();

  useEffect(()=>{
    HttpClient.get([Settings.serverUrl, 'artifact', artifact.id, 'view'])
      .then(response => {
        let contentType = response.headers.get('Content-Type');
        if (contentType.includes('text')) {
          response.text().then(text => {
            setBlob(text);
            setBlobType('text');
          });
        }
        else if (contentType.includes('image')) {
          response.blob().then(image => {
            setBlob(image);
            setBlobType('image');
          });
        } else {
          console.log('bad news bears, artifact is neither image nor text.');
        }
      })
      .catch((error) => console.error(error));
  }, [artifact]);



  let cardBody = <Text>Blob is loading</Text>;
  if (blobType === 'text') {
    cardBody = <Editor
      key={artifact.id}
      fontFamily="Noto Sans Mono, Hack, monospace"
      theme="vs-dark"
      value={blob}
      height="40rem"
      options={{readOnly: true}}
    />;
  } else if (blobType === 'image') {
    cardBody = <img
      key={artifact.id}
      src={URL.createObjectURL(blob)}
      alt={artifact.filename}
    />;
  }
  return (
    <Card>
      <CardBody>
        {cardBody}
      </CardBody>
      <CardFooter>
        <DownloadButton
          url={`${Settings.serverUrl}/artifact/${artifact.id}/download`}
          filename={artifact.filename}
        >Download {artifact.filename}</DownloadButton>
      </CardFooter>
    </Card>
  );
};

ArtifactTab.propTypes = {
  artifact: PropTypes.object
};

export default ArtifactTab;
