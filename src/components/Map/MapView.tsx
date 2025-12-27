import React, { forwardRef } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl, MapRef } from 'react-map-gl';
import { X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PoleMarker from './PoleMarker';
import TrackingPointPopupContent from './TrackingPointPopupContent';

interface MapViewProps {
  initialViewState: any;
  mapStyleUrl: string;
  mapboxAccessToken: string;
  tracking: boolean;
  trackingInputMode: string;
  paused: boolean;
  onMapClick: (e: any) => void;
  markersGeoJSON: any;
  loadedProjects: any[];
  manualPoints: any[];
  segmentsGeoJSON: any;
  routeCoordinates: number[][];
  currentPosition: { lat: number; lng: number } | null;
  pointPopupInfo: any;
  setPointPopupInfo: (info: any) => void;
  selectedStartPoint: any;
  onSelectStart: (point: any) => void;
}

const MapView = forwardRef<MapRef, MapViewProps>(({
  initialViewState,
  mapStyleUrl,
  mapboxAccessToken,
  tracking,
  trackingInputMode,
  paused,
  onMapClick,
  markersGeoJSON,
  loadedProjects,
  manualPoints,
  segmentsGeoJSON,
  routeCoordinates,
  currentPosition,
  pointPopupInfo,
  setPointPopupInfo,
  selectedStartPoint,
  onSelectStart
}, ref) => {
  return (
    <Map
      ref={ref}
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      mapStyle={mapStyleUrl}
      mapboxAccessToken={mapboxAccessToken}
      cursor={tracking && trackingInputMode === 'touch' && !paused ? 'crosshair' : 'auto'}
      preserveDrawingBuffer={true}
      onClick={onMapClick}
    >
      <NavigationControl position="top-right" />

      {/* CAMADA DE MARCADORES OTIMIZADA */}
      <Source id="markers-source" type="geojson" data={markersGeoJSON}>
        <Layer
          id="markers-layer"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 4,
              15, 8
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }}
        />
        <Layer
          id="markers-hit-area"
          type="circle"
          paint={{
            'circle-radius': 20,
            'circle-color': 'transparent',
            'circle-opacity': 0
          }}
        />
      </Source>

      {loadedProjects.map(project => (
        <Source
          key={`source-${project.id}`}
          id={`route-${project.id}`}
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: project.points
                    .filter((point: any) => !point.connectedFrom)
                    .map((point: any) => [point.lng, point.lat])
                }
              },
              ...project.points
                .filter((point: any) => point.connectedFrom)
                .map((point: any) => {
                  const parent = project.points.find((p: any) => p.id === point.connectedFrom);
                  return parent ? {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: [[parent.lng, parent.lat], [point.lng, point.lat]]
                    }
                  } : null;
                }).filter(Boolean)
            ]
          }}
        >
          <Layer
            id={`route-layer-${project.id}`}
            type="line"
            paint={{
              'line-color': project.color,
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                10, 1,
                15, 3,
                22, 6
              ],
              'line-opacity': 0.8
            }}
          />
        </Source>
      ))}

      {loadedProjects.map(project => (
        <React.Fragment key={`markers-${project.id}`}>
          {project.points.map((point: any, index: number) => (
            <PoleMarker
              key={point.id}
              point={point}
              index={index + 1}
              color={project.color}
              isActive={false}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPointPopupInfo({
                  point,
                  pointNumber: index + 1,
                  projectName: project.name,
                  projectId: project.id,
                  totalPoints: project.points.length,
                  color: project.color,
                  isManualPoint: false
                });
              }}
            />
          ))}
        </React.Fragment>
      ))}

      {/* CAMADA DE TRAÇADO COM VÃOS */}
      {manualPoints.length > 0 && (
        <Source id="segments-source" type="geojson" data={segmentsGeoJSON}>
          <Layer
            id="segment-hit-area"
            type="line"
            paint={{
              'line-width': 20,
              'line-opacity': 0
            }}
          />

          <Layer
            id="segment-line"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                10, 1,
                15, 3,
                22, 6
              ],
              'line-opacity': 0.9
            }}
          />

          <Layer
            id="segment-badge-bg"
            type="circle"
            filter={['==', 'type', 'badge']}
            paint={{
              'circle-radius': 8,
              'circle-color': '#0f172a',
              'circle-stroke-width': 2,
              'circle-stroke-color': ['get', 'color']
            }}
          />

          <Layer
            id="segment-badge-text"
            type="symbol"
            filter={['==', 'type', 'badge']}
            layout={{
              'text-field': ['get', 'label'],
              'text-size': 10,
              'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
              'text-allow-overlap': true
            }}
            paint={{
              'text-color': '#ffffff'
            }}
          />
        </Source>
      )}

      {manualPoints.map((point, index) => (
        <PoleMarker
          key={point.id}
          point={point}
          index={index + 1}
          color="#1e3a8a"
          isActive={selectedStartPoint && selectedStartPoint.id === point.id}
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPointPopupInfo({
              point,
              pointNumber: index + 1,
              isManualPoint: true,
              totalPoints: manualPoints.length
            });
          }}
        />
      ))}

      {routeCoordinates.length > 0 && (
        <Source id="calculated-route" type="geojson" data={{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates.map(c => [c[1], c[0]])
          }
        }}>
          <Layer
            id="calculated-route-layer"
            type="line"
            paint={{
              'line-color': '#06B6D4',
              'line-width': 4,
              'line-opacity': 0.8
            }}
          />
        </Source>
      )}

      {currentPosition && (
        <Marker longitude={currentPosition.lng} latitude={currentPosition.lat}>
          <div className="current-position-marker" />
        </Marker>
      )}

      {pointPopupInfo && pointPopupInfo.isManualPoint && (
        <Popup
          longitude={pointPopupInfo.point.lng}
          latitude={pointPopupInfo.point.lat}
          onClose={() => setPointPopupInfo(null)}
          className="modern-popup"
          closeButton={false}
          anchor="bottom"
          offset={20}
          maxWidth="300px"
        >
          <TrackingPointPopupContent
            pointInfo={pointPopupInfo}
            onClose={() => setPointPopupInfo(null)}
            onSelectStart={onSelectStart}
            selectedStartPoint={selectedStartPoint}
            manualPoints={manualPoints}
          />
        </Popup>
      )}

      {pointPopupInfo && pointPopupInfo.point && !pointPopupInfo.isManualPoint && (
        <Popup
          longitude={pointPopupInfo.point.lng}
          latitude={pointPopupInfo.point.lat}
          onClose={() => setPointPopupInfo(null)}
          className="modern-popup"
          closeButton={false}
          maxWidth="300px"
          anchor="bottom"
          offset={15}
        >
          <div className="w-[260px] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">

            <div className="relative p-3 flex items-center justify-between bg-slate-800/50 border-b border-slate-700/50">
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: pointPopupInfo.color }}
              />

              <div className="pl-2 flex flex-col overflow-hidden">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Projeto
                </span>
                <span className="text-sm font-bold text-white truncate leading-tight" title={pointPopupInfo.projectName}>
                  {pointPopupInfo.projectName}
                </span>
              </div>

              <button
                onClick={() => setPointPopupInfo(null)}
                className="h-6 w-6 flex items-center justify-center rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="p-3 space-y-3">

              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 shadow-inner"
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: pointPopupInfo.color }}
                  >
                    {pointPopupInfo.pointNumber}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-300 font-medium">Ponto de Traçado</span>
                  <span className="text-[10px] text-slate-500">
                    Total de {pointPopupInfo.totalPoints} pontos
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex flex-col">
                  <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Latitude</span>
                  <span className="font-mono text-xs text-cyan-400 font-medium truncate">
                    {pointPopupInfo.point.lat?.toFixed(7)}
                  </span>
                </div>
                <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex flex-col">
                  <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Longitude</span>
                  <span className="font-mono text-xs text-cyan-400 font-medium truncate">
                    {pointPopupInfo.point.lng?.toFixed(7)}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="w-full h-7 text-xs border border-dashed border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition-all"
                onClick={() => {
                  const coords = `${pointPopupInfo.point.lat}, ${pointPopupInfo.point.lng}`;
                  navigator.clipboard.writeText(coords);
                }}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> Copiar Coordenadas
                </span>
              </Button>

            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
});

export default MapView;
