import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';

import {
  Button,
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
import FilterTable from '../../components/filtering/filtered-table-card';
import AddTokenModal from '../../components/add-token-modal';
import DeleteModal from '../../components/delete-modal';
import { ALERT_TIMEOUT } from '../../constants';
import usePagination from '../../components/hooks/usePagination';

const COLUMNS = ['Name', 'Token', 'Expires', ''];

const UserTokens = () => {
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [isError, setIsError] = useState(false);
  const [isAddTokenOpen, setIsAddTokenOpen] = useState(false);
  const [isDeleteTokenOpen, setIsDeleteTokenOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState();

  const {
    page,
    setPage,
    onSetPage,
    pageSize,
    setPageSize,
    onSetPageSize,
    totalItems,
    setTotalItems,
  } = usePagination({});

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
    const fetchTokens = async () => {
      setFetching(true);

      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'user', 'token'],
          {
            page: page,
            pageSize: pageSize,
          },
        );
        const data = await HttpClient.handleResponse(response);
        if (data?.tokens?.length > 0) {
          setRows(data.tokens.map((t) => tokenToRow(t)));
          setFetching(false);

          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
        } else {
          setRows([]);
          setFetching(false);
        }
      } catch (error) {
        console.error('Error fetching token data:', error);
        setRows([]);
        setIsError(true);
        setFetching(false);
      }
    };

    fetchTokens();
  }, [
    page,
    pageSize,
    isAddTokenOpen,
    isDeleteTokenOpen,
    setPage,
    setPageSize,
    setTotalItems,
  ]); // extra deps to trigger fetch on modal close

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
        <FilterTable
          columns={COLUMNS}
          rows={rows}
          pageSize={pageSize}
          page={page}
          totalItems={totalItems}
          isError={isError}
          onSetPage={onSetPage}
          onSetPageSize={onSetPageSize}
          fetching={fetching}
        />
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
