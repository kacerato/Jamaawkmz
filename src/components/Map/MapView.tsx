import React, { useMemo, useRef } from 'react';
import Map, {
  Marker,
  Source,
  Layer,
  NavigationControl,
  MapRef,
  MapLayerMouseEvent
} from 'react-map-gl';
import { Project, Point, MarkerData } from '../../types';
import type { FeatureCollection } from 'geojson';

// @ts-ignore
import electricPoleIcon from '../../assets/electric-pole.png';

// Import CSS locally or ensure it's in global
import 'mapbox-gl/dist/mapbox-gl.css';

// --- Interfaces ---

export interface PoleMarkerProps {
  point: Point;
  index: number;
  color?: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export interface MapViewProps {
  mapboxToken: string;
  mapStyle: string;
  initialViewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };

  // Data
  markers: MarkerData[];
  loadedProjects: Project[];
  manualPoints: Point[];
  currentPosition: { lat: number; lng: number } | null;
  selectedStartPoint: Point | null;
  routeCoordinates?: number[][]; // [lat, lng] array

  // State
  tracking: boolean;
  trackingInputMode: 'gps' | 'touch' | 'manual';
  paused: boolean;
  snappingEnabled?: boolean;

  // Handlers
  onMapClick: (e: MapLayerMouseEvent) => void;
  onMarkerClick: (marker: MarkerData) => void;
  onPointClick: (point: Point, project?: Project, index?: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMapLoad?: (e: any) => void;
}

// --- Sub-components ---

// Memoized Pole Marker
const PoleMarker = React.memo(({ point, index, color, onClick, isActive }: PoleMarkerProps) => {
  return (
    <Marker
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(e as unknown as React.MouseEvent);
      }}
    >
      <div className="pole-marker-container" style={{ willChange: 'transform' }}>
        <img
          src={electricPoleIcon}
          alt={`Ponto ${index}`}
          className="pole-image"
          loading="lazy"
          style={{ pointerEvents: 'none', width: '24px', height: '24px' }}
        />

        <div
          className={`pole-number-plate ${isActive ? 'pole-active' : ''}`}
          style={{
            borderColor: color || '#1e3a8a',
            color: color || '#1e3a8a',
            backgroundColor: 'white',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            bottom: '-5px',
            right: '-5px'
          }}
        >
          {index}
        </div>
      </div>
    </Marker>
  );
}, (prev, next) => {
  return (
    prev.point.id === next.point.id &&
    prev.color === next.color &&
    prev.isActive === next.isActive
  );
});

// --- Main Map Component ---

const MapView = React.memo((props: MapViewProps) => {
  const mapRef = useRef<MapRef>(null);

  // Memoize Markers GeoJSON
  const markersGeoJSON = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: props.markers.map(marker => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [marker.lng, marker.lat] },
      properties: {
        id: marker.id,
        name: marker.name,
        bairro: marker.bairro,
        descricao: marker.descricao,
        color: marker.color || '#ef4444'
      }
    }))
  }), [props.markers]);

  // Memoize Segments GeoJSON (Current Track)
  const segmentsGeoJSON = useMemo<FeatureCollection>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features: any[] = [];
    if (props.manualPoints.length > 0) {
      props.manualPoints.forEach((point, index) => {
        let parent: Point | undefined;
        if (point.connectedFrom) {
          parent = props.manualPoints.find(p => p.id === point.connectedFrom);
        } else if (index > 0) {
          parent = props.manualPoints[index - 1];
        }

        if (parent) {
          const spans = point.spans || 1;
          const color = spans === 1 ? '#00ff00' : spans === 2 ? '#ffff00' : '#ff0000';

          features.push({
            type: 'Feature',
            properties: {
              type: 'segment',
              targetPointId: point.id,
              spans: spans,
              color: color
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [parent.lng, parent.lat],
                [point.lng, point.lat]
              ]
            }
          });
        }
      });
    }
    return { type: 'FeatureCollection', features };
  }, [props.manualPoints]);

  return (
    <Map
      ref={mapRef}
      initialViewState={props.initialViewState}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      mapStyle={props.mapStyle}
      mapboxAccessToken={props.mapboxToken}
      cursor={props.tracking && props.trackingInputMode === 'touch' && !props.paused ? 'crosshair' : 'auto'}
      preserveDrawingBuffer={true}
      onClick={props.onMapClick}
      onLoad={props.onMapLoad}
    >
      <NavigationControl position="top-right" />

      {/* Markers Layer (Vector) */}
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

      {/* Loaded Projects Routes */}
      {props.loadedProjects.map(project => (
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
                    .filter(point => !point.connectedFrom)
                    .map(point => [point.lng, point.lat])
                },
                properties: {}
              },
              ...project.points
                .filter(point => point.connectedFrom)
                .map(point => {
                  const parent = project.points.find(p => p.id === point.connectedFrom);
                  return parent ? {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: [[parent.lng, parent.lat], [point.lng, point.lat]]
                    },
                    properties: {}
                  } : null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }).filter(Boolean) as any
            ]
          }}
        >
          <Layer
            id={`route-layer-${project.id}`}
            type="line"
            paint={{
              'line-color': project.color || '#3b82f6',
              'line-width': 3,
              'line-opacity': 0.8
            }}
          />
        </Source>
      ))}

      {/* Loaded Projects Points (React Markers) */}
      {props.loadedProjects.map(project => (
        <React.Fragment key={`markers-${project.id}`}>
          {project.points.map((point, index) => (
            <PoleMarker
              key={point.id}
              point={point}
              index={index + 1}
              color={project.color}
              isActive={false}
              onClick={() => props.onPointClick(point, project, index + 1)}
            />
          ))}
        </React.Fragment>
      ))}

      {/* Current Track Segments */}
      {props.manualPoints.length > 0 && (
        <Source id="segments-source" type="geojson" data={segmentsGeoJSON}>
          <Layer
            id="segment-hit-area"
            type="line"
            paint={{ 'line-width': 20, 'line-opacity': 0 }}
          />
          <Layer
            id="segment-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 3,
              'line-opacity': 0.9
            }}
          />
        </Source>
      )}

      {/* Current Track Points */}
      {props.manualPoints.map((point, index) => (
        <PoleMarker
          key={point.id}
          point={point}
          index={index + 1}
          color="#1e3a8a"
          isActive={props.selectedStartPoint?.id === point.id}
          onClick={() => props.onPointClick(point, undefined, index + 1)}
        />
      ))}

      {/* Calculated Route */}
      {props.routeCoordinates && props.routeCoordinates.length > 0 && (
        <Source id="calculated-route" type="geojson" data={{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: props.routeCoordinates.map(c => [c[1], c[0]])
          },
          properties: {}
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

      {/* Current Position Marker */}
      {props.currentPosition && (
        <Marker longitude={props.currentPosition.lng} latitude={props.currentPosition.lat}>
          <div className="current-position-marker" style={{
            width: '16px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 10px rgba(0,0,0,0.3)'
          }} />
        </Marker>
      )}

    </Map>
  );
});

export default MapView;
