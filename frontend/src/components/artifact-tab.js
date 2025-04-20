import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Card, CardBody, CardFooter, Text } from '@patternfly/react-core';
import { Editor } from '@monaco-editor/react';
import DownloadButton from './download-button';
import { Settings } from '../settings';
import { HttpClient } from '../services/http';

const ArtifactTab = ({ artifact }) => {
  const [blob, setBlob] = useState();
  const [blobType, setBlobType] = useState();
  const [imageUrl, setImageUrl] = useState();

  const fetchArtifact = useCallback(async () => {
    try {
      const response = await HttpClient.get([Settings.serverUrl, 'artifact', artifact.id, 'view']);
      const contentType = response.headers.get('Content-Type');
      if (contentType.includes('text')) {
        const text = await response.text();
        setBlob(text);
        setBlobType('text');
      } else if (contentType.includes('image')) {
        const image = await response.blob();
        setBlob(image);
        setBlobType('image');
      } else {
        console.log('bad news bears, artifact is neither image nor text.');
      }
    } catch (error) {
      console.error(error);
    }
  }, [artifact.id]);

  useEffect(() => {
    fetchArtifact();
  }, [fetchArtifact]);

  const cardBody = useMemo(() => {
    if (!blob) {
      return <Text>Blob is loading</Text>;
    }
    if (blobType === 'text') {
      return (
        <Editor
          key={artifact.id}
          fontFamily="Noto Sans Mono, Hack, monospace"
          theme="vs-dark"
          value={blob}
          height="40rem"
          options={{ readOnly: true }}
        />
      );
    } else if (blobType === 'image') {
      return <img key={artifact.id} src={imageUrl} alt={artifact.filename} />;
    }
  }, [blob, blobType, artifact.id, artifact.filename, imageUrl]);

  useEffect(() => {
    if (blobType === 'image' && blob) {
      const objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setImageUrl();
    }
  }, [blob, blobType]);

  return (
    <Card>
      <CardBody>{cardBody}</CardBody>
      <CardFooter>
        <DownloadButton
          url={`${Settings.serverUrl}/artifact/${artifact.id}/download`}
          filename={artifact.filename}
        >
          Download {artifact.filename}
        </DownloadButton>
      </CardFooter>
    </Card>
  );
};

ArtifactTab.propTypes = {
  artifact: PropTypes.object.isRequired,
};

export default ArtifactTab;
