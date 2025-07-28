'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import InteractiveGame (defined below)
const InteractiveGame = dynamic(() => Promise.resolve(ActualInteractiveGame), { ssr: false });

export default function InteractiveGameWrapper() {
  return <InteractiveGame />;
}

// --------------------------------------------------
// Below is the actual InteractiveGame component
// You can move this out into a separate file later.
// --------------------------------------------------

import Cars from './animations/interactive/Cars';
import Buses from './animations/interactive/Buses';
import Trains from './animations/interactive/Trains';
import InteractiveInfo from './animations/interactive/info';
import InteractiveStats from './animations/interactive/InteractiveStats';
import { InteractiveProvider } from './animations/context/InteractiveContext';

import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

function ActualInteractiveGame() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box
          className="p-4"
          sx={{
            height: '100%',
            width: '100%',
            display: 'flex',
            background: '#f4f4f4',
            borderRadius: 2,
            overflowX: 'hidden',
            overflowY: 'hidden',
            flexDirection: 'column',
          }}
        >
          <Stack spacing={2} sx={{ width: '100%' }}>
            <InteractiveInfo />
            <InteractiveProvider>
              <Cars />
              <Buses />
              <Trains />
              <InteractiveStats />
            </InteractiveProvider>
          </Stack>
        </Box>
      </Container>
    </>
  );
}
