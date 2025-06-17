import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Card, CardBody, CardFooter, Content } from '@patternfly/react-core';
import DownloadButton from './download-button';
import { Settings } from '../settings';
import { HttpClient } from '../services/http';
import { LogViewer, LogViewerSearch } from '@patternfly/react-log-viewer';

const ArtifactTab = ({ artifact }) => {
  const [blob, setBlob] = useState();
  const [blobType, setBlobType] = useState();
  const [imageUrl, setImageUrl] = useState();

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'artifact',
          artifact.id,
          'view',
        ]);
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
    };
    const debouncer = setTimeout(() => {
      fetchArtifact();
    }, 50);
    return () => {
      clearTimeout(debouncer);
    };
  }, [artifact.id]);

  const cardBody = useMemo(() => {
    if (blob === undefined || blobType === undefined) {
      return <Content component="p">Blob is loading</Content>;
    }
    if (blobType === 'text') {
      return (
        <LogViewer
          key={artifact.id}
          data={blob}
          toolbar={<LogViewerSearch placeholder="Search log" />}
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
