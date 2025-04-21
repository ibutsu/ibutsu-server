import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';

import {
  Button,
  Card,
  CardBody,
  ClipboardCopy,
  Flex,
  FlexItem,
  PageSection,
  PageSectionVariants,
  TextContent,
  Title,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { getSpinnerRow } from '../../utilities';
import FilterTable from '../../components/filtertable';
import AddTokenModal from '../../components/add-token-modal';
import DeleteModal from '../../components/delete-modal';
import { ALERT_TIMEOUT } from '../../constants';

const COLUMNS = ['Name', 'Token', 'Expires', ''];

const UserTokens = () => {
  const [tokens, setTokens] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isAddTokenOpen, setIsAddTokenOpen] = useState(false);
  const [isDeleteTokenOpen, setIsDeleteTokenOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState();

  const tokenToRow = (token) => ({
    cells: [
      { title: token.name },
      {
        title: (
          <ClipboardCopy
            isReadOnly
            hoverTip="Copy to clipboard"
            clickTip="Copied!"
          >
            {token.token}
          </ClipboardCopy>
        ),
      },
      { title: token.expires },
      {
        title: (
          <Button
            variant="danger"
            onClick={() => {
              setTokenToDelete(token);
              setIsDeleteTokenOpen(true);
            }}
          >
            Delete
          </Button>
        ),
      },
    ],
  });

  useEffect(() => {
    setFetching(true);

    HttpClient.get([Settings.serverUrl, 'user', 'token'], {
      page: page,
      pageSize: pageSize,
    })
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        if (data?.tokens?.length > 0) {
          setTokens(data.tokens);
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
        } else {
          setTokens([]);
        }
      })
      .catch((error) => {
        console.error('Error fetching token data:', error);
        setTokens([]);
        setIsError(true);
      });

    setFetching(false);
  }, [page, pageSize, isAddTokenOpen, isDeleteTokenOpen]); // extra deps to trigger fetch on modal close

  useEffect(() => {
    document.title = 'User Tokens | Ibutsu';
  }, []);

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem spacer={{ default: 'spacerLg' }}>
            <TextContent>
              <Title headingLevel="h1">Tokens</Title>
            </TextContent>
          </FlexItem>
          <FlexItem>
            <Button
              aria-label="Add token"
              variant="secondary"
              title="Add token"
              onClick={() => setIsAddTokenOpen(true)}
            >
              <PlusCircleIcon /> Add Token
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
      <PageSection>
        <Card>
          <CardBody className="pf-u-p-0">
            <FilterTable
              columns={COLUMNS}
              rows={
                !fetching
                  ? tokens.map((t) => tokenToRow(t))
                  : [getSpinnerRow(4)]
              }
              pagination={{
                pageSize: pageSize,
                page: page,
                totalItems: totalItems,
              }}
              isEmpty={!fetching && tokens.length === 0}
              isError={isError}
              onSetPage={(_, value) => {
                setPage(value);
              }}
              onSetPageSize={(_, value) => {
                setPageSize(value);
              }}
            />
          </CardBody>
        </Card>
      </PageSection>
      <AddTokenModal
        isOpen={isAddTokenOpen}
        onClose={() => setIsAddTokenOpen(false)}
      />
      <DeleteModal
        title="Delete token"
        body="Would you like to delete the selected token?"
        toDeleteId={tokenToDelete?.id}
        toDeletePath={['user', 'token']}
        isOpen={isDeleteTokenOpen}
        onClose={() => {
          setTokenToDelete();
          setIsDeleteTokenOpen(false);
        }}
      />
      <ToastContainer autoClose={ALERT_TIMEOUT} stacked />
    </React.Fragment>
  );
};

UserTokens.propTypes = {};

export default UserTokens;
