import React from 'react';
import { Stack, Box, Typography, Divider } from '@mui/material';
import { Gauge } from '@mui/x-charts/Gauge';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import Accordion from '@mui/material/Accordion';
//import AccordionSummary from '@mui/material/AccordionSummary';
//import AccordionDetails from '@mui/material/AccordionDetails';
//import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useFreight } from '../context/FreightContext';

const FreightStats = () => {
  
    const { deliveredTonnageTruck, deliveredTonnageTrain, deliveredTonnagePlane, deliveredTonnageShip, numberOfTrucks, numberOfTrains, numberOfPlanes, numberOfShips } = useFreight();
    
    const arcData = [
        { id: 0, value: deliveredTonnageTruck, label: 'Truck' },
        { id: 1, value: deliveredTonnageTrain, label: 'Train' },
        { id: 2, value: deliveredTonnagePlane, label: 'Plane' },
        { id: 3, value: deliveredTonnageShip, label: 'Ship' },
    ];

    const TOTAL = arcData.map((item) => item.value).reduce((a, b) => a + b, 0);


    const getArcLabel = (params) => {
      const percent = params.value / TOTAL;
      return `${(percent * 100).toFixed(0)}%`;
    };

    return (
    <Accordion defaultExpanded slotProps={{ heading: { component: 'h4' } }} sx={{
      width: "100%",
    }}>
      <AccordionSummary 
        expandIcon={<ArrowDownwardIcon/>}
        aria-controls="panel1-content"
        id="panel1-header"
      >
        <Typography>
          <b>Freight stats</b>
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack direction={ {xs: "column", md: "row"} } spacing={1}>
            <BarChart
                // yAxis={[{label: 'Tons'}]}
                xAxis={[{ scaleType: 'band', data: ['Truck', 'Train', 'Plane', 'Ship'], label: 'Freight Mode' }]}
                series={[{ 
                    data: [deliveredTonnageTruck, deliveredTonnageTrain, deliveredTonnagePlane, 
                        deliveredTonnageShip],
                    label: 'Freight moved in Tons'
                }]}
                width={ window.innerWidth < 768 ? 300 : 400}
                height={ window.innerWidth < 768 ? 200 : 250}
                borderRadius={10}
                barLabel="value"
                grid={ {vertical: true, horizontal: true} }
            />
            <Divider orientation={ window.innerWidth < 768 ? "horizontal" : "vertical" } flexItem />
            <BarChart
                xAxis={[{ scaleType: 'band', data: ['# Trucks', '# Trains', '# Planes', '# Ships'], label: 'Freight Mode' }]}
                // yAxis={[{label: 'Number of Vehicles'}]}
                series={[{ 
                    data: [numberOfTrucks, numberOfTrains, numberOfPlanes, numberOfShips],
                    color: '#CA5833',
                    label: 'Number of Vehicles'
                }]}
                width={ window.innerWidth < 768 ? 300 : 400}
                height={ window.innerWidth < 768 ? 200 : 250}
                borderRadius={10}
                barLabel="value"
                grid={ {vertical: true, horizontal: true} }
            />
          {/* Additional metrics and graphs can be added here */}
          <Box>
          <Typography variant="body1" sx={{ textAlign: 'center' }}>
            <b>Freight Mode Distribution</b>
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
                // startAngle: -45,
                // endAngle: 225,
              },
            ]}
            width={ window.innerWidth < 768 ? 300 : 350}
            height={ window.innerWidth < 768 ? 200 : 200}
          />
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default FreightStats; 