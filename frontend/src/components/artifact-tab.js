import { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  CardExpandableContent,
  CardHeader,
  CodeBlock,
  CodeBlockCode,
  Content,
} from '@patternfly/react-core';
import DownloadButton from './download-button';
import { Settings } from '../settings';
import { HttpClient } from '../services/http';

const ArtifactTab = ({ artifact }) => {
  const [blob, setBlob] = useState();
  const [blobType, setBlobType] = useState();
  const [imageUrl, setImageUrl] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const imageUrlRef = useRef();

  useEffect(() => {
    const fetchArtifact = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };

    // Reset state when artifact changes
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = undefined;
    }
    setBlob();
    setBlobType();
    setImageUrl();

    const debouncer = setTimeout(() => {
      fetchArtifact();
    }, 50);
    return () => {
      clearTimeout(debouncer);
    };
  }, [artifact.id]);

  const cardBody = useMemo(() => {
    if (isLoading) {
      return <Content component="p">Blob is loading</Content>;
    }

    if (!isLoading && (!blob || !blobType)) {
      return <Content component="p">Unable to load artifact</Content>;
    }

    if (blobType === 'text' && typeof blob === 'string') {
      // raw string to preserve newlines and tabs
      return (
        <CodeBlock>
          <CodeBlockCode>
            {blob.length ? String.raw`${blob}` : 'Log artifact is empty.'}
          </CodeBlockCode>
        </CodeBlock>
      );
    } else if (blobType === 'image') {
      return <img key={artifact.id} src={imageUrl} alt={artifact.filename} />;
    }

    return <Content component="p">Unsupported artifact type</Content>;
  }, [blob, blobType, artifact.id, artifact.filename, imageUrl, isLoading]);

  useEffect(() => {
    if (blobType === 'image' && blob) {
      const objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);
      imageUrlRef.current = objectUrl;
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setImageUrl();
      imageUrlRef.current = undefined;
    }
  }, [blob, blobType]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Revoke any existing image URL on component unmount
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
    };
  }, []);

  return (
    <Card isExpanded={isExpanded}>
      <CardHeader onExpand={() => setIsExpanded(!isExpanded)}>
        <DownloadButton
          url={`${Settings.serverUrl}/artifact/${artifact.id}/download`}
          filename={artifact.filename}
        >
          Download {artifact.filename}
        </DownloadButton>
      </CardHeader>
      <CardExpandableContent>
        <CardBody>{cardBody}</CardBody>
      </CardExpandableContent>
    </Card>
  );
};

ArtifactTab.propTypes = {
  artifact: PropTypes.object.isRequired,
};

export default ArtifactTab;
