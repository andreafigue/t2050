'use client';

import { useEffect, useRef } from 'react';

const MapWrapper = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const initializeMap = () => {
      const iframe = iframeRef.current;

      if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(`
              <head>
			    <meta charset="UTF-8" />
			    <script type="module" crossorigin src="/lib/mapbox-app.js"></script>
			    <link rel="stylesheet" crossorigin href="/lib/mapbox-app.css">
			  </head>
			  <body>
			    <div id="root"></div>
			  </body>
          `);
          iframeDoc.close();
        }
      }
    };

    initializeMap();
  }, []);

  return (
    <div style={{ width: '100%', height: '800px'}}>
      <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none' }} />
    </div>
  );
};

export default MapWrapper;
