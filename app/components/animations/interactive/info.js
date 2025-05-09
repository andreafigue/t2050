'use client';

import { Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { styled } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

const GameTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "'Press Start 2P', 'Orbitron', sans-serif",
  color: '#ff6b00',
  textTransform: 'uppercase',
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
  background: 'linear-gradient(45deg, #ff6b00, #ff8533)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  padding: '10px 0',
  letterSpacing: '2px',
  fontWeight: 'bold',
}));

const InteractiveInfo = () => {


  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <Accordion sx={{ width: '100%' }}>
        <AccordionSummary
          expandIcon={<InfoIcon fontSize="large" color="primary" />}
          aria-controls="panel1-content"
          id="panel1-header"
        >
          <Typography variant="body1" fontWeight="bold">
            How To Play
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ overflowWrap: 'break-word' }}>
          <Typography variant="body1">
            The objective is to visualize the capacity of each transportation mode and traffic implications.
          </Typography>
          <Typography variant="body1">
            You can add cars, buses, and trains by clicking on them. You may have to wait for a random number of seconds before adding more.
          </Typography>
          <Typography variant="body1">
            To remove a car, bus, or train, click on the minus button next to it.
          </Typography>
          <Typography variant="body1">
            The number of people moved in the car, bus, or train will be displayed on the screen.
          </Typography>
          <Typography variant="body1">
            The congestion will be displayed as a graph. RED is backed up, and GREEN is free-flowing.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default InteractiveInfo;
