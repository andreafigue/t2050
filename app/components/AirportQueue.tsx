"use client";

import React from 'react';
import { User } from 'lucide-react';
//import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Global, css } from '@emotion/react';

import Card from '@mui/material/Card';
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";

const AirportQueueViz = () => {
 const currentQueueLength = 15;
 const futureQueueLength = 45;
 const precheckLength = 6;
 const futurePrecheckLength = 23;

 const StanchionPost = () => (
 <div className="flex flex-col items-center">
 <div className="w-2 h-2 rounded-full bg-gray-600" />
 <div className="w-1 h-8 bg-gray-600" />
 <div className="w-3 h-1 rounded-full bg-gray-600" />
 </div>
 );

 const QueueRow = ({ count, showBarrier = true, isPre = false }) => (
 <div className="relative flex items-center">
 <div className="flex gap-2">
 {Array(count).fill(0).map((_, i) => (
 <User
 key={i}
 size={20}
 className={isPre ? "text-emerald-600" : "text-blue-600"}
 />
 ))}
 </div>
 {showBarrier && (
 <div className="absolute top-4 w-1/2 border-t-2 border-gray-400"
 style={{ zIndex: -1 }} />
 )}
 </div>
 );

 const Queue = ({ total, label, description, isPre = false, hideVerticalLines = false }) => {
 const rowCapacity = 6;
 const rows = Math.ceil(total / rowCapacity);

 return (
 <div className="mb-4 ">
 <h3 style={{fontFamily: "Encode Sans Compressed, sans-serif"}} className={`text-lg font-semibold mb-2 ${isPre ? "text-emerald-600" : "text-blue-600"}`}>
 {label}
 </h3>
 <p style={{fontFamily: "Encode Sans Compressed, sans-serif"}} className="text-base font-bold text-gray-700 mb-0">{description}</p>
 <div className="relative border-2 border-gray-200 p-4 rounded-lg bg-gray-50">
 <div className="flex flex-col gap-8">
 {Array(rows).fill(0).map((_, i) => (
 <div key={i} className="relative flex">
 <div className="absolute -left-2 -top-2">
 <StanchionPost />
 </div>
 <QueueRow
 count={Math.min(rowCapacity, total - i * rowCapacity)}
 showBarrier={i !== rows - 1}
 isPre={isPre}
 />
 </div>
 ))}
 </div>

 {/* Vertical barriers only if not hidden */}
 {!hideVerticalLines && Array(rows - 1).fill(0).map((_, i) => (
 <div
 key={`barrier-${i}`}
 className="absolute border-l-2 border-gray-400 h-8"
 style={{
 left: '0',
 top: `${(i * 8) + 6}rem`,
 }}
 />
 ))}

 <div className="mt-8 pt-4 border-t border-gray-200">
 <div className="flex items-center gap-2">
 <User size={20} className={isPre ? "text-emerald-600" : "text-blue-600"} />
 <span className="text-sm text-gray-600">= 2 minute wait</span>
 </div>
 </div>
 </div>
 </div>
 );
 };

 const QueueCard = ({ swapped = false, showPreCheck = true, showStandard = true }) => (
 <Card className="w-1/2 max-w-2xl">
 <CardHeader>
 {/*<CardTitle>*/}
 Airport Security Wait Times
 {/*</CardTitle>*/}
 </CardHeader>
 <CardContent>
 <div className={`grid grid-cols-1 ${(showPreCheck && showStandard) ? 'md:grid-cols-2' : ''} gap-6`}>
 <div>
 {swapped ? (
 showPreCheck && (
 <>
 <Queue
 total={precheckLength}
 label="TSA PreCheck Line"
 description="~12 minutes during peak hours"
 isPre={true}
 hideVerticalLines={true}
 />
 <div className="mt-8">
 <Queue
 total={futurePrecheckLength}
 label="Projected 2050 PreCheck Line"
 description="~46 minutes during peak hours"
 isPre={true}
 hideVerticalLines={true}
 />
 </div>
 </>
 )
 ) : (
 showStandard && (
 <>
 <Queue
 total={currentQueueLength}
 label="Standard Security Line"
 description="~30 minutes during peak hours"
 hideVerticalLines={true}
 />
 <Queue
 total={futureQueueLength}
 label="Projected 2050 Standard Line"
 description="~90 minutes during peak hours"
 hideVerticalLines={true}
 />
 </>
 )
 )}
 </div>
 {(showPreCheck || showStandard) && (
 <div>
 {swapped ? (
 showStandard && (
 <>
 <Queue
 total={currentQueueLength}
 label="Standard Security Line"
 description="~30 minutes during peak hours"
 hideVerticalLines={true}
 />
 <Queue
 total={futureQueueLength}
 label="Projected 2050 Standard Line"
 description="~90 minutes during peak hours"
 hideVerticalLines={true}
 />
 </>
 )
 ) : (
 showPreCheck && (
 <>
 <Queue
 total={precheckLength}
 label="TSA PreCheck Line"
 description="~12 minutes during peak hours"
 isPre={true}
 />
 <Queue
 total={futurePrecheckLength}
 label="Projected 2050 PreCheck Line"
 description="~46 minutes during peak hours"
 isPre={true}
 />
 </>
 )
 )}
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 );

 return (
 <div className="flex gap-8 justify-center">
 <QueueCard swapped={false} showPreCheck={false} showStandard={true} />
 <QueueCard swapped={true} showPreCheck={true} showStandard={false} />
 </div>
 );
};

export default AirportQueueViz;