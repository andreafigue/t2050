'use client';

import React, { useState, useEffect } from 'react';
import { Stack, Box, Typography, Divider } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useInteractive } from '../context/InteractiveContext';

const InteractiveStats = () => {
  const {
    MovedPeopleCar,
    MovedPeopleBus,
    MovedPeopleTrain,
    numberOfCars,
    numberOfBuses,
    numberOfTrains,
  } = useInteractive();

  const [expanded, setExpanded] = useState(false);
  const [hasWindow, setHasWindow] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasWindow(true);
    }
  }, []);

  const categories = ['Car', 'Bus', 'Train'];
  const vehicleCategories = ['# Cars', '# Buses', '# Trains'];

  const movedData = [
    Number(MovedPeopleCar ?? 0),
    Number(MovedPeopleBus ?? 0),
    Number(MovedPeopleTrain ?? 0),
  ];
  const vehicleData = [
    Number(numberOfCars ?? 0),
    Number(numberOfBuses ?? 0),
    Number(numberOfTrains ?? 0),
  ];

  const arcData = [
    { id: 0, value: movedData[0], label: 'Car' },
    { id: 1, value: movedData[1], label: 'Bus' },
    { id: 2, value: movedData[2], label: 'Train' },
  ];

  const TOTAL = arcData.reduce((sum, item) => sum + item.value, 0);

  const getArcLabel = (params) => {
    const percent = TOTAL > 0 ? params.value / TOTAL : 0;
    return `${(percent * 100).toFixed(0)}%`;
  };

  useEffect(() => {
    if (movedData.some((val) => val > 0)) {
      setExpanded(true);
    }
  }, [movedData]);

  const isValidData = (data, labels) =>
    Array.isArray(data) &&
    data.length === labels.length &&
    data.every((val) => typeof val === 'number' && !isNaN(val));

  const chartHeight = hasWindow && window.innerWidth < 768 ? 200 : 250;

  return (
    <Accordion
      expanded={expanded}
      sx={{
        width: '100%',
        borderRadius: 2,
        boxShadow: 'none', // remove accordion shadow
      }}
    >
      <AccordionSummary
        expandIcon={<ArrowDownwardIcon />}
        aria-controls="panel1-content"
        id="panel1-header"
      >
        <Typography>
          <b>Interactive stats {expanded ? '' : '- Play to see stats'}</b>
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            width: '100%',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          {hasWindow && isValidData(movedData, categories) && (
            <Box sx={{ width: '100%', maxWidth: 600, flex: 1, boxShadow: 'none' }}>
              <BarChart
                xAxis={[{ scaleType: 'band', data: categories, label: 'Travel Mode' }]}
                series={[{ data: movedData, label: 'People Moved' }]}
                height={chartHeight}
                barLabel="value"
              />
            </Box>
          )}

          <Divider
            orientation={hasWindow && window.innerWidth < 768 ? 'horizontal' : 'vertical'}
            flexItem
          />

          {hasWindow && isValidData(vehicleData, vehicleCategories) && (
            <Box sx={{ width: '100%', maxWidth: 600, flex: 1, boxShadow: 'none' }}>
              <BarChart
                xAxis={[{ scaleType: 'band', data: vehicleCategories, label: 'Vehicle Count' }]}
                series={[{ data: vehicleData, label: 'Number of Vehicles', color: '#CA5833' }]}
                height={chartHeight}
                barLabel="value"
              />
            </Box>
          )}

          {hasWindow && (
            <Box sx={{ width: '100%', maxWidth: 600, flex: 1, boxShadow: 'none' }}>
              <Typography variant="body1" sx={{ textAlign: 'center' }}>
                <b>Travel Mode Distribution</b>
              </Typography>
              <PieChart
                series={[
                  {
                    data: arcData,
                    arcLabel: getArcLabel,
                    paddingAngle: 5,
                    cornerRadius: 10,
                    highlightScope: { fade: 'global', highlight: 'item' },
                    faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                  },
                ]}
                height={chartHeight}
              />
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default InteractiveStats;
