/* FP Analyzer v3 · prototype runtime
   Builds the review bar, the app shell (company or platform), screen routing by #hash,
   the Ask FP assistant (every page), and small helpers (tabs, pickers, timers, toasts).
   A module page is: <body data-module="S08"> + <main id="screens"> with <section class="screen" id="..."> children. */
(function(){
'use strict';

/* ---------- icons ---------- */
var P={
 grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
 live:'<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
 pie:'<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
 stopc:'<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
 box:'<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
 checks:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
 wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
 board:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
 file:'<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/>',
 cal:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="6.6"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
 bell:'<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
 monitor:'<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
 chev:'<path d="M9 6l6 6-6 6"/>', chevd:'<path d="M7 10l5 5 5-5"/>', chevl:'<path d="M15 6l-6 6 6 6"/>', chevu:'<path d="M7 14l5-5 5 5"/>',
 play:'<path d="M8 5.5v13l10.5-6.5z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
 stop:'<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
 q:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.4"/><path d="M12 17h.01"/>',
 hand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 4.4-2.6 8-6.5 8-2.4 0-4-1.2-5.3-3.2L3.6 14.6a1.5 1.5 0 0 1 2.5-1.7L8 15.5"/>',
 swap:'<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
 wifioff:'<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.4-1.7M2 9.5a14 14 0 0 1 4.3-2.6M12 20h.01"/>',
 wifi:'<path d="M2 9.5a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01"/>',
 up:'<path d="M12 19V5M6 11l6-6 6 6"/>', down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
 send:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 share:'<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V20h14v-7.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
 trash:'<path d="M5 7h14M9.5 7V4.5h5V7M7 7l1 13h8l1-13"/>',
 user:'<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
 users:'<circle cx="9" cy="9" r="3.3"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="8" r="2.6"/><path d="M16 13.5a5 5 0 0 1 5.5 5"/>',
 lock:'<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
 unlock:'<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1.2"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 6.5l2.5 2.5M14 8.5l2 2"/>',
 shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/>',
 shieldok:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
 phone:'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
 camera:'<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>',
 clip:'<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3L14.5 7"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 alert:'<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
 filter:'<path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8z"/>',
 download:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>', upload:'<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 4.5l1.5-2M20 20v-4.5h-4.5"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z"/>',
 building:'<path d="M4 20.5V6l8-3v17.5M12 9h8v11.5M7.5 8.5h1.5M7.5 12h1.5M7.5 15.5h1.5M15.5 12.5H17M15.5 16H17M2.5 20.5h19"/>',
 factory:'<path d="M3 20.5V10l5 3V10l5 3V10l5 3V4h3v16.5z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
 cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
 signal:'<path d="M5 18v-3M9.5 18v-6M14 18V9M18.5 18V6"/>',
 layers:'<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="M3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5"/>',
 tree:'<rect x="9" y="3" width="6" height="4.5" rx="1"/><rect x="3" y="16.5" width="6" height="4.5" rx="1"/><rect x="15" y="16.5" width="6" height="4.5" rx="1"/><path d="M12 7.5v4.5M6 16.5V12h12v4.5"/>',
 map:'<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
 folder:'<path d="M3.5 6.5a1 1 0 0 1 1-1H9l2 2.5h8.5a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>',
 tag:'<path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.5"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
 chart:'<path d="M4 20.5h16"/><rect x="5.5" y="11" width="3" height="7" rx=".8"/><rect x="10.5" y="6" width="3" height="12" rx=".8"/><rect x="15.5" y="13" width="3" height="5" rx=".8"/>',
 trend:'<path d="M3.5 17.5 9 12l4 4 7.5-8"/><path d="M15 8h5.5v5.5"/>',
 card:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
 star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
 flag:'<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
 bolt:'<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
 power:'<path d="M12 3v8M7 6.5a7 7 0 1 0 10 0"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 more:'<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
 drag:'<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
 logout:'<path d="M14 4.5H6.5v15H14"/><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>',
 qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M16 16h2v2"/>',
 badge:'<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17a4 4 0 0 1 8 0"/><path d="M10 3.5V2h4v1.5"/>',
 pin:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M12 17h.01"/>',
 timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>',
 history:'<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5M4 4v4.5h4.5"/><path d="M12 8v4.5l3 1.8"/>',
 archive:'<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V20h14V8.5M10 12.5h4"/>',
 merge:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 7c0 4 4 5 10 5"/>',
 split:'<path d="M12 3v18M4 8l-1.5 4L4 16M20 8l1.5 4L20 16M6 12h3M15 12h3"/>',
 db:'<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
 server:'<rect x="3.5" y="4" width="17" height="7" rx="1.5"/><rect x="3.5" y="13" width="17" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
 cloud:'<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18.5z"/>',
 code:'<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
 plug:'<path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21"/>',
 inbox:'<path d="M3.5 13.5 6 5h12l2.5 8.5V19H3.5z"/><path d="M3.5 13.5H9l1 2h4l1-2h5.5"/>',
 thumbup:'<path d="M7.5 10.5v9H4.5v-9zM7.5 10.5 11 3.5a2 2 0 0 1 2.5 2V9h5a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7.5"/>',
 thumbdown:'<path d="M7.5 13.5v-9H4.5v9zM7.5 13.5 11 20.5a2 2 0 0 0 2.5-2V15h5a2 2 0 0 0 2-2.3l-1.2-6.5a2 2 0 0 0-2-1.7H7.5"/>',
 book:'<path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z"/>',
 video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5 21 7.5v9l-5-3"/>',
 mega:'<path d="M3.5 10v4h3l8 4.5v-13l-8 4.5zM18 9a4 4 0 0 1 0 6"/>',
 help:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
 scan:'<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16"/>',
 print:'<path d="M7 8V3.5h10V8M7 17H4.5V8h15v9H17"/><rect x="7" y="13.5" width="10" height="7" rx="1"/>',
 tv:'<rect x="2.5" y="4.5" width="19" height="12.5" rx="1.5"/><path d="M8 21h8"/>',
 tablet:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M18 12h.01"/>',
 battery:'<rect x="3" y="7.5" width="16" height="9" rx="2"/><path d="M21 10.5v3M6 10.5v3M9 10.5v3"/>',
 vol:'<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
 translate:'<path d="M3.5 5.5h9M8 3.5v2c0 4-2 7-5 8.5M5.5 9.5c1 2 3 3.5 5.5 4.5"/><path d="M12.5 20.5 16.5 11l4 9.5M14 17h5"/>',
 target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
 gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/>',
 fish:'<path d="M2.5 12h15M6 12 3.5 7.5M6 12l-2.5 4.5M10 12 7.5 7.5M10 12l-2.5 4.5M14 12l-2.5-4.5M14 12l-2.5 4.5"/><path d="M17.5 8.5h4v7h-4z"/>',
 ladder:'<path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"/>',
 msg:'<path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z"/>',
 home:'<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/>',
 dollar:'<path d="M12 3v18M16.5 7c-.8-1.4-2.5-2.2-4.5-2.2-2.6 0-4.5 1.4-4.5 3.4 0 4.6 9.5 2.4 9.5 7.2 0 2-2 3.5-5 3.5-2.2 0-4-.9-5-2.5"/>',
 percent:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
 rocket:'<path d="M5 15c-1.5 1-2 3.5-2 6 2.5 0 5-.5 6-2M9.5 18.5l-4-4c1-4.5 5-11 14-11-.3 9-6.5 13-10 15z"/><circle cx="14.5" cy="9.5" r="1.8"/>'
};
var sprite='<svg width="0" height="0" style="position:absolute" aria-hidden="true">'+
 '<symbol id="mark" viewBox="0 0 40 40">'+
 [[0,1],[1,2],[2,3],[3,4]].map(function(c){var x=4.5+c[0]*8,f=['#A6EAF2','#5ED6E6','#01B9D0','#0096AD'][c[0]],s='';for(var k=0;k<c[1];k++){s+='<rect x="'+x+'" y="'+(29-k*8)+'" width="7" height="7" rx="1.6" fill="'+f+'"/>';}return s;}).join('')+'</symbol>'+
 Object.keys(P).map(function(k){return '<symbol id="i-'+k+'" viewBox="0 0 24 24">'+P[k]+'</symbol>';}).join('')+'</svg>';
function ic(n,c){return '<svg class="i'+(c?' '+c:'')+'"><use href="#i-'+n+'"/></svg>';}

/* ---------- catalogue of every v3 screen (from docs/lld S00-S20 §5) ---------- */
var C=[
 {id:'S00',file:'s00-platform-foundation',title:'Platform foundation',shell:'platform',nav:'p-health',ask:['Which jobs failed in the last hour?','Is any company behind on migrations?','What changed in the configuration today?'],
  s:[['health','System health'],['jobs','Jobs','p-jobs'],['migrations','Migrations','p-migr'],['config','Configuration and flags','p-config']]},
 {id:'S01',file:'s01-identity-access',title:'Sign-in, people and access',nav:'people',ask:['Who has not logged in for 30 days?','Which roles can export data?','How many seats are left on our plan?'],
  s:[['login','Login','auth'],['mfa','Two-step code','auth'],['mfa-setup','Two-step setup','auth'],['company-picker','Company picker','auth'],['invite','Accept invitation','auth'],['reset','Forgot / reset password','auth'],
     ['account','My account','me'],['members','Members'],['member','Member detail'],['roles','Roles'],['terminals','Terminals'],['security','Security settings','security'],['sso','SSO connection','security'],
     ['t-pair','Terminal pairing','device'],['t-picker','Terminal operator picker','device'],['t-bar','Terminal operator bar','device'],['support-banner','Support banner'],
     ['p-companies','Platform: Companies','platform:p-companies'],['p-company','Platform: Company detail','platform:p-companies'],['p-support','Platform: Support session dialog','platform:p-companies']]},
 {id:'S02',file:'s02-devices-ingest',title:'Devices and data intake',nav:'devices',ask:['Which devices are offline right now?','Why was this message rejected?','Which channels are not connected to a machine?'],
  s:[['devices','Devices'],['add-device','Add device wizard'],['device','Device detail'],['channels','Channels'],['signal-rule','Signal rule editor'],['dead-letters','Dead letters'],['ingest-health','Ingest health'],['profiles','Profiles','platform:p-fleet']]},
 {id:'S03',file:'s03-machine-state',title:'Machine state and stops',nav:'floor',ask:['Which machine stopped most this shift?','How many micro-stops did K-5 have today?','Why is K-11 showing no data?'],
  s:[['status-list','Machine status list'],['timeline','Machine timeline'],['stop','Stop detail','stops'],['override','Correct machine state'],['raw','Raw events'],['signal-settings','Signal and stop settings','plant'],['data-quality','Data quality','oee']]},
 {id:'S04',file:'s04-plant-structure',title:'Plant, lines, machines and maps',nav:'plant',ask:['Which machines have no ideal rate?','Which line has no output machine set?','Show signals waiting to be connected'],
  s:[['structure','Plant structure'],['site','Site detail'],['machine','Machine detail'],['line','Line detail'],['unassigned','Unassigned signals','devices'],['connect','Connect signal dialog','devices'],['maps','Floor maps','floor'],['map-editor','Floor map editor','plant'],['map-viewer','Floor map viewer','floor'],['map-analysis','Floor map analysis','floor'],['documents','Documents'],['types','Equipment types and icons']]},
 {id:'S05',file:'s05-shifts-calendars',title:'Shifts, calendars and planned time',nav:'shifts',ask:['How many planned hours does Line 2 have next week?','Which machines have no calendar?','What changes if we add a Saturday shift?'],
  s:[['shifts','Shifts'],['calendars','Calendars'],['templates','Templates'],['assignments','Assignments'],['holidays','Holidays'],['exceptions','Exceptions'],['planned-stops','Planned stops'],['shift-calendar','Shift calendar'],['replan','Replan past dialog']]},
 {id:'S06',file:'s06-oee-losses',title:'OEE and losses',nav:'oee',ask:['Why is Line 2 below target this week?','What are our six big losses this month?','How much did changeovers cost last month?'],
  s:[['kpi','KPI tiles'],['waterfall','Waterfall'],['six','Six big losses'],['pareto','Loss Pareto'],['dq','Data-quality panel'],['reliability','Reliability (MTBF, MTTR)'],['cost','Cost of losses'],['targets','Targets'],['oee-settings','OEE settings'],['baselines','Baselines'],['window-history','Window history']]},
 {id:'S07',file:'s07-alerts-andon',title:'Alerts, notifications and andon',nav:'alerts',ask:['Which alerts were not acknowledged today?','How fast does maintenance answer andon calls?','Who gets the K-5 stop alert?'],
  s:[['centre','Notification centre','overview'],['phone','Phone notification','device'],['strip','Machine screen alert strip','device'],['banner','Board banner','device'],['rules','Alert rules'],['groups','Groups and escalation'],['andon-types','Andon types'],['sounds','Sounds and texts per node'],['my','My notifications','me'],['log','Delivery log and health']]},
 {id:'S08',file:'s08-registration',title:'Stop, production and scrap registration',nav:'stops',ask:['Which stops still need a reason?','What are the top stop reasons this week?','How much scrap did K-5 make today?'],
  s:[['worklist','Worklist'],['register','Register stop'],['one-tap','One-tap stop','device'],['production','Production registration','device'],['scrap','Scrap registration','device'],['m-worklist','Stops to register (phone)','device'],['m-reasons','All reasons (phone)','device'],['m-review','Review list (phone)','device'],['review','Review list'],['registrations','Registrations list'],['reason-trees','Reason trees','reasons'],['reason-lists','Reason lists per node','reasons'],['reg-settings','Registration settings and auto rules','reasons']]},
 {id:'S09',file:'s09-platform-console',title:'Platform console and onboarding',shell:'platform',nav:'p-home',ask:['Which companies have setup errors?','Which onboarding runs are stuck?','What feedback came in this week?'],
  s:[['p-home','Home'],['p-companies','Companies','p-companies'],['p-company','Company detail','p-companies'],['p-create','Create company','p-companies'],['fleet','Device fleet','p-fleet'],['templates','Templates','p-templates'],['parity','Parity','p-parity'],['menu','Platform screens from other modules'],['announce','Announcements and feedback','p-announce'],
     ['onboarding','Onboarding wizard','company:plant'],['setup-health','Setup health','company:plant'],['parity-review','Parity review','company:plant'],['banner','Announcements banner','company:overview'],['feedback','Feedback','company:overview']]},
 {id:'S10',file:'s10-mobile-kiosk',title:'Phone app, offline and kiosk',shell:'device',nav:'overview',ask:['How many registrations are waiting to send?','Which terminals are offline?','Which phones fail the alert test?'],
  s:[['splash','Splash / connect'],['login','Phone sign-in'],['unlock','Unlock'],['permissions','Permissions explainer'],['update','Update required'],['home','Phone home'],['ask','Ask on the phone'],['k-pair','Kiosk pairing'],['k-status','Kiosk status'],['outbox','Outbox'],['notif-settings','Notification settings (phone)'],['offline','Offline banner'],['alerts','Alerts (phone)'],['machines','Machines (phone)'],['dash','Dashboard (phone)'],['jobs','Jobs (phone)'],['job','Job detail (phone)'],['scan','Scan a machine'],['more','More menu (phone)']]},
 {id:'S11',file:'s11-ai',title:'AI services',nav:'ai',ask:['Which machines are ready for reason suggestions?','How much of the AI budget is used?','What recurring causes did AI find this week?'],
  s:[['chips','Suggestion chips','device'],['ask','Ask (full page)','ask'],['summary','Summary card','overview'],['translate','Translation inline','stops'],['mapping','Reason mapping review','reasons'],['groups','Issue groups','improve'],['anomalies','Anomalies','improve'],['scan','Scan paper forms','stops'],['ai-settings','AI settings']]},
 {id:'S12',file:'s12-integrations',title:'Partner API and integrations',nav:'integrations',ask:['Which API keys expire this month?','Why is the ERP import failing?','Which webhooks failed today?'],
  s:[['int-home','Integrations home'],['create-key','Create key'],['grant','Partner grant request'],['webhooks','Webhooks'],['connections','Connections'],['req-log','Request log and usage'],['dev-portal','Developer portal','bare'],['p-partners','Platform: Partners','platform:p-partners']]},
 {id:'S13',file:'s13-migration',title:'Migration and cutover',shell:'platform',nav:'p-migration',ask:['Which companies move in wave 2?','Which machine totals do not match?','Which units are not switched yet?'],
  s:[['projects','Migration projects'],['project','Project detail'],['run','Run detail'],['mapping','Mapping assistant'],['recon','Reconciliation'],['cutover','Device cutover board'],['cust-status','Customer status page','company:overview']]},
 {id:'S14',file:'s14-operations',title:'Operations, hosting and security',shell:'platform',nav:'p-ops',ask:['Did last night’s backups all succeed?','How much error budget is left this month?','Which secrets are due for rotation?'],
  s:[['ops','Ops overview'],['deploys','Deployments'],['backups','Backups'],['restore','Restore wizard'],['maint','Maintenance windows'],['capacity','Capacity'],['secrets','Secrets'],['slo','SLO report'],['protect','Data protection card','company:privacy']]},
 {id:'S15',file:'s15-products-orders',title:'Products, orders and production plans',nav:'orders',ask:['Which orders will finish late?','Which products have no ideal rate on K-5?','What runs next on Line 2?'],
  s:[['products','Products','products'],['rates','Ideal rates','products'],['changeover','Changeover standards','products'],['orders','Orders'],['queue','Queue / sequence'],['run-panel','Operator run panel','device'],['runs','Runs timeline'],['co-report','Changeover report','reports'],['imports','Imports','products']]},
 {id:'S16',file:'s16-improve-maintain',title:'Improvement, actions and maintenance',nav:'maint',ask:['Which PM plans are due this week?','What is our MTTR trend?','Which actions are overdue?'],
  s:[['board','Maintenance board'],['request','Request detail'],['request-form','Request form','device'],['pm','PM plans'],['pm-editor','PM plan editor'],['m-kpis','Maintenance KPIs'],['actions','Actions','improve'],['action','Action detail','improve'],['rca','Root-cause analysis','improve'],['projects','Projects','improve'],['project','Project page','improve'],['suggestions','Suggestions inbox','improve']]},
 {id:'S17',file:'s17-dashboards-reports',title:'Dashboards, boards and reports',nav:'dash',ask:['Summarise yesterday for the huddle','Which board displays are offline?','Send me the weekly OEE report'],
  s:[['home','Home','overview'],['dash','Dashboard view'],['editor','Dashboard editor'],['drill','Drill-down drawer'],['boards','Board admin'],['tv','Display (TV)','device'],['tv-pair','TV first start (pairing)','device'],['reports','Reports','reports'],['report','Report viewer','reports'],['exports','Exports','reports'],['views','Saved views'],['templates','Dashboard templates']]},
 {id:'S18',file:'s18-operator',title:'Operator workspace (terminal and phone)',shell:'device',nav:'floor',ask:['How do I change the edge band on K-5?','What did the night shift write about K-5?','How is my shift going?'],
  s:[['idle','Terminal idle'],['signin','Sign-in'],['home','Home'],['machines','My machines (phone)'],['machine','Machine screen'],['line','Line screen'],['order','Order panel'],['checklist','Checklist runner'],['handover','Handover'],['instructions','Instructions viewer'],['myshift','My shift (summary)'],['myreg','My registrations'],['checkin','Check-in'],['andon','Andon call'],['andon-called','Andon called (waiting)'],['signout','Sign out (badge out)']]},
 {id:'S19',file:'s19-audit-privacy',title:'Audit, privacy and compliance',nav:'privacy',ask:['Who changed the K-5 ideal rate?','Which privacy requests are due this week?','When is the next data purge?'],
  s:[['audit','Audit log'],['history','Entity history'],['retention','Retention'],['dsr','Privacy requests'],['docs','Compliance documents'],['p-compliance','Platform compliance','platform:p-compliance'],['p-security','Platform security','platform:p-security']]},
 {id:'S20',file:'s20-plans-billing',title:'Plans, entitlements and billing',nav:'plan',ask:['How many billable machines do we have?','What will next month cost?','Which features are in Plus?'],
  s:[['plan','Plan and usage'],['statements','Statements'],['billing','Billing details'],['upgrade','Upgrade prompts','improve'],['consent','Soft-limit consent dialog'],['p-plans','Platform: Plans','platform:p-billing'],['p-subs','Platform: Subscriptions','platform:p-billing'],['p-run','Platform: Statements run','platform:p-billing'],['partner-billing','Partner portal billing','bare']]}
];

var NAV_CO=[
 ['h','Production'],['overview','Overview','grid'],['floor','Live floor','live'],['oee','OEE & losses','pie'],['stops','Stops','stopc',3],['orders','Orders & plans','box'],
 ['h','Improve'],['maint','Maintenance','wrench',2],['improve','Actions & projects','checks'],['ask','Ask FP','spark'],['dash','Dashboards & boards','board'],['reports','Reports','file'],
 ['h','Setup'],['plant','Plant & machines','layers'],['devices','Devices','cpu'],['shifts','Shifts & calendar','cal'],['reasons','Reasons','tag'],['products','Products & rates','list'],['alerts','Alerts & andon','bell'],
 ['people','People & access','users'],['security','Security','lock'],['integrations','Integrations','plug'],['ai','AI','spark'],['privacy','Data & privacy','shield'],['plan','Plan & billing','card']];
var NAV_PL=[
 ['h','Platform'],['p-home','Home','grid'],['p-companies','Companies','building'],['p-fleet','Device fleet','cpu'],['p-templates','Templates','layers'],['p-parity','Parity','checks'],['p-announce','Announcements','mega'],
 ['h','Run'],['p-health','System health','live'],['p-jobs','Jobs','list'],['p-migr','DB migrations','db'],['p-config','Configuration','gear'],['p-ops','Ops & hosting','server'],['p-migration','Moves to v3','swap'],
 ['h','Business'],['p-partners','Partners','plug'],['p-billing','Billing','card'],['p-compliance','Compliance','shield'],['p-security','Security','lock'],['p-ai','AI','spark'],['p-mobile','Mobile releases','phone']];


/* ---------- navigation targets (sidebar, bottom bar, links between modules) ---------- */
var NAVTO={
 overview:'s17-dashboards-reports#home',floor:'s03-machine-state#status-list',oee:'s06-oee-losses#kpi',stops:'s08-registration#worklist',orders:'s15-products-orders#orders',
 maint:'s16-improve-maintain#board',improve:'s16-improve-maintain#actions',ask:'s11-ai#ask',dash:'s17-dashboards-reports#dash',reports:'s17-dashboards-reports#reports',
 plant:'s04-plant-structure#structure',devices:'s02-devices-ingest#devices',shifts:'s05-shifts-calendars#shifts',reasons:'s08-registration#reason-trees',products:'s15-products-orders#products',alerts:'s07-alerts-andon#rules',
 people:'s01-identity-access#members',security:'s01-identity-access#security',integrations:'s12-integrations#int-home',ai:'s11-ai#ai-settings',privacy:'s19-audit-privacy#audit',plan:'s20-plans-billing#plan',
 'p-home':'s09-platform-console#p-home','p-companies':'s09-platform-console#p-companies','p-fleet':'s09-platform-console#fleet','p-templates':'s09-platform-console#templates','p-parity':'s09-platform-console#parity','p-announce':'s09-platform-console#announce',
 'p-health':'s00-platform-foundation#health','p-jobs':'s00-platform-foundation#jobs','p-migr':'s00-platform-foundation#migrations','p-config':'s00-platform-foundation#config','p-ops':'s14-operations#ops','p-migration':'s13-migration#projects',
 'p-partners':'s12-integrations#p-partners','p-billing':'s20-plans-billing#p-plans','p-compliance':'s19-audit-privacy#p-compliance','p-security':'s19-audit-privacy#p-security'};
var HOME_CO='s17-dashboards-reports#home',HOME_PL='s09-platform-console#p-home';

/* ---------- platform pack and roles ----------
   PF is 'all' in docs/design and 'web' | 'mobile' | 'kiosk' in the packs that tools/build-packs.js writes to docs/design-platforms.
   Role permissions follow the S01 system role templates (docs/lld S01 §3.2.2). */
var PF='mobile';
var PFS={
 web:{name:'Web app',icon:'monitor',title:'The web app, role by role.',text:'Every screen people use in a browser: managers, supervisors, maintenance, quality, planners and viewers at the customer, plus FP staff and partners. Pick a role to see exactly their menu and screens.'},
 mobile:{name:'Mobile app',icon:'phone',title:'The phone app, role by role.',text:'The FP app on a personal phone: operators register from their own phone, supervisors get alerts and follow the line, maintenance answers calls. iOS and Android, works offline.'},
 kiosk:{name:'Line terminal and TV',icon:'tablet',title:'The line terminal and TV boards.',text:'The shared tablet at the line in kiosk mode, operators sign in with badge or PIN, and the TV boards on the wall. Big buttons, readable at arm’s length, works offline.'}};
var CO_ALL=['overview','floor','oee','stops','orders','maint','improve','ask','dash','reports','plant','devices','shifts','reasons','products','alerts','people','security','integrations','ai','privacy','plan'];
var PL_ALL=['p-home','p-companies','p-fleet','p-templates','p-parity','p-announce','p-health','p-jobs','p-migr','p-config','p-ops','p-migration','p-partners','p-billing','p-compliance','p-security','p-ai','p-mobile'];
var ROLES={
 admin:{pf:'web',side:'co',name:'Company admin',who:'Lena Holm',first:'Lena',init:'LH',av:'',title:'Company admin · production',home:'s17-dashboards-reports#home',nav:CO_ALL,
   does:'Sets up the plant, people, shifts, reasons and the plan. Sees everything at Nordvik Trä.'},
 manager:{pf:'web',side:'co',name:'Production manager',who:'Erik Nyström',first:'Erik',init:'EN',av:'c3',title:'Production manager',home:'s17-dashboards-reports#home',
   nav:['overview','floor','oee','stops','orders','maint','improve','ask','dash','reports','plant','devices','shifts','reasons','products','alerts','people','plan'],does:'Runs the plant day to day: OEE, losses, orders, improvement.'},
 supervisor:{pf:'web',side:'co',name:'Supervisor',who:'Sami Koski',first:'Sami',init:'SK',av:'c2',title:'Supervisor · Line 2',home:'s17-dashboards-reports#home',
   nav:['overview','floor','oee','stops','orders','maint','improve','ask','dash','reports','devices','alerts','people'],does:'Leads the shift: fills missing reasons, answers andon, follows actions.'},
 maint:{pf:'web',side:'co',name:'Maintenance',who:'Nils Dahl',first:'Nils',init:'ND',av:'c5',title:'Maintenance technician',home:'s17-dashboards-reports#home',
   nav:['overview','floor','oee','stops','orders','maint','improve','ask','dash','reports','plant','devices','alerts'],does:'Takes requests, plans service, keeps machine documents.'},
 quality:{pf:'web',side:'co',name:'Quality',who:'Aino Virtanen',first:'Aino',init:'AV',av:'c4',title:'Quality',home:'s17-dashboards-reports#home',
   nav:['overview','floor','oee','stops','orders','improve','ask','dash','reports','reasons','alerts'],does:'Follows scrap and quality loss, keeps scrap reasons.'},
 planner:{pf:'web',side:'co',name:'Planner',who:'Hanna Lund',first:'Hanna',init:'HL',av:'c3',title:'Production planner',home:'s17-dashboards-reports#home',
   nav:['overview','floor','oee','stops','orders','products','shifts','improve','ask','dash','reports'],does:'Plans orders, products, rates and shifts.'},
 viewer:{pf:'web',side:'co',name:'Viewer',who:'Karin Åberg',first:'Karin',init:'KÅ',av:'c5',title:'Viewer · finance',home:'s17-dashboards-reports#home',
   nav:['overview','floor','oee','stops','orders','dash','reports'],does:'Reads dashboards and reports. Changes nothing.'},
 'p-admin':{pf:'web',side:'pl',name:'FP platform admin',who:'Pekka Niemi',first:'Pekka',init:'PN',av:'c4',title:'FP platform admin',home:'s09-platform-console#p-home',nav:PL_ALL,does:'FP staff. Everything on the platform: companies, templates, security.'},
 'p-support':{pf:'web',side:'pl',name:'FP support',who:'Mira Sandell',first:'Mira',init:'MS',av:'c4',title:'FP support',home:'s09-platform-console#p-home',
   nav:['p-home','p-companies','p-fleet','p-health','p-jobs','p-migration'],does:'FP staff. Helps customers, with their approval for support sessions.'},
 'p-ops':{pf:'web',side:'pl',name:'FP operations',who:'Tobias Wik',first:'Tobias',init:'TW',av:'c2',title:'FP platform ops',home:'s09-platform-console#p-home',
   nav:['p-home','p-health','p-jobs','p-migr','p-config','p-ops','p-fleet'],does:'FP staff. Keeps servers, backups, jobs and deploys healthy.'},
 'p-billing':{pf:'web',side:'pl',name:'FP billing',who:'Sara Holmgren',first:'Sara',init:'SH',av:'c3',title:'FP billing',home:'s09-platform-console#p-home',
   nav:['p-home','p-companies','p-partners','p-billing'],does:'FP staff. Plans, subscriptions and the monthly statement run.'},
 partner:{pf:'web',side:'bare',name:'Partner',who:'Johan Ek',first:'Johan',init:'JE',av:'c3',title:'Partner · Automation Syd AB',home:'s20-plans-billing#partner-billing',
   screens:['S12:dev-portal','S20:partner-billing'],does:'An installer or integrator: API docs and their commission.'},
 'm-op':{pf:'mobile',name:'Operator',who:'Elin Sand',first:'Elin',init:'ES',av:'c2',title:'Operator · own phone',home:'s18-operator#home',
   screens:['S10:splash','S10:login','S10:unlock','S10:permissions','S10:update','S10:alerts','S10:scan','S10:more','S10:ask','S18:home','S18:machine','S18:order','S18:checklist','S18:handover','S18:instructions','S18:myshift','S18:myreg','S18:checkin','S18:andon','S18:andon-called','S18:machines','S08:one-tap','S08:production','S08:scrap','S08:m-worklist','S08:m-reasons','S10:outbox','S10:offline','S10:notif-settings','S16:request-form'],
   does:'Registers stops, checklists and handover from her own phone.'},
 'm-lead':{pf:'mobile',name:'Supervisor',who:'Sami Koski',first:'Sami',init:'SK',av:'c2',title:'Supervisor · Line 2',home:'s10-mobile-kiosk#home',
   screens:['S10:splash','S10:login','S10:unlock','S10:permissions','S10:update','S10:home','S10:alerts','S10:machines','S10:dash','S10:jobs','S10:job','S10:scan','S10:more','S10:ask','S08:one-tap','S08:production','S08:scrap','S08:m-worklist','S08:m-reasons','S08:m-review','S18:andon','S18:andon-called','S07:phone','S18:machine','S18:order','S18:checklist','S18:handover','S18:instructions','S10:notif-settings','S10:outbox','S10:offline','S16:request-form'],
   does:'Gets andon and stop alerts, follows the line, asks FP.'},
 'm-maint':{pf:'mobile',name:'Maintenance',who:'Nils Dahl',first:'Nils',init:'ND',av:'c5',title:'Maintenance technician',home:'s10-mobile-kiosk#home',
   screens:['S10:splash','S10:login','S10:unlock','S10:permissions','S10:update','S10:home','S10:alerts','S10:machines','S10:dash','S10:jobs','S10:job','S10:scan','S10:more','S07:phone','S16:request-form','S18:machine','S18:instructions','S10:notif-settings','S10:ask','S10:offline','S10:outbox'],does:'Answers maintenance calls and reads machine instructions.'},
 'k-op':{pf:'kiosk',name:'Operator',who:'Elin Sand',first:'Elin',init:'ES',av:'c2',title:'Operator · line terminal',home:'s18-operator#idle',
   screens:['S18:idle','S18:signin','S01:t-picker','S01:t-bar','S18:home','S18:machine','S18:line','S18:order','S18:checklist','S18:handover','S18:instructions','S18:myshift','S18:myreg','S18:checkin','S18:andon','S18:andon-called','S18:signout','S07:strip','S08:one-tap','S08:production','S08:scrap','S11:chips','S15:run-panel','S10:offline'],
   does:'Works at the line: badge in, register stops, run orders, checklists, handover.'},
 'k-setup':{pf:'kiosk',name:'Terminal setup',who:'Lena Holm',first:'Lena',init:'LH',av:'',title:'Company admin at the terminal',home:'s10-mobile-kiosk#k-pair',
   screens:['S10:k-pair','S01:t-pair','S10:k-status'],does:'Pairs a new tablet to a line and checks its status.'},
 'k-board':{pf:'kiosk',name:'Wall TV (no sign-in)',who:'Board Line 2',first:'Board',init:'TV',av:'c4',title:'A paired screen, not a person',home:'s17-dashboards-reports#tv',
   screens:['S17:tv','S17:tv-pair','S07:banner'],does:'Not a user: a TV paired to a board. It rotates line status, this hour and the huddle page, and shows andon as a banner. Set up in Boards on the web.'}
};
var PFDEF={all:'admin',web:'admin',mobile:'m-op',kiosk:'k-op'};
function metaOf(m,s){var spec=(s&&s[2])||'';var parts=spec.split(':');var shell,nav;
 if(['auth','device','bare','platform','company'].indexOf(parts[0])>=0){shell=parts[0];nav=parts[1];}else{nav=parts[0];}
 if(!shell)shell=m.shell||'company';
 if(shell==='company'&&m.shell==='platform'&&!parts[1]&&!nav)nav='overview';
 return {shell:shell,nav:nav||m.nav,title:s?s[1]:''};}
function allowed(rk,m,s){var r=ROLES[rk];if(!r)return false;var key=m.id+':'+s[0];
 if(r.screens)return r.screens.indexOf(key)>=0;
 var t=metaOf(m,s);if(t.shell==='device'||t.shell==='bare')return false;if(t.shell==='auth')return true;
 if(r.side==='pl')return t.shell==='platform'&&r.nav.indexOf(t.nav)>=0;
 if(t.shell==='platform')return false;
 return t.nav==='me'||r.nav.indexOf(t.nav)>=0;}
function rolesIn(pf){return Object.keys(ROLES).filter(function(k){return pf==='all'||ROLES[k].pf===pf;});}
/* in a pack, keep only the screens some role of that platform can open */
if(PF!=='all'){var RS=rolesIn(PF);C=C.map(function(m){return {id:m.id,file:m.file,title:m.title,shell:m.shell,nav:m.nav,ask:m.ask,s:m.s.filter(function(s){return RS.some(function(k){return allowed(k,m,s);});})};}).filter(function(m){return m.s.length;});}
function findScreen(file,id){for(var i=0;i<C.length;i++){if(C[i].file===file){for(var j=0;j<C[i].s.length;j++){if(C[i].s[j][0]===id)return [C[i],C[i].s[j]];}}}return null;}
function firstRole(m,s,pf){var ks=rolesIn(pf||PF);for(var i=0;i<ks.length;i++){if(allowed(ks[i],m,s))return ks[i];}return null;}

/* ---------- guided journeys (index page starts them, a floating bar on every screen continues them) ---------- */
var J={
 mgr:{role:'manager',name:'Morning round',steps:[
  ['s01-identity-access','login','Sign in'],['s01-identity-access','mfa','Two-step code'],['s01-identity-access','company-picker','Pick your company'],
  ['s17-dashboards-reports','home','Home'],['s03-machine-state','status-list','Live floor'],['s03-machine-state','timeline','K-5 timeline'],['s03-machine-state','stop','One stop'],
  ['s08-registration','worklist','Stops that need a reason'],['s08-registration','register','Give the reason'],
  ['s06-oee-losses','kpi','OEE today'],['s06-oee-losses','waterfall','Where the time went'],['s06-oee-losses','pareto','Biggest losses'],
  ['s17-dashboards-reports','dash','Line dashboard'],['s17-dashboards-reports','report','Weekly report']]},
 setup:{role:'admin',name:'Set up a new machine',steps:[
  ['s09-platform-console','onboarding','Onboarding wizard'],['s04-plant-structure','structure','Plant structure'],['s04-plant-structure','site','Site'],['s04-plant-structure','machine','Machine'],
  ['s02-devices-ingest','devices','Devices'],['s02-devices-ingest','add-device','Add a device'],['s04-plant-structure','connect','Connect a signal'],
  ['s05-shifts-calendars','shifts','Shifts'],['s15-products-orders','rates','Ideal rates'],['s08-registration','reason-trees','Stop reasons and loss categories'],['s01-identity-access','members','Invite people'],['s01-identity-access','roles','Roles and permissions'],['s20-plans-billing','plan','Plan and usage']]},
 leadweb:{role:'supervisor',name:'Follow up the shift',steps:[
  ['s17-dashboards-reports','home','Home'],['s08-registration','worklist','Stops without a reason'],['s08-registration','register','Fill a reason'],['s08-registration','review','Check the registrations'],
  ['s07-alerts-andon','centre','Alerts and andon'],['s16-improve-maintain','actions','Open actions'],['s17-dashboards-reports','report','Shift report']]},
 maintweb:{role:'maint',name:'A maintenance day',steps:[
  ['s16-improve-maintain','board','Maintenance board'],['s16-improve-maintain','request','A request'],['s16-improve-maintain','pm','Planned maintenance'],['s16-improve-maintain','m-kpis','Maintenance KPIs'],['s06-oee-losses','reliability','MTBF and MTTR']]},
 quality:{role:'quality',name:'Find the quality loss',steps:[
  ['s06-oee-losses','kpi','OEE and quality'],['s06-oee-losses','pareto','Biggest losses'],['s08-registration','registrations','Scrap registrations'],['s08-registration','reason-trees','Reasons and categories'],['s16-improve-maintain','actions','Create an action']]},
 planner:{role:'planner',name:'Plan next week',steps:[
  ['s15-products-orders','orders','Orders'],['s15-products-orders','queue','Queue per machine'],['s15-products-orders','rates','Ideal rates'],['s05-shifts-calendars','shift-calendar','Shift calendar'],['s05-shifts-calendars','replan','Change planned time']]},
 viewer:{role:'viewer',name:'Read the numbers',steps:[
  ['s17-dashboards-reports','dash','Dashboard'],['s17-dashboards-reports','drill','Drill into a day'],['s17-dashboards-reports','report','Weekly report']]},
 support:{role:'p-support',name:'Help a customer',steps:[
  ['s09-platform-console','p-home','Platform home'],['s09-platform-console','p-companies','Companies'],['s09-platform-console','p-company','Company detail'],['s01-identity-access','p-support','Ask for a support session'],
  ['s00-platform-foundation','health','System health'],['s00-platform-foundation','jobs','Jobs']]},
 pops:{role:'p-ops',name:'Keep the platform healthy',steps:[
  ['s00-platform-foundation','health','System health'],['s00-platform-foundation','jobs','Jobs'],['s14-operations','ops','Operations'],['s14-operations','deploys','Deploys'],['s14-operations','backups','Backups'],['s14-operations','slo','SLO report']]},
 pbill:{role:'p-billing',name:'Month-end billing',steps:[
  ['s20-plans-billing','p-plans','Plans'],['s20-plans-billing','p-subs','Subscriptions'],['s20-plans-billing','p-run','Statement run'],['s12-integrations','p-partners','Partners']]},
 padmin:{role:'p-admin',name:'Onboard a new company',steps:[
  ['s09-platform-console','p-home','Platform home'],['s09-platform-console','p-create','Create company'],['s09-platform-console','templates','Templates'],['s19-audit-privacy','p-compliance','Compliance'],['s19-audit-privacy','p-security','Security']]},
 partner:{role:'partner',name:'Partner portal',steps:[
  ['s12-integrations','dev-portal','Developer docs'],['s20-plans-billing','partner-billing','My commission']]},
 mop:{role:'m-op',name:'A shift on my phone',steps:[
  ['s10-mobile-kiosk','splash','Open the app'],['s10-mobile-kiosk','unlock','Unlock'],['s18-operator','home','Home'],['s18-operator','machine','Register a stop'],
  ['s18-operator','checklist','Checklist'],['s18-operator','handover','Handover'],['s18-operator','myshift','My shift'],['s18-operator','myreg','My registrations']]},
 moff:{role:'m-op',name:'Phone without signal',steps:[
  ['s10-mobile-kiosk','offline','Offline'],['s10-mobile-kiosk','outbox','Waiting to send']]},
 push:{role:'m-lead',name:'Answer a phone alert',steps:[
  ['s07-alerts-andon','phone','Alert on the lock screen'],['s10-mobile-kiosk','unlock','Unlock to acknowledge'],['s18-operator','machine','Machine on the phone'],['s10-mobile-kiosk','home','Line overview']]},
 mmaint:{role:'m-maint',name:'Take a maintenance call',steps:[
  ['s07-alerts-andon','phone','Andon call'],['s10-mobile-kiosk','unlock','Unlock'],['s18-operator','instructions','Read the instruction'],['s16-improve-maintain','request-form','Report what you found']]},
 op:{role:'k-op',name:'Start of shift at the terminal',steps:[
  ['s18-operator','idle','Terminal idle'],['s18-operator','signin','Sign in with PIN'],['s18-operator','handover','Read the night notes'],['s18-operator','checklist','Start-up checklist'],['s18-operator','home','Home'],['s18-operator','machine','K-5 stopped, give reason'],['s18-operator','order','Order panel']]},
 changeover:{role:'k-op',name:'Do a changeover',steps:[
  ['s18-operator','machine','Machine screen'],['s18-operator','order','End and changeover'],['s18-operator','instructions','Instruction opens'],['s18-operator','checklist','Changeover checklist'],['s18-operator','machine','Back to production']]},
 endshift:{role:'k-op',name:'End the shift',steps:[
  ['s18-operator','myshift','Reminder at 13:50'],['s18-operator','handover','Write the handover'],['s18-operator','myshift','Shift summary 14:02'],['s18-operator','idle','Badge out']]},
 koff:{role:'k-op',name:'Terminal loses Wi-Fi',steps:[
  ['s10-mobile-kiosk','offline','Offline banner'],['s18-operator','machine','Andon needs a connection'],['s18-operator','checklist','Checklists still work']]},
 ksetup:{role:'k-setup',name:'Set up a new terminal',steps:[
  ['s10-mobile-kiosk','k-pair','Pair the tablet'],['s01-identity-access','t-pair','Choose line and machines'],['s10-mobile-kiosk','k-status','Terminal status']]},
 board:{role:'k-board',name:'The wall screen',steps:[
  ['s17-dashboards-reports','tv','Line board'],['s07-alerts-andon','banner','Andon banner']]}
};
function journeysIn(pf){return Object.keys(J).filter(function(k){var r=ROLES[J[k].role];return r&&(pf==='all'||r.pf===pf);});}
function jurl(k,i){var st=J[k].steps[i];return st[0]+'.html?role='+J[k].role+'&j='+k+'&i='+i+'#'+st[1];}
function rurl(rk,dest){var p=dest.split('#');return p[0]+'.html?role='+rk+(p[1]?'#'+p[1]:'');}

/* node (tools/build-packs.js) reads the catalogue, roles and journeys without a browser */
if(typeof document==='undefined'){if(typeof module!=='undefined')module.exports={C:C,ROLES:ROLES,J:J,PFS:PFS,NAVTO:NAVTO,metaOf:metaOf,allowed:allowed,rolesIn:rolesIn,journeysIn:journeysIn};return;}

var root=document.documentElement, body=document.body;
function $(s,el){return (el||document).querySelector(s);}
function $$(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s));}
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

/* ---------- theme ---------- */
var mode='system';try{mode=localStorage.getItem('fp-proto-theme')||'system';}catch(e){}
function eff(m){return m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;}
function applyMode(){root.setAttribute('data-mode',eff(mode));$$('[data-mode-btn]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.modeBtn===mode));});try{localStorage.setItem('fp-proto-theme',mode);}catch(e){}}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){if(mode==='system')applyMode();});

/* ---------- toast ---------- */
var toastEl,tt;
function toast(m){if(!toastEl){toastEl=document.createElement('div');toastEl.className='toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);}
 toastEl.innerHTML=ic('info','sm')+'<span>'+esc(m)+'</span>';toastEl.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toastEl.classList.remove('show');},2600);}

body.insertAdjacentHTML('afterbegin',sprite);
var modeBtns='<span class="modes">'+[['light','sun'],['system','monitor'],['dark','moon']].map(function(m){return '<button class="pb" type="button" data-mode-btn="'+m[0]+'" aria-label="'+m[0]+'">'+ic(m[1],'xs')+'</button>';}).join('')+'</span>';

/* ---------- index page ---------- */
function avHtml(r,cls){return '<span class="av '+(cls||'')+' '+(r.av||'')+'">'+esc(r.init)+'</span>';}
if(body.dataset.page==='index'){
 body.insertAdjacentHTML('afterbegin','<div class="proto"><span class="pm">FP Analyzer v3 · '+(PF==='all'?'design prototype':esc(PFS[PF].name)+' design')+'</span><span class="sp"></span>'+modeBtns+'</div>');
 var total=C.reduce(function(a,m){return a+m.s.length;},0);
 if(PF!=='all'){var sw=$('#samples-wrap');if(sw)sw.remove();var pw=$('#packs-wrap');if(pw)pw.remove();document.title='FP '+PFS[PF].name+' Design';}
 var host=$('#catalog');
 if(host){host.innerHTML=C.map(function(m){
   return '<div class="card mod"><div class="mod-h"><span class="mid">'+m.id+'</span><div><b>'+esc(m.title)+'</b><small>'+m.s.length+' screens</small></div></div><ol>'+
     m.s.map(function(s){var t=metaOf(m,s);var rk=firstRole(m,s);var r=ROLES[rk];
       var tag=t.shell==='device'?'<span class="badge b-setup">'+(PF==='kiosk'?'terminal':PF==='mobile'?'phone':'device')+'</span>':t.shell==='platform'?'<span class="badge b-warn">FP staff</span>':t.shell==='auth'?'<span class="badge">sign-in</span>':'';
       return '<li><a href="screens/'+m.file+'.html?role='+rk+'#'+s[0]+'" title="Opens as '+esc(r?r.name:'')+'">'+esc(s[1])+'</a>'+tag+'</li>';}).join('')+'</ol></div>';}).join('');}
 /* launcher: device -> role -> that role's home */
 var LX={web:{name:'Website',sub:'In the browser at the office: managers, supervisors, maintenance, quality and planners, plus FP staff.'},
  mobile:{name:'Mobile app',sub:'On a personal phone: operators register stops, supervisors and maintenance get the alerts.'},
  kiosk:{name:'Kiosk',sub:'The shared tablet at the line and the TV board on the wall. Big buttons, badge or PIN.'}};
 function nScr(k){var n=0;C.forEach(function(m){m.s.forEach(function(s){if(allowed(k,m,s))n++;});});return n;}
 function pfScr(g){var ks=rolesIn(g),n=0;C.forEach(function(m){m.s.forEach(function(s){if(ks.some(function(k){return allowed(k,m,s);}))n++;});});return n;}
 function homeTitle(k){var p=ROLES[k].home.split('#');var m=C.filter(function(x){return x.file===p[0];})[0];var s=m&&m.s.filter(function(x){return x[0]===p[1];})[0];return s?s[1]:'Home';}
 function dvHtml(g){var b='<span class="dv-b" style="width:';
  if(g==='web')return '<span class="dv dv-web"><span class="dv-s"><span class="dv-sd"><span></span><span></span><span></span><span></span></span><span class="dv-m"><span class="dv-r">'+b+'40%"></span></span><span class="dv-r"><span class="dv-k"></span><span class="dv-k"></span><span class="dv-k"></span></span><span class="dv-c"><span class="dv-t g" style="height:70%"></span><span class="dv-t g" style="height:85%"></span><span class="dv-t r" style="height:40%"></span><span class="dv-t g" style="height:78%"></span><span class="dv-t y" style="height:55%"></span><span class="dv-t g" style="height:92%"></span><span class="dv-t b" style="height:30%"></span></span></span></span><span class="dv-st"></span></span>';
  if(g==='mobile')return '<span class="dv dv-mob"><span class="dv-s"><span class="dv-h"></span>'+['g','r','y','g'].map(function(c,i){return '<span class="dv-l"><span class="dv-t '+c+'"></span>'+b+(90-i*12)+'%"></span></span>';}).join('')+'<span class="dv-tb"><span></span><span></span><span></span><span></span></span></span></span>';
  return '<span class="dv dv-kio"><span class="dv-s"><span class="dv-tp">'+b+'30%"></span><span class="dv-t g" style="width:26px;height:8px"></span></span><span class="dv-kb"><span class="dv-t r"></span><span class="dv-t y"></span><span class="dv-t b"></span><span class="dv-t g"></span><span class="dv-t r"></span><span class="dv-t y"></span></span></span><span class="dv-st"></span><span class="dv-f"></span></span>';}
 function roleCard(k,i){var r=ROLES[k];var js=Object.keys(J).filter(function(x){return J[x].role===k;});
  return '<div class="rc" style="--d:'+i+'"><a class="rc-a" href="screens/'+rurl(k,r.home)+'" aria-label="Open as '+esc(r.name)+', '+esc(r.who)+'"><span class="rh">'+avHtml(r,'lg')+'<span><b>'+esc(r.name)+'</b><small>'+esc(r.who)+' · '+esc(r.title)+'</small></span></span></a>'+
   '<p>'+esc(r.does)+'</p>'+
   (js.length?'<div class="jw">'+js.map(function(x){return '<a href="screens/'+jurl(x,0)+'" title="Guided walk, '+J[x].steps.length+' steps">'+ic('play','xs')+esc(J[x].name)+'</a>';}).join('')+'</div>':'')+
   '<div class="ft"><span>Starts on '+esc(homeTitle(k))+' · '+nScr(k)+' screens</span><span class="open">Open'+ic('chev','xs')+'</span></div></div>';}
 function renderPfs(){var h=$('#pfs');if(!h)return;h.innerHTML=['web','mobile','kiosk'].map(function(g,i){return '<button type="button" class="pft" data-pf="'+g+'" style="--d:'+i+'"><span class="stage">'+dvHtml(g)+'</span><b>'+LX[g].name+'</b><span class="sub">'+esc(LX[g].sub)+'</span><span class="meta"><span>'+rolesIn(g).length+' roles</span><span>'+pfScr(g)+' screens</span></span><span class="go">Choose'+ic('chev','sm')+'</span></button>';}).join('');
  $$('.pft',h).forEach(function(t){t.addEventListener('click',function(){lxNav=true;location.hash=t.dataset.pf;});});}
 function renderRoles(g){var ks=rolesIn(g),i=0;
  $('#lx-ico').innerHTML=ic(PFS[g].icon);$('#lx-t').textContent='Who are you on the '+LX[g].name.toLowerCase()+'?';$('#lx-p').textContent=PFS[g].text;
  if(PF!=='all')$('#lx-eb').textContent='FP Analyzer v3 · '+PFS[g].name+' design · pick a role';
  var grps=g==='web'?[['At the customer’s plant',ks.filter(function(k){return ROLES[k].side==='co';})],['FP staff',ks.filter(function(k){return ROLES[k].side==='pl';})],['Partners',ks.filter(function(k){return ROLES[k].side==='bare';})]]:g==='kiosk'?[['People at the line',ks.filter(function(k){return k!=='k-board';})],['Screens with no sign-in',ks.filter(function(k){return k==='k-board';})]]:[['Pick your role',ks]];
  $('#lx-roles').innerHTML=grps.filter(function(x){return x[1].length;}).map(function(x){return '<div class="lx-grp"><h3>'+esc(x[0])+'</h3><div class="lx-roles">'+x[1].map(function(k){return roleCard(k,i++);}).join('')+'</div></div>';}).join('');}
 var stA=$('#step-pf'),stB=$('#step-roles'),lxNav=false;
 function stepTo(g,anim){var to=g?stB:stA,from=g?stA:stB;if(g)renderRoles(g);else renderPfs();
  if(!anim||from.hidden){from.hidden=true;to.hidden=false;return;}
  from.classList.add('out');
  setTimeout(function(){from.hidden=true;from.classList.remove('out');to.classList.add('pre');to.hidden=false;void to.offsetWidth;to.classList.remove('pre');
   try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){window.scrollTo(0,0);}},220);}
 function hashPf(){var h=location.hash.slice(1);return PF!=='all'?PF:(PFS[h]?h:null);}
 if(stA&&stB){
  if(PF!=='all'){var bk=$('#lx-back');if(bk)bk.remove();}
  else $('#lx-back').addEventListener('click',function(){if(lxNav){lxNav=false;history.back();}else location.hash='';});
  window.addEventListener('hashchange',function(){stepTo(hashPf(),true);});
  stepTo(hashPf(),false);}
 var pk=$('#packs');
 if(pk){pk.innerHTML=['web','mobile','kiosk'].map(function(g){var ks=rolesIn(g);var n=0;C.forEach(function(m){m.s.forEach(function(s){if(ks.some(function(k){return allowed(k,m,s);}))n++;});});
   return '<a class="card jcard" href="../design-platforms/'+g+'/index.html"><span class="jn">'+n+' screens · '+ks.length+' roles</span><b>'+esc(PFS[g].name)+'</b><small>docs/design-platforms/'+g+'</small><span class="jf">'+esc(PFS[g].text)+'</span></a>';}).join('');}
 var jh=$('#journeys');if(jh){jh.innerHTML=journeysIn(PF).map(function(k){var j=J[k],r=ROLES[j.role];return '<a class="card jcard" href="screens/'+jurl(k,0)+'"><span class="jn">'+j.steps.length+' steps · '+esc(PFS[r.pf].name)+'</span><b>'+esc(j.name)+'</b><small>'+esc(r.name)+' · '+esc(r.who)+'</small><span class="jf">'+j.steps.slice(0,4).map(function(x){return esc(x[2]);}).join(' → ')+(j.steps.length>4?' …':'')+'</span></a>';}).join('');}
 $$('[data-total]').forEach(function(e){e.textContent=total;});
 $$('[data-modcount]').forEach(function(e){e.textContent=C.length;});
 $$('[data-mode-btn]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.modeBtn;applyMode();});});
 applyMode();
 return;
}

/* ---------- module page ---------- */
var mod=C.filter(function(m){return m.id===body.dataset.module;})[0];
if(!mod){console.warn('fp.js: unknown module');return;}
var holder=$('#screens');
var secs=$$('section.screen',holder);
var known={};mod.s.forEach(function(s){known[s[0]]=s;});
secs.forEach(function(s){if(!known[s.id])console.warn('fp.js: section not in catalogue',s.id);});
mod.s.forEach(function(s){if(!document.getElementById(s[0]))console.warn('fp.js: catalogue screen missing',s[0]);});
var mi=C.indexOf(mod);
var q=new URLSearchParams(location.search),jk=q.get('j'),ji=parseInt(q.get('i'),10);
if(!J[jk]||isNaN(ji)||ji<0||ji>=J[jk].steps.length){jk=null;}
var RK=q.get('role');if(!RK){try{RK=localStorage.getItem('fp-proto-role-'+PF);}catch(e){}}
if(!ROLES[RK]||(PF!=='all'&&ROLES[RK].pf!==PF))RK=PFDEF[PF];
var ROLE=ROLES[RK];try{localStorage.setItem('fp-proto-role-'+PF,RK);}catch(e){}
if(q.get('role')!==RK){q.set('role',RK);history.replaceState(null,'',location.pathname+'?'+q.toString()+location.hash);}
var RL=[];C.forEach(function(m){m.s.forEach(function(s){if(allowed(RK,m,s))RL.push([m.file,s[0]]);});});
function canSee(id){return !!known[id]&&allowed(RK,mod,known[id]);}
function go(dest){if(dest==='@home')dest=ROLE.home;var p=dest.split('#'),f=p[0]||mod.file,id=p[1]||'';
 if(f===mod.file){if(id)show(id);try{var pt=sessionStorage.getItem('fp-toast');if(pt){sessionStorage.removeItem('fp-toast');toast(pt);}}catch(e){}return;}
 if(PF!=='all'&&!C.some(function(m){return m.file===f;})){toast('That screen is in another platform pack (see docs/design)');return;}
 location.href=f+'.html'+location.search+(id?'#'+id:'');}
function switchRole(k,dest){try{localStorage.setItem('fp-proto-role-'+PF,k);}catch(e){}location.href=rurl(k,dest||ROLES[k].home);}
function jbar(){var old=$('#jbar');if(old)old.remove();if(!jk)return;var j=J[jk],st=j.steps[ji],nx=j.steps[ji+1],pv=j.steps[ji-1];
 var h='<div class="jbar" id="jbar"><div class="jt"><span class="jn">Journey · '+esc(j.name)+'</span><button class="jx" type="button" id="jx" aria-label="End journey">'+ic('x','xs')+'</button></div>'+
  '<div class="jm"><b>Step '+(ji+1)+' of '+j.steps.length+'</b> · '+esc(st[2])+'</div><div class="jdots">'+j.steps.map(function(_,i){return '<i class="'+(i<ji?'d':i===ji?'c':'')+'"></i>';}).join('')+'</div>'+
  '<div class="ja">'+(pv?'<a class="btn sm" href="'+jurl(jk,ji-1)+'">'+ic('chevl','xs')+'Back</a>':'')+(nx?'<a class="btn sm primary" href="'+jurl(jk,ji+1)+'">Next: '+esc(nx[2])+ic('chev','xs')+'</a>':'<a class="btn sm primary" href="../index.html">Finish · all journeys</a>')+'</div></div>';
 body.insertAdjacentHTML('beforeend',h);$('#jx').addEventListener('click',function(){var u=location.pathname+location.hash;history.replaceState(null,'',u);jk=null;jbar();});}


function navHtml(list){return list.map(function(n){if(n[0]==='h')return '<div class="nav-h">'+n[1]+'</div>';
 return '<a href="#" data-nav="'+n[0]+'" title="'+esc(n[1])+'" class="'+(n[3]?'has-cnt':'')+'">'+ic(n[2])+'<span>'+esc(n[1])+'</span>'+(n[3]?'<span class="cnt">'+n[3]+'</span>':'')+'</a>';}).join('');}

var roleOpts=(PF==='all'?['web','mobile','kiosk']:[PF]).map(function(g){return '<optgroup label="'+esc(PFS[g].name)+'">'+rolesIn(g).map(function(k){return '<option value="'+k+'"'+(k===RK?' selected':'')+'>'+esc(ROLES[k].name)+' · '+esc(ROLES[k].who)+'</option>';}).join('')+'</optgroup>';}).join('');
var myMods=C.filter(function(m){return m.s.some(function(s){return allowed(RK,m,s);});});
var proto='<div class="proto"><a href="../index.html">'+ic('grid','xs')+'All screens</a>'+
 '<label class="rolepick">'+ic('user','xs')+'<select id="p-role" aria-label="Role">'+roleOpts+'</select></label>'+
 '<select id="p-mod" aria-label="Module">'+(myMods.indexOf(mod)<0?'<option value="" selected>'+mod.id+' · '+esc(mod.title)+'</option>':'')+myMods.map(function(m){return '<option value="'+m.file+'"'+(m===mod?' selected':'')+'>'+m.id+' · '+esc(m.title)+'</option>';}).join('')+'</select>'+
 '<select id="p-scr" aria-label="Screen">'+mod.s.filter(function(s){return allowed(RK,mod,s);}).map(function(s,i){return '<option value="'+s[0]+'">'+(i+1)+'. '+esc(s[1])+'</option>';}).join('')+'</select>'+
 '<button class="pb" type="button" id="p-prev" aria-label="Previous screen">'+ic('chevl','xs')+'</button><button class="pb" type="button" id="p-next" aria-label="Next screen">'+ic('chev','xs')+'</button>'+
 '<span class="cnt" id="p-cnt"></span><span class="sp"></span>'+modeBtns+'</div>';

var app='<div class="app" id="app">'+
 '<aside class="side" id="side"></aside>'+
 '<div class="main"><header class="top"><button class="icon-btn burger" type="button" id="burger" aria-label="Menu">'+ic('menu')+'</button>'+
 '<button class="icon-btn railbtn" type="button" id="railbtn" aria-label="Collapse or expand the sidebar" title="Collapse or expand the sidebar">'+ic('menu')+'</button>'+
 '<span class="crumb" id="crumb"></span>'+
 '<span class="shift-chip" id="shiftchip"><span class="live"></span><span class="lbl">Morning shift</span><span class="num">10:48</span></span>'+
 '<span class="search">'+ic('search','sm')+'Search machines, orders, stops<kbd>Ctrl K</kbd></span>'+
 '<button class="ask-top" type="button" data-ask-open>'+ic('spark','sm')+'<span>Ask FP</span><kbd>Ctrl J</kbd></button>'+
 '<button class="icon-btn" type="button" aria-label="Notifications" data-to="s07-alerts-andon#centre">'+ic('bell')+'<span class="dot"></span></button></header>'+
 '<div class="subtabs" id="subtabs"></div><div class="view" id="view"></div>'+
 '<nav class="bnav" id="bnav"></nav></div></div>';

body.insertAdjacentHTML('afterbegin',proto+app);
try{if(localStorage.getItem('fp-rail')==='1'){$('#app').classList.add('rail');$('#railbtn').setAttribute('aria-pressed','true');}}catch(e){}
/* the prototype bar (roles, modules, screen list) is hidden unless asked for, so the design reads like the real website */
(function(){var off=true;try{off=localStorage.getItem('fp-proto')!=='show';}catch(e){}
 body.classList.toggle('proto-off',off);body.insertAdjacentHTML('beforeend','<button type="button" id="proto-t"></button><a id="proto-home" href="../index.html" title="Back to the start page: choose website, mobile app or kiosk">'+ic('grid','xs')+'All designs</a>');
 var t=$('#proto-t');function lab(){var o=body.classList.contains('proto-off');t.innerHTML=ic('grid','xs')+(o?'Prototype':'Hide bar');t.setAttribute('aria-expanded',String(!o));t.title=o?'Show the prototype bar: roles, modules, screen list, light and dark':'Hide the prototype bar';}
 lab();t.addEventListener('click',function(){var o=body.classList.toggle('proto-off');try{localStorage.setItem('fp-proto',o?'hide':'show');}catch(e){}lab();});})();
$('#view').appendChild(holder);

var SIDE_CO='<div class="brandrow" data-to="'+HOME_CO+'"><svg><use href="#mark"/></svg><span class="wm"><b>fp</b><span>analyzer</span></span></div>'+
 '<button class="site" type="button" data-toast="Site switcher: Hultsfred, Vetlanda">'+'<span class="sa">NT</span><span><b>Nordvik Trä AB</b><small>Hultsfred plant</small></span>'+ic('chevd','sm')+'</button>'+
 '<nav class="nav">'+navHtml(NAV_CO)+'</nav><div class="me" data-to="s01-identity-access#account">'+avHtml(ROLE.side==='co'?ROLE:ROLES.admin)+'<span><b>'+esc(ROLE.side==='co'?ROLE.who:ROLES.admin.who)+'</b><small>'+esc(ROLE.side==='co'?ROLE.title:ROLES.admin.title)+'</small></span></div>';
var SIDE_PL='<div class="brandrow" data-to="'+HOME_PL+'"><svg><use href="#mark"/></svg><span class="wm"><b>fp</b><span>analyzer</span></span><span class="staff-tag">Staff</span></div>'+
 '<nav class="nav">'+navHtml(NAV_PL)+'</nav><div class="me">'+avHtml(ROLE.side==='pl'?ROLE:ROLES['p-support'])+'<span><b>'+esc(ROLE.side==='pl'?ROLE.who:ROLES['p-support'].who)+'</b><small>'+esc(ROLE.side==='pl'?ROLE.title:ROLES['p-support'].title)+'</small></span></div>';
var BNAV_CO='<a href="#" data-nav="overview">'+ic('grid')+'Overview</a><a href="#" data-nav="floor">'+ic('live')+'Floor</a><a href="#" data-nav="stops">'+ic('stopc')+'Stops<span class="cntb y">3</span></a><a href="#" data-ask-open>'+ic('spark')+'Ask</a><a href="#" data-drawer>'+ic('menu')+'More</a>';
var BNAV_PL='<a href="#" data-nav="p-home">'+ic('grid')+'Home</a><a href="#" data-nav="p-companies">'+ic('building')+'Companies</a><a href="#" data-nav="p-health">'+ic('live')+'Health</a><a href="#" data-ask-open>'+ic('spark')+'Ask</a><a href="#" data-drawer>'+ic('menu')+'More</a>';
var curSide='';

/* ---------- routing ---------- */
var cur=null;
function meta(id){var s=known[id];var spec=(s&&s[2])||'';var parts=spec.split(':');var shell,nav;
 if(['auth','device','bare','platform','company'].indexOf(parts[0])>=0){shell=parts[0];nav=parts[1];}else{nav=parts[0];}
 if(!shell)shell=mod.shell||'company';
 if(shell==='company'&&mod.shell==='platform'&&!parts[1]&&!nav)nav='overview';
 return {shell:shell,nav:nav||mod.nav,title:s?s[1]:id};}
function show(id){
 if(!document.getElementById(id))id=secs[0].id;
 cur=id;var m=meta(id);
 secs.forEach(function(s){s.hidden=(s.id!==id);});
 var a=$('#app');a.dataset.shell=m.shell==='company'||m.shell==='platform'?'app':m.shell;a.classList.remove('drawer-open');
 var side=m.shell==='platform'?'pl':'co';
 if(side!==curSide){curSide=side;$('#side').innerHTML=side==='pl'?SIDE_PL:SIDE_CO;$('#bnav').innerHTML=side==='pl'?BNAV_PL:BNAV_CO;$('#shiftchip').hidden=(side==='pl');
   if(ROLE.nav){$$('#side [data-nav],#bnav [data-nav]').forEach(function(n){n.hidden=ROLE.nav.indexOf(n.dataset.nav)<0;});
     $$('#side .nav-h').forEach(function(h){var x=h.nextElementSibling,vis=false;while(x&&!x.classList.contains('nav-h')){if(!x.hidden)vis=true;x=x.nextElementSibling;}h.hidden=!vis;});}}
 var ok=canSee(id),na=$('#noacc');if(na)na.remove();
 if(!ok){var sec=document.getElementById(id);sec.hidden=true;var who=firstRole(mod,known[id]);
   $('#view').insertAdjacentHTML('afterbegin','<div class="noacc" id="noacc"><div class="card pad"><span class="ic">'+ic('lock')+'</span><h2>No access for '+esc(ROLE.name)+'</h2><p class="muted">'+esc(ROLE.who)+' does not have this screen: <b>'+esc(m.title)+'</b>. In the product it is not in their menu, and a direct link shows this page.</p>'+
     '<div class="row mt" style="gap:8px;flex-wrap:wrap"><a class="btn primary" href="'+rurl(RK,ROLE.home)+'">Go to my start screen</a>'+(who?'<button class="btn" type="button" data-role="'+who+'" data-dest="'+mod.file+'#'+id+'">See it as '+esc(ROLES[who].name)+'</button>':'')+'</div></div></div>');}
 var sec0=document.getElementById(id);
 if(ROLE.pf!=='web'&&PF==='all'){$$('.devices>div',sec0).forEach(function(d){d.hidden=ROLE.pf==='mobile'?!!d.querySelector('.tablet,.tv'):!!d.querySelector('.phone');});}
 $$('[data-hi]',sec0).forEach(function(h){h.textContent='Good morning, '+ROLE.first;});
 $$('[data-nav]').forEach(function(n){n.classList.toggle('on',n.dataset.nav===m.nav);});
 var navLabel=(side==='pl'?NAV_PL:NAV_CO).filter(function(n){return n[0]===m.nav;})[0];
 /* real navigation: every screen of this section is in the menu, and the breadcrumb shows the way here */
 var grp=[],here=mod.file+'#'+id;C.forEach(function(mm){mm.s.forEach(function(sc){if(!allowed(RK,mm,sc))return;var tt=metaOf(mm,sc);if(tt.nav!==m.nav||['auth','device','bare'].indexOf(tt.shell)>=0)return;grp.push([mm.file+'#'+sc[0],sc[1]]);});});
 $$('.subnav').forEach(function(x){x.remove();});
 var nl=$('#side [data-nav="'+m.nav+'"]');
 if(nl&&grp.length>1)nl.insertAdjacentHTML('afterend','<div class="subnav">'+grp.map(function(g){return '<a href="#" data-sub data-to="'+g[0]+'"'+(g[0]===here?' class="on" aria-current="page"':'')+'><span>'+esc(g[1])+'</span></a>';}).join('')+'</div>');
 $('#subtabs').innerHTML=grp.length>1&&ok?grp.map(function(g){return '<a href="#" data-sub data-to="'+g[0]+'"'+(g[0]===here?' class="on" aria-current="page"':'')+'>'+esc(g[1])+'</a>';}).join(''):'';
 var tr=[];try{tr=JSON.parse(sessionStorage.getItem('fp-trail')||'[]');}catch(e){}
 var tix=-1;tr.forEach(function(x,i){if(x[0]===here)tix=i;});if(tix>=0)tr=tr.slice(0,tix+1);else tr.push([here,m.title]);tr=tr.slice(-4);
 try{sessionStorage.setItem('fp-trail',JSON.stringify(tr));}catch(e){}
 var cr=[['@home',side==='pl'?'FP platform':'Nordvik Trä',1]];if(navLabel&&NAVTO[m.nav])cr.push([NAVTO[m.nav],navLabel[1],1]);
 tr.slice(0,-1).forEach(function(x){if(x[0]!==NAVTO[m.nav]&&x[0]!==here)cr.push([x[0],x[1]]);});
 $('#crumb').innerHTML=cr.map(function(c,i){return (i?'<span class="sepc">›</span>':'')+'<a href="#" '+(c[2]?'data-sub ':'')+'data-to="'+c[0]+'">'+esc(c[1])+'</a>';}).join('')+'<span class="sepc">›</span><b>'+esc(m.title)+'</b>';
 $('#p-scr').value=ok?id:'';
 var idx=-1;RL.forEach(function(x,i){if(x[0]===mod.file&&x[1]===id)idx=i;});
 $('#p-cnt').textContent=(idx>=0?(idx+1)+' / ':'')+RL.length+' screens for '+ROLE.name;
 fab.hidden=(m.shell==='auth'||m.shell==='device'||m.shell==='bare');
 askCtx();
 if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);
 window.scrollTo(0,0);requestAnimationFrame(function(){window.scrollTo(0,0);});
}
function step(d){var idx=-1;RL.forEach(function(x,i){if(x[0]===mod.file&&x[1]===cur)idx=i;});
 if(idx<0){var ci=C.indexOf(mod);for(var i=0;i<RL.length;i++){var mf=C.filter(function(m){return m.file===RL[i][0];})[0];if(C.indexOf(mf)>=ci){idx=i-(d>0?1:0);break;}}}
 var t=RL[idx+d];if(!t)return;go(t[0]+'#'+t[1]);}

/* ---------- Ask FP assistant ---------- */
var ANS=[
 {re:/(stop|loss|lost|why|reason|downtime)/i,t:'Line 2 lost <b>1 h 46 min</b> to stops this shift. The biggest reason is <b>Material wait (42 min)</b>, mostly on K-5 between 06:10 and 07:00.',
  rows:[['Material wait','42 min','6'],['Jam','31 min','11'],['Tool change','18 min','2'],['No reason yet','12 min','3']],head:['Reason','Time','Stops'],link:'Open the loss Pareto'},
 {re:/(oee|target|below|availability|performance)/i,t:'Line 2 OEE is <b>74 %</b> this week, <b>6 points</b> below the 80 % target. Availability is the main gap at <b>84 %</b>.',
  rows:[['Availability','84 %','90 %'],['Performance','91 %','93 %'],['Quality','97 %','98 %']],head:['Factor','This week','Target'],link:'Open OEE for Line 2'},
 {re:/(order|late|plan|queue|next)/i,t:'<b>ORD-24021</b> is <b>14 %</b> behind plan. At the ideal rate it finishes at <b>13:55</b>, 25 min after the due time. ORD-24017 is on track.',
  rows:[['ORD-24021','62 %','13:55'],['ORD-24017','82 %','12:40'],['ORD-24025','0 %','15:10']],head:['Order','Done','Est. finish'],link:'Open the order queue'},
 {re:/(maint|mtbf|mttr|breakdown|pm|repair)/i,t:'K-7 had <b>4 breakdowns</b> in the last 30 days. MTBF is <b>61 h</b> and MTTR is <b>38 min</b>. Two PM plans are due this week.',
  rows:[['K-7','61 h','38 min'],['K-5','94 h','22 min'],['K-3','140 h','15 min']],head:['Machine','MTBF','MTTR'],link:'Open maintenance KPIs'},
 {re:/(device|signal|offline|unit|channel|terminal)/i,t:'<b>2 devices</b> are offline: U-11 on K-11 (22 min) and U-04 on P-1 (3 h). Their buffered events will fill in when they reconnect.',
  rows:[['U-11','K-11','22 min'],['U-04','P-1','3 h 04 m']],head:['Device','Machine','Offline'],link:'Open devices'},
 {re:/(summar|shift|huddle|yesterday|night)/i,t:'Night shift: OEE <b>79 %</b>, <b>12 stops</b>, 11 registered. Biggest loss was a <b>Jam on K-5 (24 min)</b>. Output 2,980 of 3,100 pieces.',
  rows:[['OEE','79 %'],['Stops','12'],['Output','2,980 / 3,100']],head:['Measure','Value'],link:'Open the shift report'},
 {re:/(scrap|quality|reject)/i,t:'K-5 made <b>38 scrap pieces</b> today, <b>1.1 %</b> of output. Most were <b>Glue line visible (21)</b>.',
  rows:[['Glue line visible','21'],['Chipped edge','11'],['Wrong length','6']],head:['Scrap reason','Pieces'],link:'Open scrap registrations'},
 {re:/(cost|money|sek|eur|budget|bill|price)/i,t:'Lost time cost about <b>SEK 48,200</b> last month. Changeovers were the largest part at <b>SEK 17,900</b>.',
  rows:[['Changeover','SEK 17,900'],['Breakdowns','SEK 12,400'],['Material wait','SEK 9,800']],head:['Loss','Cost'],link:'Open cost of losses'}
];
var PEOPLE=/(who is (the )?(slow|fast|worst|best|lazy)|which (operator|person|worker|employee)|slowest|laziest|rank(ing)? (the )?(operator|people|worker))/i;
var aState='on';
var fab=document.createElement('button');fab.className='ask-fab';fab.type='button';fab.setAttribute('data-ask-open','');
fab.innerHTML='<span class="orb">'+ic('spark','sm')+'</span>Ask FP<span class="hint">Ctrl J</span>';
body.appendChild(fab);
body.classList.add('ask-dock');
body.insertAdjacentHTML('beforeend','<div class="ask-scrim" data-ask-close></div><aside class="ask" id="ask" aria-label="Ask FP assistant">'+
 '<div class="ask-h"><span class="orb">'+ic('spark','sm')+'</span><div><b>Ask FP</b><small>Your plant assistant</small></div><span class="sp"></span>'+
 '<button class="btn ghost sm icon" type="button" data-toast="Conversation history (kept 90 days, you can delete it)" aria-label="History">'+ic('history','sm')+'</button>'+
 '<button class="btn ghost sm icon" type="button" id="ask-new" aria-label="New conversation">'+ic('plus','sm')+'</button>'+
 '<button class="btn ghost sm icon" type="button" data-ask-close aria-label="Close">'+ic('x','sm')+'</button></div>'+
 '<div class="ask-ctx" id="ask-ctx"></div><div class="ask-log" id="ask-log"></div>'+
 '<div class="ask-in"><div class="ask-box"><textarea id="ask-q" rows="1" placeholder="Ask about machines, stops, orders…"></textarea>'+
 '<button class="mic" type="button" aria-label="Speak" data-toast="Voice input uses the device keyboard dictation">'+ic('mic','sm')+'</button><button class="send" type="button" id="ask-send" aria-label="Send">'+ic('send','sm')+'</button></div>'+
 '<div class="ask-foot">'+ic('shieldok','xs')+'<span>Numbers are checked against FP data. Questions about individual people are not answered.</span></div>'+
 '<div class="ask-state"><span class="tiny muted">Demo states:</span><button type="button" data-ask-state="on">Normal</button><button type="button" data-ask-state="off">Not enabled</button><button type="button" data-ask-state="budget">Budget used</button><button type="button" data-ask-state="down">Provider down</button></div></div></aside>');
var log=$('#ask-log'),qbox=$('#ask-q');
function ctxSugs(){var sec=document.getElementById(cur);var a=sec&&sec.dataset.ask;var list=null;if(a){try{list=JSON.parse(a);}catch(e){list=a.split('|');}}return list||mod.ask;}
function askCtx(){var m=meta(cur||secs[0].id);
 $('#ask-ctx').innerHTML=ic('eye','sm')+'<span>Looking at <b>'+esc(m.title)+'</b> · '+(m.shell==='platform'?'FP platform, all companies you may support':'Hultsfred · this shift')+'. Answers use only what you are allowed to see.</span>';
 if(!log.dataset.used)hello();}
function hello(){log.innerHTML='<div class="ask-hello"><h3>Hi '+esc(ROLE.first)+', what do you want to know?</h3><p>I can explain the numbers on this page, find the cause of a loss, or prepare a summary.</p>'+
 '<div class="ask-sugs">'+ctxSugs().map(function(q){return '<button class="ask-sug" type="button" data-sug="'+esc(q)+'">'+ic('spark','sm')+esc(q)+'</button>';}).join('')+'</div></div>';}
function stateMsg(){var t={off:['AI is not enabled for this company','A company admin can switch Ask on in Settings → AI. Your dashboards and reports work without it.','Open AI settings'],
 budget:['This month’s AI budget is used up','Ask, summaries and scan pause until 1 November or until an admin raises the budget. Reason suggestions keep working.','Ask your admin'],
 down:['Ask FP is not available right now','The AI provider is not answering. Try again in a few minutes. Nothing you need for production depends on it.','Try again']}[aState];
 return '<div class="msg-a refused"><b>'+t[0]+'</b><span class="dim">'+t[1]+'</span><div class="acts"><button class="btn sm" type="button" data-toast="'+t[2]+'">'+t[2]+'</button></div></div>';}
function ask(q){if(!q.trim())return;openAsk();log.dataset.used='1';
 if(log.querySelector('.ask-hello'))log.innerHTML='';
 log.insertAdjacentHTML('beforeend','<div class="msg-u">'+esc(q)+'</div><div class="typing"><i></i><i></i><i></i></div>');log.scrollTop=log.scrollHeight;
 setTimeout(function(){var ty=log.querySelector('.typing');if(ty)ty.remove();var h;
  if(aState!=='on'){h=stateMsg();}
  else if(PEOPLE.test(q)){h='<div class="msg-a refused"><b>I answer questions about machines and production, not about individual people.</b><span class="dim">Try asking which machine or shift lost the most time instead.</span><div class="acts"><button class="btn sm" type="button" data-sug="Which machine lost most time this week?">Which machine lost most time this week?</button></div></div>';}
  else{var a=ANS.filter(function(x){return x.re.test(q);})[0]||{t:'Here is what I found for <b>'+esc(meta(cur).title)+'</b>: everything on this page is within normal range for the last 4 weeks. The one item to watch is <b>K-5</b>, which has <b>3 stops without a reason</b>.',rows:[['K-5','3 stops','12 min']],head:['Machine','Open','Time'],link:'Open the worklist'};
   h='<div class="msg-a"><div class="t">'+a.t+'</div><table><thead><tr>'+a.head.map(function(c){return '<th>'+c+'</th>';}).join('')+'</tr></thead><tbody>'+a.rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td'+(i?' class="num"':'')+'>'+c+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>'+
    '<div class="meta"><span class="badge b-run">'+ic('check','xs')+'Numbers checked</span><span>Hultsfred · Line 2 · this shift · live data</span></div>'+
    '<div class="acts"><button class="btn sm soft" type="button" data-toast="Opens the screen with the same filters">'+a.link+ic('chev','xs')+'</button><button class="btn sm" type="button" data-toast="Action created and linked to this loss (S16)">'+ic('plus','xs')+'Create action</button>'+
    '<span class="sp"></span><button class="btn ghost sm icon" type="button" aria-label="Good answer" data-toast="Thanks, feedback saved">'+ic('thumbup','xs')+'</button><button class="btn ghost sm icon" type="button" aria-label="Bad answer" data-toast="Thanks, we use this to improve answers">'+ic('thumbdown','xs')+'</button></div></div>';}
  log.insertAdjacentHTML('beforeend',h);log.scrollTop=log.scrollHeight;},900);}
function openAsk(){body.classList.add('ask-open');setTimeout(function(){qbox.focus();},250);}
function closeAsk(){body.classList.remove('ask-open');}
$('#ask-send').addEventListener('click',function(){var q=qbox.value;qbox.value='';ask(q);});
qbox.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();var q=qbox.value;qbox.value='';ask(q);}});
$('#ask-new').addEventListener('click',function(){delete log.dataset.used;hello();});
$$('[data-ask-state]').forEach(function(b){b.addEventListener('click',function(){aState=b.dataset.askState;toast('Ask FP demo state: '+b.textContent);});});
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&(e.key==='j'||e.key==='J')){e.preventDefault();body.classList.contains('ask-open')?closeAsk():openAsk();}if(e.key==='Escape')closeAsk();});

/* ---------- global clicks ---------- */
document.addEventListener('click',function(e){
 var t=e.target;
 var el=t.closest('[data-ask-open]');if(el){e.preventDefault();openAsk();return;}
 el=t.closest('[data-ask-close]');if(el){closeAsk();return;}
 el=t.closest('[data-sug]');if(el){ask(el.dataset.sug);return;}
 el=t.closest('[data-ask-q]');if(el){e.preventDefault();ask(el.dataset.askQ);return;}
 el=t.closest('[data-go]');if(el){e.preventDefault();show(el.dataset.go);return;}
 el=t.closest('[data-drawer]');if(el){e.preventDefault();$('#app').classList.toggle('drawer-open');return;}
 el=t.closest('#railbtn');if(el){var on=$('#app').classList.toggle('rail');try{localStorage.setItem('fp-rail',on?'1':'0');}catch(er){}el.setAttribute('aria-pressed',String(on));return;}
 el=t.closest('#burger');if(el){$('#app').classList.toggle('drawer-open');return;}
 el=t.closest('[data-role]');if(el){e.preventDefault();switchRole(el.dataset.role,el.dataset.dest);return;}
 el=t.closest('a[href]');if(el&&!el.closest('.proto,.jbar')){var hm=el.getAttribute('href').match(/^(s\d\d-[a-z0-9-]+)\.html(?:#(.*))?$/);if(hm){e.preventDefault();if(el.dataset.toast){try{sessionStorage.setItem('fp-toast',el.dataset.toast);}catch(er){}}go(hm[1]+'#'+(hm[2]||''));return;}}
 el=t.closest('[data-to]');if(el&&!t.closest('a[href]:not([href="#"]),button[data-go]')){e.preventDefault();if(el.hasAttribute('data-sub')||el.dataset.to==='@home'||el.dataset.to===ROLE.home){try{sessionStorage.setItem('fp-trail','[]');}catch(er){}}if(el.dataset.toast){try{sessionStorage.setItem('fp-toast',el.dataset.toast);}catch(er){}}go(el.dataset.to);return;}
 el=t.closest('[data-nav]');if(el){e.preventDefault();try{sessionStorage.setItem('fp-trail','[]');}catch(er){}$('#app').classList.remove('drawer-open');var dst=NAVTO[el.dataset.nav];
   if(dst){go(dst);}else{toast('"'+(el.title||el.textContent.trim())+'" has no screen in the v3 design set');}return;}
 el=t.closest('[data-t]');if(el){var grp=el.parentElement.dataset.tabs;$$('[data-t]',el.parentElement).forEach(function(b){b.classList.toggle('on',b===el);});
   if(grp){$$('[data-pane^="'+grp+':"]').forEach(function(p){p.hidden=(p.dataset.pane!==grp+':'+el.dataset.t);});}return;}
 el=t.closest('.seg button');if(el){$$('button',el.parentElement).forEach(function(b){b.classList.toggle('on',b===el);});}
 el=t.closest('[data-pick] > *');if(el&&!t.closest('[data-pick] > * [data-pick]')){$$(':scope > *',el.parentElement).forEach(function(c){c.classList.toggle('on',c===el);});}
 el=t.closest('[data-multi] > *');if(el){el.classList.toggle('on');}
 el=t.closest('.switch:empty');if(el){el.classList.toggle('on');}
 el=t.closest('[data-toast]');if(el){e.preventDefault();toast(el.dataset.toast);}
 if(t.closest('a[href="#"]'))e.preventDefault();
});

document.addEventListener('click',function(e){var b=e.target.closest('button.btn,a.btn,button.k-btn,button.m-big');
 if(!b||b.disabled||b.getAttribute('aria-disabled')==='true')return;
 if(b.closest('.seg,.tabs,[data-pick],[data-multi],.proto,.ask,.jbar,.fp-ov,.fp-menu'))return;
 if(b.matches('[data-go],[data-to],[data-toast],[data-ask-open],[data-ask-q],[data-sug],[data-nav],[data-drawer],[data-t],[data-ask-close],[data-ask-state],[data-reason],[data-manual]'))return;
 if(b.tagName==='A'&&b.getAttribute('href')&&b.getAttribute('href')!=='#')return;
 var lbl=b.getAttribute('aria-label')||b.textContent.replace(/\s+/g,' ').trim();toast('Demo only: "'+(lbl||'this button')+'" is not wired in the prototype');});
$('#p-mod').addEventListener('change',function(){var f=this.value,m=C.filter(function(x){return x.file===f;})[0];var s=m&&m.s.filter(function(x){return allowed(RK,m,x);})[0];if(s)go(f+'#'+s[0]);});
$('#p-scr').addEventListener('change',function(){show(this.value);});
$('#p-role').addEventListener('change',function(){switchRole(this.value);});
$('#p-prev').addEventListener('click',function(){step(-1);});
$('#p-next').addEventListener('click',function(){step(1);});
$$('[data-mode-btn]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.modeBtn;applyMode();});});
window.addEventListener('hashchange',function(){show(location.hash.slice(1));});

/* ---------- live timers ---------- */
function two(n){return String(n).padStart(2,'0');}
function fmt(s,f){if(f==='hm')return Math.floor(s/3600)+' h '+two(Math.floor(s%3600/60))+' m';if(f==='hms')return Math.floor(s/3600)+':'+two(Math.floor(s%3600/60))+':'+two(s%60);return Math.floor(s/60)+':'+two(s%60);}
setInterval(function(){$$('[data-run]').forEach(function(el){var v=+el.dataset.run+1;el.dataset.run=v;el.textContent=fmt(v,el.dataset.fmt);});},1000);

applyMode();
if('scrollRestoration' in history)history.scrollRestoration='manual';
/* role variants: a screen can hold one block per role family (data-for), the signed-in role sees its own */
$$('section.screen').forEach(function(sc){var bl=$$(':scope > [data-for]',sc);if(!bl.length)return;var hit=false;
 bl.forEach(function(b){var on=b.dataset.for.split(' ').indexOf(RK)>=0;b.hidden=!on;if(on)hit=true;});if(!hit)bl[0].hidden=false;});
/* floor map: click a machine box, the side panel shows that machine */
function selName(){var sec=$('section.screen:not([hidden])'),p=sec&&$('[data-node-panel] [data-f="name"]',sec);return p?p.textContent.trim():'this machine';}
function pickNode(g){var svg=g.closest('svg'),sec=g.closest('section.screen');$$('[data-node]',svg).forEach(function(x){x.classList.toggle('sel',x===g);});
 $$('[data-node-panel] [data-f]',sec).forEach(function(el){var v=g.dataset[el.dataset.f];if(v!=null)el.textContent=v;});}
document.addEventListener('click',function(e){var g=e.target.closest&&e.target.closest('svg [data-node]');if(g)pickNode(g);});
document.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('svg [data-node]')){e.preventDefault();pickNode(e.target);}});
/* PIN pads: each digit fills a dot; four digits (or Face ID) open the next screen */
function okDest(d){var a=document.createElement('a');a.setAttribute('data-to',d);var t=destOf(a);return !t||allowed(RK,t[0],t[1]);}
document.addEventListener('click',function(e){var k=e.target.closest&&e.target.closest('.m-pad > span,.k-pad > span');if(!k||k.classList.contains('go'))return;var pad=k.parentElement,to=pad.dataset.pinTo,sec=pad.closest('section.screen'),num=!to&&$('.k-num',sec);
 if(num){var ty=k.textContent.trim(),cur=num.dataset.typed==='1'?num.textContent.replace(/\s/g,''):'';if(/^\d$/.test(ty))cur+=ty;else if(ty==='⌫')cur=cur.slice(0,-1);else return;num.dataset.typed='1';num.textContent=cur?String(Number(cur)).replace(/\B(?=(\d{3})+$)/g,' '):'0';return;}
 if(!to)return;
 var dots=$$('.pin-dots i,.dots i,.kdots i',sec),tx=k.textContent.trim(),face=/face/i.test(tx),del=!tx||tx==='⌫';
 var n=dots.filter(function(d){return d.classList.contains('f');}).length;
 if(del){if(n)dots[n-1].classList.remove('f');return;}
 if(!face){if(/^\d$/.test(tx)){if(n>=dots.length)n=0,dots.forEach(function(d){d.classList.remove('f');});dots[n].classList.add('f');n++;}else return;}
 if(face||n>=dots.length){dots.forEach(function(d){d.classList.add('f');});setTimeout(function(){go(okDest(to)?to:'@home');},260);}});
/* plain links inside a screen (href="#"): recent questions ask again, the rest behave like their button twin */
document.addEventListener('click',function(e){var a=e.target.closest('section.screen a[href="#"]');if(!a||a.matches('.btn,[data-go],[data-to],[data-toast],[data-ask-q],[data-sug]')||a.closest('nav,aside,.proto,.jbar'))return;
 e.preventDefault();var lb=a.textContent.replace(/\s+/g,' ').trim();
 if(a.closest('.hist')){$$('a',a.parentElement).forEach(function(x){x.classList.toggle('on',x===a);});ask(lb);return;}
 var k=kindOf(a,lb);if(k&&ACTFN[k]){ACTFN[k](a,lb);return;}toast('Opens: '+lb);},true);
/* phone app: the bottom tabs of each role, the signed-in person, filter chips and acknowledge */
var PTAB={home:['home','Home','@home'],machines:['live','Machines','s10-mobile-kiosk#machines'],alerts:['bell','Alerts','s10-mobile-kiosk#alerts',2],jobs:['wrench','Jobs','s10-mobile-kiosk#jobs',4],
 mine:['list','Mine','s18-operator#myreg'],mymach:['live','Machines','s18-operator#machines'],ask:['spark','Ask','s10-mobile-kiosk#ask'],more:['menu','More','s10-mobile-kiosk#more']};
var PTABS={'m-op':['home','mymach','mine','alerts','more'],'m-lead':['home','machines','alerts','ask','more'],'m-maint':['home','jobs','alerts','ask','more']};
$$('.m-tabs[data-tabs]').forEach(function(t){var ks=PTABS[RK]||PTABS['m-op'];
 t.innerHTML=ks.map(function(k){var x=PTAB[k];return '<span data-to="'+x[2]+'"'+(k===t.dataset.tabs?' class="on" aria-current="page"':'')+' data-sub>'+ic(x[0])+x[1]+(x[3]?'<i class="cntb y">'+x[3]+'</i>':'')+'</span>';}).join('');});
$$('[data-me-name]').forEach(function(e){e.textContent=ROLE.who;});$$('[data-me-title]').forEach(function(e){e.textContent=ROLE.title;});
$$('[data-me-av]').forEach(function(e){e.textContent=ROLE.init;e.className='av lg '+(ROLE.av||'');});
$$('[data-hi-first]').forEach(function(e){e.textContent='Hi '+ROLE.first;});
document.addEventListener('click',function(e){var f=e.target.closest&&e.target.closest('[data-filter-group] [data-filter]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();
 var g=f.closest('[data-filter-group]'),sec=f.closest('.m-body,section.screen');$$('[data-filter]',g).forEach(function(x){x.classList.toggle('on',x===f);});
 var rows=$$('[data-tags]',sec);if(rows.length){rows.forEach(function(r){r.hidden=r.dataset.tags.split(' ').indexOf(f.dataset.filter)<0;});}else flash(f);},true);
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-ack]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 b.textContent='Acknowledged by you';b.classList.remove('primary');b.disabled=true;toast('Acknowledged · the others in the group and the line board see it');},true);
/* phone: what a person saves shows up in their lists for this visit (sessionStorage fp-reg), like the real app.
   data-reg="id|machine|what|when" saves on tap; data-sel picks the stop(s) the reason screen is for; data-reg-sel takes the ticked
   [data-stop] rows; data-reg-save saves the chosen [data-reason]; data-ret is where Save goes next */
function ssGet(k){try{return JSON.parse(sessionStorage.getItem(k)||'[]');}catch(e){return [];}}
function ssSet(k,v){try{sessionStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));}catch(e){}}
function regOf(v){var p=v.split('|');return {id:p[0],m:p[1],w:p[2],s:p[3]||''};}
function regPut(a){var l=ssGet('fp-reg');a.forEach(function(x){l=l.filter(function(y){return y.id!==x.id;});l.unshift(x);});ssSet('fp-reg',l);}
function regRender(){var done={};ssGet('fp-reg').forEach(function(x){done[x.id]=1;});
 $$('[data-stop]').forEach(function(r){r.hidden=!!done[r.dataset.stop.split('|')[0]];});
 $$('[data-stop-count]').forEach(function(c){c.textContent=$$('[data-stop]',c.closest('.devices')||c.closest('section.screen')).filter(function(r){return !r.hidden;}).length;});
 $$('[data-stops-done]').forEach(function(b){b.hidden=$$('[data-stop]',b.closest('.devices')||b.closest('section.screen')).some(function(r){return !r.hidden;});});
 $$('[data-stops-left]').forEach(function(b){var n=b.dataset.stopsLeft.split(' ').filter(function(i){return !done[i];}).length;b.hidden=!n;
  var c=$('[data-left]',b);if(c)c.textContent=n+(n===1?' stop needs':' stops need')+' a reason';});
 $$('[data-reg-list]').forEach(function(box){$$('.reg-new',box).forEach(function(x){x.remove();});$$('[data-reg-id]',box).forEach(function(r){r.hidden=!!done[r.dataset.regId];});
  ssGet('fp-reg').slice().reverse().forEach(function(x){var c=x.m==='Production'?'var(--run-fill)':x.m==='Scrap'?'var(--andon)':'var(--stop-fill)',
    to=x.m==='Production'?'s08-registration#production':x.m==='Scrap'?'s08-registration#scrap':'s08-registration#m-reasons';
   box.insertAdjacentHTML('afterbegin','<div class="mrow reg-new" style="--c:'+c+'"><span class="d"></span><div><b>'+esc(x.m+' · '+x.w)+'</b><small>'+esc(x.s)+' · <span style="color:var(--run);font-weight:800">saved just now</span></small></div><button class="btn sm ghost" type="button" data-to="'+to+'" data-ret="s18-operator#myreg" data-sel="'+esc([x.id,x.m,x.w,x.s].join('|'))+'">Change</button></div>');});});
 var sl=ssGet('fp-sel');$$('[data-sel-info]').forEach(function(el){if(!sl.length)return;
  el.textContent=sl.length===1?sl[0].m+' · '+sl[0].s:sl.length+' stops: '+sl.map(function(x){return x.m+' '+x.s.split(' ')[0];}).join(', ');});
 $$('[data-sel-now]').forEach(function(el){if(sl.length===1&&sl[0].w)el.textContent='Now: '+sl[0].w;else el.textContent='';});}
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-reason],[data-reg],[data-sel],[data-reg-sel],[data-reg-save],[data-manual]');if(!t)return;
 var sc=t.closest('section.screen');setTimeout(regRender,0);
 if(t.matches('[data-reason]')){e.preventDefault();e.stopImmediatePropagation();$$('[data-reason]',sc).forEach(function(x){x.classList.toggle('on',x===t);x.setAttribute('aria-pressed',String(x===t));});return;}
 if(t.matches('[data-manual]')){e.preventDefault();e.stopImmediatePropagation();var row=t.closest('[data-manual-row]'),st=row.classList.toggle('mstop');
  $('[data-manual-st]',row).textContent=st?'Stopped now · 0:00':'Running';row.style.setProperty('--c',st?'var(--stop-fill)':'var(--run-fill)');
  t.textContent=st?'Running again':'Stopped now';toast(st?t.dataset.manual+' marked stopped · FP asks for the reason when it runs again':t.dataset.manual+' running again · register the reason now or later');return;}
 if(t.dataset.ret)ssSet('fp-ret',t.dataset.ret);
 if(t.dataset.reg){regPut([regOf(t.dataset.reg)]);return;}
 if(t.dataset.sel){ssSet('fp-sel',[regOf(t.dataset.sel)]);return;}
 if(t.hasAttribute('data-reg-sel')){var ch=$$('[data-stop] input:checked',sc).filter(function(i){return !i.closest('[data-stop]').hidden;}).map(function(i){return regOf(i.closest('[data-stop]').dataset.stop);});
  e.preventDefault();e.stopImmediatePropagation();if(!ch.length){toast('Tick one or more stops first');return;}ssSet('fp-sel',ch);go(t.dataset.to);return;}
 if(t.hasAttribute('data-reg-save')){e.preventDefault();e.stopImmediatePropagation();var r=$('[data-reason].on',sc),cm=$('[data-reg-note]',sc);
  if(!r){toast('Pick a reason first');return;}
  var l=ssGet('fp-sel');if(!l.length)l=[regOf(t.dataset.regSave)];
  var w=r.dataset.reason+(cm&&cm.value.trim()?' · "'+cm.value.trim().slice(0,40)+'"':'');
  regPut(l.map(function(x){return {id:x.id,m:x.m,w:w,s:x.s};}));ssSet('fp-sel',[]);
  var dest=sessionStorage.getItem('fp-ret')||t.dataset.to;try{sessionStorage.removeItem('fp-ret');}catch(er){}
  ssSet('fp-toast',(l.length>1?l.length+' stops saved: ':'Saved: ')+r.dataset.reason+' · you find it under Mine');go(dest);setTimeout(regRender,0);return;}},true);
document.addEventListener('click',function(){setTimeout(regRender,0);});
document.addEventListener('input',function(e){var q=e.target.closest&&e.target.closest('[data-reason-search]');if(!q)return;var sc=q.closest('section.screen'),v=q.value.trim().toLowerCase(),any=false;
 $$('[data-rgrp]',sc).forEach(function(g){var n=0;$$('[data-reason]',g).forEach(function(b){var hit=!v||b.textContent.toLowerCase().indexOf(v)>=0;b.hidden=!hit;if(hit)n++;});g.hidden=!n;if(n)any=true;});
 var no=$('[data-reason-none]',sc);if(no)no.hidden=any;});
regRender();
/* TV boards: pages rotate by themselves; the prototype strip under the TV can pick a page or show "no connection" */
$$('[data-tv]').forEach(function(tv){var pgs=$$('.tv-pg',tv);if(!pgs.length)return;var dots=$$('.tv-dots i',tv),sec=tv.closest('section.screen'),i=0,t=null;
 function set(n){i=(n+pgs.length)%pgs.length;pgs.forEach(function(p,k){p.hidden=k!==i;});dots.forEach(function(d,k){d.classList.toggle('on',k===i);});
  $$('[data-tv-page]',sec).forEach(function(b){b.classList.toggle('on',+b.dataset.tvPage===i);});}
 function run(){clearInterval(t);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)t=setInterval(function(){if(!sec.hidden)set(i+1);},6000);}
 $$('[data-tv-page]',sec).forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();set(+b.dataset.tvPage);run();});});
 $$('[data-tv-off]',sec).forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var off=tv.classList.toggle('off');b.classList.toggle('on',off);$('.tv-cn',tv).textContent=off?'Offline':'Live';});});
 set(0);run();});
/* terminal: tiles that switch on and off, chips, and small dialogs */
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-toggle]');if(t){e.preventDefault();var on=t.classList.toggle('on');t.setAttribute('aria-pressed',String(on));return;}
 var c=e.target.closest&&e.target.closest('[data-chips] > span');if(c){$$(':scope > span',c.parentElement).forEach(function(x){x.classList.toggle('on',x===c);});return;}
 var o=e.target.closest&&e.target.closest('[data-open]');if(o){e.preventDefault();var d=document.getElementById(o.dataset.open);if(d)d.hidden=false;return;}
 var x=e.target.closest&&e.target.closest('[data-close]');if(x){var dl=x.closest('.k-dlg,[data-dlg]');if(dl)dl.hidden=true;}},true);
/* role gate: a link to a screen this role cannot open is hidden (buttons, links) or made plain (cards, rows), like the real app */
function destOf(el){var d=el.getAttribute('data-to');if(d==='@home')return null;
 if(!d&&el.dataset.go)d=mod.file+'#'+el.dataset.go;
 if(!d){var hm=(el.getAttribute('href')||'').match(/^(s\d\d-[a-z0-9-]+)\.html(?:#(.*))?$/);if(!hm)return null;d=hm[1]+'#'+(hm[2]||'');}
 var p=d.split('#'),f=p[0]||mod.file,dm=C.filter(function(m){return m.file===f;})[0];if(!dm)return null;
 var ds=p[1]?dm.s.filter(function(x){return x[0]===p[1];})[0]:dm.s[0];return ds?[dm,ds]:null;}
$$('section.screen [data-to],section.screen [data-go],section.screen a[href^="s"]').forEach(function(el){if(el.closest('.proto,.jbar'))return;
 var t=destOf(el);if(!t||allowed(RK,t[0],t[1]))return;el.setAttribute('data-gated','');
 if(/^(save|send|submit|confirm|register|done|finish|approve|apply)\b/i.test(el.textContent.trim())){el.removeAttribute('data-to');el.removeAttribute('data-go');if(el.tagName==='A')el.setAttribute('href','#');}
 else if(el.matches('.back,[aria-label="Back"]')){el.removeAttribute('data-to');el.removeAttribute('data-go');el.setAttribute('data-back','');}
 else if(el.tagName==='A'||el.tagName==='BUTTON'||el.classList.contains('btn')){el.hidden=true;var row=el.closest('.m-row,.li');if(row&&!$('a:not([hidden]),button:not([hidden]),.switch',row))row.hidden=true;}
 else{el.removeAttribute('data-to');el.removeAttribute('data-go');el.removeAttribute('role');el.removeAttribute('tabindex');}});
/* phone and terminal: every inner screen has a way back (previous screen of this visit, else the role's start screen) */
var NOBACK=['S10:splash','S10:unlock','S10:permissions','S10:update','S10:home','S10:k-pair','S01:t-pair','S18:idle','S18:signin','S18:home'];
secs.forEach(function(sc){if(NOBACK.indexOf(mod.id+':'+sc.id)>=0)return;
 $$('.phone,.tablet',sc).forEach(function(d){if($('.back,[aria-label="Back"],[aria-label="Close"],.m-tabs',d))return;
  var top=$(d.matches('.phone')?'.m-top':'.k-top',d);if(!top)return;
  top.insertAdjacentHTML('afterbegin',d.matches('.phone')?'<button class="back" type="button" data-back aria-label="Back">'+ic('chevl','sm')+'</button>':'<button class="btn ghost icon" type="button" data-back aria-label="Back">'+ic('chevl')+'</button>');});});
function backDest(){var tr=[];try{tr=JSON.parse(sessionStorage.getItem('fp-trail')||'[]');}catch(e){}
 var here=mod.file+'#'+cur;for(var i=tr.length-1;i>=0;i--){if(tr[i][0]!==here&&canGo(tr[i][0]))return tr[i][0];}return '@home';}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-back]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();go(backDest());},true);
show(location.hash.slice(1)||secs[0].id);
jbar();
try{var pt=sessionStorage.getItem('fp-toast');if(pt){sessionStorage.removeItem('fp-toast');setTimeout(function(){toast(pt);},150);}}catch(e){}
window.addEventListener('load',function(){setTimeout(function(){window.scrollTo(0,0);},0);});
/* ---------- actions: buttons do what they say on this screen (prototype, nothing is stored) ---------- */
var ACTS=[
 ['scrap',/^register scrap$/i],
 ['prod',/^register production$/i],
 ['reason',/^register reason now$/i],
 ['fb',/^(good|bad) answer$/i],
 ['ok',/^count as production$/i],
 ['edit',/^editing$/i],
 ['help',/^(ask|help)$/i],
 ['run',/^(plan|play|choose|choose type|split the stop|andon|end and changeover)$/i],
 ['run',/^(new code|request change|request|allow|pause|renew)\b/i],
 ['next',/^(sign in|join with|open offline)\b/i],
 ['file',/^(replace image|retake photo|photo)$/i],
 ['view',/^(preview|compare|see example|read more|show original)$/i],
 ['more',/^manage$/i],
 ['edit',/^fix count\b/i],
 ['save',/^keep plan\b/i],
 ['file',/^(add photo|add file|upload|attach|choose file)\b/i],
 ['seats',/^add seats\b/i],
 ['add',/^(\+\s*)?(add|new|create|invite)\b/i],
 ['edit',/^(edit|change|rename)\b/i],
 ['del',/^(delete|remove|revoke|end session|discard|deactivate|archive)\b/i],
 ['ok',/^(approve|accept|verify|confirm|sign)$|^(approve|accept|verify|confirm) /i],
 ['no',/^(reject|decline|block)\b/i],
 ['save',/^(save|apply|publish|submit)\b/i],
 ['run',/^(unlock|send|retry|rotate|connect|restart|update firmware|import|run now|replay|test|try again|resend|sync|start|resume|switch|rollback|recalculate|generate)\b/i],
 ['csv',/^(export|csv|download)\b/i],
 ['pdf',/^(pdf|print)\b/i],
 ['copy',/^copy\b/i],
 ['view',/^(open|details?|view|open error)$/i],
 ['inc',/^\+$/],['dec',/^[−-]$/],
 ['help',/^help$/i],
 ['more',/^(more|options|more actions)$/i],
 ['back',/^(cancel|back|close|not now|ok|done|later|skip)\b/i],
 ['next',/^(continue|next)\b/i]];
var ICONK={'#i-edit':'edit','#i-trash':'del','#i-more':'more','#i-x':'back','#i-copy':'copy','#i-download':'csv','#i-plus':'add','#i-refresh':'run','#i-chevl':'back'};
function lblOf(b){return (b.getAttribute('aria-label')||b.textContent||'').replace(/\s+/g,' ').trim();}
function kindOf(b,lb){for(var i=0;i<ACTS.length;i++)if(ACTS[i][1].test(lb))return ACTS[i][0];
 if(!b.textContent.trim()){var u=b.querySelector('use');if(u)return ICONK[u.getAttribute('href')]||null;}return null;}
function rowOf(b){return b.closest('tr,.li,.mrow,.alrt,.k-card,.m-card,[data-item]');}
function listNear(b){var sc=b.closest('.card,.dlg,.dr')||b.closest('section.screen');
 while(sc){var t=sc.querySelector('table tbody,.list');if(t)return t;var up=sc.parentElement;sc=up?up.closest('.card,section.screen'):null;}return null;}
function cellsOf(list){var t=list.closest('table');if(!t)return [{l:'Name',i:0},{l:'Details',i:1}];
 var out=[];$$('thead th',t).forEach(function(th,i){var x=th.textContent.replace(/\s+/g,' ').trim();if(x&&x.length<32&&out.length<5)out.push({l:x,i:i});});return out.length?out:[{l:'Name',i:0}];}
function tmsg(b,d){var t=b.dataset.toast;return t&&!/\b(opens?|dialog|would|panel|picker|drawer|wizard|form|comes? in)\b/i.test(t)?t:d;}
function flash(el){el.classList.remove('is-flash');void el.offsetWidth;el.classList.add('is-flash');}
function overlay(h,onOk){var ov=document.createElement('div');ov.className='fp-ov';ov.innerHTML=h;body.appendChild(ov);
 function close(){ov.remove();document.removeEventListener('keydown',esck);}function esck(e){if(e.key==='Escape')close();}
 document.addEventListener('keydown',esck);
 ov.addEventListener('click',function(e){if(e.target===ov||e.target.closest('[data-x]')){close();return;}
  if(e.target.closest('[data-ok]')){if(!onOk||onOk(ov)!==false)close();}});
 var f=ov.querySelector('input,select,[data-ok]');if(f)setTimeout(function(){f.focus();},30);return ov;}
function dlgHtml(title,sub,inner,okLbl,danger){return '<div class="dlg narrow" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="dlg-h"><div style="flex:1;min-width:0"><h2>'+esc(title)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div><button class="btn ghost icon" type="button" data-x aria-label="Close">'+ic('x')+'</button></div>'+
 (inner?'<div class="dlg-b">'+inner+'</div>':'')+'<div class="dlg-f"><button class="btn" type="button" data-x>Cancel</button><button class="btn '+(danger?'danger':'primary')+'" type="button" data-ok>'+esc(okLbl)+'</button></div></div>';}
function formDlg(title,fields,okLbl,fn){
 var inner=fields.map(function(f,i){return '<div class="field"><label for="fpf'+i+'">'+esc(f.l)+'</label>'+(f.opts?'<select class="select" id="fpf'+i+'">'+f.opts.map(function(o){return '<option'+(o===f.v?' selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>':'<input class="input" id="fpf'+i+'" value="'+esc(f.v||'')+'" placeholder="'+esc(f.ph||'')+'">')+'</div>';}).join('');
 overlay(dlgHtml(title,'Prototype: the change shows on this screen until you reload.',inner,okLbl),function(ov){
  var v=fields.map(function(f,i){return ov.querySelector('#fpf'+i).value.trim();});
  if(fields.length&&!v[0]){var a=ov.querySelector('#fpf0');a.classList.add('bad');a.focus();return false;}fn(v);});}
function confirmDlg(title,sub,okLbl,danger,fn){overlay(dlgHtml(title,sub,'',okLbl,danger),function(){fn();});}
function addRow(list,fields,v,tag){var tpl=list.tagName==='TBODY'?list.querySelector('tr'):list.querySelector(':scope > *');if(!tpl)return null;
 var r=tpl.cloneNode(true);r.classList.remove('sel','on');r.removeAttribute('data-to');
 if(r.tagName==='TR'){$$('td',r).forEach(function(td,ix){var k=-1;fields.forEach(function(f,j){if(f.i===ix)k=j;});
   if(k>=0){var bb=td.querySelector('b,strong');if(bb){bb.textContent=v[k]||'—';var sm2=bb.nextElementSibling||td.querySelector('small');if(sm2&&sm2!==bb)sm2.textContent=v.filter(function(x){return /@/.test(x);})[0]||tag+' just now';var av=td.querySelector('.av');if(av)av.textContent=(v[k]||'?').split(/\s+/).map(function(x){return x[0];}).join('').slice(0,2).toUpperCase();}else td.textContent=v[k]||'—';}else if(td.querySelector('.badge'))td.innerHTML='<span class="badge b-brand">'+esc(tag)+'</span>';else if(!td.querySelector('button,a,input,select,.switch'))td.textContent='—';});}
 else{var b1=r.querySelector('b,strong');if(b1)b1.textContent=v[0];var sm=r.querySelector('small');if(sm)sm.textContent=v.slice(1).filter(Boolean).join(' · ')||tag;var bd=r.querySelector('.badge');if(bd){bd.className='badge b-brand';bd.textContent=tag;}}
 r.classList.add('is-new');list.insertBefore(r,list.firstChild);r.scrollIntoView({block:'nearest',behavior:'smooth'});return r;}
function busy(b,during,after,fn){if(b.dataset.busy)return;b.dataset.busy='1';var h=b.innerHTML;b.style.minWidth=b.offsetWidth+'px';b.classList.add('busy');b.innerHTML='<span class="spin"></span>'+esc(during);
 setTimeout(function(){b.classList.remove('busy');b.innerHTML=ic('check','sm')+esc(after);if(fn)fn();setTimeout(function(){b.innerHTML=h;delete b.dataset.busy;b.style.minWidth='';},1800);},650);}
function back(){if(history.length>1)history.back();else go(ROLE.home);}
var RUNW={allow:['Asking…','Allowed'],pause:['Pausing…','Paused'],renew:['Renewing…','Renewed'],unlock:['Unlocking…','Active'],send:['Sending…','Sent'],resend:['Sending…','Sent'],retry:['Retrying…','Done'],rotate:['Rotating…','Rotated'],connect:['Connecting…','Connected'],restart:['Restarting…','Restarted'],update:['Updating…','Updated'],
 import:['Importing…','Imported'],run:['Running…','Done'],replay:['Replaying…','Replayed'],test:['Testing…','Test passed'],try:['Trying…','Done'],sync:['Syncing…','Synced'],start:['Starting…','Started'],
 resume:['Resuming…','Resumed'],switch:['Switching…','Switched'],rollback:['Rolling back…','Rolled back'],recalculate:['Recalculating…','Recalculated'],generate:['Generating…','Ready'],request:['Sending…','Requested'],plan:['Planning…','Planned'],play:['Playing…','Played'],choose:['Choosing…','Chosen'],split:['Splitting…','Split in 2'],andon:['Calling…','Andon called'],end:['Ending order…','Changeover started'],new:['Generating…','Code 4821']};
var ACTFN={
 add:function(b,lb){var list=listNear(b),inv=/^(invite|add operator|add member|add people|add user)/i.test(lb),noun=lb.replace(/^(\+\s*)?(add|new|create|invite)\s*/i,'').replace(/\s*\d+$/,'').trim();
  var title=inv?'Invite people':(/^(new|create)/i.test(lb)?'New ':'Add ')+(noun||'item');
  var fields=inv?[{l:'Name',ph:'First and last name'}].concat(/without email/i.test(lb)?[]:[{l:'Work email',ph:'name@nordvik-tra.example'}]).concat([{l:'Role',opts:['Operator','Shift lead','Maintenance','Quality','Planner','Production manager','Viewer','Admin'],v:'Operator'}])
   :(list?cellsOf(list):[{l:'Name'},{l:'Details'}]);
  formDlg(title,fields,inv?'Send invite':(/^(new|create)/i.test(lb)?'Create':'Add'),function(v){
   if(list){var ff=fields;if(inv){var hc=cellsOf(list);ff=fields.map(function(f){var h=hc.filter(function(c){return c.l.toLowerCase().indexOf(f.l.split(' ')[0].toLowerCase())===0;})[0];return {l:f.l,i:h?h.i:-1};});}addRow(list,ff,v,inv?'Invited':'New');}
   toast(tmsg(b,(inv?'Invite sent to '+(v[1]||v[0]):'Added: '+v[0])));});},
 seats:function(b){formDlg('Add seats',[{l:'How many extra seats?',v:'1'}],'Request',function(v){toast(tmsg(b,'Request sent: '+v[0]+' extra seat(s). Your admin gets the new price to confirm.'));});},
 edit:function(b,lb){if(b.dataset.editing){ACTFN.save(b,'Save');return;}var r=rowOf(b);
  if(r&&r.tagName==='TR'){var hs=$$('thead th',r.closest('table')),tds=$$('td',r),fields=[];
   tds.forEach(function(td,ix){if(td.querySelector('button,input,select,.switch,.badge'))return;var v=td.textContent.replace(/\s+/g,' ').trim();if(fields.length<6)fields.push({l:(hs[ix]&&hs[ix].textContent.trim())||'Field '+(ix+1),i:ix,v:v});});
   formDlg('Edit '+(fields[0]?fields[0].v:''),fields,'Save',function(v){fields.forEach(function(f,k){tds[f.i].textContent=v[k];});flash(r);toast(tmsg(b,'Saved'));});return;}
  if(r){var b1=r.querySelector('b,strong'),sm=r.querySelector('small'),f2=[{l:'Name',v:b1?b1.textContent.trim():''}];if(sm)f2.push({l:'Details',v:sm.textContent.trim()});
   formDlg('Edit',f2,'Save',function(v){if(b1)b1.textContent=v[0];if(sm)sm.textContent=v[1];flash(r);toast(tmsg(b,'Saved'));});return;}
  var sc=b.closest('.card')||b.closest('section.screen');sc.classList.add('is-editing');b.dataset.editing='1';b.dataset.lbl=b.innerHTML;
  $$('b,dd,td,p,h3,span.v,.kpi-v',sc).forEach(function(x){if(!x.children.length&&x.textContent.trim()&&!x.closest('button,.badge,.btn'))x.setAttribute('contenteditable','true');});
  b.innerHTML=ic('check','sm')+'Save';b.classList.add('primary');toast('Editing: change the text, then press Save');},
 save:function(b){if(b.dataset.editing){var sc=b.closest('.card')||b.closest('section.screen');$$('[contenteditable]',sc).forEach(function(x){x.removeAttribute('contenteditable');});sc.classList.remove('is-editing');
   b.innerHTML=b.dataset.lbl;b.classList.remove('primary');delete b.dataset.editing;flash(sc);toast(tmsg(b,'Saved'));return;}
  busy(b,'Saving…','Saved',function(){var sc=b.closest('.card,.dlg')||b.closest('section.screen');$$('.bad',sc).forEach(function(i){i.classList.remove('bad');});flash(sc);toast(tmsg(b,'Saved'));});},
 del:function(b,lb){var r=rowOf(b),nm=r?((r.querySelector('b,strong,td')||{}).textContent||'').replace(/\s+/g,' ').trim().slice(0,60):'',vb=lb.replace(/[.…]+$/,'');
  confirmDlg(vb+(nm?': '+nm:'')+'?',r?'It is removed from this list.':'You leave this screen and the changes are not kept.',vb,true,function(){
   if(r){r.classList.add('is-gone');setTimeout(function(){r.remove();},260);}else back();toast(tmsg(b,vb+' done'+(nm?': '+nm:'')));});},
 ok:function(b,lb){decide(b,lb,true);},no:function(b,lb){decide(b,lb,false);},
 run:function(b,lb){var w=lb.toLowerCase().split(' ')[0],t=RUNW[w]||['Working…','Done'],r=rowOf(b);
  busy(b,t[0],t[1],function(){if(r&&/^(retry|try|replay|connect|resend|unlock)/.test(w)){var bd=r.querySelector('.badge');if(bd){bd.className='badge b-run';bd.textContent=t[1];}flash(r);}toast(tmsg(b,lb+': '+t[1].toLowerCase()));});},
 csv:function(b){var list=listNear(b),t=list&&list.closest('table');if(!t){toast(tmsg(b,'Export started. The file is sent to your email when ready.'));return;}
  var rows=$$('tr',t).map(function(tr){return $$('th,td',tr).map(function(c){return '"'+c.textContent.replace(/\s+/g,' ').trim().replace(/"/g,'""')+'"';}).join(',');});
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));a.download=(mod.id+'-'+(cur||'export')+'.csv').toLowerCase();body.appendChild(a);a.click();a.remove();toast('Downloaded '+a.download);},
 pdf:function(){toast('Opening the print view: choose "Save as PDF"');setTimeout(function(){window.print();},400);},
 copy:function(b){var sc=rowOf(b)||b.closest('.card,.row,.field')||b.parentElement,src=sc.querySelector('input,code,.mono'),txt=src?(src.value||src.textContent).trim():lblOf(b);
  try{navigator.clipboard.writeText(txt);}catch(e){}flash(src||sc);toast('Copied'+(txt.length<48?': '+txt:''));},
 file:function(b){var inp=document.createElement('input');inp.type='file';inp.accept='image/*,.pdf';inp.addEventListener('change',function(){var f=inp.files[0];if(!f)return;
  b.insertAdjacentHTML('afterend',' <span class="chip">'+ic('clip','xs')+esc(f.name)+'</span>');toast('Attached: '+f.name);});inp.click();},
 view:function(b){var r=rowOf(b);if(!r||r.tagName!=='TR'){toast(tmsg(b,'Opens the full record'));return;}var hs=$$('thead th',r.closest('table'));
  var inner='<dl class="kv">'+$$('td',r).map(function(td,i){var v=td.textContent.replace(/\s+/g,' ').trim();if(!v||td.querySelector('button'))return '';return '<div><dt>'+esc((hs[i]&&hs[i].textContent.trim())||'')+'</dt><dd>'+esc(v)+'</dd></div>';}).join('')+'</dl>';
  overlay(dlgHtml('Details','',inner,'Close'),null);},
 inc:function(b){step1(b,1);},dec:function(b){step1(b,-1);},
 help:function(){openAsk();},
 scrap:function(){var n=selName();formDlg('Register scrap · '+n,[{l:'How many',v:'1'},{l:'Reason',opts:['Edge chipped','Glue on face','Wrong size','Damaged in handling','Other'],v:'Edge chipped'}],'Save scrap',function(v){toast('Saved: '+v[0]+' scrapped on '+n+' ('+v[1]+')');});},
 prod:function(){var n=selName();formDlg('Register production · '+n,[{l:'Good pieces',v:'120'},{l:'Order',opts:['1042-118','1042-117','1042-120'],v:'1042-118'}],'Save production',function(v){toast('Saved: '+v[0]+' good pieces on '+n+', order '+v[1]);});},
 fb:function(b){var on=b.getAttribute('aria-pressed')!=='true';$$('button',b.parentElement).forEach(function(x){if(/answer$/i.test(lblOf(x)))x.removeAttribute('aria-pressed');});if(on)b.setAttribute('aria-pressed','true');toast(on?'Thanks. Your rating helps tune Ask FP':'Rating removed');},
 reason:function(b){formDlg('Why did it stop?',[{l:'Reason',opts:['Jam in feeder','Material wait','Tool change','Setup','Quality check','Other'],v:'Jam in feeder'},{l:'Comment',ph:'Optional'}],'Save reason',function(v){toast('Saved: '+v[0]);setTimeout(function(){go('@home');},700);});},
 pick:function(b,lb){$$(':scope > *',b.parentElement).forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});flash(b);toast('Selected: '+lb.split(/(?=[A-Z][a-z])/)[0].trim());},
 more:function(b){var old=$('.fp-menu');if(old)old.remove();var m=document.createElement('div');m.className='fp-menu';
  m.innerHTML='<button type="button" data-k="edit">'+ic('edit','sm')+'Edit</button><button type="button" data-k="copy">'+ic('copy','sm')+'Copy link</button><button type="button" class="danger" data-k="del">'+ic('trash','sm')+'Remove</button>';
  var r=b.getBoundingClientRect();m.style.top=(r.bottom+scrollY+4)+'px';m.style.left=Math.max(8,r.right+scrollX-170)+'px';body.appendChild(m);
  m.addEventListener('click',function(e){var x=e.target.closest('[data-k]');if(!x)return;m.remove();var k=x.dataset.k;if(k==='copy'){try{navigator.clipboard.writeText(location.href);}catch(er){}toast('Link copied');}else ACTFN[k](b,k==='del'?'Remove':'Edit');});
  setTimeout(function(){document.addEventListener('click',function c(e){if(!m.contains(e.target)){m.remove();document.removeEventListener('click',c);}});},0);},
 back:function(b){var ov=b.closest('.dlg,.dr');if(ov&&ov.closest('.drawer-demo,.state-grid,.states')){flash(ov);toast('Closed');return;}back();},
 next:function(b,lb){var ids=mod.s.filter(function(s){return allowed(RK,mod,s);}).map(function(s){return s[0];}),i=ids.indexOf(cur);
  if(i>=0&&i<ids.length-1)show(ids[i+1]);else toast(tmsg(b,'That was the last step'));}};
function step1(b,d){var box=b.parentElement,inp=box.querySelector('input'),n=inp||box.querySelector('.num,b,span:not(.i)');if(!n)return;
 var v=parseFloat((inp?inp.value:n.textContent).replace(/[^\d.,-]/g,'').replace(',','.'))||0;v=Math.max(0,v+d);if(inp)inp.value=v;else n.textContent=String(v);flash(n);}
function decide(b,lb,ok){var w=ok?({accept:'Accepted',verify:'Verified',confirm:'Confirmed',sign:'Signed'}[lb.toLowerCase().split(' ')[0]]||'Approved'):'Rejected';
 var r=rowOf(b),grp=b.parentElement;
 $$(':scope > button,:scope > .btn',grp).forEach(function(x){if(x!==b&&/^(ok|no)$/.test(kindOf(x,lblOf(x))||''))x.remove();});
 b.insertAdjacentHTML('beforebegin','<span class="badge '+(ok?'b-run':'b-stop')+'">'+ic(ok?'check':'x','xs')+w+'</span>');b.remove();
 if(r){var bd=$$('.badge',r).filter(function(x){return x.textContent!==w;})[0];if(bd){bd.className='badge '+(ok?'b-run':'b-stop');bd.textContent=w;}flash(r);}
 toast(tmsg(b,w+(r?': '+(((r.querySelector('b,strong,td')||{}).textContent||'').replace(/\s+/g,' ').trim().slice(0,50)):'')));}
document.addEventListener('click',function(e){var b=e.target.closest('button,a.btn');if(!b||b.disabled||b.getAttribute('aria-disabled')==='true'||b.id)return;
 if(b.closest('.proto,.jbar,.ask,.fp-ov,.fp-menu,.seg,.tabs,[data-pick],[data-multi]'))return;
 if(b.matches('[data-go],[data-to],[data-nav],[data-t],[data-role],[data-ask-q],[data-ask-open],[data-ask-close],[data-sug],[data-drawer],[data-mode-btn],[data-ask-state],[data-k],[data-tv-page],[data-tv-off],[data-filter],[data-ack],[data-back],[data-toggle],[data-open],[data-close],[data-reason],[data-manual]'))return;
 if(b.tagName==='A'&&b.getAttribute('href')&&b.getAttribute('href')!=='#')return;
 var lb=lblOf(b),k=kindOf(b,lb);
 if(!k&&!b.hasAttribute('data-toast')){var sib=b.parentElement?$$(':scope > '+b.tagName.toLowerCase(),b.parentElement).filter(function(x){return x.className===b.className;}):[];if(sib.length>=3)k='pick';}
 if(!k||!ACTFN[k])return;e.preventDefault();e.stopPropagation();ACTFN[k](b,lb);},true);
/* phone app: bottom tabs, back arrow and rows go where the real app goes (first screen this role may open) */
var MTAB={home:['@home'],shift:['s18-operator#myshift'],mine:['s18-operator#myreg'],floor:['s18-operator#machine','s03-machine-state#status-list'],stops:['s18-operator#myreg','s18-operator#machine','s08-registration#worklist'],ask:['s10-mobile-kiosk#ask'],more:['s10-mobile-kiosk#more','s10-mobile-kiosk#notif-settings'],
 me:['s10-mobile-kiosk#notif-settings'],alerts:['s10-mobile-kiosk#alerts','s07-alerts-andon#phone'],jobs:['s10-mobile-kiosk#jobs'],machines:['s10-mobile-kiosk#machines','s18-operator#machine'],machine:['s18-operator#machine']};
function canGo(d){if(d==='@home')return true;var p=d.split('#'),m=C.filter(function(x){return x.file===p[0];})[0],sc=m&&m.s.filter(function(x){return x[0]===p[1];})[0];return !!(sc&&allowed(RK,m,sc));}
function goFirst(list){var d=list.filter(canGo)[0];if(d)go(d);else toast('Not part of your role in the app');}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest('.phone,.tablet')||t.closest('[data-to],[data-go],[data-toast],button'))return;
 var tab=t.closest('.m-tabs > *');if(tab){var k=tab.textContent.replace(/\d+/g,'').trim().toLowerCase();if(MTAB[k]){goFirst(MTAB[k]);return;}}
 if(t.closest('.back')){back();return;}
 var mr=t.closest('.m-row,.m-need');if(mr&&!t.closest('a,button,.switch')&&(mr.matches('.m-need')||mr.querySelector('.d'))){goFirst(MTAB.machine);return;}
 var ch=t.closest('span.chip');if(ch){ask(ch.textContent.trim());return;}
 if(t.closest('.m-in')){openAsk();}});
/* in-page menus (docs side menu, top tabs made of links): show the chosen page */
document.addEventListener('click',function(e){var a=e.target.closest('section.screen nav a[href="#"],section.screen aside a[href="#"]');if(!a)return;e.preventDefault();
 var grp=a.closest('nav,aside');$$('a',grp).forEach(function(x){x.classList.toggle('on',x===a);});
 var sec=a.closest('section.screen'),h=$$('h1',sec).filter(function(x){return !x.closest('nav,aside');})[0];if(h&&a.closest('aside')){h.textContent=a.textContent.trim();flash(h);}
 else toast(a.textContent.trim());});
$$('.m-pad > span,.k-pad > span').forEach(function(x){x.setAttribute('role','button');x.tabIndex=0;});
$$('[data-pin-to]').forEach(function(p){$$('.pin-dots i,.dots i,.kdots i',p.closest('section.screen')).forEach(function(d){d.classList.remove('f');});});
$$('.m-tabs > span,.m-top .back,.m-row:has(.d),.m-need').forEach(function(x){x.setAttribute('role','button');x.tabIndex=0;if(x.matches('.back'))x.setAttribute('aria-label','Back');});
document.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[role="button"]:not(button)')){e.preventDefault();e.target.click();}});
/* option cards and question chips */
document.addEventListener('click',function(e){var c=e.target.closest('.radio-card,.opt,.choice,.k-tile:not([data-to])');if(c&&!c.closest('[data-pick],.proto,.fp-ov')&&!c.matches('[data-go],[data-to]')){$$(':scope > '+c.tagName.toLowerCase(),c.parentElement).forEach(function(x){x.classList.toggle('on',x===c);});flash(c);return;}
 var q=e.target.closest('button.chip,a.chip');if(q&&!q.closest('.proto,.ask,.fp-ov')&&!q.matches('[data-ask-q],[data-go],[data-to],[data-toast]')&&(/\?$/.test(lblOf(q))||q.closest('.ai-card,.sugs,[class*=sugg]'))){e.preventDefault();e.stopImmediatePropagation();ask(lblOf(q));}},true);
/* filters and chips: show the choice */
document.addEventListener('click',function(e){var c=e.target.closest('.fchip,button.chip,.tabs button');if(!c||c.closest('.proto,.ask,.fp-ov')||c.matches('[data-t],[data-go],[data-to],[data-toast]'))return;
 if(c.matches('.tabs button')){$$('button',c.parentElement).forEach(function(x){x.classList.toggle('on',x===c);});return;}
 if(c.closest('[data-pick],[data-multi]'))return;c.classList.toggle('on');if(c.matches('.fchip'))toast('Filter: '+lblOf(c)+(c.classList.contains('on')?' on':' off'));});
window.FP={show:show,toast:toast,ask:ask,catalog:C};
})();
